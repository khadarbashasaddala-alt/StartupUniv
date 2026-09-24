/**
 * The Create Sprint contract: every field the dialog collects has to survive the round trip.
 *
 * Objectives and Deliverables were missing from the Create Sprint form, so a new sprint could
 * only get them by being created and then reopened in Edit. The server had always accepted both
 * on `POST /api/teams/:teamId/sprints` — it destructures them straight into `createSprint` — so
 * the fix was purely to send them. This pins the storage side of that contract, so the columns
 * cannot quietly stop persisting under the form that now depends on them.
 *
 * Runs against an in-process Postgres (PGlite), like the programme-plan integration test.
 * Degrades to a loud skip if PGlite is missing rather than failing the build — but a skipped run
 * verifies nothing here.
 */
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

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
    "\n⚠️  PGlite not installed — the create-sprint integration test is SKIPPED, so the sprint " +
      "column round trip is NOT verified by this run.\n" +
      "    Install it with: npm i --no-save @electric-sql/pglite\n"
  );
}

const describeIf = available ? describe : describe.skip;
const TEAM_ID = "22222222-2222-2222-2222-222222222222";

const DDL = `
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
`;

describeIf("createSprint stores every field the Create Sprint dialog collects", () => {
  let storage: any;

  beforeAll(async () => {
    await pglite.exec(DDL);
    storage = (await import("./storage")).storage;
  });

  afterAll(async () => {
    await pglite?.close?.();
  });

  it("persists objectives and deliverables, not just name and goals", async () => {
    const created = await storage.createSprint({
      teamId: TEAM_ID,
      index: 1,
      name: "Phase I: Orientation & Research Foundations",
      startDate: new Date(2026, 7, 4),
      endDate: new Date(2026, 7, 17),
      goals: "Establish research foundations",
      objectives: "Understanding of research foundations\nProblem framing clarity",
      deliverables: "Research Problem Statement (1-2 pages)\nApproved Research Questions",
    });

    // Read back through a fresh query rather than trusting the insert's return value.
    const [row] = (
      await pglite.query(
        `SELECT name, goals, objectives, deliverables FROM sprints WHERE id = '${created.id}';`
      )
    ).rows as any[];

    expect(row.name).toBe("Phase I: Orientation & Research Foundations");
    expect(row.goals).toBe("Establish research foundations");
    expect(row.objectives).toContain("Problem framing clarity");
    expect(row.deliverables).toContain("Approved Research Questions");
  });

  it("leaves the optional prose columns NULL when the form omits them", async () => {
    const created = await storage.createSprint({
      teamId: TEAM_ID,
      index: 2,
      name: "Bare sprint",
      startDate: new Date(2026, 7, 18),
      endDate: new Date(2026, 7, 31),
      goals: null,
      objectives: null,
      deliverables: null,
    });

    const [row] = (
      await pglite.query(
        `SELECT goals, objectives, deliverables FROM sprints WHERE id = '${created.id}';`
      )
    ).rows as any[];

    expect(row.goals).toBeNull();
    expect(row.objectives).toBeNull();
    expect(row.deliverables).toBeNull();
  });

  it("refuses a duplicate sprint number for one team", async () => {
    // Why the create route cannot keep computing `index: existingSprints.length + 1`: delete
    // sprint 2 of 3 and that expression yields 3, which already exists. Tracked separately.
    await expect(
      storage.createSprint({
        teamId: TEAM_ID,
        index: 1,
        name: "Collides with sprint 1",
        startDate: new Date(2026, 8, 1),
        endDate: new Date(2026, 8, 14),
      })
    ).rejects.toThrow();
  });
});
