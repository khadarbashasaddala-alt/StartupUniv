/**
 * Migration script to add cohort_tasks and cohort_task_sessions tables
 * Run with: npx tsx scripts/add-cohort-tasks-table-migration.ts
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting migration: Adding cohort_tasks and cohort_task_sessions tables...");

  try {
    // ========================================
    // 1. Create cohort_tasks table
    // ========================================
    const cohortTasksExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cohort_tasks'
      );
    `);

    const tasksExists = cohortTasksExists.rows[0]?.exists === true;

    if (tasksExists) {
      console.log("✅ cohort_tasks table already exists, skipping creation.");
    } else {
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
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      console.log("✅ Created cohort_tasks table");

      // Create indexes for cohort_tasks
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cohort_tasks_cohort_id_idx ON cohort_tasks (cohort_id);
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cohort_tasks_created_by_idx ON cohort_tasks (created_by);
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cohort_tasks_start_time_idx ON cohort_tasks (start_time);
      `);

      console.log("✅ Created indexes for cohort_tasks table");
    }

    // ========================================
    // 2. Create cohort_task_sessions table
    // ========================================
    const cohortTaskSessionsExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'cohort_task_sessions'
      );
    `);

    const sessionsExists = cohortTaskSessionsExists.rows[0]?.exists === true;

    if (sessionsExists) {
      console.log("✅ cohort_task_sessions table already exists, skipping creation.");
    } else {
      // Create the cohort_task_sessions table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cohort_task_sessions (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          cohort_task_id VARCHAR(36) NOT NULL,
          start_date TIMESTAMP NOT NULL,
          end_date TIMESTAMP NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          meeting_link TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      console.log("✅ Created cohort_task_sessions table");

      // Create indexes for cohort_task_sessions
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cohort_task_sessions_cohort_task_id_idx ON cohort_task_sessions (cohort_task_id);
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS cohort_task_sessions_start_date_idx ON cohort_task_sessions (start_date);
      `);

      console.log("✅ Created indexes for cohort_task_sessions table");
    }

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

migrate();
