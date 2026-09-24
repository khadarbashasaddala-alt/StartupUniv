// Migration: Add sprint_exports table (audit trail for completed-sprint exports)
import { db, pool } from "../db";
import { sql } from "drizzle-orm";

async function migrate() {
  try {
    console.log("🔄 Creating sprint_exports table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sprint_exports (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        sprint_id VARCHAR(36) NOT NULL,
        team_id VARCHAR(36) NOT NULL,
        exported_by VARCHAR(36) NOT NULL,
        format VARCHAR(20) NOT NULL DEFAULT 'zip',
        task_count INTEGER DEFAULT 0,
        attachment_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        byte_size BIGINT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("✅ Table sprint_exports ready");

    // Widen byte_size for anyone who ran an earlier version of this migration:
    // int4 tops out around 2.1 GB, which a large team's attachments can exceed.
    await db.execute(sql`
      ALTER TABLE sprint_exports ALTER COLUMN byte_size TYPE BIGINT
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprint_exports_sprint_id_idx ON sprint_exports (sprint_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprint_exports_team_id_idx ON sprint_exports (team_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS sprint_exports_exported_by_idx ON sprint_exports (exported_by)
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
