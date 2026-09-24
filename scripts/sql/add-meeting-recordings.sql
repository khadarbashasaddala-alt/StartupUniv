-- Session recordings on team meetings: a mentor attaches the recording of a session they ran,
-- and everyone on that team can watch it. Admins can watch any team's.
--
-- Only the S3 object key is stored. The browser PUTs the file straight to S3 against a
-- presigned URL and plays it back from a signed GET, so no video byte passes through the
-- container -- which matters, because it runs on a t3a.small whose 30GB root volume has already
-- filled once and broken a deploy.
--
-- These columns must exist before the code that selects them ships. Drizzle's generated SELECT
-- names every column in the schema, so a missing one does not degrade the feature -- it makes
-- every query against the table fail. That is exactly how the evidence-review deploy took the
-- task board down: the code went out and the migration did not.
--
-- Idempotent; safe to re-run.

BEGIN;

ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_object_key       TEXT;
ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_file_name        TEXT;
-- BIGINT rather than INTEGER: int4 tops out at 2147483647 and the upload cap is 2GB, which is
-- 2147483648. A file exactly at the limit would pass validation and then fail to insert.
ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_size_bytes       BIGINT;
ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_content_type     TEXT;
ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER;
ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_uploaded_by      VARCHAR(36);
ALTER TABLE team_meetings ADD COLUMN IF NOT EXISTS recording_uploaded_at      TIMESTAMP;

-- Partial: most meetings never get a recording, so the index only covers the ones that did and
-- stays small as the meetings table grows.
CREATE INDEX IF NOT EXISTS team_meetings_recording_idx
  ON team_meetings (team_id)
  WHERE recording_object_key IS NOT NULL;

COMMIT;
