/**
 * Programme plan import: download a template, fill it in, upload it back (issue #258).
 *
 * Nothing is written until the admin presses Apply, which is what makes "the admin reviews and
 * adjusts instead of authoring from scratch" true rather than aspirational: a bad file is a
 * screenful of row-numbered errors, not a board full of wrong sprints to clean up.
 *
 * The file is parsed here for the instant preview, but the RAW TEXT is what gets POSTed — the
 * server re-runs the same validators from @shared/programmePlan on what the admin actually
 * uploaded rather than trusting this parse. Parsing client-side also means the import needs no new
 * server infrastructure: there is no multipart middleware in this codebase, every existing upload
 * goes via a presigned S3 URL, and this needs neither.
 */
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  PLAN_COLUMNS,
  TEMPLATE_BASENAME,
  deriveSprintWindows,
  parseCsv,
  parsePlanSheet,
  sampleTemplateCsv,
  type PlanIssue,
  type ProgrammePlan,
} from "@shared/programmePlan";

/** Anything larger than this is not a programme plan, and parsing it would lock up the tab. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface ProgrammePlanImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName?: string;
}

type ParseState =
  | { status: "empty" }
  | { status: "error"; fileName: string; errors: PlanIssue[] }
  | {
      status: "ready";
      fileName: string;
      csv: string;
      plan: ProgrammePlan;
      warnings: PlanIssue[];
    };

/** Server's account of what applying would do, or did. Dates arrive as ISO strings. */
interface DiffSummary {
  sprintsCreated: number;
  sprintsUpdated: number;
  sprintsUnchanged: number;
  tasksCreated: number;
  tasksUpdated: number;
  tasksUnchanged: number;
  tasksSkipped: number;
  orphaned: number;
}

interface DiffResponse {
  team: { id: string; name: string };
  diff: {
    summary: DiffSummary;
    orphanedTasks: { id: string; sprintIndex: number; title: string; status: string }[];
    sprints: {
      index: number;
      action: string;
      name: string;
      startDate: string;
      endDate: string;
      tasks: { action: string; title: string; reason?: string }[];
    }[];
  };
}

export function ProgrammePlanImport({
  open,
  onOpenChange,
  teamId,
  teamName,
}: ProgrammePlanImportProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ParseState>({ status: "empty" });

  // The cohort's start date is what the sprint windows are derived from, so the preview cannot
  // show dates without it. Resolved team -> cohortId -> cohort rather than passed in, so the
  // dialog can be dropped anywhere a teamId is known.
  const { data: team } = useQuery<{ id: string; name: string; cohortId: string }>({
    queryKey: ["/api/teams", teamId],
    queryFn: () => apiRequest("GET", `/api/teams/${teamId}`),
    enabled: open && Boolean(teamId),
  });

  const { data: cohort } = useQuery<{ id: string; name: string; startDate: string; endDate: string }>({
    queryKey: ["/api/cohorts", team?.cohortId],
    queryFn: () => apiRequest("GET", `/api/cohorts/${team!.cohortId}`),
    enabled: open && Boolean(team?.cohortId),
  });

  const cohortStart = cohort?.startDate ? new Date(cohort.startDate) : null;
  const cohortEnd = cohort?.endDate ? new Date(cohort.endDate) : null;

  const windows = useMemo(() => {
    if (state.status !== "ready" || !cohortStart) return [];
    return deriveSprintWindows(state.plan.sprints, cohortStart);
  }, [state, cohortStart]);

  const totals = useMemo(() => {
    if (state.status !== "ready") return { sprints: 0, tasks: 0, weeks: 0 };
    return {
      sprints: state.plan.sprints.length,
      tasks: state.plan.sprints.reduce((n, s) => n + s.tasks.length, 0),
      weeks: state.plan.sprints.reduce((n, s) => n + s.durationWeeks, 0),
    };
  }, [state]);

  /**
   * The plan running past the cohort's own end date is a warning, not a bar to proceeding: a
   * cohort end date entered wrongly is at least as likely as a plan being too long, and blocking
   * would leave the admin unable to do anything about either.
   */
  const overrunsCohort =
    windows.length > 0 && cohortEnd !== null && windows[windows.length - 1].endDate > cohortEnd;

  function downloadTemplate() {
    // A Blob + object URL, matching how team-chat already offers a file for download. No server
    // round trip: the template is generated from the same column spec the parser reads.
    const blob = new Blob([sampleTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${TEMPLATE_BASENAME}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast({
        title: "File too large",
        description: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. A programme plan should be well under ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
        variant: "destructive",
      });
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      toast({
        title: "Could not read the file",
        description: "Try re-saving it as CSV and uploading again.",
        variant: "destructive",
      });
      return;
    }

    const result = parsePlanSheet(parseCsv(text));
    if (!result.ok) {
      setState({ status: "error", fileName: file.name, errors: result.errors });
      return;
    }
    setState({
      status: "ready",
      fileName: file.name,
      csv: text,
      plan: result.plan,
      warnings: result.warnings,
    });
  }

  /**
   * Both calls send the raw file text, not the parsed plan. The server re-runs the same
   * validators on what the admin actually uploaded rather than trusting this component's parse.
   */
  const dryRun = useMutation<DiffResponse>({
    mutationFn: () =>
      apiRequest("POST", `/api/teams/${teamId}/programme-plan/dry-run`, {
        csv: state.status === "ready" ? state.csv : "",
      }),
    onError: (error: any) =>
      toast({
        title: "Could not preview the changes",
        description: error?.message || "Please try again.",
        variant: "destructive",
      }),
  });

  const apply = useMutation<DiffResponse>({
    mutationFn: () =>
      apiRequest("POST", `/api/teams/${teamId}/programme-plan/apply`, {
        csv: state.status === "ready" ? state.csv : "",
      }),
    onSuccess: (result) => {
      const s = result.diff.summary;
      // Every board query that could now be stale. Missing one leaves the admin looking at the
      // old sprint list and assuming the import silently failed.
      for (const key of [
        ["/api/teams", teamId, "sprints"],
        ["/api/teams", teamId, "sprint"],
        ["/api/teams", teamId, "tasks"],
        ["/api/my-sprint"],
        ["/api/my-tasks"],
        ["/api/teams/metrics"],
        ["/api/admin/cohort-stats"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      toast({
        title: s.sprintsCreated + s.sprintsUpdated === 0 ? "Already up to date" : "Programme plan applied",
        description:
          s.sprintsCreated + s.sprintsUpdated === 0
            ? "Nothing needed changing — the board already matches this plan."
            : `${s.sprintsCreated} sprint(s) created, ${s.sprintsUpdated} updated, ${s.tasksCreated} task(s) added.`,
      });
    },
    onError: (error: any) =>
      toast({
        title: "Could not apply the programme plan",
        description: error?.message || "Nothing was saved. Please try again.",
        variant: "destructive",
      }),
  });

  function reset() {
    setState({ status: "empty" });
    dryRun.reset();
    apply.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // The server's account, from whichever call ran last. Apply wins, since it is the newer truth.
  const serverDiff = apply.data?.diff ?? dryRun.data?.diff ?? null;
  const applied = Boolean(apply.data);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import programme plan</DialogTitle>
          <DialogDescription>
            Fill the template once for the programme, then upload it to preview the sprints and
            tasks it would create{teamName ? ` for ${teamName}` : ""}. Nothing is saved yet.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="h-4 w-4 mr-2" />
              Download template
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-plan"
            >
              <Upload className="h-4 w-4 mr-2" />
              {state.status === "empty" ? "Upload filled template" : "Choose a different file"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            {state.status !== "empty" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {state.fileName}
                <button
                  type="button"
                  onClick={reset}
                  className="ml-1 hover:text-foreground"
                  aria-label="Clear the selected file"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {state.status === "empty" && (
            <div className="rounded-md border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium">What goes in the template</p>
              <p className="text-xs text-muted-foreground">
                One row per task. The sprint columns repeat on every row belonging to that sprint,
                and rows sharing a <span className="font-mono">Sprint #</span> become one sprint.
              </p>
              <ul className="space-y-1.5">
                {PLAN_COLUMNS.map((column) => (
                  <li key={column.key} className="text-xs">
                    <span className="font-mono font-medium">{column.header}</span>
                    {column.required ? (
                      <Badge variant="secondary" className="ml-2 text-[10px] py-0">required</Badge>
                    ) : null}
                    <span className="text-muted-foreground"> — {column.help}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                There are no date columns: sprint dates are calculated from the cohort's start
                date, which is what lets one filled template be reused for every intake.
              </p>
            </div>
          )}

          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {state.errors.length} problem{state.errors.length === 1 ? "" : "s"} to fix
              </AlertTitle>
              <AlertDescription>
                <p className="mb-2 text-xs">
                  Nothing has been saved. Fix these rows in the spreadsheet and upload it again.
                </p>
                <ScrollArea className="max-h-56">
                  <ul className="space-y-1">
                    {state.errors.map((issue, i) => (
                      <li key={i} className="text-xs">
                        {issue.row !== null && (
                          <span className="font-mono font-medium">Row {issue.row}</span>
                        )}
                        {issue.row !== null && issue.column !== null && " · "}
                        {issue.column !== null && (
                          <span className="font-mono">{issue.column}</span>
                        )}
                        {issue.row !== null || issue.column !== null ? " — " : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </AlertDescription>
            </Alert>
          )}

          {state.status === "ready" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{totals.sprints} sprints</Badge>
                <Badge variant="secondary">{totals.tasks} tasks</Badge>
                <Badge variant="secondary">{totals.weeks} weeks total</Badge>
                {cohort ? (
                  <Badge variant="outline">
                    from {cohort.name} starting {cohortStart ? fmtDate(cohortStart) : "—"}
                  </Badge>
                ) : (
                  <Badge variant="outline">loading cohort dates…</Badge>
                )}
              </div>

              {state.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {state.warnings.length} thing{state.warnings.length === 1 ? "" : "s"} worth a look
                  </AlertTitle>
                  <AlertDescription>
                    <ul className="space-y-1 mt-1">
                      {state.warnings.map((issue, i) => (
                        <li key={i} className="text-xs">
                          {issue.row !== null && (
                            <span className="font-mono font-medium">Row {issue.row}</span>
                          )}
                          {issue.row !== null ? " — " : ""}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {overrunsCohort && cohortEnd && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>This plan runs past the cohort's end date</AlertTitle>
                  <AlertDescription className="text-xs">
                    The last sprint ends {fmtDate(windows[windows.length - 1].endDate)}, but{" "}
                    {cohort?.name} is set to end {fmtDate(cohortEnd)}. Either the plan is too long
                    or the cohort's end date needs updating — worth checking which before applying.
                  </AlertDescription>
                </Alert>
              )}

              {serverDiff && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-sm font-medium">
                    {applied ? "What was applied" : "What applying would change"}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Badge variant={serverDiff.summary.sprintsCreated > 0 ? "default" : "outline"}>
                      {serverDiff.summary.sprintsCreated} sprint
                      {serverDiff.summary.sprintsCreated === 1 ? "" : "s"} {applied ? "created" : "to create"}
                    </Badge>
                    <Badge variant="outline">
                      {serverDiff.summary.sprintsUpdated} sprint
                      {serverDiff.summary.sprintsUpdated === 1 ? "" : "s"} {applied ? "updated" : "to update"}
                    </Badge>
                    <Badge variant="outline">
                      {serverDiff.summary.tasksCreated} task
                      {serverDiff.summary.tasksCreated === 1 ? "" : "s"} {applied ? "added" : "to add"}
                    </Badge>
                    {serverDiff.summary.tasksUpdated > 0 && (
                      <Badge variant="outline">{serverDiff.summary.tasksUpdated} task(s) amended</Badge>
                    )}
                    {serverDiff.summary.sprintsUnchanged + serverDiff.summary.tasksUnchanged > 0 && (
                      <Badge variant="secondary">
                        {serverDiff.summary.sprintsUnchanged + serverDiff.summary.tasksUnchanged} already
                        up to date
                      </Badge>
                    )}
                  </div>

                  {/* Skipped rows are the ones an admin most needs to notice: the plan wanted to
                      change them, and we deliberately did not. */}
                  {serverDiff.summary.tasksSkipped > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {serverDiff.summary.tasksSkipped} task
                      {serverDiff.summary.tasksSkipped === 1 ? "" : "s"} left untouched because work
                      has already started on {serverDiff.summary.tasksSkipped === 1 ? "it" : "them"}.
                    </p>
                  )}

                  {serverDiff.orphanedTasks.length > 0 && (
                    <div className="text-xs">
                      <p className="text-muted-foreground">
                        {serverDiff.orphanedTasks.length} task
                        {serverDiff.orphanedTasks.length === 1 ? "" : "s"} on the board are no longer
                        in this template. They are left alone — remove them by hand if they are not
                        wanted:
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {serverDiff.orphanedTasks.map((t) => (
                          <li key={t.id} className="font-mono">
                            Sprint {t.sprintIndex} · {t.title} ({t.status})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {state.plan.sprints.map((sprint) => {
                  const window = windows.find((w) => w.index === sprint.index);
                  return (
                    <div key={sprint.index} className="rounded-md border">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                        <span className="text-sm font-medium">
                          Sprint {sprint.index}: {sprint.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {window
                            ? `${fmtDate(window.startDate)} – ${fmtDate(window.endDate)}`
                            : "dates pending cohort"}{" "}
                          · {sprint.durationWeeks}w · {sprint.tasks.length} task
                          {sprint.tasks.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ul className="divide-y">
                        {sprint.tasks.map((task) => (
                          <li key={task.sourceKey} className="px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-sm">{task.title}</span>
                              <span className="flex shrink-0 items-center gap-1">
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {task.priority}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {task.points} pt
                                </Badge>
                              </span>
                            </div>
                            {task.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {task.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <p className="mr-auto text-xs text-muted-foreground">
            {applied
              ? "Applied. Re-applying the same file changes nothing."
              : state.status === "ready"
                ? "Check the changes above, then apply."
                : "Nothing is saved until you apply."}
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {state.status === "ready" && !applied && (
            <>
              <Button
                variant="outline"
                onClick={() => dryRun.mutate()}
                disabled={dryRun.isPending || apply.isPending}
                data-testid="button-plan-dry-run"
              >
                {dryRun.isPending ? "Checking…" : "Check changes"}
              </Button>
              <Button
                onClick={() => apply.mutate()}
                disabled={apply.isPending || dryRun.isPending}
                data-testid="button-plan-apply"
              >
                {apply.isPending ? "Applying…" : "Apply to this team"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
