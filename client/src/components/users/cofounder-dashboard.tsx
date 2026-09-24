import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RolesResponsibilitiesModal } from "@/components/RolesResponsibilitiesModal";
import {
  Bell,
  CheckCircle2,
  CheckCircle,
  Eye,
  FileText,
  GraduationCap,
  IndianRupee,
  Loader2,
  Rocket,
  Users,
  XCircle,
  BookOpen,
  Calendar,
  Clock,
  Video,
  ExternalLink,
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
import { useTourContext } from "@/components/tour/TourContext";

export default function CoFounderDashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
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
  const { startPageTourIfFirst } = useTourContext();

  useEffect(() => {
    startPageTourIfFirst("cf-dashboard");
  }, []);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<{
    hasTeam: boolean;
    teamName: string | null;
    teamMembers: number;
    pendingApplications: number;
    acceptedApplications: number;
    totalApplications: number;
    cofoundersApplied: number;
    mentorsApplied: number;
    learnersApplied: number;
  }>({
    queryKey: ["/api/founder/stats"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/founder/stats");
        return data;
      } catch (error) {
        console.error("Stats fetch error:", error);
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading,
  });

  const { data: teams, isLoading: teamsLoading } = useQuery<{
    id: string;
    name: string;
    cohortId: string;
    problemId: string | null;
    mentorId: string | null;
  }[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/teams");
        return data;
      } catch (error) {
        console.error("Teams fetch error:", error);
        throw error;
      }
    },
    retry: 2,
    enabled: !!user && !authLoading,
  });

  // Cohort sessions (same as interns – by team's cohort)
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
    enabled: !!user && !authLoading,
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
  });

  const pendingApplications = receivedApplications.filter(a => a.status === "PENDING");

  // Shake bell for 3 seconds when new notifications arrive
  const [shouldShake, setShouldShake] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);
  const hasShakenForCurrentNotificationsRef = useRef<Set<string>>(new Set());
  const pendingApplicationIds = pendingApplications.map((a) => a.id).sort().join(",");

  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;
    const currentNotificationSet = pendingApplicationIds;

    const hasNewNotifications = previousCount !== null && pendingApplications.length > previousCount;
    const isFirstTime = previousCount === null && pendingApplications.length > 0;
    const hasNewNotificationIds = !hasShakenForCurrentNotificationsRef.current.has(currentNotificationSet);

    if ((isFirstTime || hasNewNotifications || hasNewNotificationIds) && pendingApplications.length > 0) {
      setShouldShake(true);
      hasShakenForCurrentNotificationsRef.current.add(currentNotificationSet);
      
      const timer = setTimeout(() => {
        setShouldShake(false);
      }, 3000); // 3 seconds

      return () => clearTimeout(timer);
    }

    previousUnreadCountRef.current = pendingApplications.length;
  }, [pendingApplications.length, pendingApplicationIds]);

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

  // Applicant profile modal state
  const [showApplicantProfile, setShowApplicantProfile] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showPsOverview, setShowPsOverview] = useState(false);
  const [viewingPsOverview, setViewingPsOverview] = useState<ProblemStatementOverview | null>(null);
  const [viewingPsFounderName, setViewingPsFounderName] = useState<string>("");

  const handleViewFounderDetails = (founderId: string) => {
    setSelectedApplicantId(founderId);
    setShowApplicantProfile(true);
  };

  const isLoading = statsLoading || teamsLoading;

  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        refetchStats(),
      ]);
      toast({ title: "Refreshed", description: "All data has been refreshed" });
    } catch (error) {
      toast({ title: "Refresh Failed", description: "Some data could not be refreshed", variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <AppLayout title="Co-Founder Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout title="Co-Founder Dashboard">
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-sm font-medium text-destructive">Not authenticated. Please log in.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Co-Founder Dashboard"
      headerAction={
        <div className="flex items-center gap-2">
        <PageTourButton pageKey="cf-dashboard" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-14 w-14 bg-card border border-border hover:border-primary/50">
              <Bell className={cn("h-9 w-9 text-primary", shouldShake && "animate-shake")} />
              {pendingApplications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {pendingApplications.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Team Member Applications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-96">
              {applicationsLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : pendingApplications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No pending applications</div>
              ) : (
                pendingApplications.map((app) => (
                  <div key={app.id} className="p-3 border-b last:border-b-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{app.founder?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{app.founder?.email}</p>
                        {app.message && (
                          <p className="text-xs text-muted-foreground mt-1">{app.message}</p>
                        )}
                      </div>
                      <Badge variant="outline">{app.status}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewFounderDetails(app.founder?.id || app.founderId)}
                        className="flex-1"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1"
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
                        className="flex-1"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      }
    >
      {statsError && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-2">Error loading data</p>
              <p className="text-xs text-muted-foreground">Stats: {statsError.message || "Unknown error"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleRefreshAll} className="ml-4">
              <Loader2 className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {isLoading && !statsError && (
        <div className="mb-4 p-4 bg-muted/50 border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-foreground">Loading dashboard data...</p>
          </div>
        </div>
      )}

      {/* Team Overview */}
      <Card data-tour="cf-team-overview" className="relative overflow-hidden bg-card border border-border shadow-xl rounded-2xl mb-8">
        <CardContent className="py-6 relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2 text-foreground">
                {statsLoading ? "Loading..." : stats?.teamName || "No Active Team"}
              </h1>
              <p className="text-muted-foreground">
                {stats?.hasTeam ? `${stats.teamMembers} team members • ${stats.pendingApplications} pending applications` : "You are not part of a team yet"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setLocation("/app/learning")}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Start Learning
              </Button>
              {/* Temporarily commented out - Join Team button
              {!stats?.hasTeam && (
                <Button 
                  onClick={() => setLocation("/app/join-team")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Join Team
                </Button>
              )}
              */}
              <Button variant="secondary" onClick={handleRefreshAll} disabled={isLoading}>
                <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div data-tour="cf-stats-grid" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Team Members</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.teamMembers || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Current team size
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.totalApplications || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.pendingApplications || 0} pending, {stats?.acceptedApplications || 0} accepted
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Co-Founders</CardTitle>
            <Rocket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.cofoundersApplied || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Applications sent
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Mentors & Interns</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats ? (stats.mentorsApplied + stats.learnersApplied) : 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.mentorsApplied || 0} mentors, {stats?.learnersApplied || 0} interns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Sessions (cohort sessions visible to co-founder) */}
      {(() => {
        const now = new Date();
        const activeSessions = cohortTasks.filter((session) => new Date(session.endTime) >= now);
        return activeSessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
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
                  const startTime = new Date(session.startTime);
                  const endTime = new Date(session.endTime);
                  const isUpcoming = startTime > now;
                  const isOngoing = startTime <= now && endTime >= now;
                  const formatDate = (dateStr: string) =>
                    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const formatTime = (dateStr: string) =>
                    new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                  return (
                    <Card
                      key={session.id}
                      className={`relative overflow-hidden border-2 shadow-lg rounded-xl transition-all duration-300 ${
                        isOngoing ? "border-green-400 bg-green-50 hover:shadow-xl" : "border-primary/40 bg-primary/5 hover:shadow-xl"
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg text-foreground">{session.title}</CardTitle>
                          {isOngoing && <Badge className="bg-green-500 text-white">LIVE</Badge>}
                          {isUpcoming && <Badge variant="secondary" className="bg-accent text-accent-foreground">Upcoming</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {session.description && <p className="text-sm text-muted-foreground line-clamp-2">{session.description}</p>}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">Start:</span>
                            <span>{formatDate(session.startTime)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span className="font-medium">End:</span>
                            <span>{formatDate(session.endTime)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-700">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">Time:</span>
                            <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
                          </div>
                        </div>
                        {session.meetingLink && (
                          <Button
                            className={`w-full mt-2 ${isOngoing ? "bg-green-600 hover:bg-green-700" : ""} text-white`}
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

      {/* Teams Overview */}
      <Card className="mb-8 relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        <CardHeader className="relative">
          <CardTitle className="text-foreground">Teams Overview</CardTitle>
          <CardDescription className="text-muted-foreground">All active teams in the current cohort</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          {teamsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : teams && teams.length > 0 ? (
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:border-primary/30 transition-colors">
                  <div>
                    <p className="font-medium text-foreground">{team.name}</p>
                    <p className="text-sm text-muted-foreground">Team ID: {team.id.slice(0, 8)}...</p>
                  </div>
                  <Badge variant="outline" className="border-primary text-primary bg-primary/10">Active</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No teams found</p>
          )}
        </CardContent>
      </Card>

      {/* Team Member Applications */}
      <Card data-tour="cf-applications-card" className="bg-card border border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-foreground">Team Member Applications</CardTitle>
          <CardDescription className="text-muted-foreground">
            Founders who have applied to work with you
            {receivedApplications.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-primary/30">
                {receivedApplications.filter(a => a.status === "PENDING").length} pending
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applicationsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : receivedApplications.length > 0 ? (
            <div className="space-y-4">
              {receivedApplications.map((app) => (
                <Card key={app.id} className="bg-card border border-border hover:border-primary/30 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {app.founder?.name ? app.founder.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "F"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium text-foreground">{app.founder?.name || (app as any).applicantName || "Unknown Founder"}</h4>
                          <p className="text-sm text-muted-foreground">{app.founder?.email || (app as any).applicantEmail || "N/A"}</p>
                          {app.message && (
                            <p className="text-sm text-muted-foreground mt-1 italic">"{app.message}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedApplicantId(app.founderId);
                            setShowApplicantProfile(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
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
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Problem statement
                          </Button>
                        )}
                        <Badge 
                          variant={
                            app.status === "ACCEPTED" ? "default" : 
                            app.status === "REJECTED" ? "destructive" : 
                            "secondary"
                          }
                          className={
                            app.status === "ACCEPTED" ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800" :
                            app.status === "REJECTED" ? "bg-destructive/10 text-destructive border-destructive/30" :
                            "bg-muted text-muted-foreground border-border"
                          }
                        >
                          {app.status}
                        </Badge>
                        {app.status === "PENDING" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateApplicationMutation.mutate({ id: app.id, status: "ACCEPTED" })}
                              disabled={updateApplicationMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateApplicationMutation.mutate({ id: app.id, status: "REJECTED" })}
                              disabled={updateApplicationMutation.isPending}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No applications received yet</p>
            </div>
          )}
        </CardContent>
      </Card>

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
        role={user?.role || 'COFOUNDER'}
      />
    </AppLayout>
  );
}

