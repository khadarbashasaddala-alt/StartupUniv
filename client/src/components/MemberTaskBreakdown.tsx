import { Fragment, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Users } from "lucide-react";
import {
  memberStatsTotals,
  memberTaskStats,
  UNASSIGNED,
  type AnalyticsTask,
  type MemberTaskRow,
  type MemberTaskStats,
} from "@shared/memberTaskStats";

/**
 * Members arrive in two shapes. GET /api/teams/:id returns role assignments with the user
 * nested — `{ userId, user: { name, role } }` — while GET /api/my-team returns `{ id, name }`.
 * Reading only one of them is how the sprint board ended up unable to name any assignee for an
 * admin.
 */
type IncomingMember = {
  userId?: string | null;
  id?: string | null;
  name?: string | null;
  role?: string | null;
  userRole?: string | null;
  user?: { id?: string | null; name?: string | null; role?: string | null } | null;
};

function normaliseMembers(members: readonly IncomingMember[] | null | undefined) {
  return (members ?? [])
    .map((m) => ({
      userId: String(m.userId ?? m.user?.id ?? m.id ?? ""),
      name: m.user?.name ?? m.name ?? "Unknown",
      // The user's platform role, not their role on the team: "Mentor" as a team role and
      // MENTOR as a user role both mean the same thing here.
      role: m.userRole ?? m.user?.role ?? m.role ?? null,
    }))
    .filter((m) => m.userId !== "");
}

const shortDate = (value: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "Not set";

const STATUS_LABELS: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "In Review",
  DONE: "Done",
};

type SortKey = "name" | "assigned" | "done" | "outstanding" | "overdue" | "points";

/** One task line under a member, coloured only when something is actually wrong. */
function TaskLine({ task }: { task: MemberTaskRow }) {
  return (
    <TableRow className={task.lateAndUnsubmitted ? "bg-red-500/5" : undefined}>
      <TableCell className="pl-10">
        <span
          className={
            task.lateAndUnsubmitted ? "font-medium text-red-700 dark:text-red-400" : undefined
          }
        >
          {task.title}
        </span>
        {task.changesRequested && (
          <Badge
            variant="outline"
            className="ml-2 border-amber-500/40 text-xs text-amber-700 dark:text-amber-500"
          >
            Changes requested
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{shortDate(task.startDate)}</TableCell>
      <TableCell
        className={
          task.lateAndUnsubmitted
            ? "font-medium text-red-700 dark:text-red-400"
            : "text-muted-foreground"
        }
      >
        {shortDate(task.endDate)}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="text-xs">
          {STATUS_LABELS[task.status] ?? task.status}
        </Badge>
      </TableCell>
      <TableCell colSpan={2}>
        {task.status === "DONE" ? (
          <span className="text-xs text-muted-foreground">Complete</span>
        ) : task.submitted ? (
          <span className="text-xs text-muted-foreground">Submitted</span>
        ) : task.overdue ? (
          <span className="text-xs font-medium text-red-700 dark:text-red-400">
            Not submitted, overdue
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not submitted</span>
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * Who is carrying what, and what is late.
 *
 * The totals above this cannot say whether work is spread across the team or sitting on one
 * person, nor whether anyone is behind. Red means late with nothing submitted; late but
 * submitted is waiting on a reviewer, which is not the assignee's failing and is left neutral.
 */
export function MemberTaskBreakdown({
  tasks,
  members,
  sprints,
}: {
  tasks: readonly AnalyticsTask[];
  members: readonly IncomingMember[] | null | undefined;
  /** For the phase filter. Without it the table spans every phase at once. */
  sprints?: readonly { id: string; index: number; name?: string | null }[] | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showIdle, setShowIdle] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);

  // Across every phase, "overdue" mixes closed phases with the live one, so a filter is the
  // difference between "behind now" and "was ever late".
  const visibleTasks = useMemo(
    () =>
      sprintFilter === "all"
        ? tasks
        : tasks.filter((t) => String(t.sprintId ?? "") === sprintFilter),
    [tasks, sprintFilter]
  );

  const rows = useMemo(
    () => memberTaskStats(visibleTasks, normaliseMembers(members)),
    [visibleTasks, members]
  );
  const totals = useMemo(() => memberStatsTotals(rows), [rows]);

  const ordered = useMemo(() => {
    if (!sort) return rows;
    const people = rows.filter((r) => r.userId !== UNASSIGNED);
    const unassigned = rows.filter((r) => r.userId === UNASSIGNED);
    const pick = (r: MemberTaskStats) => (sort.key === "name" ? r.name : r[sort.key]);
    const sorted = [...people].sort((a, b) => {
      const x = pick(a);
      const y = pick(b);
      const cmp = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return sort.desc ? -cmp : cmp;
    });
    // Unassigned stays last however the people are ordered: it is a total, not a person.
    return [...sorted, ...unassigned];
  }, [rows, sort]);

  // Eight all-zero rows push the two that matter off the screen, so they collapse to a line.
  const idle = ordered.filter((r) => r.userId !== UNASSIGNED && r.assigned === 0);
  const shown = showIdle ? ordered : ordered.filter((r) => !idle.includes(r));

  const toggle = (userId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });

  const sortBy = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "name" }
    );

  const SortHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => sortBy(k)}
        data-testid={`sort-${k}`}
      >
        {label}
        {sort?.key === k &&
          (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </TableHead>
  );

  const sprintLabel = (s: { index: number; name?: string | null }) =>
    s.name ? `Sprint ${s.index}: ${s.name}` : `Sprint ${s.index}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Who is working on what
            </CardTitle>
            <CardDescription>
              Tasks per member, with anything late and unsubmitted in red. Select a row to see the
              tasks and their dates.
            </CardDescription>
          </div>
          {(sprints?.length ?? 0) > 0 && (
            <Select value={sprintFilter} onValueChange={setSprintFilter}>
              <SelectTrigger className="w-[220px] shrink-0" data-testid="select-analytics-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All phases</SelectItem>
                {[...(sprints ?? [])]
                  .sort((a, b) => a.index - b.index)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {sprintLabel(s)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* The two numbers that need acting on, above the table rather than buried in it. */}
        {(totals.unassignedTasks > 0 || totals.formerMemberTasks > 0) && (
          <div className="flex flex-wrap gap-2">
            {totals.formerMemberTasks > 0 && (
              <div
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
                data-testid="alert-former-member-tasks"
              >
                <span className="font-medium text-red-700 dark:text-red-400">
                  {totals.formerMemberTasks}{" "}
                  {totals.formerMemberTasks === 1 ? "task is" : "tasks are"} assigned to someone no
                  longer on this team
                </span>
                <span className="text-muted-foreground"> — reassign to keep the work moving.</span>
              </div>
            )}
            {totals.unassignedTasks > 0 && (
              <div
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
                data-testid="alert-unassigned-tasks"
              >
                <span className="font-medium text-amber-700 dark:text-amber-500">
                  {totals.unassignedTasks} {totals.unassignedTasks === 1 ? "task" : "tasks"} with
                  nobody assigned
                </span>
                <span className="text-muted-foreground"> — nobody is working on these.</span>
              </div>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {sprintFilter === "all"
              ? "No members or tasks to report on yet."
              : "No tasks in this phase."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead label="Member" k="name" />
                  <SortHead label="Assigned" k="assigned" className="w-24" />
                  <SortHead label="Done" k="done" className="w-20" />
                  <SortHead label="Outstanding" k="outstanding" className="w-28" />
                  <SortHead label="Overdue" k="overdue" className="w-24" />
                  <SortHead label="Points" k="points" className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => {
                  const isOpen = expanded.has(row.userId);
                  const isUnassigned = row.userId === UNASSIGNED;
                  return (
                    <Fragment key={row.userId}>
                      <TableRow
                        className={isUnassigned ? "bg-muted/40" : undefined}
                        data-testid={`member-row-${row.userId}`}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-1 font-medium"
                            onClick={() => toggle(row.userId)}
                            disabled={row.tasks.length === 0}
                          >
                            {row.tasks.length === 0 ? (
                              <span className="w-4" />
                            ) : isOpen ? (
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" />
                            )}
                            {row.name}
                          </Button>
                          {row.formerMember && (
                            <Badge
                              variant="outline"
                              className="ml-1 border-red-500/40 text-xs text-red-700 dark:text-red-400"
                            >
                              No longer on team
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{row.assigned}</TableCell>
                        {/* Done, outstanding and overdue describe a person's progress, and there
                            is no person behind unassigned work. */}
                        <TableCell>{isUnassigned ? "—" : row.done}</TableCell>
                        <TableCell>{isUnassigned ? "—" : row.outstanding}</TableCell>
                        <TableCell>
                          {isUnassigned ? (
                            "—"
                          ) : row.overdue > 0 ? (
                            <span className="font-medium text-red-700 dark:text-red-400">
                              {row.overdue}
                            </span>
                          ) : (
                            0
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {isUnassigned ? row.points : `${row.donePoints}/${row.points}`}
                        </TableCell>
                      </TableRow>
                      {isOpen &&
                        row.tasks.map((task) => (
                          <TaskLine key={`${row.userId}-${task.id}`} task={task} />
                        ))}
                    </Fragment>
                  );
                })}

                {idle.length > 0 && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={6}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 px-1 text-muted-foreground"
                        onClick={() => setShowIdle((v) => !v)}
                        data-testid="button-toggle-idle-members"
                      >
                        {showIdle ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {idle.length}{" "}
                        {idle.length === 1 ? "member has" : "members have"} nothing assigned
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>

              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">
                    {totals.members} {totals.members === 1 ? "member" : "members"}
                  </TableCell>
                  <TableCell className="font-medium">{totals.assigned}</TableCell>
                  <TableCell className="font-medium">{totals.done}</TableCell>
                  <TableCell className="font-medium">{totals.outstanding}</TableCell>
                  <TableCell className="font-medium">
                    {totals.overdue > 0 ? (
                      <span className="text-red-700 dark:text-red-400">{totals.overdue}</span>
                    ) : (
                      0
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {totals.donePoints}/{totals.points}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {/* Said out loud, because otherwise the footer not matching "Total Tasks" above
                reads as a miscount rather than as two different questions. */}
            <p className="mt-2 text-xs text-muted-foreground">
              A task shared by several people counts once for each of them, and unassigned work is
              listed separately — so these totals will not match the team's task count above.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MemberTaskBreakdown;
