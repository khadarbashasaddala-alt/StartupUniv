import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoles, compositionPayload } from "@/hooks/use-roles";
import { CohortCompositionFields } from "@/components/admin/cohort-composition-fields";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  GraduationCap,
  IndianRupee,
  Loader2,
  Plus,
  Rocket,
  Users,
  AlertTriangle,
  Calendar,
  FolderKanban,
  UserPlus,
  UserMinus,
  Trash2,
  Bell,
  Clock,
  CheckCircle,
  Circle,
  AlertCircle,
  Target,
  TrendingUp,
  Activity,
  Zap,
  Award,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { CreateMeetingDialog } from "@/components/common-pages/create-meeting-dialog";
import { TeamMeetings } from "@/components/common-pages/team-meetings";

interface Team {
  id: string;
  name: string;
  cohortId: string;
  problemId: string | null;
  mentorId: string | null;
}

interface Sprint {
  id: string;
  teamId: string;
  index: number;
  startDate: string;
  endDate: string;
  goals: string | null;
  passed: boolean | null;
}

interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: "Promoter" | "CoPromoter" | "Member";
  stipendBand: "A" | "B" | "C" | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface UnassignedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showCohortDialog, setShowCohortDialog] = useState(false);
  const [showSprintDialog, setShowSprintDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  const [shouldShake, setShouldShake] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);
  const hasShakenForCurrentNotificationsRef = useRef<Set<string>>(new Set());
  
  // Add member form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"Promoter" | "CoPromoter" | "Member">("Member");

  // User form state
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [userPhone, setUserPhone] = useState("");
  const [userCohortId, setUserCohortId] = useState("");

  // Cohort form state
  const [cohortName, setCohortName] = useState("");
  const [cohortLocation, setCohortLocation] = useState("");
  const [cohortSeats, setCohortSeats] = useState("100");
  const [cohortStartDate, setCohortStartDate] = useState("");
  const [cohortEndDate, setCohortEndDate] = useState("");
  // Planned headcount per role code; fields come from the roles table
  const [cohortComposition, setCohortComposition] = useState<Record<string, string>>({});

  // Sprint form state
  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");
  const [sprintGoals, setSprintGoals] = useState("");

  // Team form state
  const [teamName, setTeamName] = useState("");
  const [teamCohortId, setTeamCohortId] = useState("");
  const [selectedAnalyticsTeamId, setSelectedAnalyticsTeamId] = useState<string | null>(null);

  // Meetings tab state
  const [meetingsSprintIndex, setMeetingsSprintIndex] = useState<number | null>(null);
  const [meetingsTeamId, setMeetingsTeamId] = useState<string | null>(null);
  const [showAdminMeetingDialog, setShowAdminMeetingDialog] = useState(false);

  // Fetch all sprints across all teams for meetings tab
  const { data: allAdminSprints } = useQuery<Array<{
    id: string;
    teamId: string;
    teamName: string;
    index: number;
    startDate: string;
    endDate: string;
    goals: string | null;
  }>>( {
    queryKey: ["/api/admin/sprints"],
    queryFn: () => apiRequest("GET", "/api/admin/sprints"),
    enabled: !!user && !authLoading,
  });

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<{
    totalUsers: number;
    totalApplications: number;
    pendingApplications: number;
    totalTeams: number;
    activeCohorts: number;
    usersByRole: {
      learners: number;
      mentors: number;
      admins: number;
    };
    applicationsByStatus: {
      new: number;
      review: number;
      offer: number;
      paid: number;
      reject: number;
    };
  }>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching stats...");
        const data = await apiRequest("GET", "/api/admin/stats");
        console.log("✅ Stats fetched:", data);
        return data;
      } catch (error: any) {
        console.error("❌ Stats fetch error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading, // Only fetch when user is authenticated
  });

  const { data: ticketStats } = useQuery<{
    total: number;
    open: number;
    closed: number;
    openHot: number;
    slaBreached: number;
    reopened: number;
    avgCloseHours: number;
  }>({
    queryKey: ["/api/tickets/stats"],
  });

  const { data: cohortStats, isLoading: cohortLoading, error: cohortError, refetch: refetchCohortStats } = useQuery<{
    name: string;
    currentSprint: number;
    totalSprints: number;
    weeksRemaining: number;
    teamHealth: { green: number; amber: number; red: number };
    seedDeployed: number;
    stipendsDisbursed: number;
  }>({
    queryKey: ["/api/admin/cohort-stats"],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching cohort stats...");
        const data = await apiRequest("GET", "/api/admin/cohort-stats");
        console.log("✅ Cohort stats fetched:", data);
        return data;
      } catch (error: any) {
        console.error("❌ Cohort stats fetch error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading,
  });

  const { data: notifications = [], isLoading: notificationsLoading, error: notificationsError } = useQuery<{
    id: string;
    type: string;
    title: string;
    message: string;
    status: string;
    createdAt: string;
    metadataJson?: any;
  }[]>({
    queryKey: ["/api/admin/notifications/unread"],
    queryFn: async () => {
      try {
        console.log("🔔 Fetching admin notifications...");
        const data = await apiRequest("GET", "/api/admin/notifications/unread");
        console.log("✅ Admin notifications fetched:", data);
        return data;
      } catch (error: any) {
        console.error("❌ Notifications fetch error:", error);
        console.error("Error details:", error.message);
        return [];
      }
    },
    enabled: !!user && !authLoading,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = notifications.length;
  const unreadNotificationIds = notifications
    .map((n) => n.id)
    .sort()
    .join(",");

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/admin/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      // Invalidate and refetch unread notifications to remove the read one
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications/unread"] });
      // Also refetch immediately to update the UI
      queryClient.refetchQueries({ queryKey: ["/api/admin/notifications/unread"] });
    },
  });

  // Shake bell for 7 seconds only:
  // 1. First time opening the page with unread notifications
  // 2. When new notifications arrive (unread count increases)
  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;
    const currentNotificationSet = unreadNotificationIds;

    // Check if we have new notifications (count increased) or it's the first time
    const hasNewNotifications = previousCount !== null && unreadCount > previousCount;
    const isFirstTime = previousCount === null && unreadCount > 0;
    const hasNewNotificationIds = !hasShakenForCurrentNotificationsRef.current.has(currentNotificationSet);

    if ((isFirstTime || hasNewNotifications || hasNewNotificationIds) && unreadCount > 0) {
      setShouldShake(true);
      hasShakenForCurrentNotificationsRef.current.add(currentNotificationSet);
      
      const timer = setTimeout(() => {
        setShouldShake(false);
      }, 3000); // 3 seconds

      return () => clearTimeout(timer);
    }

    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount, unreadNotificationIds]);

  const { data: recentApplications, isLoading: applicationsLoading, error: applicationsError, refetch: refetchApplications } = useQuery<{
    id: string;
    name: string;
    email: string;
    type: string;
    status: string;
    createdAt: string;
  }[]>({
    queryKey: ["/api/admin/recent-applications"],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching recent applications...");
        const data = await apiRequest("GET", "/admin/recent-applications");
        console.log("✅ Recent applications fetched:", data);
        // Filter to show only NEW applications
        return data.filter((app: { status: string }) => app.status === "NEW");
      } catch (error: any) {
        console.error("❌ Recent applications fetch error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading,
  });

  const { data: teams, isLoading: teamsLoading, error: teamsError, refetch: refetchTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching teams...");
        const data = await apiRequest("GET", "/teams");
        console.log("✅ Teams fetched:", data);
        return data;
      } catch (error: any) {
        console.error("❌ Teams fetch error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading,
  });

  // Unique sprint indices for the sprint dropdown
  const uniqueSprintIndices = Array.from(
    new Set((allAdminSprints || []).map((s) => s.index))
  ).sort((a, b) => a - b);

  // Teams that have a sprint at the selected index
  const teamsForSelectedSprint = meetingsSprintIndex !== null
    ? (teams || []).filter((t) =>
        (allAdminSprints || []).some(
          (s) => s.teamId === t.id && s.index === meetingsSprintIndex
        )
      )
    : [];

  // Fetch tasks for selected team in analytics
  const { data: teamTasks, isLoading: teamTasksLoading } = useQuery<Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    points: number | null;
    assigneeId: string | null;
    sprintId: string | null;
    teamId: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/teams", selectedAnalyticsTeamId, "tasks"],
    queryFn: async () => {
      if (!selectedAnalyticsTeamId) return [];
      return await apiRequest("GET", `/api/teams/${selectedAnalyticsTeamId}/tasks`);
    },
    enabled: !!selectedAnalyticsTeamId,
  });

  // Fetch team data for analytics
  const { data: analyticsTeamData, isLoading: analyticsTeamLoading } = useQuery<{
    id: string;
    name: string;
    track: string;
    healthStatus: string;
  }>({
    queryKey: ["/api/teams", selectedAnalyticsTeamId],
    queryFn: async () => {
      if (!selectedAnalyticsTeamId) return null;
      return await apiRequest("GET", `/api/teams/${selectedAnalyticsTeamId}`);
    },
    enabled: !!selectedAnalyticsTeamId,
  });

  // Fetch sprints for the selected team
  const { data: teamSprints, isLoading: teamSprintsLoading } = useQuery<Array<{
    id: string;
    index: number;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
  }>>({
    queryKey: ["/api/teams", selectedAnalyticsTeamId, "sprints"],
    queryFn: async () => {
      if (!selectedAnalyticsTeamId) return [];
      return await apiRequest("GET", `/api/teams/${selectedAnalyticsTeamId}/sprints`);
    },
    enabled: !!selectedAnalyticsTeamId,
  });

  const { data: roles } = useRoles();

  const { data: cohorts, error: cohortsError, refetch: refetchCohorts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/cohorts"],
    queryFn: async () => {
      try {
        console.log("🔍 Fetching cohorts...");
        const data = await apiRequest("GET", "/cohorts");
        console.log("✅ Cohorts fetched:", data);
        return data;
      } catch (error: any) {
        console.error("❌ Cohorts fetch error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
        });
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading,
  });

  // Get team health metrics for dynamic health calculation
  const { data: teamMetrics } = useQuery<{ [teamId: string]: { completionRate: number; healthScore: number } }>({
    queryKey: ["/api/teams/metrics"],
    enabled: !!teams && teams.length > 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15000, // Refetch every 15 seconds for better sync
  });

  const { data: teamMembers, isLoading: membersLoading, refetch: refetchMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    queryFn: async () => {
      if (!selectedTeamId) {
        console.error("❌ Cannot fetch team members: selectedTeamId is null");
        return [];
      }
      console.log("🔍 Fetching team members for team:", selectedTeamId);
      try {
        const data = await apiRequest("GET", `/teams/${selectedTeamId}/members`);
        console.log("✅ Team members fetched:", data);
        return data;
      } catch (error: any) {
        console.error("❌ Failed to fetch team members:", error);
        throw error;
      }
    },
    enabled: !!selectedTeamId && showMembersDialog,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: unassignedLearners, isLoading: learnersLoading, refetch: refetchLearners } = useQuery<UnassignedUser[]>({
    queryKey: ["/api/admin/unassigned-learners"],
    queryFn: async () => apiRequest("GET", "/admin/unassigned-learners"),
    enabled: showMembersDialog,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: { teamId: string; userId: string; role: string }) => {
      return apiRequest("POST", `/api/teams/${data.teamId}/members`, {
        userId: data.userId,
        role: data.role,
      });
    },
    onSuccess: async () => {
      // Invalidate and refetch team members
      await queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/unassigned-learners"] });
      // Explicitly refetch to ensure UI updates
      await refetchMembers();
      await refetchLearners();
      toast({ title: "Member added", description: "User has been assigned to the team." });
      setSelectedUserId("");
      setSelectedRole("Member");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add member", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (data: { teamId: string; userId: string }) => {
      return apiRequest("DELETE", `/api/teams/${data.teamId}/members/${data.userId}`);
    },
    onSuccess: async () => {
      // Invalidate and refetch team members
      await queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/unassigned-learners"] });
      // Explicitly refetch to ensure UI updates
      await refetchMembers();
      await refetchLearners();
      toast({ title: "Member removed", description: "User has been removed from the team." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove member", description: error.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string; phone?: string; cohortId?: string }) => {
      console.log("🔍 Creating user:", data);
      try {
        const result = await apiRequest("POST", "/api/admin/users", data);
        console.log("✅ User created:", result);
        return result;
      } catch (error: any) {
        console.error("❌ Failed to create user:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "User created", description: "New user has been created successfully." });
      resetUserForm();
      setShowUserDialog(false);
    },
    onError: (error: Error) => {
      console.error("❌ Create user error:", error);
      toast({ 
        title: "Failed to create user", 
        description: error.message || "Please check console for details. You may need to log out and log back in.",
        variant: "destructive" 
      });
    },
  });

  const createCohortMutation = useMutation({
    mutationFn: async (data: { name: string; startDate: string; endDate: string; location?: string; seats?: number; composition?: Record<string, number> }) => {
      console.log("🔍 Creating cohort:", data);
      try {
        const result = await apiRequest("POST", "/api/cohorts", data);
        console.log("✅ Cohort created:", result);
        return result;
      } catch (error: any) {
        console.error("❌ Failed to create cohort:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Cohort created", description: "New cohort has been created successfully." });
      resetCohortForm();
      setShowCohortDialog(false);
    },
    onError: (error: Error) => {
      console.error("❌ Create cohort error:", error);
      toast({ 
        title: "Failed to create cohort", 
        description: error.message || "Please check console for details. You may need to log out and log back in.",
        variant: "destructive" 
      });
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: { teamId: string; startDate: string; endDate: string; goals?: string }) => {
      console.log("🔍 Creating sprint:", data);
      try {
        const result = await apiRequest("POST", `/api/teams/${data.teamId}/sprints`, {
          startDate: data.startDate,
          endDate: data.endDate,
          goals: data.goals,
        });
        console.log("✅ Sprint created:", result);
        return result;
      } catch (error: any) {
        console.error("❌ Failed to create sprint:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({ title: "Sprint created", description: "New sprint has been created for the team." });
      resetSprintForm();
      setShowSprintDialog(false);
    },
    onError: (error: Error) => {
      console.error("❌ Create sprint error:", error);
      toast({ 
        title: "Failed to create sprint", 
        description: error.message || "Please check console for details. You may need to log out and log back in.",
        variant: "destructive" 
      });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; cohortId: string }) => {
      console.log("🔍 Creating team:", data);
      try {
        const result = await apiRequest("POST", "/api/teams", data);
        console.log("✅ Team created:", result);
        return result;
      } catch (error: any) {
        console.error("❌ Failed to create team:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({ title: "Team created", description: "New team has been created successfully." });
      resetTeamForm();
      setShowTeamDialog(false);
    },
    onError: (error: Error) => {
      console.error("❌ Create team error:", error);
      toast({ 
        title: "Failed to create team", 
        description: error.message || "Please check console for details. You may need to log out and log back in.",
        variant: "destructive" 
      });
    },
  });

  const resetUserForm = () => {
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setUserRole("");
    setUserPhone("");
    setUserCohortId("");
  };

  const resetCohortForm = () => {
    setCohortName("");
    setCohortLocation("");
    setCohortSeats("100");
    setCohortStartDate("");
    setCohortEndDate("");
    setCohortComposition({});
  };

  const resetSprintForm = () => {
    setSelectedTeamId(null);
    setSprintStartDate("");
    setSprintEndDate("");
    setSprintGoals("");
  };

  const resetTeamForm = () => {
    setTeamName("");
    setTeamCohortId("");
  };

  const handleCreateTeam = () => {
    if (!teamName || !teamCohortId) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    createTeamMutation.mutate({ name: teamName, cohortId: teamCohortId });
  };

  const handleCreateUser = () => {
    if (!userName || !userEmail || !userPassword || !userRole) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({
      name: userName,
      email: userEmail,
      password: userPassword,
      role: userRole,
      phone: userPhone || undefined,
      cohortId: userCohortId || undefined,
    });
  };

  const handleCreateCohort = () => {
    if (!cohortName || !cohortStartDate || !cohortEndDate) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    createCohortMutation.mutate({
      name: cohortName,
      startDate: cohortStartDate,
      endDate: cohortEndDate,
      location: cohortLocation || undefined,
      seats: parseInt(cohortSeats) || 100,
      composition: compositionPayload(cohortComposition),
    });
  };

  const handleCreateSprint = () => {
    if (!selectedTeamId || !sprintStartDate || !sprintEndDate) {
      toast({ title: "Missing fields", description: "Please select a team and fill all dates.", variant: "destructive" });
      return;
    }
    createSprintMutation.mutate({
      teamId: selectedTeamId,
      startDate: sprintStartDate,
      endDate: sprintEndDate,
      goals: sprintGoals || undefined,
    });
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Promoter": return "default";
      case "CoPromoter": return "secondary";
      default: return "outline";
    }
  };

  const handleOpenMembersDialog = (team: Team) => {
    console.log("🔍 Opening members dialog for team:", team.id, team.name);
    setSelectedTeamId(team.id);
    setSelectedTeamName(team.name);
    setShowMembersDialog(true);
  };

  // Refetch team members when dialog opens with a valid team ID
  useEffect(() => {
    if (showMembersDialog && selectedTeamId) {
      console.log("🔄 Refetching team members for team:", selectedTeamId);
      refetchMembers();
    }
  }, [showMembersDialog, selectedTeamId, refetchMembers]);

  const handleAddMember = () => {
    if (!selectedTeamId || !selectedUserId) {
      toast({ title: "Missing fields", description: "Please select a user to add.", variant: "destructive" });
      return;
    }
    addMemberMutation.mutate({
      teamId: selectedTeamId,
      userId: selectedUserId,
      role: selectedRole,
    });
  };

  // Calculate health status based on completion rate for user-friendly display
  const getHealthStatusFromScore = (completionRate: number): "G" | "A" | "R" => {
    const percentage = completionRate * 100;
    if (percentage >= 85) return "G";  // 85+ = Green (excellent)
    if (percentage >= 65) return "A";  // 65-84 = Amber (good but needs attention)
    return "R";                        // <65 = Red (needs intervention)
  };

  // Calculate team health distribution directly from team metrics to ensure consistency
  const calculateTeamHealthDistribution = () => {
    if (!teams || !teamMetrics) return { green: 0, amber: 0, red: 0 };
    
    let greenCount = 0, amberCount = 0, redCount = 0;
    
    teams.forEach(team => {
      const metrics = teamMetrics[team.id];
      if (metrics) {
        const healthStatus = getHealthStatusFromScore(metrics.completionRate);
        if (healthStatus === "G") greenCount++;
        else if (healthStatus === "A") amberCount++;
        else redCount++;
      } else {
        // Fallback to cohort stats if metrics not available
        if (cohortStats?.teamHealth) {
          greenCount = cohortStats.teamHealth.green;
          amberCount = cohortStats.teamHealth.amber;
          redCount = cohortStats.teamHealth.red;
        }
      }
    });
    
    return { green: greenCount, amber: amberCount, red: redCount };
  };

  const healthDistribution = calculateTeamHealthDistribution();

  const teamHealth = [
    { status: "Green", count: healthDistribution.green, percentage: (stats?.totalTeams || 0) > 0 ? Math.round((healthDistribution.green / (stats?.totalTeams || 1)) * 100) : 0 },
    { status: "Amber", count: healthDistribution.amber, percentage: (stats?.totalTeams || 0) > 0 ? Math.round((healthDistribution.amber / (stats?.totalTeams || 1)) * 100) : 0 },
    { status: "Red", count: healthDistribution.red, percentage: (stats?.totalTeams || 0) > 0 ? Math.round((healthDistribution.red / (stats?.totalTeams || 1)) * 100) : 0 },
  ];

  const handleRemoveMember = (userId: string) => {
    if (!selectedTeamId) return;
    removeMemberMutation.mutate({
      teamId: selectedTeamId,
      userId,
    });
  };

  const isLoading = statsLoading || cohortLoading;

  // Log errors for debugging
  if (statsError) console.error("Stats error:", statsError);
  if (cohortError) console.error("Cohort error:", cohortError);
  if (teamsError) console.error("Teams error:", teamsError);
  if (applicationsError) console.error("Applications error:", applicationsError);
  if (cohortsError) console.error("Cohorts error:", cohortsError);

  // Debug logging
  console.log("Admin Dashboard Data:", {
    stats,
    cohortStats,
    teams,
    recentApplications,
    cohorts,
    isLoading,
    errors: { statsError, cohortError, teamsError, applicationsError, cohortsError },
  });

  const handleRefreshAll = async () => {
    console.log("🔄 Refreshing all data...");
    try {
      await Promise.all([
        refetchStats(),
        refetchCohortStats(),
        refetchTeams(),
        refetchApplications(),
        refetchCohorts(),
      ]);
      toast({ title: "Refreshed", description: "All data has been refreshed" });
    } catch (error) {
      toast({ title: "Refresh Failed", description: "Some data could not be refreshed", variant: "destructive" });
    }
  };

  // Show loading if auth is still loading
  if (authLoading) {
    return (
      <AppLayout title="Admin Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Show error if not authenticated
  if (!user) {
    return (
      <AppLayout title="Admin Dashboard">
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm font-medium text-destructive">Not authenticated. Please log in.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      title="Admin Dashboard"
      headerAction={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative h-14 w-14 bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border hover:border-primary/50"
            >
              <Bell className={`h-9 w-9 text-primary ${shouldShake ? 'animate-shake' : ''}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-96">
              {notificationsLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                notifications.slice(0, 5).map((notification) => {
                  const metadata = notification.metadataJson || {};
                  const isApplicationNotification = notification.type === "CANDIDATE_SELECTED" || 
                                                     notification.type === "NEW_APPLICATION_RECEIVED" ||
                                                     (metadata.applicationId);
                  const isProblemStatementNotification = notification.type === "PROBLEM_STATEMENT_SUBMITTED" ||
                                                          notification.type === "PROBLEM_STATEMENT_PUBLISHED" ||
                                                          notification.type === "PROBLEM_STATEMENT_APPLICATION_RECEIVED" ||
                                                          (metadata.problemStatementId);
                  const isProblemStatementApplicationNotification = notification.type === "PROBLEM_STATEMENT_APPLICATION_RECEIVED";
                  
                  return (
                    <div key={notification.id} className="p-3 border-b last:border-b-0 hover:bg-muted cursor-pointer"
                      onClick={() => {
                        // Mark as read when clicked
                        if (notification.status === "UNREAD") {
                          markAsReadMutation.mutate(notification.id);
                        }
                        // Navigate if it's a problem statement application notification - go to applications page
                        if (isProblemStatementApplicationNotification && metadata.problemStatementId) {
                          setLocation(`/app/problem-statements/${metadata.problemStatementId}/applications`);
                        }
                        // Navigate if it's a problem statement notification
                        else if (isProblemStatementNotification && metadata.problemStatementId) {
                          setLocation(`/app/problem-statements/${metadata.problemStatementId}`);
                        }
                        // Navigate if it's an application notification
                        else if (isApplicationNotification && metadata.applicationId) {
                          setLocation(`/app/admin/applications/${metadata.applicationId}`);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">{notification.message}</p>
                        </div>
                        <Badge variant={notification.status === "UNREAD" ? "default" : "outline"}>
                          {notification.status}
                        </Badge>
                      </div>
                      {isProblemStatementApplicationNotification && metadata.problemStatementId && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-primary text-primary hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (notification.status === "UNREAD") {
                                markAsReadMutation.mutate(notification.id);
                              }
                              setLocation(`/app/problem-statements/${metadata.problemStatementId}/applications`);
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            View Applications
                          </Button>
                          {metadata.applicantId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-primary text-primary hover:bg-accent"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (notification.status === "UNREAD") {
                                  markAsReadMutation.mutate(notification.id);
                                }
                                setLocation(`/app/user-profile/${metadata.applicantId}`);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Profile
                            </Button>
                          )}
                        </div>
                      )}
                      {isProblemStatementNotification && !isProblemStatementApplicationNotification && metadata.problemStatementId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 border-primary text-primary hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Mark as read when "View Problem Statement" is clicked
                            if (notification.status === "UNREAD") {
                              markAsReadMutation.mutate(notification.id);
                            }
                            setLocation(`/app/problem-statements/${metadata.problemStatementId}`);
                          }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          View Problem Statement
                        </Button>
                      )}
                      {isApplicationNotification && metadata.applicationId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 border-primary text-primary hover:bg-accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Mark as read when "View Application" is clicked
                            if (notification.status === "UNREAD") {
                              markAsReadMutation.mutate(notification.id);
                            }
                            setLocation(`/app/admin/applications/${metadata.applicationId}`);
                          }}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          View Application
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </ScrollArea>
            {notifications.length > 5 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="justify-center text-primary"
                  onClick={() => setLocation("/app/admin/notifications")}
                >
                  View All Notifications
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Error Display */}
      {(statsError || cohortError || teamsError || applicationsError) && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-2">Error loading data</p>
              <div className="text-xs text-primary space-y-1">
                {statsError && (
                  <p>Stats: {statsError.message || "Unknown error"} (Check console for details)</p>
                )}
                {cohortError && (
                  <p>Cohort: {cohortError.message || "Unknown error"} (Check console for details)</p>
                )}
                {teamsError && (
                  <p>Teams: {teamsError.message || "Unknown error"} (Check console for details)</p>
                )}
                {applicationsError && (
                  <p>Applications: {applicationsError.message || "Unknown error"} (Check console for details)</p>
                )}
              </div>
              <p className="text-xs text-destructive mt-2">
                💡 Open browser console (F12) to see detailed error logs
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleRefreshAll} className="ml-4">
              <Loader2 className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isLoading && !statsError && !cohortError && !teamsError && (
        <div className="mb-4 p-4 bg-card border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <p className="text-sm text-foreground">Loading dashboard data...</p>
          </div>
        </div>
      )}
      {/* Cohort Overview */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted backdrop-blur-2xl border border-border shadow-2xl rounded-2xl mb-8 hover:border-primary/50 transition-all duration-300">
        <CardContent className="py-6 relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-2 text-foreground">
                {cohortLoading ? "Loading..." : cohortStats?.name || "No Active Cohort"}
              </h1>
              <p className="text-muted-foreground">
                {cohortStats ? `Sprint ${cohortStats.currentSprint} of ${cohortStats.totalSprints} • ${cohortStats.weeksRemaining} weeks remaining` : "No sprint data"}
              </p>
            </div>
            <div className="flex gap-4">
              <Button 
                variant="secondary" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => setShowCohortDialog(true)}
                data-testid="button-create-cohort"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Cohort
              </Button>
              <Button 
                variant="outline" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleRefreshAll}
                disabled={isLoading}
              >
                <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
              {/* <Button variant="outline" className="bg-gradient-to-t from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white border-0 shadow-lg shadow-amber-500/30">
                Export Report
              </Button> */}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={() => setShowUserDialog(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-create-user">
          <Plus className="h-4 w-4" />
          Create User
        </Button>
        <Button onClick={() => setShowTeamDialog(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-create-team">
          <Rocket className="h-4 w-4" />
          Create Team
        </Button>
        <Button onClick={() => setShowSprintDialog(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-create-sprint">
          <FolderKanban className="h-4 w-4" />
          Create Team Sprint
        </Button>
        {/* Import Problem Statements button removed — feature deprecated */}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <Card className="relative overflow-hidden cursor-pointer bg-card border border-border shadow-lg rounded-xl hover:shadow-xl transition-all duration-300" onClick={() => setLocation("/app/admin/users")}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-users">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                stats?.totalUsers ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">All users</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-pointer bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300" onClick={() => setLocation("/app/teams")}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Teams</CardTitle>
            <Rocket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-teams">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                stats?.totalTeams ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Active startups</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-pointer bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300" onClick={() => setLocation("/app/admin/users?role=LEARNER")}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Interns</CardTitle>
            <GraduationCap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-learners">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                stats?.usersByRole?.learners ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Enrolled</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-pointer bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300" onClick={() => setLocation("/app/admin/users?role=MENTOR")}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Mentors</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-mentors">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                stats?.usersByRole?.mentors ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden cursor-pointer bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300" onClick={() => setLocation("/app/admin/applications")}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Applications</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground" data-testid="stat-applications">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                stats?.totalApplications ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total submitted</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Seed Deployed</CardTitle>
            <IndianRupee className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">
              {cohortLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                formatCurrency(cohortStats?.seedDeployed ?? 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Total funding</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted backdrop-blur-xl border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Stipends</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">
              {cohortLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                formatCurrency(cohortStats?.stipendsDisbursed ?? 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Disbursed</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      <div className="grid gap-4 md:grid-cols-1 mb-8">
          <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted backdrop-blur-2xl border border-border shadow-2xl rounded-2xl hover:border-primary/50 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Active Cohorts</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            <div className="text-2xl font-bold text-foreground">
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                stats?.activeCohorts ?? 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Running programs</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Team Health */}
          <Card className="relative overflow-hidden bg-card backdrop-blur-sm border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <CardHeader className="relative">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground">Team Health Overview</CardTitle>
                <Badge variant="outline" className="border-border text-foreground bg-muted">{stats?.totalTeams || 0} teams</Badge>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {teamHealth.map((status, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            status.status === "Green"
                              ? "bg-green-500"
                              : status.status === "Amber"
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                        />
                        <span className="text-foreground">{status.status}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {status.count} teams ({status.percentage}%)
                      </span>
                    </div>
                    <Progress
                      value={status.percentage}
                      className={`h-2 ${
                        status.status === "Green"
                          ? "[&>div]:bg-green-500"
                          : status.status === "Amber"
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-red-500"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tabs for different sections */}
          <Card className="relative overflow-hidden bg-card backdrop-blur-sm border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <Tabs defaultValue="applications">
              <CardHeader className="pb-0 relative">
                <TabsList className="bg-muted border-border flex w-full flex-wrap h-auto gap-1">
                  <TabsTrigger 
                    value="applications" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold" 
                    data-testid="tab-applications"
                  >
                    <FileText className="h-4 w-4" />
                    Applications
                  </TabsTrigger>
                  <TabsTrigger 
                    value="teams" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold" 
                    data-testid="tab-teams"
                  >
                    <Rocket className="h-4 w-4" />
                    Teams
                  </TabsTrigger>
                  <TabsTrigger 
                    value="analytics" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold" 
                    data-testid="tab-analytics"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger 
                    value="meetings" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold" 
                    data-testid="tab-meetings"
                  >
                    <Calendar className="h-4 w-4" />
                    Meetings
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="pt-6 relative">
                <TabsContent value="applications" className="mt-0 space-y-4">
                  {applicationsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : recentApplications && recentApplications.length > 0 ? (
                    recentApplications.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        data-testid={`application-row-${app.id}`}
                      >
                        <div>
                          <p className="font-medium">{app.name}</p>
                          <p className="text-sm text-muted-foreground">{app.type}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              app.status === "NEW"
                                ? "default"
                                : app.status === "REVIEW"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {app.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(app.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No applications yet</p>
                  )}
                  <Button 
                    variant="outline" 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" 
                    data-testid="button-view-applications"
                    onClick={() => setLocation("/app/admin/applications")}
                  >
                    View All Applications
                  </Button>
                </TabsContent>

                <TabsContent value="teams" className="mt-0">
                  {teamsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : teams && teams.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Name</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teams.map((team) => (
                          <TableRow key={team.id} data-testid={`team-row-${team.id}`}>
                            <TableCell className="font-medium">{team.name}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenMembersDialog(team)}
                                  data-testid={`button-manage-members-${team.id}`}
                                >
                                  <Users className="h-4 w-4 mr-1" />
                                  Members
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTeamId(team.id);
                                    setShowSprintDialog(true);
                                  }}
                                  data-testid={`button-add-sprint-${team.id}`}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Sprint
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No teams yet</p>
                  )}
                </TabsContent>

                <TabsContent value="analytics" className="mt-0 space-y-4">
                  {/* Team Selection */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium mb-2 block">Select Team</Label>
                      <Select
                        value={selectedAnalyticsTeamId || ""}
                        onValueChange={(value) => {
                          setSelectedAnalyticsTeamId(value || null);
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

                  {/* Analytics Dashboard */}
                  {selectedAnalyticsTeamId ? (
                    <div className="space-y-6">
                      {teamTasksLoading || analyticsTeamLoading || teamSprintsLoading ? (
                        <div className="space-y-4">
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
                      ) : (() => {
                        const totalTasks = teamTasks?.length || 0;
                        const todoTasks = teamTasks?.filter((t) => t.status === "TODO").length || 0;
                        const inProgressTasks = teamTasks?.filter((t) => t.status === "IN_PROGRESS").length || 0;
                        const doneTasks = teamTasks?.filter((t) => t.status === "DONE").length || 0;
                        const reviewTasks = teamTasks?.filter((t) => t.status === "REVIEW").length || 0;

                        const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
                        const totalPoints = teamTasks?.reduce((sum, t) => sum + (t.points || 1), 0) || 0;
                        const completedPoints = teamTasks?.filter((t) => t.status === "DONE").reduce((sum, t) => sum + (t.points || 1), 0) || 0;

                        const currentSprint = teamSprints?.find(s => s.status === "ACTIVE") || teamSprints?.[teamSprints.length - 1];
                        const totalSprints = teamSprints?.length || 8;

                        const getHealthColor = (status: string) => {
                          switch (status) {
                            case "Green":
                            case "G":
                              return "text-green-500";
                            case "Amber":
                            case "A":
                              return "text-amber-600";
                            case "Red":
                            case "R":
                              return "text-destructive";
                            default:
                              return "text-gray-500";
                          }
                        };

                        const healthStatus = analyticsTeamData?.healthStatus || "Green";

                        return (
                          <>
                            {/* Overview Stats */}
                            <div className="grid gap-4 md:grid-cols-4">
                              <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
                                  <CardTitle className="text-sm font-medium text-slate-900">Completion Rate</CardTitle>
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                </CardHeader>
                                <CardContent className="relative">
                                  <div className="text-2xl font-bold">{completionRate}%</div>
                                  <Progress value={completionRate} className="h-2 mt-2" />
                                </CardContent>
                              </Card>

                              <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
                                  <CardTitle className="text-sm font-medium text-slate-900">Total Tasks</CardTitle>
                                  <Target className="h-4 w-4 text-slate-700" />
                                </CardHeader>
                                <CardContent className="relative">
                                  <div className="text-2xl font-bold text-slate-900">{totalTasks}</div>
                                  <p className="text-xs text-slate-600">
                                    {doneTasks} completed
                                  </p>
                                </CardContent>
                              </Card>

                              <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
                                  <CardTitle className="text-sm font-medium text-slate-900">Points Earned</CardTitle>
                                  <Zap className="h-4 w-4 text-primary" />
                                </CardHeader>
                                <CardContent className="relative">
                                  <div className="text-2xl font-bold text-slate-900">{completedPoints}</div>
                                  <p className="text-xs text-slate-600">
                                    of {totalPoints} total points
                                  </p>
                                </CardContent>
                              </Card>

                              <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                                <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
                                  <CardTitle className="text-sm font-medium text-slate-900">Sprint Progress</CardTitle>
                                  <Calendar className="h-4 w-4 text-slate-700" />
                                </CardHeader>
                                <CardContent className="relative">
                                  <div className="text-2xl font-bold text-slate-900">
                                    {currentSprint?.index || 0}/{totalSprints}
                                  </div>
                                  <p className="text-xs text-slate-600">
                                    Current sprint
                                  </p>
                                </CardContent>
                              </Card>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                              {/* Task Distribution */}
                              <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <CardHeader className="relative">
                                  <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <Activity className="h-5 w-5" />
                                    Task Distribution
                                  </CardTitle>
                                  <CardDescription className="text-slate-700">
                                    Breakdown of tasks by status
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 relative">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-gray-400" />
                                        <span className="text-sm">To Do</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{todoTasks}</span>
                                        <Progress 
                                          value={totalTasks > 0 ? (todoTasks / totalTasks) * 100 : 0} 
                                          className="w-24 h-2" 
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-primary" />
                                        <span className="text-sm">In Progress</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{inProgressTasks}</span>
                                        <Progress 
                                          value={totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0} 
                                          className="w-24 h-2 [&>div]:bg-primary" 
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-amber-500" />
                                        <span className="text-sm">In Review</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{reviewTasks}</span>
                                        <Progress 
                                          value={totalTasks > 0 ? (reviewTasks / totalTasks) * 100 : 0} 
                                          className="w-24 h-2 [&>div]:bg-amber-500" 
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-green-500" />
                                        <span className="text-sm">Done</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{doneTasks}</span>
                                        <Progress 
                                          value={totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0} 
                                          className="w-24 h-2 [&>div]:bg-green-500" 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              {/* Team Profile */}
                              <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                <CardHeader className="relative">
                                  <CardTitle className="flex items-center gap-2 text-slate-900">
                                    <TrendingUp className="h-5 w-5" />
                                    Team Profile
                                  </CardTitle>
                                  <CardDescription className="text-slate-700">
                                    Team information and health status
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 relative">
                                  <div className="grid gap-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                      <span className="text-sm text-muted-foreground">Team</span>
                                      <span className="font-medium">{analyticsTeamData?.name || "Unknown"}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                      <span className="text-sm text-muted-foreground">Track</span>
                                      <Badge variant="secondary">{analyticsTeamData?.track || "EduTech"}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                      <span className="text-sm text-muted-foreground">Team Health</span>
                                      <span className={`font-medium ${getHealthColor(healthStatus)}`}>
                                        {healthStatus === "G" ? "Green" : healthStatus === "A" ? "Amber" : healthStatus === "R" ? "Red" : healthStatus}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                      <span className="text-sm text-muted-foreground">Total Sprints</span>
                                      <span className="font-medium">{totalSprints}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                      <span className="text-sm text-muted-foreground">Current Sprint</span>
                                      <span className="font-medium">{currentSprint?.title || `Sprint ${currentSprint?.index || 0}`}</span>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground border rounded-lg">
                      <div className="text-center">
                        <BarChart3 className="h-16 w-16 opacity-20 mx-auto mb-4" />
                        <p className="text-sm">Select a team from the dropdown above to view analytics</p>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="meetings" className="mt-0 space-y-4">
                  {/* Step 1 + 2: Sprint then Team selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Step 1: Sprint */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">1. Select Sprint</Label>
                      <Select
                        value={meetingsSprintIndex !== null ? String(meetingsSprintIndex) : ""}
                        onValueChange={(value) => {
                          const idx = value ? Number(value) : null;
                          setMeetingsSprintIndex(idx);
                          setMeetingsTeamId(null); // reset team when sprint changes
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a sprint" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueSprintIndices.map((idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              Sprint {idx}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Step 2: Team (filtered by selected sprint) */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">2. Select Team</Label>
                      <Select
                        value={meetingsTeamId || ""}
                        onValueChange={(value) => setMeetingsTeamId(value || null)}
                        disabled={meetingsSprintIndex === null}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              meetingsSprintIndex === null
                                ? "Select a sprint first"
                                : teamsForSelectedSprint.length === 0
                                ? "No teams in this sprint"
                                : "Select a team"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {teamsForSelectedSprint.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Schedule Meeting button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setShowAdminMeetingDialog(true)}
                      disabled={!meetingsTeamId}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Schedule Meeting
                    </Button>
                  </div>

                  {/* Step 3: Meetings list / members shown after team selected */}
                  {meetingsTeamId ? (
                    <TeamMeetings
                      teamId={meetingsTeamId}
                      teamName={teams?.find((t) => t.id === meetingsTeamId)?.name}
                      canCreate={false}
                    />
                  ) : (
                    <div className="h-40 flex items-center justify-center text-muted-foreground border rounded-lg">
                      <div className="text-center">
                        <Calendar className="h-12 w-12 opacity-20 mx-auto mb-3" />
                        <p className="text-sm">
                          {meetingsSprintIndex === null
                            ? "Select a sprint, then a team to view meetings"
                            : "Select a team to view and schedule meetings"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Schedule Meeting Dialog */}
                  <CreateMeetingDialog
                    open={showAdminMeetingDialog}
                    onOpenChange={setShowAdminMeetingDialog}
                    teamId={meetingsTeamId || undefined}
                    teams={teamsForSelectedSprint.length > 0 ? teamsForSelectedSprint : (teams || [])}
                    onSuccess={() => setShowAdminMeetingDialog(false)}
                  />
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Notifications card removed per request */}

          {/* Pending Actions */}
          <Card className="relative overflow-hidden bg-card backdrop-blur-sm border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <CardHeader className="relative">
              <CardTitle className="text-base text-foreground">Pending Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 relative">
              {stats?.pendingApplications && stats.pendingApplications > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/30 backdrop-blur-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Review {stats.pendingApplications} new applications</p>
                    <Badge variant="outline" className="text-xs mt-1 border-primary/50 text-primary bg-primary/10">
                      High
                    </Badge>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">Complete sprint reviews</p>
                  <Badge variant="outline" className="text-xs mt-1 border-border text-muted-foreground bg-muted">
                    Medium
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tickets */}
          <Card className="relative overflow-hidden bg-card backdrop-blur-sm border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base text-foreground">Tickets</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/app/tickets")}
                data-testid="button-view-tickets"
              >
                View all
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 relative">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted border border-border p-3">
                  <p className="text-xs text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-foreground">{ticketStats?.open ?? 0}</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                  <p className="text-xs text-muted-foreground">Open · Hot</p>
                  <p className="text-2xl font-bold text-red-500">{ticketStats?.openHot ?? 0}</p>
                </div>
              </div>
              {(ticketStats?.slaBreached ?? 0) > 0 && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <p className="text-sm text-foreground">
                    {ticketStats?.slaBreached} ticket(s) breached SLA
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg. time to close</span>
                <span className="font-medium text-foreground">
                  {ticketStats?.avgCloseHours ? `${ticketStats.avgCloseHours} h` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reopened</span>
                <span className="font-medium text-foreground">{ticketStats?.reopened ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="relative overflow-hidden bg-card backdrop-blur-sm border border-border shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <CardHeader className="relative">
              <CardTitle className="text-base text-foreground">Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 relative">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 backdrop-blur-sm">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Team Omega at Risk</p>
                  <p className="text-xs text-muted-foreground">
                    Failed 2 consecutive sprints
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 backdrop-blur-sm">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Stipend Budget Low</p>
                  <p className="text-xs text-muted-foreground">
                    80% of budget utilized
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted backdrop-blur-2xl border border-border shadow-2xl rounded-2xl hover:border-primary/50 transition-all duration-300 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:via-primary/5 before:to-transparent before:rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-base text-foreground">Sprint Progress</CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Sprint {cohortStats?.currentSprint || 0} of {cohortStats?.totalSprints || 8}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {cohortStats ? Math.round((cohortStats.currentSprint / cohortStats.totalSprints) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={cohortStats ? (cohortStats.currentSprint / cohortStats.totalSprints) * 100 : 0}
                className="h-3 [&>div]:bg-primary"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new user to the platform with their role assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Full Name *</Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
                data-testid="input-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Email *</Label>
              <Input
                id="userEmail"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="john@example.com"
                data-testid="input-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPassword">Password *</Label>
              <Input
                id="userPassword"
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="Enter password"
                data-testid="input-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEARNER">Intern</SelectItem>
                  <SelectItem value="MENTOR">Mentor</SelectItem>
                  <SelectItem value="UNIVERSITY">University</SelectItem>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="FOUNDER">Founder</SelectItem>
                  <SelectItem value="COFOUNDER">Co-Founder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userPhone">Phone (optional)</Label>
              <Input
                id="userPhone"
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="+91 9876543210"
                data-testid="input-user-phone"
              />
            </div>
            <div className="space-y-2">
              <Label>Cohort (optional)</Label>
              <Select value={userCohortId} onValueChange={setUserCohortId}>
                <SelectTrigger data-testid="select-user-cohort">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts?.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetUserForm(); setShowUserDialog(false); }} className="border-border text-muted-foreground hover:bg-card">
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={!userName || !userEmail || !userPassword || !userRole || createUserMutation.isPending}
              data-testid="button-submit-user"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>Create a new startup team within a cohort.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name *</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team Innovators"
                data-testid="input-team-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Cohort *</Label>
              <Select value={teamCohortId} onValueChange={setTeamCohortId}>
                <SelectTrigger data-testid="select-team-cohort">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts?.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetTeamForm(); setShowTeamDialog(false); }} className="border-border text-muted-foreground hover:bg-card">
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!teamName || !teamCohortId || createTeamMutation.isPending}
              data-testid="button-submit-team"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createTeamMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : "Create Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Cohort Dialog */}
      <Dialog open={showCohortDialog} onOpenChange={setShowCohortDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Cohort</DialogTitle>
            <DialogDescription>Start a new cohort for the incubation program.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cohortName">Cohort Name *</Label>
              <Input
                id="cohortName"
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder="Cohort 2025-Q1"
                data-testid="input-cohort-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cohortStartDate">Start Date *</Label>
                <Input
                  id="cohortStartDate"
                  type="date"
                  value={cohortStartDate}
                  onChange={(e) => setCohortStartDate(e.target.value)}
                  data-testid="input-cohort-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cohortEndDate">End Date *</Label>
                <Input
                  id="cohortEndDate"
                  type="date"
                  value={cohortEndDate}
                  onChange={(e) => setCohortEndDate(e.target.value)}
                  data-testid="input-cohort-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohortLocation">Location (optional)</Label>
              <Input
                id="cohortLocation"
                value={cohortLocation}
                onChange={(e) => setCohortLocation(e.target.value)}
                placeholder="Bangalore, India"
                data-testid="input-cohort-location"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohortSeats">Number of Seats</Label>
              <Input
                id="cohortSeats"
                type="number"
                value={cohortSeats}
                onChange={(e) => setCohortSeats(e.target.value)}
                placeholder="100"
                data-testid="input-cohort-seats"
              />
            </div>
            <div className="space-y-2">
              <Label>Cohort Composition</Label>
              <p className="text-sm text-muted-foreground">Totals for the entire cohort.</p>
              <CohortCompositionFields
                roles={roles}
                values={cohortComposition}
                onChange={setCohortComposition}
                idPrefix="dashboard-cohort"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCohortForm(); setShowCohortDialog(false); }} className="border-border text-muted-foreground hover:bg-card">
              Cancel
            </Button>
            <Button
              onClick={handleCreateCohort}
              disabled={!cohortName || !cohortStartDate || !cohortEndDate || createCohortMutation.isPending}
              data-testid="button-submit-cohort"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createCohortMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : "Create Cohort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Sprint Dialog */}
      <Dialog open={showSprintDialog} onOpenChange={setShowSprintDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team Sprint</DialogTitle>
            <DialogDescription>Create a new sprint for a team. The sprint index will be automatically assigned.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Team *</Label>
              <Select value={selectedTeamId || ""} onValueChange={setSelectedTeamId}>
                <SelectTrigger data-testid="select-sprint-team">
                  <SelectValue placeholder="Select a team" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sprintStartDate">Start Date *</Label>
                <Input
                  id="sprintStartDate"
                  type="date"
                  value={sprintStartDate}
                  onChange={(e) => setSprintStartDate(e.target.value)}
                  data-testid="input-sprint-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprintEndDate">End Date *</Label>
                <Input
                  id="sprintEndDate"
                  type="date"
                  value={sprintEndDate}
                  onChange={(e) => setSprintEndDate(e.target.value)}
                  data-testid="input-sprint-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprintGoals">Sprint Goals (optional)</Label>
              <Textarea
                id="sprintGoals"
                value={sprintGoals}
                onChange={(e) => setSprintGoals(e.target.value)}
                placeholder="Define the goals for this sprint..."
                data-testid="input-sprint-goals"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetSprintForm(); setShowSprintDialog(false); }} className="border-border text-muted-foreground hover:bg-card">
              Cancel
            </Button>
            <Button
              onClick={handleCreateSprint}
              disabled={!selectedTeamId || !sprintStartDate || !sprintEndDate || createSprintMutation.isPending}
              data-testid="button-submit-sprint"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createSprintMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : "Create Sprint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={(open) => {
        setShowMembersDialog(open);
        if (!open) {
          setSelectedUserId("");
          setSelectedRole("Member");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Team Members - {selectedTeamName}
            </DialogTitle>
            <DialogDescription>
              Add or remove members from this team. Assign roles based on their contribution level.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Add New Member Section */}
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Add New Member
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label className="text-xs text-muted-foreground">Select User</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger data-testid="select-member-user">
                      <SelectValue placeholder="Choose user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {learnersLoading ? (
                        <div className="p-2 text-center text-muted-foreground">Loading...</div>
                      ) : unassignedLearners && unassignedLearners.length > 0 ? (
                        unassignedLearners.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <span>{user.name}</span>
                              <span className="text-xs text-muted-foreground">({user.email})</span>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-center text-muted-foreground">No unassigned interns</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Role</Label>
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as typeof selectedRole)}>
                    <SelectTrigger data-testid="select-member-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Promoter">Promoter (₹20k/mo)</SelectItem>
                      <SelectItem value="CoPromoter">Co-Promoter (₹15k/mo)</SelectItem>
                      <SelectItem value="Member">Member (₹10k/mo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddMember}
                    disabled={!selectedUserId || addMemberMutation.isPending}
                    className="w-full"
                    data-testid="button-add-member"
                  >
                    {addMemberMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Current Members Section */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Current Members ({teamMembers?.length || 0})
              </h4>
              <ScrollArea className="h-[300px] border rounded-lg">
                {membersLoading ? (
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : teamMembers && teamMembers.length > 0 ? (
                  <div className="divide-y">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 hover:bg-muted/50"
                        data-testid={`member-row-${member.userId}`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{member.user ? getInitials(member.user.name) : "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.user?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={getRoleBadgeVariant(member.role) as "default" | "secondary" | "outline"}>
                            {member.role}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Band {member.stipendBand || "C"}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveMember(member.userId)}
                            disabled={removeMemberMutation.isPending}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-remove-member-${member.userId}`}
                          >
                            {removeMemberMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mb-2 opacity-20" />
                    <p className="text-sm">No members assigned yet</p>
                    <p className="text-xs">Add interns to this team above</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
