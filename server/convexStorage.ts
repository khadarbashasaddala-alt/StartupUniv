import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import type { Response as ExpressResponse } from "express";
import { Readable } from "stream";
import { ObjectNotFoundError } from "./s3Storage";

/**
 * File, image and video storage backed by Convex.
 *
 * Deliberately shaped like S3StorageService so the two can sit side by side and
 * a feature can be moved across one call site at a time. The difference worth
 * knowing: S3 addresses a blob by object key, Convex addresses it by a mediaId
 * row that also carries owner, context and visibility -- so there is no separate
 * metadata table to keep in step.
 *
 * Upload is a three-step handshake, because the bytes never pass through this
 * process:
 *   1. getUploadUrl()                  -> one-shot URL
 *   2. browser POSTs the file to it    -> { storageId }
 *   3. recordUpload({ storageId, .. }) -> mediaId
 *
 * Note on generated types: the typed `api` object under convex/_generated only
 * exists after `npx convex dev` has run against the deployment, and that needs
 * an interactive login. `anyApi` gives the same function references without it,
 * so the server builds on a clean checkout and in CI. Swap `anyApi` for the
 * generated `api` once codegen has run if you want the args type-checked here.
 */

export type MediaKind = "file" | "image" | "video";

export interface MediaRecord {
  _id: string;
  storageId: string;
  kind: MediaKind;
  contentType: string;
  size: number;
  originalName: string;
  ownerId: string;
  context?: string;
  visibility: "public" | "private";
  createdAt: number;
  /** Time-limited URL for the bytes. Do not persist it; ask again when needed. */
  url: string | null;
}

/** Which bucket a MIME type falls into, for the kind column. */
export function mediaKindForContentType(contentType: string): MediaKind {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}

export class ConvexStorageService {
  private _client: ConvexHttpClient | null = null;

  /**
   * Built on first use, not in the constructor: on ECS the secrets are injected
   * after the process starts, and this module is imported at load time.
   */
  private get client(): ConvexHttpClient {
    if (!this._client) {
      const url = process.env.CONVEX_URL;
      if (!url) {
        throw new Error(
          "CONVEX_URL must be set (e.g. https://shiny-cheetah-636.eu-west-1.convex.cloud)",
        );
      }
      this._client = new ConvexHttpClient(url);
    }
    return this._client;
  }

  private get secret(): string {
    const secret = process.env.CONVEX_SERVICE_SECRET;
    if (!secret) {
      throw new Error(
        "CONVEX_SERVICE_SECRET must be set, and must match the value set on the " +
          "deployment with: npx convex env set CONVEX_SERVICE_SECRET <value>",
      );
    }
    return secret;
  }

  /** True when the deployment is configured; lets callers fall back to S3. */
  isConfigured(): boolean {
    return Boolean(process.env.CONVEX_URL && process.env.CONVEX_SERVICE_SECRET);
  }

  /** Step 1: a one-shot URL the browser POSTs the file bytes to. */
  async getUploadUrl(): Promise<string> {
    return await this.client.mutation(anyApi.media.generateUploadUrl, {
      secret: this.secret,
    });
  }

  /** Step 3: register the uploaded blob and get back the id we store in Postgres. */
  async recordUpload(params: {
    storageId: string;
    originalName: string;
    ownerId: string;
    kind?: MediaKind;
    contentType?: string;
    context?: string;
    visibility?: "public" | "private";
  }): Promise<string> {
    const kind =
      params.kind ??
      mediaKindForContentType(params.contentType ?? "application/octet-stream");

    return await this.client.mutation(anyApi.media.recordUpload, {
      secret: this.secret,
      storageId: params.storageId,
      kind,
      originalName: params.originalName,
      ownerId: params.ownerId,
      context: params.context,
      visibility: params.visibility ?? "private",
    });
  }

  async getMedia(mediaId: string): Promise<MediaRecord | null> {
    return await this.client.query(anyApi.media.get, {
      secret: this.secret,
      mediaId,
    });
  }

  /** Every blob attached to one relational row, e.g. "ticket:<uuid>". */
  async listByContext(context: string): Promise<MediaRecord[]> {
    return await this.client.query(anyApi.media.listByContext, {
      secret: this.secret,
      context,
    });
  }

  async listByOwner(ownerId: string): Promise<MediaRecord[]> {
    return await this.client.query(anyApi.media.listByOwner, {
      secret: this.secret,
      ownerId,
    });
  }

  /**
   * Remove a blob and its row. Like S3StorageService.deleteObject, a blob that
   * has already gone returns false rather than throwing, so clearing a database
   * reference is never blocked by storage that has drifted.
   */
  async deleteMedia(mediaId: string): Promise<boolean> {
    try {
      return await this.client.mutation(anyApi.media.remove, {
        secret: this.secret,
        mediaId,
      });
    } catch (error) {
      console.error("Error deleting Convex media:", mediaId, error);
      return false;
    }
  }

  /** Time-limited URL for the bytes. Throws if the media row is gone. */
  async getSignedDownloadURL(mediaId: string): Promise<string> {
    const media = await this.getMedia(mediaId);
    if (!media?.url) {
      throw new ObjectNotFoundError();
    }
    return media.url;
  }

  /**
   * Stable URL for media marked public, served by the deployment HTTP endpoint.
   * Safe to put in an img/video src or store in a column -- unlike
   * getSignedDownloadURL, this one does not expire.
   */
  publicUrl(mediaId: string): string {
    const site = process.env.CONVEX_SITE_URL;
    if (!site) {
      throw new Error(
        "CONVEX_SITE_URL must be set (e.g. https://shiny-cheetah-636.eu-west-1.convex.site)",
      );
    }
    return `${site.replace(/\/$/, "")}/media?id=${encodeURIComponent(mediaId)}`;
  }

  /** Size and content type without fetching the body; null when missing. */
  async getObjectMetadata(
    mediaId: string,
  ): Promise<{ size: number; contentType: string | null } | null> {
    try {
      const media = await this.getMedia(mediaId);
      if (!media) return null;
      return { size: media.size, contentType: media.contentType };
    } catch (error) {
      console.error("Error reading Convex media metadata:", mediaId, error);
      return null;
    }
  }

  /**
   * A readable stream of the bytes, for piping into an archive or a response
   * without buffering. Mirrors S3StorageService.getObjectStream.
   */
  async getObjectStream(mediaId: string): Promise<{
    stream: Readable;
    size: number;
    contentType: string | null;
  }> {
    const media = await this.getMedia(mediaId);
    if (!media?.url) {
      throw new ObjectNotFoundError();
    }

    const response = await fetch(media.url);
    if (!response.ok || !response.body) {
      throw new ObjectNotFoundError();
    }

    return {
      stream: Readable.fromWeb(response.body as any),
      size: media.size,
      contentType: media.contentType,
    };
  }

  /**
   * Send the bytes to an Express response. Streams rather than buffering,
   * because this path also carries meeting recordings, which are far too large
   * to hold in memory the way the S3 equivalent does.
   */
  async downloadObject(
    mediaId: string,
    res: ExpressResponse,
    cacheTtlSec: number = 3600,
  ): Promise<void> {
    try {
      const { stream, size, contentType } = await this.getObjectStream(mediaId);

      res.set({
        "Content-Type": contentType || "application/octet-stream",
        "Content-Length": size.toString(),
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      stream.pipe(res);
      stream.on("error", (error) => {
        console.error("Error streaming Convex media:", mediaId, error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error downloading file" });
        } else {
          res.end();
        }
      });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw error;
      }
      console.error("Error downloading Convex media:", mediaId, error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }
}

/** Singleton, matching the s3Storage export in server/s3.ts. */
export const convexStorage = new ConvexStorageService();
