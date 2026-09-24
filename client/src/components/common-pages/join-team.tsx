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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Users,
  XCircle,
  Briefcase,
} from "lucide-react";

interface FounderProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  specialization: string | null;
  avatarUrl: string | null;
  phone?: string | null;
  bio?: string | null;
  sector?: string | null;
}

export default function JoinTeamPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [selectedTrack, setSelectedTrack] = useState<string>("all");

  // Track options
  const tracks = [
    "SaaS_B2B", "AI", "FinTech", "HealthTech", "BioTech", "EdTech",
    "Consumer", "ECommerce", "Logistics", "PropTech", "AgriTech",
    "Climate", "Industrial", "Media", "GovTech"
  ];

  // Check if user is already assigned to a team
  const { data: myTeamData, isLoading: teamCheckLoading } = useQuery<{
    team: { id: string; name: string } | null;
    isAssigned: boolean;
  }>({
    queryKey: ["/api/my-team-status"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/my-team");
        return {
          team: data.team || null,
          isAssigned: !!data.team,
        };
      } catch (error) {
        // If no team, return not assigned
        return {
          team: null,
          isAssigned: false,
        };
      }
    },
    enabled: !!user?.id,
  });

  // Fetch founders
  const { data: founders = [], isLoading: foundersLoading } = useQuery<FounderProfile[]>({
    queryKey: ["/api/team-members", "FOUNDER"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/api/team-members/FOUNDER`);
      return data;
    },
    enabled: !!user && !myTeamData?.isAssigned,
  });

  // Get existing applications
  const { data: existingApplications = [] } = useQuery<{
    id: string;
    targetUserId: string;
    targetUserRole: string;
    status: string;
  }[]>({
    queryKey: ["/api/team-member-applications/sent"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/team-member-applications/sent");
      return data;
    },
    enabled: !!user && !authLoading && !myTeamData?.isAssigned,
  });

  const getApplicationForFounder = (founderId: string) => {
    return existingApplications.find(a => a.targetUserId === founderId);
  };

  const applyMutation = useMutation({
    mutationFn: async ({ targetUserId }: { targetUserId: string }) => {
      return apiRequest("POST", "/api/team-member-applications", {
        targetUserId,
        targetUserRole: "FOUNDER",
      });
    },
    onSuccess: () => {
      toast({ title: "Application sent successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-member-applications/sent"] });
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
      return apiRequest("DELETE", `/api/team-member-applications/${applicationId}`);
    },
    onSuccess: () => {
      toast({ title: "Application cancelled successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-member-applications/sent"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to cancel application", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  const pendingApplicationsCount = existingApplications.filter(
    a => a.targetUserRole === "FOUNDER" && a.status === "PENDING"
  ).length;

  const canApply = (founderId: string) => {
    const alreadyApplied = existingApplications.some(a => a.targetUserId === founderId);
    if (alreadyApplied) return false;
    if (pendingApplicationsCount >= 5) return false;
    return true;
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleCancel = () => {
    setLocation("/app");
  };

  const handleViewDetails = (founder: FounderProfile) => {
    setLocation(`/app/user-profile/${founder.id}`);
  };

  // Client-side track filtering
  const displayedFounders = founders.filter(f => {
    if (selectedTrack === "all") return true;
    const founderTrack = f.sector || f.specialization;
    if (!founderTrack) return false;
    return founderTrack.toLowerCase() === selectedTrack.toLowerCase();
  });

  if (authLoading || teamCheckLoading) {
    return (
      <AppLayout title="Join Team">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout title="Join Team">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Not authenticated. Please log in.</p>
        </div>
      </AppLayout>
    );
  }

  // Redirect co-founders/interns to open challenges page
  // They can only apply through problem statements, not directly to founders
  useEffect(() => {
    if (user && (user.role === "COFOUNDER" || user.role === "LEARNER")) {
      setLocation("/app/open-challenges");
    }
  }, [user, setLocation]);

  // Check if user role is allowed
  if (user.role !== "COFOUNDER" && user.role !== "LEARNER") {
    return (
      <AppLayout title="Join Team">
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">This page is only available for co-founders and interns.</p>
          <Button onClick={() => setLocation("/app")} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Show loading while redirecting
  if (user && (user.role === "COFOUNDER" || user.role === "LEARNER")) {
    return (
      <AppLayout title="Join Team">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Check if already assigned to team
  if (myTeamData?.isAssigned) {
    return (
      <AppLayout title="Join Team">
        <div className="max-w-2xl mx-auto mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Already on a Team</CardTitle>
              <CardDescription>You are already assigned to a team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Team: {myTeamData.team?.name}</p>
                  <p className="text-sm text-green-700">You cannot apply to other teams</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setLocation("/app")} variant="outline">
                  Go to Dashboard
                </Button>
                <Button onClick={() => setLocation("/app/team")}>
                  View My Team
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Join Team">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleCancel} className="text-gray-900/70 hover:text-gray-900 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Join a Team</h1>
            <p className="text-gray-700 mt-1">Apply to founders to join their startup team</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleCancel} className="gap-2 border-2 border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300 bg-white">
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>

      {/* Application Status */}
      <Card className="mb-6 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="font-medium">Pending Applications</span>
          </div>
          <Badge variant={pendingApplicationsCount >= 5 ? "destructive" : "default"}>
            {pendingApplicationsCount}/5
          </Badge>
        </div>
        {pendingApplicationsCount >= 5 && (
          <p className="text-sm text-red-600 mt-2">
            You have reached the maximum of 5 pending applications. Cancel some or wait for responses before applying to more founders.
          </p>
        )}
      </Card>

      {/* Founders List */}
      <Card className="relative overflow-hidden bg-white border-2 border-gray-200 shadow-xl rounded-2xl hover:border-red-200 transition-all duration-300">
        <CardHeader className="relative">
          <CardTitle className="text-gray-900">Available Founders</CardTitle>
          <CardDescription className="text-gray-700">Browse and apply to join startup teams</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-4">
            {/* Track Filter */}
            <div className="flex items-center justify-between mb-2">
              <div />
              <div className="flex items-center gap-2">
                <Select value={selectedTrack} onValueChange={setSelectedTrack}>
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
                <Badge variant="secondary" className="text-sm">{displayedFounders.length} of {founders.length}</Badge>
              </div>
            </div>

            {foundersLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : displayedFounders.length > 0 ? (
              displayedFounders.map((founder) => {
                const application = getApplicationForFounder(founder.id);
                const alreadyApplied = !!application;
                const canApplyTo = canApply(founder.id);
                const isPending = application?.status === "PENDING";
                
                return (
                  <Card key={founder.id} className="relative overflow-hidden bg-white border-2 border-gray-200 shadow-xl rounded-2xl hover:shadow-2xl hover:border-red-200 transition-all duration-300">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                    <CardContent className="py-4 relative overflow-hidden">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <Avatar className="flex-shrink-0">
                            <AvatarFallback className="bg-red-600 text-white">{getInitials(founder.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{founder.name}</h4>
                            <p className="text-sm text-gray-900/70 truncate">{founder.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {founder.sector && (
                            <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200 whitespace-nowrap max-w-[120px] truncate" title={founder.sector}>{founder.sector}</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-2 border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-300 bg-white whitespace-nowrap"
                            onClick={() => handleViewDetails(founder)}
                          >
                            <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span className="truncate">View Details</span>
                          </Button>
                          {alreadyApplied && isPending ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="whitespace-nowrap"
                              onClick={() => cancelMutation.mutate(application.id)}
                              disabled={cancelMutation.isPending}
                            >
                              {cancelMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">Cancel</span>
                                </>
                              )}
                            </Button>
                          ) : alreadyApplied ? (
                            <Badge variant="outline" className="whitespace-nowrap">{application?.status || "Applied"}</Badge>
                          ) : canApplyTo ? (
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/50 whitespace-nowrap"
                              onClick={() => applyMutation.mutate({ targetUserId: founder.id })}
                              disabled={applyMutation.isPending}
                            >
                              {applyMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <UserPlus className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <span className="truncate">Apply</span>
                                </>
                              )}
                            </Button>
                          ) : (
                            <Badge variant="destructive" className="whitespace-nowrap">Limit Reached</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-900/70">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50 text-gray-900/50" />
                <p className="text-lg font-medium text-gray-900/90">No founders available</p>
                <p className="mt-2 text-sm text-gray-900/70">Try adjusting your filters to see more candidates</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
