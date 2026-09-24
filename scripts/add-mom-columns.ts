import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addMomColumns() {
  try {
    console.log("Adding MOM columns to team_meetings table...");

    await db.execute(sql`
      ALTER TABLE team_meetings
        ADD COLUMN IF NOT EXISTS mom_title TEXT,
        ADD COLUMN IF NOT EXISTS mom_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS mom_document TEXT;
    `);

    console.log("✅ MOM columns added successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding MOM columns:", error);
    process.exit(1);
  }
}

addMomColumns();
