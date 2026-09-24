/**
 * Shared helper for the idempotent SQL migration scripts in scripts/.
 *
 * Statements are executed one at a time rather than as a single batch because
 * `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block.
 */

import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";
const { Pool } = pg;

/**
 * Splits a SQL file into statements on `;`, ignoring semicolons that sit inside
 * a dollar-quoted block (`DO $$ ... $$`) or a line comment.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const pair = sql.slice(i, i + 2);

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      current += char;
      continue;
    }

    if (!inDollarQuote && pair === "--") {
      inLineComment = true;
      current += char;
      continue;
    }

    if (pair === "$$") {
      inDollarQuote = !inDollarQuote;
      current += pair;
      i++;
      continue;
    }

    if (char === ";" && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);

  // Drop fragments that are only comments
  return statements.filter((s) =>
    s.split("\n").some((line) => line.trim() && !line.trim().startsWith("--"))
  );
}

interface RunOptions {
  /** File name inside scripts/sql, e.g. "add-team-chat.sql" */
  sqlFile: string;
  /** Message printed before the run */
  label: string;
  /** LIKE pattern used to report which tables now exist, e.g. "team_chat%" */
  verifyTablesLike?: string;
}

export async function runSqlFileMigration({ sqlFile, label, verifyTablesLike }: RunOptions) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set");
    process.exit(1);
  }

  // Allow RDS/cloud DB self-signed certs (same as drizzle.config.ts)
  if (!connectionString.includes("localhost")) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    query_timeout: 60000,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  try {
    console.log(`🔄 ${label}`);

    const sql = readFileSync(join(process.cwd(), "scripts", "sql", sqlFile), "utf8");
    for (const statement of splitStatements(sql)) {
      await pool.query(statement);
    }

    if (verifyTablesLike) {
      const { rows } = await pool.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name LIKE $1
         ORDER BY table_name;`,
        [verifyTablesLike]
      );
      console.log("✅ Tables present:", rows.map((r) => r.table_name).join(", "));
    }

    console.log("✅ Migration complete");
  } catch (error: any) {
    console.error("❌ Migration error:", error.message);
    if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
      console.log("\n💡 If the DB is remote, run the SQL manually from a machine that can reach it:");
      console.log(`   psql "$DATABASE_URL" -f scripts/sql/${sqlFile}`);
    }
    throw error;
  } finally {
    await pool.end();
  }
}
