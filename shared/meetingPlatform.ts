/**
 * Where a team meeting actually happens.
 *
 * Meetings used to be Google Meet and nothing else: the portal created a Calendar event with a
 * conferenceData request and kept whatever link Google returned. That covers a mentor who runs
 * sessions on Meet, and nobody else — and Meet only records on paid Workspace tiers, so a mentor
 * wanting a recording generally runs the session on Zoom instead and had nowhere to put the link.
 *
 * So the platform is now a choice. GOOGLE_MEET keeps the existing sequence exactly; OTHER takes
 * a link the mentor supplies.
 */

export const MEETING_PLATFORMS = ["GOOGLE_MEET", "OTHER"] as const;
export type MeetingPlatform = (typeof MEETING_PLATFORMS)[number];

export const DEFAULT_MEETING_PLATFORM: MeetingPlatform = "GOOGLE_MEET";

/** Long enough for the query-heavy join URLs Teams and Webex produce. */
export const MEETING_LINK_MAX_LENGTH = 2000;

export function isMeetingPlatform(value: unknown): value is MeetingPlatform {
  return typeof value === "string" && (MEETING_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Stored as text with a default rather than a pgEnum. Adding a value to a Postgres enum needs
 * ALTER TYPE ... ADD VALUE, which cannot run inside a transaction and so cannot go in the same
 * migration as everything else — the same reasoning that moved `tracks` to text.
 */
export function normaliseMeetingPlatform(value: unknown): MeetingPlatform {
  return isMeetingPlatform(value) ? value : DEFAULT_MEETING_PLATFORM;
}

/**
 * Validates a mentor-supplied join link. Returns null when it is acceptable.
 *
 * The scheme check is the part that matters. This link is handed to window.open() when a learner
 * clicks Join, and it is also placed in a Google Calendar invite that gets emailed to the whole
 * team — so "javascript:", "data:" and "file:" are refused outright rather than trusted to be
 * inert. Only http and https are allowed through.
 */
export function meetingLinkError(
  platform: MeetingPlatform,
  link: string | null | undefined
): string | null {
  const value = (link ?? "").trim();

  if (platform === "GOOGLE_MEET") {
    // Google supplies it; nothing to validate. A link sent alongside GOOGLE_MEET is ignored
    // rather than rejected, so an older client that always posts the field still works.
    return null;
  }

  if (!value) return "Paste the link learners should join.";
  if (value.length > MEETING_LINK_MAX_LENGTH) {
    return `That link is too long (limit ${MEETING_LINK_MAX_LENGTH} characters).`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "That does not look like a link. It should start with https://";
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return "The link must start with https://";
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    return "That link has no website address in it.";
  }

  return null;
}

/** Hosts worth naming on the card. Anything else falls back to its own domain. */
const KNOWN_HOSTS: ReadonlyArray<{ match: RegExp; label: string }> = [
  { match: /(^|\.)zoom\.us$/i, label: "Zoom" },
  { match: /(^|\.)zoom\.com$/i, label: "Zoom" },
  { match: /(^|\.)teams\.microsoft\.com$/i, label: "Microsoft Teams" },
  { match: /(^|\.)teams\.live\.com$/i, label: "Microsoft Teams" },
  { match: /(^|\.)meet\.google\.com$/i, label: "Google Meet" },
  { match: /(^|\.)webex\.com$/i, label: "Webex" },
  { match: /(^|\.)gotomeeting\.com$/i, label: "GoTo Meeting" },
  { match: /(^|\.)skype\.com$/i, label: "Skype" },
  { match: /(^|\.)whereby\.com$/i, label: "Whereby" },
  { match: /(^|\.)meet\.jit\.si$/i, label: "Jitsi" },
];

/**
 * What to call the meeting on screen.
 *
 * Named from the link rather than from the stored platform, because "Other" is not something to
 * show a learner — they want to know whether they are opening Zoom or Teams. The stored value
 * decides behaviour; this decides wording.
 */
export function meetingPlatformLabel(
  platform: MeetingPlatform,
  link?: string | null
): string {
  if (platform === "GOOGLE_MEET") return "Google Meet";

  const value = (link ?? "").trim();
  if (!value) return "External meeting";

  try {
    const host = new URL(value).hostname;
    const known = KNOWN_HOSTS.find((entry) => entry.match.test(host));
    if (known) return known.label;
    return host.replace(/^www\./i, "");
  } catch {
    return "External meeting";
  }
}

/**
 * Whether the portal should ask Google to mint a Meet link for this meeting.
 *
 * A calendar invite is still created for an OTHER meeting — learners get the same entry and
 * reminder they always have — it just carries the mentor's link instead of a generated one.
 */
export function shouldCreateGoogleMeetLink(platform: MeetingPlatform): boolean {
  return platform === "GOOGLE_MEET";
}
