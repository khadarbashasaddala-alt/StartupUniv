// Migration: Let sprint_resources rows point at an external URL instead of an
// uploaded file. Adds `type` ("file" | "link") and `url`, and relaxes
// object_key to be nullable since link resources won't have one.
import { db, pool } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("🔄 Updating sprint_resources for link-type resources...");

    await db.execute(sql`
      ALTER TABLE sprint_resources
        ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'file'
    `);
    await db.execute(sql`
      ALTER TABLE sprint_resources
        ADD COLUMN IF NOT EXISTS url TEXT
    `);
    await db.execute(sql`
      ALTER TABLE sprint_resources
        ALTER COLUMN object_key DROP NOT NULL
    `);

    console.log("✅ sprint_resources ready for link-type resources");
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
