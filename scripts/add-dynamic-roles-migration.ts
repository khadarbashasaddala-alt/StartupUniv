/**
 * Migration: turn user roles into rows in `roles` (so admins can add one at runtime) and
 * move cohort headcount planning from four fixed columns to `cohort_role_counts`.
 * Run: npm run db:add-dynamic-roles
 * If connection times out (e.g. remote DB), run the SQL manually:
 *   psql "$DATABASE_URL" -f scripts/sql/add-dynamic-roles.sql
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

const SQL_FILE = join(dirname(fileURLToPath(import.meta.url)), "sql", "add-dynamic-roles.sql");

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }
  // Strip sslmode from the URL, the same way server/db.ts does. Newer pg treats
  // `sslmode=require` as verify-full and lets it override the ssl option below, which
  // fails against RDS's private CA with "self-signed certificate in certificate chain".
  // Without this the migration's success depends on NODE_TLS_REJECT_UNAUTHORIZED above
  // disabling TLS verification for the whole process, which is not something to rely on.
  const pool = new Pool({
    connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ""),
    connectionTimeoutMillis: 15000,
    // No query_timeout: the enum conversion rewrites every row of `users`, which can
    // outlast the 15s used by the smaller migrations in this directory.
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Connecting and making roles dynamic...");

    // The whole file is one transaction, so a failure part-way leaves nothing behind.
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const [{ rows: roleRows }, { rows: countRows }] = await Promise.all([
      pool.query(`SELECT code, label, is_system FROM roles ORDER BY sort_order;`),
      pool.query(`SELECT COUNT(*)::int AS n FROM cohort_role_counts;`),
    ]);

    console.log(`✅ ${roleRows.length} roles registered:`);
    for (const row of roleRows) {
      console.log(`   ${row.code.padEnd(12)} ${row.label}${row.is_system ? " (system)" : ""}`);
    }
    console.log(`✅ ${countRows[0].n} cohort composition row(s) carried over`);
    console.log("✅ Migration complete");
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
      console.log("\n💡 If the DB is remote, run the SQL manually from a machine that can reach it:");
      console.log('   psql "$DATABASE_URL" -f scripts/sql/add-dynamic-roles.sql');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
