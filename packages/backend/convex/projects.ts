import { v } from "convex/values";

import {
  authedMutation,
  authedQuery,
  requireProjectAccess,
  assertMaxLength,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} from "./functions";

export const list = authedQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .order("desc")
      .collect();
  },
});

export const listWithStats = authedQuery({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.ownerId))
      .order("desc")
      .collect();

    return Promise.all(
      projects.map(async (project) => {
        const tasks = await ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        const uploads = await ctx.db
          .query("uploads")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();

        return {
          ...project,
          taskCount: tasks.length,
          doneCount: tasks.filter((t) => t.status === "done").length,
          uploadCount: uploads.length,
        };
      })
    );
  },
});

export const get = authedQuery({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return requireProjectAccess(ctx, args.id);
  },
});

export const create = authedMutation({
  args: {
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    assertMaxLength(args.name, MAX_NAME_LENGTH, "NAME");
    assertMaxLength(args.description, MAX_DESCRIPTION_LENGTH, "DESCRIPTION");

    return ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      ownerId: ctx.ownerId,
      createdAt: Date.now(),
    });
  },
});

export const update = authedMutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.id);
    assertMaxLength(args.name, MAX_NAME_LENGTH, "NAME");
    assertMaxLength(args.description, MAX_DESCRIPTION_LENGTH, "DESCRIPTION");

    const updates: Partial<{ name: string; description: string }> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    return ctx.db.patch(args.id, updates);
  },
});

export const remove = authedMutation({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.id);

    // Cascade delete all tasks belonging to this project
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    // Cascade delete all uploads belonging to this project
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const upload of uploads) {
      await ctx.storage.delete(upload.storageId);
      await ctx.db.delete(upload._id);
    }

    await ctx.db.delete(args.id);
  },
});
