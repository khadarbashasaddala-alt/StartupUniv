/**
 * Migration: per-submission evidence review, plus the mentor kind.
 *
 * Run: npm run db:add-evidence-review
 * Or directly: psql "$DATABASE_URL" -f scripts/sql/add-evidence-review.sql
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
const SQL_FILE = join(__dirname, "sql", "add-evidence-review.sql");

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
    // No query_timeout: the backfill touches every evidence row on a finished task.
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Adding evidence review state and mentor kind...");
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const { rows: cols } = await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'evidence'
          AND column_name IN ('status','reviewed_by','reviewed_at','feedback');`
    );
    if (cols.length !== 4) {
      console.error(`❌ expected 4 review columns on evidence, found ${cols.length}`);
      process.exit(1);
    }

    // The partial index is what keeps the queue cheap as the accepted pile grows, so verify it
    // is actually partial rather than merely present.
    const { rows: index } = await pool.query(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'evidence'
          AND indexname = 'evidence_pending_review_idx';`
    );
    if (index.length === 0) {
      console.error("❌ evidence_pending_review_idx was not created");
      process.exit(1);
    }
    if (!/WHERE/i.test(index[0].indexdef)) {
      console.error("❌ index exists but is not partial:");
      console.error(`   ${index[0].indexdef}`);
      process.exit(1);
    }

    const { rows: extra } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM information_schema.columns
           WHERE table_name='tasks' AND column_name='requires_review_from') AS task_col,
         (SELECT COUNT(*)::int FROM information_schema.columns
           WHERE table_name='role_assignments' AND column_name='mentor_kind') AS assignment_col;`
    );
    if (extra[0].task_col !== 1 || extra[0].assignment_col !== 1) {
      console.error("❌ requires_review_from / mentor_kind were not created");
      process.exit(1);
    }

    const { rows: counts } = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM evidence GROUP BY status ORDER BY status;`
    );

    console.log(`✅ evidence review columns : ${cols.map((c) => c.column_name).sort().join(", ")}`);
    console.log(`✅ partial index           : ${index[0].indexdef}`);
    console.log(`✅ tasks.requires_review_from and role_assignments.mentor_kind present`);
    for (const row of counts) {
      console.log(`   evidence ${row.status.padEnd(18)} ${row.n}`);
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
