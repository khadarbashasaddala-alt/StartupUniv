/**
 * Turning a task's assignee ids into people, from a team roster.
 *
 * Pure on purpose. The sprint board used to do this inline against the roster from
 * `GET /api/my-team` — the *viewer's* team. An admin is not on a team, so that payload is
 * `null`: every lookup found nobody, avatars disappeared from the cards, and the task details
 * dialog reported "Not assigned" no matter how the task was actually assigned. A mentor looking
 * at a team other than their own hit the same thing.
 *
 * The two roster payloads in play key the user differently — `allMembers` uses `userId`,
 * `my-team`'s `members` uses `id` — and that mismatch is why the original lookup failed
 * silently instead of loudly. Normalising both here is the point of this module.
 */

export interface RosterMember {
  id: string;
  name: string;
}

/** Anything with a user id under either of the two names the API uses. */
type RosterLike = {
  userId?: string | null;
  id?: string | null;
  name?: string | null;
};

/**
 * Flattens roster payloads into one id→person index.
 *
 * Earlier sources win, so pass the board's own team first and any fallback after.
 */
export function buildRoster(...sources: (readonly RosterLike[] | null | undefined)[]) {
  const byId = new Map<string, RosterMember>();
  for (const source of sources) {
    for (const member of source ?? []) {
      const id = member.userId ?? member.id;
      if (id == null) continue;
      const key = String(id);
      if (byId.has(key)) continue; // first source wins
      byId.set(key, { id: key, name: member.name ?? "Unknown" });
    }
  }
  return byId;
}

/** The ids a task is assigned to, preferring the multi-assignee field. */
export function assigneeIdsOf(task: {
  assigneeId?: string | null;
  assigneeIds?: readonly (string | null)[] | null;
}): string[] {
  if (task.assigneeIds && task.assigneeIds.length > 0) {
    return task.assigneeIds.filter((id): id is string => id != null).map(String);
  }
  return task.assigneeId ? [String(task.assigneeId)] : [];
}

/**
 * The people a task is assigned to.
 *
 * An id with nobody in the roster is dropped rather than rendered as a blank chip — that
 * happens legitimately when somebody has left the team but the task still names them.
 */
export function resolveAssignees(
  task: { assigneeId?: string | null; assigneeIds?: readonly (string | null)[] | null },
  roster: Map<string, RosterMember>
): RosterMember[] {
  return assigneeIdsOf(task)
    .map((id) => roster.get(id))
    .filter((m): m is RosterMember => Boolean(m));
}
