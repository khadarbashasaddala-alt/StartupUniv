import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TaskSubmissionBadge, type TaskSubmissionProgress } from "@/components/TaskSubmissionBadge";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Circle,
  ChevronRight,
  ListTodo,
  Loader2,
  Plus,
  Video,
  ExternalLink,
  Calendar,
  CheckCheck,
  XCircle,
  FileText,
  GitPullRequest,
  Rocket,
  Ticket,
  Upload,
  Trash2,
  Eye,
  Users,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string | null;
  objectives: string | null;
  deliverables: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "REVIEW";
  priority: "LOW" | "MEDIUM" | "HIGH";
  points: number;
  sprintId: string;
  createdAt: string;
  startDate: string | null;
  endDate: string | null;
  assigneeId: string | null;
  assigneeIds: string[] | null;
  assignedBy: string | null;
  reviewerId: string | null;
  reviewComment: string | null;
  /** Only present when the task has more than one assignee. */
  submissionProgress?: TaskSubmissionProgress | null;
};

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

export default function TasksPage() {
  const { user } = useAuth();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { startPageTourIfFirst(user?.role === "COFOUNDER" ? "cf-tasks" : user?.role === "MENTOR" ? "m-tasks" : "tasks"); }, [user?.role]);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/my-tasks"],
  });

  // Fetch cohort tasks for the current user
  const { data: cohortTasks = [], isLoading: cohortTasksLoading } = useQuery<CohortTask[]>({
    queryKey: ["/api/my-cohort-tasks"],
    queryFn: () => apiRequest("GET", "/api/my-cohort-tasks"),
  });

  // Get current sprint for the user's team (to determine if sprint exists)
  const { data: mySprint } = useQuery<{ sprint: { id: string } | null } | null>({
    queryKey: ["/api/my-sprint"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/my-sprint");
      } catch (err) {
        return null;
      }
    },
  });

  // Get my team details to populate assignee select
  const { data: myTeam } = useQuery<any>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try { return await apiRequest("GET", "/api/my-team"); } catch (e) { return null; }
    },
  });

  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);

  // View task dialog
  const [showViewTaskDialog, setShowViewTaskDialog] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  // Delete task dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ taskId: string; status: string } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [showTaskDetailsDialog, setShowTaskDetailsDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Evidence dialog state (shown when moving task to REVIEW)
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  const [pendingReviewTask, setPendingReviewTask] = useState<{ taskId: string } | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>("PR");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceAttachments, setEvidenceAttachments] = useState<Array<{ url: string; objectKey?: string; name?: string }>>([]);
  const [evidenceNotes, setEvidenceNotes] = useState("");
  // Evidence viewer for Details button
  const [showEvidenceViewer, setShowEvidenceViewer] = useState(false);
  const [viewerEvidence, setViewerEvidence] = useState<any[] | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerTaskId, setViewerTaskId] = useState<string | null>(null);

  const createSprintTaskMutation = useMutation({
    mutationFn: async (taskData: { title: string; description?: string; priority: string; assigneeIds?: string[] }) => {
      if (!mySprint || !mySprint.sprint || !mySprint.sprint.id) throw new Error("No active sprint");
      const res = await apiRequest("POST", `/api/sprints/${mySprint.sprint.id}/tasks`, taskData);
      return res;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      toast({ title: "Task created", description: "Task has been added to the sprint" });
      setShowCreateTaskDialog(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("MEDIUM");
      setTaskAssigneeIds([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      toast({ title: "Task deleted", description: "Task has been deleted" });
      setShowDeleteConfirm(false);
      setDeletingTaskId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status, reviewComment }: { taskId: string; status: string; reviewComment?: string }) => {
      const payload: any = { status };
      if (reviewComment) {
        payload.reviewComment = reviewComment;
      }
      return await apiRequest("PATCH", `/api/tasks/${taskId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({ title: "Task updated", description: "Task status has been changed" });
      setShowCommentDialog(false);
      setReviewComment("");
      setPendingStatusChange(null);
    },
    onError: (error: any) => {
      // A shared task that is still waiting on other assignees is not a
      // failure — the server says so with `informational: true`. Showing that
      // as a red Error made learners think their own submission was rejected.
      if (error?.body?.informational) {
        queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
        toast({
          title: "Waiting on your teammates",
          description: error.body.message || error.message,
        });
        setShowCommentDialog(false);
        setReviewComment("");
        setPendingStatusChange(null);
        return;
      }
      console.error("Update task error:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update task", 
        variant: "destructive" 
      });
    },
  });

  const createEvidenceMutation = useMutation({
    mutationFn: async (data: { taskId: string; type: string; title: string; url: string; metaJson?: Record<string, unknown> }) => {
      return await apiRequest("POST", `/api/tasks/${data.taskId}/evidence`, data);
    },
    onSuccess: () => {
      // Refresh so the "1 of 3 submitted" badge reflects this submission.
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
    },
    onError: () => {
      toast({ title: "Warning", description: "Task moved to review but evidence could not be saved", variant: "destructive" });
    },
  });

  const handleStatusChange = (task: Task, newStatus: string) => {
    const isAssignee = task.assigneeId === user?.id || Boolean(user?.id && task.assigneeIds?.includes(user.id));
    const isReviewer = task.reviewerId === user?.id;
    
    // If user is reviewer (not assignee), require comment
    if (isReviewer && !isAssignee && newStatus !== task.status) {
      setPendingStatusChange({ taskId: task.id, status: newStatus });
      setShowCommentDialog(true);
      return;
    }

    // If moving to REVIEW, show evidence dialog first
    if (newStatus === "REVIEW" && task.status !== "REVIEW") {
      setPendingReviewTask({ taskId: task.id });
      setEvidenceTitle(task.title);
      setShowEvidenceDialog(true);
      return;
    }
    
    // Otherwise, proceed with status change
    updateTaskMutation.mutate({ taskId: task.id, status: newStatus });
  };

  const resetEvidenceDialog = () => {
    setShowEvidenceDialog(false);
    setPendingReviewTask(null);
    setEvidenceType("PR");
    setEvidenceTitle("");
    setEvidenceUrl("");
    setEvidenceAttachments([]);
    setEvidenceNotes("");
  };

  const handleEvidenceSubmit = async () => {
    if (!pendingReviewTask) return;
    const taskId = pendingReviewTask.taskId;
    const hasEvidence = Boolean(evidenceTitle && evidenceUrl);
    const trimmedNotes = evidenceNotes.trim();
    const metaJson: Record<string, unknown> = {};
    if (evidenceAttachments.length > 0) metaJson.attachments = evidenceAttachments;
    if (trimmedNotes) metaJson.notes = trimmedNotes;
    const payload = {
      type: evidenceType,
      title: evidenceTitle,
      url: evidenceUrl,
      metaJson: Object.keys(metaJson).length > 0 ? metaJson : undefined,
      taskId,
    };
    resetEvidenceDialog();

    if (hasEvidence) {
      try {
        const result: any = await createEvidenceMutation.mutateAsync(payload);
        const progress: TaskSubmissionProgress | null = result?.progress ?? null;

        // On a shared task the server advances the status itself once the last
        // assignee submits, so there is no PATCH to send in either branch.
        if (progress && !progress.allSubmitted) {
          const remaining = progress.totalAssignees - progress.submittedCount;
          const names = progress.pendingAssignees.map((p) => p.name).join(", ");
          toast({
            title: "Evidence saved",
            description: `Your evidence is saved, ${remaining} still to go${names ? ` — waiting on ${names}` : ""}. The task moves to review automatically once everyone has submitted.`,
          });
          return;
        }
        if (result?.autoAdvanced) {
          toast({
            title: "Task moved to review",
            description: `All ${progress?.totalAssignees ?? ""} assignees have submitted — this task is now with the reviewer.`.replace("  ", " "),
          });
          return;
        }
      } catch {
        // createEvidenceMutation.onError already warned. Fall through so the
        // status change still happens — that was the user's actual intent.
      }
    }

    updateTaskMutation.mutate({ taskId, status: "REVIEW" });
  };

  const handleSkipEvidence = () => {
    if (!pendingReviewTask) return;
    // Just change status without evidence
    updateTaskMutation.mutate({ taskId: pendingReviewTask.taskId, status: "REVIEW" });
    resetEvidenceDialog();
  };

  const openEvidenceViewer = async (taskId: string) => {
    setViewerTaskId(taskId);
    setViewerLoading(true);
    try {
      const res = await apiRequest("GET", `/api/tasks/${taskId}/evidence`);
      setViewerEvidence(res || []);
    } catch (err) {
      console.error("Failed to fetch task evidence", err);
      toast({ title: "Error", description: "Failed to load evidence", variant: "destructive" });
      setViewerEvidence([]);
    } finally {
      setViewerLoading(false);
      setShowEvidenceViewer(true);
    }
  };

  const closeEvidenceViewer = () => {
    setShowEvidenceViewer(false);
    setViewerEvidence(null);
    setViewerTaskId(null);
  };

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetailsDialog(true);
  };

  const closeTaskDetails = () => {
    setShowTaskDetailsDialog(false);
    setSelectedTask(null);
  };

  const handleCommentSubmit = () => {
    if (!pendingStatusChange) return;
    if (!reviewComment.trim()) {
      toast({ 
        title: "Comment required", 
        description: "Please provide a comment when changing task status as a reviewer.", 
        variant: "destructive" 
      });
      return;
    }
    updateTaskMutation.mutate({ 
      taskId: pendingStatusChange.taskId, 
      status: pendingStatusChange.status,
      reviewComment: reviewComment.trim()
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "TODO":
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      case "IN_PROGRESS":
        return <Play className="h-4 w-4 text-primary" />;
      case "REVIEW":
        return <AlertCircle className="h-4 w-4 text-primary" />;
      case "DONE":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "TODO":
        return "outline";
      case "IN_PROGRESS":
        return "default";
      case "REVIEW":
        return "secondary";
      case "DONE":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "TODO":
        return "To Do";
      case "IN_PROGRESS":
        return "In Progress";
      case "REVIEW":
        return "In Review";
      case "DONE":
        return "Done";
      default:
        return status;
    }
  };

  const filteredTasks = tasks?.filter((task) => {
    if (activeTab === "all") return true;
    return task.status === activeTab;
  }) || [];

  const taskCounts = {
    all: tasks?.length || 0,
    TODO: tasks?.filter((t) => t.status === "TODO").length || 0,
    IN_PROGRESS: tasks?.filter((t) => t.status === "IN_PROGRESS").length || 0,
    REVIEW: tasks?.filter((t) => t.status === "REVIEW").length || 0,
    DONE: tasks?.filter((t) => t.status === "DONE").length || 0,
  };

  const completionRate = tasks && tasks.length > 0 
    ? Math.round((taskCounts.DONE / tasks.length) * 100) 
    : 0;

  return (
    <AppLayout title="My Tasks">
      <div className="space-y-6 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">My Tasks</h1>
            <p className="text-muted-foreground">
              Track and manage your assigned tasks
            </p>
          </div>
          <div className="flex items-center gap-4">
            <PageTourButton pageKey={user?.role === "COFOUNDER" ? "cf-tasks" : user?.role === "MENTOR" ? "m-tasks" : "tasks"} />
            <Badge variant="outline" className="text-lg px-3 py-1" data-tour="m-pg-tasks-count">
              <Target className="h-4 w-4 mr-2" />
              {taskCounts.all} Tasks
            </Badge>
            {mySprint && mySprint.sprint ? (
              (user?.role === "FOUNDER" || user?.role === "MENTOR" || user?.role === "ADMIN") ? (
                <Button onClick={() => setShowCreateTaskDialog(true)} data-tour="tasks-create-btn">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              ) : null
            ) : (
              <p className="text-sm text-muted-foreground">No active sprint for your team. Contact your founder to create one.</p>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4" data-tour="tasks-stat-cards">
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-todo" data-tour="m-pg-tasks-stat-todo">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">To Do</CardTitle>
              <Circle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{isLoading ? "-" : taskCounts.TODO}</div>
              <p className="text-xs text-muted-foreground">Pending tasks</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-in-progress" data-tour="m-pg-tasks-stat-inprogress">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">In Progress</CardTitle>
              <Play className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{isLoading ? "-" : taskCounts.IN_PROGRESS}</div>
              <p className="text-xs text-muted-foreground">Currently working</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-review" data-tour="m-pg-tasks-stat-review">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">In Review</CardTitle>
              <AlertCircle className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{isLoading ? "-" : taskCounts.REVIEW}</div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-done" data-tour="m-pg-tasks-stat-done">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{isLoading ? "-" : taskCounts.DONE}</div>
              <p className="text-xs text-muted-foreground">{completionRate}% completion</p>
            </CardContent>
          </Card>
        </div>

        {/* Cohort Tasks / Scheduled Meetings */}
        {cohortTasks.length > 0 && (
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl min-w-0">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Calendar className="h-5 w-5" />
                Scheduled Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {cohortTasksLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {cohortTasks.map((task) => {
                    const now = new Date();
                    const startTime = new Date(task.startTime);
                    const endTime = new Date(task.endTime);
                    const isUpcoming = startTime > now;
                    const isOngoing = startTime <= now && endTime >= now;
                    const isPast = endTime < now;

                    const formatDateTime = (dateStr: string) => {
                      const date = new Date(dateStr);
                      return date.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      });
                    };

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between gap-3 p-4 rounded-lg border-2 min-w-0 ${
                          isOngoing 
                            ? 'border-green-400 bg-green-50' 
                            : isUpcoming 
                              ? 'border-primary/40 bg-primary/5' 
                              : 'border-border bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0 overflow-hidden">
                          <div className="mt-1 shrink-0">
                            {isOngoing ? (
                              <div className="flex items-center gap-1">
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                              </div>
                            ) : isUpcoming ? (
                              <Clock className="h-4 w-4 text-blue-500" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h4 className="font-medium text-foreground truncate">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span className="min-w-0">{formatDateTime(task.startTime)} - {formatDateTime(task.endTime)}</span>
                              {isOngoing && (
                                <Badge className="bg-green-500 text-white">LIVE</Badge>
                              )}
                              {isUpcoming && (
                                <Badge variant="secondary">Upcoming</Badge>
                              )}
                              {isPast && (
                                <Badge variant="outline">Past</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {task.meetingLink && !isPast && (
                          <Button
                            size="sm"
                            className={`shrink-0 ${isOngoing ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90"}`}
                            onClick={() => window.open(task.meetingLink!, "_blank")}
                          >
                            <Video className="h-4 w-4 mr-1" />
                            Join
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tasks List */}
        <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl min-w-0">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground" data-tour="m-pg-tasks-list-title">
                  <ListTodo className="h-5 w-5" />
                  Task List
                </CardTitle>
              </div>
              <TabsList className="mt-4 bg-muted/50 border border-border" data-tour="tasks-filter-tabs">
                <TabsTrigger value="all" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-all">
                  All
                  <Badge variant="secondary" className="ml-1">{taskCounts.all}</Badge>
                </TabsTrigger>
                <TabsTrigger value="TODO" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-todo">
                  To Do
                  <Badge variant="secondary" className="ml-1">{taskCounts.TODO}</Badge>
                </TabsTrigger>
                <TabsTrigger value="IN_PROGRESS" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-in-progress">
                  In Progress
                  <Badge variant="secondary" className="ml-1">{taskCounts.IN_PROGRESS}</Badge>
                </TabsTrigger>
                <TabsTrigger value="REVIEW" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-review">
                  Review
                  <Badge variant="secondary" className="ml-1">{taskCounts.REVIEW}</Badge>
                </TabsTrigger>
                <TabsTrigger value="DONE" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" data-testid="tab-done">
                  Done
                  <Badge variant="secondary" className="ml-1">{taskCounts.DONE}</Badge>
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-6 relative min-w-0 overflow-hidden">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredTasks.length > 0 ? (
                <div className="space-y-3">
                  {filteredTasks.map((task, taskIdx) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 p-4 rounded-lg border border-border bg-card hover:shadow-md transition-shadow min-w-0"
                      data-testid={`task-row-${task.id}`}
                      data-tour={taskIdx === 0 ? "m-pg-tasks-row" : undefined}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0 overflow-hidden">
                        <div className="mt-1 shrink-0">
                          {getStatusIcon(task.status)}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h4 className="font-medium truncate text-foreground" data-testid={`task-title-${task.id}`}>
                            {task.title}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-words">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {task.points} {task.points === 1 ? "point" : "points"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(task.createdAt).toLocaleDateString()}
                            </span>
                            <TaskSubmissionBadge progress={task.submissionProgress} />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {task.reviewComment && (
                          <div className="text-xs text-muted-foreground max-w-[200px] truncate" title={task.reviewComment}>
                            💬 {task.reviewComment}
                          </div>
                        )}
                        {/* Changes were asked for and this is your task: give the way back an
                            actual button. The only route before was to know that picking
                            "In Review" from the status dropdown reopens the evidence dialog,
                            which is not something a learner should have to work out while
                            looking at a comment telling them to fix something. */}
                        {task.reviewComment &&
                          task.status === "IN_PROGRESS" &&
                          (task.assigneeId === user?.id ||
                            Boolean(user?.id && task.assigneeIds?.includes(user.id))) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0 gap-1 text-xs"
                              onClick={() => handleStatusChange(task, "REVIEW")}
                              data-testid={`button-resubmit-${task.id}`}
                            >
                              <Upload className="h-3 w-3" />
                              Resubmit
                            </Button>
                          )}
                        {/* Reviewer quick-action buttons for In Review tasks */}
                        {task.status === "REVIEW" && task.reviewerId === user?.id && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                              onClick={() => handleStatusChange(task, "DONE")}
                              disabled={updateTaskMutation.isPending}
                              title="Approve - mark task as Done"
                            >
                              <CheckCheck className="h-3 w-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => handleStatusChange(task, "IN_PROGRESS")}
                              disabled={updateTaskMutation.isPending}
                              title="Request Changes - send back to In Progress"
                            >
                              <XCircle className="h-3 w-3" /> Reject
                            </Button>
                          </div>
                        )}
                        {/* Start button: auto-sets TODO → IN_PROGRESS for mentors */}
                        {task.status === "TODO" && user?.role === "MENTOR" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10"
                            onClick={() => updateTaskMutation.mutate({ taskId: task.id, status: "IN_PROGRESS" })}
                            disabled={updateTaskMutation.isPending}
                            title="Start task"
                          >
                            <Play className="h-3 w-3" /> Start
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => { setViewingTask(task); setShowViewTaskDialog(true); }}
                          title="View task details"
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                        {/* Delete task — only mentor who created it */}
                        {user?.role === "MENTOR" && task.assignedBy === user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setDeletingTaskId(task.id); setShowDeleteConfirm(true); }}
                            title="Delete task"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEvidenceViewer(task.id)} title="View task evidence">
                          Evidence
                        </Button>
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleStatusChange(task, value)}
                          disabled={updateTaskMutation.isPending}
                        >
                          <SelectTrigger 
                            className="w-[140px]" 
                            data-testid={`select-status-${task.id}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODO">
                              <div className="flex items-center gap-2">
                                <Circle className="h-3 w-3" />
                                To Do
                              </div>
                            </SelectItem>
                            <SelectItem value="IN_PROGRESS">
                              <div className="flex items-center gap-2">
                                <Play className="h-3 w-3 text-primary" />
                                In Progress
                              </div>
                            </SelectItem>
                            <SelectItem value="REVIEW">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-3 w-3 text-primary" />
                                In Review
                              </div>
                            </SelectItem>
                            {/* Hide DONE option for assignees (not reviewers) */}
                            {/* Show DONE if: user is reviewer OR user is not the assignee OR task has no assignee OR task is already DONE (so current status is always visible) */}
                            {(task.reviewerId === user?.id || !(task.assigneeId === user?.id || Boolean(user?.id && task.assigneeIds?.includes(user.id))) || (!task.assigneeId && (!task.assigneeIds || task.assigneeIds.length === 0)) || task.status === "DONE") && (
                              <SelectItem value="DONE">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  Done
                                </div>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No tasks found</p>
                  <p className="text-sm mt-1">
                    {activeTab === "all" 
                      ? "You don't have any tasks assigned yet"
                      : `No tasks with status "${getStatusLabel(activeTab)}"`}
                  </p>
                </div>
              )}
            </CardContent>
          </Tabs>
        </Card>
      </div>
      {/* Create Sprint Task Dialog (opens when user clicks Create Task in header) */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>Create a new task for the active sprint</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} placeholder="Describe the task..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignees (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {taskAssigneeIds.length === 0
                          ? (myTeam ? "Select team members..." : "Loading...")
                          : taskAssigneeIds.length === 1
                            ? myTeam?.members?.find((m: any) => m.id === taskAssigneeIds[0])?.name ?? "1 selected"
                            : `${taskAssigneeIds.length} selected`}
                      </span>
                      <Users className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                    {!myTeam ? (
                      <div className="py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                      </div>
                    ) : (myTeam.members ?? []).length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">No team members found</div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {(myTeam.members ?? []).map((m: any) => (
                          <label key={m.id} className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted">
                            <Checkbox
                              checked={taskAssigneeIds.includes(m.id)}
                              onCheckedChange={(checked) =>
                                setTaskAssigneeIds((prev) => checked ? [...prev, m.id] : prev.filter((id) => id !== m.id))
                              }
                            />
                            <span className="text-sm">{m.name}</span>
                            <span className="text-xs text-muted-foreground">({m.role})</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {taskAssigneeIds.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="w-full mt-2 text-muted-foreground" onClick={() => setTaskAssigneeIds([])}>
                        Clear selection
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTaskDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createSprintTaskMutation.mutate({ title: taskTitle, description: taskDescription || undefined, priority: taskPriority, assigneeIds: taskAssigneeIds.length > 0 ? taskAssigneeIds : undefined })}
              disabled={!taskTitle || createSprintTaskMutation.isPending}
              className=""
            >
              {createSprintTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Evidence Dialog (shown when moving task to REVIEW) */}
      <Dialog open={showEvidenceDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEvidenceDialog(false);
          setPendingReviewTask(null);
          setEvidenceType("PR");
          setEvidenceTitle("");
          setEvidenceUrl("");
          setEvidenceAttachments([]);
          setEvidenceNotes("");
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Submit Evidence for Review
            </DialogTitle>
            <DialogDescription>
              Upload evidence of your work before moving this task to review. You can also skip this step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Evidence Type</Label>
              <Select value={evidenceType} onValueChange={setEvidenceType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PR">
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="h-4 w-4 text-purple-500" />
                      Pull Request
                    </div>
                  </SelectItem>
                  <SelectItem value="CI">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-green-500" />
                      CI Run
                    </div>
                  </SelectItem>
                  <SelectItem value="Ticket">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-orange-500" />
                      Ticket
                    </div>
                  </SelectItem>
                  <SelectItem value="Doc">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      Document
                    </div>
                  </SelectItem>
                  <SelectItem value="Demo">
                    <div className="flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-pink-500" />
                      Demo
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={evidenceTitle}
                onChange={(e) => setEvidenceTitle(e.target.value)}
                placeholder="e.g., Implemented user authentication"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
            <div>
              <Label>Attachment *</Label>
              <p className="text-sm text-muted-foreground mb-2">Upload images, videos or documents as proof (required)</p>
              <ObjectUploader
                acceptedTypes="image/*,video/*,application/pdf,.doc,.docx"
                onGetUploadParameters={async () => {
                  const resp = await apiRequest("POST", "/api/objects/upload", {} as any);
                  return { method: "PUT" as const, url: resp.uploadURL, objectKey: resp.objectKey };
                }}
                getViewUrlEndpoint="/api/objects/view-url"
                onComplete={(fileUrl, objectKey, fileName) => {
                  setEvidenceAttachments((s) => [...s, { url: fileUrl, objectKey, name: fileName }]);
                  if (!evidenceUrl) setEvidenceUrl(fileUrl);
                }}
              >
                <Button variant="outline" className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              </ObjectUploader>
              {evidenceAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {evidenceAttachments.map((a, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span className="truncate max-w-xs">{a.name || a.objectKey || a.url}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEvidenceAttachments((s) => s.filter((_, i) => i !== idx))}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Add any additional context or notes for the reviewer..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSkipEvidence}
              disabled={updateTaskMutation.isPending}
            >
              Skip & Move to Review
            </Button>
            <Button
              onClick={handleEvidenceSubmit}
              disabled={!evidenceTitle || !evidenceUrl || evidenceAttachments.length === 0 || updateTaskMutation.isPending || createEvidenceMutation.isPending}
            >
              {(updateTaskMutation.isPending || createEvidenceMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Submit Evidence & Move to Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Comment Dialog */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Review Comment</DialogTitle>
            <DialogDescription>
              Please provide a comment when changing the task status as a reviewer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comment *</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Enter your review comment..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCommentDialog(false);
                setReviewComment("");
                setPendingStatusChange(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommentSubmit}
              disabled={!reviewComment.trim() || updateTaskMutation.isPending}
            >
              {updateTaskMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showTaskDetailsDialog} onOpenChange={(open) => { if (!open) closeTaskDetails(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title || "Task details"}</DialogTitle>
            <DialogDescription>
              Full task information including title, description, and current status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-foreground">
                {selectedTask?.title || "-"}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <div className="min-h-28 rounded-md border bg-muted/30 px-4 py-3 text-sm text-foreground whitespace-pre-wrap break-words">
                {selectedTask?.description?.trim() || "No description provided for this task."}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <div>
                  {selectedTask && (
                    <Badge variant={getStatusBadgeVariant(selectedTask.status)}>
                      {getStatusLabel(selectedTask.status)}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <div className="text-sm text-foreground">
                  {selectedTask ? `${selectedTask.points} ${selectedTask.points === 1 ? "point" : "points"}` : "-"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Created</Label>
                <div className="text-sm text-foreground">
                  {selectedTask ? new Date(selectedTask.createdAt).toLocaleString() : "-"}
                </div>
              </div>
            </div>
            {selectedTask?.submissionProgress && (
              <div className="space-y-2">
                <Label>Shared task</Label>
                <TaskSubmissionBadge progress={selectedTask.submissionProgress} />
              </div>
            )}
            {selectedTask?.reviewComment && (
              <div className="space-y-2">
                <Label>Latest Review Comment</Label>
                <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-foreground whitespace-pre-wrap break-words">
                  {selectedTask.reviewComment}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTaskDetails}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Evidence Viewer Dialog (Details) */}
      <Dialog open={showEvidenceViewer} onOpenChange={(open) => { if (!open) closeEvidenceViewer(); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Evidence for Task</DialogTitle>
            <DialogDescription>
              Evidence submitted for this task. You can open links or view attachments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {viewerLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">Loading evidence...</p>
              </div>
            ) : !viewerEvidence || viewerEvidence.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No evidence found for this task.</div>
            ) : (
              <div className="space-y-3">
                {viewerEvidence.map((ev: any) => (
                  <div key={ev.id || ev.createdAt} className="border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium truncate max-w-lg">{ev.title || ev.type}</div>
                        <div className="text-xs text-muted-foreground">Submitted by {ev.submitterName || ev.submitterId} • {new Date(ev.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ev.url && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            // If it's an S3 URL, regenerate a fresh signed URL via the server
                            const firstAttachmentKey = ev.metaJson?.attachments?.[0]?.objectKey;
                            if (ev.url.includes('.amazonaws.com') && firstAttachmentKey) {
                              try {
                                const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: firstAttachmentKey });
                                window.open(resp.fileUrl, "_blank"); return;
                              } catch {}
                            }
                            window.open(ev.url, "_blank");
                          }}>Open Link</Button>
                        )}
                        {ev.metaJson && ev.metaJson.attachments && ev.metaJson.attachments.length > 0 && (
                          <Button size="sm" variant="ghost" onClick={async () => {
                            const a = ev.metaJson.attachments[0];
                            if (a?.objectKey) {
                              try {
                                const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: a.objectKey });
                                window.open(resp.fileUrl, "_blank"); return;
                              } catch {}
                            }
                            if (a?.url) window.open(a.url, "_blank");
                          }}>Open Attachment</Button>
                        )}
                      </div>
                    </div>
                    {ev.metaJson && ev.metaJson.attachments && ev.metaJson.attachments.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {ev.metaJson.attachments.map((a: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <a href="#" onClick={async (e) => {
                              e.preventDefault();
                              if (a.objectKey) {
                                try {
                                  const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: a.objectKey });
                                  window.open(resp.fileUrl, "_blank"); return;
                                } catch {}
                              }
                              if (a.url) window.open(a.url, "_blank");
                            }} className="text-sm text-primary underline">{a.name || a.objectKey || a.url}</a>
                          </div>
                        ))}
                      </div>
                    )}
                    {Boolean(ev.metaJson?.notes) && (
                      <p className="text-muted-foreground mt-2 text-sm whitespace-pre-wrap">{ev.metaJson.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEvidenceViewer}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Task Dialog */}
      <Dialog open={showViewTaskDialog} onOpenChange={setShowViewTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Task Details
            </DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Title</p>
                <p className="font-semibold">{viewingTask.title}</p>
              </div>
              {viewingTask.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Description</p>
                  <p className="whitespace-pre-wrap">{viewingTask.description}</p>
                </div>
              )}
              {/* Objectives hidden on request, matching the sprint board.
              {viewingTask.objectives && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Objectives</p>
                  <p className="whitespace-pre-wrap">{viewingTask.objectives}</p>
                </div>
              )}
              */}
              {viewingTask.deliverables && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Deliverables</p>
                  <p className="whitespace-pre-wrap">{viewingTask.deliverables}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Status</p>
                  <Badge variant="outline">{getStatusLabel(viewingTask.status)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Priority</p>
                  <Badge variant="secondary">{viewingTask.priority}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {viewingTask.startDate && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Start Date</p>
                    <p>{new Date(viewingTask.startDate).toLocaleDateString()}</p>
                  </div>
                )}
                {viewingTask.endDate && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">End Date</p>
                    <p>{new Date(viewingTask.endDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Points</p>
                <p>{viewingTask.points}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewTaskDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog — mentor-only */}
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open) { setShowDeleteConfirm(false); setDeletingTaskId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Task
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirm(false); setDeletingTaskId(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingTaskId && deleteTaskMutation.mutate(deletingTaskId)}
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
