import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import type { SprintCloseSummary } from "@shared/sprintPhase";

interface CloseSummary extends SprintCloseSummary {
  sprint: { id: string; index: number; name: string | null };
  affectedMembers: number;
  nextSprint: {
    id: string;
    index: number;
    name: string | null;
    startDate: string | null;
    phase: string;
  } | null;
}

const sprintLabel = (s: { index: number; name: string | null } | null | undefined) =>
  !s ? "" : s.name ? `Sprint ${s.index}: ${s.name}` : `Sprint ${s.index}`;

/**
 * Closing a sprint, with what it costs stated first.
 *
 * Closing is what moves every learner on the team to the next phase — /api/my-sprint shows them
 * the first sprint that is not passed — and it releases the month's stipends in the same call.
 * Neither of those was said anywhere, and the control that did it was unreachable: the mentor
 * dashboard gated it on `sprint.status === "REVIEW"` for a field the sprints table does not have,
 * so the button never rendered and a sprint could not be closed from the UI at all.
 *
 * Outstanding work is shown but does not block. A programme that could not end a phase over one
 * unreviewed submission would strand the team; the tick box is what makes it deliberate instead.
 */
export function CloseSprintDialog({
  sprintId,
  open,
  onOpenChange,
  onClosed,
}: {
  sprintId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
}) {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);

  const { data: summary, isLoading } = useQuery<CloseSummary>({
    queryKey: ["/api/sprints", sprintId, "close-summary"],
    queryFn: () => apiRequest("GET", `/api/sprints/${sprintId}/close-summary`),
    enabled: !!sprintId && open,
  });

  const closeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/sprints/${sprintId}/pass`),
    onSuccess: () => {
      // The learner's board is driven by which sprint is unpassed, so everything re-reads.
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentor/sprints"] });
      toast({
        title: summary?.nextSprint
          ? `${sprintLabel(summary.sprint)} closed`
          : "Final sprint closed",
        description: summary?.nextSprint
          ? `The team is now on ${sprintLabel(summary.nextSprint)}. Stipends released.`
          : "This was the last sprint. Stipends released.",
      });
      setConfirmed(false);
      onOpenChange(false);
      onClosed?.();
    },
    onError: (error: any) => {
      toast({
        title: "Could not close the sprint",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const outstanding = summary && !summary.clean;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmed(false);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-6">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>
            {summary?.nextSprint
              ? `Close ${sprintLabel(summary.sprint)} and start the next phase?`
              : "Close this sprint?"}
          </DialogTitle>
          <DialogDescription>
            {summary?.timing ? `This sprint is ${summary.timing.toLowerCase()}.` : "Checking..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {isLoading || !summary ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>
                    {summary.doneTasks} of {summary.totalTasks}{" "}
                    {summary.totalTasks === 1 ? "task" : "tasks"} complete
                  </span>
                </div>

                {summary.openTaskTitles.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      {summary.openTaskTitles.length}{" "}
                      {summary.openTaskTitles.length === 1 ? "task" : "tasks"} still open —{" "}
                      <span className="text-muted-foreground">
                        {summary.openTaskTitles.slice(0, 3).join(", ")}
                        {summary.openTaskTitles.length > 3
                          ? ` and ${summary.openTaskTitles.length - 3} more`
                          : ""}
                      </span>
                    </span>
                  </div>
                )}

                {summary.pendingSubmissions > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      {summary.pendingSubmissions}{" "}
                      {summary.pendingSubmissions === 1 ? "submission" : "submissions"} still
                      awaiting review
                    </span>
                  </div>
                )}

                {summary.changesRequested > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>
                      {summary.changesRequested} with changes requested and not yet resubmitted
                    </span>
                  </div>
                )}

                {summary.clean && (
                  <p className="text-muted-foreground">
                    Everything on this sprint is finished and reviewed.
                  </p>
                )}
              </div>

              {/* Both consequences named. Neither was stated anywhere before. */}
              <div className="space-y-1 text-sm">
                {summary.nextSprint ? (
                  <p>
                    Closing this moves{" "}
                    <span className="font-medium">
                      {summary.affectedMembers} team{" "}
                      {summary.affectedMembers === 1 ? "member" : "members"}
                    </span>{" "}
                    on to <span className="font-medium">{sprintLabel(summary.nextSprint)}</span>
                    {summary.nextSprint.phase === "UPCOMING" && summary.nextSprint.startDate
                      ? `, which starts ${new Date(
                          summary.nextSprint.startDate
                        ).toLocaleDateString()}`
                      : ""}
                    .
                  </p>
                ) : (
                  <p>
                    There is no later sprint, so the team will stay on this one as their most
                    recent phase.
                  </p>
                )}
                <p className="text-muted-foreground">
                  It also releases this month's stipends for the team.
                </p>
              </div>

              {outstanding && (
                <p className="text-xs text-muted-foreground">
                  Outstanding work does not prevent closing — it is listed so the decision is
                  made with it in view.
                </p>
              )}

              <div className="flex items-start gap-2 border-t pt-4">
                <Checkbox
                  id="confirm-close-sprint"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                  data-testid="checkbox-confirm-close-sprint"
                />
                <Label htmlFor="confirm-close-sprint" className="font-normal leading-snug">
                  I confirm {sprintLabel(summary.sprint)} is complete and the team should move on.
                </Label>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!confirmed || closeMutation.isPending || isLoading}
            onClick={() => closeMutation.mutate()}
            data-testid="button-confirm-close-sprint"
          >
            {closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {summary?.nextSprint ? "Close and start next phase" : "Close sprint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CloseSprintDialog;
