-- Evidence review: give each submission its own verdict, so a shared task can be reviewed
-- per person instead of all-or-nothing.
--
-- Background. `evidence` was write-once: no status, no reviewer, no feedback. Review lived
-- entirely on the task — one `reviewer_id` and one `review_comment` shared by everyone on it.
-- On a task with five assignees a mentor could not accept four submissions and ask the fifth
-- for changes, and the single comment column was overwritten on every round, so earlier
-- feedback was lost.
--
-- Also adds the mentor *kind* (academic / industry). Deliberately an attribute on the team
-- membership rather than a new user role: the literal 'MENTOR' is compared in 87 places in
-- server/routes.ts and 112 in the client, so a new role code would inherit none of those
-- permissions. Keeping role = MENTOR and typing the assignment leaves every guard untouched;
-- the kind only decides who is expected to review what.
--
-- Idempotent; safe to re-run.

BEGIN;

-- 1. Per-submission review state ---------------------------------------------------

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'PENDING';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(36);
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS feedback    TEXT;

-- Only PENDING rows are ever queried for the review queue, so the index is partial: it stays
-- small as the accepted pile grows, which is the direction this table only ever moves.
CREATE INDEX IF NOT EXISTS evidence_pending_review_idx
  ON evidence (task_id)
  WHERE status = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_status_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_status_check
      CHECK (status IN ('PENDING', 'ACCEPTED', 'CHANGES_REQUESTED'));
  END IF;
END $$;

-- Evidence already attached to a finished task was accepted in practice — somebody moved that
-- task to DONE having seen it. Backfilling stops the new queue opening full of historical work
-- that nobody is waiting on, and stops the DONE gate below retroactively blocking closed tasks.
UPDATE evidence e
   SET status = 'ACCEPTED'
  FROM tasks t
 WHERE t.id = e.task_id
   AND t.status = 'DONE'
   AND e.status = 'PENDING';

-- 2. Which mentor a task needs, and which kind of mentor a person is ---------------

-- NULL means "any reviewer with permission", which is exactly today's behaviour, so existing
-- tasks and memberships keep working untouched.
ALTER TABLE tasks             ADD COLUMN IF NOT EXISTS requires_review_from VARCHAR(20);
ALTER TABLE role_assignments  ADD COLUMN IF NOT EXISTS mentor_kind          VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_requires_review_from_check') THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_requires_review_from_check
      CHECK (requires_review_from IS NULL OR requires_review_from IN ('ACADEMIC', 'INDUSTRY'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'role_assignments_mentor_kind_check') THEN
    ALTER TABLE role_assignments ADD CONSTRAINT role_assignments_mentor_kind_check
      CHECK (mentor_kind IS NULL OR mentor_kind IN ('ACADEMIC', 'INDUSTRY'));
  END IF;
END $$;

COMMIT;
