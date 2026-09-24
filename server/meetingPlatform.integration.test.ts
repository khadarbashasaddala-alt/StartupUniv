/**
 * The meeting_platform migration against a real Postgres (PGlite).
 *
 * shared/meetingPlatform.test.ts proves the rules — what counts as a valid link, what each
 * platform is called. What it cannot reach is the thing most likely to go wrong here: whether the
 * column's default correctly classifies the meetings that already existed. Every one of them was
 * a Google Meet meeting, and if they came out NULL they would read as external meetings whose
 * link is missing.
 *
 * Degrades to a loud skip if PGlite is missing — but a skipped run verifies nothing here.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normaliseMeetingPlatform } from "@shared/meetingPlatform";

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
    "\n⚠️  PGlite not installed — the meeting-platform integration test is SKIPPED, so the " +
      "migration and its default are NOT verified by this run.\n" +
      "    Install it with: npm i --no-save @electric-sql/pglite\n"
  );
}

const describeIf = available ? describe : describe.skip;

const TEAM = "22222222-2222-2222-2222-222222222222";
const MENTOR = "a0000000-0000-0000-0000-000000000002";
const LEGACY = "e2000000-0000-0000-0000-000000000001";
const EXTERNAL = "e2000000-0000-0000-0000-000000000002";

/** team_meetings before either of the new columns, so the migrations are what add them. */
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

const sqlFile = (name: string) =>
  readFileSync(join(process.cwd(), "scripts/sql", name), "utf8");

describeIf("meeting platform against a real Postgres", () => {
  let storage: any;

  beforeAll(async () => {
    await pglite.exec(BASE_DDL);
    await pglite.exec(`
      INSERT INTO users (id, email, name, role)
        VALUES ('${MENTOR}','mentor@x.test','CU Mentor 2','MENTOR');
      INSERT INTO team_meetings (id, team_id, created_by, title, scheduled_at, meeting_link)
        VALUES ('${LEGACY}','${TEAM}','${MENTOR}','A meeting from before the column',
                now() - interval '2 days', 'https://meet.google.com/abc-defg-hij');
    `);

    // Both migrations, in the order the deploy runs them.
    await pglite.exec(sqlFile("add-meeting-recordings.sql"));
    await pglite.exec(sqlFile("add-meeting-platform.sql"));

    storage = (await import("./storage")).storage;
  });

  afterAll(async () => {
    await pglite?.close?.();
  });

  it("classifies every pre-existing meeting as Google Meet", async () => {
    // The assertion that matters. These rows predate the column, and Meet is what they all were.
    const legacy = await storage.getTeamMeeting(LEGACY);
    expect(legacy.meetingPlatform).toBe("GOOGLE_MEET");
    expect(normaliseMeetingPlatform(legacy.meetingPlatform)).toBe("GOOGLE_MEET");
  });

  it("makes the column NOT NULL with a default, so no row can lack a platform", async () => {
    const { rows } = await pglite.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
        WHERE table_name = 'team_meetings' AND column_name = 'meeting_platform'`
    );
    expect(rows[0].is_nullable).toBe("NO");
    expect(String(rows[0].column_default)).toContain("GOOGLE_MEET");
  });

  it("refuses a row that tries to store NULL explicitly", async () => {
    await expect(
      pglite.exec(
        `INSERT INTO team_meetings (team_id, created_by, title, scheduled_at, meeting_platform)
           VALUES ('${TEAM}','${MENTOR}','No platform', now(), NULL)`
      )
    ).rejects.toThrow();
  });

  it("stores an external meeting with the mentor's own link", async () => {
    await pglite.exec(`
      INSERT INTO team_meetings (id, team_id, created_by, title, scheduled_at, meeting_link, meeting_platform)
        VALUES ('${EXTERNAL}','${TEAM}','${MENTOR}','Zoom session', now() - interval '1 hour',
                'https://us02web.zoom.us/j/1234567890', 'OTHER');
    `);

    const external = await storage.getTeamMeeting(EXTERNAL);
    expect(external.meetingPlatform).toBe("OTHER");
    expect(external.meetingLink).toContain("zoom.us");
    // No Google event, because the portal did not create the conference.
    expect(external.googleEventId).toBeNull();
  });

  it("lets a mentor switch a meeting to an external link", async () => {
    await storage.updateTeamMeeting(LEGACY, {
      meetingPlatform: "OTHER",
      meetingLink: "https://teams.microsoft.com/l/meetup-join/x",
    });
    const moved = await storage.getTeamMeeting(LEGACY);
    expect(moved.meetingPlatform).toBe("OTHER");
    expect(moved.meetingLink).toContain("teams.microsoft.com");
  });

  it("is idempotent, because the deploy runs it on every release", async () => {
    await expect(pglite.exec(sqlFile("add-meeting-platform.sql"))).resolves.toBeDefined();
    // And re-running must not reset a row that was deliberately changed.
    const moved = await storage.getTeamMeeting(LEGACY);
    expect(moved.meetingPlatform).toBe("OTHER");
  });

  it("leaves the recording columns working alongside it", async () => {
    // Both migrations touch the same table; this proves the second did not disturb the first.
    await storage.updateTeamMeeting(EXTERNAL, {
      recordingObjectKey: `meetings/recordings/${TEAM}/${EXTERNAL}/x.mp4`,
      recordingSizeBytes: 412_000_000,
    });
    const saved = await storage.getTeamMeeting(EXTERNAL);
    expect(saved.recordingObjectKey).toContain("x.mp4");
    expect(Number(saved.recordingSizeBytes)).toBe(412_000_000);
    expect(saved.meetingPlatform).toBe("OTHER");
  });
});
