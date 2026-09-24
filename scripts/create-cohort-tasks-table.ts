/**
 * Migration script to create the cohort_tasks table
 * Run with: npx tsx scripts/create-cohort-tasks-table.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createCohortTasksTable() {
  console.log("🚀 Creating cohort_tasks table...");

  try {
    // Create the cohort_tasks table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cohort_tasks (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        cohort_id VARCHAR(36) NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        meeting_link TEXT,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ cohort_tasks table created successfully");

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cohort_tasks_cohort_id_idx ON cohort_tasks(cohort_id)
    `);
    console.log("✅ cohort_tasks_cohort_id_idx created");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cohort_tasks_created_by_idx ON cohort_tasks(created_by)
    `);
    console.log("✅ cohort_tasks_created_by_idx created");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cohort_tasks_start_time_idx ON cohort_tasks(start_time)
    `);
    console.log("✅ cohort_tasks_start_time_idx created");

    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

createCohortTasksTable();
