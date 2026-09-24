import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import {
  Bell,
  CheckCircle2,
  Loader2,
  ListTodo,
  Rocket,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { PageTourButton } from "@/components/tour/PageTourButton";

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

export default function NotificationsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [filterType, setFilterType] = useState<"all" | "unread" | "read">("all");

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/notifications");
      return data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "TEAM_MEMBER_APPLICATION_RECEIVED":
        return <UserPlus className="h-5 w-5" />;
      case "TASK_CREATED":
        return <ListTodo className="h-5 w-5" />;
      case "SPRINT_CREATED":
        return <Rocket className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "TEAM_MEMBER_APPLICATION_RECEIVED":
        return "bg-primary/15 text-primary";
      case "TASK_CREATED":
        return "bg-primary/15 text-primary";
      case "SPRINT_CREATED":
        return "bg-primary/15 text-primary";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Just mark as read when clicked, don't navigate
    if (notification.status === "UNREAD") {
      markAsReadMutation.mutate(notification.id);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === "unread") return n.status === "UNREAD";
    if (filterType === "read") return n.status === "READ";
    return true;
  });

  const unreadCount = notifications.filter((n) => n.status === "UNREAD").length;

  return (
    <AppLayout title="Notifications">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-tour="notifications-heading">Notifications</h1>
            <p className="text-muted-foreground mt-2">
              Stay updated with your team activities and tasks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PageTourButton pageKey="notifications" />
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Mark all as read
              </Button>
            )}
            {unreadCount > 0 && (
              <Badge variant="default" className="bg-primary text-primary-foreground text-lg px-4 py-2">
                {unreadCount} Unread
              </Badge>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2" data-tour="notifications-filters">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
            className={filterType === "all" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filterType === "unread" ? "default" : "outline"}
            onClick={() => setFilterType("unread")}
            className={filterType === "unread" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
          >
            Unread ({unreadCount})
          </Button>
          <Button
            variant={filterType === "read" ? "default" : "outline"}
            onClick={() => setFilterType("read")}
            className={filterType === "read" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}
          >
            Read ({notifications.length - unreadCount})
          </Button>
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <Card className="border-border bg-card">
            <CardContent className="pt-6 text-center py-12">
              <Bell className="h-16 w-16 mx-auto text-muted-foreground opacity-50 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">No Notifications</h3>
              <p className="text-muted-foreground">
                {filterType === "unread"
                  ? "You're all caught up! No unread notifications."
                  : "You don't have any notifications yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-tour="notifications-list">
            {filteredNotifications.map((notification) => {
              const metadata = notification.metadataJson || {};
              const isProblemStatementNotification = notification.type === "PROBLEM_STATEMENT_APPLICATION_RECEIVED" || 
                                                       notification.type === "PROBLEM_STATEMENT_SUBMITTED" ||
                                                       notification.type === "PROBLEM_STATEMENT_PUBLISHED" ||
                                                       (metadata.problemStatementId);
              
              return (
                <div
                  key={notification.id}
                  className={`relative p-4 rounded-xl cursor-pointer transition-all border shadow-sm ${
                    notification.status === "UNREAD" 
                      ? "bg-card border-primary/30 hover:bg-muted/50 hover:border-primary/50" 
                      : "bg-card border-border hover:bg-muted/50"
                  }`}
                  onClick={() => handleNotificationClick(notification)}
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
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {notification.status === "UNREAD" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsReadMutation.mutate(notification.id);
                          }}
                          disabled={markAsReadMutation.isPending}
                        >
                          {markAsReadMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span className="ml-1">Mark as Read</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  {isProblemStatementNotification && metadata.problemStatementId && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-primary text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (notification.status === "UNREAD") {
                            markAsReadMutation.mutate(notification.id);
                          }
                          setLocation(`/app/open-challenges?view=${metadata.problemStatementId}`);
                        }}
                      >
                        View
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

