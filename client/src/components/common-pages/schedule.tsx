import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
  Target,
  CalendarDays,
  Timer,
} from "lucide-react";
import { PageTourButton } from "@/components/tour/PageTourButton";

type Sprint = {
  id: string;
  index: number;
  startDate: string;
  endDate: string;
  goals: string | null;
  passed: boolean | null;
  passedAt: string | null;
};

type TeamData = {
  id: string;
  name: string;
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
  totalSprints: number;
};

export default function SchedulePage() {
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: ["/api/my-team"],
  });

  const { data: sprints, isLoading: sprintsLoading } = useQuery<Sprint[]>({
    queryKey: [`/api/teams/${teamData?.id}/sprints`],
    enabled: !!teamData?.id,
  });

  const { data: currentSprintData, isLoading: currentLoading } = useQuery<SprintData>({
    queryKey: ["/api/my-sprint"],
  });

  const isLoading = teamLoading || sprintsLoading || currentLoading;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startStr = startDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const endStr = endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `${startStr} - ${endStr}`;
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getSprintStatus = (sprint: Sprint) => {
    const now = new Date();
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);

    if (sprint.passed === true) return "completed";
    if (sprint.passed === false) return "failed";
    if (now < start) return "upcoming";
    if (now > end) return "overdue";
    return "active";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Passed
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive/15 text-destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "active":
        return (
          <Badge className="bg-primary/15 text-primary">
            <PlayCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "overdue":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        );
      case "upcoming":
        return (
          <Badge variant="outline" className="border-border">
            <Circle className="h-3 w-3 mr-1" />
            Upcoming
          </Badge>
        );
      default:
        return <Badge variant="outline" className="border-border">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Schedule">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  const currentSprint = currentSprintData?.sprint;
  const totalSprints = currentSprintData?.totalSprints || 8;
  const completedSprints = (sprints ?? []).filter((s) => s.passed === true).length;
  const daysRemaining = currentSprint ? getDaysRemaining(currentSprint.endDate) : 0;
  const progressPercent = totalSprints > 0 ? Math.round((completedSprints / totalSprints) * 100) : 0;

  return (
    <AppLayout title="Schedule">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Schedule</h1>
            <p className="text-muted-foreground">
              Sprint timeline and program schedule
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PageTourButton pageKey="schedule" />
            <Badge variant="outline" className="text-lg px-3 py-1 border-border text-foreground">
              <Calendar className="h-4 w-4 mr-2" />
              {completedSprints}/{totalSprints} Sprints
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover-elevate" data-testid="stat-current-sprint" data-tour="schedule-current-sprint">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium">Current Sprint</CardTitle>
              <PlayCircle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">Sprint {currentSprint?.index || 1}</div>
              <p className="text-xs text-muted-foreground">
                {currentSprint ? formatDateRange(currentSprint.startDate, currentSprint.endDate) : "Not started"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-border bg-card" data-testid="stat-days-remaining" data-tour="schedule-days-remaining">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Days Remaining</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${daysRemaining <= 3 ? "text-destructive" : daysRemaining <= 7 ? "text-amber-600" : "text-foreground"}`}>
                {daysRemaining > 0 ? daysRemaining : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {daysRemaining <= 0 ? "Sprint ended" : daysRemaining === 1 ? "day left" : "days left"}
              </p>
            </CardContent>
          </Card>

          <Card className="hover-elevate border-border bg-card" data-testid="stat-progress" data-tour="schedule-program-progress">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Program Progress</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{progressPercent}%</div>
              <Progress value={progressPercent} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Current Sprint Details */}
        {currentSprint && (
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CalendarDays className="h-5 w-5" />
                  Sprint {currentSprint.index} Details
                </CardTitle>
                {getStatusBadge("active")}
              </div>
              <CardDescription>
                {formatDateRange(currentSprint.startDate, currentSprint.endDate)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Start Date</span>
                  <span className="font-medium text-foreground">{formatDate(currentSprint.startDate)}</span>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">End Date</span>
                  <span className="font-medium text-foreground">{formatDate(currentSprint.endDate)}</span>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Remaining</span>
                  <span className={`font-medium ${daysRemaining <= 3 ? "text-destructive" : "text-foreground"}`}>
                    {daysRemaining > 0 ? `${daysRemaining} days` : "Ended"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sprint Timeline */}
        <Card className="border-border bg-card" data-tour="schedule-sprint-timeline">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Calendar className="h-5 w-5" />
              Sprint Timeline
            </CardTitle>
            <CardDescription>
              Complete overview of all program sprints
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sprints && sprints.length > 0 ? (
              <div className="space-y-4">
                {sprints
                  .sort((a, b) => a.index - b.index)
                  .map((sprint, index) => {
                    const status = getSprintStatus(sprint);
                    const isActive = status === "active";

                    return (
                      <div
                        key={sprint.id}
                        className={`relative pl-8 pb-4 ${index < sprints.length - 1 ? "border-l-2 border-muted ml-3" : ""}`}
                        data-testid={`sprint-timeline-${sprint.index}`}
                      >
                        <div
                          className={`absolute left-0 top-0 -translate-x-1/2 h-6 w-6 rounded-full flex items-center justify-center ${
                            status === "completed"
                              ? "bg-green-500 text-white"
                              : status === "failed"
                              ? "bg-destructive text-destructive-foreground"
                              : isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {status === "completed" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : status === "failed" ? (
                            <AlertCircle className="h-4 w-4" />
                          ) : isActive ? (
                            <PlayCircle className="h-4 w-4" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </div>

                        <div className={`p-4 rounded-lg border ${isActive ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-foreground">Sprint {sprint.index}</h4>
                            {getStatusBadge(status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateRange(sprint.startDate, sprint.endDate)}
                          </p>
                          {sprint.goals && (
                            <p className="text-sm mt-2 text-muted-foreground">
                              <strong>Goals:</strong> {sprint.goals}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium text-foreground">No sprints scheduled</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  Sprint schedule will appear here once created by your mentor
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Program Overview */}
        <Card className="border-primary/20 bg-primary/10">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Program Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">4-Month Intensive Program</h4>
                <p className="text-sm text-muted-foreground">
                  The StartupUniv program runs for 4 months with 8 two-week sprints. Each sprint focuses on specific milestones and deliverables.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">Sprint Gating</h4>
                <p className="text-sm text-muted-foreground">
                  Sprints must be passed to unlock the next phase. Failed sprints result in stipend holds until the team catches up.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
