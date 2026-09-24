/**
 * Real-time transport for team chat.
 *
 * A WebSocket server is attached to the existing HTTP server in `noServer`
 * mode and only claims upgrades for CHAT_WS_PATH, so Vite's HMR socket (and
 * anything else) is left alone.
 *
 * SCALING NOTE: rooms are held in this process's memory. With more than one
 * server instance behind a load balancer, a message sent to instance A will not
 * reach a subscriber connected to instance B. Horizontal scaling needs a shared
 * pub/sub (Redis) between `broadcastToChannel` and the local fan-out below.
 */

import type { Server as HttpServer, IncomingMessage } from "http";
import type { RequestHandler } from "express";
import type { Duplex } from "stream";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { CHAT_WS_PATH, type ChatClientEvent, type ChatServerEvent } from "@shared/chat";

interface ChatSocket extends WebSocket {
  userId?: string;
  userName?: string;
  channelIds?: Set<string>;
  isAlive?: boolean;
}

/** How often connected users are re-checked against their team assignments. */
const MEMBERSHIP_SWEEP_INTERVAL_MS = 60 * 1000;

/** channelId -> connected sockets subscribed to it */
const rooms = new Map<string, Set<ChatSocket>>();

let wss: WebSocketServer | null = null;

function joinRoom(socket: ChatSocket, channelId: string) {
  let room = rooms.get(channelId);
  if (!room) {
    room = new Set();
    rooms.set(channelId, room);
  }
  room.add(socket);
  socket.channelIds?.add(channelId);
}

function leaveRoom(socket: ChatSocket, channelId: string) {
  const room = rooms.get(channelId);
  if (!room) return;
  room.delete(socket);
  if (room.size === 0) rooms.delete(channelId);
  socket.channelIds?.delete(channelId);
}

function leaveAllRooms(socket: ChatSocket) {
  for (const channelId of Array.from(socket.channelIds ?? [])) {
    leaveRoom(socket, channelId);
  }
}

function send(socket: ChatSocket, event: ChatServerEvent) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

/**
 * Fan an event out to everyone currently subscribed to a channel.
 * Called by the REST routes after they persist a change.
 */
export function broadcastToChannel(
  channelId: string,
  event: ChatServerEvent,
  excludeUserId?: string
) {
  const room = rooms.get(channelId);
  if (!room) return;
  for (const socket of room) {
    if (excludeUserId && socket.userId === excludeUserId) continue;
    send(socket, event);
  }
}

/** Online user ids in a channel, for the presence event. */
function onlineUserIds(channelId: string): string[] {
  const room = rooms.get(channelId);
  if (!room) return [];
  const ids = new Set<string>();
  for (const socket of room) {
    if (socket.userId) ids.add(socket.userId);
  }
  return Array.from(ids);
}

function broadcastPresence(channelId: string) {
  broadcastToChannel(channelId, {
    type: "presence",
    channelId,
    onlineUserIds: onlineUserIds(channelId),
  });
}

export function initTeamChatSocket(
  httpServer: HttpServer,
  sessionMiddleware: RequestHandler
) {
  if (wss) return;

  wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`).pathname;
    } catch {
      return; // Malformed URL — let another handler deal with it
    }

    // Not ours (e.g. Vite HMR): leave the socket completely untouched
    if (pathname !== CHAT_WS_PATH) return;

    // Run the express-session middleware over the upgrade request so
    // req.session is populated from the sv.session cookie.
    sessionMiddleware(req as any, {} as any, () => {
      const userId = (req as any).session?.userId as string | undefined;
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss!.handleUpgrade(req, socket, head, (ws) => {
        wss!.emit("connection", ws, req, userId);
      });
    });
  });

  wss.on("connection", async (ws: ChatSocket, _req: IncomingMessage, userId: string) => {
    ws.userId = userId;
    ws.channelIds = new Set();
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    try {
      const user = await storage.getUser(userId);
      ws.userName = user?.name ?? "Someone";

      // Subscribe to every channel the user belongs to
      const memberships = await storage.getTeamChatMembershipsByUser(userId);
      for (const membership of memberships) {
        joinRoom(ws, membership.channelId);
      }

      send(ws, {
        type: "ready",
        userId,
        channelIds: Array.from(ws.channelIds),
      });

      for (const channelId of ws.channelIds) {
        broadcastPresence(channelId);
      }
    } catch (error) {
      console.error("Chat socket connection setup failed:", error);
      send(ws, { type: "error", message: "Failed to initialise chat" });
    }

    ws.on("message", async (raw) => {
      let event: ChatClientEvent;
      try {
        event = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (event.type) {
        case "subscribe": {
          // Only allow subscribing to channels the user is a member of
          const member = await storage.getTeamChatMember(event.channelId, userId);
          if (!member) {
            send(ws, { type: "error", message: "Not a member of that channel" });
            return;
          }
          joinRoom(ws, event.channelId);
          broadcastPresence(event.channelId);
          break;
        }
        case "unsubscribe": {
          leaveRoom(ws, event.channelId);
          broadcastPresence(event.channelId);
          break;
        }
        case "typing": {
          if (!ws.channelIds?.has(event.channelId)) return;
          broadcastToChannel(
            event.channelId,
            {
              type: "typing",
              channelId: event.channelId,
              userId,
              userName: ws.userName ?? "Someone",
            },
            userId // don't echo back to the typist
          );
          break;
        }
        case "ping":
          ws.isAlive = true;
          break;
      }
    });

    ws.on("close", () => {
      const channels = Array.from(ws.channelIds ?? []);
      leaveAllRooms(ws);
      for (const channelId of channels) {
        broadcastPresence(channelId);
      }
    });

    ws.on("error", (error) => {
      console.error("Chat socket error:", error);
    });
  });

  // Drop connections that stop responding, so rooms don't leak sockets
  const heartbeat = setInterval(() => {
    for (const client of wss!.clients as Set<ChatSocket>) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      try {
        client.ping();
      } catch {
        client.terminate();
      }
    }
  }, 30_000);
  heartbeat.unref?.();

  // Bounded-delay eviction for users removed from a team while connected
  const sweep = setInterval(() => {
    sweepConnectedMemberships().catch((error) =>
      console.error("Chat membership sweep error:", error)
    );
  }, MEMBERSHIP_SWEEP_INTERVAL_MS);
  sweep.unref?.();

  console.log(`💬 Team chat WebSocket listening on ${CHAT_WS_PATH}`);
}

/** Used when a user is added to a team mid-session so they get live updates. */
export function subscribeUserToChannel(userId: string, channelId: string) {
  if (!wss) return;
  for (const client of wss.clients as Set<ChatSocket>) {
    if (client.userId === userId) {
      joinRoom(client, channelId);
    }
  }
}

/**
 * Mirror of subscribeUserToChannel. Without this, deleting the membership row
 * leaves the socket in the room and `broadcastToChannel` keeps delivering to a
 * user who has lost access.
 */
export function unsubscribeUserFromChannel(userId: string, channelId: string) {
  if (!wss) return;
  for (const client of wss.clients as Set<ChatSocket>) {
    if (client.userId === userId) {
      leaveRoom(client, channelId);
    }
  }
  broadcastPresence(channelId);
}

/**
 * Brings a user's channel memberships in line with their team assignments, in
 * both the database and the live rooms.
 *
 * Lives here rather than in chatRoutes so the periodic sweep below can reuse it
 * without a circular import.
 */
export async function reconcileUserChannels(user: {
  id: string;
  role: string;
}): Promise<{ added: string[]; removed: string[] }> {
  const added: string[] = [];
  const removed: string[] = [];

  const memberships = await storage.getTeamChatMembershipsByUser(user.id);
  const currentChannelIds = new Set(memberships.map((m) => m.channelId));

  // Admins belong to every channel — they are the common person across teams
  if (user.role === "ADMIN") {
    const channels = await storage.getTeamChatChannels();
    for (const channel of channels) {
      if (currentChannelIds.has(channel.id)) continue;
      await storage.addTeamChatMember({ channelId: channel.id, userId: user.id } as any);
      subscribeUserToChannel(user.id, channel.id);
      added.push(channel.id);
    }
    return { added, removed };
  }

  const assignments = await storage.getRoleAssignmentsByUser(user.id);
  const teamIds = Array.from(
    new Set(assignments.map((a) => a.teamId).filter((id): id is string => Boolean(id)))
  );

  const expectedChannelIds = new Set<string>();

  for (const teamId of teamIds) {
    const team = await storage.getTeam(teamId);
    if (!team) continue;

    let channel = await storage.getTeamChatChannelByTeam(teamId);
    if (!channel) {
      channel = await storage.createTeamChatChannel({ teamId, name: team.name } as any);
    }
    expectedChannelIds.add(channel.id);

    if (!currentChannelIds.has(channel.id)) {
      await storage.addTeamChatMember({ channelId: channel.id, userId: user.id } as any);
      subscribeUserToChannel(user.id, channel.id);
      added.push(channel.id);
    }
  }

  // Left the team -> loses both the DB membership and live delivery
  for (const membership of memberships) {
    if (expectedChannelIds.has(membership.channelId)) continue;
    await storage.removeTeamChatMember(membership.channelId, user.id);
    unsubscribeUserFromChannel(user.id, membership.channelId);
    removed.push(membership.channelId);
  }

  return { added, removed };
}

/**
 * Periodically re-checks every *connected* user against their team assignments.
 *
 * Without this, revocation would depend on the removed user making a request of
 * their own — someone who just leaves a tab open would keep access indefinitely.
 * Access revocation must not require the revoked party to cooperate.
 */
async function sweepConnectedMemberships() {
  if (!wss) return;

  const userIds = new Set<string>();
  for (const client of wss.clients as Set<ChatSocket>) {
    if (client.userId) userIds.add(client.userId);
  }
  if (userIds.size === 0) return;

  for (const userId of userIds) {
    try {
      const user = await storage.getUser(userId);
      if (!user) continue;
      const { removed } = await reconcileUserChannels(user);
      if (removed.length > 0) {
        console.log(
          `💬 Evicted ${userId} from ${removed.length} channel(s) they no longer belong to`
        );
      }
    } catch (error) {
      console.error(`Chat membership sweep failed for ${userId}:`, error);
    }
  }
}
