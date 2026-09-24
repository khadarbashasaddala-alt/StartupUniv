import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shape returned by the server for tasks with more than one assignee. Single
 * assignee tasks get `null` — there is nothing to co-ordinate, so nothing to
 * show.
 */
export type TaskSubmissionProgress = {
  totalAssignees: number;
  submittedCount: number;
  pendingAssignees: { userId: string; name: string }[];
  allSubmitted: boolean;
};

/**
 * "1 of 3 submitted" for a shared task, plus who is still outstanding.
 *
 * A shared task only moves to review once everybody has submitted, so whoever
 * is looking at the card needs to know how far along it is and who is holding
 * it up — otherwise the task just looks stuck.
 */
export function TaskSubmissionBadge({
  progress,
  className,
  showPending = true,
}: {
  progress?: TaskSubmissionProgress | null;
  className?: string;
  /** Set false where the card is too cramped for the names (compact columns). */
  showPending?: boolean;
}) {
  if (!progress || progress.totalAssignees < 2) return null;

  const { submittedCount, totalAssignees, pendingAssignees, allSubmitted } = progress;
  const allNames = pendingAssignees.map((p) => p.name);
  // Cards are narrow. Two names inline, the rest behind a count — the full list
  // stays available as the title attribute.
  const shown = allNames.slice(0, 2).join(", ");
  const extra = allNames.length - 2;

  return (
    <div className={cn("flex flex-col gap-1", className)} data-testid="task-submission-progress">
      <Badge
        variant="outline"
        className={cn(
          "w-fit gap-1 text-xs font-medium",
          allSubmitted
            ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-500"
        )}
        title={
          allSubmitted
            ? `All ${totalAssignees} assignees have submitted their evidence`
            : `Waiting on: ${allNames.join(", ")}`
        }
      >
        {allSubmitted ? (
          <CheckCircle2 className="h-3 w-3 shrink-0" />
        ) : (
          <Users className="h-3 w-3 shrink-0" />
        )}
        <span>
          {submittedCount} of {totalAssignees} submitted
        </span>
      </Badge>
      {showPending && !allSubmitted && allNames.length > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title={`Waiting on: ${allNames.join(", ")}`}
        >
          Waiting on {shown}
          {extra > 0 ? ` +${extra} more` : ""}
        </span>
      )}
    </div>
  );
}

export default TaskSubmissionBadge;
