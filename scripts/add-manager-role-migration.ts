// Migration script to add MANAGER to user_role enum
import "dotenv/config";
import { pool } from "../server/db";

async function addManagerRole() {
  try {
    console.log("🔄 Adding MANAGER to user_role enum...");
    
    // Check if enum values already exist
    const checkQuery = `
      SELECT unnest(enum_range(NULL::user_role))::text as value;
    `;
    const existingValues = await pool.query(checkQuery);
    const values = existingValues.rows.map((row: any) => row.value);
    
    console.log("📋 Current enum values:", values);
    
    // Add MANAGER if it doesn't exist
    if (!values.includes("MANAGER")) {
      console.log("➕ Adding MANAGER...");
      try {
        await pool.query(`ALTER TYPE user_role ADD VALUE 'MANAGER'`);
        console.log("✅ MANAGER added");
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log("ℹ️  MANAGER already exists");
        } else {
          throw error;
        }
      }
    } else {
      console.log("ℹ️  MANAGER already exists");
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

addManagerRole();

