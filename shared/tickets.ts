/**
 * Ticket domain rules shared by the client and server.
 *
 * The escalation chain is defined over the built-in roles seeded into the `roles`
 * table. There is no TRAINER role in this system, so a ticket raised by a learner
 * escalates LEARNER -> COFOUNDER -> FOUNDER -> MENTOR -> ADMIN. Roles added at
 * runtime are not part of the chain, since escalation order is defined here in code.
 */

import { isAllowedUpload, sanitizeFileName } from "./chat";

export const TICKET_PRIORITIES = ["HOT", "WARM", "COLD"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = ["OPEN", "CLOSED", "REOPENED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = [
  "TECHNICAL",
  "FINANCE",
  "MENTORSHIP",
  "INFRASTRUCTURE",
  "OTHER",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Ordered low -> high. Index doubles as the ticket's escalationLevel. */
export const ESCALATION_CHAIN = [
  "LEARNER",
  "COFOUNDER",
  "FOUNDER",
  "MENTOR",
  "ADMIN",
] as const;
export type EscalationRole = (typeof ESCALATION_CHAIN)[number];

/** Roles outside the chain (UNIVERSITY, CORPORATE, MANAGER) sit at the bottom. */
export function escalationLevelForRole(role: string | null | undefined): number {
  const index = ESCALATION_CHAIN.indexOf(role as EscalationRole);
  return index === -1 ? 0 : index;
}

/** The next role up, or null when already at the top (ADMIN). */
export function nextEscalationRole(role: string | null | undefined): EscalationRole | null {
  const index = ESCALATION_CHAIN.indexOf(role as EscalationRole);
  if (index === -1) return ESCALATION_CHAIN[1];
  if (index >= ESCALATION_CHAIN.length - 1) return null;
  return ESCALATION_CHAIN[index + 1];
}

export function canEscalateFrom(role: string | null | undefined): boolean {
  return nextEscalationRole(role) !== null;
}

/**
 * Which kind of mentor a custom tag marks. The admin classifies mentors with the
 * free-text custom tag ("Academic Mentor" / "Industry Mentor"), so matching is
 * case-insensitive and tolerant of the "acadamic" spelling that is already live.
 * Drives the academic-mentor gate: a learner's ticket aimed at an industry mentor
 * is held by the team's academic mentor first.
 */
export function mentorKindFromTag(
  tag: string | null | undefined
): "ACADEMIC" | "INDUSTRY" | null {
  if (!tag) return null;
  const t = tag.toLowerCase();
  if (/acad[ae]mic/.test(t)) return "ACADEMIC";
  if (t.includes("industry")) return "INDUSTRY";
  return null;
}

/** What the learner is told when their ticket is held by the academic mentor first. */
export function heldForForwardMessage(academicName: string, industryName: string): string {
  return (
    `Your ticket has been sent to your Academic Mentor (${academicName}) first. ` +
    `If needed, it will be forwarded to your Industry Mentor (${industryName}).`
  );
}

/**
 * How long a ticket may sit before it auto-escalates. This is what gives the
 * priority levels teeth — without it HOT is just a coloured label.
 */
export const SLA_HOURS: Record<TicketPriority, number> = {
  HOT: 24,
  WARM: 72,
  COLD: 168,
};

export function slaDueDateFrom(priority: TicketPriority, from: Date): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000);
}

export const ATTACHMENT_MAX_FILES = 10;
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * @deprecated Kept only so nothing that still imports it breaks. This was a
 * blocklist, which let through everything not named — including `svg`, `html`
 * and `htm`, all of which execute script when a browser renders them.
 * Ticket attachments now use the same allowlist as chat.
 */
export const ATTACHMENT_BLOCKED_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "cpl", "dll", "jar", "js", "jse",
  "msi", "ps1", "scr", "sh", "vb", "vbs", "wsf",
];

/**
 * Ticket attachments share chat's allowlist rather than keeping a second,
 * weaker list. Two lists in one codebase drift, and this one already had.
 */
export function isAllowedAttachment(
  fileName: string,
  contentType?: string | null
): boolean {
  return isAllowedUpload(fileName, contentType);
}

export { sanitizeFileName };

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  TECHNICAL: "Technical",
  FINANCE: "Finance",
  MENTORSHIP: "Mentorship",
  INFRASTRUCTURE: "Infrastructure",
  OTHER: "Other",
};

/** Extracts @mentioned user ids embedded as `@[Name](userId)` in comment text. */
export function extractMentionIds(body: string): string[] {
  const ids = new Set<string>();
  const pattern = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}
