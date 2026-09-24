/**
 * Where a sprint stands against its own dates, derived in one place.
 *
 * This existed in four places with two different vocabularies: the server called a sprint past
 * its end date "REVIEW", the sprint board called the same thing "TIME_OVER", and the mentor
 * dashboard compared `sprint.status` against "REVIEW" for a value the `sprints` table does not
 * even have — so the Pass button it guarded could never appear and a sprint could not be closed
 * from the UI at all. One derivation, one vocabulary.
 *
 * Deliberately NOT stored. Every phase but CLOSED is a function of today's date, so a column
 * would be stale the moment nobody wrote to it, and the failure would be silent.
 */

export const SPRINT_PHASES = ["UPCOMING", "ACTIVE", "DUE", "OVERDUE", "CLOSED"] as const;
export type SprintPhase = (typeof SPRINT_PHASES)[number];

/** How close to the end date counts as DUE. Long enough to still finish something. */
export const DUE_SOON_DAYS = 3;

export const SPRINT_PHASE_LABELS: Record<SprintPhase, string> = {
  UPCOMING: "Not started",
  ACTIVE: "Active",
  DUE: "Due soon",
  OVERDUE: "Overdue",
  CLOSED: "Closed",
};

export interface SprintWindow {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  passed?: boolean | null;
}

/**
 * Whole days between two instants, by calendar day rather than by elapsed milliseconds.
 *
 * A sprint ending "today" has 0 days left however far through the day it is, which is what a
 * person means. Comparing raw timestamps would report 0 at breakfast and -1 after midnight UTC
 * on the same working day.
 */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * The sprint's phase. `passed` wins over the dates: a sprint closed early is closed, and one
 * closed late is not still overdue.
 */
export function sprintPhase(sprint: SprintWindow, now: Date = new Date()): SprintPhase {
  if (sprint.passed) return "CLOSED";

  const start = asDate(sprint.startDate);
  const end = asDate(sprint.endDate);

  if (start && daysBetween(now, start) > 0) return "UPCOMING";
  if (!end) return "ACTIVE"; // no end date to be late against
  const left = daysBetween(now, end);
  if (left < 0) return "OVERDUE";
  if (left <= DUE_SOON_DAYS) return "DUE";
  return "ACTIVE";
}

/**
 * Days remaining, negative once the end date has gone past. Null when there is no end date.
 * `sprintPhase` decides what that number means; this only counts.
 */
export function daysLeftInSprint(sprint: SprintWindow, now: Date = new Date()): number | null {
  const end = asDate(sprint.endDate);
  return end ? daysBetween(now, end) : null;
}

/** Plain-English standing, for a header or a banner. */
export function sprintTimingLabel(sprint: SprintWindow, now: Date = new Date()): string {
  const phase = sprintPhase(sprint, now);
  if (phase === "CLOSED") return "Closed";

  const start = asDate(sprint.startDate);
  if (phase === "UPCOMING" && start) {
    const until = daysBetween(now, start);
    return until === 1 ? "Starts tomorrow" : `Starts in ${until} days`;
  }

  const left = daysLeftInSprint(sprint, now);
  if (left == null) return "No end date set";
  if (left < 0) {
    const over = Math.abs(left);
    return over === 1 ? "1 day overdue" : `${over} days overdue`;
  }
  if (left === 0) return "Ends today";
  if (left === 1) return "1 day left";
  return `${left} days left`;
}

/** A task past its own end date and not finished. Null end date means never overdue. */
export function isTaskOverdue(
  task: { endDate?: Date | string | null; status?: string | null },
  now: Date = new Date()
): boolean {
  if (task.status === "DONE") return false;
  const end = asDate(task.endDate);
  return end ? daysBetween(now, end) < 0 : false;
}

/**
 * What is still outstanding when somebody moves to close a sprint.
 *
 * Shown in the confirmation rather than used to block it: real programmes end with loose ends,
 * and refusing to close a phase over one unreviewed submission would strand a whole team. The
 * point is that the person closing it sees the cost before they agree to it.
 */
export interface SprintCloseSummary {
  phase: SprintPhase;
  timing: string;
  daysLeft: number | null;
  totalTasks: number;
  doneTasks: number;
  openTaskTitles: string[];
  pendingSubmissions: number;
  changesRequested: number;
  /** Nothing outstanding at all — the confirmation can be reassuring rather than a warning. */
  clean: boolean;
}

export function summariseSprintClose(
  sprint: SprintWindow,
  tasks: readonly { title?: string | null; status?: string | null }[],
  submissions: readonly { status?: string | null }[],
  now: Date = new Date()
): SprintCloseSummary {
  const done = tasks.filter((t) => t.status === "DONE");
  const open = tasks.filter((t) => t.status !== "DONE");
  const pendingSubmissions = submissions.filter(
    (s) => (s.status ?? "PENDING") === "PENDING"
  ).length;
  const changesRequested = submissions.filter((s) => s.status === "CHANGES_REQUESTED").length;

  return {
    phase: sprintPhase(sprint, now),
    timing: sprintTimingLabel(sprint, now),
    daysLeft: daysLeftInSprint(sprint, now),
    totalTasks: tasks.length,
    doneTasks: done.length,
    // Named so the person closing can see which ones, not just how many.
    openTaskTitles: open.map((t) => t.title ?? "Untitled task"),
    pendingSubmissions,
    changesRequested,
    clean: open.length === 0 && pendingSubmissions === 0 && changesRequested === 0,
  };
}
