/**
 * Migration: session recordings on team meetings.
 *
 * Run: npm run db:add-meeting-recordings
 * Or directly: psql "$DATABASE_URL" -f scripts/sql/add-meeting-recordings.sql
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
const SQL_FILE = join(__dirname, "sql", "add-meeting-recordings.sql");

const EXPECTED = [
  "recording_content_type",
  "recording_duration_seconds",
  "recording_file_name",
  "recording_object_key",
  "recording_size_bytes",
  "recording_uploaded_at",
  "recording_uploaded_by",
];

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
    console.log("🔄 Adding session recording columns to team_meetings...");
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const { rows: cols } = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'team_meetings'
          AND column_name = ANY($1::text[])
        ORDER BY column_name;`,
      [EXPECTED]
    );

    const found = cols.map((c: { column_name: string }) => c.column_name);
    const missing = EXPECTED.filter((c) => !found.includes(c));
    if (missing.length > 0) {
      console.error(`❌ columns still missing: ${missing.join(", ")}`);
      process.exit(1);
    }

    // Verified rather than assumed: an earlier run of a hand-written variant could have created
    // this as integer, which silently caps uploads at 2GB minus one byte.
    const size = cols.find((c: { column_name: string }) => c.column_name === "recording_size_bytes");
    if (size && size.data_type !== "bigint") {
      console.error(`❌ recording_size_bytes is ${size.data_type}, expected bigint`);
      process.exit(1);
    }

    const { rows: index } = await pool.query(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'team_meetings_recording_idx';`
    );
    if (index.length === 0) {
      console.error("❌ team_meetings_recording_idx was not created");
      process.exit(1);
    }
    if (!/WHERE/i.test(index[0].indexdef)) {
      console.error(`❌ index is not partial: ${index[0].indexdef}`);
      process.exit(1);
    }

    console.log(`✅ ${EXPECTED.length} recording columns present, index is partial`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
