// Migration: Add sprint_resources table (files teams upload against a sprint,
// shown in the sprint's Resources tab and its View Details dialog).
import { db, pool } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("🔄 Creating sprint_resources table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sprint_resources (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        sprint_id VARCHAR(36) NOT NULL,
        file_name TEXT NOT NULL,
        object_key TEXT NOT NULL,
        content_type TEXT,
        file_size INTEGER,
        uploaded_by_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Table sprint_resources ready");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprint_resources_sprint_id_idx ON sprint_resources (sprint_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprint_resources_uploaded_by_id_idx ON sprint_resources (uploaded_by_id)
    `);
    console.log("✅ Indexes ready");

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
