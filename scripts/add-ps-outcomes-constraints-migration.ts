/**
 * Migration: Add expected_outcomes and constraints_requirements columns to problem_statements
 * Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS).
 * Run with: npx tsx scripts/add-ps-outcomes-constraints-migration.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting migration: Adding expected_outcomes and constraints_requirements to problem_statements...");

  try {
    // Add expected_outcomes column (nullable text)
    await db.execute(sql`
      ALTER TABLE problem_statements
      ADD COLUMN IF NOT EXISTS expected_outcomes TEXT;
    `);
    console.log("✅ expected_outcomes column added (or already existed).");

    // Add constraints_requirements column (nullable text)
    await db.execute(sql`
      ALTER TABLE problem_statements
      ADD COLUMN IF NOT EXISTS constraints_requirements TEXT;
    `);
    console.log("✅ constraints_requirements column added (or already existed).");

    console.log("🎉 Migration completed successfully.");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message ?? error);
    process.exit(1);
  }
}

migrate();
