-- Ticketing module: enums, tables and indexes.

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('HOT', 'WARM', 'COLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('OPEN', 'CLOSED', 'REOPENED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM ('TECHNICAL', 'FINANCE', 'MENTORSHIP', 'INFRASTRUCTURE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_event_type AS ENUM (
    'CREATED', 'ASSIGNED', 'ESCALATED', 'AUTO_ESCALATED', 'CLOSED', 'REOPENED',
    'PRIORITY_CHANGED', 'TAGGED', 'UNTAGGED', 'COMMENTED', 'LINKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- New notification types for ticket activity
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_ASSIGNED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_TAGGED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_ESCALATED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_COMMENTED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_CLOSED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_REOPENED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'TICKET_SLA_BREACHED';

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority ticket_priority NOT NULL DEFAULT 'WARM',
  status ticket_status NOT NULL DEFAULT 'OPEN',
  category ticket_category NOT NULL DEFAULT 'OTHER',
  cohort_id VARCHAR(36),
  raised_by_id VARCHAR(36) NOT NULL,
  assignee_id VARCHAR(36),
  escalation_level INTEGER NOT NULL DEFAULT 0,
  sla_due_at TIMESTAMP,
  sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  close_reason TEXT,
  closed_by_id VARCHAR(36),
  closed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tickets_cohort_id_idx ON tickets (cohort_id);
CREATE INDEX IF NOT EXISTS tickets_raised_by_id_idx ON tickets (raised_by_id);
CREATE INDEX IF NOT EXISTS tickets_assignee_id_idx ON tickets (assignee_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets (priority);
CREATE INDEX IF NOT EXISTS tickets_sla_due_at_idx ON tickets (sla_due_at);

CREATE TABLE IF NOT EXISTS ticket_tags (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  tagged_by_id VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_tags_ticket_id_idx ON ticket_tags (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_tags_user_id_idx ON ticket_tags (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_tags_ticket_user_idx ON ticket_tags (ticket_id, user_id);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(36) NOT NULL,
  author_id VARCHAR(36) NOT NULL,
  body TEXT NOT NULL,
  mentions_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_comments_ticket_id_idx ON ticket_comments (ticket_id);

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(36) NOT NULL,
  comment_id VARCHAR(36),
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  uploaded_by_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_id_idx ON ticket_attachments (ticket_id);
CREATE INDEX IF NOT EXISTS ticket_attachments_comment_id_idx ON ticket_attachments (comment_id);

CREATE TABLE IF NOT EXISTS ticket_events (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(36) NOT NULL,
  actor_id VARCHAR(36),
  type ticket_event_type NOT NULL,
  from_value TEXT,
  to_value TEXT,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_events_ticket_id_idx ON ticket_events (ticket_id);

CREATE TABLE IF NOT EXISTS ticket_links (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR(36) NOT NULL,
  linked_ticket_id VARCHAR(36) NOT NULL,
  created_by_id VARCHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_links_ticket_id_idx ON ticket_links (ticket_id);
CREATE UNIQUE INDEX IF NOT EXISTS ticket_links_pair_idx ON ticket_links (ticket_id, linked_ticket_id);
