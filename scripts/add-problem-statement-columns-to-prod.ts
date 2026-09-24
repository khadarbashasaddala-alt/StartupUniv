/**
 * Add expected_outcomes and constraints_requirements to problem_statements
 * in PRODUCTION. Safe to run (uses IF NOT EXISTS).
 *
 * Usage:
 *   PROD_DB_PASSWORD=yourpassword npx tsx scripts/add-problem-statement-columns-to-prod.ts
 */

import "dotenv/config";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { Client } from "pg";

const PROD_DB_CONFIG = {
  host: "startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com",
  port: 5432,
  database: process.env.PROD_DB_NAME || "startupvarsity",
  user: "postgres",
  password: process.env.PROD_DB_PASSWORD || "StartUp202",
  ssl: { rejectUnauthorized: false },
};

async function main() {
  const client = new Client(PROD_DB_CONFIG);
  await client.connect();

  try {
    await client.query(`
      ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS expected_outcomes TEXT;
    `);
    console.log("✅ expected_outcomes added (or already existed).");

    await client.query(`
      ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS constraints_requirements TEXT;
    `);
    console.log("✅ constraints_requirements added (or already existed).");

    console.log("\nDone. Run check-problem-statement-columns.ts to verify.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
