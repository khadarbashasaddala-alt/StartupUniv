import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Users,
  FileText,
  Target,
  Activity,
  Mail,
  User,
  Loader2,
} from "lucide-react";

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

interface ProblemStatement {
  id: string;
  title: string;
  track: string;
  summary: string;
  difficulty?: string;
  tags?: string[];
}

interface TeamDetail {
  id: string;
  name: string;
  cohortId: string;
  problemStatementId: string | null;
  health?: string;
  members: TeamMember[];
  problemStatement?: ProblemStatement;
}

export default function TeamDetailPage() {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adminAssignPsId, setAdminAssignPsId] = useState<string | null>(null);

  // Handle both /app/team/:teamId and /app/app/team/:teamId (production routing issue)
  // Extract team ID from URL patterns like /app/team/xxx or /app/app/team/xxx
  const teamIdMatch = location.match(/\/app\/app?\/team\/([^/]+)/);
  const teamId = teamIdMatch ? teamIdMatch[1] : null;
  
  console.log("🔍 TeamDetailPage - Location:", location, "TeamId:", teamId);

  const { data: team, isLoading, error } = useQuery<TeamDetail>({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: async () => {
      if (!teamId) {
        throw new Error("Team ID is required");
      }
      console.log("🔍 Fetching team details for team:", teamId);
      try {
        const result = await apiRequest("GET", `/teams/${teamId}`);
        console.log("✅ Team details fetched:", result);
        return result;
      } catch (error: any) {
        console.error("❌ Failed to fetch team details:", error);
        // If 404, return null instead of throwing
        if (error.message?.includes("404") || error.message?.includes("not found")) {
          console.log("⚠️ Team not found:", teamId);
          return null;
        }
        throw error;
      }
    },
    enabled: !!teamId,
    retry: 1,
  });

  const isAdmin = user?.role === "ADMIN";
  const { data: publishedPsList } = useQuery<{ items?: { id: string; title: string; track?: string }[] }>({
    queryKey: ["/api/problem-statements", "published", "all"],
    queryFn: () => apiRequest("GET", "/api/problem-statements?status=PUBLISHED&limit=100"),
    enabled: !!teamId && !!isAdmin,
  });
  const publishedPs = (publishedPsList && "items" in publishedPsList && publishedPsList.items) || (Array.isArray(publishedPsList) ? publishedPsList : []) || [];

  const assignPsMutation = useMutation({
    mutationFn: async (problemStatementId: string | null) => {
      return apiRequest("PATCH", `/api/teams/${teamId}`, {
        problemStatementId: problemStatementId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}`] });
      toast({ title: "Problem statement assigned", description: "Team members can now see it in the Problem Statement tab." });
      setAdminAssignPsId(null);
    },
    onError: (e: any) => {
      toast({ title: "Failed to assign", description: e?.message || "Please try again", variant: "destructive" });
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Promoter":
        return "default";
      case "CoPromoter":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "G":
        return "bg-green-500";
      case "A":
        return "bg-[#D4A574]";
      case "R":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getHealthLabel = (health: string) => {
    switch (health) {
      case "G":
        return "Green";
      case "A":
        return "Amber";
      case "R":
        return "Red";
      default:
        return "Unknown";
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  if (error || !team) {
    return (
      <AppLayout>
        <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-300/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <CardContent className="text-center py-12 relative">
            <p className="text-slate-700">Team not found</p>
            <Button
              variant="outline"
              className="mt-4 border-red-600 text-red-700 hover:bg-red-50"
              onClick={() => setLocation("/app/teams")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Teams
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/app/teams")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
              <p className="text-muted-foreground">Team Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${getHealthColor(team.health || "G")}`} />
            <Badge variant="outline">
              {getHealthLabel(team.health || "G")} Health
            </Badge>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Team Size Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-300/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Users className="h-5 w-5" />
                Team Size
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-4xl font-bold text-slate-900">{team.members.length}</div>
              <p className="text-sm text-slate-600 mt-2">
                {team.members.filter((m) => m.role === "Promoter").length} Promoter
                {team.members.filter((m) => m.role === "Promoter").length !== 1 ? "s" : ""},{" "}
                {team.members.filter((m) => m.role === "CoPromoter").length} Co-Promoter
                {team.members.filter((m) => m.role === "CoPromoter").length !== 1 ? "s" : ""},{" "}
                {team.members.filter((m) => m.role === "Member").length} Member
                {team.members.filter((m) => m.role === "Member").length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          {/* Health Status Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-300/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Activity className="h-5 w-5" />
                Health Status
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full ${getHealthColor(team.health || "G")}`} />
                <div>
                  <div className="text-2xl font-bold text-slate-900">{getHealthLabel(team.health || "G")}</div>
                  <p className="text-sm text-slate-600">Current team health status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Problem Statement Card */}
        {team.problemStatement ? (
          <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-40 h-40 bg-red-300/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <FileText className="h-5 w-5" />
                Problem Statement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">{team.problemStatement.title}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">
                    <Target className="h-3 w-3 mr-1" />
                    {team.problemStatement.track}
                  </Badge>
                  {team.problemStatement.difficulty && (
                    <Badge variant="outline">{team.problemStatement.difficulty}</Badge>
                  )}
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {team.problemStatement.summary}
                </p>
              </div>
              {team.problemStatement.tags && team.problemStatement.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {team.problemStatement.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {isAdmin && publishedPs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <Label className="text-slate-600 text-sm">Change problem statement (admin)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={adminAssignPsId ?? team.problemStatementId ?? ""}
                      onValueChange={(v) => setAdminAssignPsId(v || null)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select different one" />
                      </SelectTrigger>
                      <SelectContent>
                        {publishedPs.map((ps: { id: string; title: string; track?: string }) => (
                          <SelectItem key={ps.id} value={ps.id}>
                            {ps.title} {ps.track ? `(${ps.track})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => adminAssignPsId && assignPsMutation.mutate(adminAssignPsId)}
                      disabled={!adminAssignPsId || adminAssignPsId === team.problemStatementId || assignPsMutation.isPending}
                    >
                      {assignPsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-300/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardContent className="text-center py-8 text-slate-700 relative">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No problem statement assigned yet</p>
              {isAdmin && publishedPs.length > 0 && (
                <div className="mt-4 text-left max-w-sm mx-auto space-y-2">
                  <Label className="text-slate-700">Assign problem statement (admin)</Label>
                  <Select
                    value={adminAssignPsId ?? ""}
                    onValueChange={(v) => setAdminAssignPsId(v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select one" />
                    </SelectTrigger>
                    <SelectContent>
                      {publishedPs.map((ps: { id: string; title: string; track?: string }) => (
                        <SelectItem key={ps.id} value={ps.id}>
                          {ps.title} {ps.track ? `(${ps.track})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => adminAssignPsId && assignPsMutation.mutate(adminAssignPsId)}
                    disabled={!adminAssignPsId || assignPsMutation.isPending}
                  >
                    {assignPsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Team Members Card */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-300/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Users className="h-5 w-5" />
              Team Members ({team.members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {team.members.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {team.members.map((member) => (
                  <Card key={member.id} className="relative overflow-hidden bg-gradient-to-br from-white via-[#FEFBF8] to-[#FAF7F3] backdrop-blur-xl border border-[#E3D9CC] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-300/20 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
                    <CardContent className="p-4 relative">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {member.user ? getInitials(member.user.name) : "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate text-slate-900">
                              {member.user?.name || "Unknown"}
                            </h4>
                            <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                              {member.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-slate-600 mb-2">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{member.user?.email}</span>
                          </div>
                          {member.user?.role && (
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <User className="h-3 w-3" />
                              <span>{member.user.role}</span>
                            </div>
                          )}
                          {member.stipendBand && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              Stipend Band {member.stipendBand}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-700">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
