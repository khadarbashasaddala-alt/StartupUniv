-- Migration: Add accepted_terms_at column to applications table
-- Run on both LOCAL and PRODUCTION databases
-- This column records when a user accepted Terms & Conditions

-- Add the column (nullable, so existing rows are unaffected)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMP;

-- Backfill existing applications: set accepted_terms_at = created_at
-- for all applications where formJson contains acceptTerms = true
UPDATE applications
SET accepted_terms_at = created_at
WHERE accepted_terms_at IS NULL
  AND form_json IS NOT NULL
  AND (form_json->>'acceptTerms')::text = 'true';


/**
 * Migration: add first_time_login and experience_flag columns to users table.
 * Run: npx tsx scripts/add-user-experience-columns-to-users-migration.ts
 */

import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log("Adding users.first_time_login and users.experience_flag columns if missing...");

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_time_login BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS experience_flag JSON NOT NULL
      DEFAULT '{"hasSeenRolesResponsibilities": false, "hasSeenSidebarTooltip": false}'::json;
    `);

    console.log("Migration complete");
  } catch (error: any) {
    console.error("Migration error:", error.message || error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration();
