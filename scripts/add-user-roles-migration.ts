// Migration script to add FOUNDER and COFOUNDER to user_role enum
import "dotenv/config";
import { pool } from "../server/db";

async function addUserRoles() {
  try {
    console.log("🔄 Adding FOUNDER and COFOUNDER to user_role enum...");
    
    // Check if enum values already exist
    const checkQuery = `
      SELECT unnest(enum_range(NULL::user_role))::text as value;
    `;
    const existingValues = await pool.query(checkQuery);
    const values = existingValues.rows.map((row: any) => row.value);
    
    console.log("📋 Current enum values:", values);
    
    // Add FOUNDER if it doesn't exist
    if (!values.includes("FOUNDER")) {
      console.log("➕ Adding FOUNDER...");
      try {
        await pool.query(`ALTER TYPE user_role ADD VALUE 'FOUNDER'`);
        console.log("✅ FOUNDER added");
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log("ℹ️  FOUNDER already exists");
        } else {
          throw error;
        }
      }
    } else {
      console.log("ℹ️  FOUNDER already exists");
    }
    
    // Add COFOUNDER if it doesn't exist
    if (!values.includes("COFOUNDER")) {
      console.log("➕ Adding COFOUNDER...");
      try {
        await pool.query(`ALTER TYPE user_role ADD VALUE 'COFOUNDER'`);
        console.log("✅ COFOUNDER added");
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          console.log("ℹ️  COFOUNDER already exists");
        } else {
          throw error;
        }
      }
    } else {
      console.log("ℹ️  COFOUNDER already exists");
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

addUserRoles();

