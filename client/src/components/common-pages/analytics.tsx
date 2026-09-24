import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Target,
  CheckCircle2,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  Award,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { MemberTaskBreakdown } from "@/components/MemberTaskBreakdown";
import { PageTourButton } from "@/components/tour/PageTourButton";

type TeamData = {
  id: string;
  name: string;
  track: string;
  healthStatus: string;
  userRole: string;
  userBand: string | null;
  userEquity: string;
  members: { id: string; name: string; role: string; band: string | null }[];
};

type SprintData = {
  sprint: {
    id: string;
    index: number;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    passed: boolean;
  } | null;
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
  }[];
  totalSprints: number;
  completedTasks: number;
  totalTasks: number;
};

type TaskData = {
  id: string;
  title: string;
  status: string;
  points: number;
}[];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Fetch teams list for admin
  const { data: teams } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/teams");
    },
    enabled: isAdmin,
  });

  // For admin: fetch selected team data, for others: fetch their own team
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: isAdmin && selectedTeamId ? ["/api/teams", selectedTeamId] : ["/api/my-team"],
    queryFn: async () => {
      if (isAdmin && selectedTeamId) {
        return await apiRequest("GET", `/api/teams/${selectedTeamId}`);
      }
      return await apiRequest("GET", "/api/my-team");
    },
    enabled: !isAdmin || !!selectedTeamId,
  });

  // For admin: fetch selected team's sprint data, for others: fetch their own sprint
  const { data: sprintData, isLoading: sprintLoading } = useQuery<SprintData>({
    queryKey: isAdmin && selectedTeamId ? ["/api/teams", selectedTeamId, "sprint"] : ["/api/my-sprint"],
    queryFn: async () => {
      if (isAdmin && selectedTeamId) {
        // Fetch sprints for the team
        const sprints = await apiRequest("GET", `/api/teams/${selectedTeamId}/sprints`);
        // `s.status` does not exist on a sprint row, so this always fell through to the last
        // sprint — which is why Sprint Progress read "6/6" while the team was on Phase I. The
        // current phase is the first one not closed, the same rule /api/my-sprint uses.
        const currentSprint =
          sprints.find((s: any) => !s.passed) || sprints[sprints.length - 1];
        
        if (!currentSprint) {
          return { sprint: null, tasks: [], totalSprints: sprints.length, completedTasks: 0, totalTasks: 0 };
        }

        // Get tasks for this sprint
        const allTasks = await apiRequest("GET", `/api/teams/${selectedTeamId}/tasks`);
        const sprintTasks = allTasks.filter((t: any) => t.sprintId === currentSprint.id);
        const completedTasksList = sprintTasks.filter((t: any) => t.status === "DONE");

        return {
          sprint: {
            id: currentSprint.id,
            index: currentSprint.index,
            title: currentSprint.goals || `Sprint ${currentSprint.index}`,
            status: currentSprint.status,
            startDate: currentSprint.startDate,
            endDate: currentSprint.endDate,
            passed: currentSprint.passed,
          },
          tasks: sprintTasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          })),
          totalSprints: sprints.length,
          allSprints: sprints.map((sp: any) => ({
            id: sp.id,
            index: sp.index,
            name: sp.name ?? null,
          })),
          completedTasks: completedTasksList.length,
          totalTasks: sprintTasks.length,
        };
      }
      return await apiRequest("GET", "/api/my-sprint");
    },
    enabled: !isAdmin || !!selectedTeamId,
  });

  // For admin: fetch selected team's tasks, for others: fetch their own tasks
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useQuery<TaskData>({
    queryKey: isAdmin && selectedTeamId ? ["/api/teams", selectedTeamId, "tasks"] : ["/api/my-tasks"],
    queryFn: async () => {
      if (isAdmin && selectedTeamId) {
        console.log("📊 Fetching tasks for team:", selectedTeamId);
        const teamTasks = await apiRequest("GET", `/api/teams/${selectedTeamId}/tasks`);
        console.log("✅ Team tasks fetched:", teamTasks);
        // assigneeIds, the dates and the submission state are all in the response and were
        // being dropped here — which is why this page could only ever show team totals.
        const mappedTasks = teamTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          points: t.points || 1,
          assigneeId: t.assigneeId ?? null,
          assigneeIds: Array.isArray(t.assigneeIds)
            ? t.assigneeIds
            : typeof t.assigneeIds === "string"
              ? (() => {
                  try { return JSON.parse(t.assigneeIds); } catch { return null; }
                })()
              : null,
          startDate: t.startDate ?? null,
          endDate: t.endDate ?? null,
          submitters: t.submitters ?? [],
          changesRequestedBy: t.changesRequestedBy ?? [],
        }));
        console.log("📋 Mapped tasks:", mappedTasks);
        return mappedTasks;
      }
      return await apiRequest("GET", "/api/my-tasks");
    },
    enabled: !isAdmin || !!selectedTeamId,
    // Was 5s. This query now carries evidence enrichment for every task, so twelve of them a
    // minute per open tab is real load for a page nobody watches second by second.
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const isLoading = teamLoading || sprintLoading || tasksLoading;

  if (isLoading) {
    return (
      <AppLayout title="Analytics">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const totalTasks = tasks?.length || 0;
  const todoTasks = tasks?.filter((t) => t.status === "TODO").length || 0;
  const inProgressTasks = tasks?.filter((t) => t.status === "IN_PROGRESS").length || 0;
  const doneTasks = tasks?.filter((t) => t.status === "DONE").length || 0;
  const reviewTasks = tasks?.filter((t) => t.status === "REVIEW").length || 0;

  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const totalPoints = tasks?.reduce((sum, t) => sum + (t.points || 1), 0) || 0;
  const completedPoints = tasks?.filter((t) => t.status === "DONE").reduce((sum, t) => sum + (t.points || 1), 0) || 0;

  const getHealthColor = (status: string) => {
    switch (status) {
      case "Green":
        return "text-green-500";
      case "Amber":
        return "text-amber-500";
      case "Red":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <AppLayout title="Analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Analytics</h1>
            <p className="text-muted-foreground">
              Track your progress and performance metrics
            </p>
          </div>
          {isAdmin ? (
            <div className="flex items-center gap-4">
              <div className="w-64">
                <Label className="text-sm font-medium mb-2 block">Select Team</Label>
                <Select
                  value={selectedTeamId || ""}
                  onValueChange={(value) => {
                    setSelectedTeamId(value || null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a team to view analytics" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams?.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <PageTourButton pageKey="analytics" />
              <Badge variant="outline" className="text-lg px-3 py-1 border-border text-foreground">
                <BarChart3 className="h-4 w-4 mr-2" />
                {teamData?.name || "My Team"}
              </Badge>
            </div>
          )}
        </div>

        {/* Show message if admin hasn't selected a team */}
        {isAdmin && !selectedTeamId ? (
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-20 text-muted-foreground" />
              <p className="text-muted-foreground">Please select a team from the dropdown above to view analytics</p>
            </CardContent>
          </Card>
        ) : (
          <>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl hover:shadow-lg transition-shadow" data-testid="stat-completion" data-tour="analytics-completion-rate">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Completion Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{completionRate}%</div>
              <Progress value={completionRate} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl hover:shadow-lg transition-shadow" data-testid="stat-total-tasks" data-tour="analytics-total-tasks">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Total Tasks</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{totalTasks}</div>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <p className="text-xs text-muted-foreground">
                    {doneTasks} completed
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-primary"></div>
                  <p className="text-xs text-muted-foreground">
                    {inProgressTasks} in progress
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl hover:shadow-lg transition-shadow" data-testid="stat-points" data-tour="analytics-points-earned">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Points Earned</CardTitle>
              <Zap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{completedPoints}</div>
              <p className="text-xs text-muted-foreground">
                of {totalPoints} total points
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl hover:shadow-lg transition-shadow" data-testid="stat-sprints">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Sprint Progress</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">
                {sprintData?.sprint?.index || 0}/{sprintData?.totalSprints || 8}
              </div>
              <p className="text-xs text-muted-foreground">
                Current sprint
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Task Distribution */}
          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl" data-tour="analytics-task-distribution">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Activity className="h-5 w-5" />
                Task Distribution
              </CardTitle>
              <CardDescription>
                Breakdown of tasks by status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/30 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{doneTasks}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{inProgressTasks}</div>
                  <div className="text-xs text-muted-foreground">In Progress</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-muted-foreground" />
                    <span className="text-sm text-foreground">To Do</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{todoTasks}</span>
                    <Progress 
                      value={totalTasks > 0 ? (todoTasks / totalTasks) * 100 : 0} 
                      className="w-24 h-2" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="text-sm text-foreground">In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{inProgressTasks}</span>
                    <Progress 
                      value={totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0} 
                      className="w-24 h-2 [&>div]:bg-primary" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-foreground">In Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{reviewTasks}</span>
                    <Progress 
                      value={totalTasks > 0 ? (reviewTasks / totalTasks) * 100 : 0} 
                      className="w-24 h-2 [&>div]:bg-amber-500" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm text-foreground">Done</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{doneTasks}</span>
                    <Progress 
                      value={totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0} 
                      className="w-24 h-2 [&>div]:bg-green-500" 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Health & Role */}
          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl" data-tour="analytics-your-profile">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TrendingUp className="h-5 w-5" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Your role and standing in the team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Team</span>
                  <span className="font-medium">{teamData?.name || "Unassigned"}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge>{teamData?.userRole || "Member"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Stipend Band</span>
                  <Badge variant="outline">Band {teamData?.userBand || "C"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Equity Share</span>
                  <span className="font-medium">{teamData?.userEquity || "0"}%</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Team Health</span>
                  <span className={`font-medium ${getHealthColor(teamData?.healthStatus || "Green")}`}>
                    {teamData?.healthStatus || "Green"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Track</span>
                  <Badge variant="secondary">{teamData?.track || "EduTech"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Tips */}
        <Card className="border-primary/20 bg-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Award className="h-5 w-5 text-primary" />
              Performance Insights
            </CardTitle>
          </CardHeader>
          <MemberTaskBreakdown
          tasks={tasks ?? []}
          members={(teamData as any)?.members}
          sprints={(sprintData as any)?.allSprints}
        />

        <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {completionRate < 50 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                  <Target className="h-5 w-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Focus on Task Completion</p>
                    <p className="text-xs text-muted-foreground">
                      Your completion rate is below 50%. Try to close out pending tasks before taking new ones.
                    </p>
                  </div>
                </div>
              )}
              {completionRate >= 80 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Great Progress!</p>
                    <p className="text-xs text-muted-foreground">
                      You're making excellent progress with {completionRate}% completion rate. Keep it up!
                    </p>
                  </div>
                </div>
              )}
              {inProgressTasks > 3 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Too Many In Progress</p>
                    <p className="text-xs text-muted-foreground">
                      You have {inProgressTasks} tasks in progress. Consider completing some before starting new ones.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background">
                <Zap className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Points Progress</p>
                  <p className="text-xs text-muted-foreground">
                    You've earned {completedPoints} of {totalPoints} total points ({totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0}%).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
