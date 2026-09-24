import { describe, expect, it } from "vitest";
import {
  assigneesOf,
  memberStatsTotals,
  memberTaskStats,
  UNASSIGNED,
} from "./memberTaskStats";

const NOW = new Date(2026, 7, 13); // 13 Aug 2026, matching the live board
const day = (d: number) => new Date(2026, 7, d);

const members = [
  { userId: "u1", name: "CU Learner 1" },
  { userId: "u3", name: "CU Learner 3" },
  { userId: "u5", name: "CU Learner 5" },
];

const find = (rows: ReturnType<typeof memberTaskStats>, userId: string) =>
  rows.find((r) => r.userId === userId)!;

describe("assigneesOf", () => {
  it("prefers the multi-assignee field", () => {
    expect(assigneesOf({ id: "t", assigneeId: "u9", assigneeIds: ["u1", "u3"] })).toEqual(["u1", "u3"]);
  });

  it("falls back to the single field", () => {
    expect(assigneesOf({ id: "t", assigneeId: "u1", assigneeIds: [] })).toEqual(["u1"]);
    expect(assigneesOf({ id: "t", assigneeId: "u1", assigneeIds: null })).toEqual(["u1"]);
  });

  it("is empty for an unassigned task", () => {
    expect(assigneesOf({ id: "t" })).toEqual([]);
  });
});

describe("memberTaskStats", () => {
  it("counts assigned, done, outstanding and overdue per person", () => {
    const rows = memberTaskStats(
      [
        { id: "a", title: "Done one", status: "DONE", assigneeIds: ["u1"], endDate: day(10) },
        { id: "b", title: "Open, in time", status: "TODO", assigneeIds: ["u1"], endDate: day(20) },
        { id: "c", title: "Open, late", status: "TODO", assigneeIds: ["u1"], endDate: day(10) },
      ],
      members,
      NOW
    );

    expect(find(rows, "u1")).toMatchObject({
      name: "CU Learner 1",
      assigned: 3,
      done: 1,
      outstanding: 2,
      overdue: 1,
    });
  });

  it("counts a shared task once for each assignee", () => {
    // The question is what each person is carrying, not how the columns sum to the team total.
    const rows = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["u1", "u3", "u5"], endDate: day(20) }],
      members,
      NOW
    );
    expect(find(rows, "u1").assigned).toBe(1);
    expect(find(rows, "u3").assigned).toBe(1);
    expect(find(rows, "u5").assigned).toBe(1);
  });

  it("buckets ownerless work under Unassigned rather than dropping it", () => {
    const rows = memberTaskStats(
      [
        { id: "a", status: "TODO" },
        { id: "b", status: "TODO", assigneeIds: [] },
        { id: "c", status: "TODO", assigneeIds: ["u1"] },
      ],
      members,
      NOW
    );
    expect(find(rows, UNASSIGNED).assigned).toBe(2);
  });

  it("keeps Unassigned last, because it is a total and not a person", () => {
    const rows = memberTaskStats(
      [
        { id: "a", status: "TODO" },
        { id: "b", status: "TODO", assigneeIds: ["u1"], endDate: day(1) },
      ],
      members,
      NOW
    );
    expect(rows[rows.length - 1].userId).toBe(UNASSIGNED);
  });

  it("lists a member with nothing assigned, so an empty row says so", () => {
    const rows = memberTaskStats([], members, NOW);
    expect(rows).toHaveLength(3);
    expect(find(rows, "u5")).toMatchObject({ assigned: 0, outstanding: 0, overdue: 0 });
  });

  it("orders by overdue then outstanding, so the trouble is at the top", () => {
    // No unassigned task here, so there is deliberately no Unassigned row to order.
    const rows = memberTaskStats(
      [
        { id: "a", status: "TODO", assigneeIds: ["u5"], endDate: day(20) },
        { id: "b", status: "TODO", assigneeIds: ["u3"], endDate: day(20) },
        { id: "c", status: "TODO", assigneeIds: ["u3"], endDate: day(20) },
        { id: "d", status: "TODO", assigneeIds: ["u1"], endDate: day(1) },
      ],
      members,
      NOW
    );
    expect(rows.map((r) => r.userId)).toEqual(["u1", "u3", "u5"]);
  });

  it("only shows an Unassigned row when something is actually unassigned", () => {
    const withNone = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["u1"] }],
      members,
      NOW
    );
    expect(withNone.some((r) => r.userId === UNASSIGNED)).toBe(false);

    const withSome = memberTaskStats([{ id: "a", status: "TODO" }], members, NOW);
    expect(withSome.some((r) => r.userId === UNASSIGNED)).toBe(true);
  });

  it("never counts finished work as overdue, however old", () => {
    const rows = memberTaskStats(
      [{ id: "a", status: "DONE", assigneeIds: ["u1"], endDate: day(1) }],
      members,
      NOW
    );
    expect(find(rows, "u1")).toMatchObject({ done: 1, outstanding: 0, overdue: 0 });
  });

  it("does not treat a task with no end date as late", () => {
    const rows = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["u1"], endDate: null }],
      members,
      NOW
    );
    expect(find(rows, "u1").overdue).toBe(0);
  });

  describe("the per-task detail", () => {
    it("separates late-and-unsubmitted from late-but-waiting-on-review", () => {
      // Only the first is the assignee's problem, so only the first should read as their failure.
      const rows = memberTaskStats(
        [
          { id: "a", status: "REVIEW", assigneeIds: ["u1"], endDate: day(10), submitters: ["u1"] },
          { id: "b", status: "TODO", assigneeIds: ["u1"], endDate: day(10), submitters: [] },
        ],
        members,
        NOW
      );
      const detail = Object.fromEntries(find(rows, "u1").tasks.map((t) => [t.id, t]));
      expect(detail.a).toMatchObject({ overdue: true, submitted: true, lateAndUnsubmitted: false });
      expect(detail.b).toMatchObject({ overdue: true, submitted: false, lateAndUnsubmitted: true });
    });

    it("does not flag unsubmitted work that is still in time", () => {
      // The decision this pins: red means late, not merely unfinished. Without it, a fresh
      // sprint would render almost entirely red and the colour would stop carrying meaning.
      const rows = memberTaskStats(
        [{ id: "a", status: "TODO", assigneeIds: ["u1"], endDate: day(20), submitters: [] }],
        members,
        NOW
      );
      expect(find(rows, "u1").tasks[0]).toMatchObject({
        submitted: false,
        overdue: false,
        lateAndUnsubmitted: false,
      });
    });

    it("does not flag a task with no end date, however long unsubmitted", () => {
      const rows = memberTaskStats(
        [{ id: "a", status: "TODO", assigneeIds: ["u1"], endDate: null, submitters: [] }],
        members,
        NOW
      );
      expect(find(rows, "u1").tasks[0].lateAndUnsubmitted).toBe(false);
    });

    it("records who was asked for changes, per person", () => {
      const rows = memberTaskStats(
        [
          {
            id: "a",
            status: "IN_PROGRESS",
            assigneeIds: ["u1", "u3"],
            endDate: day(20),
            submitters: ["u1", "u3"],
            changesRequestedBy: ["u3"],
          },
        ],
        members,
        NOW
      );
      expect(find(rows, "u1").tasks[0].changesRequested).toBe(false);
      expect(find(rows, "u3").tasks[0].changesRequested).toBe(true);
    });

    it("carries both dates through for the table to show", () => {
      const rows = memberTaskStats(
        [{ id: "a", status: "TODO", assigneeIds: ["u1"], startDate: day(7), endDate: day(12) }],
        members,
        NOW
      );
      expect(find(rows, "u1").tasks[0].startDate).toEqual(day(7));
      expect(find(rows, "u1").tasks[0].endDate).toEqual(day(12));
    });
  });

  it("still counts work assigned to somebody no longer on the team", () => {
    // Dropping it would quietly understate the outstanding work on the board.
    const rows = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["gone"], endDate: day(1) }],
      members,
      NOW
    );
    expect(find(rows, "gone")).toMatchObject({ assigned: 1, overdue: 1, formerMember: true });
  });

  it("falls back to a readable label only when even the task cannot name them", () => {
    const rows = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["gone"] }],
      members,
      NOW
    );
    expect(find(rows, "gone").name).toBe("Unknown member");
  });
});

describe("naming somebody no longer on the team", () => {
  it("uses the name the task carries, not a placeholder", () => {
    // The regression this fixes: the row read "Former member", which flags a problem without
    // saying whose work has to be reassigned.
    const rows = memberTaskStats(
      [
        {
          id: "a",
          status: "TODO",
          assigneeIds: ["gone"],
          endDate: day(1),
          assigneeNames: { gone: "CU Learner 1" },
        },
      ],
      members,
      NOW
    );
    expect(find(rows, "gone")).toMatchObject({ name: "CU Learner 1", formerMember: true });
  });

  it("does not mark a current member as former", () => {
    const rows = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["u1"] }],
      members,
      NOW
    );
    expect(find(rows, "u1").formerMember).toBe(false);
  });

  it("puts orphaned work first, ahead of overdue", () => {
    const rows = memberTaskStats(
      [
        { id: "a", status: "TODO", assigneeIds: ["u1"], endDate: day(1) },
        { id: "b", status: "TODO", assigneeIds: ["gone"], assigneeNames: { gone: "Departed" } },
      ],
      members,
      NOW
    );
    expect(rows[0].userId).toBe("gone");
  });
});

describe("who appears in the table", () => {
  const withMentor = [
    ...members,
    { userId: "m1", name: "CU Mentor 2", role: "MENTOR" },
    { userId: "adm", name: "Admin User", role: "ADMIN" },
  ];

  it("leaves mentors and admins out — they assign work, they do not receive it", () => {
    const rows = memberTaskStats([], withMentor, NOW);
    expect(rows.map((r) => r.userId)).not.toContain("m1");
    expect(rows.map((r) => r.userId)).not.toContain("adm");
    expect(rows).toHaveLength(3);
  });

  it("still shows a mentor who somehow holds a task, rather than losing the task", () => {
    const rows = memberTaskStats(
      [{ id: "a", status: "TODO", assigneeIds: ["m1"], assigneeNames: { m1: "CU Mentor 2" } }],
      withMentor,
      NOW
    );
    expect(find(rows, "m1").assigned).toBe(1);
  });
});

describe("points", () => {
  it("weighs the load rather than counting tasks alone", () => {
    const rows = memberTaskStats(
      [
        { id: "a", status: "DONE", assigneeIds: ["u1"], points: 5 },
        { id: "b", status: "TODO", assigneeIds: ["u1"], points: 3 },
      ],
      members,
      NOW
    );
    expect(find(rows, "u1")).toMatchObject({ points: 8, donePoints: 5 });
  });

  it("treats a task with no points as one point", () => {
    const rows = memberTaskStats([{ id: "a", status: "TODO", assigneeIds: ["u1"] }], members, NOW);
    expect(find(rows, "u1").points).toBe(1);
  });
});

describe("memberStatsTotals", () => {
  const rows = () =>
    memberTaskStats(
      [
        { id: "a", status: "DONE", assigneeIds: ["u1"], points: 2 },
        { id: "b", status: "TODO", assigneeIds: ["u1"], endDate: day(1), points: 3 },
        { id: "c", status: "TODO", assigneeIds: ["u3"], endDate: day(20) },
        { id: "d", status: "TODO" },
        { id: "e", status: "TODO", assigneeIds: ["gone"], assigneeNames: { gone: "Departed" } },
      ],
      members,
      NOW
    );

  it("sums the people, not the Unassigned row", () => {
    const t = memberStatsTotals(rows());
    expect(t).toMatchObject({ assigned: 4, done: 1, outstanding: 3, overdue: 1 });
  });

  it("reports unassigned and orphaned work separately, for the top of the page", () => {
    const t = memberStatsTotals(rows());
    expect(t.unassignedTasks).toBe(1);
    expect(t.formerMemberTasks).toBe(1);
  });

  it("counts how many members have nothing at all, so the table can collapse them", () => {
    const t = memberStatsTotals(rows());
    expect(t.members).toBe(4); // u1, u3, u5 and the departed member
    expect(t.idleMembers).toBe(1); // u5
  });

  it("totals points as well as counts", () => {
    const t = memberStatsTotals(rows());
    expect(t.points).toBe(7); // 2 + 3 + 1 + 1
    expect(t.donePoints).toBe(2);
  });
});
