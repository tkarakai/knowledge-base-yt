import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const mockUser = {
  _id: "test-user-123" as const,
  userId: "test-user-123",
  email: "test@example.com",
  name: "Test User",
};

function createTestEnv() {
  return convexTest(schema, modules);
}

describe("projects", () => {
  describe("schema", () => {
    test("creates a project with correct fields", async () => {
      const t = createTestEnv();

      const id = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "A test project",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(id);
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Test Project");
      expect(result?.description).toBe("A test project");
      expect(result?.ownerId).toBe(mockUser._id);
    });

    test("validates required fields", async () => {
      const t = createTestEnv();

      await expect(
        t.run(async (ctx) => {
          // @ts-expect-error - intentionally passing invalid data
          return ctx.db.insert("projects", {
            name: "Only Name",
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("indexes", () => {
    test("by_owner index returns projects for specific owner", async () => {
      const t = createTestEnv();

      await t.run(async (ctx) => {
        await ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Owned by Alice",
          ownerId: "alice",
          createdAt: Date.now(),
        });

        await ctx.db.insert("projects", {
          name: "Bob's Project",
          description: "Owned by Bob",
          ownerId: "bob",
          createdAt: Date.now(),
        });
      });

      const aliceProjects = await t.run(async (ctx) => {
        return ctx.db
          .query("projects")
          .withIndex("by_owner", (q) => q.eq("ownerId", "alice"))
          .collect();
      });

      expect(aliceProjects).toHaveLength(1);
      expect(aliceProjects[0].name).toBe("Alice's Project");
    });
  });

  describe("cascade delete", () => {
    test("deleting a project removes all its tasks", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Project to Delete",
          description: "Will be deleted",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("tasks", {
          title: "Task 1",
          description: "First task",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
        await ctx.db.insert("tasks", {
          title: "Task 2",
          description: "Second task",
          status: "done",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      // Delete project and its tasks
      await t.run(async (ctx) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();
        for (const task of tasks) {
          await ctx.db.delete(task._id);
        }
        await ctx.db.delete(projectId);
      });

      const remainingTasks = await t.run(async (ctx) => {
        return ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect();
      });

      expect(remainingTasks).toHaveLength(0);

      const deletedProject = await t.run(async (ctx) => {
        return ctx.db.get(projectId);
      });

      expect(deletedProject).toBeNull();
    });
  });
});
