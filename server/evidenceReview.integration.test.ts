/**
 * Evidence review against a real Postgres (PGlite): the migration, the per-person verdicts,
 * and the queue that decides who sees what.
 *
 * The unit tests in shared/evidenceReview.test.ts prove the rules in isolation; this proves the
 * SQL and the storage layer driving them, which pure functions cannot reach.
 *
 * Degrades to a loud skip if PGlite is missing — but a skipped run verifies nothing here.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    "\n⚠️  PGlite not installed — the evidence-review integration test is SKIPPED, so the " +
      "migration and queue behaviour are NOT verified by this run.\n" +
      "    Install it with: npm i --no-save @electric-sql/pglite\n"
  );
}

const describeIf = available ? describe : describe.skip;

const TEAM = "22222222-2222-2222-2222-222222222222";
const OTHER_TEAM = "33333333-3333-3333-3333-333333333333";
const SPRINT = "44444444-4444-4444-4444-444444444444";
const ADMIN = "a0000000-0000-0000-0000-000000000001";
const ACADEMIC = "a0000000-0000-0000-0000-000000000002";
const INDUSTRY = "a0000000-0000-0000-0000-000000000003";
const LEARNER_1 = "b0000000-0000-0000-0000-000000000001";
const LEARNER_2 = "b0000000-0000-0000-0000-000000000002";
const OUTSIDER = "c0000000-0000-0000-0000-000000000001";

/** The tables as they stand BEFORE this migration, so the migration itself is what adds the columns. */
const BASE_DDL = `
  CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY, email TEXT, password TEXT, name TEXT, phone TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'LEARNER', is_admin BOOLEAN NOT NULL DEFAULT false,
    org_id VARCHAR(36), avatar_url TEXT, keycloak_id TEXT,
    first_time_login BOOLEAN, experience_flag BOOLEAN, custom_tag TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(), password_changed_at TIMESTAMP
  );
  CREATE TYPE team_health AS ENUM ('R','A','G');
  CREATE TABLE teams (
    id VARCHAR(36) PRIMARY KEY, cohort_id VARCHAR(36), name TEXT NOT NULL,
    problem_statement_id VARCHAR(36), escrow_account_ref TEXT,
    health team_health NOT NULL DEFAULT 'G',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TYPE team_role AS ENUM ('Founder','Promoter','CoPromoter','Member','Mentor');
  CREATE TYPE stipend_band AS ENUM ('A','B','C');
  CREATE TABLE role_assignments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
    role team_role NOT NULL, stipend_band stipend_band,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TABLE sprints (
    id VARCHAR(36) PRIMARY KEY, team_id VARCHAR(36) NOT NULL, index INTEGER NOT NULL,
    start_date TIMESTAMP NOT NULL, end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TYPE task_status AS ENUM ('TODO','IN_PROGRESS','REVIEW','DONE');
  CREATE TYPE task_priority AS ENUM ('LOW','MEDIUM','HIGH');
  CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id VARCHAR(36), team_id VARCHAR(36), assignee_id VARCHAR(36), assignee_ids JSON,
    assigned_by VARCHAR(36), reviewer_id VARCHAR(36), review_comment TEXT,
    title TEXT NOT NULL, description TEXT, objectives TEXT, deliverables TEXT,
    status task_status NOT NULL DEFAULT 'TODO',
    priority task_priority NOT NULL DEFAULT 'MEDIUM', points INTEGER,
    start_date TIMESTAMP, end_date TIMESTAMP, dependencies JSON,
    source_key VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TYPE evidence_type AS ENUM ('PR','CI','Ticket','Doc','Demo');
  CREATE TABLE evidence (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(36) NOT NULL, sprint_id VARCHAR(36), submitted_by VARCHAR(36),
    task_id VARCHAR(36), type evidence_type NOT NULL, url TEXT NOT NULL, title TEXT,
    meta_json JSON, created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(36) NOT NULL, type TEXT, title TEXT, message TEXT, status TEXT,
    metadata_json JSON, created_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

const rows = async (sql: string) => (await pglite.query(sql)).rows as any[];

describeIf("evidence review against a real Postgres", () => {
  let storage: any;

  beforeAll(async () => {
    await pglite.exec(BASE_DDL);

    await pglite.exec(`
      INSERT INTO users (id, email, name, role) VALUES
        ('${ADMIN}','admin@x.test','Admin','ADMIN'),
        ('${ACADEMIC}','ac@x.test','Academic Mentor','MENTOR'),
        ('${INDUSTRY}','ind@x.test','Industry Mentor','MENTOR'),
        ('${LEARNER_1}','l1@x.test','Learner One','LEARNER'),
        ('${LEARNER_2}','l2@x.test','Learner Two','LEARNER'),
        ('${OUTSIDER}','out@x.test','Outsider','LEARNER');
      INSERT INTO teams (id, name) VALUES ('${TEAM}','Capstone A'), ('${OTHER_TEAM}','Capstone B');
      INSERT INTO sprints (id, team_id, index, start_date, end_date)
        VALUES ('${SPRINT}','${TEAM}',1, now(), now() + interval '14 days');
    `);

    // A DONE task with evidence, to prove the backfill.
    await pglite.exec(`
      INSERT INTO tasks (id, sprint_id, team_id, title, status)
        VALUES ('d0000000-0000-0000-0000-0000000000ff','${SPRINT}','${TEAM}','Already finished','DONE');
      INSERT INTO evidence (id, team_id, task_id, submitted_by, type, url)
        VALUES ('e0000000-0000-0000-0000-0000000000ff','${TEAM}','d0000000-0000-0000-0000-0000000000ff','${LEARNER_1}','Doc','http://x/old');
    `);

    // The migration under test.
    const sql = readFileSync(join(process.cwd(), "scripts/sql/add-evidence-review.sql"), "utf8");
    await pglite.exec(sql);

    await pglite.exec(`
      INSERT INTO role_assignments (team_id, user_id, role, mentor_kind) VALUES
        ('${TEAM}','${ACADEMIC}','Mentor','ACADEMIC'),
        ('${TEAM}','${INDUSTRY}','Mentor','INDUSTRY'),
        ('${TEAM}','${LEARNER_1}','Member',NULL),
        ('${TEAM}','${LEARNER_2}','Member',NULL),
        ('${OTHER_TEAM}','${OUTSIDER}','Member',NULL);
    `);

    storage = (await import("./storage")).storage;
  });

  afterAll(async () => {
    await pglite?.close?.();
  });

  it("adds the columns, the check constraints and the partial index", async () => {
    const cols = await rows(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='evidence' AND column_name IN ('status','reviewed_by','reviewed_at','feedback')`);
    expect(cols).toHaveLength(4);

    const idx = await rows(`
      SELECT indexdef FROM pg_indexes WHERE indexname='evidence_pending_review_idx'`);
    expect(idx[0].indexdef).toMatch(/WHERE .*status/i);

    await expect(
      pglite.exec(`UPDATE evidence SET status='NONSENSE' WHERE id='e0000000-0000-0000-0000-0000000000ff'`)
    ).rejects.toThrow();
  });

  it("backfills evidence on already-finished tasks so the queue is not flooded", async () => {
    const [row] = await rows(
      `SELECT status FROM evidence WHERE id='e0000000-0000-0000-0000-0000000000ff'`
    );
    expect(row.status).toBe("ACCEPTED");
  });

  it("records a verdict, who gave it, and when", async () => {
    const taskId = "d0000000-0000-0000-0000-000000000001";
    await pglite.exec(`
      INSERT INTO tasks (id, sprint_id, team_id, title, status, assignee_ids)
        VALUES ('${taskId}','${SPRINT}','${TEAM}','Shared task','REVIEW','["${LEARNER_1}","${LEARNER_2}"]');
      INSERT INTO evidence (id, team_id, task_id, submitted_by, type, url) VALUES
        ('e0000000-0000-0000-0000-000000000001','${TEAM}','${taskId}','${LEARNER_1}','Doc','http://x/1'),
        ('e0000000-0000-0000-0000-000000000002','${TEAM}','${taskId}','${LEARNER_2}','Doc','http://x/2');
    `);

    await storage.reviewEvidence("e0000000-0000-0000-0000-000000000001", {
      status: "ACCEPTED",
      reviewedBy: ACADEMIC,
    });
    const [accepted] = await rows(
      `SELECT status, reviewed_by, reviewed_at, feedback FROM evidence WHERE id='e0000000-0000-0000-0000-000000000001'`
    );
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.reviewed_by).toBe(ACADEMIC);
    expect(accepted.reviewed_at).not.toBeNull();
    expect(accepted.feedback).toBeNull();

    await storage.reviewEvidence("e0000000-0000-0000-0000-000000000002", {
      status: "CHANGES_REQUESTED",
      feedback: "Add the cleaning steps you ran",
      reviewedBy: ACADEMIC,
    });
    const [changed] = await rows(
      `SELECT status, feedback FROM evidence WHERE id='e0000000-0000-0000-0000-000000000002'`
    );
    expect(changed.status).toBe("CHANGES_REQUESTED");
    expect(changed.feedback).toBe("Add the cleaning steps you ran");
  });

  it("accepting one person's work does not accept the other's — the whole point", async () => {
    const all = await storage.getEvidenceByTask("d0000000-0000-0000-0000-000000000001");
    const byUser = Object.fromEntries(all.map((e: any) => [e.submittedBy, e.status]));
    expect(byUser[LEARNER_1]).toBe("ACCEPTED");
    expect(byUser[LEARNER_2]).toBe("CHANGES_REQUESTED");
  });

  it("clears stale feedback when a resubmission is finally accepted", async () => {
    await storage.reviewEvidence("e0000000-0000-0000-0000-000000000002", {
      status: "ACCEPTED",
      reviewedBy: ACADEMIC,
    });
    const [row] = await rows(
      `SELECT status, feedback FROM evidence WHERE id='e0000000-0000-0000-0000-000000000002'`
    );
    expect(row.status).toBe("ACCEPTED");
    expect(row.feedback).toBeNull();
  });

  describe("the review queue", () => {
    const industryTask = "d0000000-0000-0000-0000-000000000002";

    beforeAll(async () => {
      await pglite.exec(`
        INSERT INTO tasks (id, sprint_id, team_id, title, status, assignee_ids, requires_review_from)
          VALUES ('${industryTask}','${SPRINT}','${TEAM}','Needs the industry mentor','REVIEW','["${LEARNER_1}"]','INDUSTRY');
        INSERT INTO evidence (id, team_id, task_id, submitted_by, type, url)
          VALUES ('e0000000-0000-0000-0000-000000000003','${TEAM}','${industryTask}','${LEARNER_1}','Demo','http://x/3');
      `);
    });

    it("shows the task to BOTH mentors, flagging whose it primarily is", async () => {
      // The kind is advisory. An academic mentor must not be locked out of a task marked
      // INDUSTRY, or work stalls whenever the named kind is away or the team has none.
      const forIndustry = await storage.getEvidencePendingReviewFor(INDUSTRY);
      const mineIndustry = forIndustry.find((e: any) => e.id === "e0000000-0000-0000-0000-000000000003");
      expect(mineIndustry).toBeDefined();
      expect(mineIndustry.preferredForMe).toBe(true);

      const forAcademic = await storage.getEvidencePendingReviewFor(ACADEMIC);
      const mineAcademic = forAcademic.find((e: any) => e.id === "e0000000-0000-0000-0000-000000000003");
      expect(mineAcademic).toBeDefined();          // visible
      expect(mineAcademic.preferredForMe).toBe(false); // but not primarily theirs
    });

    it("lets the academic mentor actually review a task marked INDUSTRY", async () => {
      const updated = await storage.reviewEvidence("e0000000-0000-0000-0000-000000000003", {
        status: "ACCEPTED",
        reviewedBy: ACADEMIC,
      });
      expect(updated.status).toBe("ACCEPTED");
      expect(updated.reviewedBy).toBe(ACADEMIC);

      // Put it back so the later queue tests still have something pending.
      await pglite.exec(
        `UPDATE evidence SET status='PENDING', reviewed_by=NULL, reviewed_at=NULL
           WHERE id='e0000000-0000-0000-0000-000000000003'`
      );
    });

    it("shows an admin everything, without filtering by kind", async () => {
      const forAdmin = await storage.getEvidencePendingReviewFor(ADMIN);
      expect(forAdmin.map((e: any) => e.id)).toContain("e0000000-0000-0000-0000-000000000003");
    });

    it("never shows submissions from a team you are not on", async () => {
      const forOutsider = await storage.getEvidencePendingReviewFor(OUTSIDER);
      expect(forOutsider).toHaveLength(0);
    });

    it("carries the context a reviewer needs to act without another request", async () => {
      const [item] = (await storage.getEvidencePendingReviewFor(INDUSTRY)).filter(
        (e: any) => e.id === "e0000000-0000-0000-0000-000000000003"
      );
      expect(item.submitterName).toBe("Learner One");
      expect(item.taskTitle).toBe("Needs the industry mentor");
      expect(item.teamName).toBe("Capstone A");
      expect(item.requiresReviewFrom).toBe("INDUSTRY");
    });

    it("drops out of the queue once reviewed", async () => {
      await storage.reviewEvidence("e0000000-0000-0000-0000-000000000003", {
        status: "ACCEPTED",
        reviewedBy: INDUSTRY,
      });
      const forIndustry = await storage.getEvidencePendingReviewFor(INDUSTRY);
      expect(forIndustry.map((e: any) => e.id)).not.toContain("e0000000-0000-0000-0000-000000000003");
    });
  });

  it("is idempotent — re-running the migration changes nothing", async () => {
    const before = await rows(`SELECT id, status FROM evidence ORDER BY id`);
    const sql = readFileSync(join(process.cwd(), "scripts/sql/add-evidence-review.sql"), "utf8");
    await pglite.exec(sql);
    const after = await rows(`SELECT id, status FROM evidence ORDER BY id`);
    expect(after).toEqual(before);
  });
});
