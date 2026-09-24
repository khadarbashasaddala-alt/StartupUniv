import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { assertService } from "./lib/serviceAuth";

const kindValidator = v.union(
  v.literal("file"),
  v.literal("image"),
  v.literal("video"),
);

const visibilityValidator = v.union(v.literal("public"), v.literal("private"));

/**
 * Step 1 of an upload: hand back a one-shot URL the browser POSTs the bytes to.
 * Convex streams them straight into storage, so large videos never pass through
 * our Express process.
 */
export const generateUploadUrl = mutation({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertService(args.secret);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Step 2 of an upload: record what was just stored. The browser gets a
 * storageId back from the upload URL and reports it here (via Express), which
 * is when the blob becomes findable.
 *
 * Size and contentType are read back from storage rather than trusted from the
 * caller, so a client cannot misreport a 2GB video as a 1KB file.
 */
export const recordUpload = mutation({
  args: {
    secret: v.string(),
    storageId: v.id("_storage"),
    kind: kindValidator,
    originalName: v.string(),
    ownerId: v.string(),
    context: v.optional(v.string()),
    visibility: v.optional(visibilityValidator),
  },
  handler: async (ctx, args) => {
    assertService(args.secret);

    const stored = await ctx.db.system.get(args.storageId);
    if (!stored) {
      throw new Error("Upload not found in storage");
    }

    const mediaId = await ctx.db.insert("media", {
      storageId: args.storageId,
      kind: args.kind,
      contentType: stored.contentType ?? "application/octet-stream",
      size: stored.size,
      originalName: args.originalName,
      ownerId: args.ownerId,
      context: args.context,
      visibility: args.visibility ?? "private",
      createdAt: Date.now(),
    });

    return mediaId;
  },
});

/** One media row plus a time-limited URL for its bytes. */
export const get = query({
  args: { secret: v.string(), mediaId: v.id("media") },
  handler: async (ctx, args) => {
    assertService(args.secret);

    const media = await ctx.db.get(args.mediaId);
    if (!media) return null;

    return { ...media, url: await ctx.storage.getUrl(media.storageId) };
  },
});

/**
 * Everything uploaded against one relational row, newest first -- e.g. every
 * attachment on a ticket, every recording on a meeting.
 */
export const listByContext = query({
  args: { secret: v.string(), context: v.string() },
  handler: async (ctx, args) => {
    assertService(args.secret);

    const rows = await ctx.db
      .query("media")
      .withIndex("by_context", (q) => q.eq("context", args.context))
      .order("desc")
      .collect();

    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: await ctx.storage.getUrl(row.storageId),
      })),
    );
  },
});

/** Everything one user uploaded, newest first. */
export const listByOwner = query({
  args: { secret: v.string(), ownerId: v.string() },
  handler: async (ctx, args) => {
    assertService(args.secret);

    const rows = await ctx.db
      .query("media")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .collect();

    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: await ctx.storage.getUrl(row.storageId),
      })),
    );
  },
});

/**
 * Drop the blob and its row. Mirrors S3StorageService.deleteObject: a blob that
 * has already gone missing is not treated as a failure, because the caller is
 * usually clearing the reference users can actually see and should not be
 * blocked by storage that has drifted.
 */
export const remove = mutation({
  args: { secret: v.string(), mediaId: v.id("media") },
  handler: async (ctx, args) => {
    assertService(args.secret);

    const media = await ctx.db.get(args.mediaId);
    if (!media) return false;

    try {
      await ctx.storage.delete(media.storageId);
    } catch (error) {
      console.error("Blob already gone for media", args.mediaId, error);
    }
    await ctx.db.delete(args.mediaId);
    return true;
  },
});

/**
 * Used by the public HTTP endpoint, which has no secret to offer. It returns
 * a URL only for blobs explicitly marked public, so private uploads stay
 * behind the Express session check even though this query is world-callable.
 */
export const getPublicUrl = query({
  args: { mediaId: v.id("media") },
  handler: async (ctx, args) => {
    const media = await ctx.db.get(args.mediaId);
    if (!media || media.visibility !== "public") return null;

    return {
      url: await ctx.storage.getUrl(media.storageId),
      contentType: media.contentType,
    };
  },
});
