/**
 * Session recordings attached to a team meeting.
 *
 * A mentor holds the session on Zoom/Meet, then attaches the recording here; everyone on that
 * team can watch it, and admins can watch any team's.
 *
 * The transport is the one team chat already proves in production: the browser PUTs straight to
 * S3 against a presigned URL, and the server only ever stores the object key. No video byte
 * passes through the container — which matters, because it runs on a t3a.small whose 30GB root
 * volume has already filled once and broken a deploy.
 *
 * Chat's limits could not simply be reused. They are sized for a 3-minute clip — 100MB, plus an
 * advisory 180-second duration warning — and an hour of screen-shared session is 300MB to 1GB.
 */

/**
 * 2GB. Generous on purpose: the failure this avoids is a mentor's recording being rejected
 * after they waited for the upload, which teaches them not to bother again. A single presigned
 * PUT can carry 5GB, so this is well inside what the transport allows.
 */
export const RECORDING_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * mp4 and webm only — deliberately narrower than chat's video list, which also takes mov, mkv
 * and 3gp. Those upload perfectly well and then refuse to play: no browser plays matroska, and
 * mov depends on which codec is inside the container. A recording that uploads and then will
 * not play looks like a broken feature and costs the mentor the whole upload, so it is refused
 * at the file picker instead. Zoom, Meet and Teams all export mp4.
 */
export const RECORDING_CONTENT_TYPES = ["video/mp4", "video/webm"] as const;
export const RECORDING_EXTENSIONS = ["mp4", "webm"] as const;

/**
 * Two hours for the upload URL. 500MB on a 5 Mbps upstream is about 13 minutes and a 1GB file
 * nearer 27, so the 15 minutes used for document attachments is not enough headroom. S3 checks
 * expiry when the request arrives rather than while it streams, so this mainly buys room for a
 * retry after a dropped connection — a single PUT cannot resume, it starts again from zero.
 */
export const RECORDING_UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

/**
 * Four hours for playback. The default hour is fine for a 3-minute chat clip and wrong for a
 * 90-minute session: the URL would expire mid-watch, and seeking after that point fails with
 * AccessDenied. Cannot be raised indefinitely — the container signs with instance-role
 * credentials from IMDS, and a presigned URL dies when the credentials that signed it do.
 * The player also re-requests a URL on error, which covers the case where it still runs out.
 */
export const RECORDING_VIEW_URL_TTL_SECONDS = 4 * 60 * 60;

export interface MeetingRecording {
  recordingObjectKey?: string | null;
  recordingFileName?: string | null;
  recordingSizeBytes?: number | string | null;
  recordingContentType?: string | null;
  recordingDurationSeconds?: number | null;
  recordingUploadedBy?: string | null;
  recordingUploadedAt?: Date | string | null;
}

/** Who is asking, from the point of view of one meeting's team. */
export interface RecordingViewer {
  userId?: string | null;
  /** Platform role: ADMIN, MENTOR, FOUNDER, COFOUNDER, LEARNER... */
  role?: string | null;
  /** Whether they hold a role assignment on the team that owns the meeting. */
  isTeamMember?: boolean;
}

export function hasRecording(meeting: MeetingRecording | null | undefined): boolean {
  return Boolean(meeting?.recordingObjectKey);
}

/**
 * Uploading is for the mentors running the sessions, plus admins. Learners are viewers: a
 * recording is the record of what a mentor taught, and letting anyone replace it would make it
 * unclear whose session is on the page.
 *
 * Note this is stricter than the MoM document beside it, which any team member can overwrite.
 */
export function canUploadRecording(viewer: RecordingViewer): boolean {
  const role = (viewer.role ?? "").toUpperCase();
  if (role === "ADMIN") return true;
  return role === "MENTOR" && viewer.isTeamMember === true;
}

/** Everyone on the team, and admins — the point of the feature is that the team can watch. */
export function canViewRecording(viewer: RecordingViewer): boolean {
  const role = (viewer.role ?? "").toUpperCase();
  return role === "ADMIN" || viewer.isTeamMember === true;
}

/**
 * Removing a recording is limited to admins and whoever uploaded it. One mentor should not be
 * able to delete another's session, and the file is unrecoverable once gone.
 */
export function canDeleteRecording(
  viewer: RecordingViewer,
  meeting: MeetingRecording | null | undefined
): boolean {
  if ((viewer.role ?? "").toUpperCase() === "ADMIN") return true;
  if (!canUploadRecording(viewer)) return false;
  return Boolean(viewer.userId) && viewer.userId === meeting?.recordingUploadedBy;
}

function extensionOf(fileName: string): string {
  const parts = String(fileName).split(".");
  return parts.length < 2 ? "" : parts.pop()!.toLowerCase();
}

/**
 * The single validation both sides call, so the message a mentor sees in the picker is the same
 * one the server would have replied with. Returns null when the file is acceptable.
 *
 * Extension and declared content type are both checked, following the same reasoning as
 * shared/chat.ts: the extension alone lets "payload.exe.mp4" through, and the content type
 * alone is whatever the client chose to send.
 */
export function recordingFileError(
  fileName: string | null | undefined,
  contentType: string | null | undefined,
  fileSize: number | null | undefined
): string | null {
  if (!fileName || !String(fileName).trim()) return "Choose a file to upload.";

  const ext = extensionOf(fileName);
  if (!ext || !(RECORDING_EXTENSIONS as readonly string[]).includes(ext)) {
    return "Recordings must be MP4 or WebM. Other formats will not play in the browser.";
  }

  const type = (contentType ?? "").toLowerCase();
  if (type && !(RECORDING_CONTENT_TYPES as readonly string[]).includes(type)) {
    return "Recordings must be MP4 or WebM. Other formats will not play in the browser.";
  }

  // Required rather than optional, and checked before the URL is issued: a presigned PUT
  // carries no size condition of its own, so this is the only place a cap can be applied.
  if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
    return "That file looks empty.";
  }
  if (fileSize > RECORDING_MAX_BYTES) {
    return `Recording is ${formatBytes(fileSize)} — the limit is ${formatBytes(RECORDING_MAX_BYTES)}. Record at 720p to bring the size down.`;
  }

  return null;
}

/**
 * Keyed by team and meeting rather than by upload time, so an object in the bucket can be
 * traced back to what it belongs to without a database lookup.
 */
export function recordingObjectKey(
  teamId: string,
  meetingId: string,
  fileName: string,
  uniqueId: string
): string {
  const ext = extensionOf(fileName) || "mp4";
  return `meetings/recordings/${teamId}/${meetingId}/${uniqueId}.${ext}`;
}

export function formatBytes(bytes: number | string | null | undefined): string {
  const n = typeof bytes === "string" ? Number(bytes) : bytes;
  if (n == null || !Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** "1h 04m" / "48 min" / "45s" — for a label beside the play button. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${total}s`;
}

/**
 * Percentage complete for the progress bar, clamped.
 *
 * There is a progress bar at all because every other upload in this codebase uses fetch(),
 * which cannot report upload progress. That is fine for a 200KB CV and not for a 500MB video:
 * seven silent minutes reads as a hung page, and the mentor closes the tab.
 */
export function uploadPercent(loaded: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
}
