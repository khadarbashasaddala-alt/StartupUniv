import { useState, useRef, useCallback } from "react";
import { Message } from "@/components/chat/types";

// Dev: routes through Vite proxy (/bot/ws → localhost:4001/ws)
// Prod: set VITE_BOT_WS_URL e.g. wss://bot.startupvarsity.com
const WS_BASE_URL =
  (import.meta.env.VITE_BOT_WS_URL as string) ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/bot`;

// If no stream/end event arrives within this time after a "typing" event,
// auto-recover so the input is never permanently stuck on "..."
const TYPING_TIMEOUT_MS = 30_000;

export function useChatSocket() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const streamBufferRef = useRef<string>("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTypingTimer = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (sessionId: string) => {
      // Close stale connection before opening a new one
      if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
        wsRef.current.close();
      }

      const ws = new WebSocket(`${WS_BASE_URL}/ws/chat/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onclose = () => {
        setIsConnected(false);
        setIsTyping(false);
        clearTypingTimer();
      };

      ws.onerror = () => {
        setIsConnected(false);
        setIsTyping(false);
        clearTypingTimer();
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string) as {
          type: string;
          content: string;
        };

        if (data.type === "message") {
          // Full welcome message or standalone reply (not streamed)
          clearTypingTimer();
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: data.content, timestamp: new Date() },
          ]);
        } else if (data.type === "typing") {
          // Agent is thinking — create an empty streaming placeholder
          setIsTyping(true);
          streamBufferRef.current = "";
          streamIdRef.current = crypto.randomUUID();
          setMessages((prev) => [
            ...prev,
            { id: streamIdRef.current!, role: "assistant", content: "", timestamp: new Date() },
          ]);

          // Safety net: auto-recover if no response arrives within 30s
          clearTypingTimer();
          const currentStreamId = streamIdRef.current;
          typingTimerRef.current = setTimeout(() => {
            setIsTyping(false);
            streamIdRef.current = null;
            streamBufferRef.current = "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentStreamId
                  ? { ...m, content: "Sorry, it's taking too long. Please try again." }
                  : m
              )
            );
          }, TYPING_TIMEOUT_MS);
        } else if (data.type === "stream") {
          // Token arrived — clear safety timer, append to the streaming placeholder
          clearTypingTimer();
          setIsTyping(false);
          streamBufferRef.current += data.content;
          const id = streamIdRef.current;
          if (id) {
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, content: streamBufferRef.current } : m))
            );
          }
        } else if (data.type === "end") {
          clearTypingTimer();
          setIsTyping(false);
          streamIdRef.current = null;
          streamBufferRef.current = "";
        } else if (data.type === "error") {
          clearTypingTimer();
          setIsTyping(false);
          streamIdRef.current = null;
          streamBufferRef.current = "";
          setMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "assistant", content: data.content, timestamp: new Date() },
          ]);
        }
      };
    },
    [clearTypingTimer]
  );

  const sendMessage = useCallback((content: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() },
    ]);
    wsRef.current.send(JSON.stringify({ content }));
  }, []);

  const disconnect = useCallback(() => {
    clearTypingTimer();
    wsRef.current?.close();
  }, [clearTypingTimer]);

  return { messages, isConnected, isTyping, connect, sendMessage, disconnect };
}
