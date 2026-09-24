-- Where a team meeting happens: GOOGLE_MEET (the portal mints the link through the Calendar API)
-- or OTHER (the mentor pastes their own Zoom/Teams/Webex link).
--
-- Meetings were Google Meet and nothing else. That covers a mentor who runs sessions on Meet and
-- nobody else -- and Meet only records on paid Workspace tiers, so a mentor who wants a recording
-- generally runs the session on Zoom and previously had nowhere to put the link.
--
-- Stored explicitly rather than inferred from "has a google_event_id": creating the calendar event
-- is allowed to fail without failing the meeting, so a genuine Meet meeting can end up with a
-- null link and null event id and would be indistinguishable from an external one.
--
-- NOT NULL with a default, and the default is GOOGLE_MEET because every row that existed before
-- this column was one. No backfill needed -- the default applies to them as the column is added.
--
-- Idempotent; safe to re-run.

BEGIN;

ALTER TABLE team_meetings
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT NOT NULL DEFAULT 'GOOGLE_MEET';

COMMIT;
