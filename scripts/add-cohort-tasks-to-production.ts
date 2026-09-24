/**
 * Migration script to add cohort_tasks and cohort_task_sessions tables to production database
 * 
 * This script connects to the production database and creates the missing tables.
 * 
 * Usage:
 *   DATABASE_URL="postgresql://postgres:StartUp202@startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com:5432/postgres" npx tsx scripts/add-cohort-tasks-to-production.ts
 * 
 * Or set the connection details directly in the script below.
 */

import { Client } from 'pg';

// Production database connection details
// Note: The database name might be 'postgres', 'startupvarsity', or 'startup-varsity-db'
// Update this if you know the correct database name
const PROD_DB_CONFIG = {
  host: 'startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: process.env.PROD_DB_NAME || 'postgres', // Try 'startupvarsity' or 'startup-varsity-db' if 'postgres' doesn't work
  user: 'postgres',
  password: 'StartUp202',
  ssl: { rejectUnauthorized: false }
};

const SQL_MIGRATION = `
-- Create cohort_tasks table
CREATE TABLE IF NOT EXISTS cohort_tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id VARCHAR(36) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meeting_link TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cohort_tasks_cohort_id_idx ON cohort_tasks (cohort_id);
CREATE INDEX IF NOT EXISTS cohort_tasks_created_by_idx ON cohort_tasks (created_by);
CREATE INDEX IF NOT EXISTS cohort_tasks_start_time_idx ON cohort_tasks (start_time);

-- Create cohort_task_sessions table
CREATE TABLE IF NOT EXISTS cohort_task_sessions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_task_id VARCHAR(36) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  meeting_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cohort_task_sessions_cohort_task_id_idx ON cohort_task_sessions (cohort_task_id);
CREATE INDEX IF NOT EXISTS cohort_task_sessions_start_date_idx ON cohort_task_sessions (start_date);
`;

async function migrateProductionDatabase() {
  const client = new Client(PROD_DB_CONFIG);
  
  try {
    console.log('🔌 Connecting to production database...');
    console.log(`   Host: ${PROD_DB_CONFIG.host}`);
    console.log(`   Database: ${PROD_DB_CONFIG.database}`);
    
    await client.connect();
    console.log('✅ Connected to production database');
    
    // Check if tables already exist
    console.log('\n📋 Checking existing tables...');
    
    const cohortTasksCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cohort_tasks'
      );
    `);
    
    const cohortTaskSessionsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cohort_task_sessions'
      );
    `);
    
    const cohortTasksExists = cohortTasksCheck.rows[0]?.exists === true;
    const cohortTaskSessionsExists = cohortTaskSessionsCheck.rows[0]?.exists === true;
    
    if (cohortTasksExists) {
      console.log('⚠️  cohort_tasks table already exists');
      
      // Check if it has all required columns
      const columns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'cohort_tasks'
      `);
      
      const columnNames = columns.rows.map(r => r.column_name);
      const missingColumns: string[] = [];
      
      if (!columnNames.includes('end_time')) missingColumns.push('end_time');
      if (!columnNames.includes('created_by')) missingColumns.push('created_by');
      
      if (missingColumns.length > 0) {
        console.log(`⚠️  Missing columns: ${missingColumns.join(', ')}`);
        console.log('   You may need to manually add these columns or recreate the table.');
      } else {
        console.log('✅ cohort_tasks table has all required columns');
      }
    } else {
      console.log('📝 cohort_tasks table does not exist - will be created');
    }
    
    if (cohortTaskSessionsExists) {
      console.log('⚠️  cohort_task_sessions table already exists');
    } else {
      console.log('📝 cohort_task_sessions table does not exist - will be created');
    }
    
    // Execute migration
    console.log('\n🚀 Running migration...');
    await client.query(SQL_MIGRATION);
    console.log('✅ Migration completed successfully!');
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const verifyCohortTasks = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cohort_tasks'
      );
    `);
    
    const verifyCohortTaskSessions = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cohort_task_sessions'
      );
    `);
    
    if (verifyCohortTasks.rows[0]?.exists) {
      console.log('✅ cohort_tasks table verified');
    }
    
    if (verifyCohortTaskSessions.rows[0]?.exists) {
      console.log('✅ cohort_task_sessions table verified');
    }
    
    console.log('\n🎉 All done!');
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run migration
migrateProductionDatabase();

