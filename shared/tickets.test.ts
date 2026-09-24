/**
 * The tag-driven mentor classification behind the academic-mentor ticket gate.
 *
 * Mentors are classified by their admin-assigned custom tag, which is free text —
 * so the matching has to survive casing and the "acadamic" spelling that is
 * already live in production data.
 */
import { describe, expect, it } from "vitest";
import { heldForForwardMessage, mentorKindFromTag } from "./tickets";

describe("mentorKindFromTag", () => {
  it("recognises the production tags exactly as the admin wrote them", () => {
    expect(mentorKindFromTag("Academic Mentor")).toBe("ACADEMIC");
    expect(mentorKindFromTag("Industry Mentor")).toBe("INDUSTRY");
  });

  it("is case-insensitive", () => {
    expect(mentorKindFromTag("ACADEMIC MENTOR")).toBe("ACADEMIC");
    expect(mentorKindFromTag("industry mentor")).toBe("INDUSTRY");
  });

  it("tolerates the 'acadamic' spelling already used in tags", () => {
    expect(mentorKindFromTag("acadamic mentor")).toBe("ACADEMIC");
  });

  it("returns null for missing or unrelated tags", () => {
    expect(mentorKindFromTag(null)).toBeNull();
    expect(mentorKindFromTag(undefined)).toBeNull();
    expect(mentorKindFromTag("")).toBeNull();
    expect(mentorKindFromTag("Top Performer")).toBeNull();
  });

  it("does not read 'industry' out of an academic tag or vice versa", () => {
    // A tag naming both is ambiguous; academic wins because the gate errs on
    // the side of the first-look review.
    expect(mentorKindFromTag("Academic and Industry")).toBe("ACADEMIC");
  });
});

describe("heldForForwardMessage", () => {
  it("names both mentors so the learner knows exactly where the ticket sits", () => {
    const msg = heldForForwardMessage("Manisha", "Bikash Das");
    expect(msg).toContain("Academic Mentor (Manisha)");
    expect(msg).toContain("Industry Mentor (Bikash Das)");
  });
});
