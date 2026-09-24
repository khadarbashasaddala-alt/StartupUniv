import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createTeamMeetingsTable() {
  try {
    console.log("Creating team_meetings table...");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS team_meetings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id VARCHAR(36) NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        created_by VARCHAR(36) NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        agenda TEXT,
        scheduled_at TIMESTAMP NOT NULL,
        duration_minutes INTEGER DEFAULT 30,
        timezone TEXT DEFAULT 'Asia/Kolkata',
        meeting_link TEXT,
        google_event_id TEXT,
        attendee_ids TEXT[],
        sprint_id VARCHAR(36) REFERENCES sprints(id) ON DELETE SET NULL,
        notes TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS team_meetings_team_id_idx ON team_meetings(team_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS team_meetings_created_by_idx ON team_meetings(created_by);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS team_meetings_scheduled_at_idx ON team_meetings(scheduled_at);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS team_meetings_sprint_id_idx ON team_meetings(sprint_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS team_meetings_deleted_at_idx ON team_meetings(deleted_at);
    `);

    console.log("✅ Team meetings table created successfully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating team meetings table:", error);
    process.exit(1);
  }
}

createTeamMeetingsTable();
