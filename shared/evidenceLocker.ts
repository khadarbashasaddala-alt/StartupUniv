/**
 * Filtering rules for the standalone Evidence Locker page.
 *
 * Distinct from evidenceReview.ts: that file is about the verdict on a task submission
 * (PENDING/ACCEPTED/CHANGES_REQUESTED). This page has no review state at all — it is a shared
 * log of PR/CI/Doc/Demo items visible to everyone on the team, and the only thing being filtered
 * here is which type, and which person, to show.
 *
 * Who may SEE the list at all is decided server-side (isTeamMemberOrAdmin: any team member,
 * mentor, or admin) and is unchanged by any of this — these are display filters over a list the
 * viewer is already allowed to see in full.
 */

export const ALL_SUBMITTERS = "all";

export interface EvidenceLockerItem {
  type?: string | null;
  submittedBy?: string | null;
  submitterName?: string | null;
}

export interface EvidenceSubmitter {
  id: string;
  name: string;
}

/**
 * Who to offer in the "Submitted by" dropdown: people who have actually submitted something,
 * not the full team roster. Offering a member with nothing on the board would make picking their
 * name a plausible way to land on an empty list and wonder if the page is broken, rather than a
 * useful thing to click.
 *
 * If the same person's name shows up blank on one item and populated on another — the enrichment
 * step failed to resolve a user once, say — the populated one wins, so a data hiccup on a single
 * row doesn't downgrade someone to "Unknown" everywhere they appear.
 */
export function submittersOf(items: readonly EvidenceLockerItem[]): EvidenceSubmitter[] {
  const byId = new Map<string, string>();
  for (const item of items) {
    if (!item.submittedBy) continue;
    const name = item.submitterName?.trim();
    const existing = byId.get(item.submittedBy);
    if (name && (!existing || existing === "Unknown")) {
      byId.set(item.submittedBy, name);
    } else if (!existing) {
      byId.set(item.submittedBy, "Unknown");
    }
  }
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/** Both filters at once: type first (cheaper, and "all" is the common case), then submitter. */
export function matchesEvidenceLockerFilter(
  item: EvidenceLockerItem,
  activeTab: string,
  submitterId: string
): boolean {
  if (activeTab !== "all" && item.type !== activeTab) return false;
  if (submitterId !== ALL_SUBMITTERS && item.submittedBy !== submitterId) return false;
  return true;
}
