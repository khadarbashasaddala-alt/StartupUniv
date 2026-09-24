// Migration script to create team_member_applications table and enum
import "dotenv/config";
import { pool } from "../server/db";

async function addTeamMemberApplications() {
  try {
    console.log("🔄 Creating team_member_application_status enum and team_member_applications table...");
    
    // Check if enum already exists
    const enumCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'team_member_application_status'
      );
    `);
    
    if (!enumCheck.rows[0].exists) {
      console.log("➕ Creating team_member_application_status enum...");
      await pool.query(`
        CREATE TYPE team_member_application_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
      `);
      console.log("✅ Enum created");
    } else {
      console.log("ℹ️  Enum already exists");
    }

    // Check if table already exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_member_applications'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("➕ Creating team_member_applications table...");
      await pool.query(`
        CREATE TABLE team_member_applications (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          founder_id VARCHAR(36) NOT NULL,
          target_user_id VARCHAR(36) NOT NULL,
          target_user_role user_role NOT NULL,
          message TEXT,
          status team_member_application_status NOT NULL DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          CONSTRAINT team_member_applications_unique_idx UNIQUE (founder_id, target_user_id)
        );
      `);

      // Create indexes
      await pool.query(`
        CREATE INDEX team_member_applications_founder_id_idx ON team_member_applications(founder_id);
      `);
      await pool.query(`
        CREATE INDEX team_member_applications_target_user_id_idx ON team_member_applications(target_user_id);
      `);

      console.log("✅ Table created");
    } else {
      console.log("ℹ️  Table already exists");
    }
    
    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    if (error.message?.includes("already exists") || 
        error.message?.includes("duplicate") ||
        error.code === "42P07" || // table already exists
        error.code === "42710") { // object already exists
      console.log("ℹ️  Migration data already exists, skipping...");
      console.log("✅ Migration completed (data already present)");
      process.exit(0);
    }
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

addTeamMemberApplications();

