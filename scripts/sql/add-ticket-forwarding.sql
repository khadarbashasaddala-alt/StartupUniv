-- Academic-mentor gate for learner tickets aimed at an industry mentor.
-- forward_to_id remembers the industry mentor the learner originally chose while
-- the ticket is held by the academic mentor; NULL for every other ticket.
-- Idempotent -- safe to re-run on every release.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS forward_to_id VARCHAR(36);
