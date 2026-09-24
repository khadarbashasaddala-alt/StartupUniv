// Migration: Make sprintId nullable and add teamId to tasks table for standalone tasks
import { db, pool } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("🔄 Adding support for standalone tasks (tasks without sprint)...");

    // Check if team_id column exists
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      AND column_name IN ('team_id', 'sprint_id')
    `);

    const existingColumns = checkColumns.rows.map((row: any) => row.column_name);

    // Add team_id column if it doesn't exist
    if (!existingColumns.includes('team_id')) {
      console.log("➕ Adding 'team_id' column to tasks...");
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN IF NOT EXISTS team_id VARCHAR(36)
      `);
      console.log("✅ Added 'team_id' column");
    } else {
      console.log("✓ 'team_id' column already exists");
    }

    // Make sprint_id nullable
    console.log("🔄 Making 'sprint_id' nullable...");
    await db.execute(sql`
      ALTER TABLE tasks 
      ALTER COLUMN sprint_id DROP NOT NULL
    `);
    console.log("✅ Made 'sprint_id' nullable");

    // Create index on team_id if it doesn't exist
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS tasks_team_id_idx ON tasks(team_id)
      `);
      console.log("✅ Created index on 'team_id'");
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log("✓ Index on 'team_id' already exists");
      } else {
        throw error;
      }
    }

    // Add constraint: task must have either sprint_id or team_id
    try {
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_sprint_or_team_check 
        CHECK (sprint_id IS NOT NULL OR team_id IS NOT NULL)
      `);
      console.log("✅ Added constraint: task must have sprint_id or team_id");
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log("✓ Constraint already exists");
      } else {
        throw error;
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error: any) {
    console.error("❌ Migration error:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

