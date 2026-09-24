import type { Express, Request, Response, RequestHandler } from "express";
import { convexStorage, mediaKindForContentType } from "./convexStorage";
import { ObjectNotFoundError } from "./s3Storage";
import type { User } from "@shared/schema";

interface ConvexMediaRouteDeps {
  requireAuth: RequestHandler;
}

const actor = (req: Request): User => (req as any).user as User;

/**
 * Only the uploader and admins can reach a private blob. Anything needing a
 * wider rule (a whole team seeing a team upload, say) should pass a `context`
 * at upload time and get its own route that resolves that context -- rather
 * than loosening this one.
 */
function canAccess(user: User, ownerId: string): boolean {
  return user.id === ownerId || (user as any).role === "ADMIN";
}

/**
 * Upload, fetch and delete files, images and videos held in Convex.
 *
 * The bytes never pass through this process: the browser asks here for a
 * one-shot upload URL, POSTs the file straight to Convex, then reports the
 * resulting storageId back here so it can be recorded against the session
 * user. That is what makes large video uploads viable -- Express only ever
 * handles the small JSON either side of the transfer.
 */
export function registerConvexMediaRoutes(
  app: Express,
  deps: ConvexMediaRouteDeps,
) {
  const { requireAuth } = deps;

  /** Step 1 of an upload. */
  app.post("/api/media/upload-url", requireAuth, async (_req, res) => {
    try {
      const uploadUrl = await convexStorage.getUploadUrl();
      res.json({ uploadUrl });
    } catch (error) {
      console.error("Error creating Convex upload URL:", error);
      res.status(500).json({ error: "Could not start upload" });
    }
  });

  /**
   * Step 3 of an upload: record the blob the browser just stored.
   *
   * The owner is taken from the session, never from the body, so a caller
   * cannot file an upload under somebody else's name. Size and content type
   * are read back from Convex inside recordUpload for the same reason.
   */
  app.post("/api/media", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const { storageId, originalName, contentType, context, visibility } =
        req.body ?? {};

      if (typeof storageId !== "string" || !storageId) {
        return res.status(400).json({ error: "storageId is required" });
      }
      if (typeof originalName !== "string" || !originalName) {
        return res.status(400).json({ error: "originalName is required" });
      }
      if (visibility !== undefined && visibility !== "public" && visibility !== "private") {
        return res
          .status(400)
          .json({ error: "visibility must be 'public' or 'private'" });
      }

      const mediaId = await convexStorage.recordUpload({
        storageId,
        originalName,
        ownerId: user.id,
        kind: mediaKindForContentType(
          typeof contentType === "string" ? contentType : "application/octet-stream",
        ),
        contentType: typeof contentType === "string" ? contentType : undefined,
        context: typeof context === "string" ? context : undefined,
        visibility: visibility === "public" ? "public" : "private",
      });

      res.status(201).json({
        mediaId,
        // Only public media has a durable URL; private media is read through
        // /api/media/:id/content, which re-checks the session every time.
        publicUrl:
          visibility === "public" ? convexStorage.publicUrl(mediaId) : null,
      });
    } catch (error) {
      console.error("Error recording Convex upload:", error);
      res.status(500).json({ error: "Could not record upload" });
    }
  });

  /** Metadata plus a short-lived URL for the bytes. */
  app.get("/api/media/:id", requireAuth, async (req, res) => {
    try {
      const media = await convexStorage.getMedia(req.params.id);
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      if (media.visibility === "private" && !canAccess(actor(req), media.ownerId)) {
        return res.status(403).json({ error: "Not allowed" });
      }
      res.json(media);
    } catch (error) {
      console.error("Error fetching Convex media:", req.params.id, error);
      res.status(500).json({ error: "Could not fetch media" });
    }
  });

  /**
   * The bytes themselves, streamed through this process after the session
   * check. Public media should use convexStorage.publicUrl instead -- that
   * skips Express entirely and supports range requests, which is what lets a
   * browser seek inside a video.
   */
  app.get("/api/media/:id/content", requireAuth, async (req, res) => {
    try {
      const media = await convexStorage.getMedia(req.params.id);
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      if (media.visibility === "private" && !canAccess(actor(req), media.ownerId)) {
        return res.status(403).json({ error: "Not allowed" });
      }

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(media.originalName)}"`,
      );
      await convexStorage.downloadObject(req.params.id, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Media not found" });
      }
      console.error("Error streaming Convex media:", req.params.id, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Could not download media" });
      }
    }
  });

  /** Everything the signed-in user has uploaded. */
  app.get("/api/media", requireAuth, async (req, res) => {
    try {
      res.json(await convexStorage.listByOwner(actor(req).id));
    } catch (error) {
      console.error("Error listing Convex media:", error);
      res.status(500).json({ error: "Could not list media" });
    }
  });

  /**
   * Everything attached to one relational row, e.g. context "ticket:<uuid>".
   * Private rows the caller cannot read are filtered out rather than turning
   * the whole request into a 403, so a shared context still lists what the
   * caller is entitled to see.
   */
  app.get("/api/media/context/:context", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const rows = await convexStorage.listByContext(req.params.context);
      res.json(
        rows.filter(
          (row) => row.visibility === "public" || canAccess(user, row.ownerId),
        ),
      );
    } catch (error) {
      console.error("Error listing Convex media by context:", error);
      res.status(500).json({ error: "Could not list media" });
    }
  });

  app.delete("/api/media/:id", requireAuth, async (req, res) => {
    try {
      const media = await convexStorage.getMedia(req.params.id);
      if (!media) {
        return res.status(404).json({ error: "Media not found" });
      }
      if (!canAccess(actor(req), media.ownerId)) {
        return res.status(403).json({ error: "Not allowed" });
      }

      await convexStorage.deleteMedia(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting Convex media:", req.params.id, error);
      res.status(500).json({ error: "Could not delete media" });
    }
  });
}
