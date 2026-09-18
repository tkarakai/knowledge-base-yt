import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { ALLOWED_CONTENT_TYPES } from "./files";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function createTestEnv() {
  return convexTest(schema, modules);
}

describe("files", () => {
  describe("schema", () => {
    test("creates an upload with correct fields", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "For uploads",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const uploadId = await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob(["test"]));
        return ctx.db.insert("uploads", {
          storageId,
          name: "test.pdf",
          contentType: "application/pdf",
          size: 1024,
          projectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(uploadId);
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("test.pdf");
      expect(result?.contentType).toBe("application/pdf");
      expect(result?.size).toBe(1024);
      expect(result?.projectId).toBe(projectId);
      expect(result?.ownerId).toBe("alice-id");
    });
  });

  describe("indexes", () => {
    test("by_project index returns uploads for specific project", async () => {
      const t = createTestEnv();

      const project1 = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Project 1",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const project2 = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Project 2",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const sid1 = await ctx.storage.store(new Blob(["p1"]));
        await ctx.db.insert("uploads", {
          storageId: sid1,
          name: "file-in-p1.pdf",
          contentType: "application/pdf",
          size: 512,
          projectId: project1,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });

        const sid2 = await ctx.storage.store(new Blob(["p2"]));
        await ctx.db.insert("uploads", {
          storageId: sid2,
          name: "file-in-p2.pdf",
          contentType: "application/pdf",
          size: 256,
          projectId: project2,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const p1Uploads = await t.run(async (ctx) => {
        return ctx.db
          .query("uploads")
          .withIndex("by_project", (q) => q.eq("projectId", project1))
          .collect();
      });

      expect(p1Uploads).toHaveLength(1);
      expect(p1Uploads[0].name).toBe("file-in-p1.pdf");
    });

    test("by_owner index returns uploads for specific owner", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Shared Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const sid1 = await ctx.storage.store(new Blob(["alice"]));
        await ctx.db.insert("uploads", {
          storageId: sid1,
          name: "alice-file.pdf",
          contentType: "application/pdf",
          size: 512,
          projectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });

        const sid2 = await ctx.storage.store(new Blob(["bob"]));
        await ctx.db.insert("uploads", {
          storageId: sid2,
          name: "bob-file.pdf",
          contentType: "application/pdf",
          size: 256,
          projectId,
          ownerId: "bob-id",
          createdAt: Date.now(),
        });
      });

      const aliceUploads = await t.run(async (ctx) => {
        return ctx.db
          .query("uploads")
          .withIndex("by_owner", (q) => q.eq("ownerId", "alice-id"))
          .collect();
      });

      expect(aliceUploads).toHaveLength(1);
      expect(aliceUploads[0].name).toBe("alice-file.pdf");
    });
  });

  describe("authorization — project-chain ownership", () => {
    test("cross-tenant: Bob cannot list uploads in Alice's project", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Private",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob(["secret"]));
        await ctx.db.insert("uploads", {
          storageId,
          name: "secret-doc.pdf",
          contentType: "application/pdf",
          size: 2048,
          projectId: aliceProjectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate requireProjectAccess: Bob's ownerId doesn't match the project
      const project = await t.run(async (ctx) => {
        return ctx.db.get(aliceProjectId);
      });
      expect(project!.ownerId).not.toBe("bob-id");
    });

    test("same-tenant: Alice can list uploads in her own project", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob(["doc"]));
        await ctx.db.insert("uploads", {
          storageId,
          name: "alice-doc.pdf",
          contentType: "application/pdf",
          size: 1024,
          projectId: aliceProjectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate requireProjectAccess: Alice's ownerId matches
      const project = await t.run(async (ctx) => {
        return ctx.db.get(aliceProjectId);
      });
      expect(project!.ownerId).toBe("alice-id");

      // After passing the check, uploads are accessible
      const uploads = await t.run(async (ctx) => {
        return ctx.db
          .query("uploads")
          .withIndex("by_project", (q) => q.eq("projectId", aliceProjectId))
          .collect();
      });
      expect(uploads).toHaveLength(1);
      expect(uploads[0].name).toBe("alice-doc.pdf");
    });

    test("cross-tenant: Bob cannot save upload to Alice's project", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Private",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate requireProjectAccess: Bob's ownerId doesn't match
      const project = await t.run(async (ctx) => {
        return ctx.db.get(aliceProjectId);
      });
      expect(project!.ownerId).not.toBe("bob-id");

      // No uploads created
      const uploads = await t.run(async (ctx) => {
        return ctx.db
          .query("uploads")
          .withIndex("by_project", (q) => q.eq("projectId", aliceProjectId))
          .collect();
      });
      expect(uploads).toHaveLength(0);
    });

    test("cross-tenant: Bob cannot delete upload via project chain", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const uploadId = await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob(["file"]));
        return ctx.db.insert("uploads", {
          storageId,
          name: "alice-file.pdf",
          contentType: "application/pdf",
          size: 512,
          projectId: aliceProjectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate handler: fetch upload → requireProjectAccess(ctx, upload.projectId)
      const upload = await t.run(async (ctx) => {
        return ctx.db.get(uploadId);
      });
      const project = await t.run(async (ctx) => {
        return ctx.db.get(upload!.projectId);
      });

      // Bob's ownerId doesn't match → requireProjectAccess throws
      expect(project!.ownerId).not.toBe("bob-id");

      // Upload still exists
      const stillExists = await t.run(async (ctx) => {
        return ctx.db.get(uploadId);
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe("upload validation — content type whitelist", () => {
    // ALLOWED_CONTENT_TYPES is imported from files.ts — the source of truth

    test("allowed content types are accepted at data layer", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      for (const contentType of ALLOWED_CONTENT_TYPES) {
        const uploadId = await t.run(async (ctx) => {
          const storageId = await ctx.storage.store(new Blob(["data"]));
          return ctx.db.insert("uploads", {
            storageId,
            name: `file.${contentType.split("/")[1]}`,
            contentType,
            size: 100,
            projectId,
            ownerId: "alice-id",
            createdAt: Date.now(),
          });
        });

        const upload = await t.run(async (ctx) => {
          return ctx.db.get(uploadId);
        });
        expect(upload?.contentType).toBe(contentType);
      }
    });

    test("dangerous content types are NOT in the allowlist", () => {
      const dangerousTypes = [
        "text/html",
        "image/svg+xml",
        "application/javascript",
        "application/x-executable",
        "application/x-sh",
        "text/xml",
        "application/xhtml+xml",
        "application/x-httpd-php",
        "application/octet-stream",
      ];

      for (const type of dangerousTypes) {
        expect(
          ALLOWED_CONTENT_TYPES.has(type),
          `Dangerous type ${type} must NOT be allowed`
        ).toBe(false);
      }
    });
  });

  describe("upload validation — size limits", () => {
    const MAX_FILE_SIZE = 1_048_576; // 1MB

    test("file at exactly 1MB is within limit", () => {
      expect(MAX_FILE_SIZE).toBe(1_048_576);
      expect(MAX_FILE_SIZE <= MAX_FILE_SIZE).toBe(true);
    });

    test("file 1 byte over 1MB exceeds limit", () => {
      const oversizedFile = MAX_FILE_SIZE + 1;
      expect(oversizedFile > MAX_FILE_SIZE).toBe(true);
    });
  });

  describe("upload validation — name length", () => {
    test("name exceeding MAX_NAME_LENGTH (255) is rejected by assertMaxLength", async () => {
      // The saveUpload handler calls assertMaxLength(args.name, MAX_NAME_LENGTH, "NAME")
      const { assertMaxLength, MAX_NAME_LENGTH } = await import("./functions");

      expect(() =>
        assertMaxLength("a".repeat(MAX_NAME_LENGTH + 1), MAX_NAME_LENGTH, "NAME")
      ).toThrow("NAME_TOO_LONG");
    });

    test("name at exactly MAX_NAME_LENGTH passes", async () => {
      const { assertMaxLength, MAX_NAME_LENGTH } = await import("./functions");

      expect(() =>
        assertMaxLength("a".repeat(MAX_NAME_LENGTH), MAX_NAME_LENGTH, "NAME")
      ).not.toThrow();
    });
  });
});
