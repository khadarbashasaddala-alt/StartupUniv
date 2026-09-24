/**
 * Programme plan: the template that turns a cohort's programme into sprints and tasks.
 *
 * Background (issue #258). An admin used to create every sprint by hand and then type each
 * "key activity" from the programme deck in as a task, one at a time. That does not scale past
 * a single team and it is where mistakes creep in — a task once reached the board titled "-".
 *
 * The input is a *template* an admin fills once and reuses, not the deck itself. A deck carries
 * no reliable phase structure to key on, and extracting from it would trade loud errors for quiet
 * ones: a plausible-but-wrong deliverable reads fine and nobody re-checks it. The template is
 * deterministic and reviewable before anything is written.
 *
 * This module is the single source of truth for that template. The workbook *generator*, the
 * browser-side *parser*, and the server-side *validator* all import from here, so the file an
 * admin downloads can never drift from the parser that reads it back.
 *
 * Deliberately dependency-free and side-effect-free: it runs in the browser (parsing an uploaded
 * workbook) and on the server (re-validating what the browser POSTed). Never trust the client's
 * parse — the server runs the same functions again on the JSON it receives.
 *
 * Two things are intentionally NOT in the template:
 *
 *  - Dates. They are derived from the cohort's start date (see `deriveSprintWindows`), which is
 *    what lets one template apply to every intake. Confirmed against live data: the CU capstone
 *    board's Sprint 1 runs 4 Aug (Tue) – 17 Aug (Mon), i.e. exactly cohort start + 2 weeks − 1 day,
 *    with no snapping to week boundaries.
 *  - Assignees. Tasks are created unassigned and assigned later by an admin or mentor.
 */

/** Priorities accepted in the template. Mirrors the `priority` values the tasks table stores. */
export const PLAN_TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type PlanTaskPriority = (typeof PLAN_TASK_PRIORITIES)[number];

export const DEFAULT_TASK_PRIORITY: PlanTaskPriority = "MEDIUM";
export const DEFAULT_TASK_POINTS = 1;

/**
 * Guard rails on the numeric columns. These are not arbitrary: a plan is authored by hand in a
 * spreadsheet, so the realistic failure is a typo (`20` weeks meant as `2`, points of `1000`
 * from a stray keypress), not a hostile input. Rejecting outliers at parse time turns a silent
 * timeline blow-out into a row-numbered error the admin can see and fix.
 */
export const MIN_SPRINT_DURATION_WEEKS = 1;
export const MAX_SPRINT_DURATION_WEEKS = 26;
export const MIN_TASK_POINTS = 0;
export const MAX_TASK_POINTS = 100;
export const MAX_SPRINTS_PER_PLAN = 52;
export const MAX_TASKS_PER_SPRINT = 200;

/** Free-text ceilings. The columns are `text` in Postgres, so these exist to catch pasted junk. */
export const MAX_TITLE_LENGTH = 200;
export const MAX_PROSE_LENGTH = 4000;

/**
 * A task title has to be something a person can act on.
 *
 * The bug in issue #258 — a task saved as "-" — got through because the only check was
 * `if (!title)`, which any truthy string satisfies. So a title must survive trimming, reach a
 * minimum length, AND contain at least one letter or digit: "-", ".", "!!", "--" and "   " are
 * all rejected. Kept here rather than only in the Zod insert schema because the manual Add Task
 * route destructures `req.body` and never runs that schema.
 *
 * The letter-or-digit rule is what actually catches the defect; the length floor is deliberately
 * only 2. Every junk title in the issue fails on the character rule regardless, so a higher floor
 * would buy nothing and would start rejecting legitimate short titles like "QA" or "UX". Refusing
 * valid input is a worse failure here than accepting a terse title.
 */
export const MIN_TASK_TITLE_LENGTH = 2;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export function isMeaningfulTitle(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed.length >= MIN_TASK_TITLE_LENGTH &&
    trimmed.length <= MAX_TITLE_LENGTH &&
    LETTER_OR_DIGIT.test(trimmed)
  );
}

/**
 * Message describing why a task title is unacceptable, or null when it is fine.
 *
 * Missing and unusable are reported separately: a blank field keeps the long-standing
 * "Task title is required" wording, while "-" gets an explanation of what is actually wrong.
 * Lives here rather than in the route file so the server guards, the Zod schema and the two
 * client dialogs all render the same sentence.
 */
export function taskTitleError(title: unknown): string | null {
  const isBlank =
    title === undefined || title === null || (typeof title === "string" && title.trim() === "");
  if (isBlank) return "Task title is required";
  if (!isMeaningfulTitle(title)) {
    return `Task title must be at least ${MIN_TASK_TITLE_LENGTH} characters and include a letter or number`;
  }
  return null;
}

/**
 * The template's columns, in the order they appear in the workbook.
 *
 * One row per task; the sprint columns repeat down every row belonging to that sprint. Flat beats
 * nested here because admins edit this in Excel, and a flat grid is what a spreadsheet is good at.
 * `sprint_index` is what groups rows back into sprints.
 */
export interface PlanColumn {
  key: string;
  header: string;
  required: boolean;
  /** Shown on the workbook's Instructions sheet. */
  help: string;
}

export const PLAN_COLUMNS: readonly PlanColumn[] = [
  {
    key: "sprint_index",
    header: "Sprint #",
    required: true,
    help: "Whole number, starting at 1. Rows sharing a number belong to the same sprint. Also the key used to match sprints on re-import, so do not renumber existing sprints.",
  },
  {
    key: "sprint_name",
    header: "Sprint Name",
    required: true,
    help: 'Shown as the sprint heading, e.g. "Phase I: Orientation & Research Foundations". Must be identical on every row of the sprint.',
  },
  {
    key: "sprint_duration_weeks",
    header: "Duration (weeks)",
    required: true,
    help: `Whole number of weeks (${MIN_SPRINT_DURATION_WEEKS}-${MAX_SPRINT_DURATION_WEEKS}). Dates are calculated from the cohort start date, so there are no date columns. Must be identical on every row of the sprint.`,
  },
  { key: "sprint_goals", header: "Sprint Goals", required: false, help: "Optional. Free text." },
  { key: "sprint_objectives", header: "Sprint Objectives", required: false, help: "Optional. Free text." },
  { key: "sprint_deliverables", header: "Sprint Deliverables", required: false, help: "Optional. Free text." },
  {
    key: "task_title",
    header: "Task Title",
    required: true,
    help: `Required. At least ${MIN_TASK_TITLE_LENGTH} characters and must contain a letter or digit — "-" is not a task title.`,
  },
  { key: "task_description", header: "Task Description", required: false, help: "Optional. Free text." },
  { key: "task_objectives", header: "Task Objectives", required: false, help: "Optional. Free text." },
  { key: "task_deliverables", header: "Task Deliverables", required: false, help: "Optional. Free text." },
  {
    key: "task_priority",
    header: "Priority",
    required: false,
    help: `One of ${PLAN_TASK_PRIORITIES.join(", ")}. Blank means ${DEFAULT_TASK_PRIORITY}.`,
  },
  {
    key: "task_points",
    header: "Points",
    required: false,
    help: `Whole number ${MIN_TASK_POINTS}-${MAX_TASK_POINTS}. Blank means ${DEFAULT_TASK_POINTS}.`,
  },
] as const;

export const PLAN_HEADERS: readonly string[] = PLAN_COLUMNS.map((c) => c.header);

/** A single parsed template row, before grouping into sprints. */
export interface PlanRow {
  sprintIndex: number;
  sprintName: string;
  sprintDurationWeeks: number;
  sprintGoals: string | null;
  sprintObjectives: string | null;
  sprintDeliverables: string | null;
  taskTitle: string;
  taskDescription: string | null;
  taskObjectives: string | null;
  taskDeliverables: string | null;
  taskPriority: PlanTaskPriority;
  taskPoints: number;
}

export interface PlanTask {
  /** 0-based position within the sprint. Part of `sourceKey`. */
  ordinal: number;
  sourceKey: string;
  title: string;
  description: string | null;
  objectives: string | null;
  deliverables: string | null;
  priority: PlanTaskPriority;
  points: number;
}

export interface PlanSprint {
  index: number;
  name: string;
  durationWeeks: number;
  goals: string | null;
  objectives: string | null;
  deliverables: string | null;
  tasks: PlanTask[];
}

/** A validated plan: sprints in ascending index order, each with its tasks in template order. */
export interface ProgrammePlan {
  sprints: PlanSprint[];
}

/** Row-numbered problem. `row` is the workbook's own 1-based row number including the header. */
export interface PlanIssue {
  row: number | null;
  column: string | null;
  message: string;
}

export type PlanParseResult =
  | { ok: true; plan: ProgrammePlan; warnings: PlanIssue[] }
  | { ok: false; errors: PlanIssue[]; warnings: PlanIssue[] };

// ---------------------------------------------------------------------------
// Cell coercion
// ---------------------------------------------------------------------------

/**
 * Spreadsheet cells arrive as strings, numbers, Dates, or undefined depending on the parser and
 * on what the admin typed. Everything text-like collapses to a trimmed string or null.
 *
 * Non-breaking spaces are folded to ordinary ones first: they survive `trim()`, and a cell holding
 * only U+00A0 (common when content is pasted out of a slide deck or a browser) would otherwise
 * read as a non-empty value and defeat the required-field checks.
 */
function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value !== "string") return null;
  // Written as escapes rather than literals: these characters are invisible in an editor,
  // so a well-meaning reformat could silently delete them.
  const cleaned = value.replace(/[\u00A0\u2007\u202F]/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Whole numbers only. Accepts a real number or a numeric string; rejects decimals, so a
 * `sprint_duration_weeks` of `1.5` is a visible error rather than silently floored to a week.
 */
function toWholeNumber(value: unknown): number | null {
  const text = toText(value);
  if (text === null) return null;
  // Reject anything that is not an optionally-signed run of digits. Number() alone would accept
  // "1e3", "0x10", "  12  " and "Infinity", none of which belong in a hand-filled spreadsheet.
  if (!/^[+-]?\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function toPriority(value: unknown): PlanTaskPriority | null | undefined {
  const text = toText(value);
  if (text === null) return undefined; // absent -> caller applies the default
  const upper = text.toUpperCase();
  return (PLAN_TASK_PRIORITIES as readonly string[]).includes(upper)
    ? (upper as PlanTaskPriority)
    : null; // present but unrecognised -> caller reports an error
}

/**
 * The optional free-text columns, checked for length as a group.
 *
 * An over-length cell is reported as a row-numbered error rather than truncated. Silently keeping
 * the first 4000 characters of a deliverable would be a data change the admin never sees — the
 * import would "succeed" and the tail would just be gone.
 */
const PROSE_COLUMNS: readonly { key: string; header: string }[] = PLAN_COLUMNS.filter(
  (c) =>
    !c.required && c.key !== "task_priority" && c.key !== "task_points"
).map((c) => ({ key: c.key, header: c.header }));

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

/** "  Sprint #  " and "sprint_index" both normalise to "sprintindex". */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_LOOKUP: ReadonlyMap<string, string> = new Map(
  PLAN_COLUMNS.flatMap((c) => [
    [normalizeHeader(c.header), c.key] as const,
    [normalizeHeader(c.key), c.key] as const,
  ])
);

/**
 * Maps the uploaded sheet's header row onto column keys.
 *
 * Both the human header ("Sprint #") and the machine key ("sprint_index") are accepted, so a
 * hand-built CSV works as well as the generated workbook. Unrecognised columns are ignored rather
 * than rejected — admins add notes columns, and failing the whole import over one would be
 * needlessly strict.
 */
export function mapHeaders(headerRow: readonly unknown[]): {
  keyByPosition: (string | null)[];
  missingRequired: string[];
} {
  const keyByPosition = headerRow.map((cell) => {
    const text = toText(cell);
    if (text === null) return null;
    return HEADER_LOOKUP.get(normalizeHeader(text)) ?? null;
  });

  const present = new Set(keyByPosition.filter((k): k is string => k !== null));
  const missingRequired = PLAN_COLUMNS.filter((c) => c.required && !present.has(c.key)).map(
    (c) => c.header
  );

  return { keyByPosition, missingRequired };
}

// ---------------------------------------------------------------------------
// Idempotency key
// ---------------------------------------------------------------------------

/**
 * Stable identifier for a generated task, stored in `tasks.source_key`.
 *
 * Keyed on (sprint index, ordinal within the sprint) rather than on the title, so renaming a task
 * in the template updates the existing row instead of orphaning it and inserting a duplicate —
 * which is exactly what the "re-runs must not duplicate" requirement asks for. The trade-off is
 * the mirror image: *reordering* rows within a sprint re-points the keys, so a reorder reads as
 * edits to several tasks rather than as a move. Reordering a programme plan is rarer than fixing
 * a typo in a title, so this is the right way round.
 *
 * The prefix marks the row as importer-owned. Hand-made tasks keep `source_key` NULL and are
 * therefore never touched by an import.
 */
export function taskSourceKey(sprintIndex: number, ordinal: number): string {
  return `plan:s${sprintIndex}:t${ordinal}`;
}

// ---------------------------------------------------------------------------
// Date derivation
// ---------------------------------------------------------------------------

export interface SprintWindow {
  index: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Midnight on the calendar day `dayOffset` days after the one `from` falls on, in the running
 * process's own timezone.
 *
 * Two decisions here, and both matter enough to have gone wrong once already.
 *
 * **Local components, not UTC.** `cohorts.start_date` is a `timestamp` (no timezone), and
 * node-postgres parses those into a Date at *local* midnight. On this project's servers (IST,
 * UTC+05:30) a stored `2026-08-04 00:00:00` therefore has `getDate() === 4` but
 * `getUTCDate() === 3`. Reading UTC components would compute every sprint a day early —
 * Sprint 1 as 3–16 Aug instead of the board's 4–17 Aug. Local components round-trip correctly
 * through the same `timestamp` columns the results are written back to.
 *
 * **Calendar arithmetic, not millisecond arithmetic.** `new Date(y, m, d + n)` normalises
 * overflow across months and years and re-resolves midnight on the target day, so it stays
 * correct across a DST boundary. Adding `n * 86400000` ms would drift by an hour and can land
 * on the wrong calendar day in any zone that observes DST.
 */
function startOfDayPlus(from: Date, dayOffset: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + dayOffset);
}

/**
 * Turns durations into concrete dates, chaining each sprint off the previous one:
 *
 *   sprint[1].start = cohortStart
 *   sprint[n].start = sprint[n-1].end + 1 day
 *   sprint[n].end   = sprint[n].start + (weeks * 7) - 1 day
 *
 * There is deliberately no snapping to Mondays. The live CU capstone board has Sprint 1 on
 * 4 Aug (Tue) – 17 Aug (Mon), which is exactly this formula against a Tuesday cohort start;
 * snapping would shift it and make a re-import rewrite the dates of an already-ACTIVE sprint.
 *
 * Windows are whole calendar days at local midnight — see `startOfDayPlus` for why local and not
 * UTC. Time-of-day on `cohortStart` is discarded: carrying an arbitrary time through the chain
 * makes the boundaries hard to eyeball in the preview and serves no purpose for a date-only concept.
 *
 * Throws on a non-positive or fractional `durationWeeks`. `parsePlanSheet` already rejects those,
 * but this is exported and the server re-derives from whatever JSON a client POSTed — silently
 * emitting a window whose end precedes its start would be far worse than failing loudly.
 */
export function deriveSprintWindows(
  sprints: readonly Pick<PlanSprint, "index" | "durationWeeks">[],
  cohortStart: Date
): SprintWindow[] {
  if (Number.isNaN(cohortStart.getTime())) {
    throw new RangeError("deriveSprintWindows: cohortStart is an invalid Date");
  }

  const ordered = [...sprints].sort((a, b) => a.index - b.index);
  const windows: SprintWindow[] = [];
  let dayCursor = 0;

  for (const sprint of ordered) {
    if (!Number.isInteger(sprint.durationWeeks) || sprint.durationWeeks < 1) {
      throw new RangeError(
        `deriveSprintWindows: sprint ${sprint.index} has durationWeeks=${sprint.durationWeeks}; expected a whole number of 1 or more`
      );
    }

    const lengthInDays = sprint.durationWeeks * 7;
    windows.push({
      index: sprint.index,
      startDate: startOfDayPlus(cohortStart, dayCursor),
      endDate: startOfDayPlus(cohortStart, dayCursor + lengthInDays - 1),
    });
    dayCursor += lengthInDays;
  }

  return windows;
}

/** Last day covered by the plan, or null for an empty plan. Used for the overrun warning. */
export function planEndDate(plan: ProgrammePlan, cohortStart: Date): Date | null {
  const windows = deriveSprintWindows(plan.sprints, cohortStart);
  return windows.length > 0 ? windows[windows.length - 1].endDate : null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Header occupies row 1, so the first data row is row 2. */
const FIRST_DATA_ROW = 2;

function isBlankRow(cells: readonly unknown[]): boolean {
  return cells.every((cell) => toText(cell) === null);
}

/**
 * Validates a sheet — a header row followed by data rows — into a `ProgrammePlan`.
 *
 * Errors are collected rather than thrown on the first problem: an admin fixing a 300-row plan
 * needs the whole list, not one error per upload. Every issue carries the workbook's own row
 * number so it can be pointed at in the preview.
 */
export function parsePlanSheet(rows: readonly (readonly unknown[])[]): PlanParseResult {
  const errors: PlanIssue[] = [];
  const warnings: PlanIssue[] = [];

  if (rows.length === 0) {
    return { ok: false, errors: [{ row: null, column: null, message: "The sheet is empty." }], warnings };
  }

  const { keyByPosition, missingRequired } = mapHeaders(rows[0]);
  if (missingRequired.length > 0) {
    errors.push({
      row: 1,
      column: null,
      message: `Missing required column(s): ${missingRequired.join(", ")}. Download a fresh template if the header row was edited.`,
    });
    // Without the required columns nothing below can be interpreted, so stop here rather than
    // emitting a cascade of "required" errors for every row.
    return { ok: false, errors, warnings };
  }

  const parsed: { row: number; value: PlanRow }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const rowNumber = i + 1;
    if (isBlankRow(cells)) continue; // trailing blank rows are normal in a spreadsheet

    const cell = (key: string): unknown => {
      const position = keyByPosition.indexOf(key);
      return position === -1 ? undefined : cells[position];
    };

    const rowErrorCountBefore = errors.length;

    const sprintIndex = toWholeNumber(cell("sprint_index"));
    if (sprintIndex === null || sprintIndex < 1) {
      errors.push({
        row: rowNumber,
        column: "Sprint #",
        message: "Sprint # must be a whole number of 1 or more.",
      });
    }

    const sprintName = toText(cell("sprint_name"));
    if (sprintName === null) {
      errors.push({ row: rowNumber, column: "Sprint Name", message: "Sprint Name is required." });
    } else if (sprintName.length > MAX_TITLE_LENGTH) {
      errors.push({
        row: rowNumber,
        column: "Sprint Name",
        message: `Sprint Name must be ${MAX_TITLE_LENGTH} characters or fewer.`,
      });
    }

    const durationWeeks = toWholeNumber(cell("sprint_duration_weeks"));
    if (
      durationWeeks === null ||
      durationWeeks < MIN_SPRINT_DURATION_WEEKS ||
      durationWeeks > MAX_SPRINT_DURATION_WEEKS
    ) {
      errors.push({
        row: rowNumber,
        column: "Duration (weeks)",
        message: `Duration (weeks) must be a whole number between ${MIN_SPRINT_DURATION_WEEKS} and ${MAX_SPRINT_DURATION_WEEKS}.`,
      });
    }

    const rawTitle = toText(cell("task_title"));
    if (rawTitle === null) {
      errors.push({ row: rowNumber, column: "Task Title", message: "Task Title is required." });
    } else if (!isMeaningfulTitle(rawTitle)) {
      errors.push({
        row: rowNumber,
        column: "Task Title",
        message: `"${rawTitle}" is not a usable task title — it needs at least ${MIN_TASK_TITLE_LENGTH} characters including a letter or digit.`,
      });
    }

    const priority = toPriority(cell("task_priority"));
    if (priority === null) {
      errors.push({
        row: rowNumber,
        column: "Priority",
        message: `Priority must be one of ${PLAN_TASK_PRIORITIES.join(", ")}, or left blank.`,
      });
    }

    const rawPoints = cell("task_points");
    const points = toWholeNumber(rawPoints);
    const pointsProvided = toText(rawPoints) !== null;
    if (pointsProvided && (points === null || points < MIN_TASK_POINTS || points > MAX_TASK_POINTS)) {
      errors.push({
        row: rowNumber,
        column: "Points",
        message: `Points must be a whole number between ${MIN_TASK_POINTS} and ${MAX_TASK_POINTS}, or left blank.`,
      });
    }

    for (const prose of PROSE_COLUMNS) {
      const text = toText(cell(prose.key));
      if (text !== null && text.length > MAX_PROSE_LENGTH) {
        errors.push({
          row: rowNumber,
          column: prose.header,
          message: `${prose.header} is ${text.length} characters; the limit is ${MAX_PROSE_LENGTH}. Shorten it rather than letting the import drop the rest.`,
        });
      }
    }

    if (errors.length > rowErrorCountBefore) continue; // row is unusable; keep validating the rest

    parsed.push({
      row: rowNumber,
      value: {
        sprintIndex: sprintIndex!,
        sprintName: sprintName!,
        sprintDurationWeeks: durationWeeks!,
        sprintGoals: toText(cell("sprint_goals")),
        sprintObjectives: toText(cell("sprint_objectives")),
        sprintDeliverables: toText(cell("sprint_deliverables")),
        taskTitle: rawTitle!.trim(),
        taskDescription: toText(cell("task_description")),
        taskObjectives: toText(cell("task_objectives")),
        taskDeliverables: toText(cell("task_deliverables")),
        taskPriority: priority ?? DEFAULT_TASK_PRIORITY,
        taskPoints: pointsProvided ? points! : DEFAULT_TASK_POINTS,
      },
    });
  }

  if (parsed.length === 0 && errors.length === 0) {
    errors.push({ row: null, column: null, message: "The sheet has a header row but no data rows." });
  }
  if (errors.length > 0) return { ok: false, errors, warnings };

  return groupRowsIntoPlan(parsed, warnings);
}

/**
 * Groups validated rows into sprints and enforces the cross-row rules — the ones that cannot be
 * checked a row at a time.
 */
function groupRowsIntoPlan(
  parsed: readonly { row: number; value: PlanRow }[],
  warnings: PlanIssue[]
): PlanParseResult {
  const errors: PlanIssue[] = [];
  const bySprint = new Map<number, { row: number; value: PlanRow }[]>();

  for (const entry of parsed) {
    const bucket = bySprint.get(entry.value.sprintIndex);
    if (bucket) bucket.push(entry);
    else bySprint.set(entry.value.sprintIndex, [entry]);
  }

  const indexes = [...bySprint.keys()].sort((a, b) => a - b);

  if (indexes.length > MAX_SPRINTS_PER_PLAN) {
    errors.push({
      row: null,
      column: null,
      message: `A plan may define at most ${MAX_SPRINTS_PER_PLAN} sprints; this one has ${indexes.length}.`,
    });
  }

  // Gaps are an error, not a warning: sprint index is the matching key on re-import and it is
  // shown to teams as "Sprint N". A plan jumping 1, 2, 5 is a filled-in-wrong template, and
  // silently accepting it would leave the board looking broken.
  for (let i = 0; i < indexes.length; i++) {
    if (indexes[i] !== i + 1) {
      errors.push({
        row: null,
        column: "Sprint #",
        message: `Sprint numbers must run 1, 2, 3, … with no gaps or duplicates. Found ${indexes.join(", ")}.`,
      });
      break;
    }
  }

  const sprints: PlanSprint[] = [];

  for (const index of indexes) {
    const group = bySprint.get(index)!;
    const first = group[0];

    // Every row of a sprint repeats that sprint's columns, so they have to agree. Taking the
    // first row silently would let a corrected value further down be dropped without a word.
    for (const field of ["sprintName", "sprintDurationWeeks"] as const) {
      const mismatch = group.find((entry) => entry.value[field] !== first.value[field]);
      if (mismatch) {
        const column = field === "sprintName" ? "Sprint Name" : "Duration (weeks)";
        errors.push({
          row: mismatch.row,
          column,
          message: `${column} must be the same on every row of Sprint ${index} — row ${first.row} has "${first.value[field]}" but row ${mismatch.row} has "${mismatch.value[field]}".`,
        });
      }
    }

    if (group.length > MAX_TASKS_PER_SPRINT) {
      errors.push({
        row: null,
        column: null,
        message: `Sprint ${index} has ${group.length} tasks; the limit is ${MAX_TASKS_PER_SPRINT}.`,
      });
    }

    // Duplicate titles inside one sprint are a warning, not an error. They are usually a
    // copy-paste slip, but a plan legitimately repeating "Weekly mentor sync" is not wrong, and
    // source_key is positional so duplicates do not break idempotency.
    const seenTitles = new Map<string, number>();
    for (const entry of group) {
      const key = entry.value.taskTitle.toLowerCase();
      const firstRow = seenTitles.get(key);
      if (firstRow !== undefined) {
        warnings.push({
          row: entry.row,
          column: "Task Title",
          message: `"${entry.value.taskTitle}" already appears in Sprint ${index} at row ${firstRow}.`,
        });
      } else {
        seenTitles.set(key, entry.row);
      }
    }

    sprints.push({
      index,
      name: first.value.sprintName,
      durationWeeks: first.value.sprintDurationWeeks,
      goals: first.value.sprintGoals,
      objectives: first.value.sprintObjectives,
      deliverables: first.value.sprintDeliverables,
      tasks: group.map((entry, ordinal) => ({
        ordinal,
        sourceKey: taskSourceKey(index, ordinal),
        title: entry.value.taskTitle,
        description: entry.value.taskDescription,
        objectives: entry.value.taskObjectives,
        deliverables: entry.value.taskDeliverables,
        priority: entry.value.taskPriority,
        points: entry.value.taskPoints,
      })),
    });
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  return { ok: true, plan: { sprints }, warnings };
}

// ---------------------------------------------------------------------------
// Applying a plan to a team
// ---------------------------------------------------------------------------

/** What an import would do to one row. */
export type PlanAction = "create" | "update" | "unchanged" | "skipped";

/** The subset of an existing sprint row this needs in order to diff against it. */
export interface ExistingSprint {
  id: string;
  index: number;
  name: string | null;
  startDate: Date;
  endDate: Date;
  goals: string | null;
  objectives: string | null;
  deliverables: string | null;
}

/** The subset of an existing task row this needs. `sourceKey` is null for hand-made tasks. */
export interface ExistingTask {
  id: string;
  sprintId: string | null;
  sourceKey: string | null;
  title: string;
  description: string | null;
  objectives: string | null;
  deliverables: string | null;
  priority: string | null;
  points: number | null;
  status: string;
}

export interface TaskChange {
  action: PlanAction;
  sourceKey: string;
  existingTaskId: string | null;
  title: string;
  description: string | null;
  objectives: string | null;
  deliverables: string | null;
  priority: PlanTaskPriority;
  points: number;
  /** Present when `action` is "skipped": why it was left alone. */
  reason?: string;
}

export interface SprintChange {
  action: PlanAction;
  index: number;
  existingSprintId: string | null;
  name: string;
  startDate: Date;
  endDate: Date;
  goals: string | null;
  objectives: string | null;
  deliverables: string | null;
  tasks: TaskChange[];
}

/**
 * A plan-generated task that exists on the board but is no longer in the template.
 *
 * Reported, never deleted. Somebody may have started work on it, and a template edited by mistake
 * should not be able to destroy that — an import is allowed to add and amend, not to remove.
 */
export interface OrphanedTask {
  id: string;
  sprintIndex: number;
  sourceKey: string;
  title: string;
  status: string;
}

export interface TeamPlanDiff {
  sprints: SprintChange[];
  orphanedTasks: OrphanedTask[];
  summary: {
    sprintsCreated: number;
    sprintsUpdated: number;
    sprintsUnchanged: number;
    tasksCreated: number;
    tasksUpdated: number;
    tasksUnchanged: number;
    tasksSkipped: number;
    orphaned: number;
  };
}

/** Same calendar day? Compared on local components, matching how the windows are built. */
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Treats null and "" as equal, since a blank template cell and a NULL column mean the same thing. */
function sameText(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

/**
 * Works out exactly what applying `plan` to one team would do, without touching anything.
 *
 * The dry-run and the apply both call this, so the preview an admin approves is generated by the
 * same code that then executes — the two cannot disagree about what "3 created, 1 skipped" meant.
 *
 * Matching rules:
 *
 *  - **Sprints match on `index`**, which already has a unique index on (team_id, index). A sprint
 *    that exists is updated in place; re-running an unchanged template changes nothing.
 *  - **Tasks match on `sourceKey`** within their sprint, not on title, so renaming a task in the
 *    template amends the existing row instead of orphaning it and inserting a duplicate.
 *  - **Hand-made tasks are invisible here.** They have a NULL `sourceKey`, are never matched,
 *    never updated and never reported — an import cannot disturb work somebody typed in by hand.
 *  - **A generated task that has been started is skipped**, not updated. Silently rewriting the
 *    description of something a learner is part-way through is worse than leaving it stale, and
 *    the preview says which ones and why. Only `TODO` tasks are amended.
 *  - **A generated task dropped from the template is reported, not deleted** (see `OrphanedTask`).
 */
export function planTeamChanges(
  plan: ProgrammePlan,
  cohortStart: Date,
  existingSprints: readonly ExistingSprint[],
  existingTasks: readonly ExistingTask[]
): TeamPlanDiff {
  const windows = deriveSprintWindows(plan.sprints, cohortStart);
  const sprintByIndex = new Map(existingSprints.map((s) => [s.index, s]));

  // Only plan-generated tasks participate in matching. Hand-made ones are deliberately excluded
  // here rather than filtered at the call site, so no caller can forget to.
  const generatedBySprintAndKey = new Map<string, ExistingTask>();
  for (const task of existingTasks) {
    if (task.sourceKey !== null && task.sprintId !== null) {
      generatedBySprintAndKey.set(`${task.sprintId} ${task.sourceKey}`, task);
    }
  }

  const claimedTaskIds = new Set<string>();
  const sprints: SprintChange[] = [];

  for (const sprint of plan.sprints) {
    const window = windows.find((w) => w.index === sprint.index)!;
    const existing = sprintByIndex.get(sprint.index) ?? null;

    const sprintDiffers =
      existing !== null &&
      !(
        sameText(existing.name, sprint.name) &&
        sameText(existing.goals, sprint.goals) &&
        sameText(existing.objectives, sprint.objectives) &&
        sameText(existing.deliverables, sprint.deliverables) &&
        sameDay(existing.startDate, window.startDate) &&
        sameDay(existing.endDate, window.endDate)
      );

    const tasks: TaskChange[] = sprint.tasks.map((task) => {
      const match =
        existing === null
          ? undefined
          : generatedBySprintAndKey.get(`${existing.id} ${task.sourceKey}`);

      const base = {
        sourceKey: task.sourceKey,
        title: task.title,
        description: task.description,
        objectives: task.objectives,
        deliverables: task.deliverables,
        priority: task.priority,
        points: task.points,
      };

      if (!match) return { ...base, action: "create" as const, existingTaskId: null };

      claimedTaskIds.add(match.id);

      if (match.status !== "TODO") {
        return {
          ...base,
          action: "skipped" as const,
          existingTaskId: match.id,
          reason: `already ${match.status.toLowerCase().replace("_", " ")} — left as it is`,
        };
      }

      const taskDiffers = !(
        sameText(match.title, task.title) &&
        sameText(match.description, task.description) &&
        sameText(match.objectives, task.objectives) &&
        sameText(match.deliverables, task.deliverables) &&
        (match.priority ?? DEFAULT_TASK_PRIORITY) === task.priority &&
        (match.points ?? DEFAULT_TASK_POINTS) === task.points
      );

      return {
        ...base,
        action: taskDiffers ? ("update" as const) : ("unchanged" as const),
        existingTaskId: match.id,
      };
    });

    sprints.push({
      action: existing === null ? "create" : sprintDiffers ? "update" : "unchanged",
      index: sprint.index,
      existingSprintId: existing?.id ?? null,
      name: sprint.name,
      startDate: window.startDate,
      endDate: window.endDate,
      goals: sprint.goals,
      objectives: sprint.objectives,
      deliverables: sprint.deliverables,
      tasks,
    });
  }

  // Anything plan-generated, inside a sprint this plan covers, that the template no longer mentions.
  const coveredSprintIds = new Set(
    plan.sprints.map((s) => sprintByIndex.get(s.index)?.id).filter((id): id is string => !!id)
  );
  const orphanedTasks: OrphanedTask[] = existingTasks
    .filter(
      (t) =>
        t.sourceKey !== null &&
        t.sprintId !== null &&
        coveredSprintIds.has(t.sprintId) &&
        !claimedTaskIds.has(t.id)
    )
    .map((t) => ({
      id: t.id,
      sprintIndex: existingSprints.find((s) => s.id === t.sprintId)?.index ?? 0,
      sourceKey: t.sourceKey!,
      title: t.title,
      status: t.status,
    }));

  const allTasks = sprints.flatMap((s) => s.tasks);
  const count = (list: { action: PlanAction }[], action: PlanAction) =>
    list.filter((x) => x.action === action).length;

  return {
    sprints,
    orphanedTasks,
    summary: {
      sprintsCreated: count(sprints, "create"),
      sprintsUpdated: count(sprints, "update"),
      sprintsUnchanged: count(sprints, "unchanged"),
      tasksCreated: count(allTasks, "create"),
      tasksUpdated: count(allTasks, "update"),
      tasksUnchanged: count(allTasks, "unchanged"),
      tasksSkipped: count(allTasks, "skipped"),
      orphaned: orphanedTasks.length,
    },
  };
}

/** True when applying this diff would change nothing — used to report a clean re-run. */
export function isNoOp(diff: TeamPlanDiff): boolean {
  const s = diff.summary;
  return (
    s.sprintsCreated === 0 &&
    s.sprintsUpdated === 0 &&
    s.tasksCreated === 0 &&
    s.tasksUpdated === 0
  );
}

// ---------------------------------------------------------------------------
// Sample template
// ---------------------------------------------------------------------------

/**
 * Rows for the downloadable starter template.
 *
 * Modelled on the CU capstone programme the issue describes, so an admin opening the file sees
 * the shape they are meant to fill rather than "Sprint 1 / Task 1" placeholders. Two sprints is
 * enough to show that sprint columns repeat per row and that a second sprint continues the
 * numbering.
 */
export const SAMPLE_PLAN_ROWS: readonly (readonly (string | number)[])[] = [
  [
    1,
    "Phase I: Orientation & Research Foundations",
    2,
    "Ground the team in the problem space and agree the research frame.",
    "Shared understanding of the domain; a defensible research question.",
    "Approved research questions; literature gap statement.",
    "Approved Research Questions",
    "Draft research questions and get them approved by the industry mentor.",
    "Questions are specific, answerable and tied to the problem statement.",
    "A one-page list of approved research questions.",
    "HIGH",
    3,
  ],
  [
    1,
    "Phase I: Orientation & Research Foundations",
    2,
    "Ground the team in the problem space and agree the research frame.",
    "Shared understanding of the domain; a defensible research question.",
    "Approved research questions; literature gap statement.",
    "Literature Gap Statement",
    "Review existing literature and state the gap this capstone addresses.",
    "Literature review depth; clearly articulated gap.",
    "A written gap statement with citations.",
    "HIGH",
    3,
  ],
  [
    2,
    "Phase II: Discovery & Validation",
    2,
    "Test the framing against real users before building anything.",
    "Evidence that the problem is worth solving.",
    "Interview notes; validated problem statement.",
    "Run 10 User Interviews",
    "Recruit and interview ten people in the target segment.",
    "Interviews follow a consistent guide; notes are captured per interview.",
    "Ten sets of interview notes.",
    "MEDIUM",
    5,
  ],
] as const;

/** Header row plus sample rows, ready to hand to a CSV or workbook writer. */
export function sampleTemplateGrid(): (string | number)[][] {
  return [[...PLAN_HEADERS], ...SAMPLE_PLAN_ROWS.map((row) => [...row])];
}

export const TEMPLATE_BASENAME = "programme-plan-template";

/**
 * Serialises a grid to RFC 4180 CSV.
 *
 * Quoting is not optional here: the sample content already contains commas and an ampersand, and
 * real plans contain multi-line prose in the description and deliverables columns. A field is
 * quoted when it holds a comma, a quote, or a line break, and embedded quotes are doubled.
 *
 * CRLF line endings, again per RFC 4180 — Excel on Windows is the main consumer and it is the
 * least surprising choice for a file people open by double-clicking.
 */
export function toCsv(grid: readonly (readonly (string | number)[])[]): string {
  return grid
    .map((row) =>
      row
        .map((cell) => {
          const text = typeof cell === "number" ? String(cell) : cell;
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(",")
    )
    .join("\r\n");
}

/**
 * Reads RFC 4180 CSV into a grid, the inverse of `toCsv`.
 *
 * Hand-rolled rather than pulling in a parser, because the whole module is deliberately
 * dependency-free so it can run unchanged in the browser and on the server — and because the
 * server must be able to re-read whatever the browser claims it parsed.
 *
 * What it handles, and why each case is here rather than assumed away:
 *
 *  - **Quoted fields** containing commas, doubled quotes (`""` -> `"`), and line breaks. The
 *    description and deliverables columns hold multi-line prose, so an embedded newline must not
 *    end the row. This is the case naive `split("\n")` parsers get wrong.
 *  - **Any line ending**: CRLF (what `toCsv` writes and Excel expects), bare LF (what most other
 *    tools write), and bare CR. A file that has been through two editors can contain a mixture.
 *  - **A leading BOM**, which Excel writes when saving UTF-8 CSV and which would otherwise become
 *    part of the first header cell and stop it matching "Sprint #".
 *  - **No trailing newline** on the final row, and conversely a trailing newline that must not
 *    produce a phantom empty row.
 *  - **A stray quote inside an unquoted field** (`a"b`). Strictly this is malformed, but rejecting
 *    a whole plan over one apostrophe-turned-quote is worse than keeping the character verbatim,
 *    and `parsePlanSheet` validates the resulting values anyway.
 *
 * Returns rows of raw strings; every value is a string, so numeric columns are coerced later by
 * `parsePlanSheet`. Blank lines survive as `[""]` and are dropped there, not here — dropping them
 * in the reader would shift the row numbers that error messages point at.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (input === "") return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      // Only opens a quoted run at the start of a field; mid-field it is a literal character,
      // which is how `a"b` survives instead of throwing.
      if (field === "") {
        inQuotes = true;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === ",") {
      endField();
      i++;
      continue;
    }

    if (char === "\r" || char === "\n") {
      endRow();
      // Consume CRLF as one terminator rather than two.
      i += char === "\r" && input[i + 1] === "\n" ? 2 : 1;
      continue;
    }

    field += char;
    i++;
  }

  // A file ending exactly on a line terminator has already flushed its last row; anything left in
  // the buffer is a final row with no trailing newline.
  if (field !== "" || row.length > 0 || inQuotes) endRow();

  return rows;
}

/**
 * A byte-order mark, which Excel needs to read a UTF-8 CSV as UTF-8.
 *
 * Without it Excel assumes the legacy system codepage and mangles every non-ASCII character —
 * the sample template's "&" is safe but its em dashes and any Kannada text in a real plan are
 * not. Prepend this to `toCsv` output when producing a file for download.
 */
export const UTF8_BOM = "\uFEFF";

/** The full CSV text of the starter template, ready to write to a file or Blob. */
export function sampleTemplateCsv(): string {
  return UTF8_BOM + toCsv(sampleTemplateGrid());
}
