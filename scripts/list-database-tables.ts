/**
 * Script to list all tables in a database
 *
 * Can be used to check either local or production database.
 * For local, DATABASE_URL is read from .env if not set.
 *
 * Usage for local database:
 *   npx tsx scripts/list-database-tables.ts
 *
 * Usage for production database:
 *   npx tsx scripts/list-database-tables.ts production
 */

import "dotenv/config";
import { Client } from 'pg';

// Production database connection details (RDS endpoint: startupvarsity-portal-db, DBName: startupvarsity)
const PROD_DB_CONFIG = {
  host: 'startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: process.env.PROD_DB_NAME || 'startupvarsity',
  user: 'postgres',
  password: process.env.PROD_DB_PASSWORD || 'StartUp202',
  ssl: { rejectUnauthorized: false }
};

// Expected tables from schema
const EXPECTED_TABLES = [
  'users',
  'organizations',
  'cohorts',
  'cohort_users',
  'applications',
  'problem_statements',
  'teams',
  'role_assignments',
  'team_member_applications',
  'problem_statement_applications',
  'sprints',
  'tasks',
  'reviews',
  'evidence',
  'mous',
  'credit_maps',
  'seed_funds',
  'cap_table_entries',
  'stipend_rules',
  'team_application_members',
  'team_application_invites',
  'stipend_disbursements',
  'invoices',
  'certificates',
  'sessions',
  'blog_posts',
  'faqs',
  'daily_standups',
  'mentor_sessions',
  'mentor_honorariums',
  'milestones',
  'assessments',
  'assessment_questions',
  'assessment_attempts',
  'assessment_answers',
  'assessment_assignments',
  'notifications',
  'password_reset_otps',
  'mentor_job_postings',
  'mentor_profiles',
  'sprint_permissions',
  'cohort_tasks',
  'cohort_task_sessions',
  'payment_installments',
  'manual_payments',
];

async function listTables(dbType: 'test' | 'production') {
  let client: Client;

  if (dbType === 'production') {
    console.log('🔌 Connecting to PRODUCTION database...');
    console.log(`   Host: ${PROD_DB_CONFIG.host}`);
    console.log(`   Database: ${PROD_DB_CONFIG.database}\n`);
    client = new Client(PROD_DB_CONFIG);
  } else {
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set');
      console.error('   Please set DATABASE_URL to your test database connection string');
      process.exit(1);
    }
    console.log('🔌 Connecting to TEST database...');
    console.log(`   URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') || 
           process.env.DATABASE_URL.includes('neon.tech') ||
           process.env.DATABASE_URL.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : false,
    });
  }

  try {
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Get all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = result.rows.map(row => row.table_name);
    const expectedTablesSet = new Set(EXPECTED_TABLES);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 TABLES IN ${dbType.toUpperCase()} DATABASE`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Total tables: ${tables.length}\n`);

    // Show tables with status
    console.log('Tables:');
    tables.forEach(table => {
      const inSchema = expectedTablesSet.has(table) ? '✅' : '⚠️';
      console.log(`   ${inSchema} ${table}`);
    });

    // Find missing expected tables
    const missingTables = EXPECTED_TABLES.filter(table => !tables.includes(table));
    const extraTables = tables.filter(table => !expectedTablesSet.has(table));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (missingTables.length > 0) {
      console.log(`❌ Missing tables (${missingTables.length}):`);
      missingTables.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('✅ All expected tables are present!');
    }

    if (extraTables.length > 0) {
      console.log(`\n⚠️  Extra tables (not in schema) (${extraTables.length}):`);
      extraTables.forEach(table => console.log(`   - ${table}`));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected');
  }
}

// Determine which database to check
const dbType = process.argv[2] === 'production' ? 'production' : 'test';
listTables(dbType);


