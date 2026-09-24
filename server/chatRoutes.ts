import type { Express, Request, RequestHandler } from "express";
import { storage } from "./storage";
import { broadcastToChannel, reconcileUserChannels } from "./chatSocket";
import {
  ATTACHMENT_MAX_FILES,
  extractMentionIds,
  HISTORY_PAGE_SIZE,
  isAllowedUpload,
  maxBytesForContentType,
  MESSAGE_MAX_LENGTH,
  messageTypeForContentType,
  sanitizeFileName,
} from "@shared/chat";
import type { TeamChatMessage, User } from "@shared/schema";

interface ChatRouteDeps {
  requireAuth: RequestHandler;
}

const actor = (req: Request): User => (req as any).user as User;

/**
 * Public shape of a user inside chat. Deliberately omits phone and email —
 * chat must never expose contact numbers.
 */
function publicUser(user: User | undefined | null) {
  if (!user) return null;
  return { id: user.id, name: user.name, role: user.role };
}

/**
 * Ensures every team has a channel, so admins have something to join.
 *
 * Only walks cohorts when a team is actually missing a channel, so the common
 * case is a single query rather than cohorts x teams on every request.
 */
async function ensureChannelsForAllTeams(): Promise<void> {
  const channels = await storage.getTeamChatChannels();
  const covered = new Set(channels.map((c) => c.teamId));

  const cohorts = await storage.getCohorts();
  const allTeams = (
    await Promise.all(cohorts.map((cohort) => storage.getTeamsByCohort(cohort.id)))
  ).flat();

  const missing = allTeams.filter((team) => !covered.has(team.id));
  for (const team of missing) {
    await storage.createTeamChatChannel({ teamId: team.id, name: team.name } as any);
  }
}

/** Expands raw message rows into the shape the client renders. */
async function serializeMessages(messages: TeamChatMessage[]) {
  if (messages.length === 0) return [];

  const ids = messages.map((m) => m.id);
  const [attachments, reactions] = await Promise.all([
    storage.getTeamChatAttachmentsByMessages(ids),
    storage.getTeamChatReactionsByMessages(ids),
  ]);

  // Replied-to messages may fall outside this page, so fetch them explicitly
  const replyIds = Array.from(
    new Set(messages.map((m) => m.replyToId).filter((id): id is string => Boolean(id)))
  );
  const replyTargets = await storage.getTeamChatMessagesByIds(replyIds);

  const allUsers = await storage.getUsers();
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  return messages.map((message) => {
    const messageReactions = reactions.filter((r) => r.messageId === message.id);

    // Group reactions by emoji so the client renders "👍 3" rather than 3 chips
    const grouped = new Map<string, { emoji: string; count: number; userIds: string[] }>();
    for (const reaction of messageReactions) {
      const entry = grouped.get(reaction.emoji) ?? {
        emoji: reaction.emoji,
        count: 0,
        userIds: [],
      };
      entry.count += 1;
      entry.userIds.push(reaction.userId);
      grouped.set(reaction.emoji, entry);
    }

    const replyTo = message.replyToId
      ? replyTargets.find((t) => t.id === message.replyToId)
      : null;

    const isDeleted = Boolean(message.deletedAt);

    return {
      id: message.id,
      channelId: message.channelId,
      type: message.type,
      // Deleted messages keep their slot in the thread but lose their content
      body: isDeleted ? null : message.body,
      deleted: isDeleted,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
      sender: publicUser(userById.get(message.senderId ?? "")),
      mentions: (message.mentionsJson as string[] | null) ?? [],
      attachments: isDeleted ? [] : attachments.filter((a) => a.messageId === message.id),
      reactions: Array.from(grouped.values()),
      replyTo: replyTo
        ? {
            id: replyTo.id,
            body: replyTo.deletedAt ? null : replyTo.body,
            type: replyTo.type,
            sender: publicUser(userById.get(replyTo.senderId ?? "")),
          }
        : null,
    };
  });
}

async function requireMembership(channelId: string, user: User) {
  const member = await storage.getTeamChatMember(channelId, user.id);
  return member ?? null;
}

export function registerChatRoutes(app: Express, deps: ChatRouteDeps) {
  const { requireAuth } = deps;

  // -------------------------------------------------------------------------
  // Channels
  // -------------------------------------------------------------------------

  app.get("/api/chat/channels", requireAuth, async (req, res) => {
    try {
      const user = actor(req);

      if (user.role === "ADMIN") await ensureChannelsForAllTeams();
      await reconcileUserChannels(user);

      const memberships = await storage.getTeamChatMembershipsByUser(user.id);
      const channels = await Promise.all(
        memberships.map(async (membership) => {
          const channel = await storage.getTeamChatChannel(membership.channelId);
          if (!channel) return null;

          const [lastMessage, unreadCount, members] = await Promise.all([
            storage.getLastTeamChatMessage(channel.id),
            storage.getTeamChatUnreadCount(channel.id, membership.lastReadAt),
            storage.getTeamChatMembers(channel.id),
          ]);

          return {
            id: channel.id,
            teamId: channel.teamId,
            name: channel.name,
            memberCount: members.length,
            unreadCount,
            mutedUntil: membership.mutedUntil,
            lastMessage: lastMessage
              ? {
                  id: lastMessage.id,
                  body: lastMessage.deletedAt ? null : lastMessage.body,
                  type: lastMessage.type,
                  createdAt: lastMessage.createdAt,
                }
              : null,
          };
        })
      );

      const visible = channels.filter(Boolean) as any[];
      visible.sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      res.json(visible);
    } catch (error: any) {
      console.error("List chat channels error:", error);
      res.status(500).json({ message: "Failed to load chats" });
    }
  });

  // Members of a channel — also powers the @mention picker
  app.get("/api/chat/channels/:id/members", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      if (!(await requireMembership(req.params.id, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const members = await storage.getTeamChatMembers(req.params.id);
      const allUsers = await storage.getUsers();
      const userById = new Map(allUsers.map((u) => [u.id, u]));

      res.json(
        members
          .map((member) => publicUser(userById.get(member.userId)))
          .filter(Boolean)
      );
    } catch (error: any) {
      console.error("List chat members error:", error);
      res.status(500).json({ message: "Failed to load members" });
    }
  });

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  // Cursor-paginated history. `before` is an ISO timestamp from the oldest
  // message the client already holds.
  app.get("/api/chat/channels/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      if (!(await requireMembership(req.params.id, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const before = req.query.before ? new Date(String(req.query.before)) : undefined;
      const limit = Math.min(Number(req.query.limit) || HISTORY_PAGE_SIZE, 100);

      const rows = await storage.getTeamChatMessages(req.params.id, { before, limit });
      const serialized = await serializeMessages(rows);

      res.json({
        // Reversed so the client can append straight to a bottom-anchored list
        messages: serialized.reverse(),
        hasMore: rows.length === limit,
        nextCursor: rows.length > 0 ? rows[rows.length - 1].createdAt : null,
      });
    } catch (error: any) {
      console.error("Load chat messages error:", error);
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post("/api/chat/channels/:id/messages", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      if (!(await requireMembership(req.params.id, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { body, replyToId, attachments, isSticker } = req.body || {};
      const text = typeof body === "string" ? body.trim() : "";
      const files = Array.isArray(attachments) ? attachments : [];

      if (!text && files.length === 0) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }
      if (text.length > MESSAGE_MAX_LENGTH) {
        return res
          .status(400)
          .json({ message: `Message exceeds ${MESSAGE_MAX_LENGTH} characters` });
      }
      if (files.length > ATTACHMENT_MAX_FILES) {
        return res
          .status(400)
          .json({ message: `At most ${ATTACHMENT_MAX_FILES} attachments per message` });
      }

      // A reply must point at a message in the same channel
      if (replyToId) {
        const target = await storage.getTeamChatMessage(replyToId);
        if (!target || target.channelId !== req.params.id) {
          return res.status(400).json({ message: "Invalid reply target" });
        }
      }

      const firstFile = files[0];
      const type = firstFile
        ? messageTypeForContentType(firstFile.contentType, Boolean(isSticker))
        : "TEXT";

      const message = await storage.createTeamChatMessage({
        channelId: req.params.id,
        senderId: user.id,
        type,
        body: text || null,
        replyToId: replyToId || null,
        mentionsJson: extractMentionIds(text),
      } as any);

      for (const file of files) {
        if (!file?.objectKey || !file?.fileName) continue;
        if (!isAllowedUpload(file.fileName, file.contentType)) continue;
        await storage.createTeamChatAttachment({
          messageId: message.id,
          fileName: file.fileName,
          objectKey: file.objectKey,
          contentType: file.contentType ?? null,
          fileSize: file.fileSize ?? null,
          width: file.width ?? null,
          height: file.height ?? null,
          durationSeconds: file.durationSeconds ?? null,
        } as any);
      }

      const [serialized] = await serializeMessages([message]);
      broadcastToChannel(req.params.id, {
        type: "message:new",
        channelId: req.params.id,
        message: serialized,
      });

      // Notify @mentioned members who aren't the sender
      for (const mentionedId of extractMentionIds(text)) {
        if (mentionedId === user.id) continue;
        try {
          await storage.createNotification({
            userId: mentionedId,
            type: "CHAT_MENTION",
            title: "You were mentioned in team chat",
            message: `${user.name} mentioned you`,
            metadataJson: { channelId: req.params.id, messageId: message.id },
          } as any);
        } catch (error) {
          console.error("Chat mention notification failed:", error);
        }
      }

      res.status(201).json(serialized);
    } catch (error: any) {
      console.error("Send chat message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.patch("/api/chat/messages/:id", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const message = await storage.getTeamChatMessage(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });
      if (message.senderId !== user.id) {
        return res.status(403).json({ message: "You can only edit your own messages" });
      }
      if (message.deletedAt) {
        return res.status(400).json({ message: "This message was deleted" });
      }

      const text = String(req.body?.body ?? "").trim();
      if (!text) return res.status(400).json({ message: "Message cannot be empty" });
      if (text.length > MESSAGE_MAX_LENGTH) {
        return res
          .status(400)
          .json({ message: `Message exceeds ${MESSAGE_MAX_LENGTH} characters` });
      }

      const updated = await storage.updateTeamChatMessage(message.id, {
        body: text,
        mentionsJson: extractMentionIds(text),
        editedAt: new Date(),
      } as any);

      const [serialized] = await serializeMessages([updated!]);
      broadcastToChannel(message.channelId, {
        type: "message:edited",
        channelId: message.channelId,
        message: serialized,
      });

      res.json(serialized);
    } catch (error: any) {
      console.error("Edit chat message error:", error);
      res.status(500).json({ message: "Failed to edit message" });
    }
  });

  app.delete("/api/chat/messages/:id", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const message = await storage.getTeamChatMessage(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });

      // Sender can delete their own; admins can remove anything (moderation)
      const isOwner = message.senderId === user.id;
      if (!isOwner && user.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.updateTeamChatMessage(message.id, {
        deletedAt: new Date(),
        deletedForEveryone: true,
        body: null,
      } as any);

      broadcastToChannel(message.channelId, {
        type: "message:deleted",
        channelId: message.channelId,
        messageId: message.id,
        forEveryone: true,
      });

      res.json({ deleted: true });
    } catch (error: any) {
      console.error("Delete chat message error:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // -------------------------------------------------------------------------
  // Reactions
  // -------------------------------------------------------------------------

  // Toggles: reacting with an emoji you already used removes it
  app.post("/api/chat/messages/:id/reactions", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const message = await storage.getTeamChatMessage(req.params.id);
      if (!message) return res.status(404).json({ message: "Message not found" });
      if (!(await requireMembership(message.channelId, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const emoji = String(req.body?.emoji ?? "").trim();
      if (!emoji || emoji.length > 16) {
        return res.status(400).json({ message: "Invalid emoji" });
      }

      const created = await storage.addTeamChatReaction({
        messageId: message.id,
        userId: user.id,
        emoji,
      } as any);

      if (!created) {
        await storage.removeTeamChatReaction(message.id, user.id, emoji);
      }

      const [serialized] = await serializeMessages([message]);
      broadcastToChannel(message.channelId, {
        type: "reaction:changed",
        channelId: message.channelId,
        messageId: message.id,
        reactions: serialized.reactions,
      });

      res.json({ reactions: serialized.reactions });
    } catch (error: any) {
      console.error("React to chat message error:", error);
      res.status(500).json({ message: "Failed to react" });
    }
  });

  // -------------------------------------------------------------------------
  // Read state
  // -------------------------------------------------------------------------

  app.post("/api/chat/channels/:id/read", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      if (!(await requireMembership(req.params.id, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const lastReadAt = new Date();
      await storage.updateTeamChatMember(req.params.id, user.id, { lastReadAt } as any);

      broadcastToChannel(req.params.id, {
        type: "read",
        channelId: req.params.id,
        userId: user.id,
        lastReadAt: lastReadAt.toISOString(),
      });

      res.json({ lastReadAt });
    } catch (error: any) {
      console.error("Mark chat read error:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------

  app.post("/api/chat/attachments/upload-url", requireAuth, async (req, res) => {
    try {
      const { fileName, fileType, fileSize } = req.body || {};
      if (!fileName) return res.status(400).json({ message: "File name is required" });
      if (!isAllowedUpload(fileName, fileType)) {
        return res.status(400).json({ message: "This file type is not allowed" });
      }

      // fileSize is required, not optional: when it was optional a client could
      // omit it (or send a string) and skip the cap entirely, and the presigned
      // PUT carries no size condition of its own.
      if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
        return res
          .status(400)
          .json({ message: "A numeric fileSize is required to request an upload URL" });
      }

      const limit = maxBytesForContentType(fileType);
      if (fileSize > limit) {
        return res.status(400).json({
          message: `File exceeds the ${Math.round(limit / (1024 * 1024))} MB limit for this type`,
        });
      }

      // Sanitised so a name containing ../ or a leading / cannot escape the prefix
      const safeName = sanitizeFileName(fileName);
      if (!safeName) return res.status(400).json({ message: "Invalid file name" });

      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const objectKey = `team-chat/${fileId}/${safeName}`;
      const contentType = fileType || "application/octet-stream";

      const { s3Storage } = await import("./s3");
      const signedURL = await s3Storage.getSignedUploadURL(objectKey, contentType, 900);

      res.json({ uploadUrl: signedURL, objectKey, fileId });
    } catch (error: any) {
      console.error("Chat upload URL error:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.get("/api/chat/attachments/:id/url", requireAuth, async (req, res) => {
    try {
      const user = actor(req);
      const attachment = await storage.getTeamChatAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });

      const message = await storage.getTeamChatMessage(attachment.messageId);
      if (!message) return res.status(404).json({ message: "Message not found" });
      if (!(await requireMembership(message.channelId, user))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { s3Storage } = await import("./s3");
      const downloadUrl = await s3Storage.getSignedDownloadURL(attachment.objectKey, 900);
      res.json({ downloadUrl, fileName: attachment.fileName });
    } catch (error: any) {
      console.error("Chat attachment URL error:", error);
      res.status(500).json({ message: "Failed to generate download URL" });
    }
  });
}
