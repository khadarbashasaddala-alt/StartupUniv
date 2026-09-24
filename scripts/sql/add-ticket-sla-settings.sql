-- Admin-configurable SLA deadline (hours) per ticket priority.
-- Seeded with the same values that were previously hardcoded in
-- shared/tickets.ts (SLA_HOURS), so behaviour is unchanged until an admin
-- edits a value from the Tickets page.

CREATE TABLE IF NOT EXISTS ticket_sla_settings (
  priority ticket_priority PRIMARY KEY,
  hours INTEGER NOT NULL,
  updated_by_id VARCHAR(36),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO ticket_sla_settings (priority, hours) VALUES ('HOT', 24)
  ON CONFLICT (priority) DO NOTHING;
INSERT INTO ticket_sla_settings (priority, hours) VALUES ('WARM', 72)
  ON CONFLICT (priority) DO NOTHING;
INSERT INTO ticket_sla_settings (priority, hours) VALUES ('COLD', 168)
  ON CONFLICT (priority) DO NOTHING;
