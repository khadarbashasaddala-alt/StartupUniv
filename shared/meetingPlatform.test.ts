import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEETING_PLATFORM,
  MEETING_LINK_MAX_LENGTH,
  isMeetingPlatform,
  meetingLinkError,
  meetingPlatformLabel,
  normaliseMeetingPlatform,
  shouldCreateGoogleMeetLink,
} from "./meetingPlatform";

describe("normalising the stored value", () => {
  it("keeps a known platform", () => {
    expect(normaliseMeetingPlatform("OTHER")).toBe("OTHER");
    expect(normaliseMeetingPlatform("GOOGLE_MEET")).toBe("GOOGLE_MEET");
  });

  it("falls back to Google Meet for anything else", () => {
    // Every meeting that existed before this column was added was a Meet meeting, so the
    // default has to be the one that describes them correctly.
    expect(normaliseMeetingPlatform(null)).toBe("GOOGLE_MEET");
    expect(normaliseMeetingPlatform(undefined)).toBe("GOOGLE_MEET");
    expect(normaliseMeetingPlatform("")).toBe("GOOGLE_MEET");
    expect(normaliseMeetingPlatform("ZOOM")).toBe("GOOGLE_MEET");
    expect(normaliseMeetingPlatform(7)).toBe("GOOGLE_MEET");
    expect(DEFAULT_MEETING_PLATFORM).toBe("GOOGLE_MEET");
  });

  it("recognises only the two platforms", () => {
    expect(isMeetingPlatform("OTHER")).toBe(true);
    expect(isMeetingPlatform("other")).toBe(false);
    expect(isMeetingPlatform("TEAMS")).toBe(false);
  });
});

describe("shouldCreateGoogleMeetLink", () => {
  it("asks Google only for a Meet meeting", () => {
    expect(shouldCreateGoogleMeetLink("GOOGLE_MEET")).toBe(true);
    expect(shouldCreateGoogleMeetLink("OTHER")).toBe(false);
  });
});

describe("meetingLinkError", () => {
  it("accepts an https link", () => {
    expect(meetingLinkError("OTHER", "https://zoom.us/j/1234567890")).toBeNull();
  });

  it("accepts a link with query and fragment, as Teams produces", () => {
    expect(
      meetingLinkError(
        "OTHER",
        "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%22Tid%22%3a%22x%22%7d"
      )
    ).toBeNull();
  });

  it("accepts plain http, since some internal tools still serve it", () => {
    expect(meetingLinkError("OTHER", "http://meet.internal.example.com/room/9")).toBeNull();
  });

  it("trims surrounding whitespace from a pasted link", () => {
    expect(meetingLinkError("OTHER", "  https://zoom.us/j/1  ")).toBeNull();
  });

  it("requires a link for an external meeting", () => {
    expect(meetingLinkError("OTHER", "")).toMatch(/Paste the link/);
    expect(meetingLinkError("OTHER", "   ")).toMatch(/Paste the link/);
    expect(meetingLinkError("OTHER", null)).toMatch(/Paste the link/);
  });

  it("refuses a javascript: URL", () => {
    // This value is handed to window.open() and emailed inside a calendar invite, so it is
    // refused outright rather than trusted to be inert wherever it lands.
    expect(meetingLinkError("OTHER", "javascript:alert(document.cookie)")).toMatch(/https:\/\//);
  });

  it("refuses data: and file: URLs", () => {
    expect(meetingLinkError("OTHER", "data:text/html,<script>alert(1)</script>")).toMatch(/https/);
    expect(meetingLinkError("OTHER", "file:///etc/passwd")).toMatch(/https/);
  });

  it("refuses something that is not a URL at all", () => {
    expect(meetingLinkError("OTHER", "ask me for the link")).toMatch(/does not look like a link/);
  });

  it("refuses a scheme with no real host", () => {
    expect(meetingLinkError("OTHER", "https://localhost")).toMatch(/no website address/);
  });

  it("refuses a link past the length cap", () => {
    const long = `https://zoom.us/j/${"9".repeat(MEETING_LINK_MAX_LENGTH)}`;
    expect(meetingLinkError("OTHER", long)).toMatch(/too long/);
  });

  it("never complains for a Google Meet meeting, whatever is passed", () => {
    // Google supplies that link, so there is nothing for a mentor to get wrong. An older client
    // that always posts the field is ignored rather than rejected.
    expect(meetingLinkError("GOOGLE_MEET", "")).toBeNull();
    expect(meetingLinkError("GOOGLE_MEET", null)).toBeNull();
    expect(meetingLinkError("GOOGLE_MEET", "not a link")).toBeNull();
  });
});

describe("meetingPlatformLabel", () => {
  it("names the well-known platforms from their link", () => {
    // "Other" is not something to show a learner — they want to know what they are opening.
    expect(meetingPlatformLabel("OTHER", "https://zoom.us/j/123")).toBe("Zoom");
    expect(meetingPlatformLabel("OTHER", "https://us02web.zoom.us/j/123")).toBe("Zoom");
    expect(meetingPlatformLabel("OTHER", "https://teams.microsoft.com/l/meetup-join/x")).toBe(
      "Microsoft Teams"
    );
    expect(meetingPlatformLabel("OTHER", "https://acme.webex.com/meet/x")).toBe("Webex");
    expect(meetingPlatformLabel("OTHER", "https://meet.jit.si/room")).toBe("Jitsi");
  });

  it("falls back to the domain for anything unrecognised", () => {
    expect(meetingPlatformLabel("OTHER", "https://www.bluejeans.com/123")).toBe("bluejeans.com");
    expect(meetingPlatformLabel("OTHER", "https://vc.college.edu.in/room/4")).toBe(
      "vc.college.edu.in"
    );
  });

  it("says Google Meet for a Meet meeting without needing the link", () => {
    expect(meetingPlatformLabel("GOOGLE_MEET")).toBe("Google Meet");
    expect(meetingPlatformLabel("GOOGLE_MEET", null)).toBe("Google Meet");
  });

  it("still says Google Meet when an external link happens to be a Meet one", () => {
    expect(meetingPlatformLabel("OTHER", "https://meet.google.com/abc-defg-hij")).toBe(
      "Google Meet"
    );
  });

  it("does not fall over on a missing or broken link", () => {
    expect(meetingPlatformLabel("OTHER", null)).toBe("External meeting");
    expect(meetingPlatformLabel("OTHER", "")).toBe("External meeting");
    expect(meetingPlatformLabel("OTHER", "nonsense")).toBe("External meeting");
  });
});
