/**
 * Reads the admin-configurable SLA hours (ticket_sla_settings table),
 * falling back to the original hardcoded defaults (SLA_HOURS in
 * shared/tickets.ts) — both for any priority that has no row yet, and for
 * the read failing outright (table not migrated on this environment yet,
 * a connection blip, anything). Ticket creation, priority changes, close,
 * reopen, and escalation all await this, so letting an error propagate here
 * would turn a missing migration into an outage across every one of those
 * routes. A soft dependency (fall back to the old hardcoded behaviour) is
 * the right failure mode, not a hard one.
 *
 * Deliberately not cached: this is three rows read once per ticket write.
 * The app runs multiple instances, and a process-local cache only clears on
 * the instance that handled the admin's PUT — every other instance would
 * keep applying stale hours indefinitely, with nothing surfacing the
 * mismatch. Reading fresh each time costs a cheap query and avoids that
 * class of silent bug entirely.
 *
 * Side effect of the fallback worth knowing during a deploy: on an
 * unmigrated environment, GET /api/tickets/sla-settings still returns 200
 * with the defaults (this function swallows the read error), while PUT
 * /api/tickets/sla-settings will 500 trying to write to a table that
 * doesn't exist. See the deploy note in
 * scripts/add-ticket-sla-settings-migration.ts.
 */

import { storage } from "./storage";
import { SLA_HOURS, type TicketPriority } from "@shared/tickets";

/** Merged hours: DB overrides on top of the hardcoded defaults. */
export async function getSlaHours(): Promise<Record<TicketPriority, number>> {
  const hours = { ...SLA_HOURS };
  try {
    const rows = await storage.getTicketSlaSettings();
    for (const row of rows) {
      if (Number.isFinite(row.hours) && row.hours > 0) {
        hours[row.priority as TicketPriority] = row.hours;
      }
    }
  } catch (error) {
    console.error("Failed to read ticket SLA settings, falling back to defaults:", error);
  }
  return hours;
}

/** Drop-in async replacement for shared/tickets.ts's slaDueDateFrom(). */
export async function slaDueDateFromSettings(
  priority: TicketPriority,
  from: Date
): Promise<Date> {
  const hours = await getSlaHours();
  return new Date(from.getTime() + hours[priority] * 60 * 60 * 1000);
}
