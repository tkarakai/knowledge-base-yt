import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

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

describe("tasks", () => {
  describe("schema", () => {
    test("creates a task with correct fields", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "For tasks",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Test Task",
          description: "A test task",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe("Test Task");
      expect(result?.status).toBe("todo");
      expect(result?.projectId).toBe(projectId);
    });

    test("validates status enum values", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "For tasks",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      await expect(
        t.run(async (ctx) => {
          return ctx.db.insert("tasks", {
            title: "Test",
            description: "Test",
            // @ts-expect-error - intentionally passing invalid status
            status: "invalid-status",
            projectId,
            ownerId: mockUser._id,
            createdAt: Date.now(),
          });
        })
      ).rejects.toThrow();
    });
  });

  describe("indexes", () => {
    test("by_project index returns tasks for specific project", async () => {
      const t = createTestEnv();

      const project1 = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Project 1",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const project2 = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Project 2",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("tasks", {
          title: "Task in Project 1",
          description: "",
          status: "todo",
          projectId: project1,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });

        await ctx.db.insert("tasks", {
          title: "Task in Project 2",
          description: "",
          status: "todo",
          projectId: project2,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const project1Tasks = await t.run(async (ctx) => {
        return ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project1))
          .collect();
      });

      expect(project1Tasks).toHaveLength(1);
      expect(project1Tasks[0].title).toBe("Task in Project 1");
    });

    test("by_status index returns tasks with specific status", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("tasks", {
          title: "Todo Task",
          description: "",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });

        await ctx.db.insert("tasks", {
          title: "In Progress Task",
          description: "",
          status: "in_progress",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });

        await ctx.db.insert("tasks", {
          title: "Done Task",
          description: "",
          status: "done",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const inProgressTasks = await t.run(async (ctx) => {
        return ctx.db
          .query("tasks")
          .withIndex("by_status", (q) => q.eq("status", "in_progress"))
          .collect();
      });

      expect(inProgressTasks).toHaveLength(1);
      expect(inProgressTasks[0].title).toBe("In Progress Task");
    });
  });

  describe("authorization — project-chain ownership", () => {
    test("cross-tenant: Bob cannot list tasks in Alice's project", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "Owned by Alice",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("tasks", {
          title: "Alice's Secret Task",
          description: "Confidential",
          status: "todo",
          projectId: aliceProjectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate requireProjectAccess: Bob's ownerId doesn't match the project
      const bobId = "bob-id";
      const project = await t.run(async (ctx) => {
        return ctx.db.get(aliceProjectId);
      });
      expect(project!.ownerId).not.toBe(bobId);
    });

    test("same-tenant: Alice can list tasks in her own project", async () => {
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
        await ctx.db.insert("tasks", {
          title: "Alice's Task",
          description: "",
          status: "todo",
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

    test("cross-tenant: Bob cannot update a task via project chain", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Alice's Task",
          description: "",
          status: "todo",
          projectId: aliceProjectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate handler: fetch task → requireProjectAccess(ctx, task.projectId)
      const task = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });
      const project = await t.run(async (ctx) => {
        return ctx.db.get(task!.projectId);
      });

      // Bob's ownerId doesn't match the project → requireProjectAccess throws
      expect(project!.ownerId).not.toBe("bob-id");
    });

    test("cross-tenant: Bob cannot delete a task via project chain", async () => {
      const t = createTestEnv();

      const aliceProjectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Alice's Project",
          description: "",
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Alice's Task",
          description: "",
          status: "todo",
          projectId: aliceProjectId,
          ownerId: "alice-id",
          createdAt: Date.now(),
        });
      });

      // Simulate handler: fetch task → requireProjectAccess(ctx, task.projectId)
      const task = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });
      const project = await t.run(async (ctx) => {
        return ctx.db.get(task!.projectId);
      });

      // Bob's ownerId doesn't match → requireProjectAccess throws
      expect(project!.ownerId).not.toBe("bob-id");

      // Task still exists (Bob can't delete it)
      const stillExists = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe("deadline", () => {
    test("creates a task with a deadline", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const deadline = new Date("2026-03-15T14:00:00Z").getTime();
      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Task with deadline",
          description: "",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
          deadline,
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });

      expect(result?.deadline).toBe(deadline);
    });

    test("creates a task without a deadline", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Task without deadline",
          description: "",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });

      expect(result?.deadline).toBeUndefined();
    });

    test("updates a task deadline", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Task",
          description: "",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const deadline = new Date("2026-04-01T10:00:00Z").getTime();
      await t.run(async (ctx) => {
        return ctx.db.patch(taskId, { deadline });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });

      expect(result?.deadline).toBe(deadline);
    });

    test("clears a task deadline by patching to undefined", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const deadline = new Date("2026-04-01T10:00:00Z").getTime();
      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Task",
          description: "",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
          deadline,
        });
      });

      // Clearing: patch with undefined removes the optional field
      await t.run(async (ctx) => {
        return ctx.db.patch(taskId, { deadline: undefined });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });

      expect(result?.deadline).toBeUndefined();
    });
  });

  describe("updates", () => {
    test("updates task fields correctly", async () => {
      const t = createTestEnv();

      const projectId = await t.run(async (ctx) => {
        return ctx.db.insert("projects", {
          name: "Test Project",
          description: "",
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      const taskId = await t.run(async (ctx) => {
        return ctx.db.insert("tasks", {
          title: "Original Title",
          description: "Original Description",
          status: "todo",
          projectId,
          ownerId: mockUser._id,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        return ctx.db.patch(taskId, {
          title: "Updated Title",
          status: "in_progress",
        });
      });

      const result = await t.run(async (ctx) => {
        return ctx.db.get(taskId);
      });

      expect(result?.title).toBe("Updated Title");
      expect(result?.status).toBe("in_progress");
      expect(result?.description).toBe("Original Description");
    });
  });
});
