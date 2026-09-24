// Migration script to add TEAM_MEMBER_APPLICATION_ACCEPTED to notification_type enum
import "dotenv/config";
import { pool } from "../server/db";

async function addNotificationType() {
  try {
    console.log("🔄 Adding TEAM_MEMBER_APPLICATION_ACCEPTED to notification_type enum...");
    
    // Check if enum values already exist
    const checkQuery = `
      SELECT unnest(enum_range(NULL::notification_type))::text as value;
    `;
    const existingValues = await pool.query(checkQuery);
    const values = existingValues.rows.map((row: any) => row.value);
    
    console.log("📋 Current enum values:", values);
    
    // Add TEAM_MEMBER_APPLICATION_ACCEPTED if it doesn't exist
    if (!values.includes("TEAM_MEMBER_APPLICATION_ACCEPTED")) {
      console.log("➕ Adding TEAM_MEMBER_APPLICATION_ACCEPTED...");
      try {
        await pool.query(`ALTER TYPE notification_type ADD VALUE 'TEAM_MEMBER_APPLICATION_ACCEPTED'`);
        console.log("✅ TEAM_MEMBER_APPLICATION_ACCEPTED added");
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log("ℹ️  TEAM_MEMBER_APPLICATION_ACCEPTED already exists");
        } else {
          throw error;
        }
      }
    } else {
      console.log("ℹ️  TEAM_MEMBER_APPLICATION_ACCEPTED already exists");
    }
    
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    // If enum values already exist, that's okay - don't fail
    if (error.message.includes("already exists") || error.message.includes("duplicate")) {
      console.log("ℹ️  Enum values already exist, skipping...");
      process.exit(0);
    }
    console.error("❌ Migration error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  } finally {
    // Don't close the pool - it might be used by other scripts
    // await pool.end();
  }
}

addNotificationType();

