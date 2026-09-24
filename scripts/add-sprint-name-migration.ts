/**
 * Migration: add sprints.name.
 *
 * Run: npm run db:add-sprint-name
 * Or directly: psql "$DATABASE_URL" -f scripts/sql/add-sprint-name.sql
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
const SQL_FILE = join(__dirname, "sql", "add-sprint-name.sql");

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
    console.log("🔄 Adding sprints.name...");
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const { rows } = await pool.query(
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'sprints' AND column_name = 'name';`
    );

    if (rows.length === 0) {
      console.error("❌ sprints.name was not created");
      process.exit(1);
    }

    const { rows: counts } = await pool.query(
      `SELECT COUNT(*)::int AS total, COUNT(name)::int AS named FROM sprints;`
    );

    console.log(`✅ sprints.name : ${rows[0].data_type} (nullable=${rows[0].is_nullable})`);
    console.log(`✅ sprints       : ${counts[0].named} of ${counts[0].total} have a name`);
    console.log("✅ Migration complete");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
