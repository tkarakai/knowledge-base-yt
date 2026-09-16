import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { scheduleAuditEvent } from "./auditTrailHelpers";
import { parseOnboardingType, isWaitlistOnboarding } from "./onboardingType";
import {
  authedMutation,
  assertMaxLength,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "./functions";
import { rateLimit } from "./rateLimits";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BULK_INVITE_EMAILS = 100;

/** Valid superpower values for the waitlist meta field. */
const VALID_SUPERPOWERS = [
  "coffee-to-code",
  "pixel-perfect",
  "bug-whisperer",
  "spreadsheet-wizard",
  "inbox-zero",
  "parallel-parking",
  "remembering-names",
  "never-burning-toast",
  "explaining-tech",
  "finding-restaurants",
  "staying-calm",
  "other",
] as const;

/** Valid excitement values for the waitlist meta field. */
const VALID_EXCITEMENT = [
  "take-my-money",
  "cant-wait",
  "cautiously-optimistic",
  "just-browsing",
  "friend-made-me",
] as const;

/** Validate and parse the JSON meta string. Throws on invalid input. */
function validateMeta(meta: string): void {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(meta) as Record<string, unknown>;
  } catch {
    throw new Error("INVALID_META: must be valid JSON");
  }

  if (!Array.isArray(parsed.superpowers) || parsed.superpowers.length === 0) {
    throw new Error("INVALID_META: at least one superpower is required");
  }
  for (const s of parsed.superpowers) {
    if (!(VALID_SUPERPOWERS as readonly string[]).includes(s as string)) {
      throw new Error("INVALID_META: invalid superpower value");
    }
  }

  if (!Array.isArray(parsed.excitement) || parsed.excitement.length === 0) {
    throw new Error("INVALID_META: at least one excitement level is required");
  }
  for (const e of parsed.excitement) {
    if (!(VALID_EXCITEMENT as readonly string[]).includes(e as string)) {
      throw new Error("INVALID_META: invalid excitement value");
    }
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Public: join waitlist (called from httpAction, not directly by clients)
// ---------------------------------------------------------------------------

export const join = internalMutation({
  args: {
    email: v.string(),
    meta: v.string(),
    clientIp: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Rate limit by client IP to prevent spam
    await rateLimit(ctx, {
      name: "waitlistJoin",
      key: args.clientIp ?? "unknown",
      throws: true,
    });

    // Waitlist joins are only allowed in waitlist onboarding mode.
    const onboardingTypeRaw = await ctx.runQuery(
      internal.appSettings.getInternal,
      { key: "onboardingType" }
    );
    const onboardingType = parseOnboardingType(onboardingTypeRaw);
    if (!isWaitlistOnboarding(onboardingType)) {
      throw new Error("WAITLIST_NOT_ENABLED");
    }

    // Validate inputs
    assertMaxLength(args.email, MAX_NAME_LENGTH, "EMAIL");
    assertMaxLength(args.meta, MAX_DESCRIPTION_LENGTH, "META");
    validateMeta(args.meta);

    // Check for duplicate email
    const existing = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      await scheduleAuditEvent(ctx, {
        actor: args.email,
        sourceDetail: "waitlist",
        action: "waitlist.joined",
        resource: `waitlist-entry:${existing._id}`,
        status: "succeeded",
        meta: JSON.stringify({
          ip: args.clientIp ?? "unknown",
          alreadyJoined: true,
        }),
      });
      return { alreadyJoined: true };
    }

    const entryId = await ctx.db.insert("waitlistEntries", {
      email: args.email,
      meta: args.meta,
      status: "waiting",
      createdAt: Date.now(),
    });

    await scheduleAuditEvent(ctx, {
      actor: args.email,
      sourceDetail: "waitlist",
      action: "waitlist.joined",
      resource: `waitlist-entry:${entryId}`,
      status: "succeeded",
      meta: JSON.stringify({ ip: args.clientIp ?? "unknown" }),
    });

    return { alreadyJoined: false };
  },
});

// ---------------------------------------------------------------------------
// Admin: list all waitlist entries
// ---------------------------------------------------------------------------

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    const role = user ? (user as Record<string, unknown>).role : undefined;
    if (role !== "admin") {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const entries = await ctx.db
      .query("waitlistEntries")
      .withIndex("by_created")
      .order("desc")
      .paginate(args.paginationOpts);

    // Exclude emails that belong to admin accounts
    const adminEmailDocs = await ctx.db.query("adminEmails").collect();
    const adminEmailSet = new Set(
      adminEmailDocs.map((d) => d.email.toLowerCase())
    );

    const now = Date.now();

    return {
      ...entries,
      page: entries.page
        .filter((entry) => !adminEmailSet.has(entry.email.toLowerCase()))
        .map((entry) => ({
          ...entry,
          invitationExpired:
            entry.status === "invited" &&
            entry.invitationExpiresAt != null &&
            now > entry.invitationExpiresAt,
        })),
    };
  },
});

// ---------------------------------------------------------------------------
// Admin: invite a waitlist entry (sends email with token)
// ---------------------------------------------------------------------------

export const invite = authedMutation({
  args: { entryId: v.id("waitlistEntries") },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("ENTRY_NOT_FOUND");
    if (entry.status === "claimed") throw new Error("ALREADY_CLAIMED");

    // Allow re-inviting only if the invitation has expired
    if (entry.status === "invited") {
      if (
        !entry.invitationExpiresAt ||
        Date.now() <= entry.invitationExpiresAt
      ) {
        throw new Error("ALREADY_INVITED");
      }
    }

    // Mark as invited
    await ctx.db.patch(args.entryId, {
      status: "invited",
      invitedAt: Date.now(),
    });

    // Schedule action to generate token + send email
    await ctx.scheduler.runAfter(
      0,
      internal.waitlistActions.generateTokenAndSendEmail,
      {
        entryId: args.entryId,
        email: entry.email,
      }
    );

    const email = (ctx.user as Record<string, unknown>).email as string;
    await scheduleAuditEvent(ctx, {
      actor: email,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      action: "waitlist.invitation.sent",
      resource: `waitlist-entry:${args.entryId}`,
      status: "succeeded",
      meta: JSON.stringify({ inviteeEmail: entry.email }),
    });
  },
});

// ---------------------------------------------------------------------------
// Admin: invite many by email (upsert entries, then send invitation emails)
// ---------------------------------------------------------------------------

export const inviteMany = authedMutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");
    if (args.emails.length > MAX_BULK_INVITE_EMAILS) {
      throw new Error("TOO_MANY_EMAILS");
    }

    const normalized = Array.from(
      new Set(args.emails.map((email) => normalizeEmail(email)).filter(Boolean))
    );

    if (normalized.length === 0) {
      throw new Error("NO_EMAILS_PROVIDED");
    }

    const invited: string[] = [];
    const skipped: Array<{ email: string; reason: string }> = [];
    const now = Date.now();
    const actorEmail = (ctx.user as Record<string, unknown>).email as string;

    for (const email of normalized) {
      if (email.length > MAX_NAME_LENGTH) {
        skipped.push({ email, reason: "EMAIL_TOO_LONG" });
        continue;
      }

      if (!EMAIL_PATTERN.test(email)) {
        skipped.push({ email, reason: "INVALID_EMAIL" });
        continue;
      }

      const existing = await ctx.db
        .query("waitlistEntries")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();

      let entryId: Id<"waitlistEntries">;

      if (existing) {
        if (existing.status === "claimed") {
          skipped.push({ email, reason: "ALREADY_CLAIMED" });
          continue;
        }

        const alreadyInvited =
          existing.status === "invited" &&
          (!existing.invitationExpiresAt || now <= existing.invitationExpiresAt);
        if (alreadyInvited) {
          skipped.push({ email, reason: "ALREADY_INVITED" });
          continue;
        }

        await ctx.db.patch(existing._id, {
          status: "invited",
          invitedAt: now,
          invitationExpiresAt: undefined,
        });
        entryId = existing._id;
      } else {
        entryId = await ctx.db.insert("waitlistEntries", {
          email,
          meta: JSON.stringify({ source: "admin-invite" }),
          status: "invited",
          invitedAt: now,
          createdAt: now,
        });
      }

      await ctx.scheduler.runAfter(
        0,
        internal.waitlistActions.generateTokenAndSendEmail,
        {
          entryId,
          email,
        }
      );

      invited.push(email);

      await scheduleAuditEvent(ctx, {
        actor: actorEmail,
        authenticatedUserId: ctx.ownerId,
        sourceDetail: "admin-mutation",
        action: "waitlist.invitation.sent",
        resource: `waitlist-entry:${entryId}`,
        status: "succeeded",
        meta: JSON.stringify({ inviteeEmail: email, source: "direct-invite" }),
      });
    }

    return { invited, skipped };
  },
});

// ---------------------------------------------------------------------------
// Admin: uninvite (revoke invitation if not yet claimed)
// ---------------------------------------------------------------------------

export const uninvite = authedMutation({
  args: { entryId: v.id("waitlistEntries") },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("ENTRY_NOT_FOUND");
    if (entry.status === "claimed") throw new Error("ALREADY_CLAIMED");

    // Revoke all active tokens for this entry
    const tokens = await ctx.db
      .query("invitationTokens")
      .withIndex("by_waitlist_entry", (q) =>
        q.eq("waitlistEntryId", args.entryId)
      )
      .collect();

    const now = Date.now();
    for (const token of tokens) {
      if (token.status === "sent" || token.status === "claiming") {
        await ctx.db.patch(token._id, { status: "revoked", revokedAt: now });
      }
    }

    // Reset entry to waiting
    await ctx.db.patch(args.entryId, {
      status: "waiting",
      invitedAt: undefined,
      invitationExpiresAt: undefined,
    });

    const email = (ctx.user as Record<string, unknown>).email as string;
    await scheduleAuditEvent(ctx, {
      actor: email,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      action: "waitlist.invitation.revoked",
      resource: `waitlist-entry:${args.entryId}`,
      status: "succeeded",
      meta: JSON.stringify({ inviteeEmail: entry.email }),
    });
  },
});

// ---------------------------------------------------------------------------
// Admin: delete a waitlist entry
// ---------------------------------------------------------------------------

export const remove = authedMutation({
  args: { entryId: v.id("waitlistEntries") },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("ENTRY_NOT_FOUND");
    if (entry.status === "claimed") throw new Error("CANNOT_DELETE_CLAIMED");

    // Delete associated tokens
    const tokens = await ctx.db
      .query("invitationTokens")
      .withIndex("by_waitlist_entry", (q) =>
        q.eq("waitlistEntryId", args.entryId)
      )
      .collect();

    for (const token of tokens) {
      await ctx.db.delete(token._id);
    }

    await ctx.db.delete(args.entryId);

    const email = (ctx.user as Record<string, unknown>).email as string;
    await scheduleAuditEvent(ctx, {
      actor: email,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      action: "waitlist.entry.deleted",
      resource: `waitlist-entry:${args.entryId}`,
      status: "succeeded",
      meta: JSON.stringify({ deletedEmail: entry.email }),
    });
  },
});
