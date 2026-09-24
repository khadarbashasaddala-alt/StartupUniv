/**
 * Load the real Christ University capstone allocation: people, teams, and the problem statement
 * each team is working on.
 *
 * Data comes from scripts/data/capstone-allocation.json, extracted from
 * "Copy of Project Allocation_ Captsone Students.xlsx" — 84 students, 8 industry mentors and
 * 9 academic mentors, across 8 teams.
 *
 *   npm run db:import-capstone              # dry run: says what it would do, writes nothing
 *   npm run db:import-capstone -- --apply   # actually writes
 *
 * Dry run is the default on purpose. These are real people's accounts, creating them is far
 * easier than unpicking them, and a mistyped DATABASE_URL should cost nothing.
 *
 * Everything is idempotent and deliberately non-destructive. A user whose email already exists is
 * left exactly as they are — name, role and password untouched — so a re-run cannot disturb
 * somebody already set up, or reset a password they have since changed. The same holds for the
 * cohort, the teams, the problem statements and the memberships: each is created only if absent.
 *
 * Sends no email to anybody. Everyone gets the same starting password and has to be told out of
 * band; nothing here contacts a student.
 *
 * Run in six phases, each reported separately:
 *   1. users             — students as LEARNER, both kinds of mentor as MENTOR
 *   2. tracks            — a track per domain in the sheet, so the catalog knows them
 *   3. cohort            — found by name, or created
 *   4. problem statements— one per team, titled exactly as the sheet says
 *   5. teams             — one per sheet team, linked to its problem statement
 *   6. memberships       — students as Member, mentors as Mentor
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import pg from "pg";
import { slugifyTrack } from "@shared/tracks";
const { Pool } = pg;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, "data", "capstone-allocation.json");

/** Override with IMPORT_DEFAULT_PASSWORD when running, if you would rather it were not in git. */
const DEFAULT_PASSWORD = process.env.IMPORT_DEFAULT_PASSWORD || "Capstone@2026";

const APPLY = process.argv.includes("--apply");

/** Overridable so this can be pointed at a different intake without editing the script. */
const COHORT_NAME = process.env.IMPORT_COHORT_NAME || "CU Capstone 2026";
const TEAM_PREFIX = process.env.IMPORT_TEAM_PREFIX || "Capstone Team";

interface Student {
  name: string;
  email: string;
  className: string;
  team: string;
  project: string;
}
interface Mentor {
  name: string;
  email: string | null;
  teams: string[];
}
interface TeamRow {
  team: string;
  project: string;
  domain: string;
  studentEmails: string[];
  academicMentors: string[];
  industryMentors: string[];
}

interface Candidate {
  email: string;
  name: string;
  role: "LEARNER" | "MENTOR";
  note: string;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as {
    students: Student[];
    industryMentors: Mentor[];
    academicMentors: Mentor[];
    teams: TeamRow[];
  };

  const candidates: Candidate[] = [
    ...data.students.map((s) => ({
      email: s.email.trim().toLowerCase(),
      name: s.name,
      role: "LEARNER" as const,
      note: `team ${s.team} · ${s.className}`,
    })),
    ...data.industryMentors
      // A mentor with no email cannot have an account; the academic mentors are all in this
      // position, which is why they are absent from the data file entirely.
      .filter((m) => m.email)
      .map((m) => ({
        email: m.email!.trim().toLowerCase(),
        name: m.name,
        role: "MENTOR" as const,
        note: `mentor · team${m.teams.length > 1 ? "s" : ""} ${m.teams.join(", ")}`,
      })),
    ...data.academicMentors
      .filter((m) => m.email)
      .map((m) => ({
        email: m.email!.trim().toLowerCase(),
        name: m.name,
        role: "MENTOR" as const,
        note: `mentor · team${m.teams.length > 1 ? "s" : ""} ${m.teams.join(", ")}`,
      })),
  ];

  // Two rows sharing an email would mean one account and a lost person, so it is worth failing on
  // rather than silently importing 91 of 92.
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const c of candidates) {
    if (seen.has(c.email)) collisions.push(`${c.email} (${seen.get(c.email)} and ${c.name})`);
    seen.set(c.email, c.name);
  }
  if (collisions.length > 0) {
    console.error("❌ the same email appears twice in the spreadsheet:");
    collisions.forEach((c) => console.error("   " + c));
    process.exit(1);
  }

  const isLocal =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  const pool = new Pool({
    // Strip sslmode: newer pg reads `sslmode=require` as verify-full and lets it override the ssl
    // option below, which fails against RDS's private CA (server/db.ts does the same).
    connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ""),
    connectionTimeoutMillis: 15000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    const { rows: dbInfo } = await pool.query("SELECT current_database() AS db");
    console.log(`\n📚 Capstone import — ${APPLY ? "APPLYING" : "DRY RUN"} against ${dbInfo[0].db}`);
    console.log(
      `   ${data.students.length} students, ${data.industryMentors.length} industry mentors, ` +
        `${data.academicMentors.length} academic mentors, ${data.teams.length} teams\n`
    );
    console.log("── phase 1: users ───────────────────────────────────────────────");

    // users.role is a foreign key to roles.code, so an absent role would fail every insert one at
    // a time. Checked once, up front, with a message that says what to do about it.
    const { rows: roles } = await pool.query(
      `SELECT code FROM roles WHERE code = ANY($1::text[])`,
      [["LEARNER", "MENTOR"]]
    );
    const haveRoles = roles.map((r: { code: string }) => r.code);
    const missingRoles = ["LEARNER", "MENTOR"].filter((r) => !haveRoles.includes(r));
    if (missingRoles.length > 0) {
      console.error(`❌ the roles table has no ${missingRoles.join(", ")} — run npm run db:add-dynamic-roles first`);
      process.exit(1);
    }

    const { rows: existingRows } = await pool.query(
      `SELECT lower(email) AS email, name, role FROM users WHERE lower(email) = ANY($1::text[])`,
      [candidates.map((c) => c.email)]
    );
    const existing = new Map(
      existingRows.map((r: { email: string; name: string; role: string }) => [r.email, r])
    );

    const toCreate = candidates.filter((c) => !existing.has(c.email));

    if (existing.size > 0) {
      console.log(`↩️  already present, left untouched (${existing.size}):`);
      for (const [email, row] of existing) {
        console.log(`   ${email}  ${row.name} (${row.role})`);
      }
      console.log();
    }

    console.log(`➕ to create (${toCreate.length}):`);
    for (const c of toCreate) {
      console.log(`   ${c.role.padEnd(7)} ${c.email.padEnd(52)} ${c.name}  — ${c.note}`);
    }
    console.log();

    let created = 0;
    for (const c of APPLY ? toCreate : []) {
      // Hashed per user rather than once and reused, so the stored hashes differ even though the
      // password does not. Costs about a second across the whole set.
      const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      // ON CONFLICT rather than trusting the read above: another run, or somebody using the admin
      // UI, could add the same email between the SELECT and here.
      const { rowCount } = await pool.query(
        `INSERT INTO users (email, password, name, role, is_admin, first_time_login)
           VALUES ($1, $2, $3, $4, false, true)
         ON CONFLICT (email) DO NOTHING`,
        [c.email, hash, c.name, c.role]
      );
      if (rowCount && rowCount > 0) created += 1;
    }


    // ── phase 2: tracks ────────────────────────────────────────────────────────────────────
    // problem_statements.track is plain text, but the selectable catalog lives in `tracks` and the
    // app validates against it — so a statement carrying a domain the catalog has never heard of
    // would be unselectable and unfilterable in the UI. Slugified with the app's own helper so the
    // values match what it would have produced itself.
    console.log("\n── phase 2: tracks ──────────────────────────────────────────────");
    const domains = [...new Set(data.teams.map((t) => t.domain))].sort();
    const trackFor = new Map(domains.map((d) => [d, slugifyTrack(d)]));
    const { rows: haveTracks } = await pool.query(
      `SELECT value FROM tracks WHERE value = ANY($1::text[])`,
      [[...trackFor.values()]]
    );
    const haveTrackValues = new Set(haveTracks.map((r: { value: string }) => r.value));
    for (const [domain, value] of trackFor) {
      const present = haveTrackValues.has(value);
      console.log(`   ${present ? "exists " : "create "} ${value.padEnd(38)} ${domain}`);
      if (APPLY && !present) {
        await pool.query(
          `INSERT INTO tracks (value, label) VALUES ($1, $2) ON CONFLICT (value) DO NOTHING`,
          [value, domain]
        );
      }
    }

    // ── phase 3: cohort ───────────────────────────────────────────────────────────────────
    console.log("\n── phase 3: cohort ──────────────────────────────────────────────");
    const { rows: cohortRows } = await pool.query(
      `SELECT id, name FROM cohorts WHERE name = $1`,
      [COHORT_NAME]
    );
    let cohortId: string | null = cohortRows[0]?.id ?? null;
    if (cohortId) {
      console.log(`   exists  "${COHORT_NAME}"  ${cohortId}`);
    } else if (APPLY) {
      // Dates are a placeholder the admin UI can correct; a cohort cannot be created without
      // them, and inventing a plausible window beats refusing to run over it.
      const { rows } = await pool.query(
        `INSERT INTO cohorts (name, start_date, end_date, location, seats)
           VALUES ($1, now(), now() + interval '6 months', 'Christ University', 200)
         RETURNING id`,
        [COHORT_NAME]
      );
      cohortId = rows[0].id;
      console.log(`   created "${COHORT_NAME}"  ${cohortId}`);
      console.log("   ⚠️  start and end dates are placeholders — set them in the admin UI");
    } else {
      console.log(`   create  "${COHORT_NAME}" (dates default to today + 6 months)`);
    }

    // Problem statements need an owner, and the sheet does not name one. An admin is the honest
    // choice: these briefs come from the institution, not from a mentor who wrote them.
    const { rows: admins } = await pool.query(
      `SELECT id, email FROM users WHERE role = 'ADMIN' ORDER BY created_at LIMIT 1`
    );
    if (admins.length === 0) {
      console.error("\n❌ no ADMIN user exists to own the problem statements");
      process.exit(1);
    }
    const adminId: string = admins[0].id;

    // ── phase 4: problem statements ───────────────────────────────────────────────────────
    // Titled exactly as the spreadsheet says. Deliberately NOT matched against what is already in
    // production: the wording differs there ("AI Based Customer Segmentation for Retailer
    // Business" against the sheet's "AI-Based Customer Segmentation for Retail Businesses"), and a
    // fuzzy match that guessed wrong would hand a team somebody else's project.
    console.log("\n── phase 4: problem statements ──────────────────────────────────");
    const statementIdByTeam = new Map<string, string>();
    for (const t of data.teams) {
      const { rows: found } = await pool.query(
        `SELECT id FROM problem_statements WHERE title = $1 LIMIT 1`,
        [t.project]
      );
      if (found[0]) {
        statementIdByTeam.set(t.team, found[0].id);
        console.log(`   exists  team ${t.team}: ${t.project}`);
        continue;
      }
      console.log(`   create  team ${t.team}: ${t.project}`);
      if (APPLY) {
        const { rows } = await pool.query(
          `INSERT INTO problem_statements
             (title, overview, track, created_by, created_by_role, status, published_at, published_by)
           VALUES ($1, $2, $3, $4, 'ADMIN', 'PUBLISHED', now(), $4)
           RETURNING id`,
          [
            t.project,
            // Flagged as a stub rather than dressed up as a brief, so nobody mistakes it for one.
            `${t.project}\n\nCapstone project for the ${t.domain} domain, from the Christ University project allocation. Full brief to be added.`,
            trackFor.get(t.domain),
            adminId,
          ]
        );
        statementIdByTeam.set(t.team, rows[0].id);
      }
    }

    // ── phase 5: teams ────────────────────────────────────────────────────────────────────
    console.log("\n── phase 5: teams ───────────────────────────────────────────────");
    const teamIdByNumber = new Map<string, string>();
    for (const t of data.teams) {
      const teamName = `${TEAM_PREFIX} ${t.team}`;
      const { rows: found } = await pool.query(
        `SELECT id, problem_statement_id FROM teams WHERE name = $1 LIMIT 1`,
        [teamName]
      );
      const statementId = statementIdByTeam.get(t.team) ?? null;

      if (found[0]) {
        teamIdByNumber.set(t.team, found[0].id);
        if (!found[0].problem_statement_id && statementId) {
          console.log(`   link    ${teamName} -> ${t.project}`);
          if (APPLY) {
            // Both sides. The link is duplicated on teams and problem_statements, and code reads
            // whichever it happens to prefer, so writing one alone leaves the other stale.
            await pool.query(`UPDATE teams SET problem_statement_id = $1 WHERE id = $2`, [
              statementId,
              found[0].id,
            ]);
            await pool.query(
              `UPDATE problem_statements SET team_id = $1, team_formed_at = now() WHERE id = $2`,
              [found[0].id, statementId]
            );
          }
        } else {
          console.log(`   exists  ${teamName}`);
        }
        continue;
      }

      console.log(`   create  ${teamName}  (${t.studentEmails.length} students) -> ${t.project}`);
      if (APPLY) {
        if (!cohortId) throw new Error("cohort id missing");
        const { rows } = await pool.query(
          `INSERT INTO teams (cohort_id, name, problem_statement_id) VALUES ($1, $2, $3) RETURNING id`,
          [cohortId, teamName, statementId]
        );
        teamIdByNumber.set(t.team, rows[0].id);
        if (statementId) {
          await pool.query(
            `UPDATE problem_statements SET team_id = $1, team_formed_at = now() WHERE id = $2`,
            [rows[0].id, statementId]
          );
        }
      }
    }

    // ── phase 6: memberships ──────────────────────────────────────────────────────────────
    // Students as Member, mentors as Mentor. No academic/industry distinction is written: every
    // mentor is simply a mentor on their team, and role_assignments.mentor_kind is left as it is.
    console.log("\n── phase 6: memberships ─────────────────────────────────────────");
    const { rows: userRows } = await pool.query(
      `SELECT id, lower(email) AS email FROM users WHERE lower(email) = ANY($1::text[])`,
      [candidates.map((c) => c.email)]
    );
    const userIdByEmail = new Map(
      userRows.map((r: { id: string; email: string }) => [r.email, r.id])
    );

    const emailOf = (name: string, list: Mentor[]) =>
      list.find((m) => m.name === name)?.email?.toLowerCase() ?? null;

    let added = 0;
    let alreadyOn = 0;
    let unresolved = 0;
    for (const t of data.teams) {
      const teamId = teamIdByNumber.get(t.team);
      if (!teamId) {
        console.log(`   team ${t.team}: not created yet (dry run) — ${t.studentEmails.length + t.academicMentors.length + t.industryMentors.length} memberships pending`);
        continue;
      }

      const wanted: { email: string; role: string }[] = [
        ...t.studentEmails.map((e) => ({ email: e.toLowerCase(), role: "Member" })),
        ...[...t.academicMentors, ...t.industryMentors]
          .map((n) => emailOf(n, data.academicMentors) ?? emailOf(n, data.industryMentors))
          .filter((e): e is string => !!e)
          .map((e) => ({ email: e, role: "Mentor" })),
      ];

      for (const w of wanted) {
        const userId = userIdByEmail.get(w.email);
        if (!userId) {
          console.log(`   ⚠️  ${w.email} has no account — membership skipped`);
          unresolved += 1;
          continue;
        }
        const { rows: existingAssignment } = await pool.query(
          `SELECT id FROM role_assignments WHERE team_id = $1 AND user_id = $2 LIMIT 1`,
          [teamId, userId]
        );
        if (existingAssignment[0]) {
          alreadyOn += 1;
          continue;
        }
        if (APPLY) {
          await pool.query(
            `INSERT INTO role_assignments (team_id, user_id, role)
               VALUES ($1, $2, $3::team_role)`,
            [teamId, userId, w.role]
          );
        }
        added += 1;
      }
      console.log(`   ${TEAM_PREFIX} ${t.team}: ${wanted.length} people`);
    }
    console.log(
      `\n   ${APPLY ? "added" : "would add"} ${added}, already on a team ${alreadyOn}` +
        (unresolved ? `, no account ${unresolved}` : "")
    );

    console.log("\n─────────────────────────────────────────────────────────────────");
    if (!APPLY) {
      console.log("🔍 Dry run: nothing was written. Re-run with --apply to make these changes.");
      return;
    }

    const { rows: after } = await pool.query(
      `SELECT count(*)::int AS n FROM users WHERE lower(email) = ANY($1::text[])`,
      [candidates.map((c) => c.email)]
    );
    const { rows: teamCount } = await pool.query(
      `SELECT count(*)::int AS teams,
              (SELECT count(*)::int FROM role_assignments ra
                 JOIN teams t2 ON t2.id = ra.team_id WHERE t2.name LIKE $1) AS members,
              (SELECT count(*)::int FROM teams t3
                 WHERE t3.name LIKE $1 AND t3.problem_statement_id IS NOT NULL) AS linked
         FROM teams WHERE name LIKE $1`,
      [`${TEAM_PREFIX} %`]
    );

    console.log(`✅ created ${created} account${created === 1 ? "" : "s"}`);
    console.log(`   ${after[0].n} of ${candidates.length} spreadsheet people now have accounts`);
    console.log(
      `   ${teamCount[0].teams} teams, ${teamCount[0].linked} with a problem statement attached, ` +
        `${teamCount[0].members} memberships`
    );
    console.log(`   starting password for the new accounts: ${DEFAULT_PASSWORD}`);
    console.log(
      "\n⚠️  The app does not force a password change at first login, so this password stays\n" +
        "    valid until each person changes it themselves. Nothing was emailed to anybody."
    );

    // Loud rather than a silent partial success: a run that created most of a cohort and quietly
    // dropped the rest is the worst outcome to discover later.
    if (after[0].n !== candidates.length) {
      console.error("❌ some people still have no account — see the list above");
      process.exit(1);
    }
    if (teamCount[0].teams !== data.teams.length || teamCount[0].linked !== data.teams.length) {
      console.error("❌ not every team exists with a problem statement attached");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
