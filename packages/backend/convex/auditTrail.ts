import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { authComponent } from "./auth";
import {
  AUDIT_ACTIONS,
  AUDIT_SOURCE_TRANSPORTS,
  AUDIT_STATUSES,
} from "./auditTrailConstants";
import { rateLimit } from "./rateLimits";
import { internalMutation, mutation, query } from "./_generated/server";

// ---------------------------------------------------------------------------
// Field length limits (defense in depth — truncate, never reject)
// ---------------------------------------------------------------------------

const MAX_ACTOR_LENGTH = 500;
const MAX_ACTION_LENGTH = 100;
const MAX_RESOURCE_LENGTH = 500;
const MAX_VALUE_LENGTH = 10_000;
const MAX_REASON_LENGTH = 2_000;
const MAX_META_LENGTH = 5_000;
const MAX_STATUS_LENGTH = 200;
const MAX_SOURCE_LENGTH = 200;

function truncateField(
  value: string | undefined,
  max: number,
): { value: string | undefined; wasTruncated: boolean } {
  if (value === undefined) return { value: undefined, wasTruncated: false };
  if (value.length <= max) return { value, wasTruncated: false };
  return { value: value.slice(0, max), wasTruncated: true };
}

// ---------------------------------------------------------------------------
// buildAuditEvent — private helper that creates the full document shape
// ---------------------------------------------------------------------------

interface AuditEventInput {
  happenedAt?: number;
  authenticatedUserId?: string;
  actor: string;
  source: string;
  action: string;
  resource: string;
  status: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  meta?: string;
}

interface AuditTrailDoc {
  happenedAt: number;
  authenticatedUserId?: string;
  actor: string;
  source: string;
  action: string;
  resource: string;
  status: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  meta?: string;
  truncatedFields?: string;
}

function buildAuditEvent(fields: AuditEventInput): AuditTrailDoc {
  // Validate action against enum
  if (!(AUDIT_ACTIONS as readonly string[]).includes(fields.action)) {
    throw new Error(`UNKNOWN_AUDIT_ACTION: ${fields.action}`);
  }

  // Validate status against enum
  if (!(AUDIT_STATUSES as readonly string[]).includes(fields.status)) {
    throw new Error(`UNKNOWN_AUDIT_STATUS: ${fields.status}`);
  }

  // Validate source transport prefix
  const colonIdx = fields.source.indexOf(":");
  const transport = colonIdx >= 0 ? fields.source.slice(0, colonIdx) : fields.source;
  if (!(AUDIT_SOURCE_TRANSPORTS as readonly string[]).includes(transport)) {
    throw new Error(`UNKNOWN_AUDIT_SOURCE_TRANSPORT: ${transport}`);
  }

  // Truncate fields and track which were truncated
  const truncated: string[] = [];

  const actor = truncateField(fields.actor, MAX_ACTOR_LENGTH);
  if (actor.wasTruncated) truncated.push("actor");

  const action = truncateField(fields.action, MAX_ACTION_LENGTH);
  if (action.wasTruncated) truncated.push("action");

  const resource = truncateField(fields.resource, MAX_RESOURCE_LENGTH);
  if (resource.wasTruncated) truncated.push("resource");

  const status = truncateField(fields.status, MAX_STATUS_LENGTH);
  if (status.wasTruncated) truncated.push("status");

  const source = truncateField(fields.source, MAX_SOURCE_LENGTH);
  if (source.wasTruncated) truncated.push("source");

  const oldValue = truncateField(fields.oldValue, MAX_VALUE_LENGTH);
  if (oldValue.wasTruncated) truncated.push("oldValue");

  const newValue = truncateField(fields.newValue, MAX_VALUE_LENGTH);
  if (newValue.wasTruncated) truncated.push("newValue");

  const reason = truncateField(fields.reason, MAX_REASON_LENGTH);
  if (reason.wasTruncated) truncated.push("reason");

  const meta = truncateField(fields.meta, MAX_META_LENGTH);
  if (meta.wasTruncated) truncated.push("meta");

  const doc: AuditTrailDoc = {
    happenedAt: fields.happenedAt ?? Date.now(),
    actor: actor.value!,
    source: source.value!,
    action: action.value!,
    resource: resource.value!,
    status: status.value!,
  };

  if (fields.authenticatedUserId !== undefined) {
    doc.authenticatedUserId = fields.authenticatedUserId;
  }
  if (oldValue.value !== undefined) doc.oldValue = oldValue.value;
  if (newValue.value !== undefined) doc.newValue = newValue.value;
  if (reason.value !== undefined) doc.reason = reason.value;
  if (meta.value !== undefined) doc.meta = meta.value;
  if (truncated.length > 0) doc.truncatedFields = truncated.join(",");

  return doc;
}

// ---------------------------------------------------------------------------
// insertEvent — internalMutation for server-side code (actions, httpActions)
// ---------------------------------------------------------------------------

export const insertEvent = internalMutation({
  args: {
    happenedAt: v.optional(v.number()),
    authenticatedUserId: v.optional(v.string()),
    actor: v.string(),
    sourceDetail: v.string(),
    action: v.string(),
    resource: v.string(),
    status: v.string(),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    reason: v.optional(v.string()),
    meta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = buildAuditEvent({
      ...args,
      source: `server:${args.sourceDetail}`,
      happenedAt: args.happenedAt ?? undefined,
    });
    await ctx.db.insert("auditTrail", doc);
  },
});

// ---------------------------------------------------------------------------
// postEvent — frontend clients (over Convex WebSocket)
// ---------------------------------------------------------------------------

export const postEvent = mutation({
  args: {
    happenedAt: v.number(),
    sourceDetail: v.optional(v.string()),
    action: v.string(),
    resource: v.string(),
    status: v.optional(v.string()),
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    reason: v.optional(v.string()),
    meta: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return;

    const ownerId = (
      (user.userId as string | undefined) ??
      (user._id as string | undefined)
    )?.toString();
    if (!ownerId) return;

    await rateLimit(ctx, {
      name: "mutationGlobal",
      key: ownerId,
      throws: true,
    });

    const email = (user as Record<string, unknown>).email as string;
    const doc = buildAuditEvent({
      authenticatedUserId: ownerId,
      actor: email,
      source: `web:${args.sourceDetail ?? ""}`,
      action: args.action,
      resource: args.resource,
      status: args.status ?? "succeeded",
      happenedAt: args.happenedAt,
      oldValue: args.oldValue,
      newValue: args.newValue,
      reason: args.reason,
      meta: args.meta,
    });
    await ctx.db.insert("auditTrail", doc);
  },
});

// ---------------------------------------------------------------------------
// list — paginated query (admin-only, reverse chronological)
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    filterAction: v.optional(v.string()),
    filterActor: v.optional(v.string()),
    filterSource: v.optional(v.string()),
    filterStatus: v.optional(v.string()),
    filterAuthenticatedUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Return empty page when auth hasn't resolved yet or user isn't admin.
    // The query re-runs reactively once auth resolves — no throw needed.
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user || (user as Record<string, unknown>).role !== "admin") {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    // Step 1: Pick the best index for the primary filter dimension.
    // Remaining active filters are applied as post-query .filter() calls
    // so all selected filters combine conjunctively.
    const wantAction = args.filterAction ?? null;
    const wantStatus = args.filterStatus ?? null;
    const wantActor = args.filterActor ?? null;
    const wantSource = args.filterSource ?? null;
    const wantUserId = args.filterAuthenticatedUserId ?? null;

    // Track which dimensions are handled by the index
    let actionHandled = false;
    let statusHandled = false;
    let actorHandled = false;
    let sourceHandled = false;
    let userIdHandled = false;

    let q;
    if (wantAction !== null && wantStatus !== null) {
      q = ctx.db
        .query("auditTrail")
        .withIndex("by_action_status_happenedAt", (idx) =>
          idx.eq("action", wantAction).eq("status", wantStatus),
        );
      actionHandled = true;
      statusHandled = true;
    } else if (wantAction !== null) {
      q = ctx.db
        .query("auditTrail")
        .withIndex("by_action_happenedAt", (idx) =>
          idx.eq("action", wantAction),
        );
      actionHandled = true;
    } else if (wantActor !== null) {
      q = ctx.db
        .query("auditTrail")
        .withIndex("by_actor_happenedAt", (idx) =>
          idx.eq("actor", wantActor),
        );
      actorHandled = true;
    } else if (wantSource !== null) {
      q = ctx.db
        .query("auditTrail")
        .withIndex("by_source_happenedAt", (idx) =>
          idx.eq("source", wantSource),
        );
      sourceHandled = true;
    } else if (wantUserId !== null) {
      q = ctx.db
        .query("auditTrail")
        .withIndex("by_authenticatedUserId_happenedAt", (idx) =>
          idx.eq("authenticatedUserId", wantUserId),
        );
      userIdHandled = true;
    } else if (wantStatus !== null) {
      q = ctx.db
        .query("auditTrail")
        .withIndex("by_status_happenedAt", (idx) =>
          idx.eq("status", wantStatus),
        );
      statusHandled = true;
    } else {
      q = ctx.db.query("auditTrail").withIndex("by_happenedAt");
    }

    // Step 2: Post-filter remaining dimensions not covered by the index
    let filtered = q;
    if (wantAction !== null && !actionHandled) {
      filtered = filtered.filter((f) =>
        f.eq(f.field("action"), wantAction),
      );
    }
    if (wantStatus !== null && !statusHandled) {
      filtered = filtered.filter((f) =>
        f.eq(f.field("status"), wantStatus),
      );
    }
    if (wantActor !== null && !actorHandled) {
      filtered = filtered.filter((f) =>
        f.eq(f.field("actor"), wantActor),
      );
    }
    if (wantSource !== null && !sourceHandled) {
      filtered = filtered.filter((f) =>
        f.eq(f.field("source"), wantSource),
      );
    }
    if (wantUserId !== null && !userIdHandled) {
      filtered = filtered.filter((f) =>
        f.eq(f.field("authenticatedUserId"), wantUserId),
      );
    }

    return await filtered.order("desc").paginate(args.paginationOpts);
  },
});
