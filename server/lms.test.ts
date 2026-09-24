import { describe, expect, it } from "vitest";
import { DEFAULT_LMS_START_URL, resolveLmsStartUrl } from "./lms";

describe("resolveLmsStartUrl", () => {
  it("sends learners to Rooman's Moodle login by default", () => {
    // The case that matters in production: no MOODLE_* variable reaches the container, and this
    // used to mean a 500 and a button that looked broken.
    expect(resolveLmsStartUrl({})).toBe("https://learn.rooman.com/login/index.php");
    expect(DEFAULT_LMS_START_URL).toBe("https://learn.rooman.com/login/index.php");
  });

  it("prefers an explicitly configured start URL", () => {
    expect(
      resolveLmsStartUrl({ MOODLE_OAUTH2_START_URL: "https://learn.rooman.com/auth/oauth2/" })
    ).toBe("https://learn.rooman.com/auth/oauth2/");
  });

  it("lets the explicit URL win over a base URL", () => {
    expect(
      resolveLmsStartUrl({
        MOODLE_OAUTH2_START_URL: "https://sso.example.com/start",
        MOODLE_BASE_URL: "https://learn.rooman.com",
      })
    ).toBe("https://sso.example.com/start");
  });

  it("derives the OAuth entry point from a base URL", () => {
    expect(resolveLmsStartUrl({ MOODLE_BASE_URL: "https://learn.rooman.com" })).toBe(
      "https://learn.rooman.com/auth/oauth2/"
    );
  });

  it("does not double the slash when the base has a trailing one", () => {
    expect(resolveLmsStartUrl({ MOODLE_BASE_URL: "https://learn.rooman.com///" })).toBe(
      "https://learn.rooman.com/auth/oauth2/"
    );
  });

  it("treats blank configuration as absent rather than as a URL", () => {
    // An env var set to "" is how a missing secret usually arrives, and redirecting to "" would
    // send the browser back to the portal root looking like nothing happened.
    expect(resolveLmsStartUrl({ MOODLE_OAUTH2_START_URL: "" })).toBe(DEFAULT_LMS_START_URL);
    expect(resolveLmsStartUrl({ MOODLE_OAUTH2_START_URL: "   " })).toBe(DEFAULT_LMS_START_URL);
    expect(resolveLmsStartUrl({ MOODLE_BASE_URL: "  " })).toBe(DEFAULT_LMS_START_URL);
  });

  it("trims a pasted value with surrounding whitespace", () => {
    expect(resolveLmsStartUrl({ MOODLE_OAUTH2_START_URL: "  https://x.test/go  " })).toBe(
      "https://x.test/go"
    );
  });
});
