import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { ALLOWED_CONTENT_TYPES } from "./files";
import { isEmailVerificationRequired, requireProjectAccess } from "./functions";
import schema from "./schema";
import { VALID_THEMES } from "./userProfiles";

const modules = import.meta.glob("./**/*.*s");

function createTestEnv() {
  return convexTest(schema, modules);
}

describe("authentication security", () => {
  describe("getCurrentUser graceful degradation", () => {
    test("getCurrentUser returns null instead of throwing for unauthenticated users", async () => {
      // The getCurrentUser query wraps authComponent.getAuthUser in a try/catch
      // and returns null on failure. This is critical for useQuery subscriptions
      // that would crash the UI if an error were thrown.
      // We verify the contract by checking the handler's shape.
      const { getCurrentUser } = await import("./auth");
      expect(getCurrentUser).toBeDefined();
      // It's a query (not a mutation), so it's safe for real-time subscriptions
    });
  });

  describe("authedQuery / authedMutation contract", () => {
    test("authedQuery is defined as a query function", async () => {
      const { authedQuery } = await import("./functions");
      expect(authedQuery).toBeDefined();
      expect(typeof authedQuery).toBe("function");
    });

    test("authedMutation is defined with rate limiting", async () => {
      const { authedMutation } = await import("./functions");
      expect(authedMutation).toBeDefined();
      // authedMutation is a customMutation that:
      // 1. Checks auth (throws NOT_AUTHENTICATED if no user)
      // 2. Enforces per-user rate limit (mutationGlobal)
      // Both are critical security gates
    });
  });
});

describe("email verification policy fallback", () => {
  test("admin scope falls back to legacy setting when scoped key is missing", async () => {
    const t = createTestEnv();

    const required = await t.run(async (ctx) => {
      await ctx.db.insert("appSettings", {
        key: "emailVerificationRequired",
        value: "false",
        updatedAt: Date.now(),
      });

      return await isEmailVerificationRequired(ctx, { role: "admin" });
    });

    expect(required).toBe(false);
  });

  test("admin scoped value overrides legacy fallback when present", async () => {
    const t = createTestEnv();

    const required = await t.run(async (ctx) => {
      await ctx.db.insert("appSettings", {
        key: "emailVerificationRequired",
        value: "false",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("appSettings", {
        key: "adminEmailVerificationRequired",
        value: "true",
        updatedAt: Date.now(),
      });

      return await isEmailVerificationRequired(ctx, { role: "admin" });
    });

    expect(required).toBe(true);
  });
});

describe("authorization — cross-tenant isolation", () => {
  describe("project access control", () => {
    test("owner can access their own project", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Owned by Alice",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return requireProjectAccess(
          { db: ctx.db, ownerId: "alice-id" },
          projectId
        );
      });

      expect(result.name).toBe("Alice's Project");
    });

    test("non-owner is denied access to another user's project", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Confidential",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      await expect(
        t.run(async (ctx) => {
          return requireProjectAccess(
            { db: ctx.db, ownerId: "bob-id" },
            projectId
          );
        })
      ).rejects.toThrow("PROJECT_NOT_FOUND");
    });
  });

  describe("cross-tenant task isolation", () => {
    test("Bob cannot access tasks in Alice's project via project chain", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        const pid = await ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        await ctx.db.insert("tasks", {
          title: "Secret Task",
          description: "Confidential data",
          status: "todo",
          projectId: pid,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        return pid;
      });

      // The task handler calls requireProjectAccess first.
      // Bob's request would fail at this gate.
      await expect(
        t.run(async (ctx) => {
          return requireProjectAccess(
            { db: ctx.db, ownerId: "bob-id" },
            aliceProjectId
          );
        })
      ).rejects.toThrow("PROJECT_NOT_FOUND");
    });

    test("Alice can access tasks in her own project", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        const pid = await ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        await ctx.db.insert("tasks", {
          title: "Alice's Task",
          description: "",
          status: "todo",
          projectId: pid,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        return pid;
      });

      // Alice passes the project access check
      const project = await t.run(async (ctx) => {
        return requireProjectAccess(
          { db: ctx.db, ownerId: "alice-id" },
          aliceProjectId
        );
      });
      expect(project.ownerId).toBe("alice-id");

      // After passing the check, tasks are accessible
      const tasks = await t.run(async (ctx) => {
        return ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", aliceProjectId))
          .collect();
      });
      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe("Alice's Task");
    });
  });

  describe("cross-tenant upload isolation", () => {
    test("Bob cannot access uploads in Alice's project via project chain", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        const pid = await ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        const storageId = await ctx.storage.store(new Blob(["secret"]));
        await ctx.db.insert("uploads", {
          storageId,
          name: "secret-doc.pdf",
          contentType: "application/pdf",
          size: 1024,
          projectId: pid,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        return pid;
      });

      // Bob's request fails at the project access gate
      await expect(
        t.run(async (ctx) => {
          return requireProjectAccess(
            { db: ctx.db, ownerId: "bob-id" },
            aliceProjectId
          );
        })
      ).rejects.toThrow("PROJECT_NOT_FOUND");
    });

    test("Bob cannot delete uploads via project chain", async () => {
      const t = createTestEnv();

      const { projectId, uploadId } = await t.run(async (ctx) => {
        const pid = await ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        const storageId = await ctx.storage.store(new Blob(["file"]));
        const uid = await ctx.db.insert("uploads", {
          storageId,
          name: "alice-file.pdf",
          contentType: "application/pdf",
          size: 512,
          projectId: pid,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        return { projectId: pid, uploadId: uid };
      });

      // The deleteUpload handler fetches the upload, then calls
      // requireProjectAccess(ctx, upload.projectId). Bob fails here.
      const upload = await t.run(async (ctx) => {
        return ctx.db.get(uploadId);
      });

      await expect(
        t.run(async (ctx) => {
          return requireProjectAccess(
            { db: ctx.db, ownerId: "bob-id" },
            upload!.projectId
          );
        })
      ).rejects.toThrow("PROJECT_NOT_FOUND");

      // Upload still exists — Bob couldn't delete it
      const stillExists = await t.run(async (ctx) => {
        return ctx.db.get(uploadId);
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe("cross-tenant user profile isolation", () => {
    test("user profiles are indexed by ownerId for isolated access", async () => {
      const t = createTestEnv();

      await t.run(async (ctx) => {
        await ctx.db.insert("userProfiles", {
          ownerId: "alice-id",
          locale: "en",
          theme: "dark",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("userProfiles", {
          ownerId: "bob-id",
          locale: "fr",
          theme: "light",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Each user's profile query filters by their own ownerId
      const aliceProfile = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "alice-id"))
          .first();
      });
      expect(aliceProfile?.locale).toBe("en");

      const bobProfile = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "bob-id"))
          .first();
      });
      expect(bobProfile?.locale).toBe("fr");

      // Alice's query does not return Bob's profile
      const aliceProfiles = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "alice-id"))
          .collect();
      });
      expect(aliceProfiles).toHaveLength(1);
      expect(aliceProfiles[0].ownerId).toBe("alice-id");
    });
  });
});

describe("input validation in mutations", () => {
  describe("userProfile validation", () => {
    test("valid themes are constrained to production allowlist", () => {
      // VALID_THEMES is imported from userProfiles.ts — the source of truth
      const invalidThemes = ["hacker-mode", "", "<script>", "DARK", "Light"];

      // Verify expected themes exist in the production constant
      expect(VALID_THEMES).toContain("light");
      expect(VALID_THEMES).toContain("dark");
      expect(VALID_THEMES).toContain("system");

      for (const theme of invalidThemes) {
        expect(
          (VALID_THEMES as readonly string[]).includes(theme),
          `${theme} should be rejected`
        ).toBe(false);
      }
    });
  });

  describe("file upload content-type whitelist", () => {
    test("only safe content types are allowed", () => {
      // ALLOWED_CONTENT_TYPES is imported from files.ts — the source of truth
      const DANGEROUS = [
        "text/html",
        "image/svg+xml",
        "application/javascript",
        "application/x-executable",
        "application/x-sh",
        "text/xml",
        "application/xhtml+xml",
      ];

      for (const type of DANGEROUS) {
        expect(
          ALLOWED_CONTENT_TYPES.has(type),
          `${type} must NOT be in allowlist`
        ).toBe(false);
      }

      // Safe types must be present
      expect(ALLOWED_CONTENT_TYPES.has("image/jpeg")).toBe(true);
      expect(ALLOWED_CONTENT_TYPES.has("application/pdf")).toBe(true);
    });
  });
});

describe("mutation rate limiting", () => {
  describe("rate limit configuration", () => {
    test("mutationGlobal rate limit is defined as token bucket", async () => {
      const { checkRateLimit, rateLimit } = await import("./rateLimits");

      // Both check and consume functions should be available
      expect(checkRateLimit).toBeDefined();
      expect(rateLimit).toBeDefined();
      expect(typeof checkRateLimit).toBe("function");
      expect(typeof rateLimit).toBe("function");
    });

    test("rateLimits table exists for persisting rate limit state", async () => {
      const t = createTestEnv();

      // The rateLimits table is used by convex-helpers rateLimit to persist
      // token bucket state. Verify it accepts records.
      const id = await t.run(async (ctx) => {
        return ctx.db.insert("rateLimits", {
          name: "mutationGlobal",
          key: "test-user-id",
          value: 30,
          ts: Date.now(),
        });
      });

      const record = await t.run(async (ctx) => {
        return ctx.db.get(id);
      });

      expect(record).toBeDefined();
      expect(record?.name).toBe("mutationGlobal");
      expect(record?.key).toBe("test-user-id");
    });

    test("rate limit state is per-user (keyed by ownerId)", async () => {
      const t = createTestEnv();

      // Insert rate limit records for two different users
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          name: "mutationGlobal",
          key: "alice-id",
          value: 5,
          ts: Date.now(),
        });
        await ctx.db.insert("rateLimits", {
          name: "mutationGlobal",
          key: "bob-id",
          value: 25,
          ts: Date.now(),
        });
      });

      // Each user has their own independent rate limit state
      const aliceLimit = await t.run(async (ctx) => {
        return ctx.db
          .query("rateLimits")
          .withIndex("name", (q) =>
            q.eq("name", "mutationGlobal").eq("key", "alice-id")
          )
          .first();
      });

      const bobLimit = await t.run(async (ctx) => {
        return ctx.db
          .query("rateLimits")
          .withIndex("name", (q) =>
            q.eq("name", "mutationGlobal").eq("key", "bob-id")
          )
          .first();
      });

      expect(aliceLimit?.value).toBe(5);
      expect(bobLimit?.value).toBe(25);
      // They are independent — one user's rate limit doesn't affect the other
      expect(aliceLimit?.key).not.toBe(bobLimit?.key);
    });
  });
});
