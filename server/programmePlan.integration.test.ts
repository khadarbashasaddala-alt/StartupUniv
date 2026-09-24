/**
 * Integration test for the programme plan import, against a real Postgres.
 *
 * Runs the ACTUAL storage.applyProgrammePlan — real drizzle queries, real transactions, and the
 * real partial unique index — against an in-process Postgres (PGlite). The unit tests in
 * shared/programmePlan.test.ts prove the diff logic in isolation; this proves the SQL it drives
 * behaves as designed, which is the part no amount of pure-function testing can reach.
 *
 * `./db` is mocked with a PGlite-backed drizzle instance. Everything under test is untouched
 * production code.
 *
 * PGlite is a devDependency, so this runs by default. It degrades to a loud skip if the package is
 * somehow missing rather than failing the build — but note that a skipped run verifies NOTHING
 * here, and the suite still reports green, so treat the warning as a real problem.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  deriveSprintWindows,
  parseCsv,
  parsePlanSheet,
  sampleTemplateCsv,
} from "@shared/programmePlan";

// --- boot an in-process Postgres and point drizzle at it ------------------------------------
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
} catch (error) {
  console.warn(
    "\n⚠️  PGlite not installed — the programme-plan integration test is SKIPPED, so the SQL " +
      "and transaction behaviour are NOT verified by this run.\n" +
      "    Install it with: npm i --no-save @electric-sql/pglite\n"
  );
}

const describeIf = available ? describe : describe.skip;

const COHORT_ID = "11111111-1111-1111-1111-111111111111";
const TEAM_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_TEAM_ID = "33333333-3333-3333-3333-333333333333";

/**
 * The four tables this exercises, created WITHOUT source_key so the migration under test is what
 * adds it — the same order production will see.
 */
const BASE_DDL = `
  CREATE TABLE cohorts (
    id VARCHAR(36) PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TABLE teams (
    id VARCHAR(36) PRIMARY KEY,
    cohort_id VARCHAR(36) NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE TABLE sprints (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id VARCHAR(36) NOT NULL,
    index INTEGER NOT NULL,
    name TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    goals TEXT,
    objectives TEXT,
    deliverables TEXT,
    passed BOOLEAN,
    passed_at TIMESTAMP,
    demo_url TEXT,
    demo_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX sprints_team_index_idx ON sprints (team_id, index);
  CREATE TYPE task_status AS ENUM ('TODO','IN_PROGRESS','REVIEW','DONE');
  CREATE TABLE tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id VARCHAR(36),
    team_id VARCHAR(36),
    assignee_id VARCHAR(36),
    assignee_ids JSON,
    assigned_by VARCHAR(36),
    reviewer_id VARCHAR(36),
    review_comment TEXT,
    title TEXT NOT NULL,
    description TEXT,
    objectives TEXT,
    deliverables TEXT,
    status task_status NOT NULL DEFAULT 'TODO',
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    points INTEGER DEFAULT 1,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    dependencies JSON,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    -- Added by scripts/sql/add-evidence-review.sql (a different migration than the one
    -- under test here); declared so drizzle's generated SELECT matches the real schema.
    requires_review_from VARCHAR(20)
  );
`;

/** 4 Aug 2026, matching the live CU capstone board. */
const COHORT_START = "2026-08-04 00:00:00";

async function rows(sql: string): Promise<any[]> {
  const result = await pglite.query(sql);
  return result.rows;
}

describeIf("programme plan import against a real Postgres", () => {
  let storage: any;

  beforeAll(async () => {
    await pglite.exec(BASE_DDL);

    // The migration under test, run against a tasks table that predates it.
    const migration = readFileSync(
      join(process.cwd(), "scripts/sql/add-task-source-key.sql"),
      "utf8"
    );
    await pglite.exec(migration);
    // Idempotency of the migration itself: production may well run it twice.
    await pglite.exec(migration);

    await pglite.exec(`
      INSERT INTO cohorts (id, name, start_date, end_date)
        VALUES ('${COHORT_ID}', 'CU Capstone', '${COHORT_START}', '2026-12-31 00:00:00');
      INSERT INTO teams (id, cohort_id, name)
        VALUES ('${TEAM_ID}', '${COHORT_ID}', 'CU Capstone Team A'),
               ('${OTHER_TEAM_ID}', '${COHORT_ID}', 'CU Capstone Team B');
    `);

    // Imported after the mock is registered so it picks up the PGlite-backed db.
    ({ storage } = await import("./storage"));
  }, 120_000);

  afterAll(async () => {
    await pglite?.close?.();
  });

  it("added source_key and a PARTIAL unique index", async () => {
    const [column] = await rows(`
      SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'tasks' AND column_name = 'source_key';
    `);
    expect(column).toBeDefined();
    expect(column.is_nullable).toBe("YES");

    const [index] = await rows(`
      SELECT indexdef FROM pg_indexes
        WHERE tablename = 'tasks' AND indexname = 'tasks_sprint_source_key_idx';
    `);
    expect(index).toBeDefined();
    // Non-partial would make every hand-made task (source_key NULL) collide.
    expect(index.indexdef).toMatch(/WHERE \(source_key IS NOT NULL\)/i);
  });

  it("creates the sprints and tasks from the shipped template", async () => {
    const parsed = parsePlanSheet(parseCsv(sampleTemplateCsv()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const diff = await storage.applyProgrammePlan(
      TEAM_ID,
      parsed.plan,
      new Date(2026, 7, 4) // local midnight, exactly as pg hands back a timestamp column
    );

    expect(diff.summary.sprintsCreated).toBe(2);
    expect(diff.summary.tasksCreated).toBe(3);

    const sprintRows = await rows(
      `SELECT index, name, start_date, end_date FROM sprints WHERE team_id = '${TEAM_ID}' ORDER BY index;`
    );
    expect(sprintRows).toHaveLength(2);

    // Sprint windows are asserted by their SHAPE, not their absolute value, and the reason is
    // worth spelling out so nobody "fixes" production to satisfy this file.
    //
    // PGlite and node-postgres serialise a Date differently for `timestamp without time zone`:
    //
    //   node-postgres (production) sends "2026-08-04T00:00:00.000+05:30" — local wall time with an
    //     offset, which Postgres truncates, storing 2026-08-04 00:00:00. The calendar day survives.
    //   PGlite sends the UTC instant and then reads it back as local, so a round trip shifts by the
    //     zone offset. Neither the wall clock nor the instant survives it.
    //
    // Under PGlite no absolute timestamp assertion is meaningful, so what is checked here is what
    // the driver cannot distort: the windows are the right LENGTH and butt up against each other
    // with no gap or overlap. Differences are offset-invariant because both endpoints shift alike.
    // The absolute calendar day is covered by the unit tests, and the node-postgres serialisation
    // it depends on is pinned by its own test below.
    const DAY = 24 * 60 * 60 * 1000;
    const spanDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

    expect(spanDays(sprintRows[0].start_date, sprintRows[0].end_date)).toBe(13); // 14 days inclusive
    expect(spanDays(sprintRows[1].start_date, sprintRows[1].end_date)).toBe(13);
    expect(spanDays(sprintRows[0].end_date, sprintRows[1].start_date)).toBe(1); // back to back

    // And the diff the storage layer reported does carry the right calendar days.
    const expected = deriveSprintWindows(parsed.plan.sprints, new Date(2026, 7, 4));
    const day = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(day(expected[0].startDate)).toBe("2026-08-04");
    expect(day(diff.sprints[0].startDate)).toBe("2026-08-04");
    expect(day(diff.sprints[0].endDate)).toBe("2026-08-17");

    const taskRows = await rows(
      `SELECT t.source_key, t.title, t.status, t.priority, t.points, t.team_id
         FROM tasks t JOIN sprints s ON s.id = t.sprint_id
        WHERE s.team_id = '${TEAM_ID}' ORDER BY t.source_key;`
    );
    expect(taskRows.map((r) => r.source_key)).toEqual(["plan:s1:t0", "plan:s1:t1", "plan:s2:t0"]);
    expect(taskRows[0].title).toBe("Approved Research Questions");
    expect(taskRows[0].status).toBe("TODO"); // unassigned and not started, per the issue
    expect(taskRows[0].priority).toBe("HIGH");
    expect(taskRows[0].points).toBe(3);
    expect(taskRows[0].team_id).toBe(TEAM_ID); // set, so getTasksByTeam also finds it
  });

  it("re-applying the identical file duplicates nothing", async () => {
    const parsed = parsePlanSheet(parseCsv(sampleTemplateCsv()));
    if (!parsed.ok) throw new Error("template failed to parse");

    const diff = await storage.applyProgrammePlan(TEAM_ID, parsed.plan, new Date(2026, 7, 4));

    expect(diff.summary).toMatchObject({
      sprintsCreated: 0,
      sprintsUpdated: 0,
      tasksCreated: 0,
      tasksUpdated: 0,
      sprintsUnchanged: 2,
      tasksUnchanged: 3,
    });

    const [{ count: sprintCount }] = await rows(
      `SELECT COUNT(*)::int AS count FROM sprints WHERE team_id = '${TEAM_ID}';`
    );
    const [{ count: taskCount }] = await rows(
      `SELECT COUNT(*)::int AS count FROM tasks t JOIN sprints s ON s.id = t.sprint_id
        WHERE s.team_id = '${TEAM_ID}';`
    );
    expect(sprintCount).toBe(2);
    expect(taskCount).toBe(3);
  });

  it("leaves a started task alone, including edits made on the board", async () => {
    await pglite.exec(`
      UPDATE tasks SET status = 'IN_PROGRESS', title = 'Renamed on the board'
        WHERE source_key = 'plan:s1:t0'
          AND sprint_id IN (SELECT id FROM sprints WHERE team_id = '${TEAM_ID}');
    `);

    const parsed = parsePlanSheet(parseCsv(sampleTemplateCsv()));
    if (!parsed.ok) throw new Error("template failed to parse");
    const diff = await storage.applyProgrammePlan(TEAM_ID, parsed.plan, new Date(2026, 7, 4));

    expect(diff.summary.tasksSkipped).toBe(1);

    const [task] = await rows(`
      SELECT title, status FROM tasks
        WHERE source_key = 'plan:s1:t0'
          AND sprint_id IN (SELECT id FROM sprints WHERE team_id = '${TEAM_ID}');
    `);
    expect(task.title).toBe("Renamed on the board"); // not stamped over
    expect(task.status).toBe("IN_PROGRESS");
  });

  it("never touches a hand-made task, and allows many NULL source_keys in one sprint", async () => {
    const [sprint] = await rows(
      `SELECT id FROM sprints WHERE team_id = '${TEAM_ID}' AND index = 1;`
    );
    await pglite.exec(`
      INSERT INTO tasks (id, sprint_id, team_id, title, status, source_key)
        VALUES ('aaaaaaaa-0000-0000-0000-000000000001', '${sprint.id}', '${TEAM_ID}', 'Typed by a founder', 'IN_PROGRESS', NULL),
               ('aaaaaaaa-0000-0000-0000-000000000002', '${sprint.id}', '${TEAM_ID}', 'Also typed by hand', 'TODO', NULL);
    `);

    const parsed = parsePlanSheet(parseCsv(sampleTemplateCsv()));
    if (!parsed.ok) throw new Error("template failed to parse");
    const diff = await storage.applyProgrammePlan(TEAM_ID, parsed.plan, new Date(2026, 7, 4));

    expect(diff.orphanedTasks).toEqual([]);
    expect(diff.summary.tasksCreated).toBe(0);

    const handMade = await rows(`
      SELECT title, status FROM tasks
        WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002')
        ORDER BY title;
    `);
    expect(handMade).toHaveLength(2); // two NULLs coexist: the index really is partial
    expect(handMade[0].title).toBe("Also typed by hand");
    expect(handMade[1].status).toBe("IN_PROGRESS");
  });

  it("rejects a genuine duplicate source_key within one sprint", async () => {
    const [sprint] = await rows(
      `SELECT id FROM sprints WHERE team_id = '${TEAM_ID}' AND index = 1;`
    );
    await expect(
      pglite.exec(`
        INSERT INTO tasks (id, sprint_id, team_id, title, source_key)
          VALUES ('bbbbbbbb-0000-0000-0000-000000000001', '${sprint.id}', '${TEAM_ID}', 'Duplicate', 'plan:s1:t0');
      `)
    ).rejects.toThrow();
  });

  it("allows the same source_key on a different sprint", async () => {
    // The key is only meaningful within its sprint, which is why the index is scoped that way.
    const [sprint2] = await rows(
      `SELECT id FROM sprints WHERE team_id = '${TEAM_ID}' AND index = 2;`
    );
    await pglite.exec(`
      INSERT INTO tasks (id, sprint_id, team_id, title, source_key)
        VALUES ('cccccccc-0000-0000-0000-000000000001', '${sprint2.id}', '${TEAM_ID}', 'Same key, other sprint', 'plan:s1:t0');
    `);
    const [{ count }] = await rows(
      `SELECT COUNT(*)::int AS count FROM tasks WHERE source_key = 'plan:s1:t0';`
    );
    expect(count).toBe(2);
  });

  it("applies the same plan to a second team independently", async () => {
    const parsed = parsePlanSheet(parseCsv(sampleTemplateCsv()));
    if (!parsed.ok) throw new Error("template failed to parse");

    const diff = await storage.applyProgrammePlan(OTHER_TEAM_ID, parsed.plan, new Date(2026, 7, 4));
    expect(diff.summary.sprintsCreated).toBe(2);
    expect(diff.summary.tasksCreated).toBe(3);

    // Team A's rows are untouched by Team B's import.
    const [{ count }] = await rows(
      `SELECT COUNT(*)::int AS count FROM sprints WHERE team_id = '${OTHER_TEAM_ID}';`
    );
    expect(count).toBe(2);
  });

  it("does not overwrite a task started between the snapshot and the transaction", async () => {
    // Stages the actual race, rather than asserting the predicate's semantics in isolation.
    //
    // applyProgrammePlan snapshots the board, computes the diff, then opens a transaction. Spying on
    // the snapshot lets a task start in exactly that window: the diff has already decided to
    // update it, and only the `status = 'TODO'` predicate stops the write landing.
    //
    // Chandana's review pointed out that the SQL-semantics test below passes with the guard
    // deleted. This one does not — it exercises the production path, and it also covers the
    // summary correction, which nothing else did.
    const THIRD_TEAM = "44444444-4444-4444-4444-444444444444";
    await pglite.exec(`
      INSERT INTO teams (id, cohort_id, name)
        VALUES ('${THIRD_TEAM}', '${COHORT_ID}', 'CU Capstone Team C');
    `);

    const parsed = parsePlanSheet(parseCsv(sampleTemplateCsv()));
    if (!parsed.ok) throw new Error("template failed to parse");

    // First apply: everything created, all TODO.
    await storage.applyProgrammePlan(THIRD_TEAM, parsed.plan, new Date(2026, 7, 4));

    // Diverge one task so the next apply genuinely wants to update it, while it is still TODO.
    await pglite.exec(`
      UPDATE tasks SET title = 'Edited on the board'
        WHERE source_key = 'plan:s1:t0'
          AND sprint_id IN (SELECT id FROM sprints WHERE team_id = '${THIRD_TEAM}');
    `);

    const original = (storage as any).programmePlanState.bind(storage);
    const spy = vi
      .spyOn(storage as any, "programmePlanState")
      .mockImplementation(async (...args: unknown[]) => {
        const state = await original(args[0] as string);
        // The race: a learner starts the task after the snapshot, before the transaction opens.
        await pglite.exec(`
          UPDATE tasks SET status = 'IN_PROGRESS'
            WHERE source_key = 'plan:s1:t0'
              AND sprint_id IN (SELECT id FROM sprints WHERE team_id = '${THIRD_TEAM}');
        `);
        return state;
      });

    try {
      const diff = await storage.applyProgrammePlan(THIRD_TEAM, parsed.plan, new Date(2026, 7, 4));

      // The snapshot said TODO with a stale title, so the diff decided to update it...
      const change = diff.sprints[0].tasks.find((t: any) => t.sourceKey === "plan:s1:t0");
      // ...but the guard bit, and the diff was corrected to say so.
      expect(change.action).toBe("skipped");
      expect(change.reason).toMatch(/started while the import was running/);
      expect(diff.summary.tasksSkipped).toBeGreaterThanOrEqual(1);

      // And the row itself is untouched: the board's edit and its progress both survive.
      const [task] = await rows(`
        SELECT title, status FROM tasks
          WHERE source_key = 'plan:s1:t0'
            AND sprint_id IN (SELECT id FROM sprints WHERE team_id = '${THIRD_TEAM}');
      `);
      expect(task.title).toBe("Edited on the board");
      expect(task.status).toBe("IN_PROGRESS");
    } finally {
      spy.mockRestore();
    }
  });

  it("cannot update a task that was started after the diff was computed", async () => {
    // The read-then-write window Chandana flagged: the diff is computed just before the transaction
    // opens, so a task can move TODO -> IN_PROGRESS in between and the diff will already have
    // decided to update it. The update therefore carries `status = 'TODO'`.
    //
    // The interleaving itself cannot be staged from here — applyProgrammePlan reads and writes back
    // to back — so this asserts the guard's SQL semantics directly, which is the load-bearing part.
    const [sprint] = await rows(
      `SELECT id FROM sprints WHERE team_id = '${TEAM_ID}' AND index = 2;`
    );
    await pglite.exec(`
      INSERT INTO tasks (id, sprint_id, team_id, title, status, source_key)
        VALUES ('dddddddd-0000-0000-0000-000000000001', '${sprint.id}', '${TEAM_ID}',
                'Started mid-import', 'IN_PROGRESS', 'plan:s2:t9');
    `);

    // Exactly the predicate storage.applyProgrammePlan uses for a task update.
    const guarded = await pglite.query(`
      UPDATE tasks SET title = 'Stamped over by the importer'
        WHERE id = 'dddddddd-0000-0000-0000-000000000001' AND status = 'TODO'
        RETURNING id;
    `);
    expect(guarded.rows).toHaveLength(0); // matched nothing, so nothing was overwritten

    const [task] = await rows(
      `SELECT title, status FROM tasks WHERE id = 'dddddddd-0000-0000-0000-000000000001';`
    );
    expect(task.title).toBe("Started mid-import");
    expect(task.status).toBe("IN_PROGRESS");

    // Sanity check the same statement DOES apply when the task is still TODO, so the test is not
    // passing merely because the WHERE clause is broken.
    await pglite.exec(
      `UPDATE tasks SET status = 'TODO' WHERE id = 'dddddddd-0000-0000-0000-000000000001';`
    );
    const unguarded = await pglite.query(`
      UPDATE tasks SET title = 'Amended normally'
        WHERE id = 'dddddddd-0000-0000-0000-000000000001' AND status = 'TODO'
        RETURNING id;
    `);
    expect(unguarded.rows).toHaveLength(1);

    // Leave the board as the later tests expect it.
    await pglite.exec(`DELETE FROM tasks WHERE id = 'dddddddd-0000-0000-0000-000000000001';`);
  });

  it("reports a task dropped from the template without deleting it", async () => {
    const shortened = parsePlanSheet(
      parseCsv(
        [
          "Sprint #,Sprint Name,Duration (weeks),Task Title",
          "1,Phase I: Orientation & Research Foundations,2,Approved Research Questions",
        ].join("\r\n")
      )
    );
    if (!shortened.ok) throw new Error("shortened template failed to parse");

    const before = await rows(
      `SELECT COUNT(*)::int AS count FROM tasks t JOIN sprints s ON s.id = t.sprint_id
        WHERE s.team_id = '${OTHER_TEAM_ID}';`
    );
    const diff = await storage.applyProgrammePlan(
      OTHER_TEAM_ID,
      shortened.plan,
      new Date(2026, 7, 4)
    );

    // plan:s1:t1 is gone from the template — reported, and still on the board.
    expect(diff.orphanedTasks.map((t: any) => t.sourceKey)).toContain("plan:s1:t1");
    const after = await rows(
      `SELECT COUNT(*)::int AS count FROM tasks t JOIN sprints s ON s.id = t.sprint_id
        WHERE s.team_id = '${OTHER_TEAM_ID}';`
    );
    expect(after[0].count).toBe(before[0].count);
  });
});

/**
 * Pins the node-postgres behaviour the sprint dates depend on.
 *
 * `deriveSprintWindows` returns local midnight, and it is correct to store that in a
 * `timestamp without time zone` column ONLY because node-postgres serialises a Date as local wall
 * time with an offset, which Postgres then truncates. If that ever changed to sending the UTC
 * instant, every generated sprint would silently shift a day earlier on any server east of UTC —
 * the exact bug fixed in 06d4e3c, reintroduced from underneath. This test fails loudly instead.
 *
 * Runs without a database, so it is not skipped when PGlite is absent.
 */
describe("node-postgres date serialisation (what the sprint dates rely on)", () => {
  it("sends local wall time with an offset, not the UTC instant", async () => {
    const { default: utils } = await import("pg/lib/utils.js");
    const localMidnight = new Date(2026, 7, 4);
    const sent = (utils as any).prepareValue(localMidnight) as string;

    // e.g. "2026-08-04T00:00:00.000+05:30" — the calendar day must be the LOCAL one.
    expect(sent.startsWith("2026-08-04T00:00:00.000")).toBe(true);
    expect(sent).not.toBe(localMidnight.toISOString());
  });
});
