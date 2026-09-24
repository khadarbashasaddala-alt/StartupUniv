/**
 * Check database state for login: users table columns and user counts.
 * Run: npm run db:check-login
 */

import "dotenv/config";
// Allow RDS/cloud DB self-signed certs when using server/db pool
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
import { pool } from "../server/db";

async function check() {
  try {
    console.log("🔍 Checking database for login...\n");

    // 1. List users table columns
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log("📋 Table 'users' columns:");
    if (columns.rows.length === 0) {
      console.log("   ❌ Table 'users' not found!\n");
      process.exit(1);
    }
    const columnNames = columns.rows.map((r: any) => r.column_name);
    columns.rows.forEach((r: any) => console.log(`   - ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`));

    const hasPassword = columnNames.includes("password");
    const hasPasswordChangedAt = columnNames.includes("password_changed_at");
    console.log("");
    if (!hasPassword) {
      console.log("❌ Missing column 'password' — login will fail.");
    } else {
      console.log("✅ Column 'password' exists");
    }
    if (!hasPasswordChangedAt) {
      console.log("❌ Missing column 'password_changed_at' — run: npm run db:add-password-changed-at");
    } else {
      console.log("✅ Column 'password_changed_at' exists");
    }

    // 2. User counts
    const countResult = await pool.query(`SELECT COUNT(*) AS total FROM users;`);
    const withPassword = hasPassword
      ? (await pool.query(`SELECT COUNT(*) AS n FROM users WHERE password IS NOT NULL AND password != '';`)).rows[0].n
      : 0;
    console.log("\n📊 Users: total =", countResult.rows[0].total, ", with password set =", withPassword);
    if (Number(countResult.rows[0].total) === 0) {
      console.log("   ⚠️  No users in DB — create an admin (e.g. run seed or create user).");
    } else if (withPassword === 0) {
      console.log("   ⚠️  No user has a password set — set passwords (e.g. via Forgot Password or admin).");
    }

    console.log("\n✅ Check complete.");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    if (error.code) console.error("   Code:", error.code);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

check();
