/**
 * SLA watcher: auto-escalates tickets whose priority deadline has passed.
 *
 * This is what gives HOT/WARM/COLD real meaning — without it a priority is
 * just a coloured label. Each priority has a deadline, admin-configurable via
 * /api/tickets/sla-settings (see ./ticketSlaSettings.ts, falls back to the
 * SLA_HOURS defaults in shared/tickets.ts); when it expires the ticket moves
 * one step up the escalation chain and everyone involved is notified.
 */

import { storage } from "./storage";
import {
  escalationLevelForRole,
  nextEscalationRole,
  type TicketPriority,
} from "@shared/tickets";
import { slaDueDateFromSettings } from "./ticketSlaSettings";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes

let timer: NodeJS.Timeout | null = null;

export async function processOverdueTickets(now: Date = new Date()): Promise<number> {
  const overdue = await storage.getOverdueTickets(now);
  if (overdue.length === 0) return 0;

  // Fetched once for the whole batch rather than per ticket
  const allUsers = await storage.getUsers();
  const admins = allUsers.filter((u) => u.role === "ADMIN");
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  let escalated = 0;

  for (const ticket of overdue) {
    try {
      const assignee = ticket.assigneeId ? userById.get(ticket.assigneeId) ?? null : null;
      const currentRole = assignee?.role ?? "LEARNER";
      const targetRole = nextEscalationRole(currentRole);

      // Already at the top: flag the breach so it surfaces on the admin
      // dashboard, but leave the ticket where it is.
      if (!targetRole) {
        await storage.updateTicket(ticket.id, { slaBreached: true } as any);
        await notifyBreach(ticket.id, ticket.title, admins);
        continue;
      }

      const candidates = allUsers.filter((u) => u.role === targetRole);
      if (candidates.length === 0) {
        await storage.updateTicket(ticket.id, { slaBreached: true } as any);
        await notifyBreach(ticket.id, ticket.title, admins);
        continue;
      }

      const nextAssignee = candidates[0];

      await storage.updateTicket(ticket.id, {
        assigneeId: nextAssignee.id,
        escalationLevel: escalationLevelForRole(nextAssignee.role),
        slaDueAt: await slaDueDateFromSettings(ticket.priority as TicketPriority, now),
        slaBreached: true,
      } as any);

      // Keep the previous owner in the loop as a watcher
      if (ticket.assigneeId && ticket.assigneeId !== nextAssignee.id) {
        await storage.addTicketTag({
          ticketId: ticket.id,
          userId: ticket.assigneeId,
          taggedById: null,
        } as any);
      }

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: null, // system
        type: "AUTO_ESCALATED",
        fromValue: currentRole,
        toValue: targetRole,
        reason: `SLA expired for ${ticket.priority} priority`,
      } as any);

      await storage.createNotification({
        userId: nextAssignee.id,
        type: "TICKET_ESCALATED",
        title: "Ticket auto-escalated to you",
        message: `"${ticket.title}" breached its ${ticket.priority} SLA and was escalated to you`,
        metadataJson: { ticketId: ticket.id },
      } as any);

      escalated++;
    } catch (error) {
      console.error(`SLA escalation failed for ticket ${ticket.id}:`, error);
    }
  }

  if (escalated > 0) {
    console.log(`🎫 Auto-escalated ${escalated} overdue ticket(s)`);
  }
  return escalated;
}

async function notifyBreach(
  ticketId: string,
  title: string,
  admins: Array<{ id: string }>
) {
  try {
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        type: "TICKET_SLA_BREACHED",
        title: "Ticket breached its SLA",
        message: `"${title}" is overdue and could not be escalated further`,
        metadataJson: { ticketId },
      } as any);
    }
  } catch (error) {
    console.error("SLA breach notification failed:", error);
  }
}

export function startTicketSlaWatcher() {
  if (timer) return;

  // Run shortly after boot, then on a fixed interval
  setTimeout(() => {
    processOverdueTickets().catch((error) =>
      console.error("Ticket SLA watcher error:", error)
    );
  }, 30_000);

  timer = setInterval(() => {
    processOverdueTickets().catch((error) =>
      console.error("Ticket SLA watcher error:", error)
    );
  }, CHECK_INTERVAL_MS);

  // Don't hold the process open on shutdown
  timer.unref?.();

  console.log("🎫 Ticket SLA watcher started (checks every 15 minutes)");
}

export function stopTicketSlaWatcher() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
