import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  Eye,
  Users,
  Crown,
  GraduationCap,
  Award,
  Mail,
  Phone,
  MapPin,
  Plus,
  UserPlus,
  Calendar,
} from "lucide-react";
import { TeamMeetings } from "./team-meetings";

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role: string;
  band: string | null;
  userRole?: string;
  phone?: string;
  bio?: string;
  specialization?: string;
  avatarUrl?: string;
}

interface TeamData {
  id: string;
  name: string;
  team?: { id: string; name: string };
  members: TeamMember[];
}

export default function MyTeamPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { startPageTourIfFirst(user?.role === "COFOUNDER" ? "cf-my-team" : "my-team"); }, [user?.role]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "cofounders" | "mentors" | "learners" | "meetings">("all");
  
  // Check if user can create/manage teams (only founders and co-founders)
  const canManageTeam = user?.role === "FOUNDER" || user?.role === "COFOUNDER";

  // Fetch user's team data
  const { data: myTeam, isLoading: teamLoading, error: teamError, refetch: refetchMyTeam } = useQuery<TeamData>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/my-team");
      console.log("🔍 [My Team Page] Team data fetched:", {
        hasData: !!data,
        hasTeam: !!(data?.team || data?.id),
        membersCount: data?.members?.length || 0,
        members: data?.members?.map((m: { id: string; name: string; role: string }) => ({
          id: m.id,
          name: m.name,
          role: m.role,
        })),
      });
      return data;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Refetch every 10 seconds to keep data fresh
    staleTime: 5000, // Consider data stale after 5 seconds
  });


  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleInfo = (member: TeamMember) => {
    if (member.userRole === "FOUNDER" || member.role === "Founder") {
      return { label: "Founder", sortOrder: 1, icon: Crown, variant: "default" as const };
    }
    if (member.userRole === "COFOUNDER" || member.role === "CoPromoter") {
      return { label: "Co-Founder", sortOrder: 2, icon: Crown, variant: "secondary" as const };
    }
    if (member.userRole === "MENTOR" || member.role === "Promoter") {
      return { label: "Mentor", sortOrder: 3, icon: Award, variant: "outline" as const };
    }
    if (member.userRole === "LEARNER" || member.role === "Member") {
      return { label: "Intern", sortOrder: 4, icon: GraduationCap, variant: "default" as const };
    }
    return { label: member.role, sortOrder: 5, icon: Users, variant: "outline" as const };
  };

  const handleViewProfile = (memberId: string) => {
    setLocation(`/app/user-profile/${memberId}`);
  };

  if (teamError) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-destructive mb-4">Failed to load team information</p>
              {canManageTeam && (
              <Button onClick={() => setLocation("/app/create-team")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
              )}
              {!canManageTeam && (
                <p className="text-muted-foreground">Please contact your team founder or administrator for assistance.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!myTeam && !teamLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">My Team</h1>
            <p className="text-muted-foreground mt-2">
              Your team information and members
            </p>
          </div>
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Users className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Team Found</h3>
              {user?.role === "COFOUNDER" ? (
                <p className="text-muted-foreground">
                  You haven't been added to a team yet. Wait for a founder's invitation to join a team.
                </p>
              ) : canManageTeam ? (
                <>
              <p className="text-muted-foreground mb-6">
                You're not currently part of a team. Create one to get started.
              </p>
              <div className="space-y-3">
                <Button onClick={() => setLocation("/app/create-team")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Team
                </Button>
                <div className="text-sm text-muted-foreground">or</div>
                <Button variant="outline" onClick={() => setLocation("/app/all-team-members")}>
                  <Users className="h-4 w-4 mr-2" />
                  Browse Available Members
                </Button>
              </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  You're not currently part of a team. Please wait for a founder to add you to a team.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Filter and categorize team members
  const allMembers = myTeam?.members || [];
  
  // Filter by search query
  const filteredMembers = allMembers.filter(member =>
    searchQuery === "" ||
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.email && member.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    getRoleInfo(member).label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Categorize members
  const founders = filteredMembers.filter(m => 
    m.userRole === "FOUNDER" || m.role === "Founder"
  );
  
  const cofounders = filteredMembers.filter(m => 
    m.userRole === "COFOUNDER" || m.role === "CoPromoter"
  );
  
  const mentors = filteredMembers.filter(m => 
    (m.userRole === "MENTOR" || m.role === "Promoter") &&
    m.userRole !== "FOUNDER" && m.role !== "Founder" &&
    m.userRole !== "COFOUNDER" && m.role !== "CoPromoter"
  );
  
  const learners = filteredMembers.filter(m => 
    m.userRole === "LEARNER" || m.role === "Member"
  );

  // Get current tab members
  const getCurrentTabMembers = () => {
    switch (activeTab) {
      case "cofounders":
        return [...founders, ...cofounders];
      case "mentors":
        return mentors;
      case "learners":
        return learners;
      case "meetings":
        return []; // Meetings tab doesn't show members
      default:
        return filteredMembers.sort((a, b) => {
          const aInfo = getRoleInfo(a);
          const bInfo = getRoleInfo(b);
          return aInfo.sortOrder - bInfo.sortOrder;
        });
    }
  };

  const currentMembers = getCurrentTabMembers();

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Team</h1>
          <p className="text-muted-foreground mt-2">
            {myTeam?.name ? `${myTeam.name} - ` : ''}Your team members and information
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span data-tour="team-name-heading">{myTeam?.name || 'Team Members'}</span>
              </div>
              <div className="flex items-center gap-3">
                <PageTourButton pageKey={user?.role === "COFOUNDER" ? "cf-my-team" : "my-team"} />
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {allMembers.length} {allMembers.length === 1 ? 'Member' : 'Members'}
                </Badge>
                {user?.role === "FOUNDER" && (
                  <Button size="sm" onClick={() => setLocation("/app/create-team")} data-tour="create-team-btn">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                )}
              </div>
            </CardTitle>
            <CardDescription>
              Manage and view your team member profiles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamLoading ? (
              <div className="space-y-6">
                <div className="flex gap-4">
                  <Skeleton className="h-10 w-80" />
                  <Skeleton className="h-10 w-48" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                          </div>
                          <Skeleton className="h-8 w-20" />
                          <Skeleton className="h-9 w-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                    <TabsList data-tour="team-filter-tabs">
                      <TabsTrigger value="all" className="gap-2">
                        <Users className="h-4 w-4" />
                        All Members
                        <Badge variant="secondary" className="ml-1">
                          {allMembers.length}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="cofounders" className="gap-2">
                        <Crown className="h-4 w-4" />
                        Founders
                        <Badge variant="secondary" className="ml-1">
                          {founders.length + cofounders.length}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="mentors" className="gap-2">
                        <Award className="h-4 w-4" />
                        Mentors
                        <Badge variant="secondary" className="ml-1">
                          {mentors.length}
                        </Badge>
                      </TabsTrigger>
                      <TabsTrigger value="learners" className="gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Interns
                        <Badge variant="secondary" className="ml-1">
                          {learners.length}
                        </Badge>
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search team members..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-80"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Shared member card renderer - used by all, cofounders, mentors, interns */}
                  {(["all", "cofounders", "mentors", "learners"] as const).map((tabValue) => (
                    <TabsContent key={tabValue} value={tabValue} className="mt-0">
                      {currentMembers.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {currentMembers.map((member) => {
                            const roleInfo = getRoleInfo(member);
                            return (
                              <Card key={member.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="pt-6">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage src={member.avatarUrl || undefined} />
                                        <AvatarFallback>
                                          {getInitials(member.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold truncate">{member.name || "Unknown"}</h3>
                                        {member.email && (
                                          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <Badge variant={roleInfo.variant} className="gap-1">
                                        <roleInfo.icon className="h-3 w-3" />
                                        {roleInfo.label}
                                      </Badge>
                                      {member.band && (
                                        <Badge variant="outline" className="text-xs">
                                          Band {member.band}
                                        </Badge>
                                      )}
                                    </div>

                                    {member.specialization && (
                                      <p className="text-xs text-muted-foreground">
                                        <strong>Specialization:</strong> {member.specialization}
                                      </p>
                                    )}

                                    {member.bio && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {member.bio}
                                      </p>
                                    )}

                                    {(member.email || member.phone) && (
                                      <>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            {member.email && (
                                              <div className="flex items-center gap-1">
                                                <Mail className="h-3 w-3" />
                                                <span className="truncate max-w-[120px]">{member.email}</span>
                                              </div>
                                            )}
                                            {member.phone && (
                                              <div className="flex items-center gap-1">
                                                <Phone className="h-3 w-3" />
                                                <span>{member.phone}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </>
                                    )}

                                    <Button
                                      className="w-full"
                                      variant="outline"
                                      onClick={() => handleViewProfile(member.id)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Profile
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                          <p className="text-muted-foreground">
                            {searchQuery
                              ? `No team members found matching "${searchQuery}"`
                              : tabValue === "all"
                                ? "No team members yet"
                                : tabValue === "cofounders"
                                  ? "No founders or co-founders in your team yet"
                                  : tabValue === "mentors"
                                    ? "No mentors in your team yet"
                                    : "No interns in your team yet"}
                          </p>
                          {!searchQuery && canManageTeam && (
                            <Button
                              variant="outline"
                              className="mt-4"
                              onClick={() => setLocation("/app/create-team")}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Add Team Members
                            </Button>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  ))}

                  <TabsContent value="meetings" className="mt-0">
                    {myTeam?.id ? (
                      <TeamMeetings 
                        teamId={myTeam.id} 
                        teamName={myTeam.name}
                        canCreate={canManageTeam || user?.role === "MENTOR"}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>You need to be part of a team to view meetings.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}