/**
 * Session recordings against a real Postgres (PGlite): the migration, and the storage layer
 * round-trip that the route handlers rely on.
 *
 * shared/meetingRecording.test.ts proves the rules — who may upload, what files are allowed —
 * in isolation. What those cannot reach is whether the columns survive contact with Postgres,
 * and one of them is a real trap: the 2GB upload cap is exactly one byte past what INTEGER
 * holds, so a file at the limit would pass every validation and then fail to insert.
 *
 * Degrades to a loud skip if PGlite is missing — but a skipped run verifies nothing here.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RECORDING_MAX_BYTES } from "@shared/meetingRecording";

let pglite: any;
let available = false;

try {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const schema = await import("@shared/schema");

  pglite = new PGlite();
  const testDb = drizzle(pglite as any, { schema });
  vi.doMock("./db", () => ({ db: testDb, pool: {} }));
  available = true;
} catch {
  console.warn(
    "\n⚠️  PGlite not installed — the meeting-recording integration test is SKIPPED, so the " +
      "migration and the 2GB size column are NOT verified by this run.\n" +
      "    Install it with: npm i --no-save @electric-sql/pglite\n"
  );
}

const describeIf = available ? describe : describe.skip;

const TEAM = "22222222-2222-2222-2222-222222222222";
const MENTOR = "a0000000-0000-0000-0000-000000000002";
const MEETING = "e1000000-0000-0000-0000-000000000001";
const OLD_MEETING = "e1000000-0000-0000-0000-000000000002";

/** team_meetings as it stood BEFORE this migration, so the migration is what adds the columns. */
const BASE_DDL = `
  CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY, email TEXT, password TEXT, name TEXT, phone TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'LEARNER', is_admin BOOLEAN NOT NULL DEFAULT false,
    org_id VARCHAR(36), avatar_url TEXT, keycloak_id TEXT,
    first_time_login BOOLEAN, experience_flag BOOLEAN, custom_tag TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(), password_changed_at TIMESTAMP
  );
  CREATE TABLE team_meetings (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(36) NOT NULL,
    created_by VARCHAR(36) NOT NULL,
    title TEXT NOT NULL,
    agenda TEXT,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    meeting_link TEXT,
    google_event_id TEXT,
    attendee_ids TEXT[],
    sprint_id VARCHAR(36),
    notes TEXT,
    mom_title TEXT,
    mom_date TIMESTAMP,
    mom_document TEXT,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

const MIGRATION = () =>
  readFileSync(join(process.cwd(), "scripts/sql/add-meeting-recordings.sql"), "utf8");

/**
 * Applied here as well, because Drizzle's generated SELECT names every column in the schema: once
 * meeting_platform existed in shared/schema.ts, every storage call against team_meetings failed
 * with "column does not exist" until this ran. That is the same mechanism that took the task board
 * down in production — code shipped ahead of its migration — reproduced by this suite, which is
 * the point of having it.
 */
const PLATFORM_MIGRATION = () =>
  readFileSync(join(process.cwd(), "scripts/sql/add-meeting-platform.sql"), "utf8");

describeIf("meeting session recordings against a real Postgres", () => {
  let storage: any;

  beforeAll(async () => {
    await pglite.exec(BASE_DDL);
    await pglite.exec(`
      INSERT INTO users (id, email, name, role)
        VALUES ('${MENTOR}','mentor@x.test','CU Mentor 1','MENTOR');
      INSERT INTO team_meetings (id, team_id, created_by, title, scheduled_at)
        VALUES ('${OLD_MEETING}','${TEAM}','${MENTOR}','Session before the migration', now() - interval '2 days');
    `);

    // The migration under test, applied to a table that already holds a row.
    await pglite.exec(MIGRATION());
    // Everything the schema selects has to exist, not only what this file is about.
    await pglite.exec(PLATFORM_MIGRATION());

    await pglite.exec(`
      INSERT INTO team_meetings (id, team_id, created_by, title, scheduled_at)
        VALUES ('${MEETING}','${TEAM}','${MENTOR}','Sprint 1 review session', now() - interval '1 day');
    `);

    storage = (await import("./storage")).storage;
  });

  afterAll(async () => {
    await pglite?.close?.();
  });

  describe("the migration", () => {
    it("adds every column the code selects", async () => {
      // Drizzle's generated SELECT names every column in the schema, so a missing one does not
      // degrade this feature — it makes every query against team_meetings fail. That is exactly
      // how the evidence-review deploy took the task board down.
      const { rows } = await pglite.query(
        `SELECT column_name, is_nullable FROM information_schema.columns
          WHERE table_name = 'team_meetings' AND column_name LIKE 'recording%'
          ORDER BY column_name`
      );
      expect(rows.map((r: any) => r.column_name)).toEqual([
        "recording_content_type",
        "recording_duration_seconds",
        "recording_file_name",
        "recording_object_key",
        "recording_size_bytes",
        "recording_uploaded_at",
        "recording_uploaded_by",
      ]);
      // All nullable: every meeting that already existed has no recording, and the migration
      // must not need a default or a backfill to apply.
      expect(rows.every((r: any) => r.is_nullable === "YES")).toBe(true);
    });

    it("makes the size column bigint, not integer", async () => {
      // The cap is 2GB = 2147483648, and INTEGER stops at 2147483647.
      const { rows } = await pglite.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_name = 'team_meetings' AND column_name = 'recording_size_bytes'`
      );
      expect(rows[0].data_type).toBe("bigint");
    });

    it("creates a partial index, so it stays small as meetings accumulate", async () => {
      const { rows } = await pglite.query(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'team_meetings_recording_idx'`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].indexdef).toMatch(/WHERE \(?recording_object_key IS NOT NULL\)?/i);
    });

    it("is idempotent, because the deploy runs it on every release", async () => {
      await expect(pglite.exec(MIGRATION())).resolves.toBeDefined();
      const { rows } = await pglite.query(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_name = 'team_meetings' AND column_name LIKE 'recording%'`
      );
      expect(rows[0].n).toBe(7);
    });

    it("leaves a meeting that predates it readable and recording-free", async () => {
      const old = await storage.getTeamMeeting(OLD_MEETING);
      expect(old.title).toBe("Session before the migration");
      expect(old.recordingObjectKey).toBeNull();
      expect(old.recordingSizeBytes).toBeNull();
    });
  });

  describe("storing a recording", () => {
    it("round-trips every field the player needs", async () => {
      const uploadedAt = new Date("2026-08-18T06:30:00Z");
      await storage.updateTeamMeeting(MEETING, {
        recordingObjectKey: `meetings/recordings/${TEAM}/${MEETING}/abc123.mp4`,
        recordingFileName: "sprint-1-review.mp4",
        recordingSizeBytes: 487_000_000,
        recordingContentType: "video/mp4",
        recordingDurationSeconds: 3840,
        recordingUploadedBy: MENTOR,
        recordingUploadedAt: uploadedAt,
      });

      const saved = await storage.getTeamMeeting(MEETING);
      expect(saved.recordingObjectKey).toBe(`meetings/recordings/${TEAM}/${MEETING}/abc123.mp4`);
      expect(saved.recordingFileName).toBe("sprint-1-review.mp4");
      expect(Number(saved.recordingSizeBytes)).toBe(487_000_000);
      expect(saved.recordingContentType).toBe("video/mp4");
      expect(saved.recordingDurationSeconds).toBe(3840);
      expect(saved.recordingUploadedBy).toBe(MENTOR);
      expect(new Date(saved.recordingUploadedAt).toISOString()).toBe(uploadedAt.toISOString());
    });

    it("stores a file at exactly the 2GB cap", async () => {
      // The assertion this whole file exists for. With INTEGER this throws
      // "value out of range", and it would only ever have surfaced in production, on the one
      // upload big enough to hit it, after the mentor had already waited out the transfer.
      await storage.updateTeamMeeting(MEETING, { recordingSizeBytes: RECORDING_MAX_BYTES });
      const saved = await storage.getTeamMeeting(MEETING);
      expect(Number(saved.recordingSizeBytes)).toBe(2147483648);
      expect(RECORDING_MAX_BYTES).toBeGreaterThan(2147483647);
    });

    it("clears back to nothing when a recording is removed", async () => {
      await storage.updateTeamMeeting(MEETING, {
        recordingObjectKey: null,
        recordingFileName: null,
        recordingSizeBytes: null,
        recordingContentType: null,
        recordingDurationSeconds: null,
        recordingUploadedBy: null,
        recordingUploadedAt: null,
      });

      const saved = await storage.getTeamMeeting(MEETING);
      expect(saved.recordingObjectKey).toBeNull();
      expect(saved.recordingSizeBytes).toBeNull();
      expect(saved.recordingUploadedBy).toBeNull();
      // The meeting itself must survive having its recording removed.
      expect(saved.title).toBe("Sprint 1 review session");
    });

    it("does not disturb the MoM document sharing the row", async () => {
      await storage.updateTeamMeeting(MEETING, {
        momTitle: "Sprint 1 notes",
        momDocument: "meetings/mom/1/notes.pdf",
      });
      await storage.updateTeamMeeting(MEETING, {
        recordingObjectKey: `meetings/recordings/${TEAM}/${MEETING}/xyz.mp4`,
      });

      const saved = await storage.getTeamMeeting(MEETING);
      expect(saved.momTitle).toBe("Sprint 1 notes");
      expect(saved.momDocument).toBe("meetings/mom/1/notes.pdf");
      expect(saved.recordingObjectKey).toContain("xyz.mp4");
    });
  });
});
