import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AlertCircle,
  CalendarDays,
  Download,
  FileArchive,
  History,
  Loader2,
  Paperclip,
  Users,
} from "lucide-react";

type ExportSummary = {
  sprint: {
    id: string;
    index: number;
    name: string;
    startDate: string;
    endDate: string;
    passedAt: string | null;
    goals: string | null;
    objectives: string | null;
    deliverables: string | null;
    demoUrl: string | null;
    demoNotes: string | null;
  };
  team: { id: string; name: string } | null;
  counts: {
    tasks: number;
    tasksDone: number;
    attachments: number;
    missingAttachments: number;
    links: number;
    standups: number;
    reviews: number;
    meetings: number;
    mentorSessions: number;
    members: number;
  };
  totalBytes: number;
  totalBytesLabel: string;
  oversized: boolean;
  isEmpty: boolean;
  auditReady: boolean;
  contributions: Array<{
    userId: string;
    name: string;
    teamRole: string;
    tasksAssigned: number;
    tasksDone: number;
    points: number;
    weightedPoints: number;
    evidenceSubmitted: number;
    standupsFiled: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string | null;
    points: number | null;
    assignees: string[];
    attachmentCount: number;
  }>;
};

type ExportHistoryEntry = {
  id: string;
  format: string;
  attachmentCount: number | null;
  skippedCount: number | null;
  byteSizeLabel: string | null;
  completedAt: string | null;
  createdAt: string;
  exportedByName: string;
};

const STATUS_STYLES: Record<string, string> = {
  DONE: "bg-green-500/15 text-green-700 dark:text-green-400",
  REVIEW: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  TODO: "bg-muted text-muted-foreground",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

interface SprintExportDialogProps {
  sprintId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Read-only record of a passed sprint, plus the archive download. Only reachable
 * for sprints a mentor or admin has marked as passed — the API enforces that
 * too, so the dialog never has to guess.
 */
export function SprintExportDialog({ sprintId, open, onOpenChange }: SprintExportDialogProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  // Building this summary walks every task, evidence row and attachment for the
  // sprint, so it is not something to re-run on each dialog open. A passed
  // sprint is finished work, so the data barely changes.
  const { data, isLoading, error } = useQuery<ExportSummary>({
    queryKey: ["/api/sprints", sprintId, "export-summary"],
    queryFn: () => apiRequest("GET", `/api/sprints/${sprintId}/export/summary`),
    enabled: open && Boolean(sprintId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: history } = useQuery<ExportHistoryEntry[]>({
    queryKey: ["/api/sprints", sprintId, "export-history"],
    queryFn: () => apiRequest("GET", `/api/sprints/${sprintId}/export/history`),
    enabled: open && Boolean(sprintId),
    staleTime: 60 * 1000,
  });

  /**
   * Navigate to the endpoint rather than fetching it.
   *
   * The request is a plain cookie-authenticated GET, so the browser can stream
   * the archive straight to disk. Reading it via fetch().blob() would hold the
   * entire ZIP in tab memory first, which defeats the point of streaming it
   * server-side and would kill the tab on a multi-gigabyte export. The
   * Content-Disposition header supplies the filename.
   *
   * target=_blank matters: on success the attachment disposition means no tab
   * ever renders, but every refusal (403, 409, 429, 500) returns JSON with no
   * disposition. Without it, the browser would replace the app with a raw JSON
   * page and the user would lose their whole sprint-board state.
   */
  const handleDownload = () => {
    if (!sprintId) return;
    setDownloading(true);

    const anchor = document.createElement("a");
    anchor.href = `/api/sprints/${sprintId}/export/zip`;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // Navigation to a download does not change the page, so there is no load
    // event to react to. Release the button after a moment and tell the user
    // where to look; a server-side refusal arrives as its own error page.
    window.setTimeout(() => {
      setDownloading(false);
      toast({
        title: "Download started",
        description: "The archive is being prepared — check your browser downloads.",
      });
      // The audit row is written before streaming begins, so refetching now
      // surfaces this export in the history list (as incomplete until it ends).
      queryClient.invalidateQueries({
        queryKey: ["/api/sprints", sprintId, "export-history"],
      });
    }, 1500);
  };

  const counts = data?.counts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            {data ? `Sprint ${data.sprint.index}: ${data.sprint.name}` : "Sprint record"}
          </DialogTitle>
          <DialogDescription>
            Everything your team completed in this sprint, ready to download as a single archive.
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Could not load the sprint record</p>
              <p className="text-muted-foreground">
                {(error as any)?.message || "Please try again."}
              </p>
            </div>
          </div>
        )}

        {data && (
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-6">
              {/* Sprint metadata */}
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(data.sprint.startDate)} – {formatDate(data.sprint.endDate)}
                  </span>
                  {data.team && <span>{data.team.name}</span>}
                  <Badge className="bg-green-500">Passed {formatDate(data.sprint.passedAt)}</Badge>
                </div>
                {data.sprint.goals && (
                  <p className="text-sm">
                    <span className="font-medium">Goals: </span>
                    {data.sprint.goals}
                  </p>
                )}
                {data.sprint.deliverables && (
                  <p className="text-sm">
                    <span className="font-medium">Deliverables: </span>
                    {data.sprint.deliverables}
                  </p>
                )}
                {data.sprint.demoUrl && (
                  <p className="text-sm">
                    <span className="font-medium">Demo: </span>
                    <a
                      href={data.sprint.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      {data.sprint.demoUrl}
                    </a>
                  </p>
                )}
              </div>

              {/* What the archive will contain */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Tasks", value: `${counts!.tasksDone}/${counts!.tasks}`, hint: "done" },
                  { label: "Attachments", value: counts!.attachments, hint: data.totalBytesLabel },
                  { label: "Standups", value: counts!.standups },
                  { label: "Reviews", value: counts!.reviews },
                  { label: "Meetings", value: counts!.meetings },
                  { label: "Mentor sessions", value: counts!.mentorSessions },
                  { label: "External links", value: counts!.links },
                  { label: "Members", value: counts!.members },
                ].map((tile) => (
                  <div key={tile.label} className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">{tile.label}</p>
                    <p className="text-lg font-semibold leading-tight">{tile.value}</p>
                    {tile.hint && <p className="text-xs text-muted-foreground">{tile.hint}</p>}
                  </div>
                ))}
              </div>

              {data.auditReady === false && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p>
                    Export is not fully installed on this environment — the export audit table is
                    missing, so downloads will fail. An administrator needs to run the{" "}
                    <code>db:add-sprint-exports</code> migration.
                  </p>
                </div>
              )}

              {data.isEmpty && (
                <div className="flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p>
                    This sprint has no tasks recorded, so the archive will contain only the sprint
                    details — no task data or attachments.
                  </p>
                </div>
              )}

              {counts!.missingAttachments > 0 && (
                <div className="flex items-start gap-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p>
                    {counts!.missingAttachments} attachment
                    {counts!.missingAttachments === 1 ? "" : "s"} could not be found in storage and
                    will be listed in <code>SKIPPED.txt</code> instead of included.
                  </p>
                </div>
              )}

              {data.oversized && (
                <div className="flex items-start gap-3 rounded-md border border-orange-500/40 bg-orange-500/5 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <p>
                    This archive is about {data.totalBytesLabel}. The download may take a while —
                    keep this tab open until it finishes.
                  </p>
                </div>
              )}

              {/* Per-member contribution */}
              {data.contributions.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <Users className="h-4 w-4" />
                    Contribution by member
                  </h3>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Tasks done</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                          <TableHead className="text-right">Weighted</TableHead>
                          <TableHead className="text-right">Evidence</TableHead>
                          <TableHead className="text-right">Standups</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...data.contributions]
                          .sort((a, b) => b.weightedPoints - a.weightedPoints)
                          .map((row) => (
                            <TableRow key={row.userId}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="text-muted-foreground">{row.teamRole}</TableCell>
                              <TableCell className="text-right">
                                {row.tasksDone}/{row.tasksAssigned}
                              </TableCell>
                              <TableCell className="text-right">{row.points}</TableCell>
                              <TableCell className="text-right">{row.weightedPoints}</TableCell>
                              <TableCell className="text-right">{row.evidenceSubmitted}</TableCell>
                              <TableCell className="text-right">{row.standupsFiled}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Weighted points multiply story points by task priority (High 3, Medium 2, Low 1),
                    matching the team health score.
                  </p>
                </div>
              )}

              {/* Tasks */}
              {data.tasks.length > 0 && (
                <div>
                  <Separator className="mb-4" />
                  <h3 className="text-sm font-semibold mb-2">Tasks in this sprint</h3>
                  <div className="space-y-2">
                    {data.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-3 rounded-md border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.assignees.length ? task.assignees.join(", ") : "Unassigned"}
                            {task.points ? ` · ${task.points} pt` : ""}
                            {task.priority ? ` · ${task.priority}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {task.attachmentCount > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Paperclip className="h-3 w-3" />
                              {task.attachmentCount}
                            </span>
                          )}
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLES[task.status] ?? STATUS_STYLES.TODO}
                          >
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit trail: who already holds a copy of this sprint's data */}
              {history && history.length > 0 && (
                <div>
                  <Separator className="mb-4" />
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <History className="h-4 w-4" />
                    Previous exports
                  </h3>
                  <div className="space-y-1.5">
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{entry.exportedByName}</span>
                        <span className="text-muted-foreground">
                          {formatDateTime(entry.createdAt)}
                          {entry.completedAt
                            ? entry.byteSizeLabel
                              ? ` · ${entry.byteSizeLabel}`
                              : ""
                            : " · incomplete"}
                          {entry.skippedCount ? ` · ${entry.skippedCount} skipped` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-muted-foreground sm:mr-auto">
            The archive contains a readable summary, CSV data files, a JSON manifest and every
            uploaded attachment.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleDownload}
              disabled={downloading || !data || data.auditReady === false}
              className="gap-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing archive…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download ZIP
                  {data && data.totalBytes > 0 ? ` (${data.totalBytesLabel})` : ""}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
