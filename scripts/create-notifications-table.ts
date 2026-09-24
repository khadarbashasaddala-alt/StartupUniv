import "dotenv/config";
import { pool } from "../server/db";

async function createNotificationsTable() {
  try {
    console.log("🔄 Creating notifications table...");

    // Check if the notification_type enum exists, create if not
    const enumCheckQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'notification_type'
      );
    `;
    const enumExistsResult = await pool.query(enumCheckQuery);
    const enumExists = enumExistsResult.rows[0].exists;

    if (!enumExists) {
      console.log("➕ Creating notification_type enum...");
      await pool.query(`
        CREATE TYPE notification_type AS ENUM (
          'MENTOR_CREATED',
          'CANDIDATE_SELECTED',
          'CREDENTIALS_APPROVED',
          'ASSESSMENT_REVIEWED'
        );
      `);
      console.log("✅ notification_type enum created.");
    } else {
      console.log("ℹ️  notification_type enum already exists");
    }

    // Check if the notification_status enum exists, create if not
    const statusEnumCheckQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'notification_status'
      );
    `;
    const statusEnumExistsResult = await pool.query(statusEnumCheckQuery);
    const statusEnumExists = statusEnumExistsResult.rows[0].exists;

    if (!statusEnumExists) {
      console.log("➕ Creating notification_status enum...");
      await pool.query(`
        CREATE TYPE notification_status AS ENUM (
          'UNREAD',
          'READ',
          'ARCHIVED'
        );
      `);
      console.log("✅ notification_status enum created.");
    } else {
      console.log("ℹ️  notification_status enum already exists");
    }

    // Check if the notifications table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'notifications'
      );
    `;
    const tableExistsResult = await pool.query(tableCheckQuery);
    const tableExists = tableExistsResult.rows[0].exists;

    if (!tableExists) {
      console.log("➕ Creating notifications table...");
      await pool.query(`
        CREATE TABLE notifications (
          id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(36) NOT NULL,
          type notification_type NOT NULL,
          status notification_status NOT NULL DEFAULT 'UNREAD',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          metadata_json JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          read_at TIMESTAMP
        );
      `);
      console.log("✅ notifications table created.");

      // Create indexes
      console.log("➕ Creating indexes...");
      await pool.query(`
        CREATE INDEX notifications_user_id_idx ON notifications(user_id);
      `);
      await pool.query(`
        CREATE INDEX notifications_status_idx ON notifications(status);
      `);
      console.log("✅ Indexes created.");
    } else {
      console.log("ℹ️  notifications table already exists");
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

createNotificationsTable();

