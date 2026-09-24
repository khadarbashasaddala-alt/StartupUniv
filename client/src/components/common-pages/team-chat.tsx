import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTeamChatSocket } from "@/hooks/use-team-chat-socket";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Loader2,
  Paperclip,
  Send,
  SmilePlus,
  X,
  Reply,
  Trash2,
  Pencil,
  Download,
  Users,
  MessageSquare,
  Circle,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  ATTACHMENT_MAX_FILES,
  isAllowedUpload,
  maxBytesForContentType,
  MESSAGE_MAX_LENGTH,
  parseMentions,
  QUICK_REACTIONS,
  STICKER_CONTENT_TYPES,
  VIDEO_CONTENT_TYPES,
  VIDEO_MAX_DURATION_SECONDS,
  type ChatMessageType,
  type ChatServerEvent,
} from "@shared/chat";

interface ChatChannel {
  id: string;
  teamId: string;
  name: string;
  memberCount: number;
  unreadCount: number;
  lastMessage: { id: string; body: string | null; type: string; createdAt: string } | null;
}

interface ChatUser {
  id: string;
  name: string;
  role: string;
}

interface ChatAttachment {
  id: string;
  fileName: string;
  contentType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

interface ChatMessage {
  id: string;
  channelId: string;
  type: ChatMessageType;
  body: string | null;
  deleted: boolean;
  editedAt: string | null;
  createdAt: string;
  sender: ChatUser | null;
  mentions: string[];
  attachments: ChatAttachment[];
  reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
  replyTo: { id: string; body: string | null; type: string; sender: ChatUser | null } | null;
}

interface PendingUpload {
  fileName: string;
  objectKey: string;
  contentType: string;
  fileSize: number;
  durationSeconds?: number;
}

function formatTime(value: string) {
  try {
    return format(new Date(value), "h:mm a");
  } catch {
    return "";
  }
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "d MMM yyyy");
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TeamChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [onlineIds, setOnlineIds] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeChannelRef = useRef<string | null>(null);
  activeChannelRef.current = activeChannelId;

  const { data: channels, isLoading: channelsLoading } = useQuery<ChatChannel[]>({
    queryKey: ["/api/chat/channels"],
  });

  const { data: members } = useQuery<ChatUser[]>({
    queryKey: [`/api/chat/channels/${activeChannelId}/members`],
    enabled: Boolean(activeChannelId),
  });

  // --- realtime -------------------------------------------------------------

  const handleSocketEvent = useCallback((event: ChatServerEvent) => {
    switch (event.type) {
      case "message:new": {
        if (event.channelId !== activeChannelRef.current) {
          // Not looking at this channel — just refresh the unread badges
          queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
          return;
        }
        setMessages((prev) =>
          prev.some((m) => m.id === event.message.id) ? prev : [...prev, event.message]
        );
        break;
      }
      case "message:edited": {
        setMessages((prev) =>
          prev.map((m) => (m.id === event.message.id ? event.message : m))
        );
        break;
      }
      case "message:deleted": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId
              ? { ...m, deleted: true, body: null, attachments: [] }
              : m
          )
        );
        break;
      }
      case "reaction:changed": {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId ? { ...m, reactions: event.reactions } : m
          )
        );
        break;
      }
      case "typing": {
        if (event.channelId !== activeChannelRef.current) return;
        setTypingUsers((prev) => ({ ...prev, [event.userId]: event.userName }));
        // Typing events aren't cancelled explicitly; expire them instead
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[event.userId];
            return next;
          });
        }, 3000);
        break;
      }
      case "presence": {
        if (event.channelId !== activeChannelRef.current) return;
        setOnlineIds(event.onlineUserIds);
        break;
      }
    }
  }, []);

  const { connected, send } = useTeamChatSocket(handleSocketEvent);

  // --- history --------------------------------------------------------------

  const loadHistory = useCallback(
    async (channelId: string, before?: string) => {
      setLoadingHistory(true);
      try {
        const params = new URLSearchParams();
        if (before) params.set("before", before);
        const data = await apiRequest(
          "GET",
          `/api/chat/channels/${channelId}/messages${params.toString() ? `?${params}` : ""}`
        );
        setHasMore(data.hasMore);
        setCursor(data.nextCursor);
        setMessages((prev) => (before ? [...data.messages, ...prev] : data.messages));
      } catch (error: any) {
        toast({ title: "Failed to load messages", description: error.message, variant: "destructive" });
      } finally {
        setLoadingHistory(false);
      }
    },
    [toast]
  );

  // Open the first channel automatically
  useEffect(() => {
    if (!activeChannelId && channels && channels.length > 0) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;
    setMessages([]);
    setCursor(null);
    setTypingUsers({});
    loadHistory(activeChannelId);
    send({ type: "subscribe", channelId: activeChannelId });

    // Clear the unread badge for the channel being read
    apiRequest("POST", `/api/chat/channels/${activeChannelId}/read`, {})
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] }))
      .catch(() => {});
  }, [activeChannelId, loadHistory, send]);

  // Keep the view pinned to the newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const activeChannel = channels?.find((c) => c.id === activeChannelId) ?? null;

  return (
    <AppLayout title="Team Chat">
      <div className="flex h-[calc(100vh-9rem)] gap-4">
        {/* Channel list */}
        <Card className="w-72 shrink-0 overflow-hidden flex flex-col">
          <div className="border-b p-4">
            <h2 className="font-semibold">Chats</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Circle
                className={`h-2 w-2 ${connected ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground text-muted-foreground"}`}
              />
              {connected ? "Connected" : "Reconnecting…"}
            </p>
          </div>
          <ScrollArea className="flex-1">
            {channelsLoading ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !channels || channels.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                You're not in a team yet. Team chats appear here once you're added to one.
              </div>
            ) : (
              <div className="p-2">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannelId(channel.id)}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      channel.id === activeChannelId ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{channel.name}</span>
                      {channel.unreadCount > 0 && channel.id !== activeChannelId && (
                        <Badge className="shrink-0">{channel.unreadCount}</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {channel.lastMessage
                        ? channel.lastMessage.body ??
                          (channel.lastMessage.type === "TEXT" ? "Message deleted" : channel.lastMessage.type.toLowerCase())
                        : "No messages yet"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Conversation */}
        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!activeChannel ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No chat selected</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <h2 className="font-semibold">{activeChannel.name}</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {activeChannel.memberCount} members
                    {onlineIds.length > 0 && ` · ${onlineIds.length} online`}
                  </p>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {hasMore && (
                  <div className="mb-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingHistory}
                      onClick={() => cursor && loadHistory(activeChannel.id, cursor)}
                    >
                      {loadingHistory && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Load earlier messages
                    </Button>
                  </div>
                )}

                <MessageList
                  messages={messages}
                  currentUserId={user?.id ?? ""}
                  channelId={activeChannel.id}
                />
                <div ref={bottomRef} />
              </ScrollArea>

              {Object.keys(typingUsers).length > 0 && (
                <div className="px-4 pb-1 text-xs italic text-muted-foreground">
                  {Object.values(typingUsers).join(", ")}{" "}
                  {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing…
                </div>
              )}

              <Composer
                channelId={activeChannel.id}
                members={members ?? []}
                onTyping={() => send({ type: "typing", channelId: activeChannel.id })}
              />
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function MessageList({
  messages,
  currentUserId,
  channelId,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  channelId: string;
}) {
  let lastDay = "";

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const day = formatDayLabel(message.createdAt);
        const showDay = day !== lastDay;
        lastDay = day;

        return (
          <div key={message.id}>
            {showDay && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  {day}
                </span>
              </div>
            )}
            <MessageBubble
              message={message}
              isOwn={message.sender?.id === currentUserId}
              channelId={channelId}
            />
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  channelId,
}: {
  message: ChatMessage;
  isOwn: boolean;
  channelId: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? "");

  const react = async (emoji: string) => {
    try {
      await apiRequest("POST", `/api/chat/messages/${message.id}/reactions`, { emoji });
    } catch (error: any) {
      toast({ title: "Failed to react", description: error.message, variant: "destructive" });
    }
  };

  const remove = async () => {
    try {
      await apiRequest("DELETE", `/api/chat/messages/${message.id}`);
    } catch (error: any) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    try {
      await apiRequest("PATCH", `/api/chat/messages/${message.id}`, { body: draft });
      setEditing(false);
    } catch (error: any) {
      toast({ title: "Failed to edit", description: error.message, variant: "destructive" });
    }
  };

  const isSticker = message.type === "STICKER";

  return (
    <div className={`group flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
      <div className={`max-w-[75%] min-w-0 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
        {!isOwn && (
          <span className="mb-0.5 text-xs font-medium text-muted-foreground">
            {message.sender?.name ?? "Unknown"}
            {message.sender?.role === "ADMIN" && (
              <Badge variant="outline" className="ml-1 text-[10px]">Admin</Badge>
            )}
          </span>
        )}

        <div
          className={
            isSticker
              ? ""
              : `rounded-2xl px-3 py-2 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`
          }
        >
          {message.replyTo && (
            <div
              className={`mb-1 rounded border-l-2 px-2 py-1 text-xs ${
                isOwn ? "border-primary-foreground/50 bg-black/10" : "border-primary bg-background/60"
              }`}
            >
              <span className="font-medium">{message.replyTo.sender?.name ?? "Unknown"}</span>
              <p className="truncate opacity-80">
                {message.replyTo.body ?? "Message deleted"}
              </p>
            </div>
          )}

          {message.deleted ? (
            <p className="text-sm italic opacity-70">This message was deleted</p>
          ) : editing ? (
            <div className="space-y-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="text-foreground"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.body && (
                <p className="whitespace-pre-wrap break-words text-sm">
                  {parseMentions(message.body).map((segment, index) =>
                    segment.type === "mention" ? (
                      <span
                        key={index}
                        className={`rounded px-1 font-medium ${
                          isOwn ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
                        }`}
                      >
                        @{segment.value}
                      </span>
                    ) : (
                      <span key={index}>{segment.value}</span>
                    )
                  )}
                </p>
              )}
              {message.attachments.map((attachment) => (
                <AttachmentView
                  key={attachment.id}
                  attachment={attachment}
                  isSticker={isSticker}
                />
              ))}
            </>
          )}

          {!message.deleted && (
            <span className="mt-1 block text-[10px] opacity-60">
              {formatTime(message.createdAt)}
              {message.editedAt && " · edited"}
            </span>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={() => react(reaction.emoji)}
                className="rounded-full border bg-background px-2 py-0.5 text-xs hover:bg-muted"
              >
                {reaction.emoji} {reaction.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!message.deleted && (
        <div className="flex items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <SmilePlus className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1">
              <div className="flex gap-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => react(emoji)}
                    className="rounded p-1 text-lg hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("chat:reply", { detail: { message, channelId } })
              )
            }
          >
            <Reply className="h-3.5 w-3.5" />
          </Button>

          {isOwn && message.body && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setDraft(message.body ?? "");
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}

          {isOwn && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function AttachmentView({
  attachment,
  isSticker,
}: {
  attachment: ChatAttachment;
  isSticker: boolean;
}) {
  const { toast } = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const contentType = (attachment.contentType ?? "").toLowerCase();
  const isImage = contentType.startsWith("image/");
  const isVideo = VIDEO_CONTENT_TYPES.includes(contentType);

  // Media needs a signed URL before it can render
  useEffect(() => {
    if (!isImage && !isVideo) return;
    let cancelled = false;
    apiRequest("GET", `/api/chat/attachments/${attachment.id}/url`)
      .then((data) => {
        if (!cancelled) setUrl(data.downloadUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [attachment.id, isImage, isVideo]);

  const download = async () => {
    try {
      const data = await apiRequest("GET", `/api/chat/attachments/${attachment.id}/url`);
      window.open(data.downloadUrl, "_blank");
    } catch (error: any) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    }
  };

  if (isSticker && url) {
    return <img src={url} alt={attachment.fileName} className="h-32 w-32 object-contain" />;
  }

  if (isImage) {
    return url ? (
      <img
        src={url}
        alt={attachment.fileName}
        className="mt-1 max-h-72 cursor-pointer rounded-lg object-cover"
        onClick={download}
      />
    ) : (
      <Skeleton className="mt-1 h-40 w-56 rounded-lg" />
    );
  }

  if (isVideo) {
    return url ? (
      <video src={url} controls className="mt-1 max-h-72 rounded-lg" />
    ) : (
      <Skeleton className="mt-1 h-40 w-56 rounded-lg" />
    );
  }

  return (
    <button
      onClick={download}
      className="mt-1 flex w-full items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-left text-sm hover:bg-muted"
    >
      <Paperclip className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-xs opacity-70">{formatBytes(attachment.fileSize)}</span>
      <Download className="h-3.5 w-3.5 shrink-0" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

function Composer({
  channelId,
  members,
  onTyping,
}: {
  channelId: string;
  members: ChatUser[];
  onTyping: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // The reply button lives on each bubble; it reaches the composer via an event
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.channelId === channelId) {
        setReplyTo(detail.message);
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("chat:reply", handler);
    return () => window.removeEventListener("chat:reply", handler);
  }, [channelId]);

  useEffect(() => {
    setReplyTo(null);
    setText("");
    setUploads([]);
  }, [channelId]);

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, members]);

  const handleTextChange = (value: string) => {
    setText(value);
    onTyping();

    // Detect an in-progress "@word" immediately before the caret
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const upToCaret = value.slice(0, caret);
    const match = upToCaret.match(/@([\w]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (member: ChatUser) => {
    const caret = textareaRef.current?.selectionStart ?? text.length;
    const upToCaret = text.slice(0, caret);
    const rest = text.slice(caret);
    const replaced = upToCaret.replace(/@([\w]*)$/, `@[${member.name}](${member.id}) `);
    setText(replaced + rest);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  /** Reads duration client-side so we can warn before a long upload. */
  const probeVideoDuration = (file: File): Promise<number | undefined> =>
    new Promise((resolve) => {
      const element = document.createElement("video");
      element.preload = "metadata";
      element.onloadedmetadata = () => {
        URL.revokeObjectURL(element.src);
        resolve(Math.round(element.duration));
      };
      element.onerror = () => resolve(undefined);
      element.src = URL.createObjectURL(file);
    });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (uploads.length + files.length > ATTACHMENT_MAX_FILES) {
      toast({
        title: "Too many files",
        description: `At most ${ATTACHMENT_MAX_FILES} per message`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const done: PendingUpload[] = [];
      for (const file of Array.from(files)) {
        if (!isAllowedUpload(file.name)) {
          toast({ title: "File type not allowed", description: file.name, variant: "destructive" });
          continue;
        }

        const limit = maxBytesForContentType(file.type);
        if (file.size > limit) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds ${Math.round(limit / (1024 * 1024))} MB`,
            variant: "destructive",
          });
          continue;
        }

        let durationSeconds: number | undefined;
        if (VIDEO_CONTENT_TYPES.includes(file.type.toLowerCase())) {
          durationSeconds = await probeVideoDuration(file);
          if (durationSeconds && durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
            toast({
              title: "Video too long",
              description: `${file.name} is ${durationSeconds}s — the limit is ${VIDEO_MAX_DURATION_SECONDS}s`,
              variant: "destructive",
            });
            continue;
          }
        }

        const { uploadUrl, objectKey } = await apiRequest(
          "POST",
          "/api/chat/attachments/upload-url",
          { fileName: file.name, fileType: file.type, fileSize: file.size }
        );

        const response = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!response.ok) throw new Error(`Upload failed for ${file.name}`);

        done.push({
          fileName: file.name,
          objectKey,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
          durationSeconds,
        });
      }
      setUploads((prev) => [...prev, ...done]);
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body && uploads.length === 0) return;

    setSending(true);
    try {
      // Device sticker keyboards paste webp images — send those as stickers so
      // they render borderless rather than as a file card.
      const isSticker =
        uploads.length > 0 &&
        uploads.every((u) => STICKER_CONTENT_TYPES.includes(u.contentType.toLowerCase())) &&
        !body;

      await apiRequest("POST", `/api/chat/channels/${channelId}/messages`, {
        body,
        replyToId: replyTo?.id,
        attachments: uploads,
        isSticker,
      });

      setText("");
      setUploads([]);
      setReplyTo(null);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/channels"] });
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t p-3">
      {replyTo && (
        <div className="mb-2 flex items-start justify-between gap-2 rounded border-l-2 border-primary bg-muted px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-medium">
              Replying to {replyTo.sender?.name ?? "Unknown"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {replyTo.body ?? "Attachment"}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="mb-2 space-y-1">
          {uploads.map((upload) => (
            <div
              key={upload.objectKey}
              className="flex items-center justify-between rounded border px-3 py-1.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{upload.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(upload.fileSize)}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() =>
                  setUploads((prev) => prev.filter((u) => u.objectKey !== upload.objectKey))
                }
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {mentionMatches.length > 0 && (
        <div className="mb-2 rounded-lg border bg-popover p-1 shadow">
          {mentionMatches.map((member) => (
            <button
              key={member.id}
              onClick={() => insertMention(member)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span>{member.name}</span>
              <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </span>
        </label>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message…  (use your keyboard's emoji and sticker picker)"
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          className="max-h-32 min-h-[2.25rem] resize-none"
        />

        <Button
          size="icon"
          disabled={sending || uploading || (!text.trim() && uploads.length === 0)}
          onClick={submit}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
