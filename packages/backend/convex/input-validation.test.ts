import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { ALLOWED_CONTENT_TYPES } from "./files";
import {
  assertMaxLength,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  requireProjectAccess,
} from "./functions";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function createTestEnv() {
  return convexTest(schema, modules);
}

describe("input validation", () => {
  describe("assertMaxLength", () => {
    test("allows string at exactly max length", () => {
      expect(() =>
        assertMaxLength("a".repeat(MAX_NAME_LENGTH), MAX_NAME_LENGTH, "NAME")
      ).not.toThrow();
    });

    test("throws for string one char over max length", () => {
      expect(() =>
        assertMaxLength(
          "a".repeat(MAX_NAME_LENGTH + 1),
          MAX_NAME_LENGTH,
          "NAME"
        )
      ).toThrow("NAME_TOO_LONG");
    });

    test("allows empty string", () => {
      expect(() =>
        assertMaxLength("", MAX_NAME_LENGTH, "NAME")
      ).not.toThrow();
    });

    test("allows undefined (optional fields)", () => {
      expect(() =>
        assertMaxLength(undefined, MAX_NAME_LENGTH, "NAME")
      ).not.toThrow();
    });

    test("throws with correct field name in error", () => {
      expect(() =>
        assertMaxLength("a".repeat(256), MAX_NAME_LENGTH, "TITLE")
      ).toThrow("TITLE_TOO_LONG");
    });

    test("enforces description max length (5000)", () => {
      expect(() =>
        assertMaxLength(
          "x".repeat(MAX_DESCRIPTION_LENGTH),
          MAX_DESCRIPTION_LENGTH,
          "DESCRIPTION"
        )
      ).not.toThrow();

      expect(() =>
        assertMaxLength(
          "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
          MAX_DESCRIPTION_LENGTH,
          "DESCRIPTION"
        )
      ).toThrow("DESCRIPTION_TOO_LONG");
    });

    test("handles unicode characters correctly", () => {
      // Emoji takes 2 chars in JS string length
      const emojiString = "\u{1F600}".repeat(128); // 256 JS string length
      expect(() =>
        assertMaxLength(emojiString, MAX_NAME_LENGTH, "NAME")
      ).toThrow("NAME_TOO_LONG");
    });
  });

  describe("requireProjectAccess", () => {
    test("returns project when ownerId matches", async () => {
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

      expect(result).toBeDefined();
      expect(result.name).toBe("Alice's Project");
      expect(result.ownerId).toBe("alice-id");
    });

    test("throws PROJECT_NOT_FOUND when ownerId does not match", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Private",
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

    test("throws PROJECT_NOT_FOUND for non-existent project ID", async () => {
      const t = createTestEnv();

      // Insert and delete to get a valid but non-existent ID
      const projectId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("projects", {
          name: "Temp",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        t.run(async (ctx) => {
          return requireProjectAccess(
            { db: ctx.db, ownerId: "alice-id" },
            projectId
          );
        })
      ).rejects.toThrow("PROJECT_NOT_FOUND");
    });

    test("uses generic error message (no information leakage)", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Secret Project",
          description: "Very confidential",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Bob's error message should NOT reveal that the project exists
      try {
        await t.run(async (ctx) => {
          return requireProjectAccess(
            { db: ctx.db, ownerId: "bob-id" },
            projectId
          );
        });
        expect.fail("Should have thrown");
      } catch (error) {
        const message = (error as Error).message;
        // Error should be generic "not found", not "access denied"
        // This prevents enumeration of project IDs
        expect(message).toBe("PROJECT_NOT_FOUND");
        expect(message).not.toContain("alice");
        expect(message).not.toContain("Secret");
      }
    });
  });

  describe("schema validation", () => {
    test("task status rejects invalid enum values", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test",
          description: "",
          ownerId: "user-1",
          createdAt: Date.now(),
        });
      });

      await expect(
        t.run(async (ctx) => {
          return ctx.db.insert("tasks", {
            title: "Task",
            description: "",
            // @ts-expect-error - intentionally passing invalid status
            status: "deleted",
            projectId,
            ownerId: "user-1",
            createdAt: Date.now(),
          });
        })
      ).rejects.toThrow();
    });

    test("file upload content-type whitelist rejects dangerous types", () => {
      // ALLOWED_CONTENT_TYPES is imported from files.ts — the production constant.
      // The actual gate is in the saveUpload mutation handler (tested in files.test.ts).
      // Here we verify the allowlist itself rejects dangerous content types.
      const dangerous = [
        "text/html",
        "image/svg+xml",
        "application/javascript",
        "application/x-sh",
      ];

      for (const type of dangerous) {
        expect(
          ALLOWED_CONTENT_TYPES.has(type),
          `${type} must NOT be in allowlist`
        ).toBe(false);
      }
    });
  });
});
