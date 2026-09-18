import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { scheduleAuditEvent } from "./auditTrailHelpers";
import {
  authedMutation,
  authedQuery,
  assertMaxLength,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from "./functions";

const MAX_LEARN_MORE_HTML_LENGTH = 50_000;

type ScheduledJobId = Id<"_scheduled_functions">;

type AnnouncementEditableFields = {
  name: string;
  bannerText: string;
  callToActionName?: string;
  callToActionUrl?: string;
  learnMoreName?: string;
  learnMoreContent?: string;
  scheduleStart?: number;
  scheduleEnd?: number;
};

type AnnouncementRecencyCandidate = Pick<
  Doc<"announcements">,
  "_id" | "_creationTime" | "updatedAt"
>;

type AuditIdentity = {
  actor: string;
  sourceDetail: string;
  authenticatedUserId?: string;
  updatedBy?: string;
};

type AdminSortField = "scheduleStart" | "scheduleEnd" | "status" | "name";
type AdminSortDirection = "asc" | "desc";
type AdminAnnouncementStatus =
  | "archived"
  | "live_now"
  | "scheduled"
  | "scheduled_cancelled"
  | "ready"
  | "draft"
  | "ended";

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function assertFiniteTimestamp(value: number | undefined, fieldName: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value)) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}`);
  }
}

function validateAnnouncementInput(input: AnnouncementEditableFields): void {
  assertMaxLength(input.name, MAX_NAME_LENGTH, "ANNOUNCEMENT_NAME");
  assertMaxLength(input.bannerText, MAX_DESCRIPTION_LENGTH, "BANNER_TEXT");
  assertMaxLength(input.callToActionName, MAX_NAME_LENGTH, "CTA_NAME");
  assertMaxLength(input.callToActionUrl, MAX_DESCRIPTION_LENGTH, "CTA_URL");
  assertMaxLength(input.learnMoreName, MAX_NAME_LENGTH, "LEARN_MORE_NAME");
  assertMaxLength(
    input.learnMoreContent,
    MAX_LEARN_MORE_HTML_LENGTH,
    "LEARN_MORE_CONTENT"
  );

  if (!input.name.trim()) {
    throw new Error("NAME_REQUIRED");
  }
  if (!input.bannerText.trim()) {
    throw new Error("BANNER_TEXT_REQUIRED");
  }

  assertFiniteTimestamp(input.scheduleStart, "scheduleStart");
  assertFiniteTimestamp(input.scheduleEnd, "scheduleEnd");

  if (
    input.scheduleStart !== undefined &&
    input.scheduleEnd !== undefined &&
    input.scheduleStart >= input.scheduleEnd
  ) {
    throw new Error("INVALID_SCHEDULE_WINDOW");
  }

  if (input.callToActionName && !input.callToActionUrl) {
    throw new Error("CTA_URL_REQUIRED");
  }
  if (input.callToActionUrl && !isValidHttpUrl(input.callToActionUrl)) {
    throw new Error("CTA_URL_INVALID");
  }
  if (input.callToActionUrl && !input.callToActionName) {
    throw new Error("CTA_NAME_REQUIRED");
  }

  if (input.learnMoreName && !input.learnMoreContent) {
    throw new Error("LEARN_MORE_CONTENT_REQUIRED");
  }
}

function compareAnnouncementRecency(
  a: AnnouncementRecencyCandidate,
  b: AnnouncementRecencyCandidate
): number {
  if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt;
  if (a._creationTime !== b._creationTime) {
    return b._creationTime - a._creationTime;
  }
  return String(b._id).localeCompare(String(a._id));
}

function isArchived(announcement: Doc<"announcements">): boolean {
  return announcement.isArchived === true;
}

function isActiveNow(announcement: Doc<"announcements">, now: number): boolean {
  if (isArchived(announcement)) return false;
  if (!announcement.isLive) return false;
  if (
    announcement.scheduleStart !== undefined &&
    now < announcement.scheduleStart
  ) {
    return false;
  }
  if (announcement.scheduleEnd !== undefined && now > announcement.scheduleEnd) {
    return false;
  }
  return true;
}

function isPublishNowEligible(announcement: Doc<"announcements">, now: number): boolean {
  if (isArchived(announcement)) return false;
  const startEligible =
    announcement.scheduleStart === undefined || announcement.scheduleStart <= now;
  const endEligible =
    announcement.scheduleEnd === undefined || announcement.scheduleEnd > now;
  return startEligible && endEligible;
}

function getAdminAnnouncementStatus(
  announcement: Doc<"announcements">,
  now: number
): AdminAnnouncementStatus {
  if (isArchived(announcement)) return "archived";
  if (isActiveNow(announcement, now)) return "live_now";

  if (announcement.scheduleStart !== undefined && announcement.scheduleStart > now) {
    return announcement.publishJobId ? "scheduled" : "scheduled_cancelled";
  }

  if (announcement.scheduleEnd !== undefined && announcement.scheduleEnd <= now) {
    return "ended";
  }

  if (
    isPublishNowEligible(announcement, now) &&
    (announcement.scheduleStart !== undefined || announcement.scheduleEnd !== undefined)
  ) {
    return "ready";
  }

  return "draft";
}

function getAnnouncementStatusRank(announcement: Doc<"announcements">, now: number): number {
  const status = getAdminAnnouncementStatus(announcement, now);
  switch (status) {
    case "archived":
      return 6;
    case "live_now":
      return 0;
    case "scheduled":
      return 1;
    case "scheduled_cancelled":
      return 2;
    case "ready":
      return 3;
    case "draft":
      return 4;
    case "ended":
      return 5;
    default:
      return 7;
  }
}

function compareOptionalNumber(a: number | undefined, b: number | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a - b;
}

function sortForAdminByField(
  items: Doc<"announcements">[],
  now: number,
  sortBy: AdminSortField,
  sortDirection: AdminSortDirection
): Doc<"announcements">[] {
  const direction = sortDirection === "desc" ? -1 : 1;

  return [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "scheduleStart":
        comparison = compareOptionalNumber(a.scheduleStart, b.scheduleStart);
        break;
      case "scheduleEnd":
        comparison = compareOptionalNumber(a.scheduleEnd, b.scheduleEnd);
        break;
      case "status":
        comparison =
          getAnnouncementStatusRank(a, now) - getAnnouncementStatusRank(b, now);
        break;
      case "name":
        comparison = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
        });
        break;
      default:
        comparison = 0;
        break;
    }

    if (comparison !== 0) return comparison * direction;
    return compareAnnouncementRecency(a, b);
  });
}

function sortForAdmin(items: Doc<"announcements">[]): Doc<"announcements">[] {
  return [...items].sort((a, b) => {
    const aNoStart = a.scheduleStart === undefined;
    const bNoStart = b.scheduleStart === undefined;
    if (aNoStart !== bNoStart) return aNoStart ? -1 : 1;

    if (a.scheduleStart !== b.scheduleStart) {
      return (b.scheduleStart ?? Number.NEGATIVE_INFINITY) -
        (a.scheduleStart ?? Number.NEGATIVE_INFINITY);
    }

    return compareAnnouncementRecency(a, b);
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getLandingPageUrl(): string {
  return requireEnv("LANDING_URL");
}

function getWebAppUrl(): string {
  const raw = requireEnv("SITE_URL");
  const first = raw
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);
  if (!first) throw new Error("SITE_URL environment variable is empty");
  return first;
}

function renderLearnMoreContent(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return html
    .replaceAll("{{landingPageUrl}}", getLandingPageUrl())
    .replaceAll("{{webAppUrl}}", getWebAppUrl());
}

function toRuntimeAnnouncement(announcement: Doc<"announcements">) {
  return {
    _id: announcement._id,
    name: announcement.name,
    bannerText: announcement.bannerText,
    callToActionName: announcement.callToActionName,
    callToActionUrl: announcement.callToActionUrl,
    learnMoreName: announcement.learnMoreName,
    learnMoreContent: renderLearnMoreContent(announcement.learnMoreContent),
    scheduleStart: announcement.scheduleStart,
    scheduleEnd: announcement.scheduleEnd,
    isLive: announcement.isLive,
    isArchived: announcement.isArchived,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

async function getActiveAnnouncement(db: QueryCtx["db"]): Promise<Doc<"announcements"> | null> {
  const live = await db
    .query("announcements")
    .withIndex("by_isLive", (q) => q.eq("isLive", true))
    .collect();

  const now = Date.now();
  const active = live
    .filter((entry) => isActiveNow(entry, now))
    .sort(compareAnnouncementRecency);

  return active[0] ?? null;
}

async function logAnnouncementAudit(
  ctx: Pick<MutationCtx, "scheduler">,
  identity: AuditIdentity,
  args: {
    action:
      | "announcement.created"
      | "announcement.updated"
      | "announcement.deleted"
      | "announcement.live_enabled"
      | "announcement.live_disabled"
      | "announcement.publish_scheduled"
      | "announcement.publish_canceled"
      | "announcement.published"
      | "announcement.publish_noop"
      | "announcement.unpublish_scheduled"
      | "announcement.unpublished"
      | "announcement.unpublish_noop";
    announcementId: Id<"announcements">;
    reason?: string;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await scheduleAuditEvent(ctx, {
    actor: identity.actor,
    authenticatedUserId: identity.authenticatedUserId,
    sourceDetail: identity.sourceDetail,
    action: args.action,
    resource: `announcement:${args.announcementId}`,
    status: "succeeded",
    reason: args.reason,
    meta: args.meta ? JSON.stringify(args.meta) : undefined,
  });
}

async function tryCancelScheduledJob(
  ctx: Pick<MutationCtx, "scheduler">,
  jobId: ScheduledJobId | undefined
): Promise<void> {
  if (!jobId) return;
  try {
    await ctx.scheduler.cancel(jobId);
  } catch (error) {
    console.warn("Failed to cancel scheduled announcement job", error);
  }
}

async function disableLiveAnnouncementsExcept(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  keepId: Id<"announcements">,
  now: number,
  identity: AuditIdentity,
  reason: string
): Promise<Id<"announcements">[]> {
  const currentlyLive = await ctx.db
    .query("announcements")
    .withIndex("by_isLive", (q) => q.eq("isLive", true))
    .collect();

  const disabledIds: Id<"announcements">[] = [];

  for (const row of currentlyLive) {
    if (row._id === keepId) continue;

    await ctx.db.patch(row._id, {
      isLive: false,
      updatedAt: now,
      ...(identity.updatedBy ? { updatedBy: identity.updatedBy } : {}),
    });
    disabledIds.push(row._id);

    await logAnnouncementAudit(ctx, identity, {
      action: "announcement.publish_canceled",
      announcementId: row._id,
      reason,
      meta: {
        replacedByAnnouncementId: keepId,
      },
    });
  }

  return disabledIds;
}

async function publishAnnouncementNowInternal(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    announcementId: Id<"announcements">;
    identity: AuditIdentity;
    reason: string;
    requireEligibility: boolean;
    setScheduleStartToNow?: boolean;
  }
): Promise<{ disabledIds: Id<"announcements">[] }> {
  const announcement = await ctx.db.get(args.announcementId);
  if (!announcement) throw new Error("ANNOUNCEMENT_NOT_FOUND");
  if (isArchived(announcement)) throw new Error("ANNOUNCEMENT_ARCHIVED");

  const now = Date.now();
  if (args.requireEligibility && !isPublishNowEligible(announcement, now)) {
    throw new Error("PUBLISH_NOW_NOT_ALLOWED");
  }

  const disabledIds = await disableLiveAnnouncementsExcept(
    ctx,
    args.announcementId,
    now,
    args.identity,
    args.reason
  );

  await tryCancelScheduledJob(ctx, announcement.publishJobId);

  await ctx.db.patch(args.announcementId, {
    isLive: true,
    publishJobId: undefined,
    ...(args.setScheduleStartToNow ? { scheduleStart: now } : {}),
    updatedAt: now,
    ...(args.identity.updatedBy ? { updatedBy: args.identity.updatedBy } : {}),
  });

  await logAnnouncementAudit(ctx, args.identity, {
    action: "announcement.published",
    announcementId: args.announcementId,
    reason: args.reason,
    meta: {
      disabledOtherLiveAnnouncementIds: disabledIds,
    },
  });

  return { disabledIds };
}

async function unpublishAnnouncementNowInternal(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    announcementId: Id<"announcements">;
    identity: AuditIdentity;
    reason: string;
    requireLive: boolean;
    clearScheduledJob: boolean;
    setScheduleEndToNow?: boolean;
  }
): Promise<void> {
  const announcement = await ctx.db.get(args.announcementId);
  if (!announcement) throw new Error("ANNOUNCEMENT_NOT_FOUND");

  if (args.requireLive && !announcement.isLive) {
    throw new Error("ANNOUNCEMENT_NOT_LIVE");
  }

  if (args.clearScheduledJob) {
    await tryCancelScheduledJob(ctx, announcement.unpublishJobId);
  }

  const now = Date.now();
  if (!announcement.isLive) {
    if (args.clearScheduledJob) {
      await ctx.db.patch(args.announcementId, {
        unpublishJobId: undefined,
      });
    }
    await logAnnouncementAudit(ctx, args.identity, {
      action: "announcement.unpublish_noop",
      announcementId: args.announcementId,
      reason: "announcement_not_live",
      meta: {
        requestedReason: args.reason,
      },
    });
    return;
  }

  await ctx.db.patch(args.announcementId, {
    isLive: false,
    updatedAt: now,
    ...(args.setScheduleEndToNow ? { scheduleEnd: now } : {}),
    ...(args.clearScheduledJob ? { unpublishJobId: undefined } : {}),
    ...(args.identity.updatedBy ? { updatedBy: args.identity.updatedBy } : {}),
  });

  await logAnnouncementAudit(ctx, args.identity, {
    action: "announcement.unpublished",
    announcementId: args.announcementId,
    reason: args.reason,
  });
}

async function cancelCompetingPublishJobsAtSameTime(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    currentAnnouncementId: Id<"announcements">;
    scheduleStart: number;
    identity: AuditIdentity;
  }
): Promise<void> {
  const rows = await ctx.db.query("announcements").collect();
  const conflicts = rows.filter(
    (row) =>
      row._id !== args.currentAnnouncementId &&
      row.scheduleStart === args.scheduleStart &&
      row.publishJobId !== undefined
  );

  for (const row of conflicts) {
    await tryCancelScheduledJob(ctx, row.publishJobId);
    await ctx.db.patch(row._id, {
      publishJobId: undefined,
    });

    await logAnnouncementAudit(ctx, args.identity, {
      action: "announcement.publish_canceled",
      announcementId: row._id,
      reason: "same_schedule_start_superseded",
      meta: {
        supersededByAnnouncementId: args.currentAnnouncementId,
        scheduleStart: args.scheduleStart,
      },
    });
  }
}

async function reconcileAnnouncementScheduleJobs(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    announcementId: Id<"announcements">;
    scheduleStart?: number;
    scheduleEnd?: number;
    previousPublishJobId?: ScheduledJobId;
    previousUnpublishJobId?: ScheduledJobId;
    now: number;
    identity: AuditIdentity;
  }
): Promise<void> {
  await tryCancelScheduledJob(ctx, args.previousPublishJobId);
  await tryCancelScheduledJob(ctx, args.previousUnpublishJobId);

  let nextPublishJobId: ScheduledJobId | undefined;
  let nextUnpublishJobId: ScheduledJobId | undefined;

  if (args.scheduleStart !== undefined && args.scheduleStart > args.now) {
    await cancelCompetingPublishJobsAtSameTime(ctx, {
      currentAnnouncementId: args.announcementId,
      scheduleStart: args.scheduleStart,
      identity: args.identity,
    });

    nextPublishJobId = await ctx.scheduler.runAfter(
      args.scheduleStart - args.now,
      internal.announcements.handleScheduledStart,
      {
        announcementId: args.announcementId,
        expectedScheduleStart: args.scheduleStart,
        expectedScheduleEnd: args.scheduleEnd,
      }
    );

    await logAnnouncementAudit(ctx, args.identity, {
      action: "announcement.publish_scheduled",
      announcementId: args.announcementId,
      meta: {
        scheduleStart: args.scheduleStart,
        jobId: nextPublishJobId,
      },
    });
  }

  if (args.scheduleEnd !== undefined && args.scheduleEnd > args.now) {
    nextUnpublishJobId = await ctx.scheduler.runAfter(
      args.scheduleEnd - args.now,
      internal.announcements.handleScheduledEnd,
      {
        announcementId: args.announcementId,
        expectedScheduleEnd: args.scheduleEnd,
      }
    );

    await logAnnouncementAudit(ctx, args.identity, {
      action: "announcement.unpublish_scheduled",
      announcementId: args.announcementId,
      meta: {
        scheduleEnd: args.scheduleEnd,
        jobId: nextUnpublishJobId,
      },
    });
  }

  await ctx.db.patch(args.announcementId, {
    publishJobId: nextPublishJobId,
    unpublishJobId: nextUnpublishJobId,
  });
}

function normalizeCreateInput(args: {
  name: string;
  bannerText: string;
  callToActionName?: string;
  callToActionUrl?: string;
  learnMoreName?: string;
  learnMoreContent?: string;
  scheduleStart?: number;
  scheduleEnd?: number;
}): AnnouncementEditableFields {
  return {
    name: args.name.trim(),
    bannerText: args.bannerText.trim(),
    callToActionName: normalizeOptionalString(args.callToActionName),
    callToActionUrl: normalizeOptionalString(args.callToActionUrl),
    learnMoreName: normalizeOptionalString(args.learnMoreName),
    learnMoreContent: normalizeOptionalString(args.learnMoreContent),
    scheduleStart: args.scheduleStart,
    scheduleEnd: args.scheduleEnd,
  };
}

// ---------------------------------------------------------------------------
// Public: active announcement
// ---------------------------------------------------------------------------

export const getActivePublic = query({
  args: {},
  handler: async (ctx) => {
    const active = await getActiveAnnouncement(ctx.db);
    return active ? toRuntimeAnnouncement(active) : null;
  },
});

export const getActiveInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const active = await getActiveAnnouncement(ctx.db);
    return active ? toRuntimeAnnouncement(active) : null;
  },
});

export const handleScheduledStart = internalMutation({
  args: {
    announcementId: v.id("announcements"),
    expectedScheduleStart: v.number(),
    expectedScheduleEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const announcement = await ctx.db.get(args.announcementId);
    if (!announcement) return;

    const now = Date.now();
    const cronIdentity: AuditIdentity = {
      actor: "system",
      sourceDetail: "announcement-cron",
    };

    if (isArchived(announcement)) {
      await ctx.db.patch(args.announcementId, {
        publishJobId: undefined,
      });
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.publish_noop",
        announcementId: args.announcementId,
        reason: "announcement_archived",
      });
      return;
    }

    if (announcement.scheduleStart !== args.expectedScheduleStart) {
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.publish_noop",
        announcementId: args.announcementId,
        reason: "schedule_start_mismatch",
      });
      return;
    }

    if (announcement.scheduleEnd !== args.expectedScheduleEnd) {
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.publish_noop",
        announcementId: args.announcementId,
        reason: "schedule_end_mismatch",
      });
      return;
    }

    if (announcement.scheduleStart > now) {
      await ctx.scheduler.runAfter(
        announcement.scheduleStart - now,
        internal.announcements.handleScheduledStart,
        args
      );
      return;
    }

    if (!announcement.publishJobId) {
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.publish_noop",
        announcementId: args.announcementId,
        reason: "publish_job_missing",
      });
      return;
    }

    if (announcement.scheduleEnd !== undefined && announcement.scheduleEnd <= now) {
      await ctx.db.patch(args.announcementId, {
        publishJobId: undefined,
      });
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.publish_noop",
        announcementId: args.announcementId,
        reason: "announcement_expired_before_publish",
      });
      return;
    }

    const contenders = (await ctx.db.query("announcements").collect())
      .filter(
        (row) =>
          row.scheduleStart === announcement.scheduleStart &&
          row.publishJobId !== undefined &&
          (row.scheduleEnd === undefined || row.scheduleEnd > now)
      )
      .sort(compareAnnouncementRecency);

    const winner = contenders[0];
    if (!winner || winner._id !== args.announcementId) {
      await ctx.db.patch(args.announcementId, {
        publishJobId: undefined,
      });
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.publish_noop",
        announcementId: args.announcementId,
        reason: "lost_same_time_tie_break",
        meta: {
          winnerAnnouncementId: winner?._id,
        },
      });
      return;
    }

    const disabledIds = await disableLiveAnnouncementsExcept(
      ctx,
      winner._id,
      now,
      cronIdentity,
      "scheduled_publish_replaced_live"
    );

    await ctx.db.patch(winner._id, {
      isLive: true,
      publishJobId: undefined,
      updatedAt: now,
    });

    await logAnnouncementAudit(ctx, cronIdentity, {
      action: "announcement.published",
      announcementId: winner._id,
      reason: "scheduled_publish_triggered",
      meta: {
        disabledOtherLiveAnnouncementIds: disabledIds,
      },
    });
  },
});

export const handleScheduledEnd = internalMutation({
  args: {
    announcementId: v.id("announcements"),
    expectedScheduleEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const announcement = await ctx.db.get(args.announcementId);
    if (!announcement) return;

    const now = Date.now();
    const cronIdentity: AuditIdentity = {
      actor: "system",
      sourceDetail: "announcement-cron",
    };

    if (announcement.scheduleEnd !== args.expectedScheduleEnd) {
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.unpublish_noop",
        announcementId: args.announcementId,
        reason: "schedule_end_mismatch",
      });
      return;
    }

    if (announcement.scheduleEnd > now) {
      await ctx.scheduler.runAfter(
        announcement.scheduleEnd - now,
        internal.announcements.handleScheduledEnd,
        args
      );
      return;
    }

    if (!announcement.unpublishJobId) {
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.unpublish_noop",
        announcementId: args.announcementId,
        reason: "unpublish_job_missing",
      });
      return;
    }

    if (!announcement.isLive) {
      await ctx.db.patch(args.announcementId, {
        unpublishJobId: undefined,
      });
      await logAnnouncementAudit(ctx, cronIdentity, {
        action: "announcement.unpublish_noop",
        announcementId: args.announcementId,
        reason: "target_not_currently_live",
      });
      return;
    }

    await unpublishAnnouncementNowInternal(ctx, {
      announcementId: args.announcementId,
      identity: cronIdentity,
      reason: "scheduled_unpublish_triggered",
      requireLive: false,
      clearScheduledJob: true,
    });
  },
});

// ---------------------------------------------------------------------------
// Admin: list
// ---------------------------------------------------------------------------

export const list = authedQuery({
  args: {
    includeArchived: v.optional(v.boolean()),
    sortBy: v.optional(
      v.union(
        v.literal("scheduleStart"),
        v.literal("scheduleEnd"),
        v.literal("status"),
        v.literal("name")
      )
    ),
    sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") return null;

    const rows = await ctx.db.query("announcements").collect();
    const filteredRows = (args.includeArchived ?? false)
      ? rows
      : rows.filter((row) => !isArchived(row));
    const now = Date.now();
    const sortDirection = args.sortDirection ?? "asc";
    const sortedRows = args.sortBy
      ? sortForAdminByField(filteredRows, now, args.sortBy, sortDirection)
      : sortForAdmin(filteredRows);

    return sortedRows.map((row) => ({
      ...row,
      isActiveNow: isActiveNow(row, now),
      isPublishNowEligible: isPublishNowEligible(row, now),
      status: getAdminAnnouncementStatus(row, now),
    }));
  },
});

export const getAdminListInternal = internalQuery({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("announcements").collect();
    const filteredRows = (args.includeArchived ?? false)
      ? rows
      : rows.filter((row) => !isArchived(row));
    const now = Date.now();

    return sortForAdmin(filteredRows).map((row) => ({
      ...row,
      isActiveNow: isActiveNow(row, now),
      isPublishNowEligible: isPublishNowEligible(row, now),
      status: getAdminAnnouncementStatus(row, now),
    }));
  },
});

// ---------------------------------------------------------------------------
// Admin: create
// ---------------------------------------------------------------------------

export const create = authedMutation({
  args: {
    name: v.string(),
    bannerText: v.string(),
    callToActionName: v.optional(v.string()),
    callToActionUrl: v.optional(v.string()),
    learnMoreName: v.optional(v.string()),
    learnMoreContent: v.optional(v.string()),
    scheduleStart: v.optional(v.number()),
    scheduleEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const now = Date.now();
    const input = normalizeCreateInput(args);
    validateAnnouncementInput(input);

    const id = await ctx.db.insert("announcements", {
      ...input,
      isLive: false,
      isArchived: false,
      publishJobId: undefined,
      unpublishJobId: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.ownerId,
      updatedBy: ctx.ownerId,
    });

    const adminIdentity: AuditIdentity = {
      actor: (ctx.user as Record<string, unknown>).email as string,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      updatedBy: ctx.ownerId,
    };

    await reconcileAnnouncementScheduleJobs(ctx, {
      announcementId: id,
      scheduleStart: input.scheduleStart,
      scheduleEnd: input.scheduleEnd,
      now,
      identity: adminIdentity,
    });

    await logAnnouncementAudit(ctx, adminIdentity, {
      action: "announcement.created",
      announcementId: id,
      meta: {
        scheduleStart: input.scheduleStart,
        scheduleEnd: input.scheduleEnd,
      },
    });

    return { id };
  },
});

// ---------------------------------------------------------------------------
// Admin: update
// ---------------------------------------------------------------------------

export const update = authedMutation({
  args: {
    announcementId: v.id("announcements"),
    patch: v.object({
      name: v.optional(v.string()),
      bannerText: v.optional(v.string()),
      callToActionName: v.optional(v.string()),
      callToActionUrl: v.optional(v.string()),
      learnMoreName: v.optional(v.string()),
      learnMoreContent: v.optional(v.string()),
      scheduleStart: v.optional(v.union(v.number(), v.null())),
      scheduleEnd: v.optional(v.union(v.number(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const existing = await ctx.db.get(args.announcementId);
    if (!existing) throw new Error("ANNOUNCEMENT_NOT_FOUND");

    const patch: Partial<AnnouncementEditableFields> = {};
    const hasName = Object.prototype.hasOwnProperty.call(args.patch, "name");
    const hasBannerText = Object.prototype.hasOwnProperty.call(
      args.patch,
      "bannerText"
    );
    const hasCallToActionName = Object.prototype.hasOwnProperty.call(
      args.patch,
      "callToActionName"
    );
    const hasCallToActionUrl = Object.prototype.hasOwnProperty.call(
      args.patch,
      "callToActionUrl"
    );
    const hasLearnMoreName = Object.prototype.hasOwnProperty.call(
      args.patch,
      "learnMoreName"
    );
    const hasLearnMoreContent = Object.prototype.hasOwnProperty.call(
      args.patch,
      "learnMoreContent"
    );
    const hasScheduleStart = Object.prototype.hasOwnProperty.call(
      args.patch,
      "scheduleStart"
    );
    const hasScheduleEnd = Object.prototype.hasOwnProperty.call(
      args.patch,
      "scheduleEnd"
    );

    if (hasName) {
      patch.name = (args.patch.name ?? "").trim();
    }
    if (hasBannerText) {
      patch.bannerText = (args.patch.bannerText ?? "").trim();
    }
    if (hasCallToActionName) {
      patch.callToActionName = normalizeOptionalString(args.patch.callToActionName);
    }
    if (hasCallToActionUrl) {
      patch.callToActionUrl = normalizeOptionalString(args.patch.callToActionUrl);
    }
    if (hasLearnMoreName) {
      patch.learnMoreName = normalizeOptionalString(args.patch.learnMoreName);
    }
    if (hasLearnMoreContent) {
      patch.learnMoreContent = normalizeOptionalString(args.patch.learnMoreContent);
    }
    if (hasScheduleStart) {
      patch.scheduleStart = args.patch.scheduleStart ?? undefined;
    }
    if (hasScheduleEnd) {
      patch.scheduleEnd = args.patch.scheduleEnd ?? undefined;
    }

    const next: AnnouncementEditableFields = {
      name: hasName ? (patch.name ?? "") : existing.name,
      bannerText: hasBannerText ? (patch.bannerText ?? "") : existing.bannerText,
      callToActionName: hasCallToActionName
        ? patch.callToActionName
        : existing.callToActionName,
      callToActionUrl: hasCallToActionUrl
        ? patch.callToActionUrl
        : existing.callToActionUrl,
      learnMoreName: hasLearnMoreName
        ? patch.learnMoreName
        : existing.learnMoreName,
      learnMoreContent: hasLearnMoreContent
        ? patch.learnMoreContent
        : existing.learnMoreContent,
      scheduleStart: hasScheduleStart ? patch.scheduleStart : existing.scheduleStart,
      scheduleEnd: hasScheduleEnd ? patch.scheduleEnd : existing.scheduleEnd,
    };

    validateAnnouncementInput(next);

    const now = Date.now();
    const adminIdentity: AuditIdentity = {
      actor: (ctx.user as Record<string, unknown>).email as string,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      updatedBy: ctx.ownerId,
    };

    const shouldCancelLiveImmediately =
      hasScheduleStart &&
      next.scheduleStart !== undefined &&
      next.scheduleStart > now &&
      existing.isLive;

    await ctx.db.patch(args.announcementId, {
      ...patch,
      ...(shouldCancelLiveImmediately ? { isLive: false } : {}),
      updatedAt: now,
      updatedBy: ctx.ownerId,
    });

    if (shouldCancelLiveImmediately) {
      await logAnnouncementAudit(ctx, adminIdentity, {
        action: "announcement.publish_canceled",
        announcementId: args.announcementId,
        reason: "future_start_set_while_live",
      });
    }

    await reconcileAnnouncementScheduleJobs(ctx, {
      announcementId: args.announcementId,
      scheduleStart: next.scheduleStart,
      scheduleEnd: next.scheduleEnd,
      previousPublishJobId: existing.publishJobId,
      previousUnpublishJobId: existing.unpublishJobId,
      now,
      identity: adminIdentity,
    });

    await logAnnouncementAudit(ctx, adminIdentity, {
      action: "announcement.updated",
      announcementId: args.announcementId,
      meta: {
        scheduleStart: next.scheduleStart,
        scheduleEnd: next.scheduleEnd,
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Admin: publish now / unpublish now
// ---------------------------------------------------------------------------

export const publishNow = authedMutation({
  args: {
    announcementId: v.id("announcements"),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const adminIdentity: AuditIdentity = {
      actor: (ctx.user as Record<string, unknown>).email as string,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      updatedBy: ctx.ownerId,
    };

    return publishAnnouncementNowInternal(ctx, {
      announcementId: args.announcementId,
      identity: adminIdentity,
      reason: "manual_publish_now",
      requireEligibility: true,
      setScheduleStartToNow: true,
    });
  },
});

export const publishNowInternal = internalMutation({
  args: {
    announcementId: v.id("announcements"),
  },
  handler: async (ctx, args) => {
    return publishAnnouncementNowInternal(ctx, {
      announcementId: args.announcementId,
      identity: {
        actor: "system",
        sourceDetail: "announcement-cron",
      },
      reason: "internal_publish_now",
      requireEligibility: true,
      setScheduleStartToNow: true,
    });
  },
});

export const unpublishNow = authedMutation({
  args: {
    announcementId: v.id("announcements"),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const adminIdentity: AuditIdentity = {
      actor: (ctx.user as Record<string, unknown>).email as string,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      updatedBy: ctx.ownerId,
    };

    await unpublishAnnouncementNowInternal(ctx, {
      announcementId: args.announcementId,
      identity: adminIdentity,
      reason: "manual_unpublish_now",
      requireLive: true,
      clearScheduledJob: true,
      setScheduleEndToNow: true,
    });
  },
});

export const unpublishNowInternal = internalMutation({
  args: {
    announcementId: v.id("announcements"),
  },
  handler: async (ctx, args) => {
    await unpublishAnnouncementNowInternal(ctx, {
      announcementId: args.announcementId,
      identity: {
        actor: "system",
        sourceDetail: "announcement-cron",
      },
      reason: "internal_unpublish_now",
      requireLive: true,
      clearScheduledJob: true,
      setScheduleEndToNow: true,
    });
  },
});

// ---------------------------------------------------------------------------
// Admin: set live state (compatibility wrapper)
// ---------------------------------------------------------------------------

export const setLive = authedMutation({
  args: {
    announcementId: v.id("announcements"),
    isLive: v.boolean(),
    confirmDisableOthers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const adminIdentity: AuditIdentity = {
      actor: (ctx.user as Record<string, unknown>).email as string,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      updatedBy: ctx.ownerId,
    };

    if (args.isLive) {
      return publishAnnouncementNowInternal(ctx, {
        announcementId: args.announcementId,
        identity: adminIdentity,
        reason: "legacy_set_live_true",
        requireEligibility: true,
        setScheduleStartToNow: true,
      });
    }

    await unpublishAnnouncementNowInternal(ctx, {
      announcementId: args.announcementId,
      identity: adminIdentity,
      reason: "legacy_set_live_false",
      requireLive: true,
      clearScheduledJob: true,
      setScheduleEndToNow: true,
    });

    return { disabledIds: [] as Id<"announcements">[] };
  },
});

// ---------------------------------------------------------------------------
// Admin: archive
// ---------------------------------------------------------------------------

export const archive = authedMutation({
  args: {
    announcementId: v.id("announcements"),
  },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const existing = await ctx.db.get(args.announcementId);
    if (!existing) throw new Error("ANNOUNCEMENT_NOT_FOUND");
    if (isArchived(existing)) return;

    await tryCancelScheduledJob(ctx, existing.publishJobId);
    await tryCancelScheduledJob(ctx, existing.unpublishJobId);

    const now = Date.now();
    await ctx.db.patch(args.announcementId, {
      isArchived: true,
      isLive: false,
      publishJobId: undefined,
      unpublishJobId: undefined,
      updatedAt: now,
      updatedBy: ctx.ownerId,
    });

    await logAnnouncementAudit(
      ctx,
      {
        actor: (ctx.user as Record<string, unknown>).email as string,
        authenticatedUserId: ctx.ownerId,
        sourceDetail: "admin-mutation",
        updatedBy: ctx.ownerId,
      },
      {
        action: "announcement.updated",
        announcementId: args.announcementId,
        reason: "archived",
        meta: {
          isArchived: true,
          wasLive: existing.isLive,
        },
      }
    );
  },
});

// ---------------------------------------------------------------------------
// Admin: delete
// ---------------------------------------------------------------------------

export const remove = authedMutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, args) => {
    const role = (ctx.user as Record<string, unknown>).role;
    if (role !== "admin") throw new Error("NOT_ADMIN");

    const existing = await ctx.db.get(args.announcementId);
    if (!existing) throw new Error("ANNOUNCEMENT_NOT_FOUND");

    await tryCancelScheduledJob(ctx, existing.publishJobId);
    await tryCancelScheduledJob(ctx, existing.unpublishJobId);

    await ctx.db.delete(args.announcementId);

    await scheduleAuditEvent(ctx, {
      actor: (ctx.user as Record<string, unknown>).email as string,
      authenticatedUserId: ctx.ownerId,
      sourceDetail: "admin-mutation",
      action: "announcement.deleted",
      resource: `announcement:${args.announcementId}`,
      status: "succeeded",
    });
  },
});
