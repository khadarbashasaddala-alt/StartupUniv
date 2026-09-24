import { describe, expect, it } from "vitest";

import {
  DEFAULT_TASK_POINTS,
  DEFAULT_TASK_PRIORITY,
  MAX_PROSE_LENGTH,
  MAX_SPRINT_DURATION_WEEKS,
  MAX_TITLE_LENGTH,
  PLAN_HEADERS,
  deriveSprintWindows,
  isMeaningfulTitle,
  isNoOp,
  parseCsv,
  parsePlanSheet,
  planTeamChanges,
  planEndDate,
  sampleTemplateCsv,
  sampleTemplateGrid,
  taskSourceKey,
  taskTitleError,
  toCsv,
  type ExistingSprint,
  type ExistingTask,
} from "./programmePlan";

/** Builds a sheet from partial rows so each test only states the columns it cares about. */
function sheet(rows: Record<string, string | number>[]): unknown[][] {
  const headerRow = [...PLAN_HEADERS];
  const body = rows.map((row) => headerRow.map((header) => row[header] ?? ""));
  return [headerRow, ...body];
}

const validRow = {
  "Sprint #": 1,
  "Sprint Name": "Phase I: Orientation",
  "Duration (weeks)": 2,
  "Task Title": "Approved Research Questions",
};

function expectOk(result: ReturnType<typeof parsePlanSheet>) {
  if (!result.ok) {
    throw new Error(`expected parse to succeed, got: ${JSON.stringify(result.errors, null, 2)}`);
  }
  return result;
}

function expectFail(result: ReturnType<typeof parsePlanSheet>) {
  if (result.ok) throw new Error("expected parse to fail, but it succeeded");
  return result;
}

describe("isMeaningfulTitle", () => {
  it("rejects the titles the old `if (!title)` check let through", () => {
    // The exact defect issue #258 cites: a task reached the board titled "-".
    expect(isMeaningfulTitle("-")).toBe(false);
    expect(isMeaningfulTitle(".")).toBe(false);
    expect(isMeaningfulTitle("!!")).toBe(false);
    expect(isMeaningfulTitle("   ")).toBe(false);
    expect(isMeaningfulTitle("--")).toBe(false);
    expect(isMeaningfulTitle("")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isMeaningfulTitle(undefined)).toBe(false);
    expect(isMeaningfulTitle(null)).toBe(false);
    expect(isMeaningfulTitle(42)).toBe(false);
  });

  it("accepts real titles, including short and non-Latin ones", () => {
    expect(isMeaningfulTitle("Approved Research Questions")).toBe(true);
    expect(isMeaningfulTitle("KYC")).toBe(true);
    expect(isMeaningfulTitle("ಕನ್ನಡ")).toBe(true);
    // Two characters is the floor, so legitimately terse titles survive. Rejecting these
    // would be a worse failure than accepting a terse title.
    expect(isMeaningfulTitle("QA")).toBe(true);
    expect(isMeaningfulTitle("A1 ")).toBe(true);
  });

  it("still rejects a single character, with or without padding", () => {
    expect(isMeaningfulTitle("A")).toBe(false);
    expect(isMeaningfulTitle("  A  ")).toBe(false);
  });
});

/**
 * Local calendar date as YYYY-MM-DD.
 *
 * Assertions go through this rather than `toISOString()`, which is UTC. An earlier version of
 * these tests compared ISO strings and fed UTC-midnight Dates, and that combination hid a real
 * bug: the implementation read UTC components, so on an IST server (UTC+05:30) every sprint came
 * out a day early. Comparing local calendar days makes the tests pass or fail on the thing that
 * actually matters, in any timezone.
 */
function ymd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * A cohort start exactly as node-postgres hands it over.
 *
 * `cohorts.start_date` is a `timestamp` (no timezone), which pg parses to *local* midnight — so
 * this, not a UTC-midnight Date, is the realistic input to the derivation.
 */
const COHORT_START = new Date(2026, 7, 4); // 4 Aug 2026, local midnight

describe("taskTitleError", () => {
  it("distinguishes a blank field from an unusable one", () => {
    // Two different messages on purpose: a blank field keeps the wording users already know,
    // while "-" needs to say what is actually wrong with it.
    expect(taskTitleError(undefined)).toBe("Task title is required");
    expect(taskTitleError(null)).toBe("Task title is required");
    expect(taskTitleError("")).toBe("Task title is required");
    expect(taskTitleError("   ")).toBe("Task title is required");

    for (const junk of ["-", ".", "!!", "--"]) {
      expect(taskTitleError(junk)).toMatch(/at least 2 characters and include a letter or number/);
    }
  });

  it("returns null for acceptable titles", () => {
    expect(taskTitleError("Approved Research Questions")).toBeNull();
    expect(taskTitleError("QA")).toBeNull();
    expect(taskTitleError("  Padded  ")).toBeNull();
  });

  it("rejects non-string values that are not blank", () => {
    // req.body is untrusted: a number or object must not reach title.trim() on the create paths.
    for (const bad of [5, {}, [], true]) {
      expect(taskTitleError(bad)).not.toBeNull();
    }
  });

  it("rejects a title longer than the column ceiling", () => {
    expect(taskTitleError("T".repeat(MAX_TITLE_LENGTH + 1))).not.toBeNull();
    expect(taskTitleError("T".repeat(MAX_TITLE_LENGTH))).toBeNull();
  });
});

describe("deriveSprintWindows", () => {
  it("reproduces the live board's Sprint 1 window from a pg-style local-midnight Date", () => {
    // The CU capstone board shows Sprint 1 as 4 Aug - 17 Aug: 14 days inclusive, Tuesday to
    // Monday, no snapping to week boundaries. This is the regression test for the timezone bug —
    // reading UTC components here yields 3-16 Aug on any server east of UTC.
    const [window] = deriveSprintWindows([{ index: 1, durationWeeks: 2 }], COHORT_START);

    expect(ymd(window.startDate)).toBe("2026-08-04");
    expect(ymd(window.endDate)).toBe("2026-08-17");
  });

  it("agrees with itself whatever time of day the cohort start carries", () => {
    // pg returns midnight, but a cohort edited through the UI can carry any time. The calendar
    // day is all that should matter.
    const windows = [
      new Date(2026, 7, 4, 0, 0, 0),
      new Date(2026, 7, 4, 17, 43, 11),
      new Date(2026, 7, 4, 23, 59, 59),
    ].map((start) => deriveSprintWindows([{ index: 1, durationWeeks: 2 }], start)[0]);

    for (const w of windows) {
      expect(ymd(w.startDate)).toBe("2026-08-04");
      expect(ymd(w.endDate)).toBe("2026-08-17");
    }
  });

  it("returns midnight, not a carried-over time of day", () => {
    const [window] = deriveSprintWindows(
      [{ index: 1, durationWeeks: 1 }],
      new Date(2026, 7, 4, 17, 43, 11)
    );
    expect([window.startDate.getHours(), window.startDate.getMinutes()]).toEqual([0, 0]);
    expect([window.endDate.getHours(), window.endDate.getMinutes()]).toEqual([0, 0]);
  });

  it("chains sprints back to back with no gap or overlap", () => {
    const windows = deriveSprintWindows(
      [
        { index: 1, durationWeeks: 2 },
        { index: 2, durationWeeks: 3 },
        { index: 3, durationWeeks: 1 },
      ],
      COHORT_START
    );

    expect(windows.map((w) => [ymd(w.startDate), ymd(w.endDate)])).toEqual([
      ["2026-08-04", "2026-08-17"],
      ["2026-08-18", "2026-09-07"],
      ["2026-09-08", "2026-09-14"],
    ]);
  });

  it("spans month and year boundaries correctly", () => {
    // Calendar arithmetic, not millisecond arithmetic: December into January must roll the year.
    const windows = deriveSprintWindows(
      [
        { index: 1, durationWeeks: 4 },
        { index: 2, durationWeeks: 2 },
      ],
      new Date(2026, 11, 21) // 21 Dec 2026
    );
    expect(windows.map((w) => [ymd(w.startDate), ymd(w.endDate)])).toEqual([
      ["2026-12-21", "2027-01-17"],
      ["2027-01-18", "2027-01-31"],
    ]);
  });

  it("does not snap to Monday", () => {
    // A Wednesday start stays a Wednesday start.
    const [window] = deriveSprintWindows([{ index: 1, durationWeeks: 1 }], new Date(2026, 7, 5));
    expect(window.startDate.getDay()).toBe(3);
    expect(ymd(window.startDate)).toBe("2026-08-05");
  });

  it("orders by sprint index rather than trusting input order", () => {
    const windows = deriveSprintWindows(
      [
        { index: 2, durationWeeks: 1 },
        { index: 1, durationWeeks: 1 },
      ],
      COHORT_START
    );
    expect(windows.map((w) => w.index)).toEqual([1, 2]);
    expect(ymd(windows[0].startDate)).toBe("2026-08-04");
  });

  it("returns nothing for an empty plan", () => {
    expect(deriveSprintWindows([], COHORT_START)).toEqual([]);
    expect(planEndDate({ sprints: [] }, COHORT_START)).toBeNull();
  });

  it("throws rather than emitting a window that ends before it starts", () => {
    // parsePlanSheet rejects these, but this function is exported and the server re-derives from
    // client-supplied JSON.
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => deriveSprintWindows([{ index: 1, durationWeeks: bad }], COHORT_START)).toThrow(
        /durationWeeks/
      );
    }
  });

  it("throws on an invalid cohort start date", () => {
    expect(() =>
      deriveSprintWindows([{ index: 1, durationWeeks: 2 }], new Date("not a date"))
    ).toThrow(/cohortStart/);
  });
});

describe("taskSourceKey", () => {
  it("is stable for the same position", () => {
    expect(taskSourceKey(1, 0)).toBe(taskSourceKey(1, 0));
  });

  it("distinguishes sprint and ordinal", () => {
    const keys = [taskSourceKey(1, 0), taskSourceKey(1, 1), taskSourceKey(2, 0)];
    expect(new Set(keys).size).toBe(3);
  });

  it("does not depend on the title, so a rename updates rather than duplicates", () => {
    // Positional keying is the whole reason a re-import after fixing a typo does not
    // leave the old task behind.
    expect(taskSourceKey(1, 0)).toBe("plan:s1:t0");
  });
});

describe("parsePlanSheet — the shipped template", () => {
  it("parses the sample template we hand to admins", () => {
    // If the starter file failed our own parser, every admin's first upload would error.
    const { plan, warnings } = expectOk(parsePlanSheet(sampleTemplateGrid()));

    expect(warnings).toEqual([]);
    expect(plan.sprints.map((s) => s.index)).toEqual([1, 2]);
    expect(plan.sprints[0].tasks).toHaveLength(2);
    expect(plan.sprints[1].tasks).toHaveLength(1);
    expect(plan.sprints[0].name).toBe("Phase I: Orientation & Research Foundations");
    expect(plan.sprints[0].tasks[0].title).toBe("Approved Research Questions");
    expect(plan.sprints[0].tasks[0].priority).toBe("HIGH");
    expect(plan.sprints[0].tasks[0].points).toBe(3);
  });
});

describe("parsePlanSheet — happy path", () => {
  it("groups rows sharing a sprint number and assigns ordinals in template order", () => {
    const { plan } = expectOk(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "First task" },
          { ...validRow, "Task Title": "Second task" },
          { ...validRow, "Sprint #": 2, "Sprint Name": "Phase II", "Task Title": "Third task" },
        ])
      )
    );

    expect(plan.sprints).toHaveLength(2);
    expect(plan.sprints[0].tasks.map((t) => [t.ordinal, t.title, t.sourceKey])).toEqual([
      [0, "First task", "plan:s1:t0"],
      [1, "Second task", "plan:s1:t1"],
    ]);
    expect(plan.sprints[1].tasks[0].sourceKey).toBe("plan:s2:t0");
  });

  it("applies defaults for blank priority and points", () => {
    const { plan } = expectOk(parsePlanSheet(sheet([validRow])));
    expect(plan.sprints[0].tasks[0].priority).toBe(DEFAULT_TASK_PRIORITY);
    expect(plan.sprints[0].tasks[0].points).toBe(DEFAULT_TASK_POINTS);
  });

  it("accepts priority in any case", () => {
    const { plan } = expectOk(parsePlanSheet(sheet([{ ...validRow, Priority: "high" }])));
    expect(plan.sprints[0].tasks[0].priority).toBe("HIGH");
  });

  it("accepts points of 0", () => {
    const { plan } = expectOk(parsePlanSheet(sheet([{ ...validRow, Points: 0 }])));
    expect(plan.sprints[0].tasks[0].points).toBe(0);
  });

  it("accepts the machine keys as headers, so a hand-built CSV works", () => {
    const result = expectOk(
      parsePlanSheet([
        ["sprint_index", "sprint_name", "sprint_duration_weeks", "task_title"],
        [1, "Phase I", 2, "A real task"],
      ])
    );
    expect(result.plan.sprints[0].tasks[0].title).toBe("A real task");
  });

  it("ignores unrecognised columns instead of failing the import", () => {
    const grid = sheet([validRow]);
    grid[0].push("Notes for me");
    grid[1].push("ignore this");
    expect(expectOk(parsePlanSheet(grid)).plan.sprints).toHaveLength(1);
  });

  it("skips trailing blank rows", () => {
    const grid = sheet([validRow]);
    grid.push(PLAN_HEADERS.map(() => ""), PLAN_HEADERS.map(() => "   "));
    expect(expectOk(parsePlanSheet(grid)).plan.sprints[0].tasks).toHaveLength(1);
  });

  it("treats a cell holding only a non-breaking space as empty", () => {
    // Pasting out of a slide deck brings U+00A0 along, and it survives trim().
    const result = parsePlanSheet(sheet([{ ...validRow, "Task Title": "\u00A0" }]));
    expect(expectFail(result).errors[0].message).toMatch(/Task Title is required/);
  });

  it("trims surrounding whitespace off titles", () => {
    const { plan } = expectOk(
      parsePlanSheet(sheet([{ ...validRow, "Task Title": "  Padded title  " }]))
    );
    expect(plan.sprints[0].tasks[0].title).toBe("Padded title");
  });
});

describe("parsePlanSheet — rejections", () => {
  it("rejects an empty sheet and a header-only sheet", () => {
    expect(expectFail(parsePlanSheet([])).errors[0].message).toMatch(/empty/i);
    expect(expectFail(parsePlanSheet([[...PLAN_HEADERS]])).errors[0].message).toMatch(
      /no data rows/i
    );
  });

  it("names every missing required column and stops before per-row noise", () => {
    const result = expectFail(parsePlanSheet([["Sprint #", "Task Title"], [1, "A task"]]));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Sprint Name");
    expect(result.errors[0].message).toContain("Duration (weeks)");
  });

  it('rejects "-" as a task title with a row number', () => {
    const result = expectFail(parsePlanSheet(sheet([{ ...validRow, "Task Title": "-" }])));
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[0].column).toBe("Task Title");
    expect(result.errors[0].message).toContain("not a usable task title");
  });

  it("rejects a fractional duration rather than flooring it", () => {
    const result = expectFail(parsePlanSheet(sheet([{ ...validRow, "Duration (weeks)": 1.5 }])));
    expect(result.errors[0].column).toBe("Duration (weeks)");
  });

  it("rejects numeric-looking strings that are not plain integers", () => {
    for (const bad of ["1e3", "0x10", "Infinity", "two"]) {
      const result = expectFail(parsePlanSheet(sheet([{ ...validRow, "Duration (weeks)": bad }])));
      expect(result.errors[0].column).toBe("Duration (weeks)");
    }
  });

  it("rejects a duration beyond the guard rail", () => {
    const result = expectFail(
      parsePlanSheet(sheet([{ ...validRow, "Duration (weeks)": MAX_SPRINT_DURATION_WEEKS + 1 }]))
    );
    expect(result.errors[0].column).toBe("Duration (weeks)");
  });

  it("rejects a sprint number below 1", () => {
    expect(expectFail(parsePlanSheet(sheet([{ ...validRow, "Sprint #": 0 }]))).errors[0].column).toBe(
      "Sprint #"
    );
  });

  it("rejects an unrecognised priority", () => {
    const result = expectFail(parsePlanSheet(sheet([{ ...validRow, Priority: "URGENT" }])));
    expect(result.errors[0].column).toBe("Priority");
  });

  it("rejects out-of-range points", () => {
    expect(expectFail(parsePlanSheet(sheet([{ ...validRow, Points: 1000 }]))).errors[0].column).toBe(
      "Points"
    );
  });

  it("reports over-length prose instead of silently truncating it", () => {
    const tooLong = "x".repeat(MAX_PROSE_LENGTH + 1);
    const result = expectFail(
      parsePlanSheet(sheet([{ ...validRow, "Task Description": tooLong }]))
    );
    expect(result.errors[0].column).toBe("Task Description");
    expect(result.errors[0].message).toContain(String(MAX_PROSE_LENGTH));
  });

  it("collects errors from every bad row rather than stopping at the first", () => {
    const result = expectFail(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "-" },
          { ...validRow, "Task Title": "Fine task" },
          { ...validRow, "Task Title": "." },
        ])
      )
    );
    expect(result.errors.map((e) => e.row)).toEqual([2, 4]);
  });

  it("rejects a sprint whose name differs between rows, naming both rows", () => {
    const result = expectFail(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "First task" },
          { ...validRow, "Sprint Name": "Phase I: Orientaton", "Task Title": "Second task" },
        ])
      )
    );
    expect(result.errors[0].column).toBe("Sprint Name");
    expect(result.errors[0].row).toBe(3);
    expect(result.errors[0].message).toContain("row 2");
  });

  it("rejects a sprint whose duration differs between rows", () => {
    const result = expectFail(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "First task" },
          { ...validRow, "Duration (weeks)": 3, "Task Title": "Second task" },
        ])
      )
    );
    expect(result.errors[0].column).toBe("Duration (weeks)");
  });

  it("rejects gaps in the sprint numbering", () => {
    const result = expectFail(
      parsePlanSheet(
        sheet([
          { ...validRow, "Sprint #": 1, "Task Title": "First task" },
          { ...validRow, "Sprint #": 3, "Sprint Name": "Phase III", "Task Title": "Third task" },
        ])
      )
    );
    expect(result.errors[0].message).toMatch(/no gaps or duplicates/);
  });

  it("rejects a plan that does not start at sprint 1", () => {
    const result = expectFail(
      parsePlanSheet(sheet([{ ...validRow, "Sprint #": 2, "Sprint Name": "Phase II" }]))
    );
    expect(result.errors[0].message).toMatch(/no gaps or duplicates/);
  });
});

describe("parsePlanSheet — warnings", () => {
  it("warns about a duplicate title within a sprint but still succeeds", () => {
    const result = expectOk(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "Weekly mentor sync" },
          { ...validRow, "Task Title": "weekly mentor sync" },
        ])
      )
    );

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].row).toBe(3);
    expect(result.warnings[0].message).toContain("row 2");
    // Positional source keys mean the duplicate is still addressable.
    expect(result.plan.sprints[0].tasks.map((t) => t.sourceKey)).toEqual([
      "plan:s1:t0",
      "plan:s1:t1",
    ]);
  });

  it("does not warn about the same title in different sprints", () => {
    const result = expectOk(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "Weekly mentor sync" },
          {
            ...validRow,
            "Sprint #": 2,
            "Sprint Name": "Phase II",
            "Task Title": "Weekly mentor sync",
          },
        ])
      )
    );
    expect(result.warnings).toEqual([]);
  });
});

describe("toCsv", () => {
  it("leaves plain fields unquoted", () => {
    expect(toCsv([["a", "b"], [1, 2]])).toBe("a,b\r\n1,2");
  });

  it("quotes fields containing a comma", () => {
    expect(toCsv([["Phase I, part one"]])).toBe('"Phase I, part one"');
  });

  it("quotes and doubles embedded quotes", () => {
    expect(toCsv([['He said "go"']])).toBe('"He said ""go"""');
  });

  it("quotes fields containing line breaks", () => {
    // Multi-line prose in the deliverables column is the normal case, not an edge case.
    expect(toCsv([["line one\nline two"]])).toBe('"line one\nline two"');
  });

  it("uses CRLF between rows", () => {
    expect(toCsv([["a"], ["b"]])).toBe("a\r\nb");
  });

  it("renders numbers without quoting", () => {
    expect(toCsv([[1, 26, 0]])).toBe("1,26,0");
  });
});

describe("parseCsv", () => {
  it("reads plain rows", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("accepts CRLF, bare LF and bare CR, including a mixture", () => {
    // A file that has been through two editors can contain more than one convention.
    const expected = [["a"], ["b"], ["c"]];
    expect(parseCsv("a\r\nb\r\nc")).toEqual(expected);
    expect(parseCsv("a\nb\nc")).toEqual(expected);
    expect(parseCsv("a\rb\rc")).toEqual(expected);
    expect(parseCsv("a\r\nb\nc")).toEqual(expected);
  });

  it("unquotes fields and collapses doubled quotes", () => {
    expect(parseCsv('"plain","with, comma","he said ""go"""')).toEqual([
      ["plain", "with, comma", 'he said "go"'],
    ]);
  });

  it("keeps a line break inside a quoted field instead of ending the row", () => {
    // The case naive split("\n") parsers get wrong, and the normal case for deliverables.
    expect(parseCsv('"line one\nline two",next')).toEqual([["line one\nline two", "next"]]);
    expect(parseCsv('"line one\r\nline two",next')).toEqual([["line one\r\nline two", "next"]]);
  });

  it("strips a leading BOM so the first header still matches", () => {
    const grid = parseCsv("\uFEFFSprint #,Sprint Name");
    expect(grid[0][0]).toBe("Sprint #");
  });

  it("handles a final row with no trailing newline, and one with", () => {
    expect(parseCsv("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    // A trailing terminator must not invent a phantom row.
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("preserves empty fields and empty lines", () => {
    expect(parseCsv("a,,b")).toEqual([["a", "", "b"]]);
    expect(parseCsv(",")).toEqual([["", ""]]);
    // Blank lines are kept here and dropped by parsePlanSheet, so row numbers in error
    // messages still line up with what the admin sees in their spreadsheet.
    expect(parseCsv("a\r\n\r\nb")).toEqual([["a"], [""], ["b"]]);
  });

  it("returns nothing for an empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("\uFEFF")).toEqual([]);
  });

  it("keeps a stray quote in an unquoted field rather than failing", () => {
    // Malformed per the spec, but refusing a whole plan over one character would be worse.
    expect(parseCsv('a"b,c')).toEqual([['a"b', "c"]]);
  });

  it("does not lose data when a quoted field is never closed", () => {
    // Truncated file. Better to surface the text and let validation complain than drop the row.
    expect(parseCsv('"unterminated,still here')).toEqual([["unterminated,still here"]]);
  });

  it("round-trips everything toCsv can produce", () => {
    // toCsv and parseCsv are only trustworthy as a pair, so assert the pair directly.
    const grid = [
      ["plain", "with, comma", 'with "quotes"'],
      ["multi\nline", "", "trailing space "],
      ["\r\n", ",", '"'],
      ["1", "0", "-5"],
    ];
    expect(parseCsv(toCsv(grid))).toEqual(grid);
  });

  it("reads back the shipped template into the identical plan", () => {
    const viaCsv = expectOk(parsePlanSheet(parseCsv(sampleTemplateCsv())));
    const viaGrid = expectOk(parsePlanSheet(sampleTemplateGrid()));
    expect(viaCsv.plan).toEqual(viaGrid.plan);
  });
});

describe("sampleTemplateCsv", () => {
  it("starts with a UTF-8 BOM so Excel does not mangle non-ASCII", () => {
    expect(sampleTemplateCsv().startsWith("\uFEFF")).toBe(true);
  });

  it("round-trips: the CSV we hand out parses back to the same plan", () => {
    // The strongest guarantee in this file. If serialisation and parsing ever disagree, an
    // admin's very first download-fill-upload cycle breaks.
    const csv = sampleTemplateCsv();
    const grid = parseCsvForTest(csv.replace(/^\uFEFF/, ""));
    const fromCsv = expectOk(parsePlanSheet(grid)).plan;
    const fromGrid = expectOk(parsePlanSheet(sampleTemplateGrid())).plan;
    expect(fromCsv).toEqual(fromGrid);
  });
});

/**
 * Minimal RFC 4180 reader, used only to prove `toCsv` output is readable. Deliberately not
 * exported from the module: production parsing goes through a real spreadsheet library.
 */
function parseCsvForTest(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

describe("planTeamChanges", () => {
  const plan = expectOk(
    parsePlanSheet(
      sheet([
        { ...validRow, "Task Title": "First task", Priority: "HIGH", Points: 3 },
        { ...validRow, "Task Title": "Second task" },
      ])
    )
  ).plan;

  /** An existing sprint row matching what applying `plan` for the first time would have produced. */
  function existingSprint(overrides: Partial<ExistingSprint> = {}): ExistingSprint {
    const [w] = deriveSprintWindows(plan.sprints, COHORT_START);
    return {
      id: "sprint-1",
      index: 1,
      name: "Phase I: Orientation",
      startDate: w.startDate,
      endDate: w.endDate,
      goals: null,
      objectives: null,
      deliverables: null,
      ...overrides,
    };
  }

  function existingTask(overrides: Partial<ExistingTask> = {}): ExistingTask {
    return {
      id: "task-a",
      sprintId: "sprint-1",
      sourceKey: "plan:s1:t0",
      title: "First task",
      description: null,
      objectives: null,
      deliverables: null,
      priority: "HIGH",
      points: 3,
      status: "TODO",
      ...overrides,
    };
  }

  it("creates everything on a first import", () => {
    const diff = planTeamChanges(plan, COHORT_START, [], []);
    expect(diff.summary.sprintsCreated).toBe(1);
    expect(diff.summary.tasksCreated).toBe(2);
    expect(diff.sprints[0].existingSprintId).toBeNull();
    expect(isNoOp(diff)).toBe(false);
  });

  it("is a complete no-op when the same template is re-applied", () => {
    // The core requirement from the issue: running it twice must not duplicate anything.
    const diff = planTeamChanges(
      plan,
      COHORT_START,
      [existingSprint()],
      [existingTask(), existingTask({ id: "task-b", sourceKey: "plan:s1:t1", title: "Second task", priority: "MEDIUM", points: 1 })]
    );

    expect(isNoOp(diff)).toBe(true);
    expect(diff.summary).toMatchObject({
      sprintsCreated: 0,
      sprintsUpdated: 0,
      sprintsUnchanged: 1,
      tasksCreated: 0,
      tasksUpdated: 0,
      tasksUnchanged: 2,
      orphaned: 0,
    });
  });

  it("updates a renamed task in place rather than duplicating it", () => {
    // Positional keying is the whole point: the title changed, the source key did not.
    const diff = planTeamChanges(
      plan,
      COHORT_START,
      [existingSprint()],
      [
        existingTask({ title: "First task (old name)" }),
        existingTask({ id: "task-b", sourceKey: "plan:s1:t1", title: "Second task", priority: "MEDIUM", points: 1 }),
      ]
    );

    expect(diff.summary.tasksCreated).toBe(0);
    expect(diff.summary.tasksUpdated).toBe(1);
    expect(diff.sprints[0].tasks[0]).toMatchObject({
      action: "update",
      existingTaskId: "task-a",
      title: "First task",
    });
  });

  it("updates a sprint whose dates or name drifted", () => {
    const diff = planTeamChanges(
      plan,
      COHORT_START,
      [existingSprint({ name: "Phase I: Orientaton" })],
      []
    );
    expect(diff.sprints[0].action).toBe("update");
    expect(diff.sprints[0].existingSprintId).toBe("sprint-1");
  });

  it("does not rewrite a generated task somebody has started", () => {
    for (const status of ["IN_PROGRESS", "REVIEW", "DONE"]) {
      const diff = planTeamChanges(
        plan,
        COHORT_START,
        [existingSprint()],
        [existingTask({ status, title: "renamed since" })]
      );
      const task = diff.sprints[0].tasks[0];
      expect(task.action).toBe("skipped");
      expect(task.reason).toMatch(/left as it is/);
      expect(diff.summary.tasksSkipped).toBe(1);
    }
  });

  it("never touches or reports a hand-made task", () => {
    // sourceKey === null means a human typed it in. An import must be invisible to it.
    const handMade = existingTask({ id: "hand-1", sourceKey: null, title: "Typed by a founder" });
    const diff = planTeamChanges(plan, COHORT_START, [existingSprint()], [handMade]);

    expect(diff.orphanedTasks).toEqual([]);
    expect(diff.summary.tasksUpdated).toBe(0);
    // Both template tasks are unmatched, so they are creates — the hand-made row did not absorb one.
    expect(diff.summary.tasksCreated).toBe(2);
  });

  it("reports a task dropped from the template instead of deleting it", () => {
    const diff = planTeamChanges(
      plan,
      COHORT_START,
      [existingSprint()],
      [
        existingTask(),
        existingTask({ id: "task-b", sourceKey: "plan:s1:t1", title: "Second task", priority: "MEDIUM", points: 1 }),
        existingTask({ id: "task-gone", sourceKey: "plan:s1:t2", title: "Cut from the plan" }),
      ]
    );

    expect(diff.summary.orphaned).toBe(1);
    expect(diff.orphanedTasks[0]).toMatchObject({
      id: "task-gone",
      sourceKey: "plan:s1:t2",
      title: "Cut from the plan",
    });
    // Reported, not scheduled for removal — there is no delete action in the diff at all.
    expect(diff.sprints[0].tasks.some((t) => t.existingTaskId === "task-gone")).toBe(false);
  });

  it("does not match a source key from a different sprint", () => {
    // plan:s1:t0 on another sprint's row must not be mistaken for this sprint's first task.
    const diff = planTeamChanges(
      plan,
      COHORT_START,
      [existingSprint()],
      [existingTask({ id: "elsewhere", sprintId: "sprint-99" })]
    );
    expect(diff.summary.tasksCreated).toBe(2);
    expect(diff.summary.tasksUpdated).toBe(0);
  });

  it("treats a blank template cell and a NULL column as the same value", () => {
    // Otherwise every re-run would report spurious updates on the optional columns.
    const diff = planTeamChanges(
      plan,
      COHORT_START,
      [existingSprint({ goals: "" })],
      [existingTask({ description: "" }), existingTask({ id: "task-b", sourceKey: "plan:s1:t1", title: "Second task", priority: "MEDIUM", points: 1 })]
    );
    expect(isNoOp(diff)).toBe(true);
  });

  it("compares sprint dates by calendar day, not by exact timestamp", () => {
    // Stored rows carry a time component; the plan produces midnight. Same day is unchanged.
    const [w] = deriveSprintWindows(plan.sprints, COHORT_START);
    const withTime = new Date(w.startDate);
    withTime.setHours(5, 30, 0, 0);
    const diff = planTeamChanges(plan, COHORT_START, [existingSprint({ startDate: withTime })], []);
    expect(diff.sprints[0].action).toBe("unchanged");
  });
});

/**
 * Mirrors what storage.applyProgrammePlan writes, so the round trip can be asserted without a
 * database: apply a diff, then diff the resulting state again and prove it is a no-op.
 *
 * This is the guarantee the issue actually asks for ("running it twice must not duplicate sprints
 * and tasks"). Testing it against hand-written existing rows only proves the comparison works;
 * feeding the apply's own output back in proves the two halves agree.
 */
function simulateApply(
  diff: ReturnType<typeof planTeamChanges>,
  before: { sprints: ExistingSprint[]; tasks: ExistingTask[] }
): { sprints: ExistingSprint[]; tasks: ExistingTask[] } {
  const sprints = before.sprints.map((s) => ({ ...s }));
  const tasks = before.tasks.map((t) => ({ ...t }));
  let nextId = 1000;

  for (const change of diff.sprints) {
    let sprintId = change.existingSprintId;

    if (change.action === "create") {
      sprintId = `sprint-new-${nextId++}`;
      sprints.push({
        id: sprintId,
        index: change.index,
        name: change.name,
        startDate: change.startDate,
        endDate: change.endDate,
        goals: change.goals,
        objectives: change.objectives,
        deliverables: change.deliverables,
      });
    } else if (change.action === "update" && sprintId) {
      const target = sprints.find((s) => s.id === sprintId)!;
      Object.assign(target, {
        name: change.name,
        startDate: change.startDate,
        endDate: change.endDate,
        goals: change.goals,
        objectives: change.objectives,
        deliverables: change.deliverables,
      });
    }

    for (const task of change.tasks) {
      if (task.action === "skipped" || task.action === "unchanged") continue;

      if (task.action === "create") {
        tasks.push({
          id: `task-new-${nextId++}`,
          sprintId: sprintId!,
          sourceKey: task.sourceKey,
          title: task.title,
          description: task.description,
          objectives: task.objectives,
          deliverables: task.deliverables,
          priority: task.priority,
          points: task.points,
          status: "TODO",
        });
      } else if (task.existingTaskId) {
        const target = tasks.find((t) => t.id === task.existingTaskId)!;
        Object.assign(target, {
          title: task.title,
          description: task.description,
          objectives: task.objectives,
          deliverables: task.deliverables,
          priority: task.priority,
          points: task.points,
        });
      }
    }
  }

  return { sprints, tasks };
}

describe("apply then re-import", () => {
  const plan = expectOk(
    parsePlanSheet(
      sheet([
        { ...validRow, "Task Title": "First task", Priority: "HIGH", Points: 3 },
        { ...validRow, "Task Title": "Second task", "Task Description": "Some detail" },
        {
          ...validRow,
          "Sprint #": 2,
          "Sprint Name": "Phase II: Discovery",
          "Duration (weeks)": 3,
          "Task Title": "Third task",
        },
      ])
    )
  ).plan;

  it("is a no-op the second time, on an empty board", () => {
    const first = planTeamChanges(plan, COHORT_START, [], []);
    expect(first.summary.sprintsCreated).toBe(2);
    expect(first.summary.tasksCreated).toBe(3);

    const after = simulateApply(first, { sprints: [], tasks: [] });
    const second = planTeamChanges(plan, COHORT_START, after.sprints, after.tasks);

    expect(isNoOp(second)).toBe(true);
    expect(second.summary.sprintsUnchanged).toBe(2);
    expect(second.summary.tasksUnchanged).toBe(3);
    expect(second.orphanedTasks).toEqual([]);
  });

  it("does not accumulate rows over three applies", () => {
    let state: { sprints: ExistingSprint[]; tasks: ExistingTask[] } = { sprints: [], tasks: [] };
    for (let i = 0; i < 3; i++) {
      state = simulateApply(planTeamChanges(plan, COHORT_START, state.sprints, state.tasks), state);
    }
    expect(state.sprints).toHaveLength(2);
    expect(state.tasks).toHaveLength(3);
  });

  it("settles after applying an edited template, without duplicating the renamed task", () => {
    const state0 = simulateApply(planTeamChanges(plan, COHORT_START, [], []), {
      sprints: [],
      tasks: [],
    });

    const edited = expectOk(
      parsePlanSheet(
        sheet([
          { ...validRow, "Task Title": "First task, renamed", Priority: "LOW", Points: 8 },
          { ...validRow, "Task Title": "Second task", "Task Description": "Some detail" },
          {
            ...validRow,
            "Sprint #": 2,
            "Sprint Name": "Phase II: Discovery",
            "Duration (weeks)": 3,
            "Task Title": "Third task",
          },
        ])
      )
    ).plan;

    const change = planTeamChanges(edited, COHORT_START, state0.sprints, state0.tasks);
    expect(change.summary.tasksCreated).toBe(0);
    expect(change.summary.tasksUpdated).toBe(1);

    const state1 = simulateApply(change, state0);
    expect(state1.tasks).toHaveLength(3); // amended, not appended
    expect(state1.tasks.find((t) => t.sourceKey === "plan:s1:t0")!.title).toBe("First task, renamed");

    // And the edited template is itself now settled.
    expect(isNoOp(planTeamChanges(edited, COHORT_START, state1.sprints, state1.tasks))).toBe(true);
  });

  it("leaves a hand-made task alone across repeated applies", () => {
    const handMade: ExistingTask = {
      id: "hand-1",
      sprintId: "sprint-new-1000",
      sourceKey: null,
      title: "Typed in by a founder",
      description: null,
      objectives: null,
      deliverables: null,
      priority: "MEDIUM",
      points: 1,
      status: "IN_PROGRESS",
    };

    let state = simulateApply(planTeamChanges(plan, COHORT_START, [], []), { sprints: [], tasks: [] });
    state = { sprints: state.sprints, tasks: [...state.tasks, handMade] };

    for (let i = 0; i < 2; i++) {
      const diff = planTeamChanges(plan, COHORT_START, state.sprints, state.tasks);
      expect(isNoOp(diff)).toBe(true);
      expect(diff.orphanedTasks).toEqual([]);
      state = simulateApply(diff, state);
    }

    expect(state.tasks.find((t) => t.id === "hand-1")).toEqual(handMade);
  });

  it("keeps a started task's progress while still settling", () => {
    let state = simulateApply(planTeamChanges(plan, COHORT_START, [], []), { sprints: [], tasks: [] });
    const started = state.tasks.find((t) => t.sourceKey === "plan:s1:t0")!;
    started.status = "IN_PROGRESS";
    started.title = "First task, edited on the board";

    const diff = planTeamChanges(plan, COHORT_START, state.sprints, state.tasks);
    expect(diff.summary.tasksSkipped).toBe(1);

    state = simulateApply(diff, state);
    // The board's own edit survived — the import did not stamp over it.
    expect(state.tasks.find((t) => t.sourceKey === "plan:s1:t0")!.title).toBe(
      "First task, edited on the board"
    );
    expect(state.tasks.find((t) => t.sourceKey === "plan:s1:t0")!.status).toBe("IN_PROGRESS");
  });
});

describe("planEndDate", () => {
  it("returns the last day the plan covers", () => {
    const { plan } = expectOk(
      parsePlanSheet(
        sheet([
          { ...validRow, "Duration (weeks)": 2 },
          { ...validRow, "Sprint #": 2, "Sprint Name": "Phase II", "Duration (weeks)": 1 },
        ])
      )
    );

    expect(ymd(planEndDate(plan, COHORT_START)!)).toBe("2026-08-24");
  });
});
