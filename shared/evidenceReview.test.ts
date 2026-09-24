import { describe, expect, it } from "vitest";
import {
  completionBlockedReason,
  latestPerSubmitter,
  isPreferredReviewer,
  reviewInputError,
  summariseEvidence,
} from "./evidenceReview";

describe("reviewInputError", () => {
  it("accepts an acceptance with no feedback", () => {
    expect(reviewInputError("ACCEPTED", undefined)).toBeNull();
  });

  it("requires feedback when asking for changes", () => {
    expect(reviewInputError("CHANGES_REQUESTED", "")).toMatch(/what needs changing/i);
    expect(reviewInputError("CHANGES_REQUESTED", "  ")).toMatch(/what needs changing/i);
    expect(reviewInputError("CHANGES_REQUESTED", "Axis labels are missing")).toBeNull();
  });

  it("refuses to put evidence back to pending", () => {
    expect(reviewInputError("PENDING", "x")).toMatch(/cannot set evidence back/i);
  });

  it("rejects a status that is not a review verdict", () => {
    expect(reviewInputError("DONE", "x")).toMatch(/must be ACCEPTED or CHANGES_REQUESTED/);
    expect(reviewInputError(undefined, undefined)).toMatch(/must be ACCEPTED/);
  });
});

describe("summariseEvidence", () => {
  it("counts each verdict and treats a missing status as pending", () => {
    const s = summariseEvidence([
      { status: "ACCEPTED" },
      { status: "CHANGES_REQUESTED" },
      { status: null },
      {},
    ]);
    expect(s).toMatchObject({ total: 4, accepted: 1, changesRequested: 1, pending: 2 });
    expect(s.allAccepted).toBe(false);
  });

  it("is allAccepted only when there is something to accept", () => {
    expect(summariseEvidence([]).allAccepted).toBe(false);
    expect(summariseEvidence([{ status: "ACCEPTED" }]).allAccepted).toBe(true);
  });
});

describe("completionBlockedReason", () => {
  it("does not block a task that has no evidence at all", () => {
    // Deliberate: evidence is not mandatory, so this must not retroactively block
    // tasks that were always going to be completed without any.
    expect(completionBlockedReason([])).toBeNull();
  });

  it("does not block once every submission is accepted", () => {
    expect(completionBlockedReason([{ status: "ACCEPTED" }, { status: "ACCEPTED" }])).toBeNull();
  });

  it("blocks while a submission is still awaiting review, and says how many", () => {
    const why = completionBlockedReason([{ status: "ACCEPTED" }, { status: "PENDING" }]);
    expect(why).toMatch(/1 of 2 submissions accepted/);
    expect(why).toMatch(/1 still awaiting review/);
  });

  it("blocks while changes are outstanding", () => {
    const why = completionBlockedReason([
      { status: "ACCEPTED" },
      { status: "CHANGES_REQUESTED" },
      { status: "PENDING" },
    ]);
    expect(why).toMatch(/1 of 3 submissions accepted/);
    expect(why).toMatch(/1 with changes requested/);
  });
});

describe("isPreferredReviewer", () => {
  // Advisory only — this decides what a reviewer is shown first, never what they may do.
  // Permission lives in canReviewEvidenceOnTask, and any mentor on the team passes it.
  it("treats a task that names no kind as everyone's", () => {
    expect(isPreferredReviewer(null, null)).toBe(true);
    expect(isPreferredReviewer(undefined, "ACADEMIC")).toBe(true);
  });

  it("marks the kind the task asks for as preferred", () => {
    expect(isPreferredReviewer("INDUSTRY", "INDUSTRY")).toBe(true);
  });

  it("does not mark the other kind as preferred — but does not block it either", () => {
    expect(isPreferredReviewer("INDUSTRY", "ACADEMIC")).toBe(false);
  });

  it("does not mark an untyped mentor as preferred for a task that names a kind", () => {
    expect(isPreferredReviewer("ACADEMIC", null)).toBe(false);
  });
});

describe("latestPerSubmitter", () => {
  it("keeps only each person's newest attempt", () => {
    const rows = [
      { id: "old", submittedBy: "u1", createdAt: "2026-08-01T00:00:00Z", status: "CHANGES_REQUESTED" },
      { id: "new", submittedBy: "u1", createdAt: "2026-08-05T00:00:00Z", status: "PENDING" },
      { id: "other", submittedBy: "u2", createdAt: "2026-08-02T00:00:00Z", status: "ACCEPTED" },
    ];
    expect(latestPerSubmitter(rows).map((r) => r.id).sort()).toEqual(["new", "other"]);
  });

  it("keeps rows with no submitter, so they cannot slip through unreviewed", () => {
    const rows = [{ id: "anon", submittedBy: null, createdAt: "2026-08-01T00:00:00Z" }];
    expect(latestPerSubmitter(rows).map((r) => r.id)).toEqual(["anon"]);
  });

  it("prefers a dated row over an undated one", () => {
    const rows = [
      { id: "undated", submittedBy: "u1" },
      { id: "dated", submittedBy: "u1", createdAt: "2026-08-05T00:00:00Z" },
    ];
    expect(latestPerSubmitter(rows).map((r) => r.id)).toEqual(["dated"]);
  });
});

describe("completionBlockedReason after a resubmission", () => {
  // The bug this fixes: a rejected attempt plus its replacement made the task impossible to
  // complete, because the reviewer would also have had to accept the attempt they rejected.
  const rejected = { submittedBy: "u1", createdAt: "2026-08-01T00:00:00Z", status: "CHANGES_REQUESTED" };

  it("does not count a superseded attempt against the task", () => {
    const resubmitted = { submittedBy: "u1", createdAt: "2026-08-05T00:00:00Z", status: "ACCEPTED" };
    expect(completionBlockedReason([rejected, resubmitted])).toBeNull();
  });

  it("still blocks while the newest attempt is unreviewed", () => {
    const resubmitted = { submittedBy: "u1", createdAt: "2026-08-05T00:00:00Z", status: "PENDING" };
    expect(completionBlockedReason([rejected, resubmitted])).toMatch(/1 still awaiting review/);
  });

  it("counts each person once, however many attempts they made", () => {
    const rows = [
      rejected,
      { submittedBy: "u1", createdAt: "2026-08-05T00:00:00Z", status: "ACCEPTED" },
      { submittedBy: "u2", createdAt: "2026-08-05T00:00:00Z", status: "PENDING" },
    ];
    expect(completionBlockedReason(rows)).toMatch(/1 of 2 submissions accepted/);
  });
});
