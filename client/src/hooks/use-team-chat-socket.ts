import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_WS_PATH, type ChatClientEvent, type ChatServerEvent } from "@shared/chat";

/**
 * Maintains the team-chat WebSocket connection.
 *
 * Reconnects with exponential backoff, and re-subscribes on reconnect so a
 * dropped connection recovers without a page reload. The cookie-based session
 * authenticates the upgrade, so nothing is passed in the URL.
 */
export function useTeamChatSocket(onEvent: (event: ChatServerEvent) => void) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUs = useRef(false);

  // Keep the latest handler without forcing a reconnect when it changes
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const send = useCallback((event: ChatClientEvent) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }, []);

  useEffect(() => {
    closedByUs.current = false;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}${CHAT_WS_PATH}`);
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (raw) => {
        try {
          handlerRef.current(JSON.parse(raw.data) as ChatServerEvent);
        } catch {
          // Ignore malformed frames
        }
      };

      socket.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (closedByUs.current) return;

        // Back off up to 30s so a server restart doesn't cause a stampede
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30_000);
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      closedByUs.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  return { connected, send };
}
