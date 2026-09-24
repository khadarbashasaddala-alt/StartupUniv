/**
 * Migration: create the ticket_sla_settings table (admin-configurable SLA
 * hours per priority), seeded with the existing hardcoded defaults.
 * Run: npm run db:add-ticket-sla-settings
 * If connection times out (e.g. remote DB), run the SQL manually:
 *   psql "$DATABASE_URL" -f scripts/sql/add-ticket-sla-settings.sql
 *
 * Idempotent — safe to re-run.
 *
 * DEPLOY NOTE: run this before (or as part of) the deploy that ships the
 * SLA-settings admin UI, not after. server/ticketSlaSettings.ts's
 * getSlaHours() deliberately falls back to the hardcoded defaults when this
 * table is missing, so GET /api/tickets/sla-settings will return 200 with
 * defaults on an unmigrated environment — an admin can open the settings
 * dialog and edit values, and only then hit an unexplained 500 from the PUT
 * route when the table doesn't exist to write to.
 */

import "dotenv/config";
import { runSqlFileMigration } from "./lib/run-sql-file";

runSqlFileMigration({
  sqlFile: "add-ticket-sla-settings.sql",
  label: "Creating ticket_sla_settings table...",
  verifyTablesLike: "ticket_sla%",
});
