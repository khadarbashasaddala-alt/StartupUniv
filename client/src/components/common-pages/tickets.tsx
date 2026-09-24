import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Loader2,
  Plus,
  Paperclip,
  MessageSquare,
  Users,
  History,
  ArrowUpCircle,
  ArrowRightCircle,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Link2,
  X,
  Download,
  Settings2,
} from "lucide-react";
import { format } from "date-fns";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  CATEGORY_LABELS,
  isAllowedAttachment,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type TicketCategory,
  type TicketPriority,
} from "@shared/tickets";

interface TicketListItem {
  id: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: "OPEN" | "CLOSED" | "REOPENED";
  category: TicketCategory;
  cohortId: string | null;
  raisedById: string;
  assigneeId: string | null;
  slaDueAt: string | null;
  slaBreached: boolean;
  reopenCount: number;
  createdAt: string;
  tagCount: number;
  commentCount: number;
  attachmentCount: number;
}

interface PublicUser {
  id: string;
  name: string;
  role: string;
}

interface TicketDetail extends TicketListItem {
  raisedBy: PublicUser | null;
  assignee: PublicUser | null;
  forwardTo: PublicUser | null;
  closedBy: PublicUser | null;
  closeReason: string | null;
  closedAt: string | null;
  tags: Array<{ id: string; userId: string; user: PublicUser | null }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: PublicUser | null;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number | null;
    contentType: string | null;
  }>;
  events: Array<{
    id: string;
    type: string;
    fromValue: string | null;
    toValue: string | null;
    reason: string | null;
    createdAt: string;
    actor: PublicUser | null;
  }>;
  links: Array<{ id: string; ticketId: string; linkedTicketId: string }>;
  permissions: {
    canClose: boolean;
    canReopen: boolean;
    canEscalate: boolean;
    canEdit: boolean;
    canForward: boolean;
  };
}

interface TaggableUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const priorityStyles: Record<TicketPriority, string> = {
  HOT: "bg-red-500/15 text-red-600 border-red-500/30",
  WARM: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  COLD: "bg-sky-500/15 text-sky-600 border-sky-500/30",
};

const statusStyles: Record<string, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  REOPENED: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

const eventLabels: Record<string, string> = {
  CREATED: "created the ticket",
  ASSIGNED: "changed the assignee",
  ESCALATED: "escalated the ticket",
  AUTO_ESCALATED: "was auto-escalated by the system",
  CLOSED: "closed the ticket",
  REOPENED: "reopened the ticket",
  PRIORITY_CHANGED: "changed the priority",
  TAGGED: "tagged a teammate",
  UNTAGGED: "removed a tag",
  COMMENTED: "commented",
  LINKED: "linked another ticket",
};

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "d MMM yyyy, h:mm a");
  } catch {
    return "—";
  }
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [scope, setScope] = useState<"all" | "raised" | "assigned">("all");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const listPath = useMemo(() => {
    const params = new URLSearchParams();
    if (scope !== "all") params.set("scope", scope);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    const qs = params.toString();
    return `/api/tickets${qs ? `?${qs}` : ""}`;
  }, [scope, statusFilter, priorityFilter, categoryFilter]);

  const { data: tickets, isLoading } = useQuery<TicketListItem[]>({
    queryKey: [listPath],
    enabled: !selectedTicketId,
  });

  if (selectedTicketId) {
    return (
      <TicketDetailView
        ticketId={selectedTicketId}
        onBack={() => setSelectedTicketId(null)}
        listPath={listPath}
      />
    );
  }

  return (
    <AppLayout title="Tickets">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tickets</h1>
            <p className="text-muted-foreground">
              Raise an issue, tag your teammates and track it to closure
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "ADMIN" && <ConfigureSlaDialog />}
            <CreateTicketDialog listPath={listPath} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="raised">Raised by me</TabsTrigger>
              <TabsTrigger value="assigned">Assigned to me</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="REOPENED">Reopened</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {TICKET_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {TICKET_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !tickets || tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">No tickets yet</p>
              <p className="text-sm text-muted-foreground">
                Raise the first ticket to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium truncate">{ticket.title}</span>
                        <Badge variant="outline" className={priorityStyles[ticket.priority]}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                        <Badge variant="outline" className={statusStyles[ticket.status]}>
                          {ticket.status === "REOPENED" ? "Reopened" : ticket.status === "OPEN" ? "Open" : "Closed"}
                        </Badge>
                        {ticket.slaBreached && ticket.status !== "CLOSED" && (
                          <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            SLA breached
                          </Badge>
                        )}
                        {ticket.reopenCount > 0 && (
                          <Badge variant="outline">
                            Reopened {ticket.reopenCount}×
                          </Badge>
                        )}
                      </div>
                      {ticket.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {ticket.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                        <span>{CATEGORY_LABELS[ticket.category]}</span>
                        <span>Raised {formatDateTime(ticket.createdAt)}</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {ticket.tagCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {ticket.commentCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" /> {ticket.attachmentCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Configure SLA (admin only)
// ---------------------------------------------------------------------------

/**
 * One button that lets an admin fix how many hours a ticket may sit at each
 * priority before it auto-escalates. Only touches /api/tickets/sla-settings —
 * everything else about tickets is unchanged, and existing open tickets keep
 * whatever deadline they already had.
 */
function ConfigureSlaDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<Record<TicketPriority, string>>({
    HOT: "",
    WARM: "",
    COLD: "",
  });

  const { data: slaSettings, isLoading } = useQuery<Record<TicketPriority, number>>({
    queryKey: ["/api/tickets/sla-settings"],
    enabled: open,
  });

  useEffect(() => {
    if (slaSettings) {
      setHours({
        HOT: String(slaSettings.HOT ?? ""),
        WARM: String(slaSettings.WARM ?? ""),
        COLD: String(slaSettings.COLD ?? ""),
      });
    }
  }, [slaSettings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<TicketPriority, number>) =>
      apiRequest("PUT", "/api/tickets/sla-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/sla-settings"] });
      toast({ title: "SLA hours updated" });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update SLA hours",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const parsed: Partial<Record<TicketPriority, number>> = {};
    for (const p of TICKET_PRIORITIES) {
      const value = Number(hours[p]);
      if (!Number.isFinite(value) || value <= 0) {
        toast({
          title: "Invalid hours",
          description: `${PRIORITY_LABELS[p]} priority needs a positive number of hours`,
          variant: "destructive",
        });
        return;
      }
      parsed[p] = value;
    }
    saveMutation.mutate(parsed as Record<TicketPriority, number>);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2 className="h-4 w-4 mr-2" />
          Configure SLA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Priority SLA</DialogTitle>
          <DialogDescription>
            Hours a ticket may sit at each priority before it auto-escalates
            to the next role. Saving only affects tickets going forward —
            tickets already open keep their current deadline.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {TICKET_PRIORITIES.map((p) => (
              <div key={p} className="space-y-2">
                <Label htmlFor={`sla-${p}`}>{PRIORITY_LABELS[p]} priority (hours)</Label>
                <Input
                  id={`sla-${p}`}
                  type="number"
                  min={1}
                  value={hours[p]}
                  onChange={(e) =>
                    setHours((prev) => ({ ...prev, [p]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

interface PendingAttachment {
  fileName: string;
  objectKey: string;
  contentType: string;
  fileSize: number;
}

function CreateTicketDialog({ listPath }: { listPath: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("WARM");
  const [category, setCategory] = useState<TicketCategory>("OTHER");
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: taggable } = useQuery<TaggableUser[]>({
    queryKey: ["/api/tickets/taggable-users"],
    enabled: open,
  });

  const reset = () => {
    setTitle("");
    setDescription("");
    setPriority("WARM");
    setCategory("OTHER");
    setTaggedUserIds([]);
    setAssigneeId("");
    setAttachments([]);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tickets", data),
    onSuccess: (created: any) => {
      queryClient.invalidateQueries({ queryKey: [listPath] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] });
      // When the academic-mentor gate rerouted the ticket, say so — the learner
      // picked an industry mentor and should not be surprised by who holds it.
      toast({
        title: "Ticket raised",
        description: created?.routingMessage ?? undefined,
        duration: created?.routingMessage ? 9000 : undefined,
      });
      reset();
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to raise ticket",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > ATTACHMENT_MAX_FILES) {
      toast({
        title: "Too many files",
        description: `At most ${ATTACHMENT_MAX_FILES} attachments per ticket`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const uploaded: PendingAttachment[] = [];
      for (const file of Array.from(files)) {
        if (!isAllowedAttachment(file.name)) {
          toast({
            title: "File type not allowed",
            description: file.name,
            variant: "destructive",
          });
          continue;
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB`,
            variant: "destructive",
          });
          continue;
        }

        const { uploadUrl, objectKey } = await apiRequest(
          "POST",
          "/api/tickets/attachments/upload-url",
          { fileName: file.name, fileType: file.type, fileSize: file.size }
        );

        const putResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putResponse.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        uploaded.push({
          fileName: file.name,
          objectKey,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (userId: string) => {
    setTaggedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Raise Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Raise a Ticket</DialogTitle>
          <DialogDescription>
            Describe the issue and tag whoever needs to see it
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticket-title">Title *</Label>
            <Input
              id="ticket-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, what you expected, anything you already tried"
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assigneeId || "none"} onValueChange={(v) => setAssigneeId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(taggable ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tag teammates</Label>
            <p className="text-sm text-muted-foreground">
              Your team members, plus admins
            </p>
            {!taggable || taggable.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border p-3">
                Nobody available to tag yet — this appears once members are assigned to
                your team.
              </p>
            ) : (
              <ScrollArea className="h-40 rounded-lg border p-2">
                <div className="space-y-1">
                  {taggable.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={taggedUserIds.includes(u.id)}
                        onChange={() => toggleTag(u.id)}
                      />
                      <span className="flex-1">{u.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {u.role}
                      </Badge>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-files">Attachments</Label>
            <p className="text-sm text-muted-foreground">
              PDFs, images, spreadsheets and documents. Up to {ATTACHMENT_MAX_FILES} files,{" "}
              {Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB each.
            </p>
            <Input
              id="ticket-files"
              type="file"
              multiple
              disabled={uploading}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {uploading && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </p>
            )}
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((file) => (
                  <div
                    key={file.objectKey}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate">{file.fileName}</span>
                      <span className="text-muted-foreground">{formatBytes(file.fileSize)}</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((f) => f.objectKey !== file.objectKey)
                        )
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || createMutation.isPending || uploading}
            onClick={() =>
              createMutation.mutate({
                title,
                description,
                priority,
                category,
                assigneeId: assigneeId || undefined,
                taggedUserIds,
                attachments,
              })
            }
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Raise Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function TicketDetailView({
  ticketId,
  onBack,
  listPath,
}: {
  ticketId: string;
  onBack: () => void;
  listPath: string;
}) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [actionDialog, setActionDialog] = useState<"close" | "reopen" | "escalate" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionFiles, setActionFiles] = useState<File[]>([]);
  const [actionUploading, setActionUploading] = useState(false);
  // Caches a successful per-file upload across a failed confirm + retry.
  // Without this, a close/reopen that fails AFTER some files already landed
  // in S3 (a 403, the attachment cap, a network blip) would re-upload those
  // same files on the next Confirm click — orphaning the first copy and
  // minting a fresh objectKey each time, since there's no S3 delete
  // capability in this codebase to clean up the abandoned one.
  const uploadedActionFilesRef = useRef<Map<File, PendingAttachment>>(new Map());

  const detailPath = `/api/tickets/${ticketId}`;
  const { data: ticket, isLoading } = useQuery<TicketDetail>({
    queryKey: [detailPath],
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [detailPath] });
    queryClient.invalidateQueries({ queryKey: [listPath] });
    queryClient.invalidateQueries({ queryKey: ["/api/tickets/stats"] });
  };

  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest("POST", `/api/tickets/${ticketId}/comments`, { body }),
    onSuccess: () => {
      setComment("");
      invalidate();
    },
    onError: (error: any) =>
      toast({ title: "Failed to comment", description: error.message, variant: "destructive" }),
  });

  // The academic mentor's decision to pass a gated ticket on to the industry
  // mentor the learner originally picked.
  const forwardMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/tickets/${ticketId}/forward`),
    onSuccess: () => {
      toast({ title: "Ticket forwarded", description: "It is now with the Industry Mentor." });
      invalidate();
    },
    onError: (error: any) =>
      toast({ title: "Failed to forward", description: error.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      action,
      reason,
      attachments,
    }: {
      action: string;
      reason: string;
      attachments: PendingAttachment[];
    }) => apiRequest("POST", `/api/tickets/${ticketId}/${action}`, { reason, attachments }),
    onSuccess: (_data, variables) => {
      toast({
        title:
          variables.action === "close"
            ? "Ticket closed"
            : variables.action === "reopen"
            ? "Ticket reopened"
            : "Ticket escalated",
      });
      setActionDialog(null);
      setActionReason("");
      setActionFiles([]);
      uploadedActionFilesRef.current.clear();
      invalidate();
    },
    onError: (error: any) =>
      toast({ title: "Action failed", description: error.message, variant: "destructive" }),
  });

  // File selection is validated (type/size) but NOT uploaded yet — the S3
  // PUT only happens in uploadActionFiles, called from handleConfirmAction.
  // Uploading eagerly on select would leave orphaned objects in S3 whenever
  // the user picked a file then cancelled the dialog, and there's no
  // delete-object capability in this codebase to clean those up afterwards.
  const handleActionFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (actionFiles.length + files.length > ATTACHMENT_MAX_FILES) {
      toast({
        title: "Too many files",
        description: `At most ${ATTACHMENT_MAX_FILES} attachments per ticket`,
        variant: "destructive",
      });
      return;
    }

    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!isAllowedAttachment(file.name)) {
        toast({ title: "File type not allowed", description: file.name, variant: "destructive" });
        continue;
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB`,
          variant: "destructive",
        });
        continue;
      }
      accepted.push(file);
    }
    setActionFiles((prev) => [...prev, ...accepted]);
  };

  // Runs the actual S3 PUTs, only once the user has committed to the action.
  // Files already uploaded on a prior (failed) attempt are served from
  // uploadedActionFilesRef instead of being re-uploaded.
  const uploadActionFiles = async (): Promise<PendingAttachment[]> => {
    const uploaded: PendingAttachment[] = [];
    for (const file of actionFiles) {
      const cached = uploadedActionFilesRef.current.get(file);
      if (cached) {
        uploaded.push(cached);
        continue;
      }

      const { uploadUrl, objectKey } = await apiRequest(
        "POST",
        "/api/tickets/attachments/upload-url",
        { fileName: file.name, fileType: file.type, fileSize: file.size }
      );

      const putResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putResponse.ok) {
        throw new Error(`Upload failed for ${file.name}`);
      }

      const attachment: PendingAttachment = {
        fileName: file.name,
        objectKey,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      };
      uploadedActionFilesRef.current.set(file, attachment);
      uploaded.push(attachment);
    }
    return uploaded;
  };

  const handleConfirmAction = async () => {
    if (!actionDialog) return;
    setActionUploading(true);
    try {
      const attachments = await uploadActionFiles();
      actionMutation.mutate({ action: actionDialog, reason: actionReason, attachments });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setActionUploading(false);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    try {
      const { downloadUrl } = await apiRequest(
        "GET",
        `/api/tickets/${ticketId}/attachments/${attachmentId}/url`
      );
      window.open(downloadUrl, "_blank");
    } catch (error: any) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading || !ticket) {
    return (
      <AppLayout title="Ticket">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={ticket.title}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">{ticket.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={priorityStyles[ticket.priority]}>
                  {PRIORITY_LABELS[ticket.priority]}
                </Badge>
                <Badge variant="outline" className={statusStyles[ticket.status]}>
                  {ticket.status === "REOPENED" ? "Reopened" : ticket.status === "OPEN" ? "Open" : "Closed"}
                </Badge>
                <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
                {ticket.slaBreached && ticket.status !== "CLOSED" && (
                  <Badge variant="outline" className="bg-red-500/15 text-red-600 border-red-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    SLA breached
                  </Badge>
                )}
                {ticket.reopenCount > 0 && (
                  <Badge variant="outline">Reopened {ticket.reopenCount}×</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ticket.permissions.canForward && (
              <Button
                variant="outline"
                onClick={() => forwardMutation.mutate()}
                disabled={forwardMutation.isPending}
              >
                {forwardMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ArrowRightCircle className="h-4 w-4 mr-2" />
                )}
                Forward to Industry Mentor
              </Button>
            )}
            {ticket.permissions.canEscalate && ticket.status !== "CLOSED" && (
              <Button variant="outline" onClick={() => setActionDialog("escalate")}>
                <ArrowUpCircle className="h-4 w-4 mr-2" />
                Escalate
              </Button>
            )}
            {ticket.permissions.canClose && ticket.status !== "CLOSED" && (
              <Button onClick={() => setActionDialog("close")}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Close
              </Button>
            )}
            {ticket.permissions.canReopen && ticket.status === "CLOSED" && (
              <Button onClick={() => setActionDialog("reopen")}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen
              </Button>
            )}
          </div>
        </div>

        {ticket.forwardTo && ticket.status !== "CLOSED" && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
            <ArrowRightCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p>
              This ticket is with the Academic Mentor
              {ticket.assignee ? ` (${ticket.assignee.name})` : ""} for a first look. If needed,
              it will be forwarded to the Industry Mentor ({ticket.forwardTo.name}).
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap text-sm">
                  {ticket.description || (
                    <span className="text-muted-foreground">No description provided</span>
                  )}
                </p>

                {ticket.attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Attachments</p>
                    {ticket.attachments.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => downloadAttachment(file.id)}
                        className="flex w-full items-center justify-between rounded border px-3 py-2 text-sm hover:bg-muted"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Paperclip className="h-3 w-3 shrink-0" />
                          <span className="truncate">{file.fileName}</span>
                          <span className="text-muted-foreground">
                            {formatBytes(file.fileSize)}
                          </span>
                        </span>
                        <Download className="h-3 w-3 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {ticket.status === "CLOSED" && ticket.closeReason && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-sm font-medium">
                      Closed by {ticket.closedBy?.name ?? "someone"}
                    </p>
                    <p className="text-sm text-muted-foreground">{ticket.closeReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({ticket.comments.length})
                </CardTitle>
                <CardDescription>
                  Ask questions here instead of closing the ticket to get an answer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                ) : (
                  <div className="space-y-3">
                    {ticket.comments.map((c) => (
                      <div key={c.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {c.author?.name ?? "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a comment…"
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!comment.trim() || commentMutation.isPending}
                      onClick={() => commentMutation.mutate(comment)}
                    >
                      {commentMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Comment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <DetailRow label="Raised by" value={ticket.raisedBy?.name ?? "—"} />
                <DetailRow label="Assignee" value={ticket.assignee?.name ?? "Unassigned"} />
                <DetailRow label="Raised" value={formatDateTime(ticket.createdAt)} />
                <DetailRow label="SLA due" value={formatDateTime(ticket.slaDueAt)} />
                {ticket.closedAt && (
                  <DetailRow label="Closed" value={formatDateTime(ticket.closedAt)} />
                )}
                {ticket.links.length > 0 && (
                  <DetailRow
                    label="Linked"
                    value={`${ticket.links.length} ticket${ticket.links.length === 1 ? "" : "s"}`}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Tagged ({ticket.tags.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nobody tagged</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {ticket.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.user?.name ?? "Unknown"} · {tag.user?.role ?? "—"}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4" />
                  Activity
                </CardTitle>
                <CardDescription>Every change, in order</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-80">
                  <div className="space-y-3">
                    {ticket.events.map((event) => (
                      <div key={event.id} className="text-sm">
                        <p>
                          <span className="font-medium">
                            {event.actor?.name ?? "System"}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            {eventLabels[event.type] ?? event.type}
                          </span>
                          {event.fromValue && event.toValue && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({event.fromValue} → {event.toValue})
                            </span>
                          )}
                        </p>
                        {event.reason && (
                          <p className="text-muted-foreground italic">"{event.reason}"</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(event.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={actionDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActionDialog(null);
            setActionReason("");
            setActionFiles([]);
            uploadedActionFilesRef.current.clear();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "close"
                ? "Close ticket"
                : actionDialog === "reopen"
                ? "Reopen ticket"
                : "Escalate ticket"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === "close"
                ? "Explain how this was resolved so the trail stays readable."
                : actionDialog === "reopen"
                ? "Optionally say why this needs to be reopened."
                : "This moves the ticket one step up the escalation chain."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="action-reason">
              Reason {actionDialog === "reopen" ? "(optional)" : "*"}
            </Label>
            <Textarea
              id="action-reason"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={4}
            />
          </div>
          {(actionDialog === "close" || actionDialog === "reopen") && (
            <div className="space-y-2">
              <Label htmlFor="action-files">Attachment (optional)</Label>
              <Input
                id="action-files"
                type="file"
                multiple
                disabled={actionUploading}
                onChange={(e) => {
                  handleActionFileSelect(e.target.files);
                  e.target.value = "";
                }}
              />
              {actionFiles.length > 0 && (
                <div className="space-y-1">
                  {actionFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{file.name}</span>
                        <span className="text-muted-foreground">
                          {formatBytes(file.size)}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={actionUploading}
                        onClick={() => {
                          uploadedActionFilesRef.current.delete(file);
                          setActionFiles((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actionUploading}>
              Cancel
            </Button>
            <Button
              disabled={
                actionMutation.isPending ||
                actionUploading ||
                (actionDialog !== "reopen" && !actionReason.trim())
              }
              onClick={handleConfirmAction}
            >
              {(actionUploading || actionMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {actionUploading ? "Uploading…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
