import { useEffect, useRef, useState, useCallback } from "react";
import { Send, X, Bot, ChevronDown, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LeadForm } from "./LeadForm";
import { MessageBubble } from "./MessageBubble";
import { useChatSocket } from "@/hooks/useChatSocket";

const MAX_CHARS = 500;

type Chip = { emoji: string; label: string };

const INITIAL_CHIPS: Chip[] = [
  { emoji: "📋", label: "View plans & pricing" },
  { emoji: "🚀", label: "How do I apply?" },
  { emoji: "📅", label: "About the program" },
  { emoji: "💰", label: "Funding details" },
  { emoji: "👤", label: "Who can join?" },
  { emoji: "📞", label: "Contact the team" },
];

function getContextualChips(lastBotMsg: string): Chip[] {
  const m = lastBotMsg.toLowerCase();

  if (m.includes("founder plan") || m.includes("co-founder plan") || m.includes("intern plan") ||
      m.includes("₹5,00,000") || m.includes("₹3,00,000") || m.includes("₹1,50,000") || m.includes("₹1,00,000")) {
    return [
      { emoji: "💎", label: "Tell me about Founder Plan" },
      { emoji: "🤝", label: "Tell me about Co-Founder Plan" },
      { emoji: "🎓", label: "Tell me about Intern Plan" },
    ];
  }

  if (m.includes("equity") || m.includes("stipend") || m.includes("40%") || m.includes("20%") || m.includes("5%")) {
    return [
      { emoji: "🚀", label: "How do I apply?" },
      { emoji: "📅", label: "About the program" },
      { emoji: "📞", label: "Contact the team" },
    ];
  }

  if (m.includes("apply") || m.includes("application") || m.includes("register") || m.includes("enroll")) {
    return [
      { emoji: "📋", label: "View plans & pricing" },
      { emoji: "💰", label: "Funding details" },
      { emoji: "📞", label: "Contact the team" },
    ];
  }

  if (m.includes("phase") || m.includes("week") || m.includes("4 month") || m.includes("january") ||
      m.includes("cohort") || m.includes("bangalore")) {
    return [
      { emoji: "💰", label: "Funding details" },
      { emoji: "📋", label: "View plans & pricing" },
      { emoji: "👤", label: "Who can join?" },
    ];
  }

  if (m.includes("fund") || m.includes("seed") || m.includes("crore") || m.includes("lakh") ||
      m.includes("₹10") || m.includes("₹7.5") || m.includes("investor")) {
    return [
      { emoji: "📋", label: "View plans & pricing" },
      { emoji: "🚀", label: "How do I apply?" },
      { emoji: "👤", label: "Who can join?" },
    ];
  }

  if (m.includes("who can") || m.includes("visionary") || m.includes("professional") ||
      m.includes("intern") || m.includes("student") || m.includes("founder")) {
    return [
      { emoji: "📋", label: "View plans & pricing" },
      { emoji: "🚀", label: "How do I apply?" },
      { emoji: "💰", label: "Funding details" },
    ];
  }

  if (m.includes("contact") || m.includes("email") || m.includes("phone") || m.includes("whatsapp")) {
    return [
      { emoji: "🚀", label: "How do I apply?" },
      { emoji: "📋", label: "View plans & pricing" },
      { emoji: "📅", label: "About the program" },
    ];
  }

  // Default follow-ups — show all initial chips when no specific context found
  return INITIAL_CHIPS;
}

interface ChatWindowProps {
  onClose: () => void;
}

export function ChatWindow({ onClose }: ChatWindowProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [input, setInput] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isConnected, isTyping, connect, sendMessage, disconnect } =
    useChatSocket();

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 150) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
  }, []);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Focus input after session starts
  useEffect(() => {
    if (sessionId) inputRef.current?.focus();
  }, [sessionId]);

  // Clean up WS on unmount
  useEffect(() => () => disconnect(), [disconnect]);

  const handleLeadSuccess = (sid: string, name: string) => {
    setSessionId(sid);
    setLeadName(name);
    connect(sid);
  };

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || !isConnected || msg.length > MAX_CHARS) return;
    sendMessage(msg);
    setInput("");
  };

  const handleQuickReply = (label: string) => {
    if (!isConnected) return;
    sendMessage(label);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Determine which chips to show:
  // - Show when connected and last message is a completed assistant reply (not streaming)
  // - Hide while user message is pending (bot is thinking)
  const lastMsg = messages[messages.length - 1];
  const botReplied = lastMsg?.role === "assistant" && lastMsg.content !== "";
  const noMessages = messages.length === 0;
  const showChips = isConnected && !isTyping && (noMessages || botReplied);

  const lastBotContent = messages.filter((m) => m.role === "assistant").pop()?.content ?? "";
  const chips = getContextualChips(lastBotContent);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-orange-500 text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Vasty</p>
            <p className="text-[10px] text-orange-100 leading-tight">
              {sessionId
                ? isConnected
                  ? "● Online"
                  : "Connecting…"
                : "StartUpVarsity AI"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20 h-7 w-7"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body */}
      {!sessionId ? (
        <LeadForm onSuccess={handleLeadSuccess} />
      ) : (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-2.5 min-h-0 relative"
          >
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && messages[messages.length - 1]?.content !== "" && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Scroll-to-bottom button */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-28 right-4 z-10 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-orange-500 hover:border-orange-300 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Connection lost banner */}
          {sessionId && !isConnected && (
            <div className="px-3 py-2 bg-yellow-50 border-t border-yellow-100 flex items-center justify-between shrink-0 gap-2">
              <span className="flex items-center gap-1.5 text-xs text-yellow-700">
                <WifiOff className="w-3 h-3" /> Connection lost
              </span>
              <button
                onClick={() => connect(sessionId)}
                className="text-xs text-orange-600 font-medium hover:underline shrink-0"
              >
                Reconnect
              </button>
            </div>
          )}

          {/* Contextual quick-reply chips */}
          {showChips && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 shrink-0">
              {chips.map((qr) => (
                <button
                  key={qr.label}
                  onClick={() => handleQuickReply(qr.label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-medium transition-colors"
                >
                  <span>{qr.emoji}</span>
                  <span>{qr.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input bar */}
          <div className="px-3 py-2.5 border-t border-gray-100 flex flex-col gap-1 shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Ask me anything…" : "Connecting…"}
                className="h-9 text-sm flex-1"
                disabled={!isConnected}
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0 bg-orange-500 hover:bg-orange-600"
                onClick={handleSend}
                disabled={!isConnected || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {input.length > MAX_CHARS * 0.8 && (
              <p className={`text-[10px] text-right pr-11 ${input.length >= MAX_CHARS ? "text-red-500" : "text-gray-400"}`}>
                {input.length}/{MAX_CHARS}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
