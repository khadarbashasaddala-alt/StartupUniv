import { describe, expect, it } from "vitest";
import {
  RECORDING_MAX_BYTES,
  canDeleteRecording,
  canUploadRecording,
  canViewRecording,
  formatBytes,
  formatDuration,
  hasRecording,
  recordingFileError,
  recordingObjectKey,
  uploadPercent,
} from "./meetingRecording";

const MB = 1024 * 1024;
const mentor = { userId: "m1", role: "MENTOR", isTeamMember: true };
const learner = { userId: "l1", role: "LEARNER", isTeamMember: true };
const admin = { userId: "a1", role: "ADMIN", isTeamMember: false };

describe("who can upload", () => {
  it("lets a mentor on the team upload", () => {
    expect(canUploadRecording(mentor)).toBe(true);
  });

  it("does not let a mentor upload to a team they are not on", () => {
    // A mentor spans several teams; being a mentor somewhere is not access everywhere.
    expect(canUploadRecording({ ...mentor, isTeamMember: false })).toBe(false);
  });

  it("lets an admin upload to any team without being a member", () => {
    expect(canUploadRecording(admin)).toBe(true);
  });

  it("does not let learners, founders or co-founders upload", () => {
    // Stricter than the MoM document beside it on purpose: the recording is the record of
    // whose session it was, so it should not be replaceable by an attendee.
    expect(canUploadRecording(learner)).toBe(false);
    expect(canUploadRecording({ role: "FOUNDER", isTeamMember: true })).toBe(false);
    expect(canUploadRecording({ role: "COFOUNDER", isTeamMember: true })).toBe(false);
  });

  it("treats a missing role as no permission", () => {
    expect(canUploadRecording({ isTeamMember: true })).toBe(false);
    expect(canUploadRecording({ role: null, isTeamMember: true })).toBe(false);
  });

  it("is case-insensitive about the role, since it arrives from several places", () => {
    expect(canUploadRecording({ role: "mentor", isTeamMember: true })).toBe(true);
    expect(canUploadRecording({ role: "admin" })).toBe(true);
  });
});

describe("who can watch", () => {
  it("lets every team member watch, whatever their role", () => {
    expect(canViewRecording(learner)).toBe(true);
    expect(canViewRecording(mentor)).toBe(true);
    expect(canViewRecording({ role: "FOUNDER", isTeamMember: true })).toBe(true);
  });

  it("lets an admin watch any team's", () => {
    expect(canViewRecording(admin)).toBe(true);
  });

  it("does not let someone outside the team watch", () => {
    expect(canViewRecording({ role: "LEARNER", isTeamMember: false })).toBe(false);
  });
});

describe("who can delete", () => {
  const uploaded = { recordingObjectKey: "k", recordingUploadedBy: "m1" };

  it("lets the mentor who uploaded it remove it", () => {
    expect(canDeleteRecording(mentor, uploaded)).toBe(true);
  });

  it("does not let one mentor delete another's session", () => {
    expect(canDeleteRecording({ ...mentor, userId: "m2" }, uploaded)).toBe(false);
  });

  it("lets an admin delete anyone's", () => {
    expect(canDeleteRecording(admin, uploaded)).toBe(true);
  });

  it("does not let a learner delete", () => {
    expect(canDeleteRecording(learner, uploaded)).toBe(false);
  });

  it("refuses when the uploader is unknown, rather than matching on two nulls", () => {
    expect(canDeleteRecording({ ...mentor, userId: null }, { recordingUploadedBy: null })).toBe(false);
  });
});

describe("recordingFileError", () => {
  it("accepts an mp4 within the cap", () => {
    expect(recordingFileError("session.mp4", "video/mp4", 400 * MB)).toBeNull();
  });

  it("accepts webm", () => {
    expect(recordingFileError("session.webm", "video/webm", 50 * MB)).toBeNull();
  });

  it("rejects mkv and mov, which upload fine and then will not play", () => {
    // The whole reason this is narrower than chat's video list.
    expect(recordingFileError("session.mkv", "video/x-matroska", MB)).toMatch(/MP4 or WebM/);
    expect(recordingFileError("session.mov", "video/quicktime", MB)).toMatch(/MP4 or WebM/);
  });

  it("rejects a document", () => {
    expect(recordingFileError("notes.pdf", "application/pdf", MB)).toMatch(/MP4 or WebM/);
  });

  it("rejects a file with no extension", () => {
    expect(recordingFileError("recording", "video/mp4", MB)).toMatch(/MP4 or WebM/);
  });

  it("rejects a disguised name even when the content type is right", () => {
    expect(recordingFileError("payload.exe", "video/mp4", MB)).toMatch(/MP4 or WebM/);
  });

  it("rejects a mismatched content type even when the extension is right", () => {
    // Both halves are checked because either alone can be fabricated.
    expect(recordingFileError("session.mp4", "application/x-msdownload", MB)).toMatch(/MP4 or WebM/);
  });

  it("accepts a right extension when the browser gave no content type at all", () => {
    // Some browsers report "" for an unusual container; the extension carries it.
    expect(recordingFileError("session.mp4", "", MB)).toBeNull();
    expect(recordingFileError("session.mp4", null, MB)).toBeNull();
  });

  it("requires a real size, because a presigned PUT cannot enforce one", () => {
    expect(recordingFileError("s.mp4", "video/mp4", 0)).toMatch(/empty/);
    expect(recordingFileError("s.mp4", "video/mp4", null)).toMatch(/empty/);
    expect(recordingFileError("s.mp4", "video/mp4", NaN)).toMatch(/empty/);
    expect(recordingFileError("s.mp4", "video/mp4", "600" as unknown as number)).toMatch(/empty/);
  });

  it("rejects over the cap and says how big it was", () => {
    const error = recordingFileError("s.mp4", "video/mp4", RECORDING_MAX_BYTES + 1);
    expect(error).toMatch(/2\.0 GB/);
    expect(error).toMatch(/720p/);
  });

  it("accepts a file exactly at the cap", () => {
    expect(recordingFileError("s.mp4", "video/mp4", RECORDING_MAX_BYTES)).toBeNull();
  });

  it("asks for a file when none was chosen", () => {
    expect(recordingFileError("", "video/mp4", MB)).toMatch(/Choose a file/);
    expect(recordingFileError("   ", "video/mp4", MB)).toMatch(/Choose a file/);
  });

  it("is case-insensitive about the extension", () => {
    expect(recordingFileError("SESSION.MP4", "video/mp4", MB)).toBeNull();
  });
});

describe("recordingObjectKey", () => {
  it("files the object under its team and meeting so it can be traced", () => {
    expect(recordingObjectKey("t1", "m1", "sprint review.mp4", "abc")).toBe(
      "meetings/recordings/t1/m1/abc.mp4"
    );
  });

  it("cannot be steered out of its prefix by the file name", () => {
    // The name is never used as a path segment — only its extension survives.
    const key = recordingObjectKey("t1", "m1", "../../../etc/passwd.mp4", "abc");
    expect(key).toBe("meetings/recordings/t1/m1/abc.mp4");
    expect(key).not.toContain("..");
  });

  it("falls back to mp4 when the name carries no extension", () => {
    expect(recordingObjectKey("t1", "m1", "recording", "abc")).toBe(
      "meetings/recordings/t1/m1/abc.mp4"
    );
  });
});

describe("hasRecording", () => {
  it("is false for a meeting with no recording, and for nothing at all", () => {
    expect(hasRecording(null)).toBe(false);
    expect(hasRecording(undefined)).toBe(false);
    expect(hasRecording({})).toBe(false);
    expect(hasRecording({ recordingObjectKey: null })).toBe(false);
    expect(hasRecording({ recordingObjectKey: "" })).toBe(false);
  });

  it("is true once a key is stored", () => {
    expect(hasRecording({ recordingObjectKey: "meetings/recordings/t/m/x.mp4" })).toBe(true);
  });
});

describe("formatting", () => {
  it("scales bytes to a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2 * 1024)).toBe("2.0 KB");
    expect(formatBytes(400 * MB)).toBe("400 MB");
    expect(formatBytes(1536 * MB)).toBe("1.5 GB");
  });

  it("accepts a numeric string, because bigint columns arrive as strings", () => {
    expect(formatBytes("419430400")).toBe("400 MB");
  });

  it("says nothing rather than '0 B' when the size is unknown", () => {
    expect(formatBytes(null)).toBe("");
    expect(formatBytes(0)).toBe("");
    expect(formatBytes("nonsense")).toBe("");
  });

  it("reads durations the way a session is described", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(48 * 60)).toBe("48 min");
    expect(formatDuration(3840)).toBe("1h 04m");
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(0)).toBe("");
  });
});

describe("uploadPercent", () => {
  it("reports progress through the upload", () => {
    expect(uploadPercent(0, 100)).toBe(0);
    expect(uploadPercent(50, 100)).toBe(50);
    expect(uploadPercent(100, 100)).toBe(100);
  });

  it("never returns a figure the bar cannot draw", () => {
    // total is 0 until the browser knows the length; loaded can exceed it with chunked encoding.
    expect(uploadPercent(10, 0)).toBe(0);
    expect(uploadPercent(150, 100)).toBe(100);
    expect(uploadPercent(-5, 100)).toBe(0);
  });
});
