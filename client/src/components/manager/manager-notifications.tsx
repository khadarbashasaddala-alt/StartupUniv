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
  Mail,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Notification {
  id: string;
  type: "MENTOR_CREATED" | "CANDIDATE_SELECTED" | "CREDENTIALS_APPROVED" | "ASSESSMENT_REVIEWED";
  status: "UNREAD" | "READ" | "ARCHIVED";
  title: string;
  message: string;
  metadataJson: any;
  createdAt: string;
  readAt: string | null;
}

export default function ManagerNotificationsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [storedPassword, setStoredPassword] = useState<string>("");
  const [storedEmail, setStoredEmail] = useState<string>("");
  const [selectedMentorId, setSelectedMentorId] = useState<string>("");
  const [filterType, setFilterType] = useState<"all" | "new" | "under-approval" | "approved" | "shared">("all");

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/manager/notifications"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/manager/notifications");
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const shareCredentialsMutation = useMutation({
    mutationFn: async ({ profileId, password }: { profileId: string; password: string }) => {
      // Send the password that was displayed in the dialog
      return apiRequest("POST", `/manager/mentors/${profileId}/share-credentials`, { password });
    },
    onSuccess: () => {
      toast({ title: "Credentials shared successfully via email" });
      setShowCredentialsDialog(false);
      setSelectedNotification(null);
      setStoredPassword("");
      setStoredEmail("");
      setSelectedMentorId("");
      queryClient.invalidateQueries({ queryKey: ["/api/manager/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/mentors"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to share credentials", variant: "destructive" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/manager/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/notifications"] });
    },
  });

  const handleShareCredentials = async (notification: Notification) => {
    const metadata = notification.metadataJson as any;
    const mentorProfileId = metadata?.mentorProfileId;
    let email = metadata?.mentorEmail;

    if (!mentorProfileId) {
      toast({ 
        title: "Mentor profile not found in notification.", 
        variant: "destructive" 
      });
      return;
    }

    // Fetch mentor profile to get user email if not in notification
    if (!email) {
      try {
        const mentorData = await apiRequest("GET", `/manager/mentors`);
        const mentor = Array.isArray(mentorData) 
          ? mentorData.find((m: any) => m.id === mentorProfileId)
          : null;
        if (mentor?.user?.email) {
          email = mentor.user.email;
        }
      } catch (error) {
        console.error("Error fetching mentor data:", error);
      }
    }

    // Generate password preview to show in dialog
    let password = "";
    try {
      const passwordData = await apiRequest("GET", `/manager/mentors/${mentorProfileId}/password-preview`);
      password = passwordData.password;
    } catch (error: any) {
      toast({ 
        title: error.message || "Failed to generate password preview", 
        variant: "destructive" 
      });
      return;
    }

    setSelectedMentorId(mentorProfileId);
    setStoredPassword(password);
    setStoredEmail(email || "N/A");
    setShowCredentialsDialog(true);
  };

  const handleConfirmShare = () => {
    if (!selectedMentorId || !storedPassword) {
      toast({ title: "Password not available", variant: "destructive" });
      return;
    }
    // Send the password that was displayed in the dialog
    shareCredentialsMutation.mutate({
      profileId: selectedMentorId,
      password: storedPassword,
    });
  };

  const unreadCount = notifications.filter(n => n.status === "UNREAD").length;
  
  // Organize notifications by status and type
  const newNotifications = notifications.filter(n => n.status === "UNREAD");
  const approvedNotifications = notifications.filter(n => n.status === "READ" && n.type === "CREDENTIALS_APPROVED");
  const underApprovalNotifications = notifications.filter(n => n.status === "UNREAD" && n.type === "MENTOR_CREATED");
  const sharedNotifications = notifications.filter(n => {
    const metadata = n.metadataJson as any;
    return n.status === "READ" && n.type === "CREDENTIALS_APPROVED" && metadata?.shared === true;
  });

  // Filter notifications based on selected filter
  const getFilteredNotifications = () => {
    switch (filterType) {
      case "new":
        return newNotifications;
      case "under-approval":
        return underApprovalNotifications;
      case "approved":
        return approvedNotifications;
      case "shared":
        return sharedNotifications;
      default:
        return notifications;
    }
  };

  const filteredNotifications = getFilteredNotifications();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "MENTOR_CREATED":
        return <UserPlus className="h-5 w-5" />;
      case "CREDENTIALS_APPROVED":
        return <CheckCircle2 className="h-5 w-5" />;
      case "ASSESSMENT_REVIEWED":
        return <CheckCircle2 className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "MENTOR_CREATED":
        return "bg-blue-100/50 text-blue-700 border border-blue-300/50";
      case "CREDENTIALS_APPROVED":
        return "bg-green-100/50 text-green-700 border border-green-300/50";
      case "ASSESSMENT_REVIEWED":
        return "bg-purple-100/50 text-purple-700 border border-purple-300/50";
      default:
        return "bg-muted/50 text-muted-foreground border border-border";
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground mt-1">
              {notifications.length} total notification{notifications.length !== 1 ? "s" : ""}
              {unreadCount > 0 && (
                <span className="ml-2">
                  • <span className="text-white font-medium">{unreadCount} unread</span>
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
            className={filterType === "all" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filterType === "new" ? "default" : "outline"}
            onClick={() => setFilterType("new")}
            className={filterType === "new" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            New Applications ({newNotifications.length})
          </Button>
          <Button
            variant={filterType === "under-approval" ? "default" : "outline"}
            onClick={() => setFilterType("under-approval")}
            className={filterType === "under-approval" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            Under Approval ({underApprovalNotifications.length})
          </Button>
          <Button
            variant={filterType === "approved" ? "default" : "outline"}
            onClick={() => setFilterType("approved")}
            className={filterType === "approved" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            Approved ({approvedNotifications.length})
          </Button>
          <Button
            variant={filterType === "shared" ? "default" : "outline"}
            onClick={() => setFilterType("shared")}
            className={filterType === "shared" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            Shared ({sharedNotifications.length})
          </Button>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => {
              const metadata = notification.metadataJson as any;
              return (
                <div
                  key={notification.id}
                  className={`relative p-4 rounded-xl cursor-pointer transition-all backdrop-blur-sm shadow-lg ${
                    notification.status === "UNREAD" 
? "bg-card border border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                      : "bg-card border border-border hover:bg-primary/5"
                  }`}
                  onClick={() => {
                    if (notification.status === "UNREAD") {
                      markAsReadMutation.mutate(notification.id);
                    }
                  }}
                >
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2.5 rounded-xl ${getNotificationColor(notification.type)}`}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{notification.title}</h3>
                            {notification.status === "UNREAD" && (
                              <Badge variant="default" className="text-xs bg-primary text-primary-foreground">New</Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground mt-1">
                            {notification.message}
                          </p>
                          {(metadata?.mentorName || metadata?.mentorEmail) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Mentor: {metadata.mentorName || "N/A"}{metadata?.mentorEmail ? ` (${metadata.mentorEmail})` : ""}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {notification.type === "CREDENTIALS_APPROVED" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReadMutation.mutate(notification.id);
                            handleShareCredentials(notification);
                          }}
                          disabled={shareCredentialsMutation.isPending}
                        >
                          {shareCredentialsMutation.isPending && shareCredentialsMutation.variables?.profileId === metadata?.mentorProfileId ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Mail className="h-4 w-4 mr-2" />
                          )}
                          Share Credentials
                        </Button>
                      )}
                      {notification.status === "UNREAD" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReadMutation.mutate(notification.id);
                          }}
                        >
                          Mark as Read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="border border-border bg-card">
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications found for this filter</p>
            </CardContent>
          </Card>
        )}

        {notifications.length === 0 && (
          <div className="relative p-6 rounded-xl border border-border bg-card backdrop-blur-sm shadow-lg">
            <div className="text-center py-12 relative">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
            </div>
          </div>
        )}

        {/* Share Credentials Dialog */}
        <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Credentials</DialogTitle>
              <DialogDescription>
                Send credentials to the mentor via email
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Mentor Credentials:</p>
                <p className="text-sm"><strong>Email:</strong> {storedEmail || "N/A"}</p>
                <p className="text-sm mt-2"><strong>Password:</strong> {storedPassword || "Generating..."}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  These credentials will be sent to the mentor via email.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click the button below to send these credentials to the mentor via email.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCredentialsDialog(false);
                  setStoredPassword("");
                  setStoredEmail("");
                  setSelectedMentorId("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmShare}
                disabled={shareCredentialsMutation.isPending || !selectedMentorId || !storedPassword}
              >
                {shareCredentialsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Mail className="h-4 w-4 mr-2" />
                Send Credentials
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

