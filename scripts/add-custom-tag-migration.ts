import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting migration: Adding custom_tag column to users...");

  try {
    console.log("Adding custom_tag column to users...");
    await db.execute(sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS custom_tag TEXT
    `);
    console.log("✅ Added custom_tag column");

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }

  process.exit(0);
}

migrate();
