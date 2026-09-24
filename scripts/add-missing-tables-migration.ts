/**
 * Migration script to add missing tables to production database
 * Tables to add:
 * - cohort_users
 * - password_reset_otps
 * - mentor_job_postings
 * - cohort_task_sessions
 */

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

async function runMigration() {
  const client = new Client(PROD_DB_CONFIG);

  try {
    console.log('🔌 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Begin transaction
    await client.query('BEGIN');

    // ============================================
    // 1. Create cohort_users table
    // ============================================
    console.log('📋 Creating cohort_users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cohort_users (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        cohort_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS cohort_users_user_id_idx ON cohort_users (user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS cohort_users_cohort_id_idx ON cohort_users (cohort_id)`);
    console.log('✅ cohort_users table created\n');

    // ============================================
    // 2. Create password_reset_otps table
    // ============================================
    console.log('📋 Creating password_reset_otps table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        otp VARCHAR(6) NOT NULL,
        hashed_otp TEXT NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified BOOLEAN DEFAULT false NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS password_reset_otps_email_idx ON password_reset_otps (email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS password_reset_otps_expires_at_idx ON password_reset_otps (expires_at)`);
    console.log('✅ password_reset_otps table created\n');

    // ============================================
    // 3. Create mentor_job_postings table
    // ============================================
    console.log('📋 Creating mentor_job_postings table...');
    
    // Create job_type enum if it doesn't exist
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE job_type AS ENUM ('ONSITE', 'OFFLINE', 'HYBRID');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mentor_job_postings (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        about_the_role TEXT,
        what_you_will_do TEXT,
        what_might_be_a_fit_if TEXT,
        nice_to_have TEXT,
        location TEXT NOT NULL DEFAULT 'Bangalore',
        job_type job_type NOT NULL,
        experience_required TEXT,
        area_of_interest TEXT[],
        required_skills TEXT[],
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_by VARCHAR(36),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS mentor_job_postings_is_active_idx ON mentor_job_postings (is_active)`);
    await client.query(`CREATE INDEX IF NOT EXISTS mentor_job_postings_location_idx ON mentor_job_postings (location)`);
    console.log('✅ mentor_job_postings table created\n');

    // ============================================
    // 4. Create cohort_task_sessions table
    // ============================================
    console.log('📋 Creating cohort_task_sessions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cohort_task_sessions (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        cohort_task_id VARCHAR(36) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        meeting_link TEXT,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS cohort_task_sessions_cohort_task_id_idx ON cohort_task_sessions (cohort_task_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS cohort_task_sessions_start_date_idx ON cohort_task_sessions (start_date)`);
    console.log('✅ cohort_task_sessions table created\n');

    // ============================================
    // 5. Create manual_payments table
    // ============================================
    console.log('📋 Creating manual_payments table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS manual_payments (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id VARCHAR(36) NOT NULL,
        installment_id VARCHAR(36),
        amount_paid DECIMAL(10, 2) NOT NULL,
        payment_date TIMESTAMP NOT NULL,
        payment_method TEXT NOT NULL,
        transaction_reference_id TEXT,
        notes TEXT,
        received_by VARCHAR(36) NOT NULL,
        proof_attachment_url TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS manual_payments_application_id_idx ON manual_payments (application_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS manual_payments_installment_id_idx ON manual_payments (installment_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS manual_payments_received_by_idx ON manual_payments (received_by)`);
    console.log('✅ manual_payments table created\n');

    // Commit transaction
    await client.query('COMMIT');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nTables created (if missing):');
    console.log('  • cohort_users');
    console.log('  • password_reset_otps');
    console.log('  • mentor_job_postings');
    console.log('  • cohort_task_sessions');
    console.log('  • manual_payments');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
