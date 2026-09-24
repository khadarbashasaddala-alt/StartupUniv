/**
 * Migration script to add review workflow fields to tasks table:
 * - assigned_by: User who originally assigned the task
 * - reviewer_id: User currently reviewing (when status is REVIEW)
 * - review_comment: Comment from reviewer when changing status
 */

import "dotenv/config";
import { pool } from "../server/db";

async function runMigration() {
  try {
    console.log("🔄 Starting migration: Adding task review workflow fields...");

    // 1. Add assigned_by column
    console.log("📝 Adding 'assigned_by' column to tasks table...");
    try {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'assigned_by'
      `);

      if (checkResult.rows.length === 0) {
        await pool.query(`
          ALTER TABLE tasks 
          ADD COLUMN assigned_by VARCHAR(36)
        `);
        console.log("✅ Added column: assigned_by");
      } else {
        console.log("ℹ️  Column already exists: assigned_by");
      }
    } catch (error: any) {
      console.error("❌ Error adding assigned_by column:", error.message);
      throw error;
    }

    // 2. Add reviewer_id column
    console.log("📝 Adding 'reviewer_id' column to tasks table...");
    try {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'reviewer_id'
      `);

      if (checkResult.rows.length === 0) {
        await pool.query(`
          ALTER TABLE tasks 
          ADD COLUMN reviewer_id VARCHAR(36)
        `);
        console.log("✅ Added column: reviewer_id");
      } else {
        console.log("ℹ️  Column already exists: reviewer_id");
      }
    } catch (error: any) {
      console.error("❌ Error adding reviewer_id column:", error.message);
      throw error;
    }

    // 3. Add review_comment column
    console.log("📝 Adding 'review_comment' column to tasks table...");
    try {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'review_comment'
      `);

      if (checkResult.rows.length === 0) {
        await pool.query(`
          ALTER TABLE tasks 
          ADD COLUMN review_comment TEXT
        `);
        console.log("✅ Added column: review_comment");
      } else {
        console.log("ℹ️  Column already exists: review_comment");
      }
    } catch (error: any) {
      console.error("❌ Error adding review_comment column:", error.message);
      throw error;
    }

    // 4. Create indexes
    console.log("📝 Creating indexes...");
    
    // Index for assigned_by
    try {
      const checkIndex = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'tasks' AND indexname = 'tasks_assigned_by_idx'
      `);

      if (checkIndex.rows.length === 0) {
        await pool.query(`
          CREATE INDEX tasks_assigned_by_idx ON tasks(assigned_by)
        `);
        console.log("✅ Created index: tasks_assigned_by_idx");
      } else {
        console.log("ℹ️  Index already exists: tasks_assigned_by_idx");
      }
    } catch (error: any) {
      console.error("❌ Error creating assigned_by index:", error.message);
      throw error;
    }

    // Index for reviewer_id
    try {
      const checkIndex = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'tasks' AND indexname = 'tasks_reviewer_id_idx'
      `);

      if (checkIndex.rows.length === 0) {
        await pool.query(`
          CREATE INDEX tasks_reviewer_id_idx ON tasks(reviewer_id)
        `);
        console.log("✅ Created index: tasks_reviewer_id_idx");
      } else {
        console.log("ℹ️  Index already exists: tasks_reviewer_id_idx");
      }
    } catch (error: any) {
      console.error("❌ Error creating reviewer_id index:", error.message);
      throw error;
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
