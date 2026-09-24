import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { useTourContext } from "@/components/tour/TourContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicantProfileModal } from "@/components/ApplicantProfileModal";
import { Input } from "@/components/ui/input";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/use-view-mode";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Loader2,
  Plus,
  Users,
  UserPlus,
  UserMinus,
  Trash2,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mail,
  User,
  Briefcase,
  GraduationCap,
  Code,
  ExternalLink,
  FileText,
  Target,
  Pencil,
  Check,
  X,
  Search,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Team {
  id: string;
  name: string;
  cohortId: string;
  problemId: string | null;
  mentorId: string | null;
  health?: string;
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
    role?: string;
  } | null;
}

interface UnassignedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function TeamPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { if (user?.role === "MENTOR") startPageTourIfFirst("m-team"); }, [user?.role]);
  const [, setLocation] = useLocation();
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showViewMembersDialog, setShowViewMembersDialog] = useState(false);
  const [showSprintDialog, setShowSprintDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string>("");
  
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<"Promoter" | "CoPromoter" | "Member" | "Mentor">("Member");

  const [sprintStartDate, setSprintStartDate] = useState("");
  const [sprintEndDate, setSprintEndDate] = useState("");
  const [sprintGoals, setSprintGoals] = useState("");
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  
  // State for editing member role
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberRole, setEditingMemberRole] = useState<"Promoter" | "CoPromoter" | "Member">("Member");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamCohortId, setNewTeamCohortId] = useState("");
  const [newTeamHealth, setNewTeamHealth] = useState<"G" | "A" | "R">("G");
  const [selectedTeamForHealth, setSelectedTeamForHealth] = useState<string | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [viewMode, setViewMode] = useViewMode("admin-teams-view");
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [deletingTeamName, setDeletingTeamName] = useState<string>("");
  const [showDeleteTeamDialog, setShowDeleteTeamDialog] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalTeams: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: cohortStats, isLoading: cohortLoading } = useQuery<{
    teamHealth: { green: number; amber: number; red: number };
  }>({
    queryKey: ["/api/admin/cohort-stats"],
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: teams, isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  // Get team health metrics for completion rates
  const { data: teamMetrics, refetch: refetchTeamMetrics } = useQuery<{ [teamId: string]: { completionRate: number; healthScore: number; totalTasks: number; completedTasks: number; memberCount: number } }>({
    queryKey: ["/api/teams/metrics"],
    enabled: !!teams && teams.length > 0,
    refetchOnWindowFocus: true,
    refetchInterval: 15000, // Refetch every 15 seconds for better sync
  });

  // Auto-refetch team metrics when teams data changes to ensure sync
  useEffect(() => {
    if (teams && teams.length > 0) {
      refetchTeamMetrics();
    }
  }, [teams, refetchTeamMetrics]);

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    enabled: !!selectedTeamId && (showMembersDialog || showViewMembersDialog),
    queryFn: async () => {
      const data = await apiRequest("GET", `/api/teams/${selectedTeamId}/members`);
      console.log("Team members data:", data);
      return data;
    },
  });

  const { data: teamDetails, isLoading: teamDetailsLoading } = useQuery<{
    id: string;
    name: string;
    problemStatement?: {
      id: string;
      title: string;
      track: string;
      overview?: string;
      summary?: string;
    } | null;
  }>({
    queryKey: ["/api/teams", selectedTeamId],
    enabled: !!selectedTeamId && showViewMembersDialog,
    queryFn: async () => {
      return await apiRequest("GET", `/api/teams/${selectedTeamId}`);
    },
  });

  const { data: unassignedUsers, isLoading: usersLoading } = useQuery<UnassignedUser[]>({
    queryKey: ["/api/admin/unassigned-users", selectedRole],
    queryFn: async () => {
      console.log("🔍 Fetching users for role:", selectedRole);
      const result = await apiRequest("GET", `/api/admin/unassigned-users?teamRole=${selectedRole}`);
      console.log("✅ Users returned:", result);
      return result;
    },
    enabled: showMembersDialog,
  });

  const { data: cohorts } = useQuery<{ id: string; name: string; isActive: boolean }[]>({
    queryKey: ["/api/cohorts"],
  });


  // Get founder's team with members
  const { data: myTeam, refetch: refetchMyTeam } = useQuery<{
    id: string;
    name: string;
    members: { id: string; name: string; role: string; band: string | null; userRole?: string }[];
  } | null>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/my-team");
        return data;
      } catch (error: any) {
        return null;
      }
    },
    enabled: !!user && (user.role === "FOUNDER" || user.role === "COFOUNDER"),
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; cohortId: string; problemStatementId?: string; health?: string }) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({
        title: "Team created successfully",
        description: "The new team has been created with seed funding.",
      });
      setShowCreateTeamDialog(false);
      setNewTeamName("");
      setNewTeamCohortId("");
      setNewTeamHealth("G");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTeam = () => {
    if (!newTeamName || !newTeamCohortId) {
      toast({
        title: "Validation error",
        description: "Please provide team name and select a cohort.",
        variant: "destructive",
      });
      return;
    }
    createTeamMutation.mutate({
      name: newTeamName,
      cohortId: newTeamCohortId,
      health: newTeamHealth,
    });
  };

  const addMemberMutation = useMutation({
    mutationFn: async (data: { teamId: string; userId: string; role: string }) => {
      return apiRequest("POST", `/api/teams/${data.teamId}/members`, {
        userId: data.userId,
        role: data.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unassigned-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-team"] });
      refetchMyTeam();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/unassigned-users"] });
      toast({ title: "Member removed", description: "User has been removed from the team." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove member", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async (data: { assignmentId: string; role: string }) => {
      return apiRequest("PATCH", `/api/role-assignments/${data.assignmentId}`, {
        role: data.role,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-team"] });
      toast({ title: "Role updated", description: "Member role has been updated successfully." });
      setEditingMemberId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
      setEditingMemberId(null);
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: async (data: { teamId: string; startDate: string; endDate: string; goals?: string }) => {
      return apiRequest("POST", `/api/teams/${data.teamId}/sprints`, {
        startDate: data.startDate,
        endDate: data.endDate,
        goals: data.goals,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({ title: "Sprint created", description: "New sprint has been created for the team." });
      resetSprintForm();
      setShowSprintDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create sprint", description: error.message, variant: "destructive" });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      return apiRequest("DELETE", `/api/teams/${teamId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({ title: "Team deleted", description: "The team has been deleted." });
      setDeletingTeamId(null);
      setShowDeleteTeamDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete team", description: error.message, variant: "destructive" });
    },
  });

  const resetSprintForm = () => {
    setSprintStartDate("");
    setSprintEndDate("");
    setSprintGoals("");
    setSelectedTeamId(null);
  };

  const handleOpenMembersDialog = (team: Team) => {
    setSelectedTeamId(team.id);
    setSelectedTeamName(team.name);
    setShowMembersDialog(true);
  };

  const handleAddMember = () => {
    if (!selectedTeamId || !selectedUserId) return;
    addMemberMutation.mutate({
      teamId: selectedTeamId,
      userId: selectedUserId,
      role: selectedRole,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (!selectedTeamId) return;
    removeMemberMutation.mutate({
      teamId: selectedTeamId,
      userId: userId,
    });
  };

  const handleCreateSprint = () => {
    if (!selectedTeamId || !sprintStartDate || !sprintEndDate) return;
    createSprintMutation.mutate({
      teamId: selectedTeamId,
      startDate: sprintStartDate,
      endDate: sprintEndDate,
      goals: sprintGoals || undefined,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBasedText = (role: string) => {
    switch(role) {
      case "Promoter": return { singular: "founder", plural: "founders", label: "Founders" };
      case "CoPromoter": return { singular: "co-founder", plural: "co-founders", label: "Co-Founders" };
      case "Member": return { singular: "intern", plural: "interns", label: "Interns" };
      case "Mentor": return { singular: "mentor", plural: "mentors", label: "Mentors" };
      default: return { singular: "user", plural: "users", label: "Users" };
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Promoter": return "default";
      case "CoPromoter": return "secondary";
      default: return "outline";
    }
  };

  // Helper function to get role label and sort order
  const getRoleInfo = (member: { role: string; userRole?: string; user?: { role?: string } | null }) => {
    // Check userRole first (FOUNDER, COFOUNDER, MENTOR, LEARNER)
    const userRole = member.userRole || member.user?.role;
    if (userRole === "FOUNDER") {
      return { label: "Founder", sortOrder: 1 };
    }
    if (userRole === "COFOUNDER" || member.role === "CoPromoter") {
      return { label: "Co-Founder", sortOrder: 2 };
    }
    if (userRole === "MENTOR" || member.role === "Promoter") {
      return { label: "Mentor", sortOrder: 3 };
    }
    if (userRole === "LEARNER" || member.role === "Member") {
      return { label: "Intern", sortOrder: 4 };
    }
    // Fallback to role
    if (member.role === "CoPromoter") return { label: "Co-Founder", sortOrder: 2 };
    if (member.role === "Promoter") return { label: "Mentor", sortOrder: 3 };
    return { label: member.role, sortOrder: 4 };
  };

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [memberDetails, setMemberDetails] = useState<any>(null);
  const [loadingMemberDetails, setLoadingMemberDetails] = useState(false);

  const handleViewMemberDetails = async (memberId: string) => {
    setSelectedMemberId(memberId);
    setShowMemberDetails(true);
    setLoadingMemberDetails(true);
    setMemberDetails(null);
    
    try {
      const profile = await apiRequest("GET", `/api/users/${memberId}/profile`);
      setMemberDetails(profile);
    } catch (error: any) {
      toast({
        title: "Failed to load member details",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoadingMemberDetails(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "G": return "bg-green-500";
      case "A": return "bg-[#D4A574]";
      case "R": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const getHealthLabel = (health: string) => {
    switch (health) {
      case "G": return "Green";
      case "A": return "Amber";
      case "R": return "Red";
      default: return "Unknown";
    }
  };

  // Calculate health status based on completion rate for user-friendly display
  const getHealthStatusFromScore = (completionRate: number): "G" | "A" | "R" => {
    const percentage = completionRate * 100;
    if (percentage >= 85) return "G";  // 85+ = Green (excellent)
    if (percentage >= 65) return "A";  // 65-84 = Amber (good but needs attention)
    return "R";                        // <65 = Red (needs intervention)
  };

  const isLoading = statsLoading || cohortLoading;

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
        // Fallback to database health if metrics not available
        if (team.health === "G") greenCount++;
        else if (team.health === "A") amberCount++;
        else redCount++;
      }
    });
    
    return { green: greenCount, amber: amberCount, red: redCount };
  };

  const healthDistribution = calculateTeamHealthDistribution();

  // Get individual team health data
  const getIndividualTeamHealth = (teamId: string) => {
    const team = teams?.find(t => t.id === teamId);
    if (!team) return null;
    
    const metrics = teamMetrics?.[teamId];
    if (metrics) {
      const healthStatus = getHealthStatusFromScore(metrics.completionRate);
      return {
        status: healthStatus,
        label: getHealthLabel(healthStatus),
        completionRate: metrics.completionRate,
        healthScore: metrics.healthScore,
        color: getHealthColor(healthStatus),
        teamName: team.name
      };
    }
    // Fallback to database health
    return {
      status: (team.health || "G") as "G" | "A" | "R",
      label: getHealthLabel(team.health || "G"),
      completionRate: null,
      healthScore: null,
      color: getHealthColor(team.health || "G"),
      teamName: team.name
    };
  };

  const selectedTeamHealth = selectedTeamForHealth ? getIndividualTeamHealth(selectedTeamForHealth) : null;

  const teamHealth = [
    { 
      status: "Green", 
      count: healthDistribution.green, 
      percentage: (teams?.length || 0) > 0 ? Math.round((healthDistribution.green / (teams?.length || 1)) * 100) : 0,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500"
    },
    { 
      status: "Amber", 
      count: healthDistribution.amber, 
      percentage: (teams?.length || 0) > 0 ? Math.round((healthDistribution.amber / (teams?.length || 1)) * 100) : 0,
      icon: AlertTriangle,
      color: "text-[#D4A574]",
      bgColor: "bg-[#D4A574]"
    },
    { 
      status: "Red", 
      count: healthDistribution.red, 
      percentage: (teams?.length || 0) > 0 ? Math.round((healthDistribution.red / (teams?.length || 1)) * 100) : 0,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500"
    },
  ];

  return (
    <AppLayout title="Team Management">
      <div className="space-y-6">
        {/* Founder's Team Section */}
        {(user?.role === "FOUNDER" || user?.role === "COFOUNDER") && myTeam && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5" />
                My Team: {myTeam.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {!myTeam.members || myTeam.members.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No team members yet. Add members from accepted applications in your dashboard.
                </div>
              ) : (
                <div className="space-y-2">
                  {[...(myTeam.members || [])].sort((a, b) => {
                    const aInfo = getRoleInfo(a);
                    const bInfo = getRoleInfo(b);
                    return aInfo.sortOrder - bInfo.sortOrder;
                  }).map((member) => {
                    const roleInfo = getRoleInfo(member);
                    return (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{roleInfo.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getRoleBadgeVariant(member.role)}>{roleInfo.label}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewMemberDetails(member.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Team Management</h1>
          </div>
          <div className="flex items-center gap-3">
            {(user?.role === "ADMIN") && (
              <Button onClick={() => setShowCreateTeamDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search teams..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <Badge variant="outline" className="text-lg px-3 py-1" data-tour="m-pg-team-count">
              <Users className="h-4 w-4 mr-2" />
              {teams?.length || 0} Teams
            </Badge>
          </div>
        </div>

        
        {/* Team Health Summary */}
        <Card data-tour="m-team-health" className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Activity className="h-5 w-5" />
                {selectedTeamHealth ? `Team Health: ${selectedTeamHealth.teamName}` : "Team Health Distribution"}
              </CardTitle>
              <div className="flex items-center gap-2">
                {selectedTeamHealth && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTeamForHealth(null)}
                    className="text-xs"
                  >
                    Show All Teams
                  </Button>
                )}
                <Badge variant="outline">{teams?.length || 0} total</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : selectedTeamHealth ? (
                <>
                  {/* Individual Team Health View */}
                  <div className="text-center space-y-4">
                    <div className={`mx-auto text-center p-8 rounded-lg ${selectedTeamHealth.status === "G" ? "bg-green-500/20 text-green-800 border border-green-500/30" : selectedTeamHealth.status === "A" ? "bg-[#D4A574]/20 text-[#D4A574] border border-[#D4A574]/30" : "bg-red-500/20 text-red-800 border border-red-500/30"}`}>
                      <div className={`h-16 w-16 rounded-full ${selectedTeamHealth.color} mx-auto mb-4 flex items-center justify-center`}>
                        <Activity className="h-8 w-8 text-white" />
                      </div>
                      <div className="text-4xl font-bold mb-2">{selectedTeamHealth.label}</div>
                      <div className="text-sm font-semibold mb-4">Health Status</div>
                      {selectedTeamHealth.completionRate !== null && (
                        <div className="space-y-2 mt-6">
                          <div className="text-sm font-medium">Completion Rate</div>
                          <div className="text-2xl font-bold">{Math.round(selectedTeamHealth.completionRate * 100)}%</div>
                          <Progress 
                            value={selectedTeamHealth.completionRate * 100} 
                            className={`h-3 mt-2 ${
                              selectedTeamHealth.status === "G"
                                ? "[&>div]:bg-green-500"
                                : selectedTeamHealth.status === "A"
                                ? "[&>div]:bg-[#D4A574]"
                                : "[&>div]:bg-red-500"
                            }`}
                          />
                        </div>
                      )}
                      {selectedTeamHealth.healthScore !== null && (
                        <div className="mt-4">
                          <div className="text-sm font-medium">Health Score</div>
                          <div className="text-xl font-bold">{Math.round(selectedTeamHealth.healthScore)}</div>
                        </div>
                      )}
                      <div className="text-xs mt-4 font-medium">
                        {selectedTeamHealth.status === "G" && "Score ≥ 85 (Excellent)"}
                        {selectedTeamHealth.status === "A" && "Score 65-84 (Good)"}
                        {selectedTeamHealth.status === "R" && "Score < 65 (Needs Help)"}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Aggregate Health Distribution View */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" data-tour="m-pg-team-health-tiles">
                    {teamHealth.map((status, index) => (
                      <div
                        key={index}
                        data-tour={
                          status.status === "Green"
                            ? "m-pg-team-health-green"
                            : status.status === "Amber"
                            ? "m-pg-team-health-amber"
                            : "m-pg-team-health-red"
                        }
                        className={`text-center p-4 rounded-lg ${status.status === "Green" ? "bg-green-500/20 text-green-800 border border-green-500/30" : status.status === "Amber" ? "bg-[#D4A574]/20 text-[#D4A574] border border-[#D4A574]/30" : "bg-red-500/20 text-red-800 border border-red-500/30"}`}
                      >
                        <div className="text-3xl font-bold">{status.count}</div>
                        <div className="text-sm font-semibold mt-1">{status.status}</div>
                        <div className="text-xs mt-1">
                          {status.percentage}% of teams
                        </div>
                        <div className="text-xs mt-1 font-medium">
                          {status.status === "Green" && "Score ≥ 85 (Excellent)"}
                          {status.status === "Amber" && "Score 65-84 (Good)"}
                          {status.status === "Red" && "Score < 65 (Needs Help)"}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Progress Bars */}
                  <div className="space-y-3" data-tour="m-pg-team-health-bars">
                    {teamHealth.map((status, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${status.bgColor}`} />
                            <span className="font-medium">{status.status}</span>
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
                              ? "[&>div]:bg-[#D4A574]"
                              : "[&>div]:bg-red-500"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Teams List */}
        <div data-tour="m-team-list">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2" data-tour="m-pg-team-my-teams">
              <TrendingUp className="h-6 w-6" />
              My Teams
            </h2>
          </div>
          
          {teamsLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : teams && teams.length > 0 ? (
            (() => {
              const filteredTeams = teams.filter((team) =>
                team.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
              );
              return viewMode === "table" ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Tasks done</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeams.map((team) => {
                        const metrics = teamMetrics?.[team.id];
                        const health = metrics
                          ? getHealthStatusFromScore(metrics.completionRate)
                          : team.health || "G";
                        return (
                          <TableRow key={team.id} data-testid={`row-team-${team.id}`}>
                            <TableCell className="font-medium text-foreground">
                              <div className="flex items-center gap-2">
                                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getHealthColor(health)}`} />
                                <span className="truncate">{team.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {getHealthLabel(health)}
                              {metrics && (
                                <span className="ml-1">
                                  · {Math.round(metrics.completionRate * 100)}%
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {metrics ? metrics.memberCount : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {metrics ? `${metrics.completedTasks}/${metrics.totalTasks}` : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setSelectedTeamId(team.id);
                                    setSelectedTeamName(team.name);
                                    setShowViewMembersDialog(true);
                                  }}
                                  data-testid={`button-view-team-${team.id}`}
                                  aria-label={`View ${team.name}`}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {user?.role === "ADMIN" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary hover:bg-primary/10"
                                    onClick={() => handleOpenMembersDialog(team)}
                                    data-testid={`button-manage-members-${team.id}`}
                                    aria-label={`Manage members of ${team.name}`}
                                  >
                                    <Users className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  onClick={() => {
                                    setSelectedTeamId(team.id);
                                    setSelectedTeamName(team.name);
                                    setShowSprintDialog(true);
                                  }}
                                  data-testid={`button-add-sprint-${team.id}`}
                                  aria-label={`Add sprint to ${team.name}`}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                {user?.role === "ADMIN" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      setDeletingTeamId(team.id);
                                      setDeletingTeamName(team.name);
                                      setShowDeleteTeamDialog(true);
                                    }}
                                    data-testid={`button-delete-team-${team.id}`}
                                    aria-label={`Delete ${team.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team, teamIdx) => (
                <Card key={team.id} className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid={`team-card-${team.id}`} data-tour={teamIdx === 0 ? "m-pg-team-card" : undefined}>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center justify-between text-slate-900">
                      <span className="truncate">{team.name}</span>
                      <div className={`h-3 w-3 rounded-full ${teamMetrics?.[team.id] ? getHealthColor(getHealthStatusFromScore(teamMetrics[team.id].completionRate)) : getHealthColor(team.health || "G")}`} />
                    </CardTitle>
                    <CardDescription className="text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{teamMetrics?.[team.id] ? getHealthLabel(getHealthStatusFromScore(teamMetrics[team.id].completionRate)) : getHealthLabel(team.health || "G")}</span>
                        {teamMetrics?.[team.id] && (
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(teamMetrics[team.id].completionRate * 100)}% complete
                            </span>
                          </div>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 relative">
                    {/* Team stats: members & tasks */}
                    {teamMetrics?.[team.id] && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{teamMetrics[team.id].memberCount} members</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          <span>{teamMetrics[team.id].completedTasks}/{teamMetrics[team.id].totalTasks} tasks done</span>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-primary text-primary hover:bg-primary/10"
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setSelectedTeamName(team.name);
                          setShowViewMembersDialog(true);
                        }}
                        data-testid={`button-view-team-${team.id}`}
                        data-tour={teamIdx === 0 ? "m-pg-team-view-btn" : undefined}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {user?.role === "ADMIN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary text-primary hover:bg-primary/10"
                          onClick={() => handleOpenMembersDialog(team)}
                          data-testid={`button-manage-members-${team.id}`}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-primary text-primary hover:bg-primary/10"
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setSelectedTeamName(team.name);
                          setShowSprintDialog(true);
                        }}
                        data-testid={`button-add-sprint-${team.id}`}
                        data-tour={teamIdx === 0 ? "m-pg-team-add-btn" : undefined}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      {user?.role === "ADMIN" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setDeletingTeamId(team.id);
                            setDeletingTeamName(team.name);
                            setShowDeleteTeamDialog(true);
                          }}
                          data-testid={`button-delete-team-${team.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
              );
            })()
          ) : (
            <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <CardContent className="text-center py-8 text-slate-700 relative">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No teams created yet</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Manage Members Dialog */}
        <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Manage Team Members</DialogTitle>
              <DialogDescription>
                Add or remove members from {selectedTeamName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Current Members */}
              <div>
                <h4 className="text-sm font-medium mb-3">Current Members</h4>
                {membersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : teamMembers && teamMembers.length > 0 ? (
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          data-testid={`member-row-${member.userId}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {member.user ? getInitials(member.user.name) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{member.user?.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.user?.email || "No email"}
                                {getRoleInfo(member).label && ` • ${getRoleInfo(member).label}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {getRoleInfo(member).label}
                            </Badge>
                            {member.stipendBand && (
                              <Badge variant="outline">Band {member.stipendBand}</Badge>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveMember(member.userId)}
                              disabled={removeMemberMutation.isPending}
                              data-testid={`button-remove-member-${member.userId}`}
                            >
                              {removeMemberMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No members assigned yet
                  </p>
                )}
              </div>

              {/* Add Member */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add New Member
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <Label htmlFor="user-select">Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger id="user-select" data-testid="select-user">
                        <SelectValue placeholder={`Choose a ${getRoleBasedText(selectedRole).singular}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {usersLoading ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                        ) : unassignedUsers && unassignedUsers.length > 0 ? (
                          unassignedUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            No available {getRoleBasedText(selectedRole).plural}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="role-select">Role</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as typeof selectedRole)}>
                      <SelectTrigger id="role-select" data-testid="select-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Promoter">Promoter (Band A - ₹20k)</SelectItem>
                        <SelectItem value="CoPromoter">Co-Promoter (Band B - ₹15k)</SelectItem>
                        <SelectItem value="Member">Member (Band C - ₹10k)</SelectItem>
                        <SelectItem value="Mentor">Mentor</SelectItem>
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
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Add Member
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMembersDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Sprint Dialog */}
        <Dialog open={showSprintDialog} onOpenChange={setShowSprintDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Sprint</DialogTitle>
              <DialogDescription>
                Add a new sprint for {selectedTeamName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="sprint-start">Start Date</Label>
                  <Input
                    id="sprint-start"
                    type="date"
                    value={sprintStartDate}
                    onChange={(e) => setSprintStartDate(e.target.value)}
                    data-testid="input-sprint-start"
                  />
                </div>
                <div>
                  <Label htmlFor="sprint-end">End Date</Label>
                  <Input
                    id="sprint-end"
                    type="date"
                    value={sprintEndDate}
                    onChange={(e) => setSprintEndDate(e.target.value)}
                    data-testid="input-sprint-end"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="sprint-goals">Sprint Goals (Optional)</Label>
                <Textarea
                  id="sprint-goals"
                  value={sprintGoals}
                  onChange={(e) => setSprintGoals(e.target.value)}
                  placeholder="Define the goals for this sprint..."
                  className="min-h-[100px]"
                  data-testid="input-sprint-goals"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSprintDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateSprint}
                disabled={!sprintStartDate || !sprintEndDate || createSprintMutation.isPending}
                data-testid="button-create-sprint"
              >
                {createSprintMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Sprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Team Members Dialog (Read-only) */}
        <Dialog open={showViewMembersDialog} onOpenChange={setShowViewMembersDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Team Details - {selectedTeamName}</DialogTitle>
              <DialogDescription>
                View problem statement and all members of {selectedTeamName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Problem Statement Section */}
              {teamDetailsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : teamDetails?.problemStatement ? (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Problem Statement
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{teamDetails.problemStatement.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{teamDetails.problemStatement.track}</Badge>
                    </div>
                    {(teamDetails.problemStatement.overview || teamDetails.problemStatement.summary) && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {teamDetails.problemStatement.overview || teamDetails.problemStatement.summary}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">No problem statement assigned</p>
                </div>
              )}

              {/* Team Members Section */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Members ({teamMembers?.length || 0})
                </h4>
                {membersLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : teamMembers && teamMembers.length > 0 ? (
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="text-sm">
                                {member.user ? getInitials(member.user.name) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {member.user?.name || (member.userId ? `User ${member.userId.substring(0, 8)}...` : "Unknown")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.user?.email || "No email"}
                                {getRoleInfo(member).label && ` • ${getRoleInfo(member).label}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Role editing for admin */}
                            {user?.role === "ADMIN" && editingMemberId === member.id ? (
                              <div className="flex items-center gap-1">
                                <Select 
                                  value={editingMemberRole} 
                                  onValueChange={(v) => setEditingMemberRole(v as "Promoter" | "CoPromoter" | "Member")}
                                >
                                  <SelectTrigger className="h-8 w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Promoter">Promoter</SelectItem>
                                    <SelectItem value="CoPromoter">Co-Promoter</SelectItem>
                                    <SelectItem value="Member">Member</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => {
                                    updateMemberRoleMutation.mutate({
                                      assignmentId: member.id,
                                      role: editingMemberRole,
                                    });
                                  }}
                                  disabled={updateMemberRoleMutation.isPending}
                                >
                                  {updateMemberRoleMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setEditingMemberId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                  {getRoleInfo(member).label}
                                </Badge>
                                {user?.role === "ADMIN" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                                    onClick={() => {
                                      setEditingMemberId(member.id);
                                      setEditingMemberRole(member.role as "Promoter" | "CoPromoter" | "Member");
                                    }}
                                    title="Edit role"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            {member.stipendBand && (
                              <Badge variant="outline">Band {member.stipendBand}</Badge>
                            )}
                            {member.userId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-primary text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setShowViewMembersDialog(false);
                                  setLocation(`/app/user-profile/${member.userId}`);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
                    No members assigned yet
                  </p>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewMembersDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Member Details Dialog */}
        <Dialog open={showMemberDetails} onOpenChange={setShowMemberDetails}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Team Member Details</DialogTitle>
              <DialogDescription>Complete profile information</DialogDescription>
            </DialogHeader>
            {selectedMemberId && (
              <div className="space-y-6">
                {loadingMemberDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : memberDetails ? (
                  <>
                    {/* Basic Info */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-lg">
                          {memberDetails.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-xl font-bold">{memberDetails.name}</h3>
                        <p className="text-muted-foreground">{memberDetails.email}</p>
                        {memberDetails.specialization && (
                          <Badge variant="secondary" className="mt-2">{memberDetails.specialization}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Contact & Role Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Role</p>
                          <p className="font-medium">{memberDetails.role}</p>
                        </div>
                      </div>
                      {memberDetails.phone && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Phone</p>
                            <p className="font-medium">{memberDetails.phone}</p>
                          </div>
                        </div>
                      )}
                      {memberDetails.specialization && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Specialization</p>
                            <p className="font-medium">{memberDetails.specialization}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Education */}
                    {memberDetails.education && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Education</p>
                        </div>
                        <p className="text-sm">{memberDetails.education}</p>
                      </div>
                    )}

                    {/* Experience (for mentors) */}
                    {memberDetails.experience && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Experience</p>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{memberDetails.experience}</p>
                      </div>
                    )}

                    {/* Tech Stack / Skills */}
                    {memberDetails.skills && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Code className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Tech Stack / Skills</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(memberDetails.skills) ? (
                            memberDetails.skills.map((skill: string, idx: number) => (
                              <Badge key={idx} variant="secondary">{skill}</Badge>
                            ))
                          ) : (
                            <p className="text-sm">{memberDetails.skills}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tracks */}
                    {memberDetails.tracks && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">Tracks</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {Array.isArray(memberDetails.tracks) ? (
                            memberDetails.tracks.map((track: string, idx: number) => (
                              <Badge key={idx} variant="outline">{track}</Badge>
                            ))
                          ) : (
                            <p className="text-sm">{memberDetails.tracks}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* CV */}
                    {memberDetails.cv && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground">CV / Resume</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm">{memberDetails.cv.fileName}</p>
                          {memberDetails.cv.fileSize && (
                            <span className="text-xs text-muted-foreground">
                              ({(memberDetails.cv.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          )}
                          {(memberDetails.cv.downloadUrl || memberDetails.cv.url) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(memberDetails.cv.downloadUrl || memberDetails.cv.url, '_blank')}
                              className="gap-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View CV
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Application Form Data */}
                    {memberDetails.formData && Object.keys(memberDetails.formData).length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-3">Application Details</p>
                        <div className="space-y-3 p-4 bg-muted rounded-lg max-h-60 overflow-y-auto">
                          {Object.entries(memberDetails.formData)
                            .filter(([key, value]) => {
                              if (value === null || value === undefined || value === '') return false;
                              if (['cvFileName', 'cvFileSize', 'cvFileType', 'cvS3Key', 'education', 'skills', 'tracksJson', 'tracks', 'techStack'].includes(key)) return false;
                              return true;
                            })
                            .map(([key, value]) => (
                              <div key={key} className="border-b pb-2 last:border-0">
                                <p className="text-xs font-medium text-muted-foreground capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                                </p>
                                <p className="text-sm mt-1 break-words">
                                  {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No details available for this member</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Create Team Dialog */}
        <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a new team and assign it to a cohort. Seed funding will be automatically allocated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="team-name">Team Name *</Label>
                <Input
                  id="team-name"
                  placeholder="Team Alpha"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cohort">Cohort *</Label>
                <Select value={newTeamCohortId} onValueChange={setNewTeamCohortId}>
                  <SelectTrigger id="cohort">
                    <SelectValue placeholder="Select a cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts?.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        {cohort.name} {cohort.isActive && "(Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="health">Team Health</Label>
                <Select value={newTeamHealth} onValueChange={(value: "G" | "A" | "R") => setNewTeamHealth(value)}>
                  <SelectTrigger id="health">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="G">Green</SelectItem>
                    <SelectItem value="A">Amber</SelectItem>
                    <SelectItem value="R">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateTeamDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Team Confirmation Dialog */}
        <Dialog open={showDeleteTeamDialog} onOpenChange={setShowDeleteTeamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Team</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{deletingTeamName}</strong>? This action cannot be undone and will remove all associated data.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteTeamDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => { if (deletingTeamId) deleteTeamMutation.mutate(deletingTeamId); }}
                disabled={deleteTeamMutation.isPending}
              >
                {deleteTeamMutation.isPending ? "Deleting..." : "Delete Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
