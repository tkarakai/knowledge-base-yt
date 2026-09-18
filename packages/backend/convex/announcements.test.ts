import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function createTestEnv() {
  return convexTest(schema, modules);
}

async function createScheduledJobId(t: ReturnType<typeof createTestEnv>) {
  return t.run(async (ctx) => {
    return ctx.scheduler.runAfter(
      86_400_000,
      internal.auditTrail.insertEvent,
      {
        actor: "system",
        sourceDetail: "test-suite",
        action: "announcement.created",
        resource: "announcement:test",
        status: "succeeded",
      }
    );
  });
}

describe("announcements", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns only the currently active live announcement", async () => {
    const t = createTestEnv();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("announcements", {
        name: "future",
        bannerText: "Future start",
        isLive: true,
        scheduleStart: now + 60_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "expired",
        bannerText: "Expired",
        isLive: true,
        scheduleEnd: now - 60_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "active",
        bannerText: "Active now",
        isLive: true,
        scheduleStart: now - 60_000,
        scheduleEnd: now + 60_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    const result = await t.query(internal.announcements.getActiveInternal, {});
    expect(result?.name).toBe("active");
    expect(result?.bannerText).toBe("Active now");
  });

  test("ignores archived announcements when resolving currently active announcement", async () => {
    const t = createTestEnv();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("announcements", {
        name: "archived-live",
        bannerText: "Archived live",
        isLive: true,
        isArchived: true,
        scheduleStart: now - 60_000,
        scheduleEnd: now + 60_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "active",
        bannerText: "Active now",
        isLive: true,
        scheduleStart: now - 60_000,
        scheduleEnd: now + 60_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    const result = await t.query(internal.announcements.getActiveInternal, {});
    expect(result?.name).toBe("active");
  });

  test("replaces learn more template variables", async () => {
    const t = createTestEnv();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("announcements", {
        name: "variables",
        bannerText: "Variable test",
        learnMoreName: "Learn more",
        learnMoreContent:
          "<a href='{{landingPageUrl}}'>landing</a> <a href='{{webAppUrl}}'>web</a>",
        isLive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    const result = await t.query(internal.announcements.getActiveInternal, {});
    expect(result?.learnMoreContent).toContain("http://localhost:3000");
    expect(result?.learnMoreContent).toContain("http://localhost:3001");
  });

  test("scheduled publish keeps only the most recently updated announcement", async () => {
    const t = createTestEnv();
    const now = Date.now();
    const scheduleStart = now - 1000;

    const olderPublishJobId = await createScheduledJobId(t);
    const newerPublishJobId = await createScheduledJobId(t);

    const olderId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "older",
        bannerText: "Older",
        isLive: false,
        scheduleStart,
        publishJobId: olderPublishJobId,
        createdAt: now - 10_000,
        updatedAt: now - 10_000,
      });
    });

    const newerId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "newer",
        bannerText: "Newer",
        isLive: false,
        scheduleStart,
        publishJobId: newerPublishJobId,
        createdAt: now - 5000,
        updatedAt: now - 5000,
      });
    });

    const currentlyLiveId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "currently-live",
        bannerText: "Currently live",
        isLive: true,
        createdAt: now - 15_000,
        updatedAt: now - 15_000,
      });
    });

    await t.mutation(internal.announcements.handleScheduledStart, {
      announcementId: olderId,
      expectedScheduleStart: scheduleStart,
      expectedScheduleEnd: undefined,
    });

    let older = await t.run(async (ctx) => ctx.db.get(olderId));
    let newer = await t.run(async (ctx) => ctx.db.get(newerId));
    let currentlyLive = await t.run(async (ctx) => ctx.db.get(currentlyLiveId));

    expect(older?.isLive).toBe(false);
    expect(older?.publishJobId).toBeUndefined();
    expect(newer?.isLive).toBe(false);
    expect(newer?.publishJobId).toBeDefined();
    expect(currentlyLive?.isLive).toBe(true);

    await t.mutation(internal.announcements.handleScheduledStart, {
      announcementId: newerId,
      expectedScheduleStart: scheduleStart,
      expectedScheduleEnd: undefined,
    });

    older = await t.run(async (ctx) => ctx.db.get(olderId));
    newer = await t.run(async (ctx) => ctx.db.get(newerId));
    currentlyLive = await t.run(async (ctx) => ctx.db.get(currentlyLiveId));

    expect(older?.isLive).toBe(false);
    expect(newer?.isLive).toBe(true);
    expect(newer?.publishJobId).toBeUndefined();
    expect(currentlyLive?.isLive).toBe(false);
  });

  test("scheduled unpublish disables only matching live announcement", async () => {
    const t = createTestEnv();
    const now = Date.now();
    const scheduleEnd = now - 1000;

    const liveUnpublishJobId = await createScheduledJobId(t);
    const nonLiveUnpublishJobId = await createScheduledJobId(t);

    const liveId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "live-with-end",
        bannerText: "Ends now",
        isLive: true,
        scheduleEnd,
        unpublishJobId: liveUnpublishJobId,
        createdAt: now - 5000,
        updatedAt: now - 5000,
      });
    });

    const nonLiveId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "not-live",
        bannerText: "No-op",
        isLive: false,
        scheduleEnd,
        unpublishJobId: nonLiveUnpublishJobId,
        createdAt: now - 4000,
        updatedAt: now - 4000,
      });
    });

    await t.mutation(internal.announcements.handleScheduledEnd, {
      announcementId: liveId,
      expectedScheduleEnd: scheduleEnd,
    });

    await t.mutation(internal.announcements.handleScheduledEnd, {
      announcementId: nonLiveId,
      expectedScheduleEnd: scheduleEnd,
    });

    const liveAfter = await t.run(async (ctx) => ctx.db.get(liveId));
    const nonLiveAfter = await t.run(async (ctx) => ctx.db.get(nonLiveId));

    expect(liveAfter?.isLive).toBe(false);
    expect(liveAfter?.unpublishJobId).toBeUndefined();

    expect(nonLiveAfter?.isLive).toBe(false);
    expect(nonLiveAfter?.unpublishJobId).toBeUndefined();
  });

  test("scheduled handlers no-op when schedule values changed after job was queued", async () => {
    const t = createTestEnv();
    const now = Date.now();

    const publishJobId = await createScheduledJobId(t);
    const unpublishJobId = await createScheduledJobId(t);

    const id = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "stale-jobs",
        bannerText: "No-op stale",
        isLive: true,
        scheduleStart: now + 10_000,
        scheduleEnd: now + 20_000,
        publishJobId,
        unpublishJobId,
        createdAt: now - 5000,
        updatedAt: now - 5000,
      });
    });

    await t.mutation(internal.announcements.handleScheduledStart, {
      announcementId: id,
      expectedScheduleStart: now - 1000,
      expectedScheduleEnd: now + 20_000,
    });

    await t.mutation(internal.announcements.handleScheduledEnd, {
      announcementId: id,
      expectedScheduleEnd: now - 1000,
    });

    const after = await t.run(async (ctx) => ctx.db.get(id));

    expect(after).not.toBeNull();
    expect(after?.isLive).toBe(true);
    expect(after?.scheduleStart).toBe(now + 10_000);
    expect(after?.scheduleEnd).toBe(now + 20_000);
    expect(after?.publishJobId).toBeDefined();
    expect(after?.unpublishJobId).toBeDefined();
  });

  test("publish now is allowed when start has passed and end is in the future", async () => {
    const t = createTestEnv();
    const now = Date.now();
    const publishJobId = await createScheduledJobId(t);

    const currentLiveId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "current",
        bannerText: "Current live",
        isLive: true,
        createdAt: now - 5000,
        updatedAt: now - 5000,
      });
    });

    const targetId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "target",
        bannerText: "Target",
        isLive: false,
        scheduleStart: now - 60_000,
        scheduleEnd: now + 60_000,
        publishJobId,
        createdAt: now - 4000,
        updatedAt: now - 4000,
      });
    });

    await t.mutation(internal.announcements.publishNowInternal, {
      announcementId: targetId,
    });

    const currentAfter = await t.run(async (ctx) => ctx.db.get(currentLiveId));
    const targetAfter = await t.run(async (ctx) => ctx.db.get(targetId));

    expect(currentAfter?.isLive).toBe(false);
    expect(targetAfter?.isLive).toBe(true);
    expect(targetAfter?.scheduleStart).toBe(now);
    expect(targetAfter?.publishJobId).toBeUndefined();
  });

  test("publish now rejects announcements that are not eligible by schedule", async () => {
    const t = createTestEnv();
    const now = Date.now();

    const futureStartId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "future-start",
        bannerText: "Future",
        isLive: false,
        scheduleStart: now + 60_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    const endedId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "ended",
        bannerText: "Ended",
        isLive: false,
        scheduleStart: now - 120_000,
        scheduleEnd: now - 1000,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      t.mutation(internal.announcements.publishNowInternal, {
        announcementId: futureStartId,
      })
    ).rejects.toThrow("PUBLISH_NOW_NOT_ALLOWED");

    await expect(
      t.mutation(internal.announcements.publishNowInternal, {
        announcementId: endedId,
      })
    ).rejects.toThrow("PUBLISH_NOW_NOT_ALLOWED");
  });

  test("unpublish now requires a live announcement and clears isLive", async () => {
    const t = createTestEnv();
    const now = Date.now();
    const unpublishJobId = await createScheduledJobId(t);

    const liveId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "live",
        bannerText: "Live",
        isLive: true,
        scheduleEnd: now + 120_000,
        unpublishJobId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const draftId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "draft",
        bannerText: "Draft",
        isLive: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    await t.mutation(internal.announcements.unpublishNowInternal, {
      announcementId: liveId,
    });

    const liveAfter = await t.run(async (ctx) => ctx.db.get(liveId));
    expect(liveAfter?.isLive).toBe(false);
    expect(liveAfter?.scheduleEnd).toBe(now);
    expect(liveAfter?.unpublishJobId).toBeUndefined();

    await expect(
      t.mutation(internal.announcements.unpublishNowInternal, {
        announcementId: draftId,
      })
    ).rejects.toThrow("ANNOUNCEMENT_NOT_LIVE");
  });

  test("writes detailed audit actions for publish and unpublish flow", async () => {
    const t = createTestEnv();
    const now = Date.now();

    const currentlyLiveId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "live-original",
        bannerText: "Original",
        isLive: true,
        createdAt: now - 5000,
        updatedAt: now - 5000,
      });
    });

    const targetId = await t.run(async (ctx) => {
      return ctx.db.insert("announcements", {
        name: "target",
        bannerText: "Target",
        isLive: false,
        createdAt: now - 1000,
        updatedAt: now - 1000,
      });
    });

    await t.mutation(internal.announcements.publishNowInternal, {
      announcementId: targetId,
    });
    await t.mutation(internal.announcements.unpublishNowInternal, {
      announcementId: targetId,
    });

    await t.finishAllScheduledFunctions(() => {
      vi.runAllTimers();
    });

    const actions = await t.run(async (ctx) => {
      const rows = await ctx.db.query("auditTrail").collect();
      return rows
        .sort((a, b) => a.happenedAt - b.happenedAt)
        .map((row) => row.action);
    });

    expect(actions).toContain("announcement.publish_canceled");
    expect(actions).toContain("announcement.published");
    expect(actions).toContain("announcement.unpublished");

    const currentlyLiveAfter = await t.run(async (ctx) => ctx.db.get(currentlyLiveId));
    const targetAfter = await t.run(async (ctx) => ctx.db.get(targetId));
    expect(currentlyLiveAfter?.isLive).toBe(false);
    expect(targetAfter?.isLive).toBe(false);
  });

  test("admin list ordering keeps no-start items first, then start desc", async () => {
    const t = createTestEnv();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("announcements", {
        name: "no-start",
        bannerText: "No start",
        isLive: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "start-sooner",
        bannerText: "Sooner",
        isLive: false,
        scheduleStart: now + 10_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "start-later",
        bannerText: "Later",
        isLive: false,
        scheduleStart: now + 20_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    const rows = await t.query(internal.announcements.getAdminListInternal, {});
    expect(rows.map((row) => row.name)).toEqual([
      "no-start",
      "start-later",
      "start-sooner",
    ]);
  });

  test("admin list computes status including cancelled scheduled announcements", async () => {
    const t = createTestEnv();
    const now = Date.now();
    const publishJobId = await createScheduledJobId(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("announcements", {
        name: "live-now",
        bannerText: "Live now",
        isLive: true,
        scheduleStart: now - 10_000,
        scheduleEnd: now + 10_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "scheduled",
        bannerText: "Scheduled",
        isLive: false,
        scheduleStart: now + 10_000,
        publishJobId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "scheduled-cancelled",
        bannerText: "Scheduled cancelled",
        isLive: false,
        scheduleStart: now + 20_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "ready",
        bannerText: "Ready",
        isLive: false,
        scheduleStart: now - 10_000,
        scheduleEnd: now + 10_000,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "draft",
        bannerText: "Draft",
        isLive: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "ended",
        bannerText: "Ended",
        isLive: false,
        scheduleStart: now - 20_000,
        scheduleEnd: now - 1_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    const rows = await t.query(internal.announcements.getAdminListInternal, {});
    const statuses = new Map(rows.map((row) => [row.name, row.status]));

    expect(statuses.get("live-now")).toBe("live_now");
    expect(statuses.get("scheduled")).toBe("scheduled");
    expect(statuses.get("scheduled-cancelled")).toBe("scheduled_cancelled");
    expect(statuses.get("ready")).toBe("ready");
    expect(statuses.get("draft")).toBe("draft");
    expect(statuses.get("ended")).toBe("ended");
  });

  test("admin list excludes archived announcements by default", async () => {
    const t = createTestEnv();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("announcements", {
        name: "active",
        bannerText: "Visible",
        isLive: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("announcements", {
        name: "archived",
        bannerText: "Hidden",
        isLive: false,
        isArchived: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    const defaultRows = await t.query(internal.announcements.getAdminListInternal, {});
    expect(defaultRows.map((row) => row.name)).toEqual(["active"]);

    const withArchivedRows = await t.query(internal.announcements.getAdminListInternal, {
      includeArchived: true,
    });
    expect(withArchivedRows.map((row) => row.name).sort()).toEqual([
      "active",
      "archived",
    ]);
  });
});
