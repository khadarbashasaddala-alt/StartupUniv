/**
 * Migration: replace the `track` enum constraint with an admin-managed
 * `tracks` catalog table.
 *
 * Run: npm run db:add-tracks
 * If the connection times out (e.g. remote DB behind a tunnel), run the SQL
 * directly instead:
 *   psql "$DATABASE_URL" -f scripts/sql/add-tracks.sql
 *
 * Idempotent — safe to re-run.
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
const SQL_FILE = join(__dirname, "sql", "add-tracks.sql");

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  const isLocal =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    query_timeout: 60000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    const sql = readFileSync(SQL_FILE, "utf8");

    console.log("🔄 Creating tracks catalog and relaxing problem_statements.track...");

    // Sent as one simple query so the DO $$ ... $$ block stays intact and the
    // whole migration lands atomically.
    await pool.query(sql);

    const { rows: trackRows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tracks;`
    );
    const { rows: colRows } = await pool.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'problem_statements'
          AND column_name = 'track';`
    );
    const { rows: orphanRows } = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM problem_statements ps
         LEFT JOIN tracks t ON t.value = ps.track
        WHERE ps.track IS NOT NULL AND t.id IS NULL;`
    );

    console.log(`✅ tracks catalog rows      : ${trackRows[0].n}`);
    console.log(`✅ problem_statements.track : ${colRows[0]?.data_type ?? "unknown"}`);
    console.log(`✅ problem statements with an unknown track: ${orphanRows[0].n}`);

    if (colRows[0]?.data_type !== "text") {
      console.error("❌ track column is still not text — migration did not apply");
      process.exit(1);
    }
    if (orphanRows[0].n > 0) {
      console.error("❌ some problem statements reference a track not in the catalog");
      process.exit(1);
    }

    console.log("✅ Migration complete");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
