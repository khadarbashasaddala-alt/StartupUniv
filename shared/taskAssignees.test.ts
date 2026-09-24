import { describe, expect, it } from "vitest";
import { assigneeIdsOf, buildRoster, resolveAssignees } from "./taskAssignees";

// The two roster shapes the API actually returns.
const boardRoster = [
  { userId: "u1", name: "CU Learner 1" },
  { userId: "u2", name: "CU Learner 2" },
];
const myTeamRoster = [{ id: "u3", name: "Founder Person" }];

describe("buildRoster", () => {
  it("accepts userId and id, because the two payloads disagree", () => {
    const roster = buildRoster(boardRoster, myTeamRoster);
    expect(roster.get("u1")?.name).toBe("CU Learner 1");
    expect(roster.get("u3")?.name).toBe("Founder Person");
  });

  it("survives a null roster — which is exactly what an admin gets from /api/my-team", () => {
    const roster = buildRoster(null, undefined, boardRoster);
    expect(roster.size).toBe(2);
  });

  it("lets the first source win, so the board's own team beats any fallback", () => {
    const roster = buildRoster(
      [{ userId: "u1", name: "Right name" }],
      [{ id: "u1", name: "Stale name" }]
    );
    expect(roster.get("u1")?.name).toBe("Right name");
  });

  it("skips members with no id at all rather than indexing undefined", () => {
    const roster = buildRoster([{ name: "Nameless id" } as any, ...boardRoster]);
    expect(roster.size).toBe(2);
  });
});

describe("assigneeIdsOf", () => {
  it("prefers the multi-assignee field", () => {
    expect(assigneeIdsOf({ assigneeId: "u9", assigneeIds: ["u1", "u2"] })).toEqual(["u1", "u2"]);
  });

  it("falls back to the single field", () => {
    expect(assigneeIdsOf({ assigneeId: "u1", assigneeIds: [] })).toEqual(["u1"]);
    expect(assigneeIdsOf({ assigneeId: "u1", assigneeIds: null })).toEqual(["u1"]);
  });

  it("returns nothing for an unassigned task", () => {
    expect(assigneeIdsOf({ assigneeId: null, assigneeIds: null })).toEqual([]);
  });
});

describe("resolveAssignees", () => {
  it("names the assignee of a task on a team the viewer is not on", () => {
    // The regression: this returned [] for an admin, so the dialog said "Not assigned".
    const roster = buildRoster(boardRoster, null);
    const people = resolveAssignees({ assigneeId: "u1", assigneeIds: ["u1"] }, roster);
    expect(people).toEqual([{ id: "u1", name: "CU Learner 1" }]);
  });

  it("returns everyone on a shared task, in order", () => {
    const roster = buildRoster(boardRoster);
    const people = resolveAssignees({ assigneeIds: ["u2", "u1"] }, roster);
    expect(people.map((p) => p.name)).toEqual(["CU Learner 2", "CU Learner 1"]);
  });

  it("drops an id nobody on the roster matches — a member who has since left", () => {
    const roster = buildRoster(boardRoster);
    const people = resolveAssignees({ assigneeIds: ["u1", "departed"] }, roster);
    expect(people.map((p) => p.id)).toEqual(["u1"]);
  });

  it("compares ids as strings, so a numeric id still matches", () => {
    const roster = buildRoster([{ userId: 7 as any, name: "Seven" }]);
    expect(resolveAssignees({ assigneeIds: [7 as any] }, roster)).toEqual([
      { id: "7", name: "Seven" },
    ]);
  });
});
