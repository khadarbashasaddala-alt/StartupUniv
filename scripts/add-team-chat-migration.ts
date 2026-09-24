/**
 * Migration: create the team chat tables and enum.
 * Run: npm run db:add-team-chat
 * If connection times out (e.g. remote DB), run the SQL manually:
 *   psql "$DATABASE_URL" -f scripts/sql/add-team-chat.sql
 *
 * Idempotent — safe to re-run.
 */

import "dotenv/config";
import { runSqlFileMigration } from "./lib/run-sql-file";

runSqlFileMigration({
  sqlFile: "add-team-chat.sql",
  label: "Creating team chat tables...",
  verifyTablesLike: "team_chat%",
});
