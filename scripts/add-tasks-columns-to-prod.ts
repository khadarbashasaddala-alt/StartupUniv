/**
 * Add missing tasks table columns to production database.
 * Columns: assigned_by, reviewer_id, review_comment, assignee_ids
 * Indexes: tasks_assigned_by_idx, tasks_reviewer_id_idx
 *
 * Usage: PROD_DB_PASSWORD=yourpassword npx tsx scripts/add-tasks-columns-to-prod.ts
 */
import "dotenv/config";
import { Client } from "pg";

if (process.env.DATABASE_URL?.includes("rds.amazonaws.com")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const PROD_CONFIG = {
  host: "startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com",
  port: 5432,
  database: process.env.PROD_DB_NAME || "startupvarsity",
  user: "postgres",
  password: process.env.PROD_DB_PASSWORD || "StartUp202",
  ssl: { rejectUnauthorized: false },
};

const MIGRATIONS = [
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by VARCHAR(36)`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(36)`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_comment TEXT`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids JSONB`,
  `CREATE INDEX IF NOT EXISTS tasks_assigned_by_idx ON tasks(assigned_by)`,
  `CREATE INDEX IF NOT EXISTS tasks_reviewer_id_idx ON tasks(reviewer_id)`,
];

async function main() {
  const client = new Client(PROD_CONFIG);
  try {
    console.log("🔌 Connecting to production database...");
    console.log(`   Host: ${PROD_CONFIG.host}`);
    console.log(`   Database: ${PROD_CONFIG.database}\n`);
    await client.connect();
    console.log("✅ Connected\n");

    for (const sql of MIGRATIONS) {
      const label = sql.replace(/ .*$/, "").replace(/IF NOT EXISTS /, "");
      process.stdout.write(`   Running: ${label}... `);
      await client.query(sql);
      console.log("OK");
    }

    console.log("\n✅ All tasks columns and indexes added to production.");
  } catch (err: any) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log("🔌 Disconnected.");
  }
}

main();
