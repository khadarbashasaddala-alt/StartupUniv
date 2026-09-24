/**
 * Migration script to add public_token and email fields to assessment_assignments table
 * for public assessment access functionality
 */

import "dotenv/config";
import { pool } from "../server/db";

async function runMigration() {
  try {
    console.log("🔄 Starting migration to add public_token and email to assessment_assignments...");

    // Check if columns exist before adding
    const columns = [
      { name: "public_token", type: "TEXT" },
      { name: "email", type: "TEXT" },
    ];

    for (const col of columns) {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'assessment_assignments' AND column_name = $1
      `, [col.name]);

      if (checkResult.rows.length === 0) {
        await pool.query(`ALTER TABLE assessment_assignments ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Added column: ${col.name}`);
      } else {
        console.log(`ℹ️  Column already exists: ${col.name}`);
      }
    }

    // Add index on public_token for faster lookups
    console.log("📝 Adding index on public_token...");
    try {
      const indexCheck = await pool.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'assessment_assignments' AND indexname = 'assessment_assignments_public_token_idx'
      `);

      if (indexCheck.rows.length === 0) {
        await pool.query(`
          CREATE INDEX assessment_assignments_public_token_idx ON assessment_assignments(public_token)
        `);
        console.log("✅ Index on public_token created");
      } else {
        console.log("ℹ️  Index on public_token already exists");
      }
    } catch (error: any) {
      console.error("❌ Error creating index:", error.message);
      // Don't throw, index creation is optional
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

