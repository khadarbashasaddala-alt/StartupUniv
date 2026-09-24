/**
 * Migration: add per-role headcount columns to the cohorts table.
 *
 * SUPERSEDED by scripts/add-dynamic-roles-migration.ts, which moves these counts into
 * `cohort_role_counts` (one row per role, so roles added at runtime are covered) and
 * drops the columns this script adds. Kept for history only — do not run it again, or a
 * database already migrated will regain four unused columns.
 *
 * Run: npm run db:add-cohort-role-counts
 * If connection times out (e.g. remote DB), run the SQL manually:
 *   psql "$DATABASE_URL" -f scripts/sql/add-cohort-role-counts.sql
 */

import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

// Allow RDS/cloud DB self-signed certs (same as drizzle.config.ts)
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const COLUMNS = ["mentor_count", "founder_count", "cofounder_count", "learner_count"];

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Connecting and adding role count columns to cohorts...");

    for (const column of COLUMNS) {
      const check = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'cohorts' AND column_name = $1;`,
        [column]
      );

      if (check.rows.length > 0) {
        console.log(`ℹ️  Column ${column} already exists`);
      } else {
        await pool.query(`ALTER TABLE cohorts ADD COLUMN ${column} INTEGER DEFAULT 0;`);
        console.log(`✅ Column ${column} added`);
      }
    }

    console.log("✅ Migration complete");
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
      console.log("\n💡 If the DB is remote, run the SQL manually from a machine that can reach it:");
      console.log('   psql "$DATABASE_URL" -f scripts/sql/add-cohort-role-counts.sql');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
