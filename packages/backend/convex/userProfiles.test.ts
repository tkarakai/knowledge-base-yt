import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function createTestEnv() {
  return convexTest(schema, modules);
}

const mockUser = {
  _id: "test-user-123" as const,
  userId: "test-user-123",
  email: "test@example.com",
  name: "Test User",
};

describe("userProfiles", () => {
  describe("schema", () => {
    test("creates a profile with all optional fields", async () => {
      const t = createTestEnv();

      const id = await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          locale: "fr",
          theme: "dark",
          timezone: "Europe/Paris",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(id);
      });

      expect(result).toBeDefined();
      expect(result?.ownerId).toBe(mockUser._id);
      expect(result?.locale).toBe("fr");
      expect(result?.theme).toBe("dark");
      expect(result?.timezone).toBe("Europe/Paris");
    });

    test("creates a profile with minimal fields", async () => {
      const t = createTestEnv();

      const id = await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(id);
      });

      expect(result).toBeDefined();
      expect(result?.ownerId).toBe(mockUser._id);
      expect(result?.locale).toBeUndefined();
      expect(result?.theme).toBeUndefined();
      expect(result?.timezone).toBeUndefined();
    });

    test("validates required ownerId field", async () => {
      const t = createTestEnv();

      await expect(
        t.run(async (ctx) => {
          // @ts-expect-error - intentionally passing invalid data
          return ctx.db.insert("userProfiles", {
            locale: "en",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        })
      ).rejects.toThrow();
    });

    test("validates required timestamps", async () => {
      const t = createTestEnv();

      await expect(
        t.run(async (ctx) => {
          // @ts-expect-error - intentionally missing updatedAt
          return ctx.db.insert("userProfiles", {
            ownerId: mockUser._id,
            createdAt: Date.now(),
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("indexes", () => {
    test("by_owner index returns profile for specific owner", async () => {
      const t = createTestEnv();

      await t.run(async (ctx) => {
        await ctx.db.insert("userProfiles", {
          ownerId: "user-alice",
          locale: "en",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("userProfiles", {
          ownerId: "user-bob",
          locale: "fr",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const aliceProfile = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "user-alice"))
          .first();
      });

      expect(aliceProfile).toBeDefined();
      expect(aliceProfile?.locale).toBe("en");

      const bobProfile = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "user-bob"))
          .first();
      });

      expect(bobProfile).toBeDefined();
      expect(bobProfile?.locale).toBe("fr");
    });

    test("by_owner index returns null for non-existent owner", async () => {
      const t = createTestEnv();

      const result = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "non-existent"))
          .first();
      });

      expect(result).toBeNull();
    });
  });

  describe("upsert logic", () => {
    test("creates new profile when doesn't exist", async () => {
      const t = createTestEnv();

      const profileId = await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          locale: "fr",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const profile = await t.run(async (ctx) => {
        return ctx.db.get(profileId);
      });

      expect(profile).toBeDefined();
      expect(profile?.locale).toBe("fr");
    });

    test("updates existing profile", async () => {
      const t = createTestEnv();

      // Create initial profile
      const profileId = await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          locale: "en",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Update locale
      await t.run(async (ctx) => {
        const existing = await ctx.db.get(profileId);
        if (existing) {
          await ctx.db.patch(profileId, {
            locale: "es",
            updatedAt: Date.now(),
          });
        }
      });

      // Verify update
      const updated = await t.run(async (ctx) => {
        return ctx.db.get(profileId);
      });

      expect(updated?.locale).toBe("es");
    });

    test("partial update preserves other fields", async () => {
      const t = createTestEnv();

      // Create initial profile with multiple fields
      const profileId = await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          locale: "en",
          theme: "dark",
          timezone: "America/New_York",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Update only locale
      await t.run(async (ctx) => {
        const existing = await ctx.db.get(profileId);
        if (existing) {
          await ctx.db.patch(profileId, {
            locale: "fr",
            updatedAt: Date.now(),
          });
        }
      });

      // Verify only locale changed
      const updated = await t.run(async (ctx) => {
        return ctx.db.get(profileId);
      });

      expect(updated?.locale).toBe("fr");
      expect(updated?.theme).toBe("dark"); // Unchanged
      expect(updated?.timezone).toBe("America/New_York"); // Unchanged
    });
  });

  describe("query patterns", () => {
    test("findByOwner gets profile for specific user", async () => {
      const t = createTestEnv();

      // Create profile
      await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          locale: "ja",
          theme: "system",
          timezone: "Asia/Tokyo",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Query profile by owner
      const profile = await t.run(async (ctx) => {
        return ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", mockUser._id))
          .first();
      });

      expect(profile).toBeDefined();
      expect(profile?.locale).toBe("ja");
      expect(profile?.theme).toBe("system");
      expect(profile?.timezone).toBe("Asia/Tokyo");
    });

    test("findByOwner extracts locale efficiently", async () => {
      const t = createTestEnv();

      // Create profile with multiple fields
      await t.run(async (ctx) => {
        return ctx.db.insert("userProfiles", {
          ownerId: mockUser._id,
          locale: "it",
          theme: "light",
          timezone: "Europe/Rome",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Query and extract only locale
      const locale = await t.run(async (ctx) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", mockUser._id))
          .first();
        return profile?.locale ?? null;
      });

      expect(locale).toBe("it");
    });

    test("findByOwner returns null when no profile", async () => {
      const t = createTestEnv();

      const locale = await t.run(async (ctx) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_owner", (q) => q.eq("ownerId", "nonexistent-user"))
          .first();
        return profile?.locale ?? null;
      });

      expect(locale).toBeNull();
    });
  });
});
