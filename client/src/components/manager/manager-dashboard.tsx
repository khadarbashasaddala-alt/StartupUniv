import { useState, useEffect, useRef } from "react";
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
import {
  BarChart3,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  Bell,
  Loader2,
  ArrowRight,
  Plus,
  FileQuestion,
  Clock,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  passingScore: number | null;
  questionCount?: number;
  createdAt: string;
}

interface MentorProfile {
  id: string;
  userId: string;
  fullName: string;
  credentialsApprovedBy: string | null;
  credentialsShared: boolean;
  user: {
    email: string;
  };
}

export default function ManagerDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const [shouldShake, setShouldShake] = useState(false);
  const [credentialsFilter, setCredentialsFilter] = useState<"all" | "approved" | "shared" | "waiting">("all");
  const previousUnreadCountRef = useRef<number | null>(null);
  const hasShakenForCurrentNotificationsRef = useRef<Set<string>>(new Set());

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<{
    totalApplications: number;
    newApplications: number;
    reviewApplications: number;
    acceptedApplications: number;
    rejectedApplications: number;
  }>({
    queryKey: ["/api/manager/stats"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/manager/stats");
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

  const { data: allNotifications = [], isLoading: notificationsLoading } = useQuery<{
    id: string;
    type: string;
    title: string;
    message: string;
    status: string;
    createdAt: string;
  }[]>({
    queryKey: ["/api/manager/notifications"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/manager/notifications");
        return data;
      } catch (error: any) {
        console.error("Notifications fetch error:", error);
        return [];
      }
    },
    enabled: !!user && !authLoading,
    refetchInterval: 30000,
  });

  const unreadCount = allNotifications.filter((n) => n.status === "UNREAD").length;
  const unreadNotificationIds = allNotifications
    .filter((n) => n.status === "UNREAD")
    .map((n) => n.id)
    .sort()
    .join(",");

  // Shake bell for 10 seconds only:
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
      
      previousUnreadCountRef.current = unreadCount;
      
      return () => clearTimeout(timer);
    } else {
      setShouldShake(false);
      if (previousCount !== null) {
        previousUnreadCountRef.current = unreadCount;
      }
    }
  }, [unreadCount, unreadNotificationIds]);

  const { data: credentialsStatus = [] } = useQuery<MentorProfile[]>({
    queryKey: ["/api/manager/mentors"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/manager/mentors");
        return data;
      } catch (error: any) {
        console.error("Mentors fetch error:", error);
        return [];
      }
    },
    enabled: !!user && !authLoading,
  });

  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ["/api/manager/assessments"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/manager/assessments");
        return data;
      } catch (error: any) {
        console.error("Assessments fetch error:", error);
        return [];
      }
    },
    enabled: !!user && !authLoading,
  });


  const handleCardClick = (filter?: string) => {
    if (filter) {
      setLocation(`/app/manager/applications?status=${filter}`);
    } else {
      setLocation("/app/manager/applications");
    }
  };

  if (statsError) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load dashboard data. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Manager Dashboard"
      headerAction={
        <Button
          variant="outline"
          size="icon"
          className="relative h-14 w-14 bg-card border border-border hover:border-primary/50 hover:bg-primary/5"
          onClick={() => setLocation("/app/manager/notifications")}
        >
          <Bell className={`h-9 w-9 text-primary ${shouldShake ? 'animate-shake' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      }
    >
      <div className="space-y-6 p-6">
        {/* Stats Cards - Responsive and Clickable */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Card
            className="relative overflow-hidden cursor-pointer bg-card border border-border shadow-lg rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            onClick={() => handleCardClick()}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Total Applications</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              {statsLoading ? (
                <Skeleton className="h-8 w-20 bg-muted" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.totalApplications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">All intern applications</p>
            </CardContent>
          </Card>

          <Card
            className="relative overflow-hidden cursor-pointer bg-card border border-border shadow-lg rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            onClick={() => handleCardClick("NEW")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">New Applications</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              {statsLoading ? (
                <Skeleton className="h-8 w-20 bg-muted" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.newApplications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Pending review</p>
            </CardContent>
          </Card>

          <Card
            className="relative overflow-hidden cursor-pointer bg-card border border-border shadow-lg rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            onClick={() => handleCardClick("REVIEW")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">In Review</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              {statsLoading ? (
                <Skeleton className="h-8 w-20 bg-muted" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.reviewApplications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Assessment in progress</p>
            </CardContent>
          </Card>

          <Card
            className="relative overflow-hidden cursor-pointer bg-card border border-border shadow-lg rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            onClick={() => handleCardClick("ACCEPTED")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Accepted</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              {statsLoading ? (
                <Skeleton className="h-8 w-20 bg-muted" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.acceptedApplications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Approved candidates</p>
            </CardContent>
          </Card>

          <Card
            className="relative overflow-hidden cursor-pointer bg-card border border-border shadow-lg rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
            onClick={() => handleCardClick("REJECT")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              {statsLoading ? (
                <Skeleton className="h-8 w-20 bg-muted" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats?.rejectedApplications || 0}</div>
              )}
              <p className="text-xs text-muted-foreground">Not selected</p>
            </CardContent>
          </Card>
        </div>

        {/* Assessment Section */}
        <Card className="relative overflow-hidden border border-border bg-card shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
          <CardContent className="pt-6 relative">
            <Button onClick={() => setLocation("/app/manager/assessments")} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Create Assessment
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Credentials Status */}
          <Card className="relative overflow-hidden border border-border bg-card shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  Credentials Status
                </CardTitle>
                <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/30">
                  {credentialsStatus.filter((c) => c.credentialsApprovedBy && !c.credentialsShared).length} Pending
                </Badge>
              </div>
              <CardDescription>Mentor credentials approval status</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={credentialsFilter === "approved" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCredentialsFilter("approved")}
                  className={credentialsFilter === "approved" ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" : "border-primary text-primary hover:bg-primary/10 bg-card font-semibold"}
                >
                  Approved
                </Button>
                <Button
                  variant={credentialsFilter === "shared" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCredentialsFilter("shared")}
                  className={credentialsFilter === "shared" ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" : "border-primary text-primary hover:bg-primary/10 bg-card font-semibold"}
                >
                  Shared
                </Button>
                <Button
                  variant={credentialsFilter === "waiting" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCredentialsFilter("waiting")}
                  className={credentialsFilter === "waiting" ? "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" : "border-primary text-primary hover:bg-primary/10 bg-card font-semibold"}
                >
                  Waiting
                </Button>
              </div>
              {credentialsStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No mentor profiles found
                </p>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {credentialsStatus
                      .filter((profile) => {
                        if (credentialsFilter === "approved") {
                          return profile.credentialsApprovedBy && !profile.credentialsShared;
                        } else if (credentialsFilter === "shared") {
                          return profile.credentialsShared;
                        } else if (credentialsFilter === "waiting") {
                          return !profile.credentialsApprovedBy;
                        }
                        return true;
                      })
                      .map((profile) => (
                      <div
                        key={profile.id}
                        className={cn(
                          "p-3 border rounded-lg border-border bg-muted/30"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-foreground">{profile.fullName}</p>
                            <p className="text-xs font-semibold text-muted-foreground">{profile.user?.email}</p>
                            <div className="mt-2">
                              {!profile.credentialsApprovedBy ? (
                                <Badge variant="outline" className="bg-amber-100/50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">
                                  Waiting Approval
                                </Badge>
                              ) : !profile.credentialsShared ? (
                                <Badge className="bg-green-100/50 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">
                                  Approved - Ready to Share
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">Shared</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <Button
                variant="outline"
                className="w-full mt-4 border-primary text-primary hover:bg-primary/10"
                onClick={() => setLocation("/app/manager/mentors")}
              >
                View All Mentors
              </Button>
            </CardContent>
          </Card>

          {/* Assessment Details */}
          <Card className="relative overflow-hidden border border-border bg-card shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
            <CardHeader className="relative">
              <CardTitle className="text-foreground">Assessment Details</CardTitle>
              <CardDescription>Recent assessment activities</CardDescription>
            </CardHeader>
            <CardContent className="relative">
              {assessments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No assessments created yet
                </p>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {assessments.slice(0, 10).map((assessment) => (
                      <div
                        key={assessment.id}
                        className="p-3 border border-border rounded-lg hover:bg-primary/5 cursor-pointer bg-card"
                        onClick={() => setLocation(`/app/manager/assessments?assessment=${assessment.id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-bold text-foreground">{assessment.title}</p>
                            {assessment.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {assessment.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2">
                              {assessment.durationMinutes && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {assessment.durationMinutes} min
                                </div>
                              )}
                              {assessment.questionCount !== undefined && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <FileQuestion className="h-3 w-3" />
                                  {assessment.questionCount} questions
                                </div>
                              )}
                            </div>
<p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(assessment.createdAt), "MMM d, h:mm a")}
                          </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <Button
                variant="outline"
                className="w-full mt-4 border-primary text-primary hover:bg-primary/10"
                onClick={() => setLocation("/app/manager/assessments")}
              >
                View All Assessments
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="relative overflow-hidden border border-border bg-card shadow-lg rounded-xl hover:border-primary/50 transition-all duration-300">
          <CardHeader className="relative">
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <div className="grid gap-4 md:grid-cols-3">
              <Button
                variant="outline"
                className="h-auto flex-col items-start p-4 border-border text-foreground hover:bg-primary/5 bg-card"
                onClick={() => setLocation("/app/manager/applications")}
              >
                <FileText className="h-6 w-6 mb-2 text-primary" />
                <span className="font-semibold">Review Applications</span>
                <span className="text-xs text-muted-foreground mt-1">
                  View and manage intern applications
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-start p-4 border-border text-foreground hover:bg-primary/5 bg-card"
                onClick={() => setLocation("/app/manager/assessments")}
              >
                <BarChart3 className="h-6 w-6 mb-2 text-primary" />
                <span className="font-semibold">Review Assessments</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Check candidate test results
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col items-start p-4 border-border text-foreground hover:bg-primary/5 bg-card"
                onClick={() => setLocation("/app/manager/mentors")}
              >
                <Users className="h-6 w-6 mb-2 text-primary" />
                <span className="font-semibold">Manage Mentors</span>
                <span className="text-xs text-muted-foreground mt-1">
                  View and add mentors
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
