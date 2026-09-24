-- Add password_changed_at to users table (for Settings "Last changed" and login resilience).
-- Run this when connected to your DB, e.g.:
--   psql "$DATABASE_URL" -f scripts/sql/add-password-changed-at.sql
-- Or paste into pgAdmin / any PostgreSQL client.

-- Add column if it doesn't exist (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_changed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;
    RAISE NOTICE 'Column users.password_changed_at added.';
  ELSE
    RAISE NOTICE 'Column users.password_changed_at already exists.';
  END IF;
END $$;
