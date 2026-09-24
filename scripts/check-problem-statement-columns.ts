/**
 * Check if expected_outcomes and constraints_requirements columns exist
 * in problem_statements table in test and production DBs.
 *
 * Usage: npx tsx scripts/check-problem-statement-columns.ts
 */

import "dotenv/config";

if (process.env.DATABASE_URL?.includes("rds.amazonaws.com")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { Client } from "pg";

const PROD_DB_CONFIG = {
  host: "startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com",
  port: 5432,
  database: process.env.PROD_DB_NAME || "startupvarsity",
  user: "postgres",
  password: process.env.PROD_DB_PASSWORD || "StartUp202",
  ssl: { rejectUnauthorized: false },
};

const COLUMNS_TO_CHECK = ["expected_outcomes", "constraints_requirements"];

async function getProblemStatementColumns(
  client: Client,
  dbLabel: string
): Promise<string[]> {
  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'problem_statements'
    ORDER BY ordinal_position;
  `
  );
  return result.rows.map((r: { column_name: string }) => r.column_name);
}

async function main() {
  const prodClient = new Client(PROD_DB_CONFIG);

  try {
    await prodClient.connect();
    const prodColumns = await getProblemStatementColumns(prodClient, "Production");

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("problem_statements columns in PRODUCTION");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    for (const col of COLUMNS_TO_CHECK) {
      const exists = prodColumns.includes(col);
      console.log(`  ${exists ? "✅" : "❌"} ${col}`);
    }

    if (process.env.DATABASE_URL) {
      const testClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.DATABASE_URL.includes("rds.amazonaws.com") ||
          process.env.DATABASE_URL.includes("neon.tech") ||
          process.env.DATABASE_URL.includes("supabase.co")
            ? { rejectUnauthorized: false }
            : false,
      });
      await testClient.connect();
      const testColumns = await getProblemStatementColumns(testClient, "Test");
      await testClient.end();

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("problem_statements columns in TEST (DATABASE_URL)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      for (const col of COLUMNS_TO_CHECK) {
        const exists = testColumns.includes(col);
        console.log(`  ${exists ? "✅" : "❌"} ${col}`);
      }
    }

    const missingInProd = COLUMNS_TO_CHECK.filter((c) => !prodColumns.includes(c));
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (missingInProd.length === 0) {
      console.log("✅ Production has both columns (expected_outcomes, constraints_requirements).");
    } else {
      console.log("❌ Missing in PRODUCTION:", missingInProd.join(", "));
      console.log("\nAdd them with:");
      console.log(
        `  ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS expected_outcomes TEXT;`
      );
      console.log(
        `  ALTER TABLE problem_statements ADD COLUMN IF NOT EXISTS constraints_requirements TEXT;`
      );
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } finally {
    await prodClient.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
