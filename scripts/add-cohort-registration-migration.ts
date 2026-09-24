import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting migration: Adding cohort registration fields...");

  try {
    // Add is_open_for_registration column to cohorts table
    console.log("Adding is_open_for_registration column to cohorts...");
    await db.execute(sql`
      ALTER TABLE cohorts 
      ADD COLUMN IF NOT EXISTS is_open_for_registration BOOLEAN DEFAULT false
    `);
    console.log("✅ Added is_open_for_registration column");

    // Create cohort_users table if it doesn't exist
    console.log("Creating cohort_users table...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cohort_users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cohort_id TEXT NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);
    console.log("✅ Created cohort_users table");

    // Create indexes
    console.log("Creating indexes...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cohort_users_user_id ON cohort_users(user_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_cohort_users_cohort_id ON cohort_users(cohort_id)
    `);
    console.log("✅ Created indexes");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }

  process.exit(0);
}

migrate();
