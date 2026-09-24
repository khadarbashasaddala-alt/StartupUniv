-- Sprint name.
--
-- Sprints had no name: the board fell back to `goals` for the heading, so a
-- whole goals paragraph became the title. This adds a short, dedicated name.
--
-- Nullable on purpose — sprints created before this have none, and the UI falls
-- back to goals, then "Sprint <index>". Idempotent; safe to re-run.

ALTER TABLE sprints ADD COLUMN IF NOT EXISTS name TEXT;
