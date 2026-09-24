/**
 * Script to compare tables between test/local database and production database
 * 
 * This script:
 * 1. Connects to local database (from DATABASE_URL in .env)
 * 2. Connects to production database (startupvarsity-portal-db, database: startupvarsity)
 * 3. Lists all tables in both databases
 * 4. Shows which tables are missing in each database
 * 
 * Usage:
 *   npx tsx scripts/compare-databases.ts
 *   (Loads .env for DATABASE_URL; override prod with PROD_DB_NAME, PROD_DB_PASSWORD)
 */

import "dotenv/config";

// Allow RDS self-signed certs when connecting to local/prod
if (process.env.DATABASE_URL?.includes("rds.amazonaws.com")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { Client } from 'pg';

// Expected tables from schema (extracted from schema.ts)
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
  'team_meetings',
  'payment_installments',
  'manual_payments',
];

// Production database (RDS: startupvarsity-portal-db, DBName: startupvarsity)
const PROD_DB_CONFIG = {
  host: 'startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: process.env.PROD_DB_NAME || 'startupvarsity',
  user: 'postgres',
  password: process.env.PROD_DB_PASSWORD || 'StartUp202',
  ssl: { rejectUnauthorized: false }
};

async function getTablesFromDatabase(client: Client, dbName: string): Promise<string[]> {
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    return result.rows.map(row => row.table_name);
  } catch (error: any) {
    console.error(`❌ Error fetching tables from ${dbName}:`, error.message);
    return [];
  }
}

async function compareDatabases() {
  // Check for test database URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Please set DATABASE_URL to your test/local database connection string');
    process.exit(1);
  }

  const testClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('rds.amazonaws.com') || 
         process.env.DATABASE_URL.includes('neon.tech') ||
         process.env.DATABASE_URL.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : false,
  });

  const prodClient = new Client(PROD_DB_CONFIG);

  try {
    console.log('🔌 Connecting to databases...\n');

    // Connect to test database
    console.log('📊 Test Database:');
    console.log(`   URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    await testClient.connect();
    console.log('   ✅ Connected\n');

    // Connect to production database
    console.log('📊 Production Database:');
    console.log(`   Host: ${PROD_DB_CONFIG.host}`);
    console.log(`   Database: ${PROD_DB_CONFIG.database}`);
    await prodClient.connect();
    console.log('   ✅ Connected\n');

    // Get tables from both databases
    console.log('📋 Fetching tables from both databases...\n');
    const testTables = await getTablesFromDatabase(testClient, 'Test');
    const prodTables = await getTablesFromDatabase(prodClient, 'Production');

    // Convert to Sets for easier comparison
    const testTablesSet = new Set(testTables);
    const prodTablesSet = new Set(prodTables);
    const expectedTablesSet = new Set(EXPECTED_TABLES);

    // Find missing tables
    const missingInTest = EXPECTED_TABLES.filter(table => !testTablesSet.has(table));
    const missingInProd = EXPECTED_TABLES.filter(table => !prodTablesSet.has(table));
    const extraInTest = testTables.filter(table => !expectedTablesSet.has(table));
    const extraInProd = prodTables.filter(table => !expectedTablesSet.has(table));

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATABASE COMPARISON RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`📈 Test Database: ${testTables.length} tables`);
    console.log(`📈 Production Database: ${prodTables.length} tables`);
    console.log(`📈 Expected Tables: ${EXPECTED_TABLES.length} tables\n`);

    // Show missing tables in test database
    if (missingInTest.length > 0) {
      console.log('❌ Missing in TEST Database:');
      missingInTest.forEach(table => console.log(`   - ${table}`));
      console.log('');
    } else {
      console.log('✅ All expected tables present in TEST Database\n');
    }

    // Show missing tables in production database
    if (missingInProd.length > 0) {
      console.log('❌ Missing in PRODUCTION Database:');
      missingInProd.forEach(table => console.log(`   - ${table}`));
      console.log('');
    } else {
      console.log('✅ All expected tables present in PRODUCTION Database\n');
    }

    // Show extra tables in test database
    if (extraInTest.length > 0) {
      console.log('⚠️  Extra tables in TEST Database (not in schema):');
      extraInTest.forEach(table => console.log(`   - ${table}`));
      console.log('');
    }

    // Show extra tables in production database
    if (extraInProd.length > 0) {
      console.log('⚠️  Extra tables in PRODUCTION Database (not in schema):');
      extraInProd.forEach(table => console.log(`   - ${table}`));
      console.log('');
    }

    // Detailed table list
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 DETAILED TABLE LIST');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Test Database Tables:');
    testTables.forEach(table => {
      const inProd = prodTablesSet.has(table) ? '✅' : '❌';
      const inSchema = expectedTablesSet.has(table) ? '📝' : '⚠️';
      console.log(`   ${inProd} ${inSchema} ${table}`);
    });

    console.log('\nProduction Database Tables:');
    prodTables.forEach(table => {
      const inTest = testTablesSet.has(table) ? '✅' : '❌';
      const inSchema = expectedTablesSet.has(table) ? '📝' : '⚠️';
      console.log(`   ${inTest} ${inSchema} ${table}`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Legend:');
    console.log('   ✅ = Present in both databases');
    console.log('   ❌ = Missing in other database');
    console.log('   📝 = Defined in schema');
    console.log('   ⚠️  = Not in schema (extra table)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    if (missingInTest.length === 0 && missingInProd.length === 0) {
      console.log('🎉 SUCCESS: Both databases have all expected tables!');
    } else {
      console.log('⚠️  WARNING: Some tables are missing!');
      if (missingInProd.length > 0) {
        console.log(`\n💡 To add missing tables to production, run:`);
        console.log(`   npx tsx scripts/compare-and-add-missing-tables.ts`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('   Details:', error);
    process.exit(1);
  } finally {
    await testClient.end();
    await prodClient.end();
    console.log('\n🔌 Disconnected from databases');
  }
}

// Run comparison
compareDatabases();


