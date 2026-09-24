import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ApplicantProfileModal } from "@/components/ApplicantProfileModal";
import { ProblemStatementOverviewModal, type ProblemStatementOverview } from "@/components/ProblemStatementOverviewModal";
import { RolesResponsibilitiesModal } from "@/components/RolesResponsibilitiesModal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  SPRINT_PHASE_LABELS,
  sprintPhase,
  sprintTimingLabel,
} from "@shared/sprintPhase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Code2,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Target,
  User,
  Users,
  Video,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { TeamMeetings } from "@/components/common-pages/team-meetings";
import { format, isFuture } from "date-fns";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";

// Component to show meetings for a specific team (for mentors with multiple teams)
function TeamMeetingsForMentor({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { data: meetings, isLoading } = useQuery({
    queryKey: ["/api/teams", teamId, "meetings"],
    queryFn: async () => {
      return apiRequest("GET", `/api/teams/${teamId}/meetings`);
    },
    enabled: !!teamId,
  });

  const upcomingMeetings = meetings?.filter((m: any) => isFuture(new Date(m.scheduledAt))) || [];
  const nextMeetings = upcomingMeetings.slice(0, 2);

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (nextMeetings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No upcoming meetings</p>
    );
  }

  return (
    <div className="space-y-2">
      {nextMeetings.map((meeting: any) => (
        <div
          key={meeting.id}
          className="flex items-center justify-between p-2 border border-border rounded bg-card text-sm"
        >
          <div>
            <p className="font-medium">{meeting.title}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(meeting.scheduledAt), "PPP 'at' p")}
            </p>
          </div>
          {meeting.meetingLink && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => window.open(meeting.meetingLink!, "_blank")}
            >
              <Video className="h-3 w-3 mr-1" />
              Join
            </Button>
          )}
        </div>
      ))}
      {upcomingMeetings.length > 2 && (
        <p className="text-xs text-muted-foreground text-center">
          +{upcomingMeetings.length - 2} more meetings
        </p>
      )}
    </div>
  );
}

type Team = {
  id: string;
  name: string;
  track: string;
  healthStatus: string;
  memberCount: number;
  currentSprint: number;
};

type Sprint = {
  id: string;
  index: number;
  title: string;
  status: string;
  passed: boolean;
  startDate: string;
  endDate: string;
  teamName: string;
  teamId: string;
  objectives?: string;
  deliverables?: string;
  tasks?: Task[];
};

type Task = {
  id: string;
  title: string;
  status: string;
  description?: string;
  objectives?: string;
  deliverables?: string;
  startDate?: string;
  endDate?: string;
  dependencies?: string;
};

type Review = {
  id: string;
  teamName: string;
  sprintNumber: number;
  notes: string;
  dueDate: string;
};

type MentorSession = {
  id: string;
  teamId: string;
  teamName?: string;
  type: "SCHEDULED" | "AD_HOC" | "REVIEW";
  occurredAt: string;
  durationMinutes: number;
  notes: string | null;
};

type TeamMemberApplication = {
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
  founderProblemStatement?: ProblemStatementOverview | null;
};

export default function MentorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showRolesModal, setShowRolesModal] = useState(false);
  const { startPageTourIfFirst } = useTourContext();
  const { data: experienceFlags } = useQuery<{
    hasSeenRolesResponsibilities: boolean;
    hasSeenSidebarTooltip: boolean;
  }>({
    queryKey: ["/api/auth/experience-flags"],
    queryFn: () => apiRequest("GET", "/api/auth/experience-flags"),
    enabled: !!user?.id,
  });

  useEffect(() => {
    startPageTourIfFirst("m-dashboard");
  }, []);
  const [activeTab, setActiveTab] = useState("teams");
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedSprintId, setSelectedSprintId] = useState("");
  const [filterTeamId, setFilterTeamId] = useState<string>(() => {
    return localStorage.getItem("mentor_selectedTeamId") || "all";
  });

  const handleFilterTeamChange = (value: string) => {
    setFilterTeamId(value);
    localStorage.setItem("mentor_selectedTeamId", value);
  };
  const [sessionType, setSessionType] = useState<"SCHEDULED" | "AD_HOC" | "REVIEW">("SCHEDULED");
  const [sessionDuration, setSessionDuration] = useState("60");
  const [sessionNotes, setSessionNotes] = useState("");
  const [reviewScore, setReviewScore] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [showFounderDetailsDialog, setShowFounderDetailsDialog] = useState(false);
  const [selectedFounder, setSelectedFounder] = useState<any | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  
  // Applicant profile modal state
  const [showApplicantProfile, setShowApplicantProfile] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showPsOverview, setShowPsOverview] = useState(false);
  const [viewingPsOverview, setViewingPsOverview] = useState<ProblemStatementOverview | null>(null);
  const [viewingPsFounderName, setViewingPsFounderName] = useState<string>("");
  const [rubricScores, setRubricScores] = useState({
    codeQuality: 3,
    reliability: 3,
    ux: 3,
    customerInterviews: 3,
    goToMarket: 3,
    professionalism: 3,
  });

  useEffect(() => {
    if (user?.id && experienceFlags && !experienceFlags.hasSeenRolesResponsibilities) {
      setShowRolesModal(true);
    }
  }, [user?.id, experienceFlags]);

  const { data: teamsData, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/mentor/teams"],
  });

  const { data: sprintsData, isLoading: sprintsLoading } = useQuery<Sprint[]>({
    queryKey: ["/api/mentor/sprints"],
  });

  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ["/api/mentor/reviews"],
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<MentorSession[]>({
    queryKey: ["/api/mentor/sessions"],
  });


  // Fetch received team member applications
  const { data: receivedApplications = [], isLoading: applicationsLoading, refetch: refetchApplications } = useQuery<TeamMemberApplication[]>({
    queryKey: ["/api/team-member-applications/received"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/team-member-applications/received");
      return data;
    },
    enabled: !!user && user.role === "MENTOR",
  });

  const pendingApplications = receivedApplications.filter(app => app.status === "PENDING");

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

  const createSessionMutation = useMutation({
    mutationFn: async (data: { teamId: string; type: string; durationMinutes: number; notes: string | null }) => {
      // apiRequest returns the PARSED body, not a Response, so there is nothing to call .json()
      // on — doing so threw and reported "Failed to log session" for a session the server had
      // already created with 201.
      //
      // sessionType, not type: the column is session_type, and Drizzle silently drops a key that
      // matches no column, so every session was being filed as the default "check-in" whatever
      // the dropdown said.
      const { type, ...rest } = data;
      return apiRequest("POST", "/api/mentor/sessions", {
        ...rest,
        sessionType: type,
        occurredAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor/sessions"] });
      toast({ title: "Session logged", description: "Mentor session has been recorded" });
      setShowSessionDialog(false);
      setSessionNotes("");
      setSessionDuration("60");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log session", variant: "destructive" });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: { sprintId: string; score: number; notes: string; rubricJson: object }) => {
      // apiRequest already returns the parsed body; calling .json() on it threw and reported a
      // failure for a review the server had accepted.
      return apiRequest("POST", `/api/sprints/${data.sprintId}/reviews`, {
        score: data.score,
        notes: data.notes,
        rubricJson: data.rubricJson,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor/reviews"] });
      toast({ title: "Review submitted", description: "Sprint review has been submitted" });
      setShowReviewDialog(false);
      setReviewScore("");
      setReviewNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit review", variant: "destructive" });
    },
  });

  const passSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      // Parsed body already; .json() on it threw and told the mentor the sprint had not passed
      // when it had.
      return apiRequest("POST", `/api/sprints/${sprintId}/pass`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor/sprints"] });
      toast({ title: "Sprint passed", description: "Sprint marked as passed. Stipends released." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to pass sprint", variant: "destructive" });
    },
  });

  const failSprintMutation = useMutation({
    mutationFn: async (sprintId: string) => {
      // Parsed body already; .json() on it threw and told the mentor the sprint had not failed
      // when it had.
      return apiRequest("POST", `/api/sprints/${sprintId}/fail`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mentor/sprints"] });
      toast({ title: "Sprint failed", description: "Sprint marked as failed. Stipends held." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to fail sprint", variant: "destructive" });
    },
  });

  // Approve/reject team member application
  const handleApplicationAction = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: "ACCEPTED" | "REJECTED" }) => {
      return apiRequest("PATCH", `/api/team-member-applications/${applicationId}`, { status });
    },
    onSuccess: async (_, variables) => {
      await refetchApplications();
      if (variables.status === "ACCEPTED") {
        toast({ title: "Application approved", description: "The founder has been notified." });
      } else {
        toast({ title: "Application rejected", description: "The application has been rejected." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update application", variant: "destructive" });
    },
  });

  const handleViewFounderDetails = (founderId: string, applicationId: string) => {
    setSelectedApplicantId(founderId);
    setSelectedApplicationId(applicationId);
    setShowApplicantProfile(true);
  };

  const teams = teamsData || [];
  const sprints = sprintsData || [];
  const reviews = reviewsData || [];
  const sessions = sessionsData || [];

  const totalSessions = sessions.length;

  // Derived filtered lists based on the team dropdown selection
  const filteredSprints = filterTeamId === "all" ? sprints : sprints.filter(s => s.teamId === filterTeamId);
  const filteredReviews = filterTeamId === "all" ? reviews : reviews.filter(r => {
    const team = teams.find(t => t.id === filterTeamId);
    return team ? r.teamName === team.name : true;
  });
  const filteredSessions = filterTeamId === "all" ? sessions : sessions.filter(s => s.teamId === filterTeamId);
  const filteredTeams = filterTeamId === "all" ? teams : teams.filter(t => t.id === filterTeamId);

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "Green": return "bg-green-500";
      case "Amber": return "bg-[#D4A574]";
      case "Red": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <AppLayout 
      title="Mentor Dashboard"
      headerAction={
        <div className="flex items-center gap-2">
          <PageTourButton pageKey="m-dashboard" />
          {/* Team filter dropdown */}
          {teams.length > 0 && (
            <Select value={filterTeamId} onValueChange={handleFilterTeamChange}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-14 w-14 bg-card backdrop-blur-xl border border-border hover:border-primary/50">
              <Bell className={`h-9 w-9 text-primary ${shouldShake ? 'animate-shake' : ''}`} />
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
              ) : receivedApplications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No applications</div>
              ) : (
                <div className="space-y-4">
                  {/* New Applications */}
                  {pendingApplications.length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">New Applications</div>
                      {pendingApplications.map((app) => (
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
                              onClick={() => handleViewFounderDetails(app.founderId, app.id)}
                              className="flex-1"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApplicationAction.mutate({ applicationId: app.id, status: "ACCEPTED" })}
                              disabled={handleApplicationAction.isPending}
                              className="flex-1"
                            >
                              {handleApplicationAction.isPending ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApplicationAction.mutate({ applicationId: app.id, status: "REJECTED" })}
                              disabled={handleApplicationAction.isPending}
                              className="flex-1"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Approved - Applications that mentor has accepted */}
                  {receivedApplications.filter(app => app.status === "ACCEPTED").length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Approved</div>
                      {receivedApplications.filter(app => app.status === "ACCEPTED").map((app) => (
                        <div key={app.id} className="p-3 border-b last:border-b-0 bg-green-50 dark:bg-green-900/10">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{app.founder?.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{app.founder?.email}</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Approved</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Under Approval - PENDING applications that are being reviewed */}
                  {receivedApplications.filter(app => app.status === "PENDING").length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Under Approval</div>
                      {receivedApplications.filter(app => app.status === "PENDING").map((app) => (
                        <div key={app.id} className="p-3 border-b last:border-b-0 bg-muted/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{app.founder?.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{app.founder?.email}</p>
                            </div>
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800">Pending</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedApplicantId(app.founderId); setShowApplicantProfile(true); }}>
                              <Eye className="h-3 w-3 mr-1" /> Profile
                            </Button>
                            {app.founderProblemStatement && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setViewingPsOverview(app.founderProblemStatement!); setViewingPsFounderName(app.founder?.name || "Founder"); setShowPsOverview(true); }}>
                                <FileText className="h-3 w-3 mr-1" /> Problem statement
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Shared - Applications that have been shared with the team */}
                  {receivedApplications.filter(app => app.status === "ACCEPTED").length > 0 && (
                    <div>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Shared</div>
                      {receivedApplications.filter(app => app.status === "ACCEPTED").map((app) => (
                        <div key={app.id} className="p-3 border-b last:border-b-0 bg-muted/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{app.founder?.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{app.founder?.email}</p>
                            </div>
                            <Badge variant="secondary">Shared</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedApplicantId(app.founderId); setShowApplicantProfile(true); }}>
                              <Eye className="h-3 w-3 mr-1" /> Profile
                            </Button>
                            {app.founderProblemStatement && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setViewingPsOverview(app.founderProblemStatement!); setViewingPsFounderName(app.founder?.name || "Founder"); setShowPsOverview(true); }}>
                                <FileText className="h-3 w-3 mr-1" /> Problem statement
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      }
    >
      <div data-tour="m-stat-cards" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl transition-all duration-300" data-testid="card-stat-teams" data-tour="m-pg-dash-stat-teams">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Assigned Teams</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{teamsLoading ? "-" : teams.length}</div>
            <p className="text-xs text-muted-foreground">Active teams</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl transition-all duration-300" data-testid="card-stat-reviews" data-tour="m-pg-dash-stat-reviews">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Pending Reviews</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{reviewsLoading ? "-" : reviews.length}</div>
            <p className="text-xs text-muted-foreground">Due this week</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:shadow-xl transition-all duration-300" data-testid="card-stat-sessions" data-tour="m-pg-dash-stat-sessions">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Sessions This Month</CardTitle>
            <Video className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">{sessionsLoading ? "-" : totalSessions}</div>
            <p className="text-xs text-muted-foreground">Recorded sessions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid bg-muted/50 border border-border rounded-xl p-1" data-tour="m-tabs-list">
          <TabsTrigger value="teams" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground rounded-lg" data-testid="tab-teams" data-tour="m-tab-teams">
            <Users className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="sprints" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground rounded-lg" data-testid="tab-sprints" data-tour="m-tab-sprints">
            <Target className="h-4 w-4" />
            Sprints
          </TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground rounded-lg" data-testid="tab-reviews" data-tour="m-tab-reviews">
            <Star className="h-4 w-4" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground rounded-lg" data-testid="tab-sessions" data-tour="m-tab-sessions">
            <Video className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-transparent data-[state=inactive]:text-foreground rounded-lg" data-testid="tab-meetings" data-tour="m-tab-meetings">
            <Calendar className="h-4 w-4" />
            Meetings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teams">
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-foreground" data-tour="m-pg-dash-teams-title">Your Teams</CardTitle>
              <CardDescription className="text-muted-foreground">Teams assigned to you for mentorship</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {teamsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : teams.length > 0 ? (
                <div className="space-y-4">
                  {teams.map((team, teamIdx) => (
                    <Card key={team.id} className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-md rounded-xl hover:shadow-lg transition-shadow" data-testid={`card-team-${team.id}`} data-tour={teamIdx === 0 ? "m-pg-dash-team-card" : undefined}>
                      <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 rounded-full blur-md -translate-y-1/2 translate-x-1/2"></div>
                      <CardContent className="py-4 relative">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`h-3 w-3 rounded-full ${getHealthColor(team.healthStatus)}`} />
                            <div>
                              <h4 className="font-medium text-foreground">{team.name}</h4>
                              <p className="text-sm text-muted-foreground">{team.track}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              {team.memberCount} members
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4" />
                              Sprint {team.currentSprint}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-primary text-primary hover:bg-primary/10"
                              onClick={() => {
                                setSelectedTeamId(team.id);
                                setShowSessionDialog(true);
                              }}
                              data-testid={`button-log-session-${team.id}`}
                              data-tour={teamIdx === 0 ? "m-pg-dash-log-session" : undefined}
                            >
                              Log Session
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No teams assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sprints">
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Team Sprints</CardTitle>
              <CardDescription className="text-muted-foreground">Monitor and manage sprint progress</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {sprintsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredSprints.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {filteredSprints.map((sprint) => {
                      return (
                        <Card key={sprint.id} className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-md rounded-xl hover:shadow-lg transition-shadow" data-testid={`card-sprint-${sprint.id}`}>
                          <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 rounded-full blur-md -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="py-4 relative">
                            <div className="space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-foreground">Sprint {sprint.index}: {sprint.title}</h4>
                                {sprint.passed ? (
                                  <Badge className="bg-green-500">Passed</Badge>
                                ) : (
                                  <>
                                    <Badge variant="secondary">
                                      {SPRINT_PHASE_LABELS[sprintPhase(sprint as any)]}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {sprintTimingLabel(sprint as any)}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{sprint.teamName}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                                  <Link href={`/app/sprint-board?sprintId=${sprint.id}`}>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-primary text-primary hover:bg-primary/10"
                                      data-testid={`button-view-sprint-${sprint.id}`}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      View Sprint Board
                                    </Button>
                                  </Link>
                              {/* Was `sprint.status === "REVIEW"`, comparing against a column
                                  the sprints table does not have — so this was always false and
                                  neither button ever rendered, leaving no way to close a sprint
                                  anywhere in the app. Derived from the dates instead. */}
                              {!sprint.passed &&
                                (sprintPhase(sprint as any) === "DUE" ||
                                  sprintPhase(sprint as any) === "OVERDUE") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                        className="gap-1"
                                    onClick={() => passSprintMutation.mutate(sprint.id)}
                                    disabled={passSprintMutation.isPending}
                                    data-testid={`button-pass-sprint-${sprint.id}`}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Pass
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="gap-1"
                                    onClick={() => failSprintMutation.mutate(sprint.id)}
                                    disabled={failSprintMutation.isPending}
                                    data-testid={`button-fail-sprint-${sprint.id}`}
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                    Fail
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                    className="border-primary text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setSelectedSprintId(sprint.id);
                                  setShowReviewDialog(true);
                                }}
                                data-testid={`button-review-sprint-${sprint.id}`}
                              >
                                Submit Review
                              </Button>
                            </div>
                              </div>

                              {/* Sprint Objectives and Deliverables */}
                              {(sprint.objectives || sprint.deliverables) && (
                                <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-border">
                                  {sprint.objectives && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-foreground mb-1">Objectives</h5>
                                      <p className="text-sm text-muted-foreground">{sprint.objectives}</p>
                                    </div>
                                  )}
                                  {sprint.deliverables && (
                                    <div>
                                      <h5 className="text-xs font-semibold text-foreground mb-1">Deliverables</h5>
                                      <p className="text-sm text-muted-foreground">{sprint.deliverables}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Tasks Preview */}
                              {sprint.tasks && sprint.tasks.length > 0 && (
                                <div className="pt-2 border-t border-border">
                                  <h5 className="text-xs font-semibold text-foreground mb-2">Tasks ({sprint.tasks.length})</h5>
                                  <div className="space-y-2">
                                    {sprint.tasks.slice(0, 3).map((task) => (
                                      <div key={task.id} className="flex items-center gap-2 text-sm">
                                        <div className={`w-2 h-2 rounded-full ${
                                          task.status === "COMPLETED" ? "bg-green-500" :
                                          task.status === "IN_PROGRESS" ? "bg-amber-500" :
                                          "bg-muted-foreground"
                                        }`} />
                                        <span className="text-foreground">{task.title}</span>
                                        {task.startDate && task.endDate && (
                                          <span className="text-xs text-muted-foreground">
                                            ({formatDate(task.startDate)} - {formatDate(task.endDate)})
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {sprint.tasks.length > 3 && (
                                      <p className="text-xs text-muted-foreground">+{sprint.tasks.length - 3} more tasks</p>
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sprints found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Pending Reviews</CardTitle>
              <CardDescription className="text-muted-foreground">Reviews awaiting your submission</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {reviewsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredReviews.length > 0 ? (
                <div className="space-y-4">
                  {filteredReviews.map((review) => (
                    <Card key={review.id} className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-md rounded-xl hover:shadow-lg transition-shadow" data-testid={`card-review-${review.id}`}>
                      <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 rounded-full blur-md -translate-y-1/2 translate-x-1/2"></div>
                      <CardContent className="py-4 relative">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div>
                            <h4 className="font-medium text-foreground">{review.teamName}</h4>
                            <p className="text-sm text-muted-foreground">Sprint {review.sprintNumber}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Due: {formatDate(review.dueDate)}
                            </Badge>
                            <Button size="sm" data-testid={`button-complete-review-${review.id}`}>
                              Complete Review
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending reviews</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Mentor Sessions</CardTitle>
                  <CardDescription className="text-muted-foreground">Track your mentoring sessions</CardDescription>
                </div>
                <Button onClick={() => setShowSessionDialog(true)} className="gap-2" data-testid="button-new-session">
                  <Plus className="h-4 w-4" />
                  Log Session
                </Button>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {sessionsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredSessions.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {filteredSessions.map((session) => (
                      <Card key={session.id} className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-md rounded-xl hover:shadow-lg transition-shadow" data-testid={`card-session-${session.id}`}>
                        <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 rounded-full blur-md -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="py-4 relative">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-primary/10">
                                <Video className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-medium text-foreground">{session.teamName || "Team"}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {session.type} - {session.durationMinutes} min
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-foreground">{formatDate(session.occurredAt)}</p>
                              {session.notes && (
                                <p className="text-xs text-muted-foreground truncate max-w-48">{session.notes}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sessions recorded yet</p>
                  <Button onClick={() => setShowSessionDialog(true)} variant="outline" className="mt-4 border-primary text-primary hover:bg-primary/10">
                    Log your first session
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-foreground">Team Meetings</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Schedule and manage meetings with your teams
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/app/my-meetings"}
                >
                  View All Meetings
                </Button>
              </div>
            </CardHeader>
            <CardContent className="relative">
              {teamsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredTeams.length > 0 ? (
                <div className="space-y-4">
                  {filteredTeams.map((team) => (
                    <div key={team.id} className="border border-border rounded-lg p-4">
                      <h4 className="font-semibold mb-3">{team.name}</h4>
                      <TeamMeetingsForMentor teamId={team.id} teamName={team.name} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No teams assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Mentor Session</DialogTitle>
            <DialogDescription>Record a mentoring session with a team</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger data-testid="select-session-team">
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Session Type</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as "SCHEDULED" | "AD_HOC" | "REVIEW")}>
                <SelectTrigger data-testid="select-session-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHEDULED">Scheduled Check-in</SelectItem>
                  <SelectItem value="AD_HOC">Ad-hoc Session</SelectItem>
                  <SelectItem value="REVIEW">Sprint Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(e.target.value)}
                data-testid="input-session-duration"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Key discussion points..."
                data-testid="input-session-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={() => setShowSessionDialog(false)}>Cancel</Button>
            <Button
              className=""
              onClick={() => createSessionMutation.mutate({
                teamId: selectedTeamId,
                type: sessionType,
                durationMinutes: parseInt(sessionDuration),
                notes: sessionNotes || null,
              })}
              disabled={!selectedTeamId || createSessionMutation.isPending}
              data-testid="button-submit-session"
            >
              {createSessionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : "Log Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-[#D4A574]" />
              Submit Sprint Review
            </DialogTitle>
            <DialogDescription>Evaluate the team's sprint performance across 6 key criteria</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-blue-500" />
                    <Label className="font-medium">Code Quality</Label>
                  </div>
                  <Badge variant="outline">{rubricScores.codeQuality}/5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Clean, maintainable, well-documented code</p>
                <Slider
                  value={[rubricScores.codeQuality]}
                  onValueChange={([v]) => setRubricScores({ ...rubricScores, codeQuality: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                  data-testid="slider-code-quality"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span><span>Basic</span><span>Good</span><span>Very Good</span><span>Excellent</span>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <Label className="font-medium">Reliability</Label>
                  </div>
                  <Badge variant="outline">{rubricScores.reliability}/5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Stability, error handling, test coverage</p>
                <Slider
                  value={[rubricScores.reliability]}
                  onValueChange={([v]) => setRubricScores({ ...rubricScores, reliability: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                  data-testid="slider-reliability"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span><span>Basic</span><span>Good</span><span>Very Good</span><span>Excellent</span>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label className="font-medium">User Experience</Label>
                  </div>
                  <Badge variant="outline">{rubricScores.ux}/5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Intuitive design, accessibility, visual appeal</p>
                <Slider
                  value={[rubricScores.ux]}
                  onValueChange={([v]) => setRubricScores({ ...rubricScores, ux: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                  data-testid="slider-ux"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span><span>Basic</span><span>Good</span><span>Very Good</span><span>Excellent</span>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-500" />
                    <Label className="font-medium">Customer Interviews</Label>
                  </div>
                  <Badge variant="outline">{rubricScores.customerInterviews}/5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Evidence of user research and validation</p>
                <Slider
                  value={[rubricScores.customerInterviews]}
                  onValueChange={([v]) => setRubricScores({ ...rubricScores, customerInterviews: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                  data-testid="slider-customer-interviews"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span><span>Basic</span><span>Good</span><span>Very Good</span><span>Excellent</span>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-cyan-500" />
                    <Label className="font-medium">Go-to-Market</Label>
                  </div>
                  <Badge variant="outline">{rubricScores.goToMarket}/5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Marketing strategy, launch readiness, traction</p>
                <Slider
                  value={[rubricScores.goToMarket]}
                  onValueChange={([v]) => setRubricScores({ ...rubricScores, goToMarket: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                  data-testid="slider-go-to-market"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span><span>Basic</span><span>Good</span><span>Very Good</span><span>Excellent</span>
                </div>
              </div>

              <div className="space-y-3 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Professionalism</Label>
                  </div>
                  <Badge variant="outline">{rubricScores.professionalism}/5</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Communication, responsiveness, teamwork</p>
                <Slider
                  value={[rubricScores.professionalism]}
                  onValueChange={([v]) => setRubricScores({ ...rubricScores, professionalism: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="py-2"
                  data-testid="slider-professionalism"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Poor</span><span>Basic</span><span>Good</span><span>Very Good</span><span>Excellent</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label className="font-medium">Calculated Score</Label>
                  <p className="text-xs text-muted-foreground">Average of rubric scores (out of 100)</p>
                </div>
                <div className="text-2xl font-bold">
                  {Math.round(
                    ((rubricScores.codeQuality +
                      rubricScores.reliability +
                      rubricScores.ux +
                      rubricScores.customerInterviews +
                      rubricScores.goToMarket +
                      rubricScores.professionalism) /
                      30) *
                      100
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Override Score (optional)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={reviewScore}
                  onChange={(e) => setReviewScore(e.target.value)}
                  placeholder="Leave blank to use calculated score"
                  data-testid="input-review-score"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reviewNotes">Feedback for Team</Label>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide detailed feedback, areas for improvement, and positive highlights..."
                  rows={4}
                  data-testid="input-review-notes"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={() => setShowReviewDialog(false)}>Cancel</Button>
            <Button
              className=""
              onClick={() => {
                const calculatedScore = Math.round(
                  ((rubricScores.codeQuality +
                    rubricScores.reliability +
                    rubricScores.ux +
                    rubricScores.customerInterviews +
                    rubricScores.goToMarket +
                    rubricScores.professionalism) /
                    30) *
                    100
                );
                submitReviewMutation.mutate({
                  sprintId: selectedSprintId,
                  score: reviewScore ? parseInt(reviewScore) : calculatedScore,
                  notes: reviewNotes,
                  rubricJson: rubricScores,
                });
              }}
              disabled={submitReviewMutation.isPending}
              data-testid="button-submit-review"
            >
              {submitReviewMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Founder Details Dialog */}
      <Dialog open={showFounderDetailsDialog} onOpenChange={setShowFounderDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Founder Details</DialogTitle>
            <DialogDescription>View complete information about the founder</DialogDescription>
          </DialogHeader>
          {selectedFounder ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedFounder.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedFounder.email || "N/A"}</p>
                </div>
                {selectedFounder.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedFounder.phone}</p>
                  </div>
                )}
                {selectedFounder.specialization && (
                  <div>
                    <p className="text-sm text-muted-foreground">Specialization</p>
                    <p className="font-medium">{selectedFounder.specialization}</p>
                  </div>
                )}
                {selectedFounder.role && (
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium">{selectedFounder.role}</p>
                  </div>
                )}
              </div>
              {selectedFounder.education && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Education</p>
                  </div>
                  <p className="text-sm">{selectedFounder.education}</p>
                </div>
              )}
              {selectedFounder.skills && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Skills</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(selectedFounder.skills) ? (
                      selectedFounder.skills.map((skill: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{skill}</Badge>
                      ))
                    ) : (
                      <p className="text-sm">{selectedFounder.skills}</p>
                    )}
                  </div>
                </div>
              )}
              {selectedFounder.tracks && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">Tracks</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(selectedFounder.tracks) ? (
                      selectedFounder.tracks.map((track: string, idx: number) => (
                        <Badge key={idx} variant="outline">{track}</Badge>
                      ))
                    ) : (
                      <p className="text-sm">{selectedFounder.tracks}</p>
                    )}
                  </div>
                </div>
              )}
              {selectedFounder.formData && Object.keys(selectedFounder.formData).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Additional Information</p>
                  <div className="space-y-2">
                    {Object.entries(selectedFounder.formData).map(([key, value]) => {
                      if (!value || key === "education" || key === "skills" || key === "tracks" || key === "cvUrl") return null;
                      return (
                        <div key={key} className="text-sm">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>{" "}
                          <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Loading founder details...</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={() => setShowFounderDetailsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        role={user?.role || 'MENTOR'}
      />
    </AppLayout>
  );
}
