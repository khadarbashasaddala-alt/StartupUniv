/**
 * Evidence review rules, shared by the client and the server.
 *
 * Review used to live on the task: one `reviewerId` and one `reviewComment` for everyone
 * assigned to it. That cannot express the ordinary case — a task shared by three people where
 * two submissions are fine and one needs more work. So each submission now carries its own
 * verdict, and the task's own state is derived from them.
 */

export const EVIDENCE_STATUSES = ["PENDING", "ACCEPTED", "CHANGES_REQUESTED"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const MENTOR_KINDS = ["ACADEMIC", "INDUSTRY"] as const;
export type MentorKind = (typeof MENTOR_KINDS)[number];

export function isEvidenceStatus(value: unknown): value is EvidenceStatus {
  return typeof value === "string" && (EVIDENCE_STATUSES as readonly string[]).includes(value);
}

export function isMentorKind(value: unknown): value is MentorKind {
  return typeof value === "string" && (MENTOR_KINDS as readonly string[]).includes(value);
}

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  PENDING: "Awaiting review",
  ACCEPTED: "Accepted",
  CHANGES_REQUESTED: "Changes requested",
};

export const MENTOR_KIND_LABELS: Record<MentorKind, string> = {
  ACADEMIC: "Academic mentor",
  INDUSTRY: "Industry mentor",
};

/**
 * Asking for changes without saying what is wrong leaves the learner guessing, so feedback is
 * required in that direction only — an acceptance speaks for itself.
 */
export const MIN_FEEDBACK_LENGTH = 3;

export function reviewInputError(
  status: unknown,
  feedback: unknown
): string | null {
  if (!isEvidenceStatus(status)) {
    return "Review status must be ACCEPTED or CHANGES_REQUESTED";
  }
  if (status === "PENDING") {
    return "A review cannot set evidence back to pending";
  }
  if (status === "CHANGES_REQUESTED") {
    const text = typeof feedback === "string" ? feedback.trim() : "";
    if (text.length < MIN_FEEDBACK_LENGTH) {
      return "Say what needs changing so the learner knows what to fix";
    }
  }
  return null;
}

export interface TaskEvidenceSummary {
  total: number;
  accepted: number;
  pending: number;
  changesRequested: number;
  /** Every submission reviewed and accepted — the task may be completed. */
  allAccepted: boolean;
}

/**
 * The newest submission from each person, which is the only one that still counts.
 *
 * Resubmitting after a review adds a row rather than editing the old one — deliberately, so the
 * history survives. But that means a task accumulates superseded submissions, and requiring
 * every row to be accepted made a resubmission impossible to clear: the reviewer would have had
 * to also accept the outdated attempt they had just rejected, or the task could never be
 * completed. Only the latest attempt per person is judged.
 *
 * Rows with no submitter are kept as-is: they cannot be grouped, and dropping them would let a
 * task complete with unreviewed evidence attached.
 */
export function latestPerSubmitter<T extends { submittedBy?: string | null; createdAt?: unknown }>(
  items: readonly T[]
): T[] {
  const newest = new Map<string, T>();
  const ungrouped: T[] = [];

  for (const item of items) {
    if (!item.submittedBy) {
      ungrouped.push(item);
      continue;
    }
    const held = newest.get(item.submittedBy);
    if (!held) {
      newest.set(item.submittedBy, item);
      continue;
    }
    // Undated rows lose to dated ones; between two undated the later in the list wins.
    const a = new Date(String(item.createdAt ?? 0)).getTime() || 0;
    const b = new Date(String(held.createdAt ?? 0)).getTime() || 0;
    if (a >= b) newest.set(item.submittedBy, item);
  }

  return [...newest.values(), ...ungrouped];
}

export function summariseEvidence(
  items: readonly { status?: string | null }[]
): TaskEvidenceSummary {
  const count = (s: EvidenceStatus) =>
    items.filter((e) => (e.status ?? "PENDING") === s).length;

  const accepted = count("ACCEPTED");
  return {
    total: items.length,
    accepted,
    pending: count("PENDING"),
    changesRequested: count("CHANGES_REQUESTED"),
    // An empty task has nothing to accept. Completing a task with no evidence at all stays
    // possible on purpose — that policy is unchanged here, and is a separate decision.
    allAccepted: items.length > 0 && accepted === items.length,
  };
}

/**
 * Why a task cannot be completed yet, or null when it can.
 *
 * Only bites once evidence exists. A task nobody submitted evidence for behaves exactly as it
 * did before, so this cannot retroactively block work already in flight.
 */
export function completionBlockedReason(
  items: readonly {
    status?: string | null;
    submittedBy?: string | null;
    createdAt?: unknown;
  }[]
): string | null {
  // Judge the latest attempt per person, not every row ever submitted.
  const s = summariseEvidence(latestPerSubmitter(items));
  if (s.total === 0) return null;
  if (s.allAccepted) return null;

  const parts: string[] = [];
  if (s.pending > 0) parts.push(`${s.pending} still awaiting review`);
  if (s.changesRequested > 0) parts.push(`${s.changesRequested} with changes requested`);
  return `${s.accepted} of ${s.total} submissions accepted — ${parts.join(", ")}.`;
}

/**
 * Whether this mentor is the one the task is primarily waiting on.
 *
 * Advisory, NOT a permission. Any mentor on the team may review any submission on it — an
 * academic mentor is not blocked from a task marked INDUSTRY. Gating on the kind meant work
 * sat unreviewed whenever the named kind was away or simply absent from a team, and the person
 * best placed to look at it was refused. The kind is surfaced instead, so the intended reviewer
 * can find their own work first without anybody else being locked out.
 */
export function isPreferredReviewer(
  requiresReviewFrom: string | null | undefined,
  mentorKind: string | null | undefined
): boolean {
  if (!requiresReviewFrom) return true;
  if (!mentorKind) return false;
  return requiresReviewFrom === mentorKind;
}
