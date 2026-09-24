/**
 * Migration: add password_changed_at to users table for "Last changed" in settings.
 * Run: npm run db:add-password-changed-at
 * If connection times out (e.g. remote DB), run the SQL manually:
 *   psql "$DATABASE_URL" -f scripts/sql/add-password-changed-at.sql
 */

import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

// Allow RDS/cloud DB self-signed certs (same as drizzle.config.ts)
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

async function runMigration() {
  // Use a longer connection timeout for remote DBs (e.g. RDS)
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
    console.log("🔄 Connecting and adding password_changed_at to users...");

    const check = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_changed_at';
    `);

    if (check.rows.length > 0) {
      console.log("ℹ️  Column password_changed_at already exists");
    } else {
      await pool.query(`
        ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
      `);
      console.log("✅ Column password_changed_at added");
    }

    console.log("✅ Migration complete");
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
      console.log("\n💡 If the DB is remote, run the SQL manually from a machine that can reach it:");
      console.log('   psql "$DATABASE_URL" -f scripts/sql/add-password-changed-at.sql');
    }
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
