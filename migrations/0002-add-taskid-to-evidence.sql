-- Add nullable task_id to evidence table and index + FK
ALTER TABLE evidence
  ADD COLUMN task_id varchar(36);

-- create index for faster lookups
CREATE INDEX IF NOT EXISTS evidence_task_id_idx ON evidence (task_id);

-- add foreign key constraint if tasks table exists
ALTER TABLE evidence
  ADD CONSTRAINT evidence_task_id_fkey FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
