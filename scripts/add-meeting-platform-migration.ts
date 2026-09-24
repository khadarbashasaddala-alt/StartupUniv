/**
 * Migration: the meeting platform column on team_meetings.
 *
 * Run: npm run db:add-meeting-platform
 * Or directly: psql "$DATABASE_URL" -f scripts/sql/add-meeting-platform.sql
 *
 * Idempotent -- safe to re-run.
 */

import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
const { Pool } = pg;

// Allow RDS/cloud DB self-signed certs (same as drizzle.config.ts)
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = join(__dirname, "sql", "add-meeting-platform.sql");

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  const isLocal =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  const pool = new Pool({
    // Strip sslmode: newer pg reads `sslmode=require` as verify-full and lets it override the
    // ssl option below, which fails against RDS's private CA (server/db.ts does the same).
    connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ""),
    connectionTimeoutMillis: 15000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Adding meeting_platform to team_meetings...");
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const { rows } = await pool.query(
      `SELECT is_nullable, column_default, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'team_meetings'
          AND column_name = 'meeting_platform';`
    );
    if (rows.length === 0) {
      console.error("❌ meeting_platform was not created");
      process.exit(1);
    }
    if (rows[0].is_nullable !== "NO") {
      console.error("❌ meeting_platform should be NOT NULL");
      process.exit(1);
    }
    // The default is what classifies every pre-existing meeting, so it is verified rather than
    // assumed: without it those rows would be NULL and read as external meetings with no link.
    if (!String(rows[0].column_default ?? "").includes("GOOGLE_MEET")) {
      console.error(`❌ expected a GOOGLE_MEET default, found ${rows[0].column_default}`);
      process.exit(1);
    }

    const { rows: unset } = await pool.query(
      `SELECT count(*)::int AS n FROM team_meetings WHERE meeting_platform IS NULL;`
    );
    if (unset[0].n !== 0) {
      console.error(`❌ ${unset[0].n} meetings have no platform set`);
      process.exit(1);
    }

    console.log("✅ meeting_platform present, NOT NULL, defaulting to GOOGLE_MEET");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
