import "dotenv/config";
import { pool } from "../server/db";

async function createMentorProfilesTable() {
  try {
    console.log("🔄 Creating mentor_profiles table...");

    // Check if the table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'mentor_profiles'
      );
    `;
    const tableExistsResult = await pool.query(tableCheckQuery);
    const tableExists = tableExistsResult.rows[0].exists;

    if (!tableExists) {
      console.log("➕ Creating mentor_profiles table...");
      await pool.query(`
        CREATE TABLE mentor_profiles (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(36) NOT NULL UNIQUE,
          education TEXT,
          skills TEXT[],
          experience TEXT,
          tracks_json JSONB,
          linkedin_url TEXT,
          github_url TEXT,
          portfolio_url TEXT,
          description TEXT,
          about_mentor TEXT,
          cv_url TEXT,
          certifications_url TEXT,
          video_url TEXT,
          credentials_shared BOOLEAN DEFAULT false,
          credentials_approved_by VARCHAR(36),
          credentials_approved_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log("✅ mentor_profiles table created.");

      // Create indexes
      console.log("➕ Creating indexes...");
      await pool.query(`
        CREATE INDEX mentor_profiles_user_id_idx ON mentor_profiles(user_id);
      `);
      console.log("✅ Indexes created.");
    } else {
      console.log("ℹ️  mentor_profiles table already exists");
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

createMentorProfilesTable();

