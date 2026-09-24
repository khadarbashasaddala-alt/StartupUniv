import { describe, expect, it } from "vitest";
import {
  DUE_SOON_DAYS,
  daysBetween,
  daysLeftInSprint,
  isTaskOverdue,
  sprintPhase,
  sprintTimingLabel,
  summariseSprintClose,
} from "./sprintPhase";

// The live CU capstone Sprint 1: 4 Aug - 24 Aug 2026.
const sprint = { startDate: new Date(2026, 7, 4), endDate: new Date(2026, 7, 24), passed: false };
const on = (day: number, hour = 9) => new Date(2026, 7, day, hour);

describe("daysBetween", () => {
  it("counts calendar days, not elapsed milliseconds", () => {
    // Late on one day to early the next is one day, not zero.
    expect(daysBetween(new Date(2026, 7, 4, 23, 30), new Date(2026, 7, 5, 0, 30))).toBe(1);
  });

  it("is zero across the same day whatever the time", () => {
    expect(daysBetween(on(10, 1), on(10, 23))).toBe(0);
  });

  it("goes negative once the target is in the past", () => {
    expect(daysBetween(on(26), on(24))).toBe(-2);
  });
});

describe("sprintPhase", () => {
  it("is UPCOMING before the start date", () => {
    expect(sprintPhase(sprint, on(1))).toBe("UPCOMING");
  });

  it("is ACTIVE on the start date and through the middle", () => {
    expect(sprintPhase(sprint, on(4))).toBe("ACTIVE");
    expect(sprintPhase(sprint, on(15))).toBe("ACTIVE");
  });

  it(`is DUE within ${DUE_SOON_DAYS} days of the end`, () => {
    expect(sprintPhase(sprint, on(21))).toBe("DUE");
    expect(sprintPhase(sprint, on(24))).toBe("DUE");
  });

  it("is still DUE, not OVERDUE, on the end date itself", () => {
    // The last day is a day to work in, not a day already lost.
    expect(sprintPhase(sprint, on(24, 23))).toBe("DUE");
  });

  it("is OVERDUE the day after the end date", () => {
    expect(sprintPhase(sprint, on(25))).toBe("OVERDUE");
  });

  it("is CLOSED once passed, whatever the dates say", () => {
    expect(sprintPhase({ ...sprint, passed: true }, on(10))).toBe("CLOSED");
    expect(sprintPhase({ ...sprint, passed: true }, on(30))).toBe("CLOSED");
  });

  it("treats a sprint with no end date as ACTIVE rather than overdue", () => {
    expect(sprintPhase({ startDate: new Date(2026, 7, 4), endDate: null }, on(30))).toBe("ACTIVE");
  });

  it("survives an unparseable date instead of throwing", () => {
    expect(sprintPhase({ startDate: "nonsense", endDate: "nonsense" }, on(10))).toBe("ACTIVE");
  });
});

describe("sprintTimingLabel", () => {
  it("counts down while there is time", () => {
    expect(sprintTimingLabel(sprint, on(14))).toBe("10 days left");
    expect(sprintTimingLabel(sprint, on(23))).toBe("1 day left");
    expect(sprintTimingLabel(sprint, on(24))).toBe("Ends today");
  });

  it("counts up once the date has gone", () => {
    expect(sprintTimingLabel(sprint, on(25))).toBe("1 day overdue");
    expect(sprintTimingLabel(sprint, on(27))).toBe("3 days overdue");
  });

  it("says when an unstarted sprint begins", () => {
    expect(sprintTimingLabel(sprint, on(3))).toBe("Starts tomorrow");
    expect(sprintTimingLabel(sprint, on(1))).toBe("Starts in 3 days");
  });

  it("does not claim a deadline it does not have", () => {
    expect(sprintTimingLabel({ startDate: on(4), endDate: null }, on(10))).toBe("No end date set");
  });

  it("says nothing about timing once closed", () => {
    expect(sprintTimingLabel({ ...sprint, passed: true }, on(30))).toBe("Closed");
  });
});

describe("daysLeftInSprint", () => {
  it("is negative past the end and null without one", () => {
    expect(daysLeftInSprint(sprint, on(25))).toBe(-1);
    expect(daysLeftInSprint({ endDate: null }, on(25))).toBeNull();
  });
});

describe("isTaskOverdue", () => {
  it("flags unfinished work past its end date", () => {
    expect(isTaskOverdue({ endDate: on(12), status: "IN_PROGRESS" }, on(15))).toBe(true);
  });

  it("never flags finished work", () => {
    expect(isTaskOverdue({ endDate: on(12), status: "DONE" }, on(15))).toBe(false);
  });

  it("is not overdue on the due date itself", () => {
    expect(isTaskOverdue({ endDate: on(12), status: "TODO" }, on(12, 23))).toBe(false);
  });

  it("cannot be overdue without an end date", () => {
    expect(isTaskOverdue({ endDate: null, status: "TODO" }, on(30))).toBe(false);
  });
});

describe("summariseSprintClose", () => {
  const tasks = [
    { title: "Research Orientation", status: "DONE" },
    { title: "Research Gap", status: "TODO" },
    { title: "Research Question Drafting", status: "REVIEW" },
  ];

  it("names the open tasks rather than only counting them", () => {
    const s = summariseSprintClose(sprint, tasks, [], on(27));
    expect(s.totalTasks).toBe(3);
    expect(s.doneTasks).toBe(1);
    expect(s.openTaskTitles).toEqual(["Research Gap", "Research Question Drafting"]);
  });

  it("carries the timing so the dialog can say how late this is", () => {
    const s = summariseSprintClose(sprint, tasks, [], on(27));
    expect(s.phase).toBe("OVERDUE");
    expect(s.timing).toBe("3 days overdue");
  });

  it("counts unreviewed and rejected submissions separately", () => {
    const s = summariseSprintClose(sprint, tasks, [
      { status: "PENDING" },
      { status: "PENDING" },
      { status: "CHANGES_REQUESTED" },
      { status: "ACCEPTED" },
    ], on(27));
    expect(s.pendingSubmissions).toBe(2);
    expect(s.changesRequested).toBe(1);
  });

  it("treats a missing submission status as pending, never as done", () => {
    const s = summariseSprintClose(sprint, [], [{ status: null }, {}], on(27));
    expect(s.pendingSubmissions).toBe(2);
  });

  it("is clean only when nothing at all is outstanding", () => {
    expect(summariseSprintClose(sprint, tasks, [], on(27)).clean).toBe(false);
    expect(
      summariseSprintClose(sprint, [{ title: "x", status: "DONE" }], [{ status: "ACCEPTED" }], on(27))
        .clean
    ).toBe(true);
  });

  it("is clean for an empty sprint — there is nothing to warn about", () => {
    expect(summariseSprintClose(sprint, [], [], on(27)).clean).toBe(true);
  });
});

describe("picking the phase the programme is on", () => {
  // The rule shared by /api/my-sprint and the board's default selection: the first sprint not
  // closed, whatever the dates say. It used to also require the end date to be in the future,
  // which skipped an overdue sprint — so the one phase that needed closing was the one that
  // could not be selected, and a learner and a mentor disagreed about the current phase.
  const currentOf = (list: readonly { index: number; passed: boolean }[]) =>
    list.find((s) => !s.passed) ?? list[list.length - 1];

  const phases = [
    { index: 1, passed: false },
    { index: 2, passed: false },
    { index: 3, passed: false },
  ];

  it("is the first unclosed phase", () => {
    expect(currentOf(phases).index).toBe(1);
  });

  it("stays on an overdue phase rather than skipping to the next", () => {
    const overdue = { startDate: new Date(2026, 7, 4), endDate: new Date(2026, 7, 24), passed: false };
    expect(sprintPhase(overdue, on(27))).toBe("OVERDUE");
    // Overdue but unclosed is still the current phase.
    expect(currentOf(phases).index).toBe(1);
  });

  it("advances only as phases are closed", () => {
    expect(currentOf([{ index: 1, passed: true }, ...phases.slice(1)]).index).toBe(2);
    expect(
      currentOf([{ index: 1, passed: true }, { index: 2, passed: true }, { index: 3, passed: false }])
        .index
    ).toBe(3);
  });

  it("holds on the last phase once every one is closed", () => {
    const allClosed = phases.map((p) => ({ ...p, passed: true }));
    expect(currentOf(allClosed).index).toBe(3);
  });
});
