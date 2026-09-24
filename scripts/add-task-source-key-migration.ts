/**
 * Migration: add tasks.source_key and its partial unique index.
 *
 * Run: npm run db:add-task-source-key
 * Or directly: psql "$DATABASE_URL" -f scripts/sql/add-task-source-key.sql
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
const SQL_FILE = join(__dirname, "sql", "add-task-source-key.sql");

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
    console.log("🔄 Adding tasks.source_key...");
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const { rows: column } = await pool.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_key';`
    );

    if (column.length === 0) {
      console.error("❌ tasks.source_key was not created");
      process.exit(1);
    }

    // The index is what actually enforces idempotency, so verify it exists AND that it is the
    // partial one — a plain unique index here would collide across sprints.
    const { rows: index } = await pool.query(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'tasks'
          AND indexname = 'tasks_sprint_source_key_idx';`
    );

    if (index.length === 0) {
      console.error("❌ tasks_sprint_source_key_idx was not created");
      process.exit(1);
    }
    if (!/WHERE \(source_key IS NOT NULL\)/i.test(index[0].indexdef)) {
      console.error("❌ index exists but is not partial — hand-made tasks would collide:");
      console.error(`   ${index[0].indexdef}`);
      process.exit(1);
    }

    const { rows: counts } = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(source_key)::int AS generated FROM tasks;`
    );

    console.log(`✅ tasks.source_key : ${column[0].data_type} (nullable=${column[0].is_nullable})`);
    console.log(`✅ partial index    : ${index[0].indexdef}`);
    console.log(
      `✅ tasks            : ${counts[0].generated} of ${counts[0].total} are plan-generated (rest stay hand-made)`
    );
    console.log("✅ Migration complete");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
