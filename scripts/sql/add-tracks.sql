-- Track catalog.
--
-- `problem_statements.track` was a postgres enum ("track"), so a track that
-- wasn't compiled into the enum could not be stored at all. This replaces the
-- enum constraint with a catalog table admins can add to at runtime.
--
-- Idempotent: safe to re-run.

-- 1. The catalog itself.
CREATE TABLE IF NOT EXISTS tracks (
  id          VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  value       TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  VARCHAR(36),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tracks_value_idx ON tracks (value);
CREATE INDEX IF NOT EXISTS tracks_is_active_idx ON tracks (is_active);

-- 2. Seed with everything the enum already carried, so nothing disappears from
--    the dropdown. Labels match shared/tracks.ts; the five domain-specific
--    values below existed in the enum but were never exposed in the UI.
INSERT INTO tracks (value, label) VALUES
  ('SaaS_B2B',        'SaaS & B2B Software'),
  ('AI',              'Artificial Intelligence'),
  ('FinTech',         'FinTech'),
  ('HealthTech',      'HealthTech'),
  ('BioTech',         'BioTech'),
  ('EdTech',          'EdTech'),
  ('Consumer',        'Consumer & Lifestyle'),
  ('ECommerce',       'E-Commerce & D2C'),
  ('Logistics',       'Logistics, Mobility & Transportation'),
  ('PropTech',        'PropTech / Real Estate'),
  ('AgriTech',        'AgriTech'),
  ('Climate',         'Energy, Climate & Sustainability'),
  ('Industrial',      'Industrial, Manufacturing & Robotics'),
  ('Media',           'Media, Content & Entertainment'),
  ('GovTech',         'GovTech'),
  ('MSME',            'MSME'),
  ('AI_Dev',          'AI Development'),
  ('FullStack_GenAI', 'Full Stack & GenAI'),
  ('Data_Analysis',   'Data Analysis'),
  ('DevOps_Cloud',    'DevOps & Cloud'),
  ('Cybersecurity',   'Cybersecurity')
ON CONFLICT (value) DO NOTHING;

-- 3. Safety net: adopt any track value already stored on a problem statement
--    that somehow isn't in the list above, so no existing row is orphaned.
INSERT INTO tracks (value, label)
SELECT DISTINCT track::TEXT, track::TEXT
FROM problem_statements
WHERE track IS NOT NULL
ON CONFLICT (value) DO NOTHING;

-- 4. Drop the enum constraint on the column. Existing values are preserved
--    verbatim as text. Guarded so re-running is a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'problem_statements'
      AND column_name  = 'track'
      AND data_type   <> 'text'
  ) THEN
    ALTER TABLE problem_statements
      ALTER COLUMN track TYPE TEXT USING track::TEXT;
  END IF;
END $$;

-- The "track" enum type is intentionally left in place. Nothing references it
-- now, but keeping it makes this migration trivially reversible and costs
-- nothing. Drop it only once you're certain no rollback is needed.
