/**
 * Compare production DB with expected schema tables and push schema if any are missing.
 * Used in CI: DATABASE_URL is set to production; schema in code is source of truth.
 *
 * 1. Connects to database (DATABASE_URL = production in CI)
 * 2. Lists existing tables
 * 3. Compares with expected tables from schema
 * 4. If any expected table is missing, runs drizzle-kit push to create them
 *
 * Usage in CI:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/ensure-production-tables.ts
 *
 * Usage locally (compare prod with expected, then push if needed):
 *   PROD_DB_PASSWORD=xxx npx tsx scripts/ensure-production-tables.ts
 *   (uses production RDS config if DATABASE_URL not set - see PROD_DB_CONFIG)
 */

import "dotenv/config";

if (process.env.DATABASE_URL?.includes("rds.amazonaws.com")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { Client } from "pg";
import { spawn } from "child_process";

const PROD_DB_CONFIG = {
  host: "startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com",
  port: 5432,
  database: process.env.PROD_DB_NAME || "startupvarsity",
  user: "postgres",
  password: process.env.PROD_DB_PASSWORD || "StartUp202",
  ssl: { rejectUnauthorized: false },
};

// Must match tables in shared/schema.ts (pgTable names)
const EXPECTED_TABLES = [
  "users", "organizations", "cohorts", "cohort_users", "applications",
  "problem_statements", "teams", "role_assignments", "team_member_applications",
  "problem_statement_applications", "sprints", "tasks", "reviews", "evidence",
  "mous", "credit_maps", "seed_funds", "cap_table_entries", "stipend_rules",
  "team_application_members", "team_application_invites", "stipend_disbursements",
  "invoices", "payment_installments", "manual_payments", "certificates",
  "sessions", "blog_posts", "faqs", "daily_standups", "mentor_sessions",
  "mentor_honorariums", "milestones", "assessments", "assessment_questions",
  "assessment_attempts", "assessment_answers", "assessment_assignments",
  "notifications", "password_reset_otps", "mentor_job_postings", "mentor_profiles",
  "sprint_permissions", "cohort_tasks", "cohort_task_sessions",
];

async function getTables(client: Client): Promise<string[]> {
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return result.rows.map((r: { table_name: string }) => r.table_name);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  let client: Client;
  if (process.env.DATABASE_URL) {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("rds.amazonaws.com") ||
           process.env.DATABASE_URL.includes("neon.tech") ||
           process.env.DATABASE_URL.includes("supabase.co")
        ? { rejectUnauthorized: false }
        : false,
    });
  } else {
    client = new Client(PROD_DB_CONFIG);
  }

  try {
    await client.connect();
    const tables = await getTables(client);
    const tableSet = new Set(tables);
    const missing = EXPECTED_TABLES.filter((t) => !tableSet.has(t));

    console.log("📊 Production DB: %s tables", tables.length);
    if (missing.length > 0) {
      console.log("❌ Missing %s table(s): %s", missing.length, missing.join(", "));
      if (!dryRun) {
        console.log("🔄 Running drizzle-kit push to create missing tables...\n");
        const child = spawn("npx", ["drizzle-kit", "push"], {
          env: process.env,
          stdio: "inherit",
          shell: true,
        });
        const code = await new Promise<number>((resolve) => child.on("close", resolve));
        if (code !== 0) {
          console.error("\n❌ drizzle-kit push exited with code", code);
          process.exit(code);
        }
        console.log("\n✅ Schema push completed. Missing tables should now exist.");
      } else {
        console.log("🔸 Dry run: run without --dry-run to push schema.");
      }
    } else {
      console.log("✅ All expected tables are present. No push needed.");
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error:", msg);
    if (typeof msg === "string" && msg.includes("password authentication failed")) {
      console.error("");
      console.error("💡 Fix: Check PROD_DATABASE_URL (GitHub secret or env).");
      console.error("   - Use format: postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require");
      console.error("   - If the password contains # @ ? % etc., URL-encode it.");
      console.error("   - Ensure the password matches the RDS master user password.");
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
