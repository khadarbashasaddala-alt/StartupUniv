import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RolesResponsibilitiesModal } from "@/components/RolesResponsibilitiesModal";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  Code2,
  Eye,
  ExternalLink,
  FileText,
  IndianRupee,
  BookOpen,
  Lightbulb,
  ListTodo,
  Loader2,
  Rocket,
  Target,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ApplicantProfileModal } from "@/components/ApplicantProfileModal";
import { ProblemStatementOverviewModal, type ProblemStatementOverview } from "@/components/ProblemStatementOverviewModal";
import { PageTourButton } from "@/components/tour/PageTourButton";

export default function LearnerDashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showRolesModal, setShowRolesModal] = useState(false);

  const { data: experienceFlags } = useQuery<{
    hasSeenRolesResponsibilities: boolean;
    hasSeenSidebarTooltip: boolean;
  }>({
    queryKey: ["/api/auth/experience-flags"],
    queryFn: () => apiRequest("GET", "/api/auth/experience-flags"),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user?.id && experienceFlags && !experienceFlags.hasSeenRolesResponsibilities) {
      setShowRolesModal(true);
    }
  }, [user?.id, experienceFlags]);

  const { data: teamData, isLoading: teamLoading } = useQuery<{
    id: string;
    name: string;
    healthStatus: string;
    track: string;
    problemStatementId: string | null;
    userRole: string;
    userBand: string | null;
    userEquity: string;
    members: { id: string; name: string; role: string; band: string | null; userRole?: string }[];
  } | null>({
    queryKey: ["/api/my-team"],
  });

  const { data: sprintData, isLoading: sprintLoading } = useQuery<{
    sprint: { id: string; number: number; title: string; status: string; startDate: string; endDate: string } | null;
    tasks: { id: string; title: string; status: string; priority: string }[];
    totalSprints: number;
    completedTasks: number;
    totalTasks: number;
  }>({
    queryKey: ["/api/my-sprint"],
  });

  const { data: stipendsData } = useQuery<{
    stipends: { id: string; month: number; amount: string; status: string }[];
    totalReceived: number;
    nextDue: { month: number; amount: string } | null;
  }>({
    queryKey: ["/api/my-stipends"],
  });

  // Fetch cohort tasks/sessions for the current user
  type CohortTask = {
    id: string;
    cohortId: string;
    title: string;
    description: string | null;
    meetingLink: string | null;
    startTime: string;
    endTime: string;
    isActive: boolean;
    createdAt: string;
  };

  const { data: cohortTasks = [], isLoading: cohortTasksLoading } = useQuery<CohortTask[]>({
    queryKey: ["/api/my-cohort-tasks"],
    queryFn: () => apiRequest("GET", "/api/my-cohort-tasks"),
  });

  // Recent activity: my tasks (completed), team evidence, sprint standups
  const { data: myTasks = [] } = useQuery<{ id: string; title: string; status: string; createdAt: string }[]>({
    queryKey: ["/api/my-tasks"],
    queryFn: () => apiRequest("GET", "/api/my-tasks"),
    enabled: !!user && !authLoading,
  });
  const { data: teamEvidence = [] } = useQuery<{ id: string; title: string | null; type: string; createdAt: string }[]>({
    queryKey: ["/api/teams", teamData?.id, "evidence"],
    queryFn: () => apiRequest("GET", `/api/teams/${teamData!.id}/evidence`),
    enabled: !!teamData?.id,
  });
  const { data: sprintStandups = [] } = useQuery<{ id: string; createdAt: string }[]>({
    queryKey: ["/api/sprints", sprintData?.sprint?.id, "standups"],
    queryFn: () => apiRequest("GET", `/api/sprints/${sprintData!.sprint!.id}/standups`),
    enabled: !!(sprintData?.sprint?.id),
  });

  // Fetch received team member applications
  const { data: receivedApplications = [], isLoading: applicationsLoading, refetch: refetchApplications } = useQuery<{
    id: string;
    founderId: string;
    targetUserId: string;
    targetUserRole: string;
    message: string | null;
    status: string;
    createdAt: string;
    founder: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
    applicantName?: string;
    applicantEmail?: string;
    founderProblemStatement?: ProblemStatementOverview | null;
  }[]>({
    queryKey: ["/api/team-member-applications/received"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/team-member-applications/received");
      return data;
    },
    enabled: !!user && !authLoading,
    refetchOnMount: "always",
    staleTime: 0,
  });

  // Fetch all notifications
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<{
    id: string;
    type: string;
    title: string;
    message: string;
    status: string;
    createdAt: string;
    metadataJson: any;
  }[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/notifications");
      return data;
    },
    enabled: !!user && !authLoading,
    refetchOnMount: "always",
    staleTime: 0,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const pendingApplications = receivedApplications.filter(a => a.status === "PENDING");
  const unreadNotifications = notifications.filter(n => n.status === "UNREAD");
  const totalUnreadCount = unreadNotifications.length + pendingApplications.length;

  // Build recent activity from real data (completed tasks, evidence, standups)
  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return diffMins <= 1 ? "Just now" : `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };
  type ActivityItem = { id: string; text: string; time: string; icon: typeof CheckCircle2; color: string };
  const recentActivityWithDate: { item: ActivityItem; sortAt: number }[] = [
    ...myTasks.filter((t) => t.status === "DONE").map((t) => ({ item: { id: `task-${t.id}`, text: `Completed task: ${t.title}`, time: formatTimeAgo(t.createdAt), icon: CheckCircle2, color: "text-green-500" } as ActivityItem, sortAt: new Date(t.createdAt).getTime() })),
    ...teamEvidence.map((e) => ({ item: { id: `ev-${e.id}`, text: `Submitted evidence: ${e.title || e.type}`, time: formatTimeAgo(e.createdAt), icon: FileText, color: "text-primary" } as ActivityItem, sortAt: new Date(e.createdAt).getTime() })),
    ...sprintStandups.map((s) => ({ item: { id: `standup-${s.id}`, text: "Team standup completed", time: formatTimeAgo(s.createdAt), icon: Users, color: "text-orange-500" } as ActivityItem, sortAt: new Date(s.createdAt).getTime() })),
  ];
  const sortedRecentActivity = recentActivityWithDate.sort((a, b) => b.sortAt - a.sortAt).slice(0, 8).map((x) => x.item);

  // Upcoming: cohort tasks with startTime in the future
  const now = new Date();
  const upcomingEvents = cohortTasks
    .filter((t) => new Date(t.startTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5)
    .map((t) => {
      const start = new Date(t.startTime);
      const end = new Date(t.endTime);
      const sameDay = start.toDateString() === end.toDateString();
      const dateStr = sameDay
        ? start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ", " + start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      return { id: t.id, title: t.title, date: dateStr };
    });

  // Applicant profile modal state
  const [showApplicantProfile, setShowApplicantProfile] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showPsOverview, setShowPsOverview] = useState(false);
  const [viewingPsOverview, setViewingPsOverview] = useState<ProblemStatementOverview | null>(null);
  const [viewingPsFounderName, setViewingPsFounderName] = useState<string>("");

  // Shake bell for 3 seconds when new notifications arrive
  const [shouldShake, setShouldShake] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);
  const hasShakenForCurrentNotificationsRef = useRef<Set<string>>(new Set());
  const unreadNotificationIds = unreadNotifications.map((n) => n.id).sort().join(",");
  const pendingApplicationIds = pendingApplications.map((a) => a.id).sort().join(",");
  const combinedIds = `${unreadNotificationIds}-${pendingApplicationIds}`;

  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;
    const currentNotificationSet = combinedIds;

    const hasNewNotifications = previousCount !== null && totalUnreadCount > previousCount;
    const isFirstTime = previousCount === null && totalUnreadCount > 0;
    const hasNewNotificationIds = !hasShakenForCurrentNotificationsRef.current.has(currentNotificationSet);

    if ((isFirstTime || hasNewNotifications || hasNewNotificationIds) && totalUnreadCount > 0) {
      setShouldShake(true);
      hasShakenForCurrentNotificationsRef.current.add(currentNotificationSet);
      
      const timer = setTimeout(() => {
        setShouldShake(false);
      }, 3000); // 3 seconds

      return () => clearTimeout(timer);
    }

    previousUnreadCountRef.current = totalUnreadCount;
  }, [totalUnreadCount, combinedIds]);

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ACCEPTED" | "REJECTED" }) => {
      return apiRequest("PATCH", `/api/team-member-applications/${id}`, { status });
    },
    onSuccess: async (_, variables) => {
      await refetchApplications();
      if (variables.status === "ACCEPTED") {
        toast({ title: "Application approved", description: "The founder has been notified." });
      } else {
        toast({ title: "Application rejected", description: "The application has been rejected." });
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update application", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const handleViewFounderDetails = (founderId: string, applicationId: string) => {
    setSelectedApplicantId(founderId);
    setShowApplicantProfile(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN').format(amount);
  };

  const sprintProgress = sprintData?.totalTasks 
    ? Math.round((sprintData.completedTasks / sprintData.totalTasks) * 100) 
    : 0;
  
  const overallProgress = sprintData?.sprint && sprintData?.totalSprints 
    ? Math.round((sprintData.sprint.number / sprintData.totalSprints) * 100) 
    : 0;

  const pendingTasks = sprintData?.tasks?.filter(t => t.status !== 'DONE')?.length || 0;
  const teamMemberCount = teamData?.members?.length || 0;
  const nextStipendAmount = stipendsData?.nextDue?.amount || '0';

  return (
    <AppLayout 
      title="Dashboard"
      headerAction={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-14 w-14 bg-card border border-border hover:border-primary/50">
              <Bell className={cn("h-9 w-9 text-primary", shouldShake && "animate-shake")} />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {totalUnreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-96">
              {notificationsLoading || applicationsLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : totalUnreadCount === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No new notifications</div>
              ) : (
                <>
                  {/* Team Member Applications */}
                  {pendingApplications.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Team Applications</div>
                      {pendingApplications.map((app) => (
                        <div key={app.id} className="p-3 border-b last:border-b-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{app.founder?.name || (app as any).applicantName || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{app.founder?.email || (app as any).applicantEmail || "N/A"}</p>
                              {app.message && (
                                <p className="text-xs text-muted-foreground mt-1">"{app.message}"</p>
                              )}
                            </div>
                            <Badge variant="outline">{app.status}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewFounderDetails(app.founder?.id || app.founderId, app.id)}
                              className="w-full min-w-0 justify-center"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View profile
                            </Button>
                            {app.founderProblemStatement && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingPsOverview(app.founderProblemStatement!);
                                  setViewingPsFounderName(app.founder?.name || (app as any).applicantName || "Founder");
                                  setShowPsOverview(true);
                                }}
                                className="w-full min-w-0 justify-center"
                              >
                                <FileText className="h-3 w-3 mr-1" />
                                Problem statement
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="default"
                              className="w-full min-w-0 justify-center"
                              onClick={() => updateApplicationMutation.mutate({ id: app.id, status: "ACCEPTED" })}
                              disabled={updateApplicationMutation.isPending}
                            >
                              {updateApplicationMutation.isPending ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateApplicationMutation.mutate({ id: app.id, status: "REJECTED" })}
                              disabled={updateApplicationMutation.isPending}
                              className="w-full justify-center"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Other Notifications */}
                  {unreadNotifications.length > 0 && (
                    <>
                      {pendingApplications.length > 0 && <DropdownMenuSeparator />}
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Other Notifications</div>
                      {unreadNotifications.slice(0, 5).map((notification) => {
                        const metadata = notification.metadataJson || {};
                        const isProblemStatementNotification = notification.type === "PROBLEM_STATEMENT_APPLICATION_RECEIVED" || 
                                                               notification.type === "PROBLEM_STATEMENT_SUBMITTED" ||
                                                               notification.type === "PROBLEM_STATEMENT_PUBLISHED" ||
                                                               (metadata.problemStatementId);
                        return (
                          <div 
                            key={notification.id} 
                            className="p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                            onClick={() => {
                              // Mark as read when clicked
                              if (notification.status === "UNREAD") {
                                markAsReadMutation.mutate(notification.id);
                              }
                              // Navigate to open challenges if it's a problem statement notification
                              if (isProblemStatementNotification && metadata.problemStatementId) {
                                setLocation(`/app/open-challenges?view=${metadata.problemStatementId}`);
                              }
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{notification.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                              </div>
                              <Badge variant="default" className="text-xs">New</Badge>
                            </div>
                            {isProblemStatementNotification && metadata.problemStatementId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-2 border-primary text-primary hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (notification.status === "UNREAD") {
                                    markAsReadMutation.mutate(notification.id);
                                  }
                                  setLocation(`/app/open-challenges?view=${metadata.problemStatementId}`);
                                }}
                              >
                                View
                              </Button>
                            )}
                          </div>
                        );
                      })}
                      {unreadNotifications.length > 5 && (
                        <div className="p-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLocation("/app/notifications")}
                            className="w-full"
                          >
                            View All Notifications ({unreadNotifications.length})
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Welcome Banner */}
      <Card className="relative overflow-hidden bg-card backdrop-blur-2xl border border-border shadow-2xl rounded-2xl mb-8 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        <CardContent className="py-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2 text-foreground" data-testid="heading-welcome">
                Welcome back, {user?.name?.split(" ")[0]}!
              </h1>
              <p className="text-muted-foreground">
                Here's what's happening with your startup journey.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <PageTourButton pageKey="learner-dashboard" />
              {/* Temporarily commented out - Join Team button
              {!teamData && (
                <Button 
                  className="" 
                  onClick={() => setLocation("/app/open-challenges")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Join Team
                </Button>
              )}
              */}
              <Button
                className=""
                onClick={() => setLocation("/app/learning")}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Start Learning
              </Button>
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Current Sprint</div>
                  <div className="font-semibold text-foreground">
                    {sprintLoading ? "Loading..." : 
                      sprintData?.sprint ? `Sprint ${sprintData.sprint.number} of ${sprintData.totalSprints}` : "No sprint"}
                  </div>
                </div>
                <Progress value={overallProgress} className="w-24 h-3 [&>div]:bg-primary" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl hover:border-primary/30 transition-all duration-300" data-testid="card-stat-tasks" data-tour="dashboard-team-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Tasks Pending</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{sprintLoading ? "-" : pendingTasks}</div>
            <p className="text-xs text-muted-foreground">In current sprint</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl hover:border-primary/30 transition-all duration-300" data-testid="card-stat-sprint" data-tour="dashboard-pending-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Sprint Progress</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{sprintLoading ? "-" : `${sprintProgress}%`}</div>
            <Progress value={sprintProgress} className="h-2 mt-2 [&>div]:bg-primary" />
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl hover:border-primary/30 transition-all duration-300" data-testid="card-stat-team" data-tour="dashboard-accepted-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Team Members</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{teamLoading ? "-" : teamMemberCount}</div>
            <p className="text-xs text-muted-foreground">All active</p>
          </CardContent>
        </Card>

        {/* Next Stipend card hidden along with the Stipends page. Commented rather than deleted:
            leaving it visible while the page it links to is gone would show a learner a figure
            with nowhere to go and no way to check it. The query behind it is left in place so
            restoring this is a matter of uncommenting. */}
        {/* <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl hover:border-primary/30 transition-all duration-300" data-testid="card-stat-stipend" data-tour="dashboard-total-card">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Next Stipend</CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">₹{formatCurrency(parseInt(nextStipendAmount))}</div>
            <p className="text-xs text-muted-foreground">
              {stipendsData?.nextDue ? `Month ${stipendsData.nextDue.month}` : "All disbursed"}
            </p>
          </CardContent>
        </Card> */}
      </div>

      {/* Scheduled Sessions - Only show upcoming and ongoing sessions, not past ones */}
      {(() => {
        const now = new Date();
        const activeSessions = cohortTasks.filter(session => new Date(session.endTime) >= now);
        return activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Scheduled Sessions
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cohortTasksLoading ? (
                <>
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-48 w-full rounded-xl" />
                </>
              ) : (
                activeSessions.map((session) => {
                const now = new Date();
                const startTime = new Date(session.startTime);
                const endTime = new Date(session.endTime);
                const isUpcoming = startTime > now;
                const isOngoing = startTime <= now && endTime >= now;

                const formatDate = (dateStr: string) => {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                };

                const formatTime = (dateStr: string) => {
                  const date = new Date(dateStr);
                  return date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                };

                return (
                  <Card 
                    key={session.id}
                    className={`relative overflow-hidden border-2 shadow-lg rounded-xl transition-all duration-300 ${
                      isOngoing 
                        ? 'border-green-400 bg-green-50 hover:shadow-xl' 
                        : 'border-primary/40 bg-primary/5 hover:shadow-xl'
                    }`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isOngoing && (
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                          )}
                          <CardTitle className="text-lg text-foreground">{session.title}</CardTitle>
                        </div>
                        {isOngoing && (
                          <Badge className="bg-green-500 text-white">LIVE</Badge>
                        )}
                        {isUpcoming && (
                          <Badge variant="secondary" className="bg-accent text-accent-foreground">Upcoming</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {session.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{session.description}</p>
                      )}
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Start:</span>
                          <span>{formatDate(session.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">End:</span>
                          <span>{formatDate(session.endTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Time:</span>
                          <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
                        </div>
                      </div>
                      {session.meetingLink && (
                        <Button
                          className={`w-full mt-2 ${
                            isOngoing 
                              ? 'bg-green-600 hover:bg-green-700' 
                              : ''
                          } text-white`}
                          onClick={() => window.open(session.meetingLink!, "_blank")}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Join Session
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
        );
      })()}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Current Sprint */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl" data-tour="dashboard-meetings-section">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Current Sprint</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {sprintData?.sprint ? `Sprint ${sprintData.sprint.number}: ${sprintData.sprint.title}` : "No active sprint"}
                  </CardDescription>
                </div>
                {sprintData?.sprint && (
                  <Badge variant="outline" className="gap-1 border-primary text-primary">
                    <Clock className="h-3 w-3" />
                    {(() => {
                      const endDate = new Date(sprintData.sprint.endDate);
                      const today = new Date();
                      const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return daysLeft > 0 ? `${daysLeft} days left` : "Ended";
                    })()}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative">
              {sprintLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full bg-muted" />
                  <Skeleton className="h-12 w-full bg-muted" />
                  <Skeleton className="h-12 w-full bg-muted" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">Sprint Goals</span>
                      <span className="text-muted-foreground">
                        {sprintData?.completedTasks || 0} of {sprintData?.totalTasks || 0} complete
                      </span>
                    </div>
                    <Progress value={sprintProgress} className="h-2 [&>div]:bg-primary" />
                  </div>

                  <Separator />

                  <div className="space-y-3" data-tour="dashboard-team-members-section">
                    <h4 className="font-medium text-sm text-foreground">Your Tasks</h4>
                    {sprintData?.tasks && sprintData.tasks.length > 0 ? (
                      sprintData.tasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                task.status === "IN_PROGRESS"
                                  ? "bg-red-400"
                                  : task.status === "DONE"
                                  ? "bg-green-400"
                                  : "bg-slate-500"
                              }`}
                            />
                            <span className="text-sm text-foreground">{task.title}</span>
                          </div>
                          <Badge variant="outline" className="text-xs border-primary text-primary">
                            {task.priority || "Medium"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tasks in this sprint</p>
                    )}
                  </div>

                  <Link href="/app/sprint-board">
                    <Button variant="outline" className="w-full gap-2 border-primary text-primary hover:bg-primary/10" data-testid="button-view-sprint">
                      View Sprint Board
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity (real data: completed tasks, evidence, standups) */}
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sortedRecentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity yet. Complete tasks, submit evidence, or add standups to see them here.</p>
                ) : (
                  sortedRecentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg bg-muted ${activity.color}`}>
                        <activity.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Team Card */}
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-foreground">Your Team</CardTitle>
                {teamData && (
                  <Badge className={
                    teamData.healthStatus === "Green" 
                      ? "bg-green-500/10 text-green-600 dark:text-green-400"
                      : teamData.healthStatus === "Amber"
                      ? "bg-[#D4A574]/10 text-[#D4A574] dark:text-[#D4A574]"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }>
                    {teamData.healthStatus === "Green" ? "Active" : teamData.healthStatus === "Amber" ? "Warning" : "At Risk"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative">
              {teamLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : teamData ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Rocket className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{teamData.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {teamData.track || "No track"} Track
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Team Health</span>
                      <Badge className={
                        teamData.healthStatus === "Green" ? "bg-green-500" 
                          : teamData.healthStatus === "Amber" ? "bg-[#D4A574]" 
                          : "bg-red-500"
                      }>
                        {teamData.healthStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Your Role</span>
                      <span className="font-medium text-foreground">{teamData.userRole || "Member"}</span>
                    </div>
                    {/* Stipend Band hidden with the rest of the stipend UI. */}
                    {/* <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stipend Band</span>
                      <span className="font-medium text-foreground">Band {teamData.userBand || "C"}</span>
                    </div> */}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <div className="text-sm font-medium mb-2 text-foreground">Team Members</div>
                    <TooltipProvider>
                      <div className="flex -space-x-2">
                        {teamData.members.slice(0, 5).map((member) => (
                          <Tooltip key={member.id}>
                            <TooltipTrigger asChild>
                              <Avatar className="border-2 border-background cursor-pointer">
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.name)}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.name}</p>
                              <p className="text-xs text-muted-foreground">{member.role}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {teamData.members.length > 5 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-muted text-xs cursor-pointer">
                                +{teamData.members.length - 5}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{teamData.members.length - 5} more members</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TooltipProvider>
                  </div>

                  <Link href="/app/my-team">
                    <Button variant="outline" className="w-full mt-4 border-primary text-primary hover:bg-primary/10" data-testid="button-team-page">
                      Team Page
                    </Button>
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">You're not assigned to a team yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-base text-foreground">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 relative">
              {[
                { icon: FileText, label: "Submit Evidence", href: "/app/evidence" },
                { icon: CalendarDays, label: "View Schedule", href: "/app/schedule" },
                { icon: Lightbulb, label: "Problem Statement", href: "/app/problem" },
              ].map((link, i) => (
                <Link key={i} href={link.href}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                    data-testid={`link-${link.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming (real data: cohort tasks/sessions) */}
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-base text-foreground">Upcoming</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 relative">
              {cohortTasksLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming sessions. Check back later or view Schedule.</p>
              ) : (
                upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-2 rounded-lg bg-card border border-border">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.date}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Applicant Profile Modal */}
      <ApplicantProfileModal
        open={showApplicantProfile}
        onOpenChange={setShowApplicantProfile}
        userId={selectedApplicantId}
        title="Founder Details"
        description="Complete founder profile information"
      />
      <ProblemStatementOverviewModal
        open={showPsOverview}
        onClose={() => { setShowPsOverview(false); setViewingPsOverview(null); setViewingPsFounderName(""); }}
        problemStatement={viewingPsOverview}
        founderName={viewingPsFounderName || undefined}
      />
      <RolesResponsibilitiesModal
        isOpen={showRolesModal}
        onClose={() => {
          setShowRolesModal(false);
          if (user?.id) {
            void apiRequest("PATCH", "/api/auth/experience-flags", {
              hasSeenRolesResponsibilities: true,
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["/api/auth/experience-flags"] });
            });
          }
        }}
        role={user?.role || 'LEARNER'}
      />
    </AppLayout>
  );
}
