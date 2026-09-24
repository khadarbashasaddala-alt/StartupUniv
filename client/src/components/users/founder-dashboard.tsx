import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ApplicantProfileModal } from "@/components/ApplicantProfileModal";
import { RolesResponsibilitiesModal } from "@/components/RolesResponsibilitiesModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  GraduationCap,
  IndianRupee,
  Loader2,
  Rocket,
  Users,
  Calendar,
  Plus,
  UserPlus,
  Eye,
  Mail,
  User,
  Briefcase,
  Code,
  ExternalLink,
  BookOpen,
  Clock,
  Video,
} from "lucide-react";
import { format, isFuture } from "date-fns";
import { PageTourButton } from "@/components/tour/PageTourButton";

// Upcoming Meetings Widget Component
function UpcomingMeetingsWidget({ teamId }: { teamId: string }) {
  const { data: meetings, isLoading } = useQuery({
    queryKey: ["/api/teams", teamId, "meetings"],
    queryFn: async () => {
      return apiRequest("GET", `/api/teams/${teamId}/meetings`);
    },
    enabled: !!teamId,
  });

  const upcomingMeetings = meetings?.filter((m: any) => isFuture(new Date(m.scheduledAt))) || [];
  const nextMeetings = upcomingMeetings.slice(0, 3);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (nextMeetings.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No upcoming meetings</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {nextMeetings.map((meeting: any) => (
        <div
          key={meeting.id}
          className="flex items-center justify-between p-3 border border-border rounded-lg bg-card hover:border-primary/30 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-sm">{meeting.title}</h4>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(meeting.scheduledAt), "PPP 'at' p")}
              </div>
              {meeting.meetingLink && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => window.open(meeting.meetingLink!, "_blank")}
                >
                  <Video className="h-3 w-3 mr-1" />
                  Join
                  <ExternalLink className="h-2 w-2 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      {upcomingMeetings.length > 3 && (
        <p className="text-xs text-muted-foreground text-center">
          +{upcomingMeetings.length - 3} more meetings
        </p>
      )}
    </div>
  );
}
 
export default function FounderDashboard() {
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
      } catch (error: any) {
        console.error("Stats fetch error:", error);
        throw error;
      }
    },
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user && !authLoading,
  });

  const { data: notifications = [], isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<{
    id: string;
    type: string;
    title: string;
    message: string;
    status: string;
    metadataJson: any;
    createdAt: string;
  }[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/notifications");
        console.log("🔔 Notifications fetched:", {
          count: data.length,
          types: data.map((n: any) => n.type),
          accepted: data.filter((n: any) => n.type === "TEAM_MEMBER_APPLICATION_ACCEPTED"),
          allNotifications: data.map((n: any) => ({
            id: n.id,
            type: n.type,
            status: n.status,
            title: n.title,
            createdAt: n.createdAt,
          })),
        });
        return data;
      } catch (error: any) {
        console.error("❌ Notifications fetch error:", error);
        return [];
      }
    },
    enabled: !!user && !authLoading,
    refetchInterval: 5000, // Refetch every 5 seconds to check for new notifications
    refetchOnWindowFocus: true,
  });

  // Co-founder applications feature removed

  const unreadNotifications = notifications.filter(
    n => n.status === "UNREAD"
  );

  // Shake bell for 3 seconds when new notifications arrive
  const [shouldShake, setShouldShake] = useState(false);
  const previousUnreadCountRef = useRef<number | null>(null);
  const hasShakenForCurrentNotificationsRef = useRef<Set<string>>(new Set());
  const unreadNotificationIds = unreadNotifications.map((n) => n.id).sort().join(",");

  useEffect(() => {
    const previousCount = previousUnreadCountRef.current;
    const currentNotificationSet = unreadNotificationIds;

    const hasNewNotifications = previousCount !== null && unreadNotifications.length > previousCount;
    const isFirstTime = previousCount === null && unreadNotifications.length > 0;
    const hasNewNotificationIds = !hasShakenForCurrentNotificationsRef.current.has(currentNotificationSet);

    if ((isFirstTime || hasNewNotifications || hasNewNotificationIds) && unreadNotifications.length > 0) {
      setShouldShake(true);
      hasShakenForCurrentNotificationsRef.current.add(currentNotificationSet);
      
      const timer = setTimeout(() => {
        setShouldShake(false);
      }, 3000); // 3 seconds

      return () => clearTimeout(timer);
    }

    previousUnreadCountRef.current = unreadNotifications.length;
  }, [unreadNotifications.length, unreadNotificationIds]);

  // Debug logging
  console.log("🔍 Notification Debug:", {
    totalNotifications: notifications.length,
    unreadNotificationsCount: unreadNotifications.length,
    allNotificationTypes: notifications.map(n => n.type),
    allNotificationStatuses: notifications.map(n => n.status),
    unreadNotifications: unreadNotifications.map(n => ({
      id: n.id,
      type: n.type,
      status: n.status,
      title: n.title,
    })),
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

  // Fetch the logged-in user's own application (for fee summary card)
  const { data: myApplication } = useQuery<{ id: string; status: string } | null>({
    queryKey: ["my-application"],
    queryFn: async () => {
      const res = await fetch("/api/auth/my-application", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user && !authLoading,
  });

  // Fetch payment status once we have the applicationId
  const { data: feeStatus } = useQuery<{
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    canPayNow: boolean;
    offerExpired: boolean;
    installments: { status: string }[];
  } | null>({
    queryKey: ["payment-status", myApplication?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/applications/${myApplication!.id}/payment-status`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!myApplication?.id,
  });

  // Get founder's team with members
  const { data: myTeam, refetch: refetchMyTeam } = useQuery<{
    id: string;
    name: string;
    team?: { id: string; name: string };
    members: { id: string; name: string; role: string; band: string | null; userRole?: string }[];
  } | null>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/my-team");
        console.log("🔍 [Founder Dashboard] My Team data fetched:", {
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
      } catch (error: any) {
        console.error("❌ [Founder Dashboard] Error fetching my team:", error);
        return null;
      }
    },
    enabled: !!user && !authLoading,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 10000, // Refetch every 10 seconds to keep data fresh
    staleTime: 5000, // Consider data stale after 5 seconds
  });


  // Add to team mutation
  const addToTeamMutation = useMutation({
    mutationFn: async ({ teamId, userId, role }: { teamId: string; userId: string; role: string }) => {
      return apiRequest("POST", `/api/teams/${teamId}/members`, { userId, role });
    },
    onSuccess: async (_, variables) => {
      // Wait a moment for backend to complete role assignment creation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidate all related queries first
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/my-team"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/teams"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/founder/stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
      ]);
      
      // Refetch all data to ensure UI is updated
      await Promise.all([
        refetchMyTeam(),
        refetchNotifications(),
        refetchStats(),
      ]);
      
      // Force another refetch after a short delay to ensure data is fresh
      setTimeout(() => {
        refetchMyTeam();
      }, 1000);
      
      const roleLabel = variables.role === "Promoter" ? "Mentor" :
                        variables.role === "CoPromoter" ? "Co-Founder" :
                        variables.role === "Member" ? "Intern" : "Team Member";
      toast({ title: "Success", description: `${roleLabel} has been added to your team. They can now see the team in their dashboard.` });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add member to team", variant: "destructive" });
    },
  });

  // Track which notification is being processed
  const [addingNotificationId, setAddingNotificationId] = useState<string | null>(null);

  // Member details dialog state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [memberDetails, setMemberDetails] = useState<any>(null);
  const [loadingMemberDetails, setLoadingMemberDetails] = useState(false);

  // Helper function to get role label and sort order
  const getRoleInfo = (member: { role: string; userRole?: string }) => {
    // Check userRole first (FOUNDER, COFOUNDER, MENTOR, LEARNER)
    if (member.userRole === "FOUNDER") {
      return { label: "Founder", sortOrder: 1 };
    }
    if (member.userRole === "COFOUNDER" || member.role === "CoPromoter") {
      return { label: "Co-Founder", sortOrder: 2 };
    }
    if (member.userRole === "MENTOR" || member.role === "Promoter") {
      return { label: "Mentor", sortOrder: 3 };
    }
    if (member.userRole === "LEARNER" || member.role === "Member") {
      return { label: "Intern", sortOrder: 4 };
    }
    // Fallback to role
    if (member.role === "CoPromoter") return { label: "Co-Founder", sortOrder: 2 };
    if (member.role === "Promoter") return { label: "Mentor", sortOrder: 3 };
    return { label: member.role, sortOrder: 4 };
  };

  // Sort members: Founder → Co-founder → Mentor → Intern
  const sortedMembers = myTeam?.members ? [...myTeam.members].sort((a, b) => {
    const aInfo = getRoleInfo(a);
    const bInfo = getRoleInfo(b);
    return aInfo.sortOrder - bInfo.sortOrder;
  }) : [];

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

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      refetchNotifications();
    },
  });

  const handleAddToTeam = async (notification: any) => {
    // Set the notification ID being processed to show loading only for this button
    setAddingNotificationId(notification.id);
    
    try {
      const metadata = notification.metadataJson || {};
      // Support both team member applications and problem statement applications
      const targetUserId = metadata.targetUserId || metadata.applicantId;
      const targetUserRole = metadata.targetUserRole || metadata.applicantRole;

      if (!targetUserId) {
        toast({ title: "Error", description: "Invalid notification data", variant: "destructive" });
        setAddingNotificationId(null);
        return;
      }

      // If founder doesn't have a team, create one first
      let teamId = myTeam?.team?.id || myTeam?.id;
      if (!teamId) {
        try {
          // Create a new team for the founder
          const newTeam = await apiRequest("POST", "/api/teams", {
            name: `${user?.name || "Founder"}'s Team`,
            cohortId: null, // Will be assigned later by admin
          });
          teamId = newTeam.id;
          // Wait a bit for the team to be fully created, then refresh
          await new Promise((resolve) => setTimeout(resolve, 500));
          const refreshedTeam = await refetchMyTeam();
          // Use the team ID from the refreshed data or the newly created team
          teamId = refreshedTeam.data?.team?.id || newTeam.id;
          toast({ title: "Team Created", description: "A new team has been created for you." });
        } catch (error: any) {
          toast({
            title: "Error",
            description: error.message || "Failed to create team. Please contact admin.",
            variant: "destructive",
          });
          setAddingNotificationId(null);
          return;
        }
      }

      // Determine role based on targetUserRole
      let role = "Member";
      if (targetUserRole === "MENTOR") {
        role = "Promoter"; // Mentors are typically Promoters
      } else if (targetUserRole === "COFOUNDER") {
        role = "CoPromoter";
      } else if (targetUserRole === "LEARNER") {
        role = "Member";
      }

      await addToTeamMutation.mutateAsync({
        teamId: teamId!,
        userId: targetUserId,
        role,
      });

      // Mark notification as read - this will remove it from the list
      await markAsReadMutation.mutateAsync(notification.id);
      
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to add to team", 
        variant: "destructive" 
      });
    } finally {
      setAddingNotificationId(null);
    }
  };


  const isLoading = statsLoading;

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
      <AppLayout title="Founder Dashboard">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout title="Founder Dashboard">
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-sm font-medium text-destructive">Not authenticated. Please log in.</p>
        </div>
      </AppLayout>
    );
  }


  return (
    <AppLayout 
      title="Founder Dashboard"
      headerAction={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-14 w-14 bg-card border border-border hover:border-primary/50">
              <Bell className={`h-9 w-9 text-primary ${shouldShake ? 'animate-shake' : ''}`} />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {unreadNotifications.length}
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
              ) : unreadNotifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No new notifications</div>
              ) : (
                unreadNotifications.map((notification) => {
                  const metadata = notification.metadataJson || {};
                  const isProblemStatementApplication = notification.type === "PROBLEM_STATEMENT_APPLICATION_RECEIVED";
                  
                  // For problem statement applications, use applicantRole and applicantId
                  const roleLabel = isProblemStatementApplication 
                    ? (metadata.applicantRole === "COFOUNDER" ? "Co-Founder" : metadata.applicantRole === "LEARNER" ? "Intern" : "Team Member")
                    : (metadata.targetUserRole === "MENTOR" ? "Mentor" :
                       metadata.targetUserRole === "COFOUNDER" ? "Co-Founder" :
                       metadata.targetUserRole === "LEARNER" ? "Intern" : "Team Member");
                  
                  const isReceivedNotification = notification.type === "TEAM_MEMBER_APPLICATION_RECEIVED";
                  const isPaymentReminder = notification.type === "PAYMENT_REMINDER";
                  
                  return (
                    <div 
                      key={notification.id} 
                      className="p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        // Mark as read when notification card is clicked
                        if (notification.status === "UNREAD") {
                          markAsReadMutation.mutate(notification.id);
                        }
                        // Navigate to applications page if it's a problem statement application
                        if (isProblemStatementApplication && metadata.problemStatementId) {
                          setLocation(`/app/problem-statements/${metadata.problemStatementId}/applications`);
                        } else if (isReceivedNotification) {
                          setLocation("/app/founder/applications");
                        }
                      }}
                    >
                      <div className="mb-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">{notification.message}</p>
                        {(metadata.targetUserName || metadata.applicantName || metadata.applicantId) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {roleLabel}: {metadata.targetUserName || metadata.applicantName || "Applicant"} {(metadata.targetUserEmail || metadata.applicantEmail) ? `(${metadata.targetUserEmail || metadata.applicantEmail})` : ""}
                          </p>
                        )}
                      </div>
                      {isProblemStatementApplication ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click from firing
                            // Mark as read when clicked
                            if (notification.status === "UNREAD") {
                              markAsReadMutation.mutate(notification.id);
                            }
                            // Navigate to problem statement applications page
                            if (metadata.problemStatementId) {
                              setLocation(`/app/problem-statements/${metadata.problemStatementId}/applications`);
                            }
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      ) : isReceivedNotification ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click from firing
                            // Mark as read when clicked
                            if (notification.status === "UNREAD") {
                              markAsReadMutation.mutate(notification.id);
                            }
                            setLocation("/app/founder/applications");
                          }}
                        >
                          <Bell className="h-3 w-3 mr-1" />
                          View Applications
                        </Button>
                      ) : isPaymentReminder ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notification.status === "UNREAD") {
                              markAsReadMutation.mutate(notification.id);
                            }
                            setLocation("/app/my-fees");
                          }}
                        >
                          View Fees
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent card click from firing
                            // Mark as read when clicked (handleAddToTeam already marks as read, but do it here too for immediate feedback)
                            if (notification.status === "UNREAD") {
                              markAsReadMutation.mutate(notification.id);
                            }
                            handleAddToTeam(notification);
                          }}
                          disabled={addingNotificationId === notification.id}
                        >
                          {addingNotificationId === notification.id ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3 w-3 mr-1" />
                              Add {roleLabel} to Team
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Header with Create Team Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-tour="dashboard-heading">Founder Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your startup team</p>
        </div>
        <div className="flex items-center gap-3">
          <PageTourButton pageKey="dashboard" />
          <Button onClick={() => setLocation("/app/learning")} className="gap-2 transition-all duration-300 hover:scale-105">
            <BookOpen className="h-4 w-4" />
            Start Learning
          </Button>
          <Button onClick={() => setLocation("/app/create-team")} className="gap-2 transition-all duration-300 hover:scale-105">
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        </div>
      </div>

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


      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300" data-tour="dashboard-team-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">My Team</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.teamName || "No Team"}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.teamMembers || 0} members
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300" data-tour="dashboard-pending-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Pending Applications</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.pendingApplications || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Waiting for response
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300" data-tour="dashboard-accepted-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Accepted Applications</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.acceptedApplications || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Ready to join team
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-card border border-border shadow-lg rounded-xl hover:border-primary/30 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
            <CardTitle className="text-sm font-medium text-foreground">Total Applications</CardTitle>
            <Rocket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="relative">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground">{stats?.totalApplications || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.cofoundersApplied || 0} co-founders, {stats?.mentorsApplied || 0} mentors, {stats?.learnersApplied || 0} interns
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Payment Summary Card */}
      {myApplication && feeStatus && ["OFFER", "PARTIALLY_PAID", "PAID"].includes(myApplication.status) && (() => {
        const progressPercent = feeStatus.totalAmount > 0
          ? Math.round((feeStatus.paidAmount / feeStatus.totalAmount) * 100)
          : 0;
        const isFullyPaid = feeStatus.pendingAmount === 0;
        const paidCount = feeStatus.installments.filter(i => i.status === "PAID").length;
        const totalCount = feeStatus.installments.length;
        const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

        return (
          <Card className="mb-8 border border-border shadow-lg rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-primary" />
                  Fee Payment Status
                  {isFullyPaid
                    ? <Badge className="bg-green-100 text-green-800 border-green-200 ml-1">Fully Paid</Badge>
                    : <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 ml-1">{paidCount}/{totalCount} Paid</Badge>
                  }
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setLocation("/app/my-fees")}>
                  View Details
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Fee</p>
                  <p className="text-sm sm:text-lg font-bold mt-1 break-all">{fmt(feeStatus.totalAmount)}</p>
                </div>
                <div className="border-x">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid</p>
                  <p className="text-sm sm:text-lg font-bold text-green-600 mt-1 break-all">{fmt(feeStatus.paidAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending</p>
                  <p className="text-sm sm:text-lg font-bold text-yellow-600 mt-1 break-all">{fmt(feeStatus.pendingAmount)}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progressPercent}% paid</span>
                  <span>{fmt(feeStatus.paidAmount)} / {fmt(feeStatus.totalAmount)}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              {!isFullyPaid && feeStatus.canPayNow && (
                <p className="text-xs text-primary font-medium">✓ Payment available — click View Details to pay now.</p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Scheduled Sessions (cohort sessions visible to founder) */}
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

      {/* Upcoming Meetings Widget */}
      {myTeam && (myTeam.team || myTeam.id) && (
        <Card className="mb-8 relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl" data-tour="dashboard-meetings-section">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Meetings
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Your team's scheduled meetings
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/app/my-meetings")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <UpcomingMeetingsWidget teamId={myTeam.team?.id || myTeam.id} />
          </CardContent>
        </Card>
      )}

      {/* My Team Members */}
      {myTeam && (myTeam.team || myTeam.id) && (
        <Card className="mb-8 relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl" data-tour="dashboard-team-members-section">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          <CardHeader className="relative">
            <CardTitle className="text-foreground">My Team Members</CardTitle>
            <CardDescription className="text-muted-foreground">Team members in {myTeam.team?.name || myTeam.name}</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {!myTeam.members || myTeam.members.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No team members yet. Add members from accepted applications.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedMembers.map((member) => {
                  const roleInfo = getRoleInfo(member);
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-card shadow-sm hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{roleInfo.label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-primary text-primary bg-primary/10">{roleInfo.label}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground hover:bg-primary/10"
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

      
      {/* Removed Co-Founder Applications and Applications Status cards */}
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
        role={user?.role || 'FOUNDER'}
      />
    </AppLayout>
  );
}

