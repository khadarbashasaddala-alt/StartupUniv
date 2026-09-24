// Migration script to add PROBLEM_STATEMENT_APPLICATION_RECEIVED to notification_type enum
import "dotenv/config";
import { pool } from "../server/db";

async function addNotificationType() {
  try {
    console.log("🔄 Adding PROBLEM_STATEMENT_APPLICATION_RECEIVED to notification_type enum...");

    const checkQuery = `
      SELECT unnest(enum_range(NULL::notification_type))::text as value;
    `;
    const existingValues = await pool.query(checkQuery);
    const values = existingValues.rows.map((row: any) => row.value);

    console.log("📋 Current enum values:", values);

    if (!values.includes("PROBLEM_STATEMENT_APPLICATION_RECEIVED")) {
      console.log("➕ Adding PROBLEM_STATEMENT_APPLICATION_RECEIVED...");
      try {
        await pool.query(
          `ALTER TYPE notification_type ADD VALUE 'PROBLEM_STATEMENT_APPLICATION_RECEIVED'`
        );
        console.log("✅ PROBLEM_STATEMENT_APPLICATION_RECEIVED added");
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log("ℹ️  PROBLEM_STATEMENT_APPLICATION_RECEIVED already exists");
        } else {
          throw error;
        }
      }
    } else {
      console.log("ℹ️  PROBLEM_STATEMENT_APPLICATION_RECEIVED already exists");
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    if (error.message.includes("already exists") || error.message.includes("duplicate")) {
      console.log("ℹ️  Enum values already exist, skipping...");
      process.exit(0);
    }
    console.error("❌ Migration error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
}

addNotificationType();
