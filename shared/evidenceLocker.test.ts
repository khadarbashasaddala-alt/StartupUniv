import { describe, expect, it } from "vitest";
import { ALL_SUBMITTERS, matchesEvidenceLockerFilter, submittersOf } from "./evidenceLocker";

describe("submittersOf", () => {
  it("lists each person once, from what they've actually submitted", () => {
    const rows = submittersOf([
      { submittedBy: "u1", submitterName: "Aravind P" },
      { submittedBy: "u1", submitterName: "Aravind P" },
      { submittedBy: "u2", submitterName: "Drishti Agrawal" },
    ]);
    expect(rows).toEqual([
      { id: "u1", name: "Aravind P" },
      { id: "u2", name: "Drishti Agrawal" },
    ]);
  });

  it("excludes a member who has submitted nothing", () => {
    // The whole point of building the list from evidence rather than the roster: an empty
    // option would be a name a viewer could pick and land on nothing, wondering if it broke.
    expect(submittersOf([{ submittedBy: null, submitterName: null }])).toEqual([]);
    expect(submittersOf([])).toEqual([]);
  });

  it("sorts alphabetically, case-insensitively", () => {
    const rows = submittersOf([
      { submittedBy: "u1", submitterName: "zach" },
      { submittedBy: "u2", submitterName: "Aravind" },
      { submittedBy: "u3", submitterName: "manu" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Aravind", "manu", "zach"]);
  });

  it("falls back to Unknown only when no item ever names them", () => {
    const rows = submittersOf([{ submittedBy: "u1", submitterName: null }]);
    expect(rows).toEqual([{ id: "u1", name: "Unknown" }]);
  });

  it("upgrades from Unknown once a later item does carry the name", () => {
    // A single row with a failed name lookup should not downgrade someone who is named
    // correctly everywhere else they appear.
    const rows = submittersOf([
      { submittedBy: "u1", submitterName: null },
      { submittedBy: "u1", submitterName: "Aravind P" },
    ]);
    expect(rows).toEqual([{ id: "u1", name: "Aravind P" }]);
  });

  it("does not let a later blank overwrite a name already found", () => {
    const rows = submittersOf([
      { submittedBy: "u1", submitterName: "Aravind P" },
      { submittedBy: "u1", submitterName: null },
    ]);
    expect(rows).toEqual([{ id: "u1", name: "Aravind P" }]);
  });

  it("treats a blank string the same as a missing name", () => {
    const rows = submittersOf([{ submittedBy: "u1", submitterName: "   " }]);
    expect(rows).toEqual([{ id: "u1", name: "Unknown" }]);
  });
});

describe("matchesEvidenceLockerFilter", () => {
  const item = { type: "PR", submittedBy: "u1", submitterName: "Aravind P" };

  it("passes everything when both filters are at their default", () => {
    expect(matchesEvidenceLockerFilter(item, "all", ALL_SUBMITTERS)).toBe(true);
  });

  it("filters by type alone", () => {
    expect(matchesEvidenceLockerFilter(item, "PR", ALL_SUBMITTERS)).toBe(true);
    expect(matchesEvidenceLockerFilter(item, "Doc", ALL_SUBMITTERS)).toBe(false);
  });

  it("filters by submitter alone", () => {
    expect(matchesEvidenceLockerFilter(item, "all", "u1")).toBe(true);
    expect(matchesEvidenceLockerFilter(item, "all", "u2")).toBe(false);
  });

  it("requires both filters to agree when both are set", () => {
    expect(matchesEvidenceLockerFilter(item, "PR", "u1")).toBe(true);
    expect(matchesEvidenceLockerFilter(item, "PR", "u2")).toBe(false);
    expect(matchesEvidenceLockerFilter(item, "Doc", "u1")).toBe(false);
  });
});
