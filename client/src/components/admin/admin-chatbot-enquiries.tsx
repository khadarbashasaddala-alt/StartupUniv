import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ChatSession {
  id: string;
  created_at: string;
  messages: ChatMessage[];
}

interface ChatLead {
  id: number;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  sessions: ChatSession[];
}

function ConversationPanel({ lead }: { lead: ChatLead | null }) {
  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <MessageSquare className="h-10 w-10 opacity-30" />
        <p className="text-sm">Hover over a lead to see their conversation</p>
      </div>
    );
  }

  const allMessages = lead.sessions.flatMap((s) => s.messages);
  const userMessages = allMessages.filter((m) => m.role === "user").length;

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header */}
      <div className="bg-gradient-to-r from-primary to-primary/90 px-5 py-4 rounded-t-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-base">
              {lead.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{lead.name}</p>
            <p className="text-white/80 text-xs truncate">{lead.email}</p>
          </div>
        </div>
        <div className="flex gap-4 mt-3 text-white/70 text-xs">
          <span>{userMessages} question{userMessages !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{lead.sessions.length} session{lead.sessions.length !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span>{lead.phone}</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted">
        {allMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center mt-8">No messages yet</p>
        ) : (
          allMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-orange-500 text-white rounded-br-sm whitespace-pre-wrap"
                    : "bg-white text-foreground rounded-bl-sm shadow-sm border border-border"
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-snug">{children}</li>,
                      h3: ({ children }) => <h3 className="font-semibold text-sm mb-0.5 mt-1.5 first:mt-0">{children}</h3>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/90">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminChatbotEnquiriesPage() {
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<ChatLead | null>(null);

  const { data: leads = [], isLoading } = useQuery<ChatLead[]>({
    queryKey: ["/api/admin/chatbot-enquiries"],
    queryFn: () => apiRequest("GET", "/admin/chatbot-enquiries"),
    refetchInterval: 30000,
  });

  const filtered = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search)
  );

  const totalMessages = leads.reduce(
    (sum, l) => sum + l.sessions.reduce((s, sess) => s + sess.messages.length, 0),
    0
  );

  const todayCount = leads.filter((l) => {
    const d = new Date(l.created_at);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }).length;

  return (
    <AppLayout title="Chatbot Enquiries">
      <div className="flex flex-col h-full p-6 gap-5">
        {/* Stats row */}
        <div className="grid gap-4 grid-cols-3 shrink-0">
          <Card className="border border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">Total Enquiries</p>
              <p className="text-3xl font-bold text-foreground mt-1">{leads.length}</p>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">Total Messages</p>
              <p className="text-3xl font-bold text-foreground mt-1">{totalMessages}</p>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">Active Today</p>
              <p className="text-3xl font-bold text-foreground mt-1">{todayCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Left — leads list */}
          <div className="w-[42%] shrink-0 flex flex-col gap-3 min-h-0">
            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Card className="border border-border flex-1 overflow-hidden flex flex-col min-h-0">
              <CardHeader className="border-b border-border pb-3 pt-4 px-5 shrink-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Recent Enquiries
                  <span className="text-xs font-normal text-muted-foreground">
                    — hover to preview
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8" />
                    <p className="text-sm">
                      {search ? "No results found" : "No enquiries yet"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map((lead) => {
                      const messageCount = lead.sessions.reduce(
                        (s, sess) => s + sess.messages.length,
                        0
                      );
                      const isSelected = selectedLead?.id === lead.id;

                      return (
                        <div
                          key={lead.id}
                          className={`flex items-center gap-3 px-5 py-3.5 cursor-default transition-colors ${
                            isSelected
                              ? "bg-orange-50 border-l-2 border-l-orange-500"
                              : "hover:bg-orange-50/50 border-l-2 border-l-transparent"
                          }`}
                          onMouseEnter={() => setSelectedLead(lead)}
                        >
                          {/* Avatar */}
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center shrink-0">
                            <span className="text-white font-semibold text-sm">
                              {lead.name.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          {/* Name + email */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground text-sm truncate">
                              {lead.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                          </div>

                          {/* Message count */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge className="bg-primary/10 text-primary border-primary/30 text-xs px-2 py-0">
                              {messageCount} msg{messageCount !== 1 ? "s" : ""}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(lead.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right — conversation viewer */}
          <Card className="flex-1 border border-border overflow-hidden flex flex-col min-h-0">
            <ConversationPanel lead={selectedLead} />
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
