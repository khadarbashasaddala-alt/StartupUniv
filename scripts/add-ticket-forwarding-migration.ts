/**
 * Migration: the forward_to_id column on tickets (academic-mentor gate).
 *
 * Run: npm run db:add-ticket-forwarding
 * Or directly: psql "$DATABASE_URL" -f scripts/sql/add-ticket-forwarding.sql
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
const SQL_FILE = join(__dirname, "sql", "add-ticket-forwarding.sql");

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  const isLocal =
    connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

  const pool = new Pool({
    connectionString: connectionString.replace(/[?&]sslmode=[^&]*/g, ""),
    connectionTimeoutMillis: 15000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  try {
    console.log("🔄 Adding forward_to_id to tickets...");
    await pool.query(readFileSync(SQL_FILE, "utf8"));

    const { rows } = await pool.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tickets'
          AND column_name = 'forward_to_id';`
    );
    if (rows.length === 0) {
      console.error("❌ forward_to_id was not created");
      process.exit(1);
    }
    // Nullable by design: only tickets held for the academic mentor carry a value.
    if (rows[0].is_nullable !== "YES") {
      console.error("❌ forward_to_id should be nullable");
      process.exit(1);
    }

    console.log("✅ forward_to_id present and nullable on tickets");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
