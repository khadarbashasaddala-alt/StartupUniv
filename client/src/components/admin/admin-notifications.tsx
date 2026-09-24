import { useState } from "react";
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
  Bell,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Notification {
  id: string;
  type: string;
  status: "UNREAD" | "READ" | "ARCHIVED";
  title: string;
  message: string;
  metadataJson: any;
  createdAt: string;
  readAt: string | null;
}

export default function AdminNotificationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | "confirm" | null>(null);

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/admin/notifications"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/admin/notifications");
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const approveMentorMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/admin/notifications/${notificationId}/approve-mentor`);
    },
    onSuccess: async () => {
      toast({ title: "Mentor credentials approved successfully" });
      setSelectedNotification(null);
      setActionType(null);
      // Wait a bit for backend to process the update
      await new Promise(resolve => setTimeout(resolve, 200));
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/mentors"] });
      // Manually refetch to ensure fresh data
      await refetch();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to approve mentor", variant: "destructive" });
    },
  });

  const rejectMentorMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/admin/notifications/${notificationId}/reject-mentor`);
    },
    onSuccess: async () => {
      toast({ title: "Mentor removed successfully" });
      setSelectedNotification(null);
      setActionType(null);
      setShowRejectDialog(false);
      // Wait a bit for backend to process the update
      await new Promise(resolve => setTimeout(resolve, 200));
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/mentors"] });
      // Manually refetch to ensure fresh data
      await refetch();
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to reject mentor", variant: "destructive" });
    },
  });

  const confirmAssessmentMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/admin/notifications/${notificationId}/confirm-assessment`);
    },
    onSuccess: async (data: any) => {
      toast({ title: "Redirecting to application details..." });
      await queryClient.refetchQueries({ queryKey: ["/api/admin/notifications"] });
      // Navigate to application details page
      if (data.applicationId) {
        setLocation(`/app/admin/applications/${data.applicationId}`);
      }
      setSelectedNotification(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to confirm assessment", variant: "destructive" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/admin/notifications/${notificationId}/read`);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/admin/notifications"] });
    },
  });

  const handleApproveMentor = (notification: Notification) => {
    setSelectedNotification(notification);
    setActionType("approve");
    approveMentorMutation.mutate(notification.id);
  };

  const handleRejectMentor = (notification: Notification) => {
    setSelectedNotification(notification);
    setActionType("reject");
    setShowRejectDialog(true);
  };

  const handleConfirmAssessment = (notification: Notification) => {
    setSelectedNotification(notification);
    setActionType("confirm");
    confirmAssessmentMutation.mutate(notification.id);
  };

  const handleRejectConfirm = () => {
    if (selectedNotification) {
      rejectMentorMutation.mutate(selectedNotification.id);
    }
  };

  const unreadCount = notifications.filter(n => n.status === "UNREAD").length;
  // Only show unread notifications in action sections so approved/rejected/confirmed items disappear from the list
  // Also filter out approved mentors as a safety measure (backend archives them, but this provides extra protection)
  const mentorNotifications = notifications.filter(
    n => n.type === "MENTOR_CREATED" && n.status === "UNREAD" && !(n.metadataJson as any)?.isApproved
  );
  const assessmentNotifications = notifications.filter(n => n.type === "ASSESSMENT_REVIEWED" && n.status === "UNREAD");
  const teamApplicationNotifications = notifications.filter(n => n.type === "TEAM_MEMBER_APPLICATION_RECEIVED" && n.status === "UNREAD");

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "MENTOR_CREATED":
        return <UserPlus className="h-5 w-5" />;
      case "ASSESSMENT_REVIEWED":
        return <CheckCircle2 className="h-5 w-5" />;
      case "CREDENTIALS_APPROVED":
        return <CheckCircle2 className="h-5 w-5" />;
      case "TEAM_MEMBER_APPLICATION_RECEIVED":
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "MENTOR_CREATED":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "ASSESSMENT_REVIEWED":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "CREDENTIALS_APPROVED":
        return "bg-destructive/10 dark:bg-destructive/20 text-destructive";
      case "TEAM_MEMBER_APPLICATION_RECEIVED":
        return "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300";
      default:
        return "bg-muted dark:bg-muted/50 text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <Card className="relative overflow-hidden bg-white border border-border shadow-lg rounded-xl hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
          <div>
              <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
              <p className="text-muted-foreground mt-1">
              {notifications.length} total notification{notifications.length !== 1 ? "s" : ""}
              {unreadCount > 0 && (
                <span className="ml-2">
                    • <span className="text-foreground font-medium">{unreadCount} unread</span>
                </span>
              )}
            </p>
          </div>
          </CardHeader>
        </Card>

        {/* Mentor Notifications */}
        {mentorNotifications.length > 0 && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border  shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <UserPlus className="h-5 w-5 text-foreground" />
                Mentor Approval Requests ({mentorNotifications.length})
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Review and approve or reject mentor credential sharing requests
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {mentorNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-2 rounded-lg ${
                      notification.status === "UNREAD" ? "bg-gradient-to-br from-muted to-card border-primary/30" : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                            <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                              {notification.status === "UNREAD" && (
                                <Badge variant="default" className="text-xs bg-primary text-primary-foreground">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 mt-1">
                              {notification.message}
                            </p>
                            {notification.metadataJson?.mentorName && (
                              <p className="text-xs text-slate-600 mt-1">
                                Mentor: {notification.metadataJson.mentorName} ({notification.metadataJson.mentorEmail})
                              </p>
                            )}
                            <p className="text-xs text-slate-600 mt-2">
                              {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => {
                            markAsReadMutation.mutate(notification.id);
                            handleApproveMentor(notification);
                          }}
                          disabled={approveMentorMutation.isPending && selectedNotification?.id === notification.id}
                        >
                          {approveMentorMutation.isPending && selectedNotification?.id === notification.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-primary text-primary hover:bg-accent"
                          onClick={() => {
                            markAsReadMutation.mutate(notification.id);
                            handleRejectMentor(notification);
                          }}
                          disabled={rejectMentorMutation.isPending && selectedNotification?.id === notification.id}
                        >
                          {rejectMentorMutation.isPending && selectedNotification?.id === notification.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment Notifications */}
        {assessmentNotifications.length > 0 && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border  shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-5 w-5 text-foreground" />
                Assessment Reviews ({assessmentNotifications.length})
              </CardTitle>
              <CardDescription className="text-slate-700">
                Review assessment results and view application details
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {assessmentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-2 rounded-lg ${
                      notification.status === "UNREAD" ? "bg-gradient-to-br from-muted to-card border-primary/30" : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                            <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                              {notification.status === "UNREAD" && (
                                <Badge variant="default" className="text-xs bg-primary text-primary-foreground">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 mt-1">
                              {notification.message}
                            </p>
                            {notification.metadataJson && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs text-slate-600">
                                  Candidate: {notification.metadataJson.candidateName || "Unknown"}
                                </p>
                                <p className="text-xs text-slate-600">
                                  Score: {notification.metadataJson.score || 0}/{notification.metadataJson.maxScore || 0}
                                  {" "}
                                  {notification.metadataJson.passed ? (
                                    <Badge variant="default" className="ml-2 bg-primary text-primary-foreground">PASSED</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="ml-2">FAILED</Badge>
                                  )}
                                </p>
                              </div>
                            )}
                            <p className="text-xs text-slate-600 mt-2">
                              {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => {
                            markAsReadMutation.mutate(notification.id);
                            handleConfirmAssessment(notification);
                          }}
                          disabled={confirmAssessmentMutation.isPending}
                        >
                          {confirmAssessmentMutation.isPending && confirmAssessmentMutation.variables === notification.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4 mr-2" />
                          )}
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Application Notifications */}
        {teamApplicationNotifications.length > 0 && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border  shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertCircle className="h-5 w-5 text-foreground" />
                Team Applications ({teamApplicationNotifications.length})
              </CardTitle>
              <CardDescription className="text-slate-700">
                New TEAM applications submitted by founders
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {teamApplicationNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-2 rounded-lg ${
                      notification.status === "UNREAD"
                        ? "bg-gradient-to-br from-muted to-card border-primary/30"
                        : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                              {notification.status === "UNREAD" && (
                                <Badge variant="default" className="text-xs bg-primary text-primary-foreground">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 mt-1">{notification.message}</p>
                            {notification.metadataJson?.teamName && (
                              <p className="text-xs text-slate-600 mt-1">Team: {notification.metadataJson.teamName}</p>
                            )}
                            {notification.metadataJson?.leaderEmail && (
                              <p className="text-xs text-slate-600 mt-1">Leader: {notification.metadataJson.leaderEmail}</p>
                            )}
                            <p className="text-xs text-slate-600 mt-2">
                              {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => {
                            markAsReadMutation.mutate(notification.id);
                            const applicationId = notification.metadataJson?.applicationId;
                            if (!applicationId) {
                              toast({ title: "Missing application id", variant: "destructive" });
                              return;
                            }
                            setLocation(`/app/admin/applications/${applicationId}`);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>

                        {notification.status === "UNREAD" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-primary text-primary hover:bg-accent"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                          >
                            Mark as Read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Other Notifications */}
        {notifications.filter(n => n.type !== "MENTOR_CREATED" && n.type !== "ASSESSMENT_REVIEWED" && n.type !== "TEAM_MEMBER_APPLICATION_RECEIVED").length > 0 && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border  shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Bell className="h-5 w-5 text-foreground" />
                Other Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4">
                {notifications
                  .filter(n => n.type !== "MENTOR_CREATED" && n.type !== "ASSESSMENT_REVIEWED" && n.type !== "TEAM_MEMBER_APPLICATION_RECEIVED")
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-2 rounded-lg ${
                        notification.status === "UNREAD" ? "bg-gradient-to-br from-muted to-card border-primary/30" : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`p-2 rounded-lg ${getNotificationColor(notification.type)}`}>
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                                {notification.status === "UNREAD" && (
                                  <Badge variant="default" className="text-xs bg-primary text-primary-foreground">New</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-700 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-slate-600 mt-2">
                                {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            </div>
                          </div>
                        </div>
                        {notification.status === "UNREAD" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-primary text-primary hover:bg-accent"
                            onClick={() => markAsReadMutation.mutate(notification.id)}
                          >
                            Mark as Read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {notifications.length === 0 && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border  shadow-xl rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardContent className="py-12 text-center relative">
              <Bell className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-700">No notifications yet</p>
            </CardContent>
          </Card>
        )}

        {/* Reject Confirmation Dialog */}
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Mentor?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reject and remove this mentor? This action cannot be undone.
                The mentor profile and user account will be permanently deleted from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRejectConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={rejectMentorMutation.isPending}
              >
                {rejectMentorMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Remove Mentor
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

