import "dotenv/config";
import { pool } from "../server/db";

async function ensureEnumValue(enumName: string, value: string) {
  const res = await pool.query(
    `SELECT e.enumlabel
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = $1`,
    [enumName]
  );
  const values = res.rows.map((r: any) => r.enumlabel);
  if (values.includes(value)) {
    console.log(`ℹ️  ${value} already exists in ${enumName}`);
    return;
  }
  console.log(`➕ Adding ${value} to ${enumName}...`);
  await pool.query(`ALTER TYPE ${enumName} ADD VALUE '${value}'`);
  console.log(`✅ Added ${value} to ${enumName}`);
}

async function run() {
  try {
    console.log("🔧 Migrating TEAM applications...");
    console.log("📊 Database URL:", process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 20)}...` : "NOT SET");

    // 1) Add TEAM to application_type enum
    console.log("\n1️⃣ Checking application_type enum...");
    await ensureEnumValue("application_type", "TEAM");

    // 2) Create team_application_member_status enum
    console.log("\n2️⃣ Creating team_application_member_status enum...");
    const enumCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'team_application_member_status'
      );
    `);
    
    if (!enumCheck.rows[0].exists) {
      console.log("➕ Creating team_application_member_status enum...");
      await pool.query(`CREATE TYPE team_application_member_status AS ENUM ('PENDING','INVITED','SUBMITTED');`);
      console.log("✅ Enum created");
    } else {
      console.log("ℹ️  Enum already exists");
    }

    // 3) Create team_application_members table
    console.log("\n3️⃣ Creating team_application_members table...");
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_application_members'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log("➕ Creating team_application_members table...");
    await pool.query(`
        CREATE TABLE team_application_members (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        team_application_id varchar(36) NOT NULL,
        member_index integer NOT NULL,
        full_name text NOT NULL,
        email text NOT NULL,
        role user_role NOT NULL,
        cofounder_role text,
        intern_track text,
        individual_application_id varchar(36),
        status team_application_member_status NOT NULL DEFAULT 'PENDING',
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
      console.log("✅ Table created");
    } else {
      console.log("ℹ️  Table already exists");
    }

    console.log("➕ Creating indexes for team_application_members...");
    await pool.query(`CREATE INDEX IF NOT EXISTS team_application_members_team_application_id_idx ON team_application_members(team_application_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS team_application_members_email_idx ON team_application_members(email);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS team_application_members_status_idx ON team_application_members(status);`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS team_application_members_unique_email_idx ON team_application_members(team_application_id, email);`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS team_application_members_unique_index_idx ON team_application_members(team_application_id, member_index);`);
    console.log("✅ Indexes created");

    // 4) Create team_application_invites table
    console.log("\n4️⃣ Creating team_application_invites table...");
    const invitesTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_application_invites'
      );
    `);
    
    if (!invitesTableCheck.rows[0].exists) {
      console.log("➕ Creating team_application_invites table...");
    await pool.query(`
        CREATE TABLE team_application_invites (
        id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        member_id varchar(36) NOT NULL,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamp,
        sent_at timestamp,
        used_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
      console.log("✅ Table created");
    } else {
      console.log("ℹ️  Table already exists");
    }

    console.log("➕ Creating indexes for team_application_invites...");
    await pool.query(`CREATE INDEX IF NOT EXISTS team_application_invites_member_id_idx ON team_application_invites(member_id);`);
    console.log("✅ Indexes created");

    console.log("\n✅ TEAM applications migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ TEAM applications migration failed:", error?.message || error);
    if (error.code) {
      console.error("Error code:", error.code);
    }
    if (error.detail) {
      console.error("Error detail:", error.detail);
    }
    console.error("Full error:", error);
    process.exit(1);
  }
}

run();
