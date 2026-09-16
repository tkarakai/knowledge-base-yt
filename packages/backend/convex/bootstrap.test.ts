import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const BOOTSTRAP_META = JSON.stringify({
  superpowers: ["coffee-to-code"],
  excitement: ["take-my-money"],
});

function createTestEnv() {
  return convexTest(schema, modules);
}

describe("bootstrap", () => {
  // Use fake timers to prevent convex-test from auto-executing scheduled
  // functions. The bootstrap mutations schedule an internalAction via
  // ctx.scheduler.runAfter which can't run in the test environment.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  // -----------------------------------------------------------------------
  // initialize
  // -----------------------------------------------------------------------

  describe("initialize", () => {
    test("seeds admin email and creates invited waitlist entry on empty system", async () => {
      const t = createTestEnv();

      const result = await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.email).toBe("admin@example.com");

      // Verify admin email was created
      const adminEmails = await t.run(async (ctx) => {
        return ctx.db.query("adminEmails").collect();
      });
      expect(adminEmails).toHaveLength(1);
      expect(adminEmails[0].email).toBe("admin@example.com");

      // Verify waitlist entry was created and invited
      const entry = await t.run(async (ctx) => {
        return ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
      });
      expect(entry).toBeDefined();
      expect(entry?.email).toBe("admin@example.com");
      expect(entry?.status).toBe("invited");
      expect(entry?.invitedAt).toBeDefined();
    });

    test("throws BOOTSTRAP_ALREADY_INITIALIZED if adminEmails already has an entry", async () => {
      const t = createTestEnv();

      // Pre-seed an admin email
      await t.run(async (ctx) => {
        await ctx.db.insert("adminEmails", { email: "existing@example.com" });
      });

      await expect(
        t.mutation(internal.bootstrap.initialize, {
          email: "new@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_ALREADY_INITIALIZED");
    });

    test("throws BOOTSTRAP_INVALID_EMAIL for invalid email", async () => {
      const t = createTestEnv();

      await expect(
        t.mutation(internal.bootstrap.initialize, { email: "nope" }),
      ).rejects.toThrow("BOOTSTRAP_INVALID_EMAIL");
    });

    test("throws BOOTSTRAP_DUPLICATE_WAITLIST_ENTRY if email already on waitlist", async () => {
      const t = createTestEnv();

      // Pre-seed a waitlist entry (but no admin email, so the admin guard passes)
      await t.run(async (ctx) => {
        await ctx.db.insert("waitlistEntries", {
          email: "admin@example.com",
          meta: BOOTSTRAP_META,
          status: "waiting",
          createdAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.bootstrap.initialize, {
          email: "admin@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_DUPLICATE_WAITLIST_ENTRY");
    });

    test("cannot be called twice", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      await expect(
        t.mutation(internal.bootstrap.initialize, {
          email: "second@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_ALREADY_INITIALIZED");
    });
  });

  // -----------------------------------------------------------------------
  // rescue
  // -----------------------------------------------------------------------

  describe("rescue", () => {
    test("updates admin email and revokes old tokens when email changes", async () => {
      const t = createTestEnv();

      // Seed via initialize
      await t.mutation(internal.bootstrap.initialize, {
        email: "typo@exmaple.com",
      });

      // Seed a token for the old email
      const tokenId = await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "typo@exmaple.com"))
          .first();
        return ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "old-token-abc",
          email: "typo@exmaple.com",
          status: "sent",
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.bootstrap.rescue, {
        currentEmail: "typo@exmaple.com",
        newEmail: "correct@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.email).toBe("correct@example.com");

      // Verify admin email updated
      const adminEmails = await t.run(async (ctx) => {
        return ctx.db.query("adminEmails").collect();
      });
      expect(adminEmails).toHaveLength(1);
      expect(adminEmails[0].email).toBe("correct@example.com");

      // Verify old token revoked
      const oldToken = await t.run(async (ctx) => {
        return ctx.db.get(tokenId);
      });
      expect(oldToken?.status).toBe("revoked");

      // Verify waitlist entry updated
      const entry = await t.run(async (ctx) => {
        return ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) =>
            q.eq("email", "correct@example.com"),
          )
          .first();
      });
      expect(entry).toBeDefined();
      expect(entry?.status).toBe("invited");
    });

    test("resends invitation when email is the same (no change)", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Seed an expired token
      const tokenId = await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        return ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "expired-token",
          email: "admin@example.com",
          status: "sent",
          expiresAt: Date.now() - 1000,
          createdAt: Date.now() - 100000,
        });
      });

      const result = await t.mutation(internal.bootstrap.rescue, {
        currentEmail: "admin@example.com",
        newEmail: "admin@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);

      // Old token should be revoked
      const oldToken = await t.run(async (ctx) => {
        return ctx.db.get(tokenId);
      });
      expect(oldToken?.status).toBe("revoked");

      // Entry should be re-invited
      const entry = await t.run(async (ctx) => {
        return ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
      });
      expect(entry?.status).toBe("invited");
    });

    test("throws BOOTSTRAP_NOT_INITIALIZED if no admin emails exist", async () => {
      const t = createTestEnv();

      await expect(
        t.mutation(internal.bootstrap.rescue, {
          currentEmail: "admin@example.com",
          newEmail: "admin@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_NOT_INITIALIZED");
    });

    test("throws BOOTSTRAP_MULTIPLE_ADMINS if multiple admin emails exist", async () => {
      const t = createTestEnv();

      await t.run(async (ctx) => {
        await ctx.db.insert("adminEmails", { email: "admin1@example.com" });
        await ctx.db.insert("adminEmails", { email: "admin2@example.com" });
      });

      await expect(
        t.mutation(internal.bootstrap.rescue, {
          currentEmail: "admin1@example.com",
          newEmail: "admin1@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_MULTIPLE_ADMINS");
    });

    test("throws BOOTSTRAP_EMAIL_MISMATCH if currentEmail does not match", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "real@example.com",
      });

      await expect(
        t.mutation(internal.bootstrap.rescue, {
          currentEmail: "wrong@example.com",
          newEmail: "new@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_EMAIL_MISMATCH");
    });

    test("throws BOOTSTRAP_ALREADY_COMPLETE if waitlist entry is claimed", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Mark the entry as claimed
      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        await ctx.db.patch(entry!._id, {
          status: "claimed",
          claimedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.bootstrap.rescue, {
          currentEmail: "admin@example.com",
          newEmail: "admin@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_ALREADY_COMPLETE");
    });

    test("throws BOOTSTRAP_INVALID_EMAIL for invalid newEmail", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      await expect(
        t.mutation(internal.bootstrap.rescue, {
          currentEmail: "admin@example.com",
          newEmail: "nope",
        }),
      ).rejects.toThrow("BOOTSTRAP_INVALID_EMAIL");
    });

    test("throws BOOTSTRAP_DUPLICATE_WAITLIST_ENTRY if newEmail already on waitlist", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Pre-seed a waitlist entry for the new email
      await t.run(async (ctx) => {
        await ctx.db.insert("waitlistEntries", {
          email: "taken@example.com",
          meta: BOOTSTRAP_META,
          status: "waiting",
          createdAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.bootstrap.rescue, {
          currentEmail: "admin@example.com",
          newEmail: "taken@example.com",
        }),
      ).rejects.toThrow("BOOTSTRAP_DUPLICATE_WAITLIST_ENTRY");
    });

    test("revokes tokens in 'claiming' state too", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      const tokenId = await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        return ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "claiming-token",
          email: "admin@example.com",
          status: "claiming",
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
          claimStartedAt: Date.now(),
        });
      });

      await t.mutation(internal.bootstrap.rescue, {
        currentEmail: "admin@example.com",
        newEmail: "admin@example.com",
      });

      const token = await t.run(async (ctx) => {
        return ctx.db.get(tokenId);
      });
      expect(token?.status).toBe("revoked");
    });

    test("recreates waitlist entry if it was manually deleted", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Delete the waitlist entry to simulate manual deletion
      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        await ctx.db.delete(entry!._id);
      });

      const result = await t.mutation(internal.bootstrap.rescue, {
        currentEmail: "admin@example.com",
        newEmail: "admin@example.com",
      });

      expect(result.success).toBe(true);

      // Entry should be recreated and invited
      const entry = await t.run(async (ctx) => {
        return ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
      });
      expect(entry).toBeDefined();
      expect(entry?.status).toBe("invited");
    });
  });

  // -----------------------------------------------------------------------
  // status
  // -----------------------------------------------------------------------

  describe("status", () => {
    test("returns not bootstrapped with hint when no admin email exists", async () => {
      const t = createTestEnv();

      const result = await t.query(internal.bootstrap.status, {});

      expect(result.bootstrapped).toBe(false);
      expect(result.adminEmail).toBeNull();
      expect(result.hint).toContain("bootstrap:initialize");
    });

    test("returns bootstrapped: true when waitlist entry is claimed", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Mark claimed
      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        await ctx.db.patch(entry!._id, {
          status: "claimed",
          claimedAt: Date.now(),
        });
      });

      const result = await t.query(internal.bootstrap.status, {});

      expect(result.bootstrapped).toBe(true);
      expect(result.adminEmail).toBe("admin@example.com");
    });

    test("reports active token when invitation is pending", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Seed an active token
      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        await ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "active-token",
          email: "admin@example.com",
          status: "sent",
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
      });

      const result = await t.query(internal.bootstrap.status, {});

      expect(result.bootstrapped).toBe(false);
      expect(result.adminEmail).toBe("admin@example.com");
      expect(result.tokenStatus).toBe("sent");
      expect(result.tokenExpired).toBe(false);
      expect(result.hint).toContain("inbox");
    });

    test("detects expired token", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Seed an expired token
      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        await ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "expired-token",
          email: "admin@example.com",
          status: "sent",
          expiresAt: Date.now() - 1000,
          createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        });
      });

      const result = await t.query(internal.bootstrap.status, {});

      expect(result.bootstrapped).toBe(false);
      expect(result.tokenExpired).toBe(true);
      expect(result.hint).toContain("expired");
    });

    test("finds most recent token among multiple", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        // Older token (revoked)
        await ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "old-revoked-token",
          email: "admin@example.com",
          status: "revoked",
          expiresAt: Date.now() - 1000,
          createdAt: Date.now() - 100000,
        });
        // Newer token (active)
        await ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "new-active-token",
          email: "admin@example.com",
          status: "sent",
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
      });

      const result = await t.query(internal.bootstrap.status, {});

      // Should report based on the newest token (active, not expired)
      expect(result.bootstrapped).toBe(false);
      expect(result.tokenStatus).toBe("sent");
      expect(result.tokenExpired).toBe(false);
    });

    test("hints to rescue when waitlist entry is missing", async () => {
      const t = createTestEnv();

      // Insert admin email directly without a waitlist entry
      await t.run(async (ctx) => {
        await ctx.db.insert("adminEmails", { email: "admin@example.com" });
      });

      const result = await t.query(internal.bootstrap.status, {});

      expect(result.bootstrapped).toBe(false);
      expect(result.hint).toContain("rescue");
    });

    test("hints to rescue when token is revoked", async () => {
      const t = createTestEnv();

      await t.mutation(internal.bootstrap.initialize, {
        email: "admin@example.com",
      });

      // Seed a revoked token
      await t.run(async (ctx) => {
        const entry = await ctx.db
          .query("waitlistEntries")
          .withIndex("by_email", (q) => q.eq("email", "admin@example.com"))
          .first();
        await ctx.db.insert("invitationTokens", {
          waitlistEntryId: entry!._id,
          token: "revoked-token",
          email: "admin@example.com",
          status: "revoked",
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          createdAt: Date.now(),
        });
      });

      const result = await t.query(internal.bootstrap.status, {});

      expect(result.tokenStatus).toBe("revoked");
      expect(result.hint).toContain("rescue");
    });
  });
});
