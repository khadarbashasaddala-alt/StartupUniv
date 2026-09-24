/**
 * Per-member task breakdown for the analytics page: who is carrying what, and what is late.
 *
 * The page previously showed team totals only — 23 tasks, 9% complete — which says nothing about
 * whether the work is spread across the team or sitting on one person. It also discarded the
 * fields needed to find out: the tasks it fetched were mapped down to id, title, status and
 * points, dropping assignees and both dates.
 */

import { isTaskOverdue } from "./sprintPhase";

/** The bucket for work nobody owns. Not a real user id, so it cannot collide with one. */
export const UNASSIGNED = "__unassigned__";

export interface AnalyticsTask {
  id: string;
  title?: string | null;
  status?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  assigneeId?: string | null;
  assigneeIds?: readonly (string | null)[] | null;
  /** User ids that have submitted evidence for this task. */
  submitters?: readonly string[] | null;
  /** User ids whose latest submission was sent back. */
  changesRequestedBy?: readonly string[] | null;
  /** Assignee id to name, so somebody no longer on the team can still be named. */
  assigneeNames?: Readonly<Record<string, string>> | null;
  points?: number | null;
  sprintId?: string | null;
}

export interface MemberTaskRow {
  id: string;
  title: string;
  status: string;
  startDate: Date | string | null;
  endDate: Date | string | null;
  submitted: boolean;
  changesRequested: boolean;
  overdue: boolean;
  /**
   * Late and nothing handed in — the case worth colouring red. Late but submitted is waiting on
   * a reviewer, which is not the assignee's problem and should not read as their failure.
   */
  lateAndUnsubmitted: boolean;
}

export interface MemberTaskStats {
  userId: string;
  name: string;
  assigned: number;
  done: number;
  outstanding: number;
  overdue: number;
  /** Points carried and earned — a 1-point task and a 5-point task are not the same load. */
  points: number;
  donePoints: number;
  /** Holds work but is no longer on the team, so their tasks need reassigning. */
  formerMember: boolean;
  tasks: MemberTaskRow[];
}

export interface MemberStatsTotals {
  members: number;
  /** Members with nothing assigned at all — collapsed in the table rather than listed. */
  idleMembers: number;
  assigned: number;
  done: number;
  outstanding: number;
  overdue: number;
  points: number;
  donePoints: number;
  unassignedTasks: number;
  formerMemberTasks: number;
}

/** Everyone a task is assigned to, preferring the multi-assignee field. */
export function assigneesOf(task: AnalyticsTask): string[] {
  if (task.assigneeIds && task.assigneeIds.length > 0) {
    return task.assigneeIds.filter((id): id is string => id != null).map(String);
  }
  return task.assigneeId ? [String(task.assigneeId)] : [];
}

function rowFor(task: AnalyticsTask, userId: string, now: Date): MemberTaskRow {
  const status = task.status ?? "TODO";
  const submitted = (task.submitters ?? []).map(String).includes(userId);
  const overdue = isTaskOverdue({ endDate: task.endDate, status }, now);
  return {
    id: task.id,
    title: task.title ?? "Untitled task",
    status,
    startDate: task.startDate ?? null,
    endDate: task.endDate ?? null,
    submitted,
    changesRequested: (task.changesRequestedBy ?? []).map(String).includes(userId),
    overdue,
    lateAndUnsubmitted: overdue && !submitted,
  };
}

/**
 * One row per member, plus an Unassigned row when any task has nobody on it.
 *
 * A task shared by three people counts once for each of them: the question being answered is
 * "what is this person carrying", not "how do the columns add up to the team total". The
 * Unassigned row is deliberately included rather than filtered — a per-person view that omitted
 * ownerless work would make a team look far better staffed than it is, and on a board where 19
 * of 23 tasks have nobody on them that is the most important number on the page.
 */
export function memberTaskStats(
  tasks: readonly AnalyticsTask[],
  members: readonly {
    userId: string;
    name?: string | null;
    /** MENTOR and ADMIN are excluded: they assign work, they do not receive it. */
    role?: string | null;
  }[],
  now: Date = new Date()
): MemberTaskStats[] {
  const byUser = new Map<string, MemberTaskStats>();

  const bucket = (userId: string, name: string) => {
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        name,
        assigned: 0,
        done: 0,
        outstanding: 0,
        overdue: 0,
        points: 0,
        donePoints: 0,
        formerMember: false,
        tasks: [],
      });
    }
    return byUser.get(userId)!;
  };

  // Seed every member so somebody with nothing assigned still appears — an empty row is the
  // signal that they have no work, which vanishes if the row is absent.
  const nameOf = new Map(members.map((m) => [String(m.userId), m.name ?? "Unknown"]));
  const onTeam = new Set(members.map((m) => String(m.userId)));
  const receivesWork = (role?: string | null) => {
    const r = (role ?? "").toUpperCase();
    return r !== "MENTOR" && r !== "ADMIN";
  };
  for (const m of members) {
    if (receivesWork(m.role)) bucket(String(m.userId), m.name ?? "Unknown");
  }

  for (const task of tasks) {
    const assignees = assigneesOf(task);

    if (assignees.length === 0) {
      const row = bucket(UNASSIGNED, "Unassigned");
      row.assigned += 1;
      row.points += task.points ?? 1;
      row.tasks.push(rowFor(task, UNASSIGNED, now));
      continue;
    }

    for (const userId of assignees) {
      // Somebody removed from the team keeps their tasks. Name them from the task's own
      // assigneeNames rather than labelling them "Former member": knowing there is orphaned
      // work is only useful alongside knowing whose it is.
      const name =
        nameOf.get(userId) ?? task.assigneeNames?.[userId] ?? "Unknown member";
      const row = bucket(userId, name);
      if (!onTeam.has(userId)) row.formerMember = true;

      const detail = rowFor(task, userId, now);
      const points = task.points ?? 1;
      row.assigned += 1;
      row.points += points;
      if (detail.status === "DONE") {
        row.done += 1;
        row.donePoints += points;
      } else {
        row.outstanding += 1;
        if (detail.overdue) row.overdue += 1;
      }
      row.tasks.push(detail);
    }
  }

  // Busiest first, since that is what the page is being read to find out. Unassigned last
  // regardless: it is a total, not a person.
  return [...byUser.values()].sort((a, b) => {
    if (a.userId === UNASSIGNED) return 1;
    if (b.userId === UNASSIGNED) return -1;
    if (a.formerMember !== b.formerMember) return a.formerMember ? -1 : 1;
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Totals for the table footer, plus the two counts worth pulling to the top of the page.
 *
 * These will not match the team's "Total Tasks" figure, on purpose: a task shared by three
 * people counts once for each of them, and unassigned work is its own row. The footer exists so
 * that discrepancy is visible rather than looking like a miscount.
 */
export function memberStatsTotals(rows: readonly MemberTaskStats[]): MemberStatsTotals {
  const people = rows.filter((r) => r.userId !== UNASSIGNED);
  const unassigned = rows.find((r) => r.userId === UNASSIGNED);

  const sum = (pick: (r: MemberTaskStats) => number) =>
    people.reduce((total, r) => total + pick(r), 0);

  return {
    members: people.length,
    idleMembers: people.filter((r) => r.assigned === 0).length,
    assigned: sum((r) => r.assigned),
    done: sum((r) => r.done),
    outstanding: sum((r) => r.outstanding),
    overdue: sum((r) => r.overdue),
    points: sum((r) => r.points),
    donePoints: sum((r) => r.donePoints),
    unassignedTasks: unassigned?.assigned ?? 0,
    formerMemberTasks: sum((r) => (r.formerMember ? r.assigned : 0)),
  };
}
