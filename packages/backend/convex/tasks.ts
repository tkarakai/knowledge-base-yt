import { v } from "convex/values";

import {
  authedMutation,
  authedQuery,
  requireProjectAccess,
  assertMaxLength,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "./functions";

export const listByProject = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);

    return ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const create = authedMutation({
  args: {
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    projectId: v.id("projects"),
    deadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    assertMaxLength(args.title, MAX_NAME_LENGTH, "TITLE");
    assertMaxLength(args.description, MAX_DESCRIPTION_LENGTH, "DESCRIPTION");

    return ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      status: args.status,
      projectId: args.projectId,
      ownerId: ctx.ownerId,
      createdAt: Date.now(),
      deadline: args.deadline,
    });
  },
});

export const update = authedMutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("todo"),
        v.literal("in_progress"),
        v.literal("done")
      )
    ),
    deadline: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    // Verify ownership through the project chain
    await requireProjectAccess(ctx, task.projectId);
    assertMaxLength(args.title, MAX_NAME_LENGTH, "TITLE");
    assertMaxLength(args.description, MAX_DESCRIPTION_LENGTH, "DESCRIPTION");

    const updates: Partial<{
      title: string;
      description: string;
      status: "todo" | "in_progress" | "done";
      deadline: number | undefined;
    }> = {};

    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.status !== undefined) updates.status = args.status;
    if (args.deadline !== undefined) {
      updates.deadline = args.deadline === null ? undefined : args.deadline;
    }

    return ctx.db.patch(args.id, updates);
  },
});

export const remove = authedMutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("TASK_NOT_FOUND");
    }

    // Verify ownership through the project chain
    await requireProjectAccess(ctx, task.projectId);

    await ctx.db.delete(args.id);
  },
});
