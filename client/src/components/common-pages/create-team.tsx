import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  UserPlus,
  Loader2,
  Eye,
  X,
  ArrowLeft,
  Mail,
  User,
  Briefcase,
  GraduationCap,
  Users,
  XCircle,
  FileText,
  Download,
  Code,
  ExternalLink,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
  avatarUrl: string | null;
  phone?: string | null;
  bio?: string | null;
  sector?: string | null;
  currentTeamsCount?: number;
  maxTeams?: number;
}

export default function CreateTeamPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"cofounder" | "mentor" | "intern">("cofounder");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>("all");

  // Team name prompt (only when no team exists yet)
  const [showTeamNameDialog, setShowTeamNameDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedProblemStatementId, setSelectedProblemStatementId] = useState<string | null>(null);

  // Track filtering states
  const tracks = [
    "SaaS_B2B", "AI", "FinTech", "HealthTech", "BioTech", "EdTech",
    "Consumer", "ECommerce", "Logistics", "PropTech", "AgriTech",
    "Climate", "Industrial", "Media", "GovTech"
  ];
  const [selectedTrackMentor, setSelectedTrackMentor] = useState<string>("all");
  const [selectedTrackCofounder, setSelectedTrackCofounder] = useState<string>("all");
  const [selectedTrackIntern, setSelectedTrackIntern] = useState<string>("all");

  // Get current team composition and limits
  const { data: teamComposition } = useQuery<{
    composition: {
      cofounder: { current: number; max: number };
      mentor: { current: number; max: number };
      learner: { current: number; max: number };
    };
    total: { current: number; max: number };
  }>({
    queryKey: ["/api/founder/team-composition"],
    queryFn: async () => {
      return await apiRequest("GET", "/founder/team-composition");
    },
    enabled: !!user?.id,
  });

  const { data: myTeamData, isLoading: myTeamLoading } = useQuery<{
    id: string;
    name: string;
    team?: { id: string; name: string } | null;
    members: { id: string }[];
  } | null>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/my-team");
        return data;
      } catch (error) {
        return null;
      }
    },
    enabled: !!user && !authLoading,
  });

  const createTeamMutation = useMutation({
    mutationFn: async ({ name, problemStatementId }: { name: string; problemStatementId?: string | null }) => {
      return apiRequest("POST", "/api/teams", {
        name,
        cohortId: null,
        ...(problemStatementId ? { problemStatementId } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/my-team"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/founder/team-composition"] });
      setShowTeamNameDialog(false);
      setNewTeamName("");
      setSelectedProblemStatementId(null);
      toast({ title: "Team created", description: "Team name saved." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create team",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!user || authLoading) return;
    if (user.role !== "FOUNDER") return;
    if (myTeamLoading) return;
    if (myTeamData) return;
    setShowTeamNameDialog(true);
  }, [authLoading, myTeamData, myTeamLoading, user]);

  const handleConfirmTeamName = async () => {
    const trimmed = newTeamName.trim();
    if (!trimmed) {
      toast({
        title: "Team name required",
        description: "Please enter a team name.",
        variant: "destructive",
      });
      return;
    }
    const psId =
      selectedProblemStatementId ??
      (founderProblemStatements.length === 1 ? founderProblemStatements[0].id : null);
    await createTeamMutation.mutateAsync({
      name: trimmed,
      problemStatementId: psId || undefined,
    });
  };

  // Founder's approved (published) problem statements for linking to team
  const { data: founderProblemStatements = [] } = useQuery<{ id: string; title: string; track: string }[]>({
    queryKey: ["/api/founder/my-published-problem-statements"],
    queryFn: () => apiRequest("GET", "/api/founder/my-published-problem-statements"),
    enabled: !!user && user.role === "FOUNDER" && showTeamNameDialog,
  });

  // Fetch users by role for team creation (backend already filters assigned users)
  const { data: cofounders = [], isLoading: cofoundersLoading } = useQuery<UserProfile[]>({
    queryKey: ["/api/team-members", "COFOUNDER"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/team-members/cofounder`);
      return data;
    },
    enabled: activeTab === "cofounder",
  });

  const { data: mentors = [], isLoading: mentorsLoading } = useQuery<UserProfile[]>({
    queryKey: ["/api/team-members", "MENTOR"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/team-members/mentor`);
      return data;
    },
    enabled: activeTab === "mentor",
  });

  const { data: learners = [], isLoading: learnersLoading } = useQuery<UserProfile[]>({
    queryKey: ["/api/team-members", "LEARNER"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/team-members/learner`);
      return data;
    },
    enabled: activeTab === "intern",
  });

  // Get existing applications to check limits
  const { data: existingApplications = [] } = useQuery<{
    id: string;
    targetUserId: string;
    targetUserRole: string;
    status: string;
  }[]>({
    queryKey: ["/api/team-member-applications/sent"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/team-member-applications/sent");
      return data;
    },
    enabled: !!user && !authLoading,
  });

  const actualTeamSize = myTeamData?.members?.length ?? teamComposition?.total.current ?? 1;
  const teamSizeLimit = teamComposition?.total.max ?? 10;
  const isTeamSizeFull = actualTeamSize >= teamSizeLimit;
  const shouldShowTeamSizeCard = !!teamComposition || !!myTeamData;

  const getApplicationForUser = (userId: string) => {
    return existingApplications.find(a => a.targetUserId === userId);
  };

  const applyMutation = useMutation({
    mutationFn: async ({ targetUserId, targetUserRole, message }: { targetUserId: string; targetUserRole: string; message?: string }) => {
      return apiRequest("POST", "/team-member-applications", {
        targetUserId,
        targetUserRole,
        message,
      });
    },
    onSuccess: () => {
      toast({ title: "Application sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-member-applications/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/team-composition"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to send application", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest("DELETE", `/team-member-applications/${applicationId}`);
    },
    onSuccess: () => {
      toast({ title: "Application cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-member-applications/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/founder/team-composition"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to cancel application", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  // Calculate application counts
  const applicationCounts = {
    cofounder: existingApplications.filter(a => a.targetUserRole === "COFOUNDER").length,
    mentor: existingApplications.filter(a => a.targetUserRole === "MENTOR").length,
    learner: existingApplications.filter(a => a.targetUserRole === "LEARNER").length,
  };

  const canApply = (role: "COFOUNDER" | "MENTOR" | "LEARNER", userId: string) => {
    // Only prevent duplicate applications to the same user
    const alreadyApplied = existingApplications.some(a => a.targetUserId === userId);
    if (alreadyApplied) return false;
    
    // No limits on number of applications - founder can apply to unlimited people
    return true;
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCancel = () => {
    // If user has applications, go back to show applied status
    if (existingApplications.length > 0) {
      setLocation("/app/founder/applications");
    } else {
      // Otherwise go back to dashboard
      setLocation("/app");
    }
  };

  const [userProfileDetails, setUserProfileDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // Subfilters for cofounder and intern roles (client-side)
  const [cofounderRoleFilter, setCofounderRoleFilter] = useState<"ALL" | "CTO" | "CBO">("ALL");
  const [internRoleFilter, setInternRoleFilter] = useState<"ALL" | "TECHNICAL" | "BUSINESS" | "MIXED">("ALL");
  const [interestedRoleMap, setInterestedRoleMap] = useState<Record<string, string | null>>({});
  const [loadingInterestedRoles, setLoadingInterestedRoles] = useState<boolean>(false);
  const [preferredTracksMap, setPreferredTracksMap] = useState<Record<string, string[]>>({});

  const handleViewDetails = (userProfile: UserProfile) => {
    // Navigate to the detailed profile page
    setLocation(`/app/user-profile/${userProfile.id}`);
  };

  if (authLoading) {
    return (
      <AppLayout title="Create Team">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout title="Create Team">
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-sm font-medium text-destructive">Not authenticated. Please log in.</p>
        </div>
      </AppLayout>
    );
  }

  // Redirect co-founders/interns to open challenges page
  // They can only apply through problem statements, not directly to people
  useEffect(() => {
    if (user && (user.role === "COFOUNDER" || user.role === "LEARNER")) {
      setLocation("/app/open-challenges");
    }
  }, [user, setLocation]);

  if (user && (user.role === "COFOUNDER" || user.role === "LEARNER")) {
    return (
      <AppLayout title="Create Team">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const currentUsers = activeTab === "cofounder" ? cofounders : activeTab === "mentor" ? mentors : learners;
  const isLoading = activeTab === "cofounder" ? cofoundersLoading : activeTab === "mentor" ? mentorsLoading : learnersLoading;
  const currentRole = activeTab === "cofounder" ? "COFOUNDER" : activeTab === "mentor" ? "MENTOR" : "LEARNER";

  // Fetch interestedRole and preferredTracks (from the user's latest application form) for visible users
  const fetchInterestedRoles = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    setLoadingInterestedRoles(true);
    try {
      const promises = ids.map(id => apiRequest("GET", `/api/users/${id}/detailed-profile`));
      const results = await Promise.allSettled(promises);
      setInterestedRoleMap(prev => {
        const next = { ...prev };
        results.forEach((r, idx) => {
          const id = ids[idx];
          if (r.status === "fulfilled" && r.value) {
            const profile = r.value as any;
            const roleValue = profile?.formData?.interestedRole ?? null;
            next[id] = roleValue;
          } else {
            // mark as null to indicate fetched but no value
            next[id] = null;
          }
        });
        return next;
      });
      setPreferredTracksMap(prev => {
        const next = { ...prev };
        results.forEach((r, idx) => {
          const id = ids[idx];
          if (r.status === "fulfilled" && r.value) {
            const profile = r.value as any;
            const tracksValue = profile?.formData?.preferredTracks ?? [];
            next[id] = Array.isArray(tracksValue) ? tracksValue : [];
          } else {
            next[id] = [];
          }
        });
        return next;
      });
    } catch (e) {
      // ignore non-fatal errors
    } finally {
      setLoadingInterestedRoles(false);
    }
  };

  // Whenever the visible users change, fetch missing interestedRole values (skip for mentors)
  useEffect(() => {
    if (activeTab === "mentor") return; // Mentors don't have interestedRole
    const idsToFetch = currentUsers
      .filter(u => interestedRoleMap[u.id] === undefined)
      .map(u => u.id);
    if (idsToFetch.length > 0) {
      fetchInterestedRoles(idsToFetch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUsers, activeTab]);

  const displayedUsers = currentUsers.filter(u => {
    // Track filtering (client-side)
    const selectedTrack = activeTab === "mentor" ? selectedTrackMentor : activeTab === "cofounder" ? selectedTrackCofounder : selectedTrackIntern;
    if (selectedTrack !== "all") {
      if (activeTab === "intern") {
        // For interns, check if at least one of their preferredTracks matches
        const userTracks = preferredTracksMap[u.id];
        if (!userTracks || userTracks.length === 0) {
          // If no tracks data yet, don't filter out (still loading)
          // Or if they have no tracks, filter them out
          const hasData = preferredTracksMap[u.id] !== undefined;
          if (hasData) return false; // Has data but empty - filter out
          return true; // Still loading - don't filter out yet
        }
        // Check if any of the user's tracks match the selected filter
        const hasMatchingTrack = userTracks.some(track => 
          track.toLowerCase() === selectedTrack.toLowerCase()
        );
        if (!hasMatchingTrack) return false;
      } else {
        // For mentors and cofounders, use the existing single track logic
        const userTrack = u.sector || u.specialization;
        if (!userTrack || userTrack.toLowerCase() !== selectedTrack.toLowerCase()) {
          return false;
        }
      }
    }
    
    // Role filtering (existing logic)
    if (activeTab === "cofounder") {
      if (cofounderRoleFilter === "ALL") return true;
      const val = interestedRoleMap[u.id];
      if (val === undefined) return true; // don't hide while fetching
      return val === cofounderRoleFilter;
    }
    if (activeTab === "intern") {
      if (internRoleFilter === "ALL") return true;
      const val = interestedRoleMap[u.id];
      if (val === undefined) return true;
      return val === internRoleFilter;
    }
    return true;
  });

  const shouldPromptForTeamName =
    user?.role === "FOUNDER" && !authLoading && !myTeamLoading && !myTeamData;

  return (
    <AppLayout title="Create Team">
      <Dialog
        open={showTeamNameDialog && shouldPromptForTeamName}
        onOpenChange={(open) => {
          // If founder has no team yet, keep prompt visible.
          if (!open && shouldPromptForTeamName) return;
          setShowTeamNameDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Team name</DialogTitle>
            <DialogDescription>Enter your team name and link your approved problem statement so team members can see it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="create-team-name">Team Name *</Label>
              <Input
                id="create-team-name"
                placeholder="e.g., Team Alpha"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmTeamName();
                  }
                }}
              />
            </div>
            {founderProblemStatements.length > 0 && (
              <div className="grid gap-2">
                <Label>Your approved problem statement</Label>
                <Select
                  value={selectedProblemStatementId ?? (founderProblemStatements.length === 1 ? founderProblemStatements[0].id : "")}
                  onValueChange={(v) => setSelectedProblemStatementId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select problem statement (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {founderProblemStatements.map((ps) => (
                      <SelectItem key={ps.id} value={ps.id}>
                        {ps.title} {ps.track ? `(${ps.track})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Team members will see this problem statement in the Problem Statement tab.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTeamName} disabled={createTeamMutation.isPending}>
              {createTeamMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel} className="text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create Team</h1>
            <p className="text-muted-foreground mt-1">Apply to co-founders, mentors, and interns to join your team</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleCancel} className="gap-2 border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/50 bg-card">
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 border border-border rounded-xl p-1">
          <TabsTrigger 
            value="cofounder"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-card data-[state=inactive]:text-foreground rounded-lg border border-border relative"
          >
            <div className="flex items-center gap-2">
              <span>Co-Founder</span>
              <Badge variant={(teamComposition?.composition.cofounder.current ?? 0) >= (teamComposition?.composition.cofounder.max ?? 0) ? "destructive" : "secondary"} className="text-xs">
                {teamComposition?.composition.cofounder.current ?? 0}/{teamComposition?.composition.cofounder.max ?? 2}
              </Badge>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="mentor"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-card data-[state=inactive]:text-foreground rounded-lg border border-border relative"
          >
            <div className="flex items-center gap-2">
              <span>Mentor</span>
              <Badge variant={(teamComposition?.composition.mentor.current ?? 0) >= (teamComposition?.composition.mentor.max ?? 0) ? "destructive" : "secondary"} className="text-xs">
                {teamComposition?.composition.mentor.current ?? 0}/{teamComposition?.composition.mentor.max ?? 1}
              </Badge>
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="intern"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-card data-[state=inactive]:text-foreground rounded-lg border border-border relative"
          >
            <div className="flex items-center gap-2">
              <span>Intern</span>
              <Badge variant={(teamComposition?.composition.learner.current ?? 0) >= (teamComposition?.composition.learner.max ?? 0) ? "destructive" : "secondary"} className="text-xs">
                {teamComposition?.composition.learner.current ?? 0}/{teamComposition?.composition.learner.max ?? 6}
              </Badge>
            </div>
          </TabsTrigger>
        </TabsList>

        {/* Team Status */}
        <div className="mb-6 space-y-4">
          {/* Team Size Status */}
          {shouldShowTeamSizeCard && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Team Size</span>
                </div>
                <Badge variant={isTeamSizeFull ? "destructive" : "default"}>
                  {actualTeamSize}/{teamSizeLimit} members
                </Badge>
              </div>
              {isTeamSizeFull && (
                <p className="text-sm text-destructive mt-2">
                  Your team is full! You cannot add more members.
                </p>
              )}
            </Card>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            </div>
            <Button 
              variant="outline" 
              onClick={() => setLocation("/app/all-team-members")}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Browse All Members
            </Button>
          </div>
        </div>

        <TabsContent value="cofounder" className="mt-0">
          <Card className="relative overflow-hidden bg-card border border-border shadow-xl rounded-2xl hover:border-primary/30 transition-all duration-300">
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Co-Founders</CardTitle>
              <CardDescription className="text-muted-foreground">Select up to 2 co-founders to join your startup team</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div />
                  <div className="flex items-center gap-2">
                    <Select value={cofounderRoleFilter} onValueChange={(v: "ALL" | "CTO" | "CBO") => setCofounderRoleFilter(v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Roles</SelectItem>
                        <SelectItem value="CTO">CTO Only</SelectItem>
                        <SelectItem value="CBO">CBO Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedTrackCofounder} onValueChange={setSelectedTrackCofounder}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tracks</SelectItem>
                        {tracks.map(track => (
                          <SelectItem key={track} value={track}>{track}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-sm">{displayedUsers.length} of {currentUsers.length}</Badge>
                  </div>
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : displayedUsers.length > 0 ? (
                  displayedUsers.map((userProfile) => {
                    const application = getApplicationForUser(userProfile.id);
                    const alreadyApplied = !!application;
                    const canApplyTo = canApply(currentRole, userProfile.id);
                    const isPending = application?.status === "PENDING";
                    
                    return (
                      <Card key={userProfile.id} className="relative overflow-hidden bg-card border border-border shadow-xl rounded-2xl hover:shadow-2xl hover:border-primary/30 transition-all duration-300 ">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="py-4 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar>
                                <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(userProfile.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium text-foreground">{userProfile.name}</h4>
                                <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {userProfile.specialization && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">{userProfile.specialization}</Badge>
                              )}
                              {(interestedRoleMap[userProfile.id]) && (
                                <Badge variant="outline" className="text-sm">{interestedRoleMap[userProfile.id]}</Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/50 bg-card"
                                onClick={() => handleViewDetails(userProfile)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              {alreadyApplied && isPending ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => cancelMutation.mutate(application.id)}
                                  disabled={cancelMutation.isPending}
                                >
                                  {cancelMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel
                                    </>
                                  )}
                                </Button>
                              ) : alreadyApplied ? (
                                <Badge variant="outline">{application?.status || "Applied"}</Badge>
                              ) : canApplyTo ? (
                                <Button
                                  size="sm"
                                  className="shadow-lg"
                                  onClick={() => applyMutation.mutate({
                                    targetUserId: userProfile.id,
                                    targetUserRole: currentRole,
                                  })}
                                  disabled={applyMutation.isPending}
                                >
                                  {applyMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserPlus className="h-4 w-4 mr-2" />
                                      Select
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Badge variant="destructive">Limit Reached</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">No co-founders available</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters to see more candidates</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentor" className="mt-0">
          <Card className="relative overflow-hidden bg-card border border-border shadow-2xl rounded-2xl hover:border-primary/30 transition-all duration-300 ">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Mentors</CardTitle>
              <CardDescription className="text-muted-foreground">Select up to 1 mentor to guide your startup team. Each mentor can guide up to 2 teams.</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div />
                  <div className="flex items-center gap-2">
                    <Select value={selectedTrackMentor} onValueChange={setSelectedTrackMentor}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tracks</SelectItem>
                        {tracks.map(track => (
                          <SelectItem key={track} value={track}>{track}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-sm">{displayedUsers.length} of {currentUsers.length}</Badge>
                  </div>
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : currentUsers.length > 0 ? (
                  currentUsers.map((userProfile) => {
                    const application = getApplicationForUser(userProfile.id);
                    const alreadyApplied = !!application;
                    const canApplyTo = canApply(currentRole, userProfile.id);
                    const isPending = application?.status === "PENDING";
                    
                    return (
                      <Card key={userProfile.id} className="relative overflow-hidden bg-card border border-border shadow-xl rounded-2xl hover:shadow-2xl hover:border-primary/30 transition-all duration-300 ">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="py-4 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar>
                                <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(userProfile.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium text-foreground">{userProfile.name}</h4>
                                <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {userProfile.specialization && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">{userProfile.specialization}</Badge>
                              )}
                              {userProfile.currentTeamsCount !== undefined && (
                                <Badge 
                                  variant={userProfile.currentTeamsCount >= (userProfile.maxTeams || 2) ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  Teams: {userProfile.currentTeamsCount || 0}/{userProfile.maxTeams || 2}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/50 bg-card"
                                onClick={() => handleViewDetails(userProfile)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              {alreadyApplied && isPending ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => cancelMutation.mutate(application.id)}
                                  disabled={cancelMutation.isPending}
                                >
                                  {cancelMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel
                                    </>
                                  )}
                                </Button>
                              ) : alreadyApplied ? (
                                <Badge variant="outline">{application?.status || "Applied"}</Badge>
                              ) : canApplyTo ? (
                                <Button
                                  size="sm"
                                  className="shadow-lg"
                                  onClick={() => applyMutation.mutate({
                                    targetUserId: userProfile.id,
                                    targetUserRole: currentRole,
                                  })}
                                  disabled={applyMutation.isPending}
                                >
                                  {applyMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserPlus className="h-4 w-4 mr-2" />
                                      Select
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Badge variant="destructive">Limit Reached</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">No mentors available</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters to see more candidates</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intern" className="mt-0">
          <Card className="relative overflow-hidden bg-card border border-border shadow-2xl rounded-2xl hover:border-primary/30 transition-all duration-300 ">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Interns</CardTitle>
              <CardDescription className="text-muted-foreground">Select up to 6 interns to join your startup team</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div />
                  <div className="flex items-center gap-2">
                    <Select value={internRoleFilter} onValueChange={(v: "ALL" | "TECHNICAL" | "BUSINESS" | "MIXED") => setInternRoleFilter(v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter interns" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Roles</SelectItem>
                        <SelectItem value="TECHNICAL">Technical Only</SelectItem>
                        <SelectItem value="BUSINESS">Business Only</SelectItem>
                        <SelectItem value="MIXED">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={selectedTrackIntern} onValueChange={setSelectedTrackIntern}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by track" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Tracks</SelectItem>
                        {tracks.map(track => (
                          <SelectItem key={track} value={track}>{track}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-sm">{displayedUsers.length} of {currentUsers.length}</Badge>
                  </div>
                </div>
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : displayedUsers.length > 0 ? (
                  displayedUsers.map((userProfile) => {
                    const application = getApplicationForUser(userProfile.id);
                    const alreadyApplied = !!application;
                    const canApplyTo = canApply(currentRole, userProfile.id);
                    const isPending = application?.status === "PENDING";
                    
                    return (
                      <Card key={userProfile.id} className="relative overflow-hidden bg-card border border-border shadow-xl rounded-2xl hover:shadow-2xl hover:border-primary/30 transition-all duration-300 ">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="py-4 relative">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar>
                                <AvatarFallback className="bg-primary text-primary-foreground">{getInitials(userProfile.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium text-foreground">{userProfile.name}</h4>
                                <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {userProfile.specialization && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30">{userProfile.specialization}</Badge>
                              )}
                              {(interestedRoleMap[userProfile.id]) && (
                                <Badge variant="outline" className="text-sm">{
                                  interestedRoleMap[userProfile.id] === 'TECHNICAL' ? 'Technical' : interestedRoleMap[userProfile.id] === 'BUSINESS' ? 'Business' : interestedRoleMap[userProfile.id] === 'MIXED' ? 'Both' : interestedRoleMap[userProfile.id]
                                }</Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-border text-muted-foreground hover:bg-primary/10 hover:border-primary/50 bg-card"
                                onClick={() => handleViewDetails(userProfile)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Button>
                              {alreadyApplied && isPending ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => cancelMutation.mutate(application.id)}
                                  disabled={cancelMutation.isPending}
                                >
                                  {cancelMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Cancel
                                    </>
                                  )}
                                </Button>
                              ) : alreadyApplied ? (
                                <Badge variant="outline">{application?.status || "Applied"}</Badge>
                              ) : canApplyTo ? (
                                <Button
                                  size="sm"
                                  className="shadow-lg"
                                  onClick={() => applyMutation.mutate({
                                    targetUserId: userProfile.id,
                                    targetUserRole: currentRole,
                                  })}
                                  disabled={applyMutation.isPending}
                                >
                                  {applyMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <UserPlus className="h-4 w-4 mr-2" />
                                      Select
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Badge variant="destructive">Limit Reached</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">No interns available</p>
                    <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters to see more candidates</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Complete profile information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Basic Info */}
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-lg">{getInitials(selectedUser.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{selectedUser.name}</h3>
                      <p className="text-muted-foreground">{selectedUser.email}</p>
                      {selectedUser.specialization && (
                        <Badge variant="secondary" className="mt-2">{selectedUser.specialization}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact & Role Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Role</p>
                        <p className="font-medium text-foreground">{selectedUser.role}</p>
                      </div>
                    </div>
                    {userProfileDetails?.phone && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium text-foreground">{userProfileDetails.phone}</p>
                        </div>
                      </div>
                    )}
                    {selectedUser.specialization && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Specialization</p>
                          <p className="font-medium text-foreground">{selectedUser.specialization}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Education */}
                  {userProfileDetails?.education && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Education</p>
                      </div>
                      <p className="text-sm">{userProfileDetails.education}</p>
                    </div>
                  )}

                  {/* Experience (for mentors) */}
                  {userProfileDetails?.experience && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Experience</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{userProfileDetails.experience}</p>
                    </div>
                  )}

                  {/* Tech Stack / Skills */}
                  {userProfileDetails?.skills && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Code className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Tech Stack / Skills</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(userProfileDetails.skills) ? (
                          userProfileDetails.skills.map((skill: string, idx: number) => (
                            <Badge key={idx} variant="secondary">{skill}</Badge>
                          ))
                        ) : (
                          <p className="text-sm">{userProfileDetails.skills}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tracks */}
                  {userProfileDetails?.tracks && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Tracks</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(userProfileDetails.tracks) ? (
                          userProfileDetails.tracks.map((track: string, idx: number) => (
                            <Badge key={idx} variant="outline">{track}</Badge>
                          ))
                        ) : (
                          <p className="text-sm">{userProfileDetails.tracks}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description / Essay Question 1 (for mentors) */}
                  {userProfileDetails?.description && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Description</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{userProfileDetails.description}</p>
                    </div>
                  )}

                  {/* About Mentor / Essay Question 2 (for mentors) */}
                  {userProfileDetails?.aboutMentor && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">About Mentor</p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">{userProfileDetails.aboutMentor}</p>
                    </div>
                  )}

                  {/* Social Links (for mentors) */}
                  {(userProfileDetails?.linkedinUrl || userProfileDetails?.githubUrl || userProfileDetails?.portfolioUrl) && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Social Links</p>
                      <div className="flex flex-wrap gap-2">
                        {userProfileDetails.linkedinUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(userProfileDetails.linkedinUrl, '_blank')}
                            className="gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            LinkedIn
                          </Button>
                        )}
                        {userProfileDetails.githubUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(userProfileDetails.githubUrl, '_blank')}
                            className="gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            GitHub
                          </Button>
                        )}
                        {userProfileDetails.portfolioUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(userProfileDetails.portfolioUrl, '_blank')}
                            className="gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Portfolio
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Certifications (for mentors) */}
                  {userProfileDetails?.certificationsUrl && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Certifications</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(userProfileDetails.certificationsUrl) ? (
                          userProfileDetails.certificationsUrl.map((url: string, idx: number) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(url, '_blank')}
                              className="gap-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Certification {idx + 1}
                            </Button>
                          ))
                        ) : typeof userProfileDetails.certificationsUrl === 'string' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              try {
                                const urls = JSON.parse(userProfileDetails.certificationsUrl);
                                if (Array.isArray(urls)) {
                                  urls.forEach((url: string, idx: number) => {
                                    window.open(url, '_blank');
                                  });
                                }
                              } catch {
                                window.open(userProfileDetails.certificationsUrl, '_blank');
                              }
                            }}
                            className="gap-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Certifications
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {/* Video URL (for mentors) */}
                  {userProfileDetails?.videoUrl && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Introduction Video</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(userProfileDetails.videoUrl, '_blank')}
                        className="gap-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Watch Video
                      </Button>
                    </div>
                  )}

                  {/* CV */}
                  {userProfileDetails?.cv && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">CV / Resume</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm">{userProfileDetails.cv.fileName}</p>
                        {userProfileDetails.cv.fileSize && (
                          <span className="text-xs text-muted-foreground">
                            ({(userProfileDetails.cv.fileSize / 1024).toFixed(1)} KB)
                          </span>
                        )}
                        {(userProfileDetails.cv.downloadUrl || userProfileDetails.cv.url) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(userProfileDetails.cv.downloadUrl || userProfileDetails.cv.url, '_blank')}
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
                  {userProfileDetails?.formData && Object.keys(userProfileDetails.formData).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-3">Application Details</p>
                      <div className="space-y-3 p-4 bg-muted rounded-lg max-h-60 overflow-y-auto">
                        {Object.entries(userProfileDetails.formData)
                          .filter(([key, value]) => {
                            // Filter out empty values and already displayed fields
                            if (value === null || value === undefined || value === '') return false;
                            if (['cvFileName', 'cvFileSize', 'cvFileType', 'cvS3Key', 'education', 'skills', 'tracksJson', 'tracks', 'techStack'].includes(key)) return false;
                            return true;
                          })
                          .map(([key, value]) => {
                            return (
                              <div key={key} className="border-b pb-2 last:border-0">
                                <p className="text-xs font-medium text-muted-foreground capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                                </p>
                                <p className="text-sm mt-1 break-words">
                                  {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}
                                </p>
                              </div>
                            );
                          })}
                        {Object.entries(userProfileDetails.formData).filter(([key, value]) => {
                          if (value === null || value === undefined || value === '') return false;
                          if (['cvFileName', 'cvFileSize', 'cvFileType', 'cvS3Key', 'education', 'skills', 'tracksJson', 'tracks', 'techStack'].includes(key)) return false;
                          return true;
                        }).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No additional application details available</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show message if no application data */}
                  {!loadingDetails && !userProfileDetails?.formData && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground text-center">
                        No application data available for this user
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => {
                      setShowDetailsDialog(false);
                      setUserProfileDetails(null);
                    }}>
                      Close
                    </Button>
                    {!existingApplications.some(a => a.targetUserId === selectedUser.id) && 
                     canApply(currentRole, selectedUser.id) && (
                      <Button
                        className=""
                        onClick={() => {
                          applyMutation.mutate({
                            targetUserId: selectedUser.id,
                            targetUserRole: currentRole,
                          });
                          setShowDetailsDialog(false);
                          setUserProfileDetails(null);
                        }}
                        disabled={applyMutation.isPending}
                      >
                        {applyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <UserPlus className="h-4 w-4 mr-2" />
                        )}
                        Select
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

