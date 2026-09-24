/**
 * Team chat domain rules shared by the client, the REST routes and the
 * WebSocket server.
 */

export const CHAT_MESSAGE_TYPES = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "FILE",
  "STICKER",
  "SYSTEM",
] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

/** WebSocket path. Kept distinct from Vite's own HMR socket. */
export const CHAT_WS_PATH = "/ws/team-chat";

// --- limits -----------------------------------------------------------------

export const MESSAGE_MAX_LENGTH = 4000;
export const HISTORY_PAGE_SIZE = 50;

export const ATTACHMENT_MAX_FILES = 10;

/**
 * Per-kind size caps. Video is capped by SIZE rather than duration: duration
 * cannot be verified from an upload without decoding the file, and a
 * browser-side check is trivially bypassed by posting straight to the presigned
 * S3 URL. 100 MB comfortably covers ~3 minutes of phone video.
 */
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const FILE_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Advisory only — enforced in the browser to warn before a long upload. */
export const VIDEO_MAX_DURATION_SECONDS = 180;

export const IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

export const VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/3gpp",
];

export const DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
];

/**
 * Device sticker keyboards insert webp/png images. Those are stored as STICKER
 * so they render borderless and transparent instead of as a file card.
 */
export const STICKER_CONTENT_TYPES = ["image/webp", "image/png", "image/gif"];

/**
 * Allowlist, not a blocklist: anything not named here is rejected. Notably
 * absent are svg and html, which execute script when rendered \u2014 attachments are
 * served from presigned S3 URLs, which would make them a hosted-phishing vector.
 */
export const ALLOWED_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "webp", "heic", "heif",
  "mp4", "mov", "webm", "mkv", "3gp",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "zip",
];

export const ALLOWED_CONTENT_TYPES = [
  ...IMAGE_CONTENT_TYPES,
  ...VIDEO_CONTENT_TYPES,
  ...DOCUMENT_CONTENT_TYPES,
];

/** Segments that must never appear anywhere in a name, even as inner extensions. */
const DANGEROUS_SEGMENTS = [
  "exe", "bat", "cmd", "com", "cpl", "dll", "jar", "js", "jse", "msi",
  "ps1", "scr", "vb", "vbs", "wsf", "sh", "bash",
  "html", "htm", "xhtml", "hta", "svg", "lnk", "reg", "py", "php",
];

/**
 * Reduces a client-supplied name to a safe basename so it cannot escape its S3
 * key prefix, and strips control characters and leading dots.
 */
export function sanitizeFileName(fileName: string): string {
  const basename = String(fileName).split(/[\\/]/).pop() ?? "";
  const cleaned = basename
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.slice(0, 200);
}

/**
 * Extension and declared content type must both be on the allowlist. The
 * extension alone is not enough (`payload.exe.png` passes it); the content type
 * alone is client-controlled.
 */
export function isAllowedUpload(fileName: string, contentType?: string | null): boolean {
  const parts = sanitizeFileName(fileName).split(".");
  if (parts.length < 2) return false;

  const ext = parts.pop()!.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false;
  if (parts.some((part) => DANGEROUS_SEGMENTS.includes(part.toLowerCase()))) return false;

  if (contentType != null && contentType !== "") {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase())) return false;
  }
  return true;
}

export function messageTypeForContentType(
  contentType: string | null | undefined,
  isSticker = false
): ChatMessageType {
  const type = (contentType ?? "").toLowerCase();
  if (isSticker && STICKER_CONTENT_TYPES.includes(type)) return "STICKER";
  if (IMAGE_CONTENT_TYPES.includes(type)) return "IMAGE";
  if (VIDEO_CONTENT_TYPES.includes(type)) return "VIDEO";
  return "FILE";
}

export function maxBytesForContentType(contentType: string | null | undefined): number {
  const type = (contentType ?? "").toLowerCase();
  if (IMAGE_CONTENT_TYPES.includes(type)) return IMAGE_MAX_BYTES;
  if (VIDEO_CONTENT_TYPES.includes(type)) return VIDEO_MAX_BYTES;
  return FILE_MAX_BYTES;
}

// --- mentions ---------------------------------------------------------------

/**
 * Mentions are stored inline as `@[Display Name](userId)` so the text survives
 * renames and can be rendered without a lookup table.
 */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  const pattern = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

export interface MentionSegment {
  type: "text" | "mention";
  value: string;
  userId?: string;
}

/** Splits a body into plain text and mention segments for rendering. */
export function parseMentions(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const pattern = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", value: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  return segments;
}

// --- websocket protocol -----------------------------------------------------

export type ChatServerEvent =
  | { type: "ready"; userId: string; channelIds: string[] }
  | { type: "message:new"; channelId: string; message: any }
  | { type: "message:edited"; channelId: string; message: any }
  | { type: "message:deleted"; channelId: string; messageId: string; forEveryone: boolean }
  | { type: "reaction:changed"; channelId: string; messageId: string; reactions: any[] }
  | { type: "typing"; channelId: string; userId: string; userName: string }
  | { type: "presence"; channelId: string; onlineUserIds: string[] }
  | { type: "read"; channelId: string; userId: string; lastReadAt: string }
  | { type: "error"; message: string };

export type ChatClientEvent =
  | { type: "subscribe"; channelId: string }
  | { type: "unsubscribe"; channelId: string }
  | { type: "typing"; channelId: string }
  | { type: "ping" };

/** Reaction emoji offered in the quick picker; any emoji can still be sent. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
