/**
 * Connect to production DB and list tables that are missing (compared to schema).
 * Does not require a local DB.
 *
 * Usage:
 *   PROD_DB_PASSWORD=xxx npx tsx scripts/list-missing-tables-in-production.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/list-missing-tables-in-production.ts
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

async function main() {
  let client: Client;
  if (process.env.DATABASE_URL) {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_URL.includes("rds.amazonaws.com") ||
        process.env.DATABASE_URL.includes("neon.tech") ||
        process.env.DATABASE_URL.includes("supabase.co")
          ? { rejectUnauthorized: false }
          : false,
    });
    console.log("📡 Using DATABASE_URL for production connection\n");
  } else {
    client = new Client(PROD_DB_CONFIG);
    console.log("📡 Using PROD_DB_CONFIG (set PROD_DB_PASSWORD if needed)\n");
  }

  try {
    await client.connect();
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const prodTables = result.rows.map((r: { table_name: string }) => r.table_name);
    const prodSet = new Set(prodTables);
    const missing = EXPECTED_TABLES.filter((t) => !prodSet.has(t));

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Production DB vs schema: missing tables");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("   Production tables:", prodTables.length);
    console.log("   Expected (schema):", EXPECTED_TABLES.length);
    console.log("");

    if (missing.length === 0) {
      console.log("✅ No missing tables in production. All expected tables exist.\n");
    } else {
      console.log("❌ Missing in PRODUCTION (" + missing.length + "):");
      missing.forEach((t) => console.log("   - " + t));
      console.log("");
      console.log("💡 To create missing tables, run: npm run db:ensure-production-tables (or db:push with DATABASE_URL=prod)\n");
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("❌ Error:", msg);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
