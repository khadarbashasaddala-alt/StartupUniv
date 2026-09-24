// Migration: Add objectives and deliverables columns to sprints table
import { db, pool } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("🔄 Adding objectives and deliverables columns to sprints table...");

    // Check if columns already exist
    const checkColumns = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sprints' 
      AND column_name IN ('objectives', 'deliverables')
    `);

    const existingColumns = checkColumns.rows.map((row: any) => row.column_name);

    // Add objectives column if it doesn't exist
    if (!existingColumns.includes('objectives')) {
      console.log("➕ Adding 'objectives' column...");
      await db.execute(sql`
        ALTER TABLE sprints 
        ADD COLUMN IF NOT EXISTS objectives TEXT
      `);
      console.log("✅ Added 'objectives' column");
    } else {
      console.log("✓ 'objectives' column already exists");
    }

    // Add deliverables column if it doesn't exist
    if (!existingColumns.includes('deliverables')) {
      console.log("➕ Adding 'deliverables' column...");
      await db.execute(sql`
        ALTER TABLE sprints 
        ADD COLUMN IF NOT EXISTS deliverables TEXT
      `);
      console.log("✅ Added 'deliverables' column");
    } else {
      console.log("✓ 'deliverables' column already exists");
    }

    console.log("✅ Migration completed successfully!");
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

