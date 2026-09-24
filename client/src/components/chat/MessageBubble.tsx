import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message } from "./types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex w-full group", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("relative", isUser ? "max-w-[82%]" : "max-w-[82%]")}>
      <div
        className={cn(
          "rounded-2xl px-3 py-2 text-sm leading-relaxed break-words",
          isUser
            ? "bg-orange-500 text-white rounded-br-sm whitespace-pre-wrap"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        )}
      >
        {message.content === "" ? (
          // Streaming placeholder dots
          <span className="inline-flex items-center gap-1 py-0.5">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        ) : isUser ? (
          message.content
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="leading-snug">{children}</li>,
              h1: ({ children }) => <h1 className="font-bold text-base mb-1 mt-2 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="font-bold text-sm mb-1 mt-2 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="font-semibold text-sm mb-0.5 mt-1.5 first:mt-0">{children}</h3>,
              code: ({ children }) => <code className="bg-gray-200 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline hover:text-orange-700">
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      {/* Copy button — only for non-empty assistant messages */}
      {!isUser && message.content !== "" && (
        <button
          onClick={handleCopy}
          className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <><Check className="w-2.5 h-2.5" /> Copied</>
          ) : (
            <><Copy className="w-2.5 h-2.5" /> Copy</>
          )}
        </button>
      )}
      </div>
    </div>
  );
}
