import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex holds file/image/video blobs and the metadata describing them.
 *
 * The relational data (users, cohorts, teams, sprints, tickets...) stays in
 * Postgres under shared/schema.ts -- this schema deliberately does not
 * duplicate it. `ownerId` and `context` are plain strings holding Postgres
 * ids, so a media row can point back at whatever created it without Convex
 * needing to know the relational model.
 */
export default defineSchema({
  media: defineTable({
    // Handle to the blob in Convex file storage.
    storageId: v.id("_storage"),
    kind: v.union(v.literal("file"), v.literal("image"), v.literal("video")),
    contentType: v.string(),
    size: v.number(),
    originalName: v.string(),
    // Postgres users.id of whoever uploaded it.
    ownerId: v.string(),
    // Free-form owner reference, e.g. "evidence:<uuid>" or "ticket:<uuid>".
    // Lets a caller list or purge every blob belonging to one relational row.
    context: v.optional(v.string()),
    // "public" blobs are servable straight from the Convex HTTP endpoint (use
    // for avatars, landing imagery). "private" ones are only reachable through
    // the Express API, which checks the session first.
    visibility: v.union(v.literal("public"), v.literal("private")),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_context", ["context"])
    .index("by_storage", ["storageId"]),
});
