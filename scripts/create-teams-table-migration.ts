// Migration script to create teams table if it doesn't exist
import "dotenv/config";
import { pool } from "../server/db";

async function createTeamsTable() {
  try {
    console.log("🔄 Creating teams table if it doesn't exist...");
    
    // Check if table already exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'teams'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log("➕ Creating teams table...");
      
      // First check if team_health enum exists
      const enumCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'team_health'
        );
      `);
      
      if (!enumCheck.rows[0].exists) {
        console.log("➕ Creating team_health enum...");
        await pool.query(`
          CREATE TYPE team_health AS ENUM ('G', 'A', 'R');
        `);
        console.log("✅ Enum created");
      } else {
        console.log("ℹ️  team_health enum already exists");
      }
      
      await pool.query(`
        CREATE TABLE teams (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          cohort_id VARCHAR(36) NOT NULL,
          name TEXT NOT NULL,
          problem_statement_id VARCHAR(36),
          escrow_account_ref TEXT,
          health team_health DEFAULT 'G',
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create indexes
      await pool.query(`
        CREATE INDEX teams_cohort_id_idx ON teams(cohort_id);
      `);
      await pool.query(`
        CREATE INDEX teams_problem_statement_id_idx ON teams(problem_statement_id);
      `);

      console.log("✅ Teams table created");
    } else {
      console.log("ℹ️  Teams table already exists");
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

createTeamsTable();

