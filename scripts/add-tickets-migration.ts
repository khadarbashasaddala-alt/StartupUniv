/**
 * Migration: create the ticketing tables, enums and notification types.
 * Run: npm run db:add-tickets
 * If connection times out (e.g. remote DB), run the SQL manually:
 *   psql "$DATABASE_URL" -f scripts/sql/add-tickets.sql
 *
 * Idempotent — safe to re-run.
 */

import "dotenv/config";
import { runSqlFileMigration } from "./lib/run-sql-file";

runSqlFileMigration({
  sqlFile: "add-tickets.sql",
  label: "Creating ticketing tables...",
  verifyTablesLike: "ticket%",
});
