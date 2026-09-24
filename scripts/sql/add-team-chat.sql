-- Team chat: one channel per team, with attachments, reactions and mentions.
-- Tables are prefixed team_chat_* because chat_leads / chat_sessions /
-- chat_messages already belong to the Python chatbot (bot/db/migrations.py).

DO $$ BEGIN
  CREATE TYPE team_chat_message_type AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE', 'STICKER', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Notification raised when someone is @mentioned in team chat
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'CHAT_MENTION';

CREATE TABLE IF NOT EXISTS team_chat_channels (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id VARCHAR(36) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_chat_channels_team_id_idx ON team_chat_channels (team_id);

CREATE TABLE IF NOT EXISTS team_chat_members (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  last_read_at TIMESTAMP,
  muted_until TIMESTAMP,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_chat_members_channel_id_idx ON team_chat_members (channel_id);
CREATE INDEX IF NOT EXISTS team_chat_members_user_id_idx ON team_chat_members (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS team_chat_members_channel_user_idx ON team_chat_members (channel_id, user_id);

CREATE TABLE IF NOT EXISTS team_chat_messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36),
  type team_chat_message_type NOT NULL DEFAULT 'TEXT',
  body TEXT,
  reply_to_id VARCHAR(36),
  mentions_json JSON,
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP,
  deleted_for_everyone BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Drives cursor pagination of channel history
CREATE INDEX IF NOT EXISTS team_chat_messages_channel_created_idx ON team_chat_messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS team_chat_messages_sender_id_idx ON team_chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS team_chat_messages_reply_to_id_idx ON team_chat_messages (reply_to_id);

CREATE TABLE IF NOT EXISTS team_chat_attachments (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(36) NOT NULL,
  file_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_chat_attachments_message_id_idx ON team_chat_attachments (message_id);

CREATE TABLE IF NOT EXISTS team_chat_reactions (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_chat_reactions_message_id_idx ON team_chat_reactions (message_id);
CREATE UNIQUE INDEX IF NOT EXISTS team_chat_reactions_unique_idx ON team_chat_reactions (message_id, user_id, emoji);
