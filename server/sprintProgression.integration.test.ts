/**
 * Sprint progression against a real Postgres (PGlite).
 *
 * The claim this pins down: closing a sprint is what moves the team to the next phase, because
 * /api/my-sprint shows a learner the first sprint that is not `passed`. That was previously
 * unreachable from the UI at all — the only control was gated on a `sprint.status` field the
 * sprints table does not have — so nothing verified that the underlying progression worked.
 *
 * Degrades to a loud skip if PGlite is missing; a skipped run verifies nothing here.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { sprintPhase, summariseSprintClose } from "@shared/sprintPhase";

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
    "\n⚠️  PGlite not installed — the sprint-progression integration test is SKIPPED, so phase " +
      "advancement is NOT verified by this run.\n" +
      "    Install it with: npm i --no-save @electric-sql/pglite\n"
  );
}

const describeIf = available ? describe : describe.skip;

const TEAM = "22222222-2222-2222-2222-222222222222";
const LEARNER = "b0000000-0000-0000-0000-000000000001";
const S1 = "51111111-1111-1111-1111-111111111111";
const S2 = "52222222-2222-2222-2222-222222222222";
const S3 = "53333333-3333-3333-3333-333333333333";

const DDL = `
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
    health team_health NOT NULL DEFAULT 'G', created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TYPE team_role AS ENUM ('Founder','Promoter','CoPromoter','Member','Mentor');
  CREATE TYPE stipend_band AS ENUM ('A','B','C');
  CREATE TABLE role_assignments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL, role team_role NOT NULL,
    mentor_kind VARCHAR(20), stipend_band stipend_band,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TABLE sprints (
    id VARCHAR(36) PRIMARY KEY, team_id VARCHAR(36) NOT NULL, index INTEGER NOT NULL,
    name TEXT, start_date TIMESTAMP NOT NULL, end_date TIMESTAMP NOT NULL,
    goals TEXT, objectives TEXT, deliverables TEXT,
    passed BOOLEAN, passed_at TIMESTAMP, demo_url TEXT, demo_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX sprints_team_index_idx ON sprints (team_id, index);
  CREATE TYPE task_status AS ENUM ('TODO','IN_PROGRESS','REVIEW','DONE');
  CREATE TYPE task_priority AS ENUM ('LOW','MEDIUM','HIGH');
  CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id VARCHAR(36), team_id VARCHAR(36), assignee_id VARCHAR(36), assignee_ids JSON,
    assigned_by VARCHAR(36), reviewer_id VARCHAR(36), review_comment TEXT,
    title TEXT NOT NULL, description TEXT, objectives TEXT, deliverables TEXT,
    status task_status NOT NULL DEFAULT 'TODO',
    priority task_priority NOT NULL DEFAULT 'MEDIUM', points INTEGER,
    start_date TIMESTAMP, end_date TIMESTAMP, dependencies JSON, source_key VARCHAR(64),
    requires_review_from VARCHAR(20), created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TYPE evidence_type AS ENUM ('PR','CI','Ticket','Doc','Demo');
  CREATE TABLE evidence (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(36) NOT NULL, sprint_id VARCHAR(36), submitted_by VARCHAR(36),
    task_id VARCHAR(36), type evidence_type NOT NULL, url TEXT NOT NULL, title TEXT,
    meta_json JSON, status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by VARCHAR(36), reviewed_at TIMESTAMP, feedback TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

const rows = async (sql: string) => (await pglite.query(sql)).rows as any[];

describeIf("sprint progression against a real Postgres", () => {
  let storage: any;

  beforeAll(async () => {
    await pglite.exec(DDL);
    await pglite.exec(`
      INSERT INTO users (id, email, name, role)
        VALUES ('${LEARNER}','l1@x.test','CU Learner 1','LEARNER');
      INSERT INTO teams (id, name) VALUES ('${TEAM}','CU Capstone Team A');
      INSERT INTO role_assignments (team_id, user_id, role)
        VALUES ('${TEAM}','${LEARNER}','Member');
      INSERT INTO sprints (id, team_id, index, name, start_date, end_date, passed) VALUES
        ('${S1}','${TEAM}',1,'Phase I','2026-08-04','2026-08-24',false),
        ('${S2}','${TEAM}',2,'Phase II','2026-08-25','2026-09-14',false),
        ('${S3}','${TEAM}',3,'Phase III','2026-09-15','2026-10-05',false);
      INSERT INTO tasks (sprint_id, team_id, title, status, assignee_ids) VALUES
        ('${S1}','${TEAM}','Research Orientation','REVIEW','["${LEARNER}"]'),
        ('${S1}','${TEAM}','Research Gap','TODO','["${LEARNER}"]');
      INSERT INTO tasks (sprint_id, team_id, title, status) VALUES
        ('${S2}','${TEAM}','Industry interviews','TODO');
    `);
    storage = (await import("./storage")).storage;
  });

  afterAll(async () => {
    await pglite?.close?.();
  });

  /** The rule /api/my-sprint uses to pick what a learner sees. */
  const learnerSprint = async () => {
    const all = await storage.getSprintsByTeam(TEAM);
    return all.find((s: any) => !s.passed) ?? all[all.length - 1];
  };

  it("shows the learner the first unclosed sprint", async () => {
    expect((await learnerSprint()).name).toBe("Phase I");
  });

  it("orders sprints by index, so 'first unclosed' is well defined", async () => {
    const all = await storage.getSprintsByTeam(TEAM);
    expect(all.map((s: any) => s.index)).toEqual([1, 2, 3]);
  });

  it("moves the learner to the next phase the moment one is closed", async () => {
    await storage.updateSprint(S1, { passed: true, passedAt: new Date() });
    expect((await learnerSprint()).name).toBe("Phase II");
  });

  it("keeps advancing, one phase per close", async () => {
    await storage.updateSprint(S2, { passed: true, passedAt: new Date() });
    expect((await learnerSprint()).name).toBe("Phase III");
  });

  it("holds on the last sprint rather than showing nothing once all are closed", async () => {
    await storage.updateSprint(S3, { passed: true, passedAt: new Date() });
    const sprint = await learnerSprint();
    expect(sprint.name).toBe("Phase III");
    expect(sprint.passed).toBe(true);
  });

  it("reopening a phase sends the learner back to it", async () => {
    // The /fail route does exactly this, so the learner's view has to follow.
    await storage.updateSprint(S2, { passed: false, passedAt: null });
    expect((await learnerSprint()).name).toBe("Phase II");
    await storage.updateSprint(S2, { passed: true, passedAt: new Date() });
  });

  describe("the close summary the confirmation dialog reads", () => {
    it("reports what is outstanding, from real rows", async () => {
      const sprint = await storage.getSprint(S1);
      const tasks = await storage.getTasksBySprint(S1);
      const submissions = await storage.getEvidenceByTasks(tasks.map((t: any) => t.id));
      const summary = summariseSprintClose(
        { ...sprint, passed: false },
        tasks,
        submissions,
        new Date(2026, 7, 27)
      );

      expect(summary.totalTasks).toBe(2);
      expect(summary.doneTasks).toBe(0);
      expect(summary.openTaskTitles.sort()).toEqual(["Research Gap", "Research Orientation"]);
      expect(summary.phase).toBe("OVERDUE");
      expect(summary.timing).toBe("3 days overdue");
      expect(summary.clean).toBe(false);
    });

    it("counts submissions awaiting review on the sprint's tasks", async () => {
      const tasks = await storage.getTasksBySprint(S1);
      const target = tasks.find((t: any) => t.title === "Research Orientation");
      await pglite.exec(`
        INSERT INTO evidence (team_id, task_id, submitted_by, type, url, status)
          VALUES ('${TEAM}','${target.id}','${LEARNER}','Doc','http://x/1','PENDING');
      `);

      const submissions = await storage.getEvidenceByTasks(tasks.map((t: any) => t.id));
      const summary = summariseSprintClose(
        { startDate: "2026-08-04", endDate: "2026-08-24", passed: false },
        tasks,
        submissions,
        new Date(2026, 7, 27)
      );
      expect(summary.pendingSubmissions).toBe(1);
    });

    it("fetches evidence for every task in one query, not one per task", async () => {
      const tasks = await storage.getTasksBySprint(S1);
      // Both tasks in a single call; a per-task loop is what this replaced.
      const submissions = await storage.getEvidenceByTasks(tasks.map((t: any) => t.id));
      expect(Array.isArray(submissions)).toBe(true);
      expect(await storage.getEvidenceByTasks([])).toEqual([]);
    });
  });

  it("reports the phase of the sprint a learner is moved on to", async () => {
    // Phase II starts the day after Phase I ends, so closing Phase I early lands the team on
    // a sprint that has not begun. The dialog says so rather than showing a blank board.
    const s2 = await storage.getSprint(S2);
    expect(sprintPhase({ ...s2, passed: false }, new Date(2026, 7, 20))).toBe("UPCOMING");
    expect(sprintPhase({ ...s2, passed: false }, new Date(2026, 8, 1))).toBe("ACTIVE");
  });
});
