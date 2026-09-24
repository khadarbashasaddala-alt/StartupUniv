// Migration script to add ASSESSMENT_REVIEWED to notification_type enum
import "dotenv/config";
import { pool } from "../server/db";

async function addAssessmentReviewedType() {
  try {
    console.log("🔄 Adding ASSESSMENT_REVIEWED to notification_type enum...");

    // First, check if the enum exists
    const enumExistsQuery = `
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'notification_type'
      );
    `;
    const enumExistsResult = await pool.query(enumExistsQuery);
    const enumExists = enumExistsResult.rows[0].exists;

    if (!enumExists) {
      console.log("📝 Creating notification_type enum...");
      // Create the enum with all values
      await pool.query(`
        CREATE TYPE notification_type AS ENUM (
          'MENTOR_CREATED',
          'CANDIDATE_SELECTED',
          'CREDENTIALS_APPROVED',
          'ASSESSMENT_REVIEWED'
        );
      `);
      console.log("✅ notification_type enum created with all values");
    } else {
      console.log("ℹ️  notification_type enum already exists");
      
      // Check existing values
      const checkQuery = `
        SELECT unnest(enum_range(NULL::notification_type))::text as value;
      `;
      const existingValues = await pool.query(checkQuery);
      const values = existingValues.rows.map((row: any) => row.value);

      console.log("📋 Current enum values:", values);

      if (!values.includes("ASSESSMENT_REVIEWED")) {
        console.log("➕ Adding ASSESSMENT_REVIEWED...");
        try {
          await pool.query(`ALTER TYPE notification_type ADD VALUE 'ASSESSMENT_REVIEWED'`);
          console.log("✅ ASSESSMENT_REVIEWED added");
        } catch (error: any) {
          if (error.message.includes("already exists")) {
            console.log("ℹ️  ASSESSMENT_REVIEWED already exists");
          } else {
            throw error;
          }
        }
      } else {
        console.log("ℹ️  ASSESSMENT_REVIEWED already exists");
      }
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addAssessmentReviewedType();

