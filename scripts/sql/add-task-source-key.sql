-- Task source key: lets a programme plan be re-imported without duplicating tasks.
--
-- Background (issue #258). Sprints and tasks are generated from an uploaded programme plan
-- template. Running the same import twice must update what is already there rather than append a
-- second copy of everything.
--
-- Sprints already have a natural key for that: sprints_team_index_idx is unique on
-- (team_id, index). Tasks had nothing, and `title` is a bad key — renaming a task in the template
-- would orphan the old row and insert a new one, which is exactly the duplication we are trying to
-- avoid. So generated tasks carry a stable positional key instead, of the form `plan:s1:t0`
-- (sprint index, then ordinal within that sprint).
--
-- Nullable on purpose, and the unique index is PARTIAL:
--
--   * Every hand-made task keeps source_key NULL. Postgres treats NULLs as distinct in a unique
--     index, but the WHERE clause makes that explicit and keeps the index small — it only ever
--     contains importer-owned rows. Hand-made tasks are therefore untouched by any import, and
--     no existing row needs backfilling.
--   * Scoped per sprint, not globally, because the key is only meaningful within its sprint:
--     `plan:s1:t0` exists once per sprint that a plan was applied to.
--
-- Idempotent; safe to re-run.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS tasks_sprint_source_key_idx
  ON tasks (sprint_id, source_key)
  WHERE source_key IS NOT NULL;
