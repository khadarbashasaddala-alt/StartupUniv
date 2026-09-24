/**
 * Migration script to add new fields to applications table:
 * - ACCEPTED status to application_status enum
 * - meetingScheduledAt, meetingLink, meetingAgenda, meetingGoogleEventId
 * - paymentConfirmed, paymentConfirmedAt, paymentConfirmedBy
 * - FOUNDER and COFOUNDER to user_role enum
 */

import "dotenv/config";
import { pool } from "../server/db";

async function runMigration() {
  try {
    console.log("🔄 Starting migration...");

    // 1. Add ACCEPTED to application_status enum
    console.log("📝 Adding ACCEPTED to application_status enum...");
    try {
      const checkResult = await pool.query(`
        SELECT unnest(enum_range(NULL::application_status))::text as value;
      `);
      const values = checkResult.rows.map((row: any) => row.value);
      
      if (!values.includes("ACCEPTED")) {
        await pool.query(`ALTER TYPE application_status ADD VALUE 'ACCEPTED'`);
        console.log("✅ ACCEPTED status added");
      } else {
        console.log("ℹ️  ACCEPTED status already exists");
      }
    } catch (error: any) {
      console.error("❌ Error adding ACCEPTED status:", error.message);
      throw error;
    }

    // 2. Add FOUNDER and COFOUNDER to user_role enum
    console.log("📝 Adding FOUNDER and COFOUNDER to user_role enum...");
    try {
      const checkResult = await pool.query(`
        SELECT unnest(enum_range(NULL::user_role))::text as value;
      `);
      const values = checkResult.rows.map((row: any) => row.value);
      
      if (!values.includes("FOUNDER")) {
        await pool.query(`ALTER TYPE user_role ADD VALUE 'FOUNDER'`);
        console.log("✅ FOUNDER role added");
      } else {
        console.log("ℹ️  FOUNDER role already exists");
      }
      
      if (!values.includes("COFOUNDER")) {
        await pool.query(`ALTER TYPE user_role ADD VALUE 'COFOUNDER'`);
        console.log("✅ COFOUNDER role added");
      } else {
        console.log("ℹ️  COFOUNDER role already exists");
      }
    } catch (error: any) {
      console.error("❌ Error adding user roles:", error.message);
      throw error;
    }

    // 3. Add meeting fields to applications table
    console.log("📝 Adding meeting fields to applications table...");
    
    // Check if columns exist before adding
    const meetingColumns = [
      { name: "meeting_scheduled_at", type: "TIMESTAMP" },
      { name: "meeting_link", type: "TEXT" },
      { name: "meeting_agenda", type: "TEXT" },
      { name: "meeting_google_event_id", type: "TEXT" },
    ];

    for (const col of meetingColumns) {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'applications' AND column_name = $1
      `, [col.name]);

      if (checkResult.rows.length === 0) {
        await pool.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Added column: ${col.name}`);
      } else {
        console.log(`ℹ️  Column already exists: ${col.name}`);
      }
    }

    // 4. Add payment confirmation fields
    console.log("📝 Adding payment confirmation fields...");
    
    const paymentColumns = [
      { name: "payment_confirmed", type: "BOOLEAN DEFAULT FALSE" },
      { name: "payment_confirmed_at", type: "TIMESTAMP" },
      { name: "payment_confirmed_by", type: "VARCHAR(36)" },
    ];

    for (const col of paymentColumns) {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'applications' AND column_name = $1
      `, [col.name]);

      if (checkResult.rows.length === 0) {
        await pool.query(`ALTER TABLE applications ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Added column: ${col.name}`);
      } else {
        console.log(`ℹ️  Column already exists: ${col.name}`);
      }
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

