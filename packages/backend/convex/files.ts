import { v } from "convex/values";

import {
  authedMutation,
  authedQuery,
  requireProjectAccess,
  assertMaxLength,
  MAX_NAME_LENGTH,
} from "./functions";

const MAX_FILE_SIZE = 1_048_576; // 1MB

/** Allowed content types for uploads. Reject executables, HTML, SVG, etc. */
export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
]);

export const generateUploadUrl = authedMutation({
  args: {},
  handler: async (ctx) => {
    return ctx.storage.generateUploadUrl();
  },
});

export const saveUpload = authedMutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    assertMaxLength(args.name, MAX_NAME_LENGTH, "NAME");

    // Read actual file metadata from storage — never trust client-provided values
    const fileMeta = await ctx.db.system.get(args.storageId);
    if (!fileMeta) {
      throw new Error("FILE_NOT_FOUND");
    }

    if (fileMeta.size > MAX_FILE_SIZE) {
      await ctx.storage.delete(args.storageId);
      throw new Error("FILE_TOO_LARGE");
    }

    const contentType = fileMeta.contentType ?? "application/octet-stream";
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      await ctx.storage.delete(args.storageId);
      throw new Error("FILE_TYPE_NOT_ALLOWED");
    }

    return ctx.db.insert("uploads", {
      storageId: args.storageId,
      name: args.name,
      contentType,
      size: fileMeta.size,
      projectId: args.projectId,
      ownerId: ctx.ownerId,
      createdAt: Date.now(),
    });
  },
});

export const listUploads = authedQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);

    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return Promise.all(
      uploads.map(async (upload) => ({
        ...upload,
        url: await ctx.storage.getUrl(upload.storageId),
      }))
    );
  },
});

export const deleteUpload = authedMutation({
  args: { id: v.id("uploads") },
  handler: async (ctx, args) => {
    const upload = await ctx.db.get(args.id);
    if (!upload) {
      throw new Error("UPLOAD_NOT_FOUND");
    }

    // Verify ownership through the project chain
    await requireProjectAccess(ctx, upload.projectId);

    await ctx.storage.delete(upload.storageId);
    await ctx.db.delete(args.id);
  },
});
