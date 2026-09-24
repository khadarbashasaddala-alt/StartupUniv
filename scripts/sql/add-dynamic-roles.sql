-- Makes user roles data instead of a Postgres enum, so an admin can add a role at
-- runtime, and moves cohort headcount planning off four fixed columns onto one row per
-- role. Idempotent: safe to run more than once.
--
-- Supersedes scripts/sql/add-cohort-role-counts.sql, which added the four columns this
-- migration removes.

BEGIN;

-- 1. Roles become rows -------------------------------------------------------------

-- The unique constraint is named explicitly: Postgres would default to roles_code_key,
-- while Drizzle expects roles_code_unique, and the mismatch makes `db:push` offer to
-- truncate the table on every run.
CREATE TABLE IF NOT EXISTS roles (
  id                     VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  code                   VARCHAR(50) NOT NULL CONSTRAINT roles_code_unique UNIQUE,
  label                  TEXT        NOT NULL,
  is_system              BOOLEAN     NOT NULL DEFAULT FALSE,
  include_in_composition BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order             INTEGER     NOT NULL DEFAULT 100,
  created_at             TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Corrects databases created by an earlier run of this file, before the constraint was
-- named explicitly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_code_key')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_code_unique') THEN
    ALTER TABLE roles RENAME CONSTRAINT roles_code_key TO roles_code_unique;
  END IF;
END $$;

-- The eight roles the code has behaviour for. is_system blocks deletion; only the four
-- that had cohort count columns get a composition field, preserving the current form.
INSERT INTO roles (code, label, is_system, include_in_composition, sort_order) VALUES
  ('ADMIN',      'Admin',      TRUE, FALSE, 10),
  ('LEARNER',    'Learner',    TRUE, TRUE,  20),
  ('MENTOR',     'Mentor',     TRUE, TRUE,  30),
  ('UNIVERSITY', 'University', TRUE, FALSE, 40),
  ('CORPORATE',  'Corporate',  TRUE, FALSE, 50),
  ('FOUNDER',    'Founder',    TRUE, TRUE,  60),
  ('COFOUNDER',  'Co-Founder', TRUE, TRUE,  70),
  ('MANAGER',    'Manager',    TRUE, FALSE, 80)
ON CONFLICT (code) DO NOTHING;

-- Any role already in use but somehow absent from the seed (e.g. added to the enum by an
-- older migration) is registered too, so the foreign key below cannot fail.
INSERT INTO roles (code, label, is_system, include_in_composition, sort_order)
SELECT DISTINCT u.role::text,
       INITCAP(REPLACE(u.role::text, '_', ' ')),
       FALSE, TRUE, 100
FROM users u
WHERE u.role IS NOT NULL
ON CONFLICT (code) DO NOTHING;

-- 2. Role columns: enum -> varchar -------------------------------------------------
-- ALTER TYPE cannot remove enum values and DDL-on-click is not viable, so every column
-- typed user_role becomes a plain varchar holding the same strings.

ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

DO $$
DECLARE
  col RECORD;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.udt_name = 'user_role'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE VARCHAR(50) USING %I::text;',
      col.table_name, col.column_name, col.column_name
    );
    RAISE NOTICE 'converted %.% to varchar', col.table_name, col.column_name;
  END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'LEARNER';

-- Integrity moves from the enum to a foreign key on the canonical column. Deleting a
-- role that users still hold is now blocked by the database, not just by app code.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_roles_code_fk'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_roles_code_fk
      FOREIGN KEY (role) REFERENCES roles (code) ON UPDATE CASCADE;
  END IF;
END $$;

DROP TYPE IF EXISTS user_role;

-- 3. Cohort composition: four columns -> one row per role --------------------------

CREATE TABLE IF NOT EXISTS cohort_role_counts (
  id         VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id  VARCHAR(36) NOT NULL,
  role_code  VARCHAR(50) NOT NULL,
  count      INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cohort_role_counts_cohort_id_idx
  ON cohort_role_counts (cohort_id);
CREATE UNIQUE INDEX IF NOT EXISTS cohort_role_counts_cohort_role_idx
  ON cohort_role_counts (cohort_id, role_code);

-- A count is meaningless without its cohort, and cannot refer to a role that was never
-- registered — so both sides are enforced here rather than only in application code.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_role_counts_cohort_id_cohorts_id_fk'
  ) THEN
    DELETE FROM cohort_role_counts
      WHERE cohort_id NOT IN (SELECT id FROM cohorts);
    ALTER TABLE cohort_role_counts
      ADD CONSTRAINT cohort_role_counts_cohort_id_cohorts_id_fk
      FOREIGN KEY (cohort_id) REFERENCES cohorts (id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cohort_role_counts_role_code_roles_code_fk'
  ) THEN
    DELETE FROM cohort_role_counts
      WHERE role_code NOT IN (SELECT code FROM roles);
    ALTER TABLE cohort_role_counts
      ADD CONSTRAINT cohort_role_counts_role_code_roles_code_fk
      FOREIGN KEY (role_code) REFERENCES roles (code) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Carry the existing numbers over before the columns go. Guarded so a re-run, or a
-- database that never had the columns, is a no-op.
DO $$
DECLARE
  mapping CONSTANT TEXT[][] := ARRAY[
    ['mentor_count', 'MENTOR'],
    ['founder_count', 'FOUNDER'],
    ['cofounder_count', 'COFOUNDER'],
    ['learner_count', 'LEARNER']
  ];
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY mapping LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'cohorts' AND column_name = pair[1]
    ) THEN
      EXECUTE format(
        'INSERT INTO cohort_role_counts (cohort_id, role_code, count)
           SELECT id, %L, COALESCE(%I, 0) FROM cohorts
           ON CONFLICT (cohort_id, role_code) DO NOTHING;',
        pair[2], pair[1]
      );
      EXECUTE format('ALTER TABLE cohorts DROP COLUMN %I;', pair[1]);
      RAISE NOTICE 'migrated and dropped cohorts.%', pair[1];
    END IF;
  END LOOP;
END $$;

COMMIT;
