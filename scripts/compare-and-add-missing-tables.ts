/**
 * Compare local DB tables with production DB, then add any missing tables to production.
 *
 * 1. Connects to local (DATABASE_URL from .env) and production (startupvarsity-portal-db)
 * 2. Compares table lists
 * 3. If production is missing tables that exist in local (or in expected schema), runs
 *    drizzle-kit push against production to create them.
 *
 * Usage:
 *   npx tsx scripts/compare-and-add-missing-tables.ts
 *   npx tsx scripts/compare-and-add-missing-tables.ts --dry-run   # compare only, do not push
 *
 * Requires: .env with DATABASE_URL for local. Production uses PROD_DB_* or defaults.
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

const EXPECTED_TABLES = [
  "users", "organizations", "cohorts", "cohort_users", "applications",
  "problem_statements", "teams", "role_assignments", "team_member_applications",
  "problem_statement_applications", "sprints", "tasks", "reviews", "evidence",
  "mous", "credit_maps", "seed_funds", "cap_table_entries", "stipend_rules",
  "team_application_members", "team_application_invites", "stipend_disbursements",
  "invoices", "certificates", "sessions", "blog_posts", "faqs", "daily_standups",
  "mentor_sessions", "mentor_honorariums", "milestones", "assessments",
  "assessment_questions", "assessment_attempts", "assessment_answers",
  "assessment_assignments", "notifications", "password_reset_otps",
  "mentor_job_postings", "mentor_profiles", "sprint_permissions",
  "cohort_tasks", "cohort_task_sessions",
  "payment_installments", "manual_payments",
];

async function getTables(client: Client): Promise<string[]> {
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  return result.rows.map((r: { table_name: string }) => r.table_name);
}

function buildProdUrl(): string {
  const p = encodeURIComponent(PROD_DB_CONFIG.password);
  return `postgresql://${PROD_DB_CONFIG.user}:${p}@${PROD_DB_CONFIG.host}:${PROD_DB_CONFIG.port}/${PROD_DB_CONFIG.database}?sslmode=require`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Set it in .env or environment.");
    process.exit(1);
  }

  const localClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("rds.amazonaws.com") ||
         process.env.DATABASE_URL.includes("neon.tech") ||
         process.env.DATABASE_URL.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : false,
  });
  const prodClient = new Client(PROD_DB_CONFIG);

  try {
    console.log("🔌 Connecting to LOCAL database...");
    await localClient.connect();
    console.log("   ✅ Connected\n");

    console.log("🔌 Connecting to PRODUCTION database...");
    console.log(`   Host: ${PROD_DB_CONFIG.host}`);
    console.log(`   Database: ${PROD_DB_CONFIG.database}\n`);
    await prodClient.connect();
    console.log("   ✅ Connected\n");

    const localTables = await getTables(localClient);
    const prodTables = await getTables(prodClient);
    const localSet = new Set(localTables);
    const prodSet = new Set(prodTables);

    // Tables in local (or expected) that are missing in production
    const missingInProd = [...new Set([...localTables, ...EXPECTED_TABLES])]
      .filter((t) => !prodSet.has(t));
    const missingInLocal = EXPECTED_TABLES.filter((t) => !localSet.has(t));

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 COMPARISON: Local vs Production");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`   Local:      ${localTables.length} tables`);
    console.log(`   Production: ${prodTables.length} tables\n`);

    if (missingInLocal.length > 0) {
      console.log("❌ Missing in LOCAL (expected in schema):");
      missingInLocal.forEach((t) => console.log(`   - ${t}`));
      console.log("");
    }

    if (missingInProd.length > 0) {
      console.log("❌ Missing in PRODUCTION:");
      missingInProd.forEach((t) => console.log(`   - ${t}`));
      console.log("");
    } else {
      console.log("✅ Production has all tables that local/expected have. Nothing to add.\n");
      return;
    }

    if (dryRun) {
      console.log("🔸 Dry run: skipping drizzle-kit push. Run without --dry-run to add missing tables.\n");
      return;
    }

    console.log("🔄 Adding missing tables to production via drizzle-kit push...\n");
    const prodUrl = buildProdUrl();
    const child = spawn("npx", ["drizzle-kit", "push"], {
      env: { ...process.env, DATABASE_URL: prodUrl },
      stdio: "inherit",
      shell: true,
    });
    const code = await new Promise<number>((resolve) => child.on("close", resolve));
    if (code !== 0) {
      console.error("\n❌ drizzle-kit push exited with code", code);
      process.exit(code);
    }
    console.log("\n✅ Done. Re-run this script to verify production now has all tables.");
  } catch (err: any) {
    console.error("❌ Error:", err?.message || err);
    process.exit(1);
  } finally {
    await localClient.end().catch(() => {});
    await prodClient.end().catch(() => {});
    console.log("🔌 Disconnected");
  }
}

main();
