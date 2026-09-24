import type { Express, Request, Response, RequestHandler } from "express";
import { storage } from "./storage";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  escalationLevelForRole,
  extractMentionIds,
  heldForForwardMessage,
  mentorKindFromTag,
  isAllowedAttachment,
  sanitizeFileName,
  nextEscalationRole,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from "@shared/tickets";
import { getSlaHours, slaDueDateFromSettings } from "./ticketSlaSettings";
import type { Ticket, User } from "@shared/schema";

interface TicketRouteDeps {
  requireAuth: RequestHandler;
  requireRole: (...roles: string[]) => RequestHandler;
}

const actor = (req: Request): User => (req as any).user as User;

/**
 * Cohorts a user belongs to, via direct cohort assignment or via membership of
 * a team that belongs to a cohort.
 */
async function getUserCohortIds(userId: string): Promise<string[]> {
  const ids = new Set<string>();

  const cohortUser = await storage.getCohortUser(userId);
  if (cohortUser?.cohortId) ids.add(cohortUser.cohortId);

  const assignments = await storage.getRoleAssignmentsByUser(userId);
  for (const assignment of assignments) {
    if (!assignment.teamId) continue;
    const team = await storage.getTeam(assignment.teamId);
    if (team?.cohortId) ids.add(team.cohortId);
  }

  return Array.from(ids);
}

/**
 * Everyone who can be tagged on a cohort's tickets: direct cohort members,
 * members of that cohort's teams, and every admin (admins are common to all).
 */
async function getTaggableUsers(cohortId: string | null): Promise<User[]> {
  const byId = new Map<string, User>();

  const allUsers = await storage.getUsers();
  for (const user of allUsers) {
    if (user.role === "ADMIN") byId.set(user.id, user);
  }

  if (cohortId) {
    const cohortMembers = await storage.getCohortUsersByCohort(cohortId);
    for (const member of cohortMembers) {
      const user = allUsers.find((u) => u.id === member.userId);
      if (user) byId.set(user.id, user);
    }

    const teams = await storage.getTeamsByCohort(cohortId);
    for (const team of teams) {
      const assignments = await storage.getRoleAssignmentsByTeam(team.id);
      for (const assignment of assignments) {
        const user = allUsers.find((u) => u.id === assignment.userId);
        if (user) byId.set(user.id, user);
      }
    }
  }

  return Array.from(byId.values());
}

/**
 * Who a non-admin may tag: the members of their own team(s), plus every admin.
 * The cohort-wide list (getTaggableUsers) let anyone tag any learner in the
 * cohort, which surfaced the entire user base in the Raise Ticket dialog.
 */
async function getTeamTaggableUsers(userId: string): Promise<User[]> {
  const byId = new Map<string, User>();

  const allUsers = await storage.getUsers();
  for (const user of allUsers) {
    if (user.role === "ADMIN") byId.set(user.id, user);
  }

  const assignments = await storage.getRoleAssignmentsByUser(userId);
  const teamIds = new Set(
    assignments.map((a) => a.teamId).filter((id): id is string => Boolean(id))
  );
  for (const teamId of teamIds) {
    const teamAssignments = await storage.getRoleAssignmentsByTeam(teamId);
    for (const assignment of teamAssignments) {
      const user = allUsers.find((u) => u.id === assignment.userId);
      if (user) byId.set(user.id, user);
    }
  }

  return Array.from(byId.values());
}

/**
 * The academic mentor who gates a learner's ticket to an industry mentor: a MENTOR
 * on one of the learner's teams whose custom tag marks them ACADEMIC. Null when the
 * team has none — the ticket then goes straight to the industry mentor.
 */
async function findAcademicMentorFor(learnerId: string): Promise<User | null> {
  const assignments = await storage.getRoleAssignmentsByUser(learnerId);
  const teamIds = new Set(
    assignments.map((a) => a.teamId).filter((id): id is string => Boolean(id))
  );

  const allUsers = await storage.getUsers();
  for (const teamId of teamIds) {
    const teamAssignments = await storage.getRoleAssignmentsByTeam(teamId);
    for (const assignment of teamAssignments) {
      const candidate = allUsers.find((u) => u.id === assignment.userId);
      if (
        candidate &&
        candidate.role === "MENTOR" &&
        mentorKindFromTag((candidate as any).customTag) === "ACADEMIC"
      ) {
        return candidate;
      }
    }
  }
  return null;
}

async function canViewTicket(ticket: Ticket, user: User): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (ticket.raisedById === user.id) return true;
  if (ticket.assigneeId === user.id) return true;

  const tags = await storage.getTicketTags(ticket.id);
  return tags.some((tag) => tag.userId === user.id);
}

function canCloseTicket(ticket: Ticket, user: User): boolean {
  return (
    user.role === "ADMIN" ||
    ticket.assigneeId === user.id ||
    ticket.raisedById === user.id
  );
}

function canReopenTicket(ticket: Ticket, user: User): boolean {
  return user.role === "ADMIN" || ticket.raisedById === user.id;
}

function canEscalateTicket(ticket: Ticket, user: User): boolean {
  return (
    user.role === "ADMIN" ||
    ticket.assigneeId === user.id ||
    ticket.raisedById === user.id
  );
}

/**
 * Every ticket attachment is expected to live under the prefix this server
 * itself hands out from /api/tickets/attachments/upload-url. Rejecting
 * anything else stops a client from pointing an attachment row (and, via
 * the download route, a signed-URL request) at an arbitrary key elsewhere
 * in the bucket.
 *
 * This narrows the class of attack to "reuse a key already issued for some
 * ticket attachment" — it does not by itself stop reusing a key that belongs
 * to a *different* ticket's attachment (see the objectKey-ownership check
 * applied at registration time below).
 */
export function isTicketAttachmentObjectKey(objectKey: unknown): objectKey is string {
  return typeof objectKey === "string" && objectKey.startsWith("tickets/attachments/");
}

/**
 * Validates every attachment entry before anything is mutated, so a bad
 * entry always surfaces as a 400 with nothing partially applied. Shared by
 * ticket creation, close, and reopen so all three behave the same way —
 * previously ticket creation silently dropped bad entries while close/reopen
 * 400'd, so the identical payload behaved differently depending on the route.
 */
export function validateAttachmentsInput(attachments: unknown): string | null {
  if (!Array.isArray(attachments)) return null;
  for (const file of attachments) {
    if (!file?.objectKey || !file?.fileName) {
      return "Each attachment needs a fileName and objectKey";
    }
    if (!isTicketAttachmentObjectKey(file.objectKey)) {
      return "Invalid attachment reference";
    }
    if (!isAllowedAttachment(file.fileName, file.contentType)) {
      return `${file.fileName} is not an allowed file type`;
    }
  }
  return null;
}

/**
 * Rejects an attachment whose objectKey is already registered against a
 * ticket other than the one being written to now. The key-prefix check
 * above only guarantees the key belongs to *some* ticket's upload; without
 * this, anyone who can see another ticket's attachment (e.g. a tagged user
 * on that ticket) could resubmit its objectKey against a ticket of their
 * own and make the same file downloadable through their own ticket's routes.
 * currentTicketId is null for ticket creation, since the ticket doesn't
 * exist yet — any existing match there necessarily belongs to another ticket.
 */
export async function assertAttachmentsUnclaimed(
  attachments: unknown,
  currentTicketId: string | null
): Promise<string | null> {
  if (!Array.isArray(attachments)) return null;
  for (const file of attachments) {
    if (!file?.objectKey) continue;
    const existing = await storage.getTicketAttachmentByObjectKey(file.objectKey);
    if (existing && existing.ticketId !== currentTicketId) {
      return "One or more attachments could not be verified";
    }
  }
  return null;
}

/**
 * Rounds each submitted priority's hours to the nearest whole hour BEFORE
 * validating it, not after. Validating the raw value and rounding only at
 * the storage call let something like 0.4 pass the ">0" check, then land in
 * the NOT NULL hours column as 0 — which getSlaHours()'s own `row.hours > 0`
 * guard then silently discards, so the admin sees a 200 but the override
 * never actually applies. Exported so the rounding/validation behaviour can
 * be unit tested without spinning up a full Express app.
 */
export function parseSlaHoursInput(
  body: Record<string, unknown>
): { entries: Array<{ priority: TicketPriority; hours: number }> } | { error: string } {
  const entries = TICKET_PRIORITIES.filter((p) => body[p] !== undefined).map((p) => {
    const hours = Math.round(Number(body[p]));
    return { priority: p, hours };
  });

  if (entries.length === 0) {
    return { error: "No valid priority hours provided" };
  }
  for (const { priority, hours } of entries) {
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 365) {
      return { error: `${priority} hours must be a positive number (up to 1 year)` };
    }
  }
  return { entries };
}

/** Fan a notification out to everyone involved, minus the actor. */
async function notifyParticipants(
  ticketId: string,
  excludeUserId: string,
  type: any,
  title: string,
  message: string
) {
  const ticket = await storage.getTicket(ticketId);
  if (!ticket) return;

  const recipients = new Set<string>();
  recipients.add(ticket.raisedById);
  if (ticket.assigneeId) recipients.add(ticket.assigneeId);
  const tags = await storage.getTicketTags(ticketId);
  for (const tag of tags) recipients.add(tag.userId);
  recipients.delete(excludeUserId);

  for (const userId of recipients) {
    try {
      await storage.createNotification({
        userId,
        type,
        title,
        message,
        metadataJson: { ticketId },
      } as any);
    } catch (error) {
      console.error("Ticket notification failed for user", userId, error);
    }
  }
}

export function registerTicketRoutes(app: Express, deps: TicketRouteDeps) {
  const { requireAuth, requireRole } = deps;

  // ---------------------------------------------------------------------------
  // Reference data
  // ---------------------------------------------------------------------------

  // Who the current user may tag: admins see the whole cohort, everyone else
  // sees their own team members plus the admins.
  app.get("/api/tickets/taggable-users", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const requestedCohortId = (req.query.cohortId as string) || null;

      const users =
        user.role === "ADMIN"
          ? await getTaggableUsers(requestedCohortId)
          : await getTeamTaggableUsers(user.id);
      res.json(
        users
          .filter((u) => u.id !== user.id)
          .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
      );
    } catch (error: any) {
      console.error("Get taggable users error:", error);
      res.status(500).json({ message: "Failed to load taggable users" });
    }
  });

  // Admin dashboard widget counts
  app.get("/api/tickets/stats", requireRole("ADMIN"), async (_req, res) => {
    try {
      const all = await storage.getTickets();
      const open = all.filter((t) => t.status !== "CLOSED");
      const closed = all.filter((t) => t.status === "CLOSED");

      const closeDurations = closed
        .filter((t) => t.closedAt)
        .map((t) => new Date(t.closedAt!).getTime() - new Date(t.createdAt).getTime());
      const avgCloseHours = closeDurations.length
        ? closeDurations.reduce((sum, ms) => sum + ms, 0) /
          closeDurations.length /
          (1000 * 60 * 60)
        : 0;

      res.json({
        total: all.length,
        open: open.length,
        closed: closed.length,
        openHot: open.filter((t) => t.priority === "HOT").length,
        slaBreached: open.filter((t) => t.slaBreached).length,
        reopened: all.filter((t) => t.status === "REOPENED").length,
        avgCloseHours: Math.round(avgCloseHours * 10) / 10,
      });
    } catch (error: any) {
      console.error("Ticket stats error:", error);
      res.status(500).json({ message: "Failed to load ticket stats" });
    }
  });

  // Current SLA hours per priority (defaults merged with any admin overrides)
  app.get("/api/tickets/sla-settings", requireRole("ADMIN"), async (_req, res) => {
    try {
      const hours = await getSlaHours();
      res.json(hours);
    } catch (error: any) {
      console.error("Get ticket SLA settings error:", error);
      res.status(500).json({ message: "Failed to load SLA settings" });
    }
  });

  // Admin updates the SLA deadline (in hours) for one or more priorities.
  // Only affects tickets created/re-prioritised/reopened/escalated from now
  // on — it does not retroactively change the deadline already set on
  // existing open tickets.
  app.put("/api/tickets/sla-settings", requireRole("ADMIN"), async (req, res) => {
    try {
      const user = actor(req);
      const body = (req.body || {}) as Record<string, unknown>;

      const parsed = parseSlaHoursInput(body);
      if ("error" in parsed) {
        return res.status(400).json({ message: parsed.error });
      }

      // A single transaction: applying priorities one upsert at a time meant
      // a failure partway through left the earlier ones already committed
      // while still reporting a 500 to the admin.
      await storage.upsertTicketSlaSettings(parsed.entries, user.id);

      const updated = await getSlaHours();
      res.json(updated);
    } catch (error: any) {
      console.error("Update ticket SLA settings error:", error);
      res.status(500).json({ message: "Failed to update SLA settings" });
    }
  });

  // Presigned S3 upload URL for a ticket attachment
  app.post("/api/tickets/attachments/upload-url", requireAuth, async (req, res) => {
    try {
      const { fileName, fileType, fileSize } = req.body || {};

      if (!fileName) {
        return res.status(400).json({ message: "File name is required" });
      }
      // Content type is cross-checked too: the extension alone lets
      // "payload.exe.png" through, and the declared type alone is client-set.
      if (!isAllowedAttachment(fileName, fileType)) {
        return res.status(400).json({ message: "This file type is not allowed" });
      }
      // Required, not optional — an absent or non-numeric fileSize previously
      // skipped the cap, and the presigned PUT has no size condition of its own.
      if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
        return res
          .status(400)
          .json({ message: "A numeric fileSize is required to request an upload URL" });
      }
      if (fileSize > ATTACHMENT_MAX_BYTES) {
        return res.status(400).json({
          message: `File exceeds the ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB limit`,
        });
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      // Sanitised so a name containing ../ or a leading / cannot escape the prefix
      const safeName = sanitizeFileName(fileName);
      if (!safeName) return res.status(400).json({ message: "Invalid file name" });
      const objectKey = `tickets/attachments/${fileId}/${safeName}`;
      const contentType = fileType || "application/octet-stream";

      const { s3Storage } = await import("./s3");
      const signedURL = await s3Storage.getSignedUploadURL(objectKey, contentType, 900);

      res.json({ uploadUrl: signedURL, objectKey, fileId });
    } catch (error: any) {
      console.error("Ticket attachment upload URL error:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  // ---------------------------------------------------------------------------
  // Tickets
  // ---------------------------------------------------------------------------

  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const { status, priority, category, cohortId, scope } = req.query as Record<string, string>;

      let visible: Ticket[];
      if (user.role === "ADMIN") {
        visible = await storage.getTickets();
      } else {
        const base = await storage.getTicketsVisibleToUser(user.id);

        // Merge in tickets the user is only tagged on
        const tags = await storage.getTicketTagsByUser(user.id);
        const seen = new Set(base.map((t) => t.id));
        for (const tag of tags) {
          if (seen.has(tag.ticketId)) continue;
          const ticket = await storage.getTicket(tag.ticketId);
          if (ticket) {
            base.push(ticket);
            seen.add(ticket.id);
          }
        }
        visible = base.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      if (scope === "raised") visible = visible.filter((t) => t.raisedById === user.id);
      if (scope === "assigned") visible = visible.filter((t) => t.assigneeId === user.id);
      if (status) visible = visible.filter((t) => t.status === status);
      if (priority) visible = visible.filter((t) => t.priority === priority);
      if (category) visible = visible.filter((t) => t.category === category);
      if (cohortId) visible = visible.filter((t) => t.cohortId === cohortId);

      // Attach the counts the list view needs without extra round trips client-side
      const enriched = await Promise.all(
        visible.map(async (ticket) => {
          const [tags, comments, attachments] = await Promise.all([
            storage.getTicketTags(ticket.id),
            storage.getTicketComments(ticket.id),
            storage.getTicketAttachments(ticket.id),
          ]);
          return {
            ...ticket,
            tagCount: tags.length,
            commentCount: comments.length,
            attachmentCount: attachments.length,
          };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("List tickets error:", error);
      res.status(500).json({ message: "Failed to load tickets" });
    }
  });

  app.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const [tags, comments, attachments, events, links] = await Promise.all([
        storage.getTicketTags(ticket.id),
        storage.getTicketComments(ticket.id),
        storage.getTicketAttachments(ticket.id),
        storage.getTicketEvents(ticket.id),
        storage.getTicketLinks(ticket.id),
      ]);

      const allUsers = await storage.getUsers();
      const publicUser = (id: string | null) => {
        if (!id) return null;
        const found = allUsers.find((u) => u.id === id);
        return found ? { id: found.id, name: found.name, role: found.role } : null;
      };

      res.json({
        ...ticket,
        raisedBy: publicUser(ticket.raisedById),
        assignee: publicUser(ticket.assigneeId),
        forwardTo: publicUser((ticket as any).forwardToId ?? null),
        closedBy: publicUser(ticket.closedById),
        tags: tags.map((tag) => ({ ...tag, user: publicUser(tag.userId) })),
        comments: comments.map((comment) => ({
          ...comment,
          author: publicUser(comment.authorId),
        })),
        attachments,
        events: events.map((event) => ({ ...event, actor: publicUser(event.actorId) })),
        links,
        permissions: {
          canClose: canCloseTicket(ticket, user),
          canReopen: canReopenTicket(ticket, user),
          canEscalate: canEscalateTicket(ticket, user),
          canEdit: user.role === "ADMIN" || ticket.raisedById === user.id,
          canForward:
            Boolean((ticket as any).forwardToId) &&
            ticket.status !== "CLOSED" &&
            (user.role === "ADMIN" || ticket.assigneeId === user.id),
        },
      });
    } catch (error: any) {
      console.error("Get ticket error:", error);
      res.status(500).json({ message: "Failed to load ticket" });
    }
  });

  app.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const {
        title,
        description,
        priority,
        category,
        cohortId,
        assigneeId,
        taggedUserIds,
        attachments,
      } = req.body || {};

      if (!title || !String(title).trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      const resolvedPriority: TicketPriority = TICKET_PRIORITIES.includes(priority)
        ? priority
        : "WARM";
      const resolvedCategory: TicketCategory = TICKET_CATEGORIES.includes(category)
        ? category
        : "OTHER";

      if (Array.isArray(attachments) && attachments.length > ATTACHMENT_MAX_FILES) {
        return res
          .status(400)
          .json({ message: `At most ${ATTACHMENT_MAX_FILES} attachments per ticket` });
      }
      // Validated up front, before the ticket exists: matches close/reopen
      // now, rather than silently dropping a bad entry while still creating
      // the ticket "successfully".
      const attachmentInputError = validateAttachmentsInput(attachments);
      if (attachmentInputError) {
        return res.status(400).json({ message: attachmentInputError });
      }
      const attachmentClaimError = await assertAttachmentsUnclaimed(attachments, null);
      if (attachmentClaimError) {
        return res.status(400).json({ message: attachmentClaimError });
      }

      // Non-admins can only raise tickets inside a cohort they belong to
      let resolvedCohortId: string | null = cohortId || null;
      if (user.role !== "ADMIN") {
        const cohortIds = await getUserCohortIds(user.id);
        if (resolvedCohortId && !cohortIds.includes(resolvedCohortId)) {
          return res.status(403).json({ message: "You are not a member of that cohort" });
        }
        resolvedCohortId = resolvedCohortId ?? cohortIds[0] ?? null;
      }

      // Academic-mentor gate: a learner's ticket aimed at an industry mentor is
      // held by the team's academic mentor first, who resolves it or forwards it.
      // Strictly this one case; if the team has no academic mentor, the ticket
      // goes straight to the industry mentor as before.
      let resolvedAssigneeId: string | null = assigneeId || null;
      let forwardToId: string | null = null;
      let routingMessage: string | null = null;
      if (user.role === "LEARNER" && resolvedAssigneeId) {
        const chosen = await storage.getUser(resolvedAssigneeId);
        if (
          chosen &&
          chosen.role === "MENTOR" &&
          mentorKindFromTag((chosen as any).customTag) === "INDUSTRY"
        ) {
          const academic = await findAcademicMentorFor(user.id);
          if (academic && academic.id !== chosen.id) {
            forwardToId = chosen.id;
            resolvedAssigneeId = academic.id;
            routingMessage = heldForForwardMessage(academic.name ?? "", chosen.name ?? "");
          }
        }
      }

      const now = new Date();
      const ticket = await storage.createTicket({
        title: String(title).trim(),
        description: description ?? null,
        priority: resolvedPriority,
        status: "OPEN",
        category: resolvedCategory,
        cohortId: resolvedCohortId,
        raisedById: user.id,
        assigneeId: resolvedAssigneeId,
        forwardToId,
        escalationLevel: escalationLevelForRole(user.role),
        slaDueAt: await slaDueDateFromSettings(resolvedPriority, now),
        slaBreached: false,
        reopenCount: 0,
      } as any);

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "CREATED",
        toValue: resolvedPriority,
      } as any);

      if (Array.isArray(taggedUserIds)) {
        // Non-admins may only tag their own teammates and admins; ids outside
        // that set are dropped rather than failing the whole ticket.
        const allowedIds =
          user.role === "ADMIN"
            ? null
            : new Set((await getTeamTaggableUsers(user.id)).map((u) => u.id));
        for (const userId of taggedUserIds) {
          if (!userId || userId === user.id) continue;
          if (allowedIds && !allowedIds.has(userId)) continue;
          await storage.addTicketTag({
            ticketId: ticket.id,
            userId,
            taggedById: user.id,
          } as any);
          await storage.createTicketEvent({
            ticketId: ticket.id,
            actorId: user.id,
            type: "TAGGED",
            toValue: userId,
          } as any);
          await storage.createNotification({
            userId,
            type: "TICKET_TAGGED",
            title: "You were tagged on a ticket",
            message: `${user.name} tagged you on "${ticket.title}"`,
            metadataJson: { ticketId: ticket.id },
          } as any);
        }
      }

      if (Array.isArray(attachments)) {
        for (const file of attachments) {
          await storage.createTicketAttachment({
            ticketId: ticket.id,
            fileName: file.fileName,
            objectKey: file.objectKey,
            contentType: file.contentType ?? null,
            fileSize: file.fileSize ?? null,
            uploadedById: user.id,
          } as any);
        }
      }

      // Notify whoever actually holds the ticket. When the gate rerouted it, that
      // is the academic mentor — the industry mentor hears nothing until forwarded.
      if (resolvedAssigneeId && resolvedAssigneeId !== user.id) {
        await storage.createTicketEvent({
          ticketId: ticket.id,
          actorId: user.id,
          type: "ASSIGNED",
          toValue: resolvedAssigneeId,
          reason: forwardToId
            ? "Held for academic mentor review before the industry mentor"
            : null,
        } as any);
        await storage.createNotification({
          userId: resolvedAssigneeId,
          type: "TICKET_ASSIGNED",
          title: forwardToId ? "A ticket needs your review first" : "A ticket was assigned to you",
          message: forwardToId
            ? `${user.name} raised "${ticket.title}" for the industry mentor — review it first and resolve or forward it`
            : `${user.name} assigned you "${ticket.title}"`,
          metadataJson: { ticketId: ticket.id },
        } as any);
      }

      res.status(201).json({ ...ticket, routingMessage });
    } catch (error: any) {
      console.error("Create ticket error:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  app.patch("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });

      const canEdit = user.role === "ADMIN" || ticket.raisedById === user.id;
      if (!canEdit) return res.status(403).json({ message: "Forbidden" });

      const { title, description, priority, category, assigneeId } = req.body || {};
      const update: Record<string, any> = {};

      if (typeof title === "string" && title.trim()) update.title = title.trim();
      if (typeof description === "string") update.description = description;
      if (category && TICKET_CATEGORIES.includes(category)) update.category = category;

      // Changing priority restarts the SLA clock from now
      if (priority && TICKET_PRIORITIES.includes(priority) && priority !== ticket.priority) {
        update.priority = priority;
        update.slaDueAt = await slaDueDateFromSettings(priority, new Date());
        update.slaBreached = false;
        await storage.createTicketEvent({
          ticketId: ticket.id,
          actorId: user.id,
          type: "PRIORITY_CHANGED",
          fromValue: ticket.priority,
          toValue: priority,
        } as any);
      }

      if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
        update.assigneeId = assigneeId || null;
        await storage.createTicketEvent({
          ticketId: ticket.id,
          actorId: user.id,
          type: "ASSIGNED",
          fromValue: ticket.assigneeId,
          toValue: assigneeId || null,
        } as any);
        if (assigneeId) {
          await storage.createNotification({
            userId: assigneeId,
            type: "TICKET_ASSIGNED",
            title: "A ticket was assigned to you",
            message: `${user.name} assigned you "${ticket.title}"`,
            metadataJson: { ticketId: ticket.id },
          } as any);
        }
      }

      const updated = await storage.updateTicket(ticket.id, update as any);
      res.json(updated);
    } catch (error: any) {
      console.error("Update ticket error:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  app.post("/api/tickets/:id/close", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!canCloseTicket(ticket, user)) {
        return res
          .status(403)
          .json({ message: "Only the assignee, the raiser, or an admin can close this ticket" });
      }
      if (ticket.status === "CLOSED") {
        return res.status(400).json({ message: "Ticket is already closed" });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res.status(400).json({ message: "A closing reason is required" });
      }

      // Attachment is optional — same shape as ticket-creation attachments
      // (already uploaded to S3 via /api/tickets/attachments/upload-url).
      // Validated fully up front, before the ticket is mutated: silently
      // dropping a bad entry here (as the ticket-creation path does) would
      // mean the close itself still "succeeds" while the user's attachment
      // quietly vanishes, with no signal that anything went wrong.
      const attachments = req.body?.attachments;
      if (Array.isArray(attachments) && attachments.length > 0) {
        const existing = await storage.getTicketAttachments(ticket.id);
        if (existing.length + attachments.length > ATTACHMENT_MAX_FILES) {
          return res
            .status(400)
            .json({ message: `At most ${ATTACHMENT_MAX_FILES} attachments per ticket` });
        }
        const attachmentInputError = validateAttachmentsInput(attachments);
        if (attachmentInputError) {
          return res.status(400).json({ message: attachmentInputError });
        }
        const attachmentClaimError = await assertAttachmentsUnclaimed(attachments, ticket.id);
        if (attachmentClaimError) {
          return res.status(400).json({ message: attachmentClaimError });
        }
      }

      const updated = await storage.updateTicket(ticket.id, {
        status: "CLOSED",
        closeReason: reason,
        closedById: user.id,
        closedAt: new Date(),
      } as any);

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "CLOSED",
        fromValue: ticket.status,
        toValue: "CLOSED",
        reason,
      } as any);

      if (Array.isArray(attachments)) {
        for (const file of attachments) {
          await storage.createTicketAttachment({
            ticketId: ticket.id,
            fileName: file.fileName,
            objectKey: file.objectKey,
            contentType: file.contentType ?? null,
            fileSize: file.fileSize ?? null,
            uploadedById: user.id,
          } as any);
        }
      }

      await notifyParticipants(
        ticket.id,
        user.id,
        "TICKET_CLOSED",
        "Ticket closed",
        `${user.name} closed "${ticket.title}"`
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Close ticket error:", error);
      res.status(500).json({ message: "Failed to close ticket" });
    }
  });

  app.post("/api/tickets/:id/reopen", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!canReopenTicket(ticket, user)) {
        return res.status(403).json({ message: "Only the raiser or an admin can reopen this ticket" });
      }
      if (ticket.status !== "CLOSED") {
        return res.status(400).json({ message: "Only a closed ticket can be reopened" });
      }

      const reason = String(req.body?.reason || "").trim();

      // Attachment is optional here too, same shape as close/creation.
      // Validated fully up front for the same reason as /close: silently
      // dropping a bad entry would let the reopen "succeed" while quietly
      // losing the attachment.
      const attachments = req.body?.attachments;
      if (Array.isArray(attachments) && attachments.length > 0) {
        const existing = await storage.getTicketAttachments(ticket.id);
        if (existing.length + attachments.length > ATTACHMENT_MAX_FILES) {
          return res
            .status(400)
            .json({ message: `At most ${ATTACHMENT_MAX_FILES} attachments per ticket` });
        }
        const attachmentInputError = validateAttachmentsInput(attachments);
        if (attachmentInputError) {
          return res.status(400).json({ message: attachmentInputError });
        }
        const attachmentClaimError = await assertAttachmentsUnclaimed(attachments, ticket.id);
        if (attachmentClaimError) {
          return res.status(400).json({ message: attachmentClaimError });
        }
      }

      // Reopening restarts the SLA clock
      const updated = await storage.updateTicket(ticket.id, {
        status: "REOPENED",
        reopenCount: ticket.reopenCount + 1,
        closeReason: null,
        closedById: null,
        closedAt: null,
        slaDueAt: await slaDueDateFromSettings(ticket.priority as TicketPriority, new Date()),
        slaBreached: false,
      } as any);

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "REOPENED",
        fromValue: "CLOSED",
        toValue: "REOPENED",
        reason: reason || null,
      } as any);

      if (Array.isArray(attachments)) {
        for (const file of attachments) {
          await storage.createTicketAttachment({
            ticketId: ticket.id,
            fileName: file.fileName,
            objectKey: file.objectKey,
            contentType: file.contentType ?? null,
            fileSize: file.fileSize ?? null,
            uploadedById: user.id,
          } as any);
        }
      }

      await notifyParticipants(
        ticket.id,
        user.id,
        "TICKET_REOPENED",
        "Ticket reopened",
        `${user.name} reopened "${ticket.title}"`
      );

      res.json(updated);
    } catch (error: any) {
      console.error("Reopen ticket error:", error);
      res.status(500).json({ message: "Failed to reopen ticket" });
    }
  });

  app.post("/api/tickets/:id/escalate", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!canEscalateTicket(ticket, user)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (ticket.status === "CLOSED") {
        return res.status(400).json({ message: "A closed ticket cannot be escalated" });
      }

      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res.status(400).json({ message: "An escalation reason is required" });
      }

      // Escalate relative to the current assignee's role, falling back to the
      // level already recorded on the ticket.
      const assignee = ticket.assigneeId ? await storage.getUser(ticket.assigneeId) : null;
      const currentRole = assignee?.role ?? user.role;
      const targetRole = nextEscalationRole(currentRole);

      if (!targetRole) {
        return res
          .status(400)
          .json({ message: "This ticket is already at the top of the escalation chain" });
      }

      // Pick someone at the target role, preferring a member of the same cohort
      const allUsers = await storage.getUsers();
      const candidates = allUsers.filter((u) => u.role === targetRole);
      let nextAssignee = candidates[0] ?? null;

      if (ticket.cohortId && candidates.length > 1) {
        for (const candidate of candidates) {
          const cohortIds = await getUserCohortIds(candidate.id);
          if (cohortIds.includes(ticket.cohortId)) {
            nextAssignee = candidate;
            break;
          }
        }
      }

      if (!nextAssignee) {
        return res
          .status(400)
          .json({ message: `No ${targetRole} user exists to escalate to` });
      }

      const explicitTarget = req.body?.assigneeId as string | undefined;
      if (explicitTarget) {
        const chosen = allUsers.find((u) => u.id === explicitTarget);
        if (chosen) nextAssignee = chosen;
      }

      const updated = await storage.updateTicket(ticket.id, {
        assigneeId: nextAssignee.id,
        escalationLevel: escalationLevelForRole(nextAssignee.role),
        status: ticket.status === "REOPENED" ? "REOPENED" : "OPEN",
        slaDueAt: await slaDueDateFromSettings(ticket.priority as TicketPriority, new Date()),
        slaBreached: false,
      } as any);

      // Previous assignee stays involved as a watcher
      if (ticket.assigneeId && ticket.assigneeId !== nextAssignee.id) {
        await storage.addTicketTag({
          ticketId: ticket.id,
          userId: ticket.assigneeId,
          taggedById: user.id,
        } as any);
      }

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "ESCALATED",
        fromValue: currentRole,
        toValue: targetRole,
        reason,
      } as any);

      await storage.createNotification({
        userId: nextAssignee.id,
        type: "TICKET_ESCALATED",
        title: "A ticket was escalated to you",
        message: `${user.name} escalated "${ticket.title}": ${reason}`,
        metadataJson: { ticketId: ticket.id },
      } as any);

      res.json(updated);
    } catch (error: any) {
      console.error("Escalate ticket error:", error);
      res.status(500).json({ message: "Failed to escalate ticket" });
    }
  });

  // The academic mentor's "push": hand a gated ticket on to the industry mentor
  // the learner originally picked. Only the current assignee (or an admin) may
  // do it, and only while a forward target exists.
  app.post("/api/tickets/:id/forward", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (ticket.status === "CLOSED") {
        return res.status(400).json({ message: "A closed ticket cannot be forwarded" });
      }
      const forwardToId = (ticket as any).forwardToId as string | null;
      if (!forwardToId) {
        return res.status(400).json({ message: "This ticket has no pending industry mentor to forward to" });
      }
      if (user.role !== "ADMIN" && ticket.assigneeId !== user.id) {
        return res.status(403).json({ message: "Only the assigned academic mentor or an admin can forward this ticket" });
      }

      const target = await storage.getUser(forwardToId);
      if (!target) {
        return res.status(400).json({ message: "The industry mentor no longer exists" });
      }

      const updated = await storage.updateTicket(ticket.id, {
        assigneeId: target.id,
        forwardToId: null,
        escalationLevel: escalationLevelForRole(target.role),
        slaDueAt: await slaDueDateFromSettings(ticket.priority as TicketPriority, new Date()),
        slaBreached: false,
      } as any);

      // The academic mentor stays involved as a watcher.
      if (ticket.assigneeId && ticket.assigneeId !== target.id) {
        await storage.addTicketTag({
          ticketId: ticket.id,
          userId: ticket.assigneeId,
          taggedById: user.id,
        } as any);
      }

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "ASSIGNED",
        fromValue: ticket.assigneeId,
        toValue: target.id,
        reason: "Forwarded to the industry mentor by the academic mentor",
      } as any);

      await storage.createNotification({
        userId: target.id,
        type: "TICKET_ASSIGNED",
        title: "A ticket was forwarded to you",
        message: `${user.name} forwarded "${ticket.title}" to you`,
        metadataJson: { ticketId: ticket.id },
      } as any);
      if (ticket.raisedById !== user.id) {
        await storage.createNotification({
          userId: ticket.raisedById,
          type: "TICKET_ASSIGNED",
          title: "Your ticket was forwarded",
          message: `"${ticket.title}" is now with your Industry Mentor (${target.name})`,
          metadataJson: { ticketId: ticket.id },
        } as any);
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Forward ticket error:", error);
      res.status(500).json({ message: "Failed to forward ticket" });
    }
  });

  // ---------------------------------------------------------------------------
  // Comments, tags, attachments, links
  // ---------------------------------------------------------------------------

  app.post("/api/tickets/:id/comments", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const body = String(req.body?.body || "").trim();
      if (!body) return res.status(400).json({ message: "Comment cannot be empty" });

      const mentions = extractMentionIds(body);
      const comment = await storage.createTicketComment({
        ticketId: ticket.id,
        authorId: user.id,
        body,
        mentionsJson: mentions,
      } as any);

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "COMMENTED",
      } as any);

      for (const userId of mentions) {
        if (userId === user.id) continue;
        await storage.createNotification({
          userId,
          type: "TICKET_COMMENTED",
          title: "You were mentioned on a ticket",
          message: `${user.name} mentioned you on "${ticket.title}"`,
          metadataJson: { ticketId: ticket.id },
        } as any);
      }

      await notifyParticipants(
        ticket.id,
        user.id,
        "TICKET_COMMENTED",
        "New comment on a ticket",
        `${user.name} commented on "${ticket.title}"`
      );

      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Create ticket comment error:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.post("/api/tickets/:id/tags", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const userId = req.body?.userId as string;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      // Same rule as the taggable list: non-admins may only tag their own
      // teammates and admins.
      if (user.role !== "ADMIN") {
        const allowed = await getTeamTaggableUsers(user.id);
        if (!allowed.some((u) => u.id === userId)) {
          return res.status(403).json({
            message: "You can only tag your own team members or admins",
          });
        }
      }

      const tag = await storage.addTicketTag({
        ticketId: ticket.id,
        userId,
        taggedById: user.id,
      } as any);

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "TAGGED",
        toValue: userId,
      } as any);

      if (userId !== user.id) {
        await storage.createNotification({
          userId,
          type: "TICKET_TAGGED",
          title: "You were tagged on a ticket",
          message: `${user.name} tagged you on "${ticket.title}"`,
          metadataJson: { ticketId: ticket.id },
        } as any);
      }

      res.status(201).json(tag);
    } catch (error: any) {
      console.error("Tag ticket error:", error);
      res.status(500).json({ message: "Failed to tag user" });
    }
  });

  app.delete("/api/tickets/:id/tags/:userId", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const removed = await storage.removeTicketTag(ticket.id, req.params.userId);
      if (removed) {
        await storage.createTicketEvent({
          ticketId: ticket.id,
          actorId: user.id,
          type: "UNTAGGED",
          toValue: req.params.userId,
        } as any);
      }
      res.json({ removed });
    } catch (error: any) {
      console.error("Untag ticket error:", error);
      res.status(500).json({ message: "Failed to remove tag" });
    }
  });

  app.post("/api/tickets/:id/attachments", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { fileName, objectKey, contentType, fileSize, commentId } = req.body || {};
      if (!fileName || !objectKey) {
        return res.status(400).json({ message: "fileName and objectKey are required" });
      }
      if (!isTicketAttachmentObjectKey(objectKey)) {
        return res.status(400).json({ message: "Invalid attachment reference" });
      }
      if (!isAllowedAttachment(fileName, contentType)) {
        return res.status(400).json({ message: "This file type is not allowed" });
      }
      const attachmentClaimError = await assertAttachmentsUnclaimed([{ objectKey }], ticket.id);
      if (attachmentClaimError) {
        return res.status(400).json({ message: attachmentClaimError });
      }

      const existing = await storage.getTicketAttachments(ticket.id);
      if (existing.length >= ATTACHMENT_MAX_FILES) {
        return res
          .status(400)
          .json({ message: `At most ${ATTACHMENT_MAX_FILES} attachments per ticket` });
      }

      const attachment = await storage.createTicketAttachment({
        ticketId: ticket.id,
        commentId: commentId ?? null,
        fileName,
        objectKey,
        contentType: contentType ?? null,
        fileSize: fileSize ?? null,
        uploadedById: user.id,
      } as any);

      res.status(201).json(attachment);
    } catch (error: any) {
      console.error("Add ticket attachment error:", error);
      res.status(500).json({ message: "Failed to attach file" });
    }
  });

  // Short-lived download URL for an attachment
  app.get("/api/tickets/:id/attachments/:attachmentId/url", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const attachments = await storage.getTicketAttachments(ticket.id);
      const attachment = attachments.find((a) => a.id === req.params.attachmentId);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });

      const { s3Storage } = await import("./s3");
      const downloadUrl = await s3Storage.getSignedDownloadURL(attachment.objectKey, 900);
      res.json({ downloadUrl, fileName: attachment.fileName });
    } catch (error: any) {
      console.error("Ticket attachment URL error:", error);
      res.status(500).json({ message: "Failed to generate download URL" });
    }
  });

  app.post("/api/tickets/:id/links", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (!(await canViewTicket(ticket, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const linkedTicketId = req.body?.linkedTicketId as string;
      if (!linkedTicketId || linkedTicketId === ticket.id) {
        return res.status(400).json({ message: "A different ticket id is required" });
      }
      const target = await storage.getTicket(linkedTicketId);
      if (!target) return res.status(404).json({ message: "Linked ticket not found" });

      const link = await storage.createTicketLink({
        ticketId: ticket.id,
        linkedTicketId,
        createdById: user.id,
      } as any);

      await storage.createTicketEvent({
        ticketId: ticket.id,
        actorId: user.id,
        type: "LINKED",
        toValue: linkedTicketId,
      } as any);

      res.status(201).json(link);
    } catch (error: any) {
      console.error("Link ticket error:", error);
      res.status(500).json({ message: "Failed to link ticket" });
    }
  });

  app.delete("/api/tickets/:id", requireRole("ADMIN"), async (req, res) => {
    try {
      const deleted = await storage.deleteTicket(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Ticket not found" });
      res.json({ message: "Ticket deleted" });
    } catch (error: any) {
      console.error("Delete ticket error:", error);
      res.status(500).json({ message: "Failed to delete ticket" });
    }
  });
}
