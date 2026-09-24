/**
 * Browser side of Convex file/image/video storage.
 *
 * The file bytes go straight from the browser to Convex and never touch our
 * Express server -- it only hands out the one-shot upload URL and records the
 * result against the session user. That is what keeps large video uploads off
 * the API process.
 *
 *   const media = await uploadMedia(file, { context: `ticket:${ticketId}` });
 *   // store media.mediaId on the relational row
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
  /** Short-lived URL for the bytes; re-fetch the record rather than caching it. */
  url: string | null;
}

export interface UploadResult {
  mediaId: string;
  /** Durable URL, set only for uploads marked public. */
  publicUrl: string | null;
}

export interface UploadOptions {
  /**
   * Ties the upload to a relational row, e.g. `ticket:${id}`. Lets the row's
   * attachments be listed or purged as a group later.
   */
  context?: string;
  /**
   * "public" media is servable directly from the Convex HTTP endpoint (use for
   * avatars and landing imagery). The default "private" is only readable
   * through the API, which re-checks the session on every request.
   */
  visibility?: "public" | "private";
  /** Overrides the file's own name as recorded. */
  fileName?: string;
}

async function asError(response: Response, fallback: string): Promise<Error> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text);
    return new Error(body.error || body.message || fallback);
  } catch {
    return new Error(text || fallback);
  }
}

/**
 * Upload a file, image or video. Three round trips: ask for a URL, send the
 * bytes to Convex, then record what was stored.
 */
export async function uploadMedia(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const urlResponse = await fetch("/api/media/upload-url", {
    method: "POST",
    credentials: "include",
  });
  if (!urlResponse.ok) {
    throw await asError(urlResponse, "Could not start upload");
  }
  const { uploadUrl } = (await urlResponse.json()) as { uploadUrl: string };

  // Convex reads the type from this header and stores it alongside the blob,
  // which is what the server later reads back instead of trusting the client.
  const storeResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!storeResponse.ok) {
    throw await asError(storeResponse, "Upload failed");
  }
  const { storageId } = (await storeResponse.json()) as { storageId: string };

  const recordResponse = await fetch("/api/media", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storageId,
      originalName: options.fileName ?? file.name,
      contentType: file.type || "application/octet-stream",
      context: options.context,
      visibility: options.visibility ?? "private",
    }),
  });
  if (!recordResponse.ok) {
    throw await asError(recordResponse, "Could not record upload");
  }

  return (await recordResponse.json()) as UploadResult;
}

/** Metadata plus a short-lived URL for the bytes. */
export async function getMedia(mediaId: string): Promise<MediaRecord> {
  const response = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw await asError(response, "Could not fetch media");
  }
  return (await response.json()) as MediaRecord;
}

/** Everything attached to one relational row, e.g. `ticket:${id}`. */
export async function listMediaByContext(
  context: string,
): Promise<MediaRecord[]> {
  const response = await fetch(
    `/api/media/context/${encodeURIComponent(context)}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw await asError(response, "Could not list media");
  }
  return (await response.json()) as MediaRecord[];
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const response = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    throw await asError(response, "Could not delete media");
  }
}

/**
 * src for an img or video tag showing private media. Goes through the API so
 * the session is checked; public media should use the publicUrl returned by
 * uploadMedia instead, which is served by Convex directly and supports the
 * range requests a video player needs to seek.
 */
export function mediaContentUrl(mediaId: string): string {
  return `/api/media/${encodeURIComponent(mediaId)}/content`;
}
