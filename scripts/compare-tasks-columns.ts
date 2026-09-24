/**
 * Compare "tasks" table columns between local (DATABASE_URL) and production DB.
 * Lists columns that exist in local but are missing in production.
 *
 * Usage: npx tsx scripts/compare-tasks-columns.ts
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

const COLUMNS_SQL = `
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tasks'
  ORDER BY ordinal_position;
`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (local DB)");
    process.exit(1);
  }

  const localClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("rds.amazonaws.com")
      ? { rejectUnauthorized: false }
      : false,
  });
  const prodClient = new Client(PROD_CONFIG);

  try {
    await localClient.connect();
    await prodClient.connect();

    const [localRows] = await Promise.all([
      localClient.query(COLUMNS_SQL),
      prodClient.query(COLUMNS_SQL),
    ]);
    const prodResult = await prodClient.query(COLUMNS_SQL);
    const prodRows = prodResult.rows;

    const localCols = new Set(localRows.rows.map((r: any) => r.column_name));
    const prodCols = new Set(prodRows.map((r: any) => r.column_name));

    const missingInProd = localRows.rows
      .filter((r: any) => !prodCols.has(r.column_name))
      .map((r: any) => ({
        column_name: r.column_name,
        data_type: r.data_type,
        is_nullable: r.is_nullable,
        column_default: r.column_default,
      }));

    const missingInLocal = prodRows.filter(
      (r: any) => !localCols.has(r.column_name)
    );

    console.log("--- tasks table: LOCAL columns ---");
    localRows.rows.forEach((r: any) =>
      console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable === "YES" ? "NULL" : "NOT NULL"}`)
    );
    console.log("\n--- tasks table: PRODUCTION columns ---");
    prodRows.forEach((r: any) =>
      console.log(`  ${r.column_name} (${r.data_type}) ${r.is_nullable === "YES" ? "NULL" : "NOT NULL"}`)
    );

    console.log("\n--- Columns in LOCAL missing in PRODUCTION ---");
    if (missingInProd.length === 0) {
      console.log("  (none)");
    } else {
      missingInProd.forEach((c: any) => {
        console.log(`  - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable}, default: ${c.column_default ?? "none"})`);
      });
    }

    console.log("\n--- Columns in PRODUCTION missing in LOCAL ---");
    if (missingInLocal.length === 0) {
      console.log("  (none)");
    } else {
      missingInLocal.forEach((c: any) => {
        console.log(`  - ${c.column_name} (${c.data_type})`);
      });
    }
  } finally {
    await localClient.end();
    await prodClient.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
