                                                                                                                                                                                                                                                                                                                       import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { taskTitleError } from "@shared/programmePlan";
import { ProgrammePlanImport } from "./programme-plan-import";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { TaskSubmissionBadge, type TaskSubmissionProgress } from "@/components/TaskSubmissionBadge";
import { CloseSprintDialog } from "@/components/CloseSprintDialog";
import {
  isTaskOverdue,
  sprintPhase,
  sprintTimingLabel,
  SPRINT_PHASE_LABELS,
} from "@shared/sprintPhase";
import { SprintExportDialog } from "@/components/common-pages/sprint-export-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TeamMemberMultiSelect } from "@/components/TeamMemberMultiSelect";
import { buildRoster, resolveAssignees } from "@shared/taskAssignees";
import { TeamMemberList } from "@/components/TeamMemberList";
import {
  CreateSprintDialog,
  emptySprintValues,
  type CreateSprintValues,
  type PendingSprintResource,
} from "@/components/CreateSprintDialog";
import {
  CheckCircle2,
  Clock,
  Code2,
  FileSpreadsheet,
  FileText,
  GitBranch,
  GitPullRequest,
  LayoutGrid,
  MessageSquare,
  Play,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  Rocket,
  Target,
  Upload,
  ExternalLink,
  AlertCircle,
  CheckCheck,
  Calendar,
  User2,
  Loader2,
  FileVideo,
  Link2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Users,
  History,
  Ticket,
  Eye,
  FileArchive,
  Paperclip,
  Download,
  File,
  X,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ObjectUploader } from "@/components/ObjectUploader";

type Task = {
  id: string;
  title: string;
  description: string | null;
  objectives?: string | null;
  deliverables?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dependencies?: string[];
  status: "TODO" | "IN_PROGRESS" | "DONE" | "REVIEW";
  priority: "LOW" | "MEDIUM" | "HIGH";
  assigneeId: string | null;
  assigneeIds?: string[] | null;
  assignedBy?: string | null;
  assigneeName?: string;
  points?: number;
  reviewerId?: string | null;
  reviewComment?: string | null;
  /** Only present when the task has more than one assignee. */
  submissionProgress?: TaskSubmissionProgress | null;
};

type Sprint = {
  id: string;
  index: number;
  title: string;
  goals?: string | null;
  objectives?: string | null;
  deliverables?: string | null;
  // No `status` field: it is derived from the dates by sprintPhase in
  // @shared/sprintPhase, so storing or recomputing it here is how the two vocabularies
  // ("TIME_OVER" here, "REVIEW" on the server) drifted apart in the first place.
  startDate: string;
  endDate: string;
  passed: boolean;
  passedAt: string | null;
  demoUrl: string | null;
  demoNotes: string | null;
};

type DailyStandup = {
  id: string;
  authorId: string;
  authorName?: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  createdAt: string;
};

type Evidence = {
  id: string;
  type: "PR" | "CI" | "Ticket" | "Doc" | "Demo";
  title: string;
  url: string | null;
  metaJson: Record<string, unknown> | null;
  createdAt: string;
  submittedBy?: string | null;
  submitterName?: string | null;
};

type SprintResourceItem = {
  id: string;
  sprintId: string;
  type: "file" | "link";
  fileName: string;
  objectKey: string | null;
  url: string | null;
  contentType: string | null;
  fileSize: number | null;
  uploadedById: string;
  uploaderName?: string | null;
  createdAt: string;
};

export default function SprintBoard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("board");
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showSprintDialog, setShowSprintDialog] = useState(false);
  const [showEditSprintDialog, setShowEditSprintDialog] = useState(false);
  // Read-only "complete sprint" view. Open to every team member, unlike Edit.
  const [showSprintDetailsDialog, setShowSprintDetailsDialog] = useState(false);
  const [detailsSprintId, setDetailsSprintId] = useState<string | null>(null);
  // Sprint report + export. Restricted to the roles that co-own or oversee the
  // team's work, since the archive bundles every member's output and leaves the
  // platform. The API applies the same list plus a team-scoping check.
  const [showSprintExportDialog, setShowSprintExportDialog] = useState(false);
  const [exportSprintId, setExportSprintId] = useState<string | null>(null);
  const canExportSprint =
    user?.role === "FOUNDER" ||
    user?.role === "COFOUNDER" ||
    user?.role === "MENTOR" ||
    user?.role === "ADMIN";
  const [editSprintIndex, setEditSprintIndex] = useState<number>(1);
  const [editSprintName, setEditSprintName] = useState("");
  const [editSprintGoals, setEditSprintGoals] = useState("");
  const [editSprintObjectives, setEditSprintObjectives] = useState("");
  const [editSprintDeliverables, setEditSprintDeliverables] = useState("");
  const [editSprintStartDate, setEditSprintStartDate] = useState("");
  const [editSprintEndDate, setEditSprintEndDate] = useState("");
  const [showDeleteSprintConfirm, setShowDeleteSprintConfirm] = useState(false);
  const [showStandupDialog, setShowStandupDialog] = useState(false);
  const [showDemoDialog, setShowDemoDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskObjectives, setTaskObjectives] = useState("");
  const [taskDeliverables, setTaskDeliverables] = useState("");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");
  const [taskDependencies, setTaskDependencies] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [standupYesterday, setStandupYesterday] = useState("");
  const [standupToday, setStandupToday] = useState("");
  const [standupBlockers, setStandupBlockers] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [demoNotes, setDemoNotes] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("");
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);
  // One object rather than a state per field: the create form is rendered from two places and
  // reset in a third, and keeping them in step by hand is what let the two copies drift.
  const [sprintForm, setSprintForm] = useState<CreateSprintValues>(emptySprintValues);
  const [sprintResourcesForm, setSprintResourcesForm] = useState<PendingSprintResource[]>([]);
  const [showAddResourceLinkDialog, setShowAddResourceLinkDialog] = useState(false);
  const [resourceLinkTitle, setResourceLinkTitle] = useState("");
  const [resourceLinkUrl, setResourceLinkUrl] = useState("");
  const [showDemoUploadMode, setShowDemoUploadMode] = useState<"url" | "file">("url");
  const [canEdit, setCanEdit] = useState<boolean | null>(null);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ taskId: string; status: string } | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [showViewTaskDialog, setShowViewTaskDialog] = useState(false);
  // What was clicked. Read through the derived `viewingTask` below, never directly, so the
  // dialog cannot render a task as it was at the moment it was opened.
  const [viewingTaskSnapshot, setViewingTask] = useState<Task | null>(null);
  const [showCloseSprint, setShowCloseSprint] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Edit task dialog
  const [showEditTaskDialog, setShowEditTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showPlanImport, setShowPlanImport] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  // Same rule the server enforces, imported rather than restated so the two cannot drift.
  const editTitleError = taskTitleError(editTitle);
  const newTaskTitleError = taskTitleError(taskTitle);
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [editObjectives, setEditObjectives] = useState("");
  const [editDeliverables, setEditDeliverables] = useState("");
  // Assignees in the edit dialog, so a task created unassigned can be assigned
  // later by an admin or mentor.
  // Dedicated Assign dialog, so admins and mentors can assign straight from the
  // task card instead of opening the full Edit form.
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assigningTask, setAssigningTask] = useState<Task | null>(null);
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [assignStartDate, setAssignStartDate] = useState("");
  const [assignEndDate, setAssignEndDate] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  // Delete task confirm dialog
  const [showDeleteConfirmBoard, setShowDeleteConfirmBoard] = useState(false);
  const [deletingTaskIdBoard, setDeletingTaskIdBoard] = useState<string | null>(null);

  // Evidence dialog state (shown when moving task to REVIEW)
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  const [pendingReviewTask, setPendingReviewTask] = useState<{ taskId: string } | null>(null);
  const [evidenceType, setEvidenceType] = useState<string>("PR");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceAttachments, setEvidenceAttachments] = useState<Array<{ url: string; objectKey?: string; name?: string }>>([]);
  const [evidenceNotes, setEvidenceNotes] = useState("");

  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoadingTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  const { data: teamData, isLoading: teamLoading, isError: teamError } = useQuery<{
    id?: string;
    name?: string;
    healthStatus?: string;
    track?: string;
    problemStatementId?: string | null;
    userRole?: string;
    userBand?: string | null;
    members?: Array<{ id: string; name: string; role: string; band: string | null; userRole?: string }>;
    // Legacy format support
    team?: { id: string; name: string; health: string };
    problemStatement?: { title: string; track: string } | null;
    myRole?: { role: string; stipendBand: string | null } | null;
  } | null>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", "/api/my-team");
        return data;
      } catch (error: any) {
        console.error("Error fetching team data:", error);
        return null;
      }
    },
  });

  // Get all teams for dropdown (for admins)
  const { data: allTeams } = useQuery<Array<{
    id: string;
    name: string;
    cohortId: string;
  }>>({
    queryKey: ["/api/teams"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/teams");
    },
    enabled: !!user && (user.role === "ADMIN"),
  });

  // Get mentor's assigned teams (mentors can be assigned to multiple teams)
  const { data: mentorTeams } = useQuery<Array<{
    id: string;
    name: string;
    track: string;
    healthStatus: string;
    memberCount: number;
    currentSprint: number;
    problemStatementId: string | null;
  }>>({
    queryKey: ["/api/mentor/teams"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/mentor/teams");
    },
    enabled: !!user && user.role === "MENTOR",
  });

  // Get team ID from user's team
  const userTeamId = teamData?.team?.id || teamData?.id;
  
  // Team selection state for admins and mentors
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Auto-select first mentor team when data loads
  useEffect(() => {
    if (user?.role === "MENTOR" && mentorTeams && mentorTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(mentorTeams[0].id);
    }
  }, [user?.role, mentorTeams, selectedTeamId]);
  
  // Use selected team for admins/mentors, otherwise use user's team
  const effectiveTeamId = ((user?.role === "ADMIN" || user?.role === "MENTOR") && selectedTeamId) ? selectedTeamId : userTeamId;
  const teamId = effectiveTeamId;

  // Team selector items: admins see all teams, mentors see their assigned teams
  const teamSelectorItems = useMemo(() => {
    if (user?.role === "ADMIN" && allTeams) return allTeams.map(t => ({ id: t.id, name: t.name }));
    if (user?.role === "MENTOR" && mentorTeams) return mentorTeams.map(t => ({ id: t.id, name: t.name }));
    return null;
  }, [user?.role, allTeams, mentorTeams]);

  // Anyone on the team can page through its sprints — a learner could previously see only the
  // one phase the programme was on, with no way to look back at a closed phase or ahead at the
  // next. Six phases seen one at a time, each disappearing when it closed. The write actions
  // are gated separately, so widening this changes only what is readable.
  const canBrowseSprints = !!teamId;

  // All sprints for team (founders and admins) - enables multiple sprints
  const { data: allSprints = [], isLoading: allSprintsLoading } = useQuery<Sprint[]>({
    queryKey: ["/api/teams", teamId, "sprints"],
    queryFn: async () => {
      if (!teamId) return [];
      const list = await apiRequest("GET", `/api/teams/${teamId}/sprints`);
      return Array.isArray(list) ? list : [];
    },
    enabled: !!teamId,
  });

  /**
   * Default to the phase the programme is actually on: the first sprint not closed, falling
   * back to the last once they all are.
   *
   * This is the same rule /api/my-sprint uses, which matters twice over. It is what a learner
   * saw before they had a selector, so opening this path to them changes nothing about where
   * they land. And it previously skipped any sprint past its end date — so an overdue Sprint 1
   * was never selected, which meant the overdue banner and the Close sprint button could not
   * appear for the one sprint that needed closing.
   */
  useEffect(() => {
    if (allSprints.length > 0 && !selectedSprintId) {
      const current = allSprints.find((s: Sprint) => !s.passed) ?? allSprints[allSprints.length - 1];
      if (current?.id) setSelectedSprintId(current.id);
    }
  }, [allSprints, selectedSprintId]);

  // Single sprint detail (for founder multi-sprint mode)
  const { data: selectedSprintDetail, isLoading: selectedSprintDetailLoading } = useQuery<{
    id: string;
    index: number;
    name: string | null;
    goals: string | null;
    startDate: string;
    endDate: string;
    passed: boolean;
    passedAt: string | null;
    status?: string;
    demoUrl: string | null;
    demoNotes: string | null;
    tasks: Task[];
  }>({
    queryKey: ["/api/sprints", selectedSprintId],
    queryFn: async () => {
      if (!selectedSprintId) throw new Error("No sprint");
      const data = await apiRequest("GET", `/api/sprints/${selectedSprintId}`);
      return data;
    },
    enabled: !!selectedSprintId && !!teamId,
  });

  // Full record behind the "View Details" dialog. Fetched only while the dialog
  // is open, and for any role — GET /api/sprints/:id enforces team membership
  // server-side, so learners on the team get their own sprint and nobody else's.
  const { data: sprintDetails, isLoading: sprintDetailsLoading } = useQuery<{
    id: string;
    index: number;
    name: string | null;
    goals: string | null;
    objectives: string | null;
    deliverables: string | null;
    startDate: string;
    endDate: string;
    passed: boolean | null;
    passedAt: string | null;
    demoUrl: string | null;
    demoNotes: string | null;
    tasks: Array<{ id: string; title: string; status: string; priority?: string; assigneeId?: string | null }>;
    reviews: Array<{ id: string; mentorId: string; mentorName: string | null; score: number | null; notes: string | null; rubricJson: any; createdAt: string }>;
    standups: Array<{ id: string; authorId: string; authorName: string | null; yesterday: string | null; today: string | null; blockers: string | null; mood: string | null; createdAt: string }>;
    evidence: Array<{ id: string; type: string; url: string; title: string | null; submitterName: string | null; createdAt: string }>;
    resources: Array<{ id: string; type: "file" | "link"; fileName: string; objectKey: string | null; url: string | null; contentType: string | null; fileSize: number | null; uploaderName: string | null; createdAt: string }>;
  }>({
    queryKey: ["/api/sprints", detailsSprintId, "full"],
    queryFn: async () => apiRequest("GET", `/api/sprints/${detailsSprintId}`),
    enabled: !!detailsSprintId && showSprintDetailsDialog,
  });

  // Get selected team details (members and problem statement)
  const { data: selectedTeamDetails, isLoading: selectedTeamDetailsLoading } = useQuery<{
    team: { id: string; name: string; health: string };
    problemStatement: { id: string; title: string; track: string; overview: string } | null;
    founders: Array<{ userId: string; name: string; email: string; role: string; userRole: string; stipendBand: string | null }>;
    coFounders: Array<{ userId: string; name: string; email: string; role: string; userRole: string; stipendBand: string | null }>;
    mentors: Array<{ userId: string; name: string; email: string; role: string; userRole: string; stipendBand: string | null }>;
    learners: Array<{ userId: string; name: string; email: string; role: string; userRole: string; stipendBand: string | null }>;
    allMembers: Array<{ userId: string; name: string; email: string; role: string; userRole: string; stipendBand: string | null }>;
  }>({
    queryKey: ["/api/teams", teamId, "details"],
    queryFn: async () => {
      if (!teamId) throw new Error("No team ID");
      
      // Try admin/mentor endpoint first (for admins and mentors) - returns clean format
      if (user?.role === "ADMIN" || user?.role === "MENTOR") {
        try {
          return await apiRequest("GET", `/api/admin/teams/${teamId}/details`);
        } catch (error: any) {
          // Fall through to regular endpoint if it fails
        }
      }
      
      // Use regular team endpoint (available to all authenticated users)
      const teamData = await apiRequest("GET", `/api/teams/${teamId}`);
      
      // Transform the response to match expected format
      const assignments = teamData.members || [];
      
      // Categorize members based on user role and assignment role
      const founders = assignments.filter((m: any) => 
        m.user?.role === "FOUNDER"
      );
      const coFounders = assignments.filter((m: any) => 
        m.user?.role === "COFOUNDER" || m.role === "CoPromoter"
      );
      const mentors = assignments.filter((m: any) => 
        (m.user?.role === "MENTOR" || m.role === "Promoter") && 
        m.user?.role !== "FOUNDER" && 
        m.user?.role !== "COFOUNDER"
      );
      const learners = assignments.filter((m: any) => 
        (m.user?.role === "LEARNER" || m.role === "Member") &&
        m.user?.role !== "FOUNDER" &&
        m.user?.role !== "COFOUNDER" &&
        m.user?.role !== "MENTOR"
      );
      
      return {
        team: { id: teamData.id, name: teamData.name, health: teamData.health || "G" },
        problemStatement: teamData.problemStatement ? {
          id: teamData.problemStatement.id,
          title: teamData.problemStatement.title,
          track: teamData.problemStatement.track,
          overview: teamData.problemStatement.overview || teamData.problemStatement.summary || "",
        } : null,
        founders: founders.map((m: any) => ({
          userId: m.userId,
          name: m.user?.name || "Unknown",
          email: m.user?.email || "",
          role: m.role,
          userRole: m.user?.role || "",
          stipendBand: m.stipendBand,
        })),
        coFounders: coFounders.map((m: any) => ({
          userId: m.userId,
          name: m.user?.name || "Unknown",
          email: m.user?.email || "",
          role: m.role,
          userRole: m.user?.role || "",
          stipendBand: m.stipendBand,
        })),
        mentors: mentors.map((m: any) => ({
          userId: m.userId,
          name: m.user?.name || "Unknown",
          email: m.user?.email || "",
          role: m.role,
          userRole: m.user?.role || "",
          stipendBand: m.stipendBand,
        })),
        learners: learners.map((m: any) => ({
          userId: m.userId,
          name: m.user?.name || "Unknown",
          email: m.user?.email || "",
          role: m.role,
          userRole: m.user?.role || "",
          stipendBand: m.stipendBand,
        })),
        allMembers: assignments.map((m: any) => ({
          userId: m.userId,
          name: m.user?.name || "Unknown",
          email: m.user?.email || "",
          role: m.role,
          userRole: m.user?.role || "",
          stipendBand: m.stipendBand,
        })),
      };
    },
    enabled: !!teamId, // Enable for both selected team (admins) and user's own team (founders)
  });


  // Use team-based sprint fetch for admins and mentors with a selected team
  const useTeamBasedSprint = (user?.role === "ADMIN" || user?.role === "MENTOR") && !!selectedTeamId && !!teamId;

  const { data: sprintData, isLoading: sprintLoading, isError: sprintError } = useQuery<{
    sprint: Sprint | null;
    tasks: Task[];
    totalSprints: number;
    completedTasks: number;
    totalTasks: number;
  }>({
    queryKey: useTeamBasedSprint ? ["/api/teams", teamId, "sprint"] : ["/api/my-sprint"],
    queryFn: async () => {
      if (useTeamBasedSprint) {
        // For admin/mentor users with selected team, fetch team's sprint data
        const sprints = await apiRequest("GET", `/api/teams/${teamId}/sprints`);
        const currentSprint = sprints.find((s: any) => !s.passed) || sprints[sprints.length - 1];
        
        if (!currentSprint) {
          return { sprint: null, tasks: [], totalSprints: sprints.length, completedTasks: 0, totalTasks: 0 };
        }

        // Get tasks for this sprint
        const allTasks = await apiRequest("GET", `/api/teams/${teamId}/tasks`);
        const sprintTasks = allTasks.filter((t: any) => t.sprintId === currentSprint.id);
        const completedTasksList = sprintTasks.filter((t: any) => t.status === "DONE");

        // Calculate days remaining
        const endDate = new Date(currentSprint.endDate);
        const today = new Date();
        const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

        // Determine status based on dates

        return {
          sprint: {
            id: currentSprint.id,
            index: currentSprint.index,
            number: currentSprint.index,
            title: (currentSprint as any).name || currentSprint.goals || `Sprint ${currentSprint.index}`,
            name: (currentSprint as any).name || null,
            goals: currentSprint.goals || null,
            objectives: (currentSprint as any).objectives || null,
            deliverables: (currentSprint as any).deliverables || null,
            startDate: currentSprint.startDate,
            endDate: currentSprint.endDate,
            passed: currentSprint.passed,
            passedAt: currentSprint.passedAt || null,
              demoUrl: currentSprint.demoUrl || null,
            demoNotes: currentSprint.demoNotes || null,
            daysLeft,
          },
          tasks: sprintTasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            assigneeId: t.assigneeId,
            assigneeIds: t.assigneeIds ? (Array.isArray(t.assigneeIds) ? t.assigneeIds : JSON.parse(t.assigneeIds)) : null,
            assignedBy: t.assignedBy ?? null,
            submissionProgress: t.submissionProgress ?? null,
            points: t.points || 1,
            priority: t.priority,
            objectives: t.objectives ?? null,
            deliverables: t.deliverables ?? null,
            startDate: t.startDate ?? null,
            endDate: t.endDate ?? null,
            reviewerId: t.reviewerId ?? null,
            reviewComment: t.reviewComment ?? null,
          })),
          totalSprints: sprints.length,
          completedTasks: completedTasksList.length,
          totalTasks: sprintTasks.length,
        };
      }
      // For regular users (founders, etc.), use the existing endpoint
      return await apiRequest("GET", "/api/my-sprint");
    },
    enabled: !!(useTeamBasedSprint ? teamId : user), // Enable when admin/mentor has selected team, or for regular users
  });

  // Effective sprint for display: multi-sprint mode (founder) uses selected sprint; others use my-sprint
  // Must be defined before standups/evidence queries that depend on effectiveSprintId
  const effectiveSprintId = useMemo(() => {
    if (canBrowseSprints && selectedSprintDetail?.id) return selectedSprintDetail.id;
    return sprintData?.sprint?.id ?? null;
  }, [canBrowseSprints, selectedSprintDetail?.id, sprintData?.sprint?.id]);

  const effectiveSprintData = useMemo(() => {
    if (canBrowseSprints && selectedSprintDetail) {
      const tasks = selectedSprintDetail.tasks || [];
      const completedTasksList = tasks.filter((t: Task) => t.status === "DONE");
      const endDate = new Date(selectedSprintDetail.endDate);
      const today = new Date();
      const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        sprint: {
          id: selectedSprintDetail.id,
          index: selectedSprintDetail.index,
          number: selectedSprintDetail.index,
          title: selectedSprintDetail.name || selectedSprintDetail.goals || `Sprint ${selectedSprintDetail.index}`,
          name: selectedSprintDetail.name || null,
          goals: selectedSprintDetail.goals || null,
          objectives: (selectedSprintDetail as any).objectives || null,
          deliverables: (selectedSprintDetail as any).deliverables || null,
          startDate: selectedSprintDetail.startDate,
          endDate: selectedSprintDetail.endDate,
          passed: selectedSprintDetail.passed,
          passedAt: selectedSprintDetail.passedAt || null,
          demoUrl: selectedSprintDetail.demoUrl || null,
          demoNotes: selectedSprintDetail.demoNotes || null,
          daysLeft,
        },
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          assigneeId: t.assigneeId,
          assigneeIds: t.assigneeIds ? (Array.isArray(t.assigneeIds) ? t.assigneeIds : JSON.parse(t.assigneeIds)) : null,
          assignedBy: t.assignedBy ?? null,
          submissionProgress: t.submissionProgress ?? null,
          points: t.points ?? 1,
          priority: t.priority,
          objectives: t.objectives ?? null,
          deliverables: t.deliverables ?? null,
          startDate: t.startDate ?? null,
          endDate: t.endDate ?? null,
          reviewerId: t.reviewerId ?? null,
          reviewComment: t.reviewComment ?? null,
        })),
        totalSprints: Math.max(allSprints.length, 1),
        completedTasks: completedTasksList.length,
        totalTasks: tasks.length,
      };
    }
    return sprintData ?? null;
  }, [canBrowseSprints, allSprints.length, selectedSprintDetail, sprintData]);

  /**
   * The task the details dialog is showing, re-read from the live task list.
   *
   * Holding the clicked object meant the dialog kept whatever the task looked like when it was
   * opened: assign somebody, or start the task, and the panel behind still said "Not assigned"
   * and TODO. Falls back to the snapshot if the task is not in the current list — a sprint
   * switch, say — so the dialog degrades to stale rather than blanking out.
   */
  const viewingTask = useMemo(() => {
    if (!viewingTaskSnapshot) return null;
    const live = (effectiveSprintData?.tasks ?? []).find(
      (t: Task) => String(t.id) === String(viewingTaskSnapshot.id)
    );
    return live ?? viewingTaskSnapshot;
  }, [viewingTaskSnapshot, effectiveSprintData]);

  // These two had no queryFn, so they fell through to the default one in
  // queryClient.ts — which builds the URL from queryKey[0] alone and therefore
  // requested bare `/api/sprints`. That 404s (and retries twice), so the
  // standups and evidence panels never loaded. Spelling out the real URL fixes
  // both without touching the shared default.
  const { data: standups, isLoading: standupsLoading } = useQuery<DailyStandup[]>({
    queryKey: ["/api/sprints", effectiveSprintId, "standups"],
    queryFn: async () => apiRequest("GET", `/api/sprints/${effectiveSprintId}/standups`),
    enabled: !!effectiveSprintId,
  });

  const { data: evidence, isLoading: evidenceLoading } = useQuery<Evidence[]>({
    queryKey: ["/api/sprints", effectiveSprintId, "evidence"],
    queryFn: async () => apiRequest("GET", `/api/sprints/${effectiveSprintId}/evidence`),
    enabled: !!effectiveSprintId,
  });

  const { data: sprintResources = [], isLoading: sprintResourcesLoading } = useQuery<SprintResourceItem[]>({
    queryKey: ["/api/sprints", effectiveSprintId, "resources"],
    queryFn: async () => apiRequest("GET", `/api/sprints/${effectiveSprintId}/resources`),
    enabled: !!effectiveSprintId,
  });

  const { data: taskEvidenceItems = [], isLoading: taskEvidenceLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks", viewingTask?.id, "evidence"],
    queryFn: () => apiRequest("GET", `/api/tasks/${viewingTask?.id}/evidence`),
    enabled: !!viewingTask && showViewTaskDialog,
  });

  // Check edit permission for current sprint
  const { data: editPermissionData } = useQuery<{ canEdit: boolean }>({
    queryKey: ["/api/sprints", effectiveSprintId, "can-edit"],
    queryFn: async () => {
      if (!effectiveSprintId) return { canEdit: false };
      return await apiRequest("GET", `/api/sprints/${effectiveSprintId}/can-edit`);
    },
    enabled: !!effectiveSprintId && !!user,
  });

  useEffect(() => {
    // Admins, Founders, and Mentors can edit without waiting for can-edit API (so Add Task works even if that API fails/slow)
    if (user?.role === "ADMIN" || user?.role === "FOUNDER" || user?.role === "MENTOR") {
      setCanEdit(true);
      return;
    }
    if (editPermissionData !== undefined) {
      setCanEdit(editPermissionData.canEdit);
    }
  }, [editPermissionData, user?.role]);

  // removed debug useEffects

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: {
      title: string;
      description: string;
      objectives?: string;
      deliverables?: string;
      startDate?: string;
      endDate?: string;
      dependencies?: string[];
      priority: string;
      assigneeIds?: string[];
    }) => {
      const sprintId = effectiveSprintId ?? sprintData?.sprint?.id;
      if (!sprintId) throw new Error("No sprint selected");
      const payload = {
        ...taskData,
        assigneeIds: taskData.assigneeIds?.length ? taskData.assigneeIds : undefined,
      };
      return await apiRequest("POST", `/api/sprints/${sprintId}/tasks`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({
        title: "Task created",
        description: "Task has been added to the sprint",
      });
      setShowTaskDialog(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskObjectives("");
      setTaskDeliverables("");
      setTaskStartDate("");
      setTaskEndDate("");
      setTaskDependencies([]);
      setTaskPriority("MEDIUM");
      setTaskAssigneeId("");
      setTaskAssigneeIds([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const createSprintMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      startDate: string;
      endDate: string;
      goals?: string;
      objectives?: string;
      deliverables?: string;
      resources?: PendingSprintResource[];
    }) => {
      if (!teamId) throw new Error("Team not found");
      const { resources, ...sprintFields } = payload;
      const sprint = await apiRequest("POST", `/api/teams/${teamId}/sprints`, sprintFields);
      // The sprint id doesn't exist until now, so files staged in the dialog
      // (already uploaded to storage) are only attached at this point. Best
      // effort: a failed attach shouldn't undo the sprint that was just made.
      if (sprint?.id && resources && resources.length > 0) {
        for (const file of resources) {
          try {
            await apiRequest("POST", `/api/sprints/${sprint.id}/resources`, {
              fileName: file.fileName,
              objectKey: file.objectKey,
              contentType: file.contentType,
              fileSize: file.fileSize,
            });
          } catch (err) {
            console.error("Failed to attach sprint resource:", err);
          }
        }
      }
      return sprint;
    },
    onSuccess: async (newSprint: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "sprints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "details"] });
      if (newSprint?.id) {
        setSelectedSprintId(newSprint.id);
        queryClient.invalidateQueries({ queryKey: ["/api/sprints", newSprint.id, "resources"] });
      }
      toast({ title: "Sprint created", description: "Sprint has been created for your team" });
      setShowSprintDialog(false);
      setSprintForm(emptySprintValues);
      setSprintResourcesForm([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create sprint", variant: "destructive" });
    },
  });

  // Adds a resource to an already-existing sprint (Resources tab), as opposed to
  // createSprintMutation's own attach step for files staged before the sprint existed.
  // Accepts either an uploaded file or an external link — the server tells them
  // apart via `type`.
  const addSprintResourceMutation = useMutation({
    mutationFn: async (
      resource:
        | (PendingSprintResource & { type?: "file" })
        | { type: "link"; fileName: string; url: string }
    ) => {
      if (!effectiveSprintId) throw new Error("No sprint selected");
      const body =
        resource.type === "link"
          ? { type: "link" as const, fileName: resource.fileName, url: resource.url }
          : {
              type: "file" as const,
              fileName: resource.fileName,
              objectKey: resource.objectKey,
              contentType: resource.contentType,
              fileSize: resource.fileSize,
            };
      return await apiRequest("POST", `/api/sprints/${effectiveSprintId}/resources`, body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId, "resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId] });
      toast({
        title: variables.type === "link" ? "Link added" : "Resource uploaded",
        description:
          variables.type === "link"
            ? "The link has been added to this sprint"
            : "The file has been added to this sprint",
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add resource", variant: "destructive" });
    },
  });

  const deleteSprintResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      if (!effectiveSprintId) throw new Error("No sprint selected");
      return await apiRequest("DELETE", `/api/sprints/${effectiveSprintId}/resources/${resourceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId, "resources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId] });
      toast({ title: "Resource removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove resource", variant: "destructive" });
    },
  });

  const downloadSprintResource = async (objectKey: string, fileName: string) => {
    try {
      const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey });
      const url = resp?.fileUrl || resp?.viewUrl || resp?.url;
      if (url) {
        window.open(url, "_blank");
      } else {
        toast({ title: "Error", description: "Could not get a download link for this file", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to download file", variant: "destructive" });
    }
  };

  const resetAddResourceLinkDialog = () => {
    setResourceLinkTitle("");
    setResourceLinkUrl("");
    setShowAddResourceLinkDialog(false);
  };

  const handleAddResourceLink = () => {
    const title = resourceLinkTitle.trim();
    const url = resourceLinkUrl.trim();
    if (!title) {
      toast({ title: "Title required", description: "Give the link a short title", variant: "destructive" });
      return;
    }
    if (!/^https?:\/\/.+/i.test(url)) {
      toast({ title: "Invalid URL", description: "Enter a link starting with http:// or https://", variant: "destructive" });
      return;
    }
    addSprintResourceMutation.mutate(
      { type: "link", fileName: title, url },
      { onSuccess: () => resetAddResourceLinkDialog() }
    );
  };

  const updateSprintMutation = useMutation({
    mutationFn: async (payload: { index?: number; name?: string; goals?: string; objectives?: string; deliverables?: string; startDate?: string; endDate?: string }) => {
      if (!effectiveSprintId) throw new Error("No sprint selected");
      return await apiRequest("PATCH", `/api/sprints/${effectiveSprintId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "sprints"] });
      toast({ title: "Sprint updated", description: "Sprint details have been saved" });
      setShowEditSprintDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update sprint", variant: "destructive" });
    },
  });

  const deleteSprintMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveSprintId) throw new Error("No sprint selected");
      return await apiRequest("DELETE", `/api/sprints/${effectiveSprintId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "sprints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "details"] });
      setSelectedSprintId(null);
      toast({ title: "Sprint deleted", description: "The sprint has been deleted." });
      setShowDeleteSprintConfirm(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete sprint", variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cohort-stats"] });
      toast({ title: "Task updated", description: "Task status changed" });
      setShowCommentDialog(false);
      setReviewComment("");
      setPendingStatusChange(null);
    },
    onError: (error: any) => {
      // A shared task waiting on other assignees is not a failure — the server
      // flags that with `informational: true`. Reporting it as a red error made
      // learners think their own submission had been rejected.
      if (error?.body?.informational) {
        queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
        const needsReview = error.body.reason === "REVIEW_SUBMISSIONS_FIRST";
        toast({
          // Two different situations arrive here. An assignee is waiting on teammates to
          // submit; a reviewer is being told to accept the submissions first. One title for
          // both told mentors they were waiting on their teammates, which is nonsense when
          // the thing blocking them is their own review.
          title: needsReview ? "Submissions need reviewing first" : "Waiting on your teammates",
          description:
            (error.body.message || error.message) +
            (needsReview ? " Open To Review in the sidebar to accept or send them back." : ""),
        });
        setShowCommentDialog(false);
        setReviewComment("");
        setPendingStatusChange(null);
        return;
      }
      console.error("Update task error:", error);
      toast({ 
        title: "Action Not Allowed", 
        description: error.message || "Could not update the task status.", 
        variant: "destructive" 
      });
    },
  });

  // Only sends assignees, so assigning can never disturb the task's other fields.
  const assignTaskMutation = useMutation({
    mutationFn: async (data: {
      taskId: string;
      assigneeIds: string[];
      startDate?: string | null;
      endDate?: string | null;
    }) => {
      return await apiRequest("PATCH", `/api/tasks/${data.taskId}`, {
        assigneeIds: data.assigneeIds,
        assigneeId: data.assigneeIds[0] ?? null,
        // Only sent when the field is present, so assigning without touching the dates
        // leaves whatever the task already had.
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
      });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      if (selectedSprintId) queryClient.invalidateQueries({ queryKey: ["/api/sprints", selectedSprintId] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      toast({
        title: vars.assigneeIds.length === 0 ? "Task unassigned" : "Task assigned",
        description:
          vars.assigneeIds.length === 0
            ? "Nobody is assigned to this task now."
            : `Assigned to ${vars.assigneeIds.length} team member${vars.assigneeIds.length === 1 ? "" : "s"}.`,
      });
      setShowAssignDialog(false);
      setAssigningTask(null);
    },
    onError: (error: any) => {
      toast({
        title: "Could not assign",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const editTaskMutation = useMutation({
    mutationFn: async (data: { taskId: string; title: string; description?: string; priority: string; objectives?: string; deliverables?: string; startDate?: string; endDate?: string; assigneeIds?: string[] }) => {
      return await apiRequest("PATCH", `/api/tasks/${data.taskId}`, {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        objectives: data.objectives || null,
        deliverables: data.deliverables || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        // Sent only when the caller actually edited assignees, so editing a
        // title never silently clears them.
        ...(data.assigneeIds !== undefined
          ? {
              assigneeIds: data.assigneeIds,
              // Keep the legacy single column in step with the array.
              assigneeId: data.assigneeIds[0] ?? null,
            }
          : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      if (selectedSprintId) queryClient.invalidateQueries({ queryKey: ["/api/sprints", selectedSprintId] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      toast({ title: "Task updated", description: "Task has been updated successfully" });
      setShowEditTaskDialog(false);
      setEditingTask(null);
    },
    onError: (error: any) => {
      toast({ title: "Update Failed", description: error.message || "Could not update the task. Please try again.", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      if (selectedSprintId) queryClient.invalidateQueries({ queryKey: ["/api/sprints", selectedSprintId] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      toast({ title: "Task deleted", description: "Task has been removed" });
      setShowDeleteConfirmBoard(false);
      setDeletingTaskIdBoard(null);
    },
    onError: (error: any) => {
      toast({ title: "Delete Failed", description: error.message || "Could not delete the task. Please try again.", variant: "destructive" });
    },
  });

  /**
   * Names for a task's assignees, resolved from the roster of the team whose board is on
   * screen — not from the viewer's own team.
   *
   * This used to read `teamData.members`, which comes from GET /api/my-team. An admin is not
   * on a team, so that returns null: every assignee lookup found nobody, the avatars vanished
   * from the cards and the details dialog reported "Not assigned" however the task was actually
   * assigned. Mentors viewing a team other than their own hit the same thing.
   *
   * `selectedTeamDetails.allMembers` is the roster for the board's team and is already what the
   * assignee pickers use, so this now agrees with the list the task was assigned from. Note the
   * two sources key the user differently — `userId` here, `id` in the my-team payload — which is
   * the mismatch that made the original lookup fail silently rather than loudly.
   */
  const getTaskAssignees = (task: Task) =>
    // Board's own team first, the viewer's own team only as a fallback. See
    // shared/taskAssignees.ts for why the two payloads have to be normalised.
    resolveAssignees(task, buildRoster(selectedTeamDetails?.allMembers, teamData?.members));

  // Tasks are assigned TO the people who do the work. Mentors and admins are the
  // ones doing the assigning, so they are not offered as assignees even though
  // they appear in the team roster.
  const assignableMembers = (selectedTeamDetails?.allMembers ?? []).filter(
    (m) => m.userRole !== "MENTOR" && m.userRole !== "ADMIN"
  );

  /**
   * The task's current assignees, narrowed to people who can still hold a task.
   *
   * Historic data can name someone the picker no longer offers — a mentor assigned
   * before mentors were excluded, or a member since removed from the team. Seeding those
   * ids straight into the selection made the task impossible to reassign: the server
   * rejects them, and they are not in the list to untick. Dropping them here means the
   * dialog opens with a selection the user can actually submit.
   */
  const currentAssigneesOf = (task: Task) => {
    const raw = Array.isArray((task as any).assigneeIds) && (task as any).assigneeIds.length > 0
      ? (task as any).assigneeIds.map((id: unknown) => String(id))
      : task.assigneeId
        ? [String(task.assigneeId)]
        : [];
    if (assignableMembers.length === 0) return raw;
    const assignable = new Set(assignableMembers.map((m) => m.userId));
    return raw.filter((id: string) => assignable.has(id));
  };

  const openAssignTask = (task: Task) => {
    setAssigningTask(task);
    setAssignIds(currentAssigneesOf(task));
    setAssignStartDate(task.startDate ? task.startDate.split("T")[0] : "");
    setAssignEndDate(task.endDate ? task.endDate.split("T")[0] : "");
    setShowAssignDialog(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditPriority(task.priority);
    setEditObjectives(task.objectives ?? "");
    setEditDeliverables(task.deliverables ?? "");
    setEditAssigneeIds(currentAssigneesOf(task));
    setEditStartDate(task.startDate ? task.startDate.split("T")[0] : "");
    setEditEndDate(task.endDate ? task.endDate.split("T")[0] : "");
    setShowEditTaskDialog(true);
  };

  const createEvidenceMutation = useMutation({
    // Task-scoped so the server can do the shared-task bookkeeping and tell us
    // how many assignees are still outstanding.
    mutationFn: async (data: { taskId: string; type: string; title: string; url: string; metaJson?: Record<string, unknown> }) => {
      return await apiRequest("POST", `/api/tasks/${data.taskId}/evidence`, data);
    },
    onSuccess: () => {
      // Refresh so the "1 of 3 submitted" badge reflects this submission.
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "tasks"] });
    },
    onError: () => {
      toast({ title: "Warning", description: "Task moved to review but evidence could not be saved", variant: "destructive" });
    },
  });

  const handleStatusChange = (task: Task, newStatus: string) => {
    const isAssignee = task.assigneeId === user?.id || Boolean(user?.id && task.assigneeIds?.includes(user.id));
    const isReviewer = task.reviewerId === user?.id;
    
    // Sending work back has to come with a reason, and that applies to whoever does it — not
    // only to a named reviewer. The Approve / Request Changes buttons are now shown to every
    // mentor, founder and admin who may act, so without this a mentor could bounce a task to
    // IN_PROGRESS with no explanation at all and the learner would have nothing to work from.
    // Approving needs no comment: an acceptance speaks for itself, which is the same rule the
    // per-submission review uses (see reviewInputError in @shared/evidenceReview).
    const isReviewing = (isReviewer || canEdit) && !isAssignee;
    if (isReviewing && newStatus === "IN_PROGRESS" && task.status === "REVIEW") {
      setPendingStatusChange({ taskId: task.id, status: newStatus });
      setShowCommentDialog(true);
      return;
    }

    // If moving to REVIEW, show evidence dialog first
    if (newStatus === "REVIEW" && task.status !== "REVIEW") {
      setPendingReviewTask({ taskId: task.id });
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
      taskId,
      type: evidenceType,
      title: evidenceTitle,
      url: evidenceUrl,
      metaJson: Object.keys(metaJson).length > 0 ? metaJson : undefined,
    };
    resetEvidenceDialog();

    if (hasEvidence) {
      try {
        const result: any = await createEvidenceMutation.mutateAsync(payload);
        const progress: TaskSubmissionProgress | null = result?.progress ?? null;

        // On a shared task the server moves the status itself once the last
        // assignee submits, so neither branch needs a PATCH.
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
            description: progress
              ? `All ${progress.totalAssignees} assignees have submitted — this task is now with the reviewer.`
              : "This task is now with the reviewer.",
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

  const createStandupMutation = useMutation({
    mutationFn: async (standupData: { yesterday: string; today: string; blockers: string | null }) => {
      return await apiRequest("POST", `/api/sprints/${effectiveSprintId}/standups`, standupData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId, "standups"] });
      toast({ title: "Standup logged", description: "Your daily standup has been recorded" });
      setShowStandupDialog(false);
      setStandupYesterday("");
      setStandupToday("");
      setStandupBlockers("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log standup", variant: "destructive" });
    },
  });

  const updateDemoMutation = useMutation({
    mutationFn: async (demoData: { demoUrl: string; demoNotes: string }) => {
      return await apiRequest("PATCH", `/api/sprints/${effectiveSprintId}/demo`, demoData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId] });
      toast({ title: "Demo saved", description: "Demo details have been updated" });
      setShowDemoDialog(false);
      setDemoUrl("");
      setDemoNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save demo", variant: "destructive" });
    },
  });

  const uploadDemoMutation = useMutation({
    mutationFn: async (demoData: { demoUrl: string; demoNotes: string }) => {
      return await apiRequest("PUT", `/api/sprints/${effectiveSprintId}/demo-upload`, demoData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sprints", effectiveSprintId] });
      toast({ title: "Demo uploaded", description: "Your demo video has been saved" });
      setShowDemoDialog(false);
      setDemoUrl("");
      setDemoNotes("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to upload demo", variant: "destructive" });
    },
  });

  const getUploadURL = async () => {
    // apiRequest resolves to the parsed body, so there is no .json() to call — it threw here and
    // failed the demo upload before it started.
    const data = await apiRequest("POST", "/api/objects/upload", {});
    return { method: "PUT" as const, url: data.uploadURL };
  };

  const todoTasks = effectiveSprintData?.tasks?.filter(t => t.status === "TODO") || [];
  const inProgressTasks = effectiveSprintData?.tasks?.filter(t => t.status === "IN_PROGRESS") || [];
  const reviewTasks = effectiveSprintData?.tasks?.filter(t => t.status === "REVIEW") || [];
  const doneTasks = effectiveSprintData?.tasks?.filter(t => t.status === "DONE") || [];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH": return "destructive";
      case "MEDIUM": return "secondary";
      default: return "outline";
    }
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case "PR": return <GitPullRequest className="h-4 w-4" />;
      case "CI": return <Play className="h-4 w-4" />;
      case "Doc": return <FileText className="h-4 w-4" />;
      case "Demo": return <Rocket className="h-4 w-4" />;
      default: return <Code2 className="h-4 w-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatResourceFileSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (e: React.DragEvent, newStatus: "TODO" | "IN_PROGRESS" | "DONE") => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId && sprintData?.tasks) {
      const task = sprintData.tasks.find((t: Task) => t.id === taskId);
      if (task) {
        handleStatusChange(task, newStatus);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const criticalLoading = (sprintLoading || teamLoading) && !loadingTimedOut && !teamError && !sprintError;
  if (criticalLoading) {
    return (
      <AppLayout title="Sprint Board">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!effectiveSprintData?.sprint) {
    return (
      <AppLayout title="Sprint Board">
        {(teamError || sprintError) && (
          <Card className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="py-3 text-sm text-amber-800 dark:text-amber-200">
              Could not load sprint data. Check your connection and try refreshing.
            </CardContent>
          </Card>
        )}
        {/* Team Selection for Admins and Mentors */}
        {teamSelectorItems && teamSelectorItems.length > 0 && (
          <Card className="mb-6 bg-card border border-border" data-tour="sb-team-selector">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {user?.role === "MENTOR" ? "Your Teams" : "Select Team"}
              </CardTitle>
              {user?.role === "MENTOR" && (
                <CardDescription>You are assigned to {teamSelectorItems.length} team{teamSelectorItems.length > 1 ? "s" : ""}. Select a team to manage sprints and review work.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="team-select" className="text-sm font-medium text-gray-700">
                  Select Team:
                </Label>
                <Select
                  value={selectedTeamId || ""}
                  onValueChange={(value) => {
                    setSelectedTeamId(value);
                    setSelectedSprintId(null); // Reset sprint when team changes
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "tasks"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "details"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "sprint"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "sprints"] });
                  }}
                >
                  <SelectTrigger id="team-select" className="w-full">
                    <SelectValue placeholder="Choose a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamSelectorItems.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Details Card - Show when team is selected */}
        {effectiveTeamId && (
        <Card className="mb-6 bg-card border border-border" data-tour="sb-team-details">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTeamDetailsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : selectedTeamDetails ? (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Team Members */}
                <div className="space-y-4" data-tour="sb-team-members">
                  <h4 className="text-sm font-semibold text-gray-700">Team Members</h4>
                  {selectedTeamDetails.founders.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground mb-2">Founders</h5>
                      <div className="space-y-1">
                        {selectedTeamDetails.founders.map((founder) => (
                          <div key={founder.userId} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{founder.name}</span>
                            <span className="text-xs text-muted-foreground">({founder.email})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTeamDetails.coFounders.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground mb-2">Co-Founders</h5>
                      <div className="space-y-1">
                        {selectedTeamDetails.coFounders.map((coFounder) => (
                          <div key={coFounder.userId} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{coFounder.name}</span>
                            <span className="text-xs text-muted-foreground">({coFounder.email})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Collapsed past four: a ten-intern roster listed in full pushed the sprint
                      header and task board below the fold. */}
                  <TeamMemberList
                    heading="Mentors"
                    members={selectedTeamDetails.mentors}
                    testId="team-mentors"
                  />
                  <TeamMemberList
                    heading={`Interns (${selectedTeamDetails.learners.length})`}
                    members={selectedTeamDetails.learners}
                    testId="team-interns"
                  />
                </div>

                {/* Problem Statement */}
                <div className="space-y-4" data-tour="sb-problem-statement">
                  <h4 className="text-sm font-semibold text-gray-700">Problem Statement</h4>
                  {selectedTeamDetails.problemStatement ? (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-foreground">{selectedTeamDetails.problemStatement.title}</h5>
                      <Badge className="bg-primary/15 text-primary">{selectedTeamDetails.problemStatement.track}</Badge>
                      {selectedTeamDetails.problemStatement.overview && (
                        <p className="text-sm text-muted-foreground mt-2">{selectedTeamDetails.problemStatement.overview}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No problem statement assigned</p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

        <Card className="relative overflow-hidden border border-border bg-card rounded-2xl py-12 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <CardContent className="relative">
            <Target className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-semibold mb-2 text-slate-900">No Active Sprint</h2>
            <p className="text-slate-700">There is no active sprint for your team at the moment.</p>
            {(user?.role === "FOUNDER" || user?.role === "MENTOR" || user?.role === "ADMIN") && teamId ? (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={() => setShowSprintDialog(true)}
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Create Sprint
                </Button>
                {/* A team with no sprints is exactly what a programme plan is for, so the import
                    has to be reachable from here. Note there is a second, identical
                    `!effectiveSprintData?.sprint` early return further down, kept as a defensive
                    guard — it can never run, because this one returns first. */}
                {user?.role === "ADMIN" && (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowPlanImport(true)}
                    data-testid="button-import-programme-plan-nosprint"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Import Plan
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-4">Only founders, mentors, and admins can create sprints.</p>
            )}
          </CardContent>
        </Card>

        <CreateSprintDialog
        open={showSprintDialog}
        onOpenChange={setShowSprintDialog}
        values={sprintForm}
        onChange={setSprintForm}
        isPending={createSprintMutation.isPending}
        idPrefix="sprint-nosprint"
        resources={sprintResourcesForm}
        onResourcesChange={setSprintResourcesForm}
        onSubmit={() =>
          createSprintMutation.mutate({
            name: sprintForm.name.trim(),
            startDate: sprintForm.startDate,
            endDate: sprintForm.endDate,
            goals: sprintForm.goals || undefined,
            objectives: sprintForm.objectives || undefined,
            deliverables: sprintForm.deliverables || undefined,
            resources: sprintResourcesForm,
          })
        }
      />

        {teamId && (
          <ProgrammePlanImport
            open={showPlanImport}
            onOpenChange={setShowPlanImport}
            teamId={teamId}
            teamName={selectedTeamDetails?.team?.name}
          />
        )}
      </AppLayout>
    );
  }

  const sprintProgress = effectiveSprintData && effectiveSprintData.totalTasks > 0
    ? Math.round((effectiveSprintData.completedTasks / effectiveSprintData.totalTasks) * 100)
    : 0;

  // Defensive: if we somehow got here without a sprint, show no-sprint view instead of crashing
  if (!effectiveSprintData?.sprint) {
    return (
      <AppLayout title="Sprint Board">
        <div className="space-y-6">
          <Card className="rounded-2xl border border-border bg-card p-8 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No Active Sprint</h2>
            <p className="text-muted-foreground">There is no active sprint for your team at the moment.</p>
            {/* Import Plan belongs here more than anywhere: a team with no sprints is exactly the
                case a programme plan is for. It was previously only rendered on the populated
                board, below this early return, so it was invisible until a sprint already
                existed — the one situation where it is least useful. */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {(user?.role === "FOUNDER" || user?.role === "MENTOR" || user?.role === "ADMIN") && teamId && (
                <Button className="gap-2" onClick={() => setShowSprintDialog(true)}>
                  <Plus className="h-4 w-4" />
                  Create Sprint
                </Button>
              )}
              {user?.role === "ADMIN" && teamId && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowPlanImport(true)}
                  data-testid="button-import-programme-plan-empty"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Import Plan
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Rendered in this branch too, not just on the populated board — otherwise the button
            above sets state that nothing is listening for, and clicking it does nothing. */}
        {teamId && (
          <ProgrammePlanImport
            open={showPlanImport}
            onOpenChange={setShowPlanImport}
            teamId={teamId}
            teamName={selectedTeamDetails?.team?.name}
          />
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Sprint Board">
        {/* No-teams empty state for mentors — sentinel for Page Guide */}
        {user?.role === "MENTOR" && teamSelectorItems !== null && teamSelectorItems.length === 0 && (
          <div data-tour="sb-no-teams-state" className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-semibold text-foreground mb-2">Sprint Board</p>
            <p className="text-muted-foreground max-w-md">
              Here you can view sprint details, tasks, and progress for your assigned teams. You are currently not assigned to any team — once a team is assigned to you, the full sprint board will be available here.
            </p>
          </div>
        )}
        {/* Team Selection for Admins and Mentors */}
        {teamSelectorItems && teamSelectorItems.length > 0 && (
          <Card className="mb-6 bg-card border border-border" data-tour="sb-team-selector">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {user?.role === "MENTOR" ? "Your Teams" : "Select Team"}
              </CardTitle>
              {user?.role === "MENTOR" && (
                <CardDescription>You are assigned to {teamSelectorItems.length} team{teamSelectorItems.length > 1 ? "s" : ""}. Select a team to manage sprints and review work.</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="team-select-active" className="text-sm font-medium text-gray-700">
                  Select Team:
                </Label>
                <Select
                  value={selectedTeamId || ""}
                  onValueChange={(value) => {
                    setSelectedTeamId(value);
                    setSelectedSprintId(null); // Reset sprint when team changes
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "tasks"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "details"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/admin/teams", value, "details"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "sprint"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/teams", value, "sprints"] });
                  }}
                >
                  <SelectTrigger id="team-select-active" className="w-full" data-tour="sb-team-dropdown">
                    <SelectValue placeholder="Choose a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamSelectorItems.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        

        {/* Team Details Card - Show when team is selected (for admins and mentors) */}
        {teamId && (selectedTeamId || user?.role === "ADMIN" || user?.role === "MENTOR") && (
        <Card className="mb-6 bg-card border border-border" data-tour="sb-team-details">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Team Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTeamDetailsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : selectedTeamDetails ? (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Team Members */}
                <div className="space-y-4" data-tour="sb-team-members">
                  <h4 className="text-sm font-semibold text-gray-700">Team Members</h4>
                  {selectedTeamDetails.founders.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground mb-2">Founders</h5>
                      <div className="space-y-1">
                        {selectedTeamDetails.founders.map((founder) => (
                          <div key={founder.userId} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{founder.name}</span>
                            <span className="text-xs text-muted-foreground">({founder.email})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTeamDetails.coFounders.length > 0 && (
                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground mb-2">Co-Founders</h5>
                      <div className="space-y-1">
                        {selectedTeamDetails.coFounders.map((coFounder) => (
                          <div key={coFounder.userId} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{coFounder.name}</span>
                            <span className="text-xs text-muted-foreground">({coFounder.email})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Collapsed past four: a ten-intern roster listed in full pushed the sprint
                      header and task board below the fold. */}
                  <TeamMemberList
                    heading="Mentors"
                    members={selectedTeamDetails.mentors}
                    testId="team-mentors"
                  />
                  <TeamMemberList
                    heading={`Interns (${selectedTeamDetails.learners.length})`}
                    members={selectedTeamDetails.learners}
                    testId="team-interns"
                  />
                </div>

                {/* Problem Statement */}
                <div className="space-y-4" data-tour="sb-problem-statement">
                  <h4 className="text-sm font-semibold text-gray-700">Problem Statement</h4>
                  {selectedTeamDetails.problemStatement ? (
                    <div className="space-y-2">
                      <h5 className="font-semibold text-foreground">{selectedTeamDetails.problemStatement.title}</h5>
                      <Badge className="bg-primary/15 text-primary">{selectedTeamDetails.problemStatement.track}</Badge>
                      {selectedTeamDetails.problemStatement.overview && (
                        <p className="text-sm text-muted-foreground mt-2">{selectedTeamDetails.problemStatement.overview}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No problem statement assigned</p>
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden border border-border bg-card rounded-2xl mb-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <CardHeader className="pb-3 relative">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                {canBrowseSprints && allSprints.length > 0 && (
                  <Select value={selectedSprintId ?? ""} onValueChange={(v) => setSelectedSprintId(v)}>
                    <SelectTrigger className="w-[200px] shrink-0" data-tour="sprint-selector">
                      <SelectValue placeholder="Select sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSprints.map((s) => {
                        // Same derivation as the header, so the list and the heading cannot
                        // disagree about which phase is closed or late.
                        const optionPhase = sprintPhase(s as any);
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            Sprint {s.index}
                            {(() => {
                              // Prefer the name; fall back to a truncated goals
                              // snippet for sprints created before names existed.
                              const label = (s as any).name || s.goals;
                              if (!label) return "";
                              const text = String(label);
                              return `: ${text.slice(0, 25)}${text.length > 25 ? "…" : ""}`;
                            })()}
                            {" "}({formatDate(s.startDate)} – {formatDate(s.endDate)})
                            {optionPhase === "CLOSED"
                              ? " — Closed"
                              : optionPhase === "OVERDUE"
                                ? " — Overdue"
                                : optionPhase === "DUE"
                                  ? " — Due soon"
                                  : optionPhase === "UPCOMING"
                                    ? " — Not started"
                                    : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
                {/* No "Sprint N:" prefix when the sprint carries its own name: a name like
                    "Phase I: Orientation" is already a label, and prefixing rendered
                    "Sprint 1: Phase I: Orientation". The number stays on the selector. */}
                <CardTitle data-testid="heading-sprint-title" data-tour="sprint-board-heading" className="shrink-0">
                  {(effectiveSprintData.sprint as any).name
                    ? effectiveSprintData.sprint.title
                    : `Sprint ${effectiveSprintData.sprint.index}: ${effectiveSprintData.sprint.title}`}
                </CardTitle>
                {/* One vocabulary for this, from @shared/sprintPhase. The server used to call a
                    sprint past its end date "REVIEW" while this file called it "TIME_OVER", and
                    the mentor dashboard compared against a `status` field the table does not
                    have. The timing is spelled out because "4 Aug - 24 Aug" makes the reader do
                    the arithmetic to find out they are three days late. */}
                {(() => {
                  const phase = sprintPhase(effectiveSprintData.sprint as any);
                  const timing = sprintTimingLabel(effectiveSprintData.sprint as any);
                  const tone =
                    phase === "CLOSED"
                      ? "bg-green-500 text-white"
                      : phase === "OVERDUE"
                        ? "bg-red-500 text-white"
                        : phase === "DUE"
                          ? "bg-amber-500 text-white"
                          : "";
                  return (
                    <>
                      <Badge className={tone} variant={tone ? undefined : "secondary"}>
                        {SPRINT_PHASE_LABELS[phase]}
                      </Badge>
                      {phase !== "CLOSED" && (
                        <span
                          className={`text-sm ${phase === "OVERDUE" ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                          data-testid="text-sprint-timing"
                        >
                          {timing}
                        </span>
                      )}
                    </>
                  );
                })()}
                {effectiveSprintData?.sprint?.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 shrink-0"
                    onClick={() => {
                      setDetailsSprintId(effectiveSprintData.sprint!.id);
                      setShowSprintDetailsDialog(true);
                    }}
                    data-testid="button-view-sprint-details"
                  >
                    <FileText className="h-4 w-4" />
                    View Details
                  </Button>
                )}
                {/* Closing is what moves the team to the next phase, so it belongs beside the
                    sprint it closes rather than on a different dashboard. Mentors and admins
                    only: /api/sprints/:id/pass is requireRole("MENTOR","ADMIN"), and showing a
                    founder a button they cannot use is worse than not showing it. */}
                {(user?.role === "MENTOR" || user?.role === "ADMIN") &&
                  effectiveSprintData?.sprint?.id &&
                  !effectiveSprintData.sprint.passed && (
                    <Button
                      size="sm"
                      variant={
                        sprintPhase(effectiveSprintData.sprint as any) === "OVERDUE"
                          ? "default"
                          : "outline"
                      }
                      className="gap-2 shrink-0"
                      onClick={() => setShowCloseSprint(true)}
                      data-testid="button-close-sprint"
                    >
                      <CheckCheck className="h-4 w-4" />
                      Close sprint
                    </Button>
                  )}
                {canExportSprint && effectiveSprintData?.sprint?.id && (
                  effectiveSprintData.sprint.passed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 shrink-0"
                      onClick={() => {
                        setExportSprintId(effectiveSprintData.sprint!.id);
                        setShowSprintExportDialog(true);
                      }}
                      data-testid="button-export-sprint"
                    >
                      <FileArchive className="h-4 w-4" />
                      Sprint Report
                    </Button>
                  ) : (
                    // Shown disabled rather than hidden: a team that has finished
                    // its work would otherwise hunt for a button that isn't there.
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0">
                          <Button size="sm" variant="outline" className="gap-2" disabled>
                            <FileArchive className="h-4 w-4" />
                            Sprint Report
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Available once a mentor or admin marks this sprint as passed
                      </TooltipContent>
                    </Tooltip>
                  )
                )}
                {(user?.role === "FOUNDER" || user?.role === "MENTOR" || user?.role === "ADMIN") && teamId && (
                  <Button size="sm" onClick={() => setShowSprintDialog(true)} className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground" data-tour="create-sprint-btn">
                    <Plus className="h-4 w-4" />
                    Create Sprint
                  </Button>
                )}
                {/* Admin-only: a programme plan spans a whole cohort, so it is not a founder's
                    call to import one. Preview-only for now — it writes nothing. */}
                {user?.role === "ADMIN" && teamId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowPlanImport(true)}
                    className="gap-2 shrink-0"
                    data-testid="button-import-programme-plan"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Import Plan
                  </Button>
                )}
                {(user?.role === "FOUNDER" || user?.role === "ADMIN") && effectiveSprintData?.sprint && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="shrink-0 px-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditSprintIndex(effectiveSprintData.sprint?.index ?? 1);
                          setEditSprintName((effectiveSprintData.sprint as any)?.name ?? "");
                          setEditSprintGoals(effectiveSprintData.sprint?.goals ?? "");
                          setEditSprintObjectives(effectiveSprintData.sprint?.objectives ?? "");
                          setEditSprintDeliverables(effectiveSprintData.sprint?.deliverables ?? "");
                          setEditSprintStartDate(effectiveSprintData.sprint?.startDate?.split("T")[0] ?? "");
                          setEditSprintEndDate(effectiveSprintData.sprint?.endDate?.split("T")[0] ?? "");
                          setShowEditSprintDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Sprint
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowDeleteSprintConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Sprint
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <CardDescription className="flex items-center gap-4 flex-wrap" data-tour="sprint-date-range">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(effectiveSprintData.sprint.startDate)} - {formatDate(effectiveSprintData.sprint.endDate)}
                </span>
                <span className="flex items-center gap-1">
                  <User2 className="h-3 w-3" />
                  {selectedTeamDetails?.team?.name || teamData?.team?.name || teamData?.name || "Team"}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-4" data-tour="sprint-progress">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="font-semibold">{sprintProgress}%</p>
              </div>
              <Progress value={sprintProgress} className="w-24 h-3" />
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid" data-tour="sprint-tabs">
          <TabsTrigger value="board" className="gap-2" data-testid="tab-board">
            <LayoutGrid className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="standups" className="gap-2" data-testid="tab-standups">
            <MessageSquare className="h-4 w-4" />
            Standups
          </TabsTrigger>
          <TabsTrigger value="demo" className="gap-2" data-testid="tab-demo">
            <Rocket className="h-4 w-4" />
            Demo
          </TabsTrigger>
          <TabsTrigger value="evidence" className="gap-2" data-testid="tab-evidence">
            <GitBranch className="h-4 w-4" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2" data-testid="tab-resources">
            <Paperclip className="h-4 w-4" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="flex items-center justify-between mb-4">
            {/* The nudge. A date range in the header leaves the reader to work out that the
                sprint ended days ago; this says it, counts what is unfinished, and offers the
                action. Only to the people who can act on it. */}
            {(() => {
              if (!effectiveSprintData?.sprint || effectiveSprintData.sprint.passed) return null;
              const phase = sprintPhase(effectiveSprintData.sprint as any);
              if (phase !== "DUE" && phase !== "OVERDUE") return null;
              if (user?.role !== "MENTOR" && user?.role !== "ADMIN") return null;

              const open = (effectiveSprintData.tasks ?? []).filter((t: Task) => t.status !== "DONE");
              const awaiting = (effectiveSprintData.tasks ?? []).filter(
                (t: Task) => t.status === "REVIEW"
              );
              const overdue = phase === "OVERDUE";

              return (
                <div
                  className={`mb-4 rounded-lg border p-3 ${overdue ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10"}`}
                  data-testid="banner-sprint-deadline"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      <p className={`font-medium ${overdue ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-500"}`}>
                        {sprintTimingLabel(effectiveSprintData.sprint as any)}
                        {overdue ? " — this sprint should be closed" : " — time to finish up"}
                      </p>
                      <p className="text-muted-foreground">
                        {open.length === 0
                          ? "All tasks are complete."
                          : `${open.length} of ${effectiveSprintData.tasks.length} ${open.length === 1 ? "task is" : "tasks are"} still open`}
                        {awaiting.length > 0
                          ? `, ${awaiting.length} awaiting your review.`
                          : open.length === 0
                            ? ""
                            : "."}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={overdue ? "default" : "outline"}
                      className="shrink-0 gap-2"
                      onClick={() => setShowCloseSprint(true)}
                      data-testid="button-close-sprint-banner"
                    >
                      <CheckCheck className="h-4 w-4" />
                      Close sprint
                    </Button>
                  </div>
                </div>
              );
            })()}
            {/* Context for a phase that is not the current one. Without this, a learner who
                pages back to a closed sprint sees a board of finished work with no indication
                it is history, and one who pages forward sees an empty board that looks broken
                rather than not yet started. */}
            {(() => {
              if (!effectiveSprintData?.sprint) return null;
              const phase = sprintPhase(effectiveSprintData.sprint as any);
              if (phase !== "CLOSED" && phase !== "UPCOMING") return null;
              const current = allSprints.find((sp: Sprint) => !sp.passed);
              const isCurrent = current?.id === effectiveSprintData.sprint.id;
              if (isCurrent) return null;

              return (
                <div
                  className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm"
                  data-testid="banner-sprint-context"
                >
                  <p className="text-muted-foreground">
                    {phase === "CLOSED"
                      ? "This phase is closed. You are looking at completed work."
                      : "This phase has not started yet."}
                  </p>
                  {current?.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setSelectedSprintId(current.id)}
                      data-testid="button-back-to-current-sprint"
                    >
                      Back to current phase
                    </Button>
                  )}
                </div>
              );
            })()}
            <h2 className="text-lg font-semibold">Task Board</h2>
            {(canEdit || user?.role === "FOUNDER" || user?.role === "MENTOR" || user?.role === "ADMIN") && (
            <Button onClick={() => setShowTaskDialog(true)} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-add-task" data-tour="add-task-btn">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-4" data-tour="task-board-columns">
            <div
              className="space-y-3"
              onDrop={(e) => handleDrop(e, "TODO")}
              onDragOver={handleDragOver}
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <h3 className="font-medium">To Do</h3>
                <Badge variant="secondary" className="ml-auto">{todoTasks.length}</Badge>
              </div>
              {todoTasks.map((task, taskIdx) => {
                const assignee = teamData?.members?.find(m => m.id === task.assigneeId);
                return (
                  <Card
                    key={task.id}
                    className="relative overflow-hidden border border-border bg-card rounded-2xl hover:shadow-2xl transition-shadow cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    data-testid={`card-task-${task.id}`}
                    data-tour={taskIdx === 0 ? "task-card-sample" : undefined}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
                    <CardContent className="py-3 px-4 relative min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm min-w-0 flex-1 break-words">{task.title}</p>
                        {isTaskOverdue(task as any) && (
                          <Badge className="shrink-0 bg-red-500 text-[10px] text-white" title="Past its end date">
                            Overdue
                          </Badge>
                        )}
                        <Badge variant={getPriorityColor(task.priority)} className="text-xs shrink-0 self-start">
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2 break-words overflow-hidden">{task.description}</p>
                      )}
                      <TaskSubmissionBadge progress={task.submissionProgress} className="mb-2" />
                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          {canEdit && (task.assigneeId === user?.id || (task.assigneeIds && task.assigneeIds.includes(user?.id || "")) || user?.role === "ADMIN" || user?.role === "FOUNDER") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleStatusChange(task, "IN_PROGRESS")}
                            data-testid={`button-start-task-${task.id}`}
                          >
                            <Play className="h-3 w-3" /> Start
                          </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => { setViewingTask(task); setShowViewTaskDialog(true); }}
                          >
                            View
                          </Button>
                          {(task.assignedBy === user?.id || user?.role === "ADMIN" || user?.role === "MENTOR") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                title="Assign to team members"
                                onClick={() => openAssignTask(task)}
                              >
                                <Users className="h-3 w-3" />
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => openEditTask(task)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                                onClick={() => { setDeletingTaskIdBoard(task.id); setShowDeleteConfirmBoard(true); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center -space-x-1">
                          {getTaskAssignees(task).slice(0, 3).map((member) => (
                            <Avatar key={member.id} className="h-5 w-5 border border-background">
                              <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {getTaskAssignees(task).length > 3 && (
                            <span className="text-[10px] text-muted-foreground ml-2">+{getTaskAssignees(task).length - 3}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {todoTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No tasks to do
                </div>
              )}
            </div>

            <div
              className="space-y-3"
              onDrop={(e) => handleDrop(e, "IN_PROGRESS")}
              onDragOver={handleDragOver}
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="font-medium">In Progress</h3>
                <Badge variant="secondary" className="ml-auto">{inProgressTasks.length}</Badge>
              </div>
              {inProgressTasks.map((task) => {
                const assignee = teamData?.members?.find(m => m.id === task.assigneeId);
                return (
                  <Card
                    key={task.id}
                    className="hover-elevate cursor-grab active:cursor-grabbing border-primary/30"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    data-testid={`card-task-${task.id}`}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm min-w-0 flex-1 break-words">{task.title}</p>
                        {isTaskOverdue(task as any) && (
                          <Badge className="shrink-0 bg-red-500 text-[10px] text-white" title="Past its end date">
                            Overdue
                          </Badge>
                        )}
                        <Badge variant={getPriorityColor(task.priority)} className="text-xs shrink-0 self-start">
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2 break-words overflow-hidden">{task.description}</p>
                      )}
                      <TaskSubmissionBadge progress={task.submissionProgress} className="mb-2" />
                      {/* Objectives hidden on request, as in Task Details below.
                      {task.objectives && (
                        <p className="text-xs text-muted-foreground mb-1">
                          <strong>Objectives:</strong> {task.objectives}
                        </p>
                      )}
                      */}
                      {task.deliverables && (
                        <p className="text-xs text-muted-foreground mb-1">
                          <strong>Deliverables:</strong> {task.deliverables}
                        </p>
                      )}
                      {(task.startDate || task.endDate) && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {task.startDate && formatDate(task.startDate)}
                          {task.startDate && task.endDate && " - "}
                          {task.endDate && formatDate(task.endDate)}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 flex-wrap">
                          {canEdit && (task.reviewerId === user?.id || !(task.assigneeId === user?.id || Boolean(user?.id && task.assigneeIds?.includes(user.id))) || (!task.assigneeId && (!task.assigneeIds || task.assigneeIds.length === 0)) || user?.role === "ADMIN" || user?.role === "MENTOR") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleStatusChange(task, "DONE")}
                              data-testid={`button-complete-task-${task.id}`}
                            >
                              <CheckCheck className="h-3 w-3" /> Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => { setViewingTask(task); setShowViewTaskDialog(true); }}
                          >
                            View
                          </Button>
                          {(task.assignedBy === user?.id || user?.role === "ADMIN" || user?.role === "MENTOR") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                title="Assign to team members"
                                onClick={() => openAssignTask(task)}
                              >
                                <Users className="h-3 w-3" />
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => openEditTask(task)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                                onClick={() => { setDeletingTaskIdBoard(task.id); setShowDeleteConfirmBoard(true); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                        <div className="flex items-center -space-x-1">
                          {getTaskAssignees(task).slice(0, 3).map((member) => (
                            <Avatar key={member.id} className="h-5 w-5 border border-background">
                              <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {getTaskAssignees(task).length > 3 && (
                            <span className="text-[10px] text-muted-foreground ml-2">+{getTaskAssignees(task).length - 3}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {inProgressTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No tasks in progress
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="font-medium">In Review</h3>
                <Badge variant="secondary" className="ml-auto">{reviewTasks.length}</Badge>
              </div>
              {reviewTasks.map((task) => {
                const isReviewer = task.reviewerId === user?.id;
                // Who may actually approve. The server allows an admin, the team's founder or
                // co-promoter, and any mentor assigned to the team — `canEdit` is that same
                // hasSprintEditPermission answer. Gating the buttons on `isReviewer` alone hid
                // them from everyone except a named reviewer, and reviewerId is unset on
                // essentially every task, so a mentor looking at work submitted to them had no
                // way to mark it done from this board at all.
                const canApprove = Boolean(isReviewer || canEdit);
                const assignee = teamData?.members?.find((m: any) => m.id === task.assigneeId);
                return (
                  <Card
                    key={task.id}
                    className="relative overflow-hidden border border-amber-200 bg-card rounded-2xl hover:shadow-2xl transition-shadow"
                    data-testid={`card-task-${task.id}`}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-lg -translate-y-1/2 translate-x-1/2" />
                    <CardContent className="py-3 px-4 relative min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm min-w-0 flex-1 break-words">{task.title}</p>
                        {isTaskOverdue(task as any) && (
                          <Badge className="shrink-0 bg-red-500 text-[10px] text-white" title="Past its end date">
                            Overdue
                          </Badge>
                        )}
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2 break-words overflow-hidden">{task.description}</p>
                      )}
                      <TaskSubmissionBadge progress={task.submissionProgress} className="mb-2" />
                      {assignee && (
                        <p className="text-xs text-muted-foreground mb-2">Submitted by: <span className="font-medium">{assignee.name}</span></p>
                      )}
                      {task.reviewComment && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-1 mb-2">💬 {task.reviewComment}</p>
                      )}
                      {canApprove ? (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleStatusChange(task, "DONE")}
                            data-testid={`button-approve-task-${task.id}`}
                          >
                            <CheckCheck className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleStatusChange(task, "IN_PROGRESS")}
                            data-testid={`button-request-changes-task-${task.id}`}
                          >
                            <XCircle className="h-3 w-3" /> Request Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => { setViewingTask(task); setShowViewTaskDialog(true); }}
                          >
                            View
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <p className="text-xs text-muted-foreground italic">Awaiting reviewer approval</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => { setViewingTask(task); setShowViewTaskDialog(true); }}
                          >
                            View
                          </Button>
                          {(task.assignedBy === user?.id || user?.role === "ADMIN" || user?.role === "MENTOR") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                title="Assign to team members"
                                onClick={() => openAssignTask(task)}
                              >
                                <Users className="h-3 w-3" />
                                Assign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1"
                                onClick={() => openEditTask(task)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                                onClick={() => { setDeletingTaskIdBoard(task.id); setShowDeleteConfirmBoard(true); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {reviewTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No tasks in review
                </div>
              )}
            </div>

            <div
              className="space-y-3"
              onDrop={(e) => handleDrop(e, "DONE")}
              onDragOver={handleDragOver}
            >
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h3 className="font-medium">Done</h3>
                <Badge variant="secondary" className="ml-auto">{doneTasks.length}</Badge>
              </div>
              {doneTasks.map((task) => (
                <Card
                  key={task.id}
                  className="hover-elevate cursor-grab active:cursor-grabbing opacity-80 min-w-0"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  data-testid={`card-task-${task.id}`}
                >
                  <CardContent className="py-3 px-4 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-sm min-w-0 flex-1 break-words">{task.title}</p>
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                    <TaskSubmissionBadge progress={task.submissionProgress} className="mb-2" showPending={false} />
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => { setViewingTask(task); setShowViewTaskDialog(true); }}
                      >
                        View
                      </Button>
                      {(task.assignedBy === user?.id || user?.role === "ADMIN" || user?.role === "MENTOR") && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            title="Assign to team members"
                            onClick={() => openAssignTask(task)}
                          >
                            <Users className="h-3 w-3" />
                            Assign
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => openEditTask(task)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            onClick={() => { setDeletingTaskIdBoard(task.id); setShowDeleteConfirmBoard(true); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {doneTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No completed tasks
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="standups">
          <Card data-tour="cf-sprint-standups-content">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Daily Standups</CardTitle>
                  <CardDescription>Track daily progress and blockers</CardDescription>
                </div>
                <Button onClick={() => setShowStandupDialog(true)} size="sm" className="gap-2" data-testid="button-log-standup">
                  <Plus className="h-4 w-4" />
                  Log Standup
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {standupsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : standups && standups.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {standups.map((standup) => (
                      <Card key={standup.id} className="border-l-4 border-l-primary" data-testid={`card-standup-${standup.id}`}>
                        <CardContent className="py-4">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {standup.authorName ? getInitials(standup.authorName) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{standup.authorName || "Team Member"}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(standup.createdAt)}</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-muted-foreground">Yesterday:</span>
                              <p className="mt-1">{standup.yesterday}</p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Today:</span>
                              <p className="mt-1">{standup.today}</p>
                            </div>
                            {standup.blockers && (
                              <div>
                                <span className="font-medium text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" /> Blockers:
                                </span>
                                <p className="mt-1">{standup.blockers}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No standups logged yet for this sprint.</p>
                  <Button
                    onClick={() => setShowStandupDialog(true)}
                    variant="outline"
                    className="mt-4"
                    data-testid="button-first-standup"
                  >
                    Log your first standup
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo">
          <div className="grid lg:grid-cols-2 gap-6" data-tour="cf-sprint-demo-content">
            {/* Demo upload/view section - visible to team members and mentors, hidden for admin-only views */}
            {user?.role !== "ADMIN" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Sprint Demo
                </CardTitle>
                <CardDescription>
                  Upload your sprint demo video or link to share with mentors
                </CardDescription>
              </CardHeader>
              <CardContent>
                {effectiveSprintData.sprint.demoUrl ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Demo URL</p>
                      <a
                        href={effectiveSprintData.sprint.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary flex items-center gap-1 hover:underline"
                        data-testid="link-demo-url"
                      >
                        {effectiveSprintData.sprint.demoUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {effectiveSprintData.sprint.demoNotes && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Notes</p>
                        <p className="text-sm text-muted-foreground">{effectiveSprintData.sprint.demoNotes}</p>
                      </div>
                    )}
                    <Button onClick={() => {
                      setDemoUrl(effectiveSprintData.sprint?.demoUrl || "");
                      setDemoNotes(effectiveSprintData.sprint?.demoNotes || "");
                      setShowDemoDialog(true);
                    }} variant="outline" className="w-full" data-testid="button-update-demo">
                      Update Demo
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No demo uploaded yet</p>
                    <Button onClick={() => setShowDemoDialog(true)} data-testid="button-upload-demo">
                      Upload Demo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Demo Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Record a 3-5 minute video</p>
                    <p className="text-xs text-muted-foreground">Show the key features built this sprint</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Demonstrate user flows</p>
                    <p className="text-xs text-muted-foreground">Walk through the main user journey</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Upload to YouTube/Loom</p>
                    <p className="text-xs text-muted-foreground">Unlisted links work best</p>
                  </div>
                </div>
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Your mentor will review the demo during the sprint review session.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="evidence">
          <Card data-tour="cf-sprint-evidence-content">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Evidence Locker
              </CardTitle>
              <CardDescription>
                Automated collection of PRs, CI runs, and other development artifacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evidenceLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : evidence && evidence.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {evidence.map((item) => (
                      <Card key={item.id} className="hover-elevate" data-testid={`card-evidence-${item.id}`}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${
                              item.type === "PR" ? "bg-primary/10 text-primary border border-primary/30" :
                              item.type === "CI" ? "bg-green-100 text-green-600" :
                              item.type === "Demo" ? "bg-blue-100 text-blue-600" :
                              "bg-gray-100 text-muted-foreground"
                            }`}>
                              {getEvidenceIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{item.type}</Badge>
                                <p className="font-medium text-sm truncate">{item.title}</p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatDateTime(item.createdAt)}</span>
                                {item.submitterName && (
                                  <span className="flex items-center gap-1">
                                    <span>•</span>
                                    {item.submitterName}
                                  </span>
                                )}
                              </div>
                              {Boolean((item.metaJson as any)?.notes) && (
                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {(item.metaJson as any).notes}
                                </p>
                              )}
                            </div>
                            {item.url && (
                              <a
                                href="#"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  const url = item.url!;
                                  if (url.includes('.amazonaws.com')) {
                                    const objectKey = (item.metaJson as any)?.attachments?.[0]?.objectKey;
                                    if (objectKey) {
                                      try {
                                        const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey });
                                        window.open(resp.fileUrl, "_blank"); return;
                                      } catch {}
                                    }
                                  }
                                  window.open(url, "_blank");
                                }}
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No evidence collected yet for this sprint.</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Evidence is automatically captured when you create PRs, run CI, or upload demos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card data-tour="cf-sprint-resources-content">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5" />
                    Sprint Resources
                  </CardTitle>
                  <CardDescription>
                    Docs, decks, datasets, and any other files the team should have for this sprint
                  </CardDescription>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2 shrink-0">
                    <ObjectUploader
                      acceptedTypes=""
                      title="Upload Resource"
                      fileTypeLabel="file"
                      maxFileSize={104857600}
                      onGetUploadParameters={async () => {
                        const resp = await apiRequest("POST", "/api/objects/upload", {});
                        return { method: "PUT" as const, url: resp.uploadURL, objectKey: resp.objectKey };
                      }}
                      getViewUrlEndpoint="/api/objects/view-url"
                      onComplete={(_fileUrl, objectKey, fileName, fileSize, contentType) => {
                        if (!objectKey || !fileName) return;
                        addSprintResourceMutation.mutate({ fileName, objectKey, fileSize, contentType });
                      }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid="button-upload-sprint-resource"
                      >
                        <Paperclip className="mr-2 h-4 w-4" />
                        Upload Document
                      </Button>
                    </ObjectUploader>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddResourceLinkDialog(true)}
                      data-testid="button-add-sprint-resource-link"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Add Link
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {sprintResourcesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : sprintResources && sprintResources.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {sprintResources.map((item) => {
                      const canRemove = canEdit || item.uploadedById === user?.id;
                      return (
                        <Card key={item.id} className="hover-elevate" data-testid={`card-resource-${item.id}`}>
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-primary/10 text-primary border border-primary/30">
                                {item.type === "link" ? <Link2 className="h-4 w-4" /> : <File className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.fileName}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatDateTime(item.createdAt)}</span>
                                  {item.uploaderName && (
                                    <span className="flex items-center gap-1">
                                      <span>•</span>
                                      {item.uploaderName}
                                    </span>
                                  )}
                                  {item.fileSize ? (
                                    <span className="flex items-center gap-1">
                                      <span>•</span>
                                      {formatResourceFileSize(item.fileSize)}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="shrink-0"
                                onClick={() =>
                                  item.type === "link" && item.url
                                    ? window.open(item.url, "_blank")
                                    : downloadSprintResource(item.objectKey!, item.fileName)
                                }
                                data-testid={`button-download-resource-${item.id}`}
                              >
                                {item.type === "link" ? (
                                  <ExternalLink className="h-4 w-4" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                              {canRemove && (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="shrink-0"
                                  onClick={() => deleteSprintResourceMutation.mutate(item.id)}
                                  data-testid={`button-delete-resource-${item.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12">
                  <Paperclip className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No resources uploaded yet for this sprint.</p>
                  {canEdit && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Use "Upload Document" or "Add Link" above to share docs, decks, datasets, or links with your team.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={showAddResourceLinkDialog}
        onOpenChange={(open) => (open ? setShowAddResourceLinkDialog(true) : resetAddResourceLinkDialog())}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a Link</DialogTitle>
            <DialogDescription>Share a link to a doc, deck, or dataset instead of uploading a file</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={resourceLinkTitle}
                onChange={(e) => setResourceLinkTitle(e.target.value)}
                placeholder="e.g. Product Requirements Doc"
                data-testid="input-resource-link-title"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={resourceLinkUrl}
                onChange={(e) => setResourceLinkUrl(e.target.value)}
                placeholder="https://..."
                data-testid="input-resource-link-url"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAddResourceLinkDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddResourceLink}
              disabled={addSprintResourceMutation.isPending}
              data-testid="button-submit-resource-link"
            >
              {addSprintResourceMutation.isPending ? "Adding..." : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-6">
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>Create a new task for the current sprint</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 -mr-1">
            <div className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Title</Label>
              <Input
                id="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
                data-testid="input-task-title"
                aria-invalid={newTaskTitleError !== null && taskTitle.trim() !== ""}
              />
              {taskTitle.trim() !== "" && newTaskTitleError !== null && (
                <p className="text-xs text-destructive">{newTaskTitleError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe the task..."
                data-testid="input-task-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as "LOW" | "MEDIUM" | "HIGH")}>
                <SelectTrigger data-testid="select-task-priority">
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
              <Label>Assignee <span className="text-muted-foreground text-xs font-normal">(optional — can be assigned later)</span></Label>
              <TeamMemberMultiSelect
                members={assignableMembers}
                selected={taskAssigneeIds}
                onChange={setTaskAssigneeIds}
                loading={selectedTeamDetailsLoading}
                testId="select-task-assignees"
              />
              {taskAssigneeIds.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Leave empty to create the task unassigned — an admin or mentor can assign it later.
                </p>
              )}
            </div>
              <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taskStartDate">Start Date *</Label>
                <Input
                  id="taskStartDate"
                  type="date"
                  value={taskStartDate}
                  onChange={(e) => setTaskStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskEndDate">End Date *</Label>
                <Input
                  id="taskEndDate"
                  type="date"
                  value={taskEndDate}
                  onChange={(e) => setTaskEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskObjectives">Objectives (optional)</Label>
              <Textarea
                id="taskObjectives"
                value={taskObjectives}
                onChange={(e) => setTaskObjectives(e.target.value)}
                placeholder="What are the objectives of this task?"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDeliverables">Deliverables (optional)</Label>
              <Textarea
                id="taskDeliverables"
                value={taskDeliverables}
                onChange={(e) => setTaskDeliverables(e.target.value)}
                placeholder="What are the expected deliverables?"
                rows={2}
              />
            </div>
            </div>
          </div>
          <DialogFooter className="shrink-0 border-t border-border pt-4 mt-2">
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createTaskMutation.mutate({
                title: taskTitle,
                description: taskDescription,
                objectives: taskObjectives || undefined,
                deliverables: taskDeliverables || undefined,
                startDate: taskStartDate || undefined,
                endDate: taskEndDate || undefined,
                dependencies: taskDependencies.length > 0 ? taskDependencies : undefined,
                priority: taskPriority,
                assigneeIds: taskAssigneeIds.length > 0 ? taskAssigneeIds.map((id) => String(id)) : undefined,
              })}
              // Assignee is deliberately not required: a task can be created now and
              // assigned later by an admin or mentor.
              disabled={newTaskTitleError !== null || !taskStartDate || !taskEndDate || createTaskMutation.isPending || !canEdit}
              data-testid="button-submit-task"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showStandupDialog} onOpenChange={setShowStandupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Daily Standup</DialogTitle>
            <DialogDescription>Record your daily progress update</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="yesterday">What did you accomplish yesterday?</Label>
              <Textarea
                id="yesterday"
                value={standupYesterday}
                onChange={(e) => setStandupYesterday(e.target.value)}
                placeholder="Completed user authentication..."
                data-testid="input-standup-yesterday"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="today">What will you work on today?</Label>
              <Textarea
                id="today"
                value={standupToday}
                onChange={(e) => setStandupToday(e.target.value)}
                placeholder="Building dashboard components..."
                data-testid="input-standup-today"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockers">Any blockers? (optional)</Label>
              <Textarea
                id="blockers"
                value={standupBlockers}
                onChange={(e) => setStandupBlockers(e.target.value)}
                placeholder="Waiting for API documentation..."
                data-testid="input-standup-blockers"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStandupDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createStandupMutation.mutate({
                yesterday: standupYesterday,
                today: standupToday,
                blockers: standupBlockers || null,
              })}
              disabled={!standupYesterday || !standupToday || createStandupMutation.isPending}
              data-testid="button-submit-standup"
            >
              {createStandupMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : "Log Standup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDemoDialog} onOpenChange={(open) => {
        setShowDemoDialog(open);
        if (!open) {
          setShowDemoUploadMode("url");
          setDemoUrl("");
          setDemoNotes("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Upload Sprint Demo
            </DialogTitle>
            <DialogDescription>Add a link to your demo video or upload a file directly</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={showDemoUploadMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDemoUploadMode("url")}
                data-testid="button-demo-url-mode"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Link
              </Button>
              <Button
                variant={showDemoUploadMode === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDemoUploadMode("file")}
                data-testid="button-demo-file-mode"
              >
                <FileVideo className="h-4 w-4 mr-1" />
                Upload File
              </Button>
            </div>

            {showDemoUploadMode === "url" ? (
              <div className="space-y-2">
                <Label htmlFor="demoUrl">Demo URL</Label>
                <Input
                  id="demoUrl"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  data-testid="input-demo-url"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Upload Demo Video</Label>
                <ObjectUploader
                  onGetUploadParameters={getUploadURL}
                  onComplete={(uploadedUrl) => {
                    setDemoUrl(uploadedUrl);
                    toast({ title: "File uploaded", description: "Now click Save Demo to complete" });
                  }}
                  buttonVariant="outline"
                  buttonClassName="w-full h-20 border-dashed"
                  acceptedTypes="video/*"
                  maxFileSize={104857600}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-5 w-5" />
                    <span>{demoUrl ? "File Ready" : "Click to upload video"}</span>
                  </div>
                </ObjectUploader>
                {demoUrl && showDemoUploadMode === "file" && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Video uploaded and ready to save
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="demoNotes">Notes (optional)</Label>
              <Textarea
                id="demoNotes"
                value={demoNotes}
                onChange={(e) => setDemoNotes(e.target.value)}
                placeholder="Key features shown in this demo..."
                data-testid="input-demo-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDemoDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (showDemoUploadMode === "file") {
                  uploadDemoMutation.mutate({ demoUrl, demoNotes });
                } else {
                  updateDemoMutation.mutate({ demoUrl, demoNotes });
                }
              }}
              disabled={!demoUrl || updateDemoMutation.isPending || uploadDemoMutation.isPending}
              data-testid="button-submit-demo"
            >
              {(updateDemoMutation.isPending || uploadDemoMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : "Save Demo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateSprintDialog
        open={showSprintDialog}
        onOpenChange={setShowSprintDialog}
        values={sprintForm}
        onChange={setSprintForm}
        isPending={createSprintMutation.isPending}
        idPrefix="sprint-board"
        resources={sprintResourcesForm}
        onResourcesChange={setSprintResourcesForm}
        onSubmit={() =>
          createSprintMutation.mutate({
            name: sprintForm.name.trim(),
            startDate: sprintForm.startDate,
            endDate: sprintForm.endDate,
            goals: sprintForm.goals || undefined,
            objectives: sprintForm.objectives || undefined,
            deliverables: sprintForm.deliverables || undefined,
            resources: sprintResourcesForm,
          })
        }
      />

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
              <Label>Attachments (optional)</Label>
              <p className="text-sm text-muted-foreground mb-2">Upload images, videos or documents as proof</p>
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
              disabled={!evidenceTitle || !evidenceUrl || updateTaskMutation.isPending || createEvidenceMutation.isPending}
            >
              {(updateTaskMutation.isPending || createEvidenceMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
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

      {/* Delete Sprint Confirmation Dialog */}
      <Dialog open={showDeleteSprintConfirm} onOpenChange={setShowDeleteSprintConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Sprint {effectiveSprintData?.sprint?.index}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the sprint and all its tasks. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteSprintConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteSprintMutation.mutate()}
              disabled={deleteSprintMutation.isPending}
            >
              {deleteSprintMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Sprint
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Dialog — admins and mentors assign straight from the card */}
      <Dialog
        open={showAssignDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAssignDialog(false);
            setAssigningTask(null);
            setAssignStartDate("");
            setAssignEndDate("");
          }
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden p-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign Task
            </DialogTitle>
            <DialogDescription className="break-words">
              {assigningTask?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            <Label>Team members</Label>
            <TeamMemberMultiSelect
              members={assignableMembers}
              selected={assignIds}
              onChange={setAssignIds}
              emptyMessage="No assignable team members found"
              testId="select-assign-members"
            />
            {/* Assigning and scheduling are the same moment in practice — a task generated
                from a programme plan arrives with no dates, and making the mentor reopen it
                in Edit just to add them is a pointless second step. */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <Label htmlFor="assign-start-date">Start Date</Label>
                <Input
                  id="assign-start-date"
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  data-testid="input-assign-start-date"
                />
              </div>
              <div>
                <Label htmlFor="assign-end-date">End Date</Label>
                <Input
                  id="assign-end-date"
                  type="date"
                  min={assignStartDate || undefined}
                  value={assignEndDate}
                  onChange={(e) => setAssignEndDate(e.target.value)}
                  data-testid="input-assign-end-date"
                />
              </div>
            </div>
            {assignStartDate && assignEndDate && assignEndDate < assignStartDate && (
              <p className="text-xs text-destructive">End date is before the start date.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Mentors and admins are not listed — they assign tasks rather than receive them.
              Pick more than one to share the task; each assignee submits their own evidence.
            </p>
          </div>

          <DialogFooter className="shrink-0 pt-4">
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!assigningTask) return;
                assignTaskMutation.mutate({
                  taskId: assigningTask.id,
                  assigneeIds: assignIds,
                  startDate: assignStartDate || null,
                  endDate: assignEndDate || null,
                });
              }}
              disabled={
                assignTaskMutation.isPending ||
                Boolean(assignStartDate && assignEndDate && assignEndDate < assignStartDate)
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {assignTaskMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : assignIds.length === 0 ? "Unassign" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloseSprintDialog
        sprintId={effectiveSprintData?.sprint?.id ?? null}
        open={showCloseSprint}
        onOpenChange={setShowCloseSprint}
      />

      {/* Edit Sprint Dialog */}
      <Dialog open={showEditSprintDialog} onOpenChange={setShowEditSprintDialog}>
        {/* Seven fields, three of them textareas. Without an explicit max height and a scrolling
            body this runs past the bottom of a short viewport and takes Save Changes with it. */}
        <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>Edit Sprint {effectiveSprintData?.sprint?.index}</DialogTitle>
            <DialogDescription>Update the name, goals, objectives, deliverables, and dates for this sprint.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <div>
              <Label htmlFor="edit-sprint-name">Sprint Name</Label>
              <Input
                id="edit-sprint-name"
                value={editSprintName}
                onChange={(e) => setEditSprintName(e.target.value)}
                placeholder="e.g. Research & problem framing"
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="edit-sprint-index">Sprint Number *</Label>
                <Input
                  id="edit-sprint-index"
                  type="number"
                  min={1}
                  value={editSprintIndex}
                  onChange={(e) => setEditSprintIndex(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label htmlFor="edit-sprint-start">Start Date *</Label>
                <Input
                  id="edit-sprint-start"
                  type="date"
                  value={editSprintStartDate}
                  onChange={(e) => setEditSprintStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-sprint-end">End Date *</Label>
                <Input
                  id="edit-sprint-end"
                  type="date"
                  value={editSprintEndDate}
                  onChange={(e) => setEditSprintEndDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-sprint-goals">Goals</Label>
              <Textarea
                id="edit-sprint-goals"
                value={editSprintGoals}
                onChange={(e) => setEditSprintGoals(e.target.value)}
                placeholder="What should be achieved in this sprint?"
                className="min-h-[80px]"
              />
            </div>
            <div>
              <Label htmlFor="edit-sprint-objectives">Objectives</Label>
              <Textarea
                id="edit-sprint-objectives"
                value={editSprintObjectives}
                onChange={(e) => setEditSprintObjectives(e.target.value)}
                placeholder="Specific measurable objectives..."
                className="min-h-[80px]"
              />
            </div>
            <div>
              <Label htmlFor="edit-sprint-deliverables">Deliverables</Label>
              <Textarea
                id="edit-sprint-deliverables"
                value={editSprintDeliverables}
                onChange={(e) => setEditSprintDeliverables(e.target.value)}
                placeholder="Expected outputs and deliverables..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-4">
            <Button variant="outline" onClick={() => setShowEditSprintDialog(false)}>Cancel</Button>
            <Button
              onClick={() =>
                updateSprintMutation.mutate({
                  index: editSprintIndex,
                  name: editSprintName.trim(),
                  goals: editSprintGoals || undefined,
                  objectives: editSprintObjectives || undefined,
                  deliverables: editSprintDeliverables || undefined,
                  startDate: editSprintStartDate || undefined,
                  endDate: editSprintEndDate || undefined,
                })
              }
              disabled={!editSprintStartDate || !editSprintEndDate || updateSprintMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {updateSprintMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sprint Report + export — passed sprints only, restricted roles */}
      <SprintExportDialog
        sprintId={exportSprintId}
        open={showSprintExportDialog}
        onOpenChange={(open) => {
          setShowSprintExportDialog(open);
          if (!open) setExportSprintId(null);
        }}
      />

      {/* View Sprint Details Dialog — read-only, every team member */}
      <Dialog
        open={showSprintDetailsDialog}
        onOpenChange={(open) => {
          setShowSprintDetailsDialog(open);
          if (!open) setDetailsSprintId(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sprint {sprintDetails?.index ?? effectiveSprintData?.sprint?.index}
              {sprintDetails?.name ? `: ${sprintDetails.name}` : ""} Details
            </DialogTitle>
            <DialogDescription>
              Everything recorded for this sprint, including objectives and deliverables.
            </DialogDescription>
          </DialogHeader>

          {/* Scrolls, rather than being clipped by the overflow-hidden above. */}
          <div className="flex-1 overflow-y-auto pr-1">

          {sprintDetailsLoading && (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading sprint...</div>
          )}

          {!sprintDetailsLoading && !sprintDetails && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Could not load this sprint.
            </div>
          )}

          {!sprintDetailsLoading && sprintDetails && (
            <div className="space-y-5 text-sm overflow-y-auto max-h-[65vh] pr-1">
              {/* Status + dates */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Status</p>
                  {sprintDetails.passed === true ? (
                    <Badge className="bg-green-500">Passed</Badge>
                  ) : sprintDetails.passed === false ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : (
                    <Badge variant="secondary">In Progress</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Start</p>
                  <p>{sprintDetails.startDate ? new Date(sprintDetails.startDate).toLocaleDateString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">End</p>
                  <p>{sprintDetails.endDate ? new Date(sprintDetails.endDate).toLocaleDateString() : "—"}</p>
                </div>
              </div>

              {/* Goals / Objectives / Deliverables — the point of this dialog */}
              <div className="space-y-3 pt-1 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Goals</p>
                  <p className="whitespace-pre-wrap break-words">
                    {sprintDetails.goals || <span className="text-muted-foreground">Not set</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Objectives</p>
                  <p className="whitespace-pre-wrap break-words">
                    {sprintDetails.objectives || <span className="text-muted-foreground">Not set</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Deliverables</p>
                  <p className="whitespace-pre-wrap break-words">
                    {sprintDetails.deliverables || <span className="text-muted-foreground">Not set</span>}
                  </p>
                </div>
              </div>

              {/* Tasks */}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Tasks ({sprintDetails.tasks?.length ?? 0})
                </p>
                {sprintDetails.tasks?.length ? (
                  <ul className="space-y-1">
                    {sprintDetails.tasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2">
                        <span className="break-words">{t.title}</span>
                        <Badge variant="outline" className="shrink-0">
                          {String(t.status).replace("_", " ")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No tasks yet.</p>
                )}
              </div>

              {/* Demo */}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-1">Demo</p>
                {sprintDetails.demoUrl || sprintDetails.demoNotes ? (
                  <div className="space-y-1">
                    {sprintDetails.demoUrl && (
                      <a
                        href={sprintDetails.demoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline break-all"
                      >
                        {sprintDetails.demoUrl}
                      </a>
                    )}
                    {sprintDetails.demoNotes && (
                      <p className="whitespace-pre-wrap break-words">{sprintDetails.demoNotes}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not submitted.</p>
                )}
              </div>

              {/* Mentor reviews */}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Mentor reviews ({sprintDetails.reviews?.length ?? 0})
                </p>
                {sprintDetails.reviews?.length ? (
                  <div className="space-y-3">
                    {sprintDetails.reviews.map((r) => (
                      <div key={r.id} className="rounded-md border border-border p-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium">{r.mentorName || "Mentor"}</span>
                          {r.score != null && <Badge variant="outline">Score {r.score}</Badge>}
                        </div>
                        {r.notes && <p className="whitespace-pre-wrap break-words">{r.notes}</p>}
                        {r.rubricJson && typeof r.rubricJson === "object" && (
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {Object.entries(r.rubricJson as Record<string, unknown>).map(([k, v]) => (
                              <div key={k} className="flex justify-between gap-2">
                                <span className="text-muted-foreground capitalize">
                                  {k.replace(/([A-Z])/g, " $1").trim()}
                                </span>
                                <span>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Not reviewed yet.</p>
                )}
              </div>

              {/* Standups */}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Standups ({sprintDetails.standups?.length ?? 0})
                </p>
                {sprintDetails.standups?.length ? (
                  <div className="space-y-2">
                    {sprintDetails.standups.map((s) => (
                      <div key={s.id} className="rounded-md border border-border p-2 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{s.authorName || "Team member"}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {s.yesterday && <p><span className="text-muted-foreground">Yesterday: </span>{s.yesterday}</p>}
                        {s.today && <p><span className="text-muted-foreground">Today: </span>{s.today}</p>}
                        {s.blockers && <p><span className="text-muted-foreground">Blockers: </span>{s.blockers}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No standups logged.</p>
                )}
              </div>

              {/* Evidence */}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Evidence ({sprintDetails.evidence?.length ?? 0})
                </p>
                {sprintDetails.evidence?.length ? (
                  <ul className="space-y-1">
                    {sprintDetails.evidence.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline break-all"
                        >
                          {e.title || e.url}
                        </a>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {e.type}{e.submitterName ? ` · ${e.submitterName}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No evidence submitted.</p>
                )}
              </div>

              {/* Resources */}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground font-medium mb-2">
                  Resources ({sprintDetails.resources?.length ?? 0})
                </p>
                {sprintDetails.resources?.length ? (
                  <ul className="space-y-1">
                    {sprintDetails.resources.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            r.type === "link" && r.url
                              ? window.open(r.url, "_blank")
                              : downloadSprintResource(r.objectKey!, r.fileName)
                          }
                          className="text-primary underline break-all text-left"
                          data-testid={`link-details-resource-${r.id}`}
                        >
                          {r.fileName}
                        </button>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatResourceFileSize(r.fileSize)}{r.uploaderName ? ` · ${r.uploaderName}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No resources uploaded.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSprintDetailsDialog(false)}>Close</Button>
          </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Task Detail Dialog */}
      <Dialog open={showViewTaskDialog} onOpenChange={(open) => { if (!open) { setShowViewTaskDialog(false); setViewingTask(null); } }}>
        <DialogContent className="max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Task Details
            </DialogTitle>
          </DialogHeader>
          {viewingTask && (
            <div className="space-y-4 text-sm overflow-y-auto max-h-[60vh] pr-1">
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Title</p>
                <p className="font-semibold break-words">{viewingTask.title}</p>
              </div>
              {viewingTask.description && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Description</p>
                  <p className="text-foreground break-words whitespace-pre-wrap overflow-hidden">{viewingTask.description}</p>
                </div>
              )}
              {/* Objectives hidden on request. Commented rather than deleted: the column and the
                  data are untouched, so restoring this is uncommenting these six lines.
              {viewingTask.objectives && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Objectives</p>
                  <p className="text-foreground break-words whitespace-pre-wrap overflow-hidden">{viewingTask.objectives}</p>
                </div>
              )}
              */}
              {viewingTask.deliverables && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Deliverables</p>
                  <p className="text-foreground break-words whitespace-pre-wrap overflow-hidden">{viewingTask.deliverables}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Status</p>
                  <Badge variant="outline">{viewingTask.status.replace("_", " ")}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Priority</p>
                  <Badge variant={getPriorityColor(viewingTask.priority)}>{viewingTask.priority}</Badge>
                </div>
                {viewingTask.points !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Points</p>
                    <p className="font-medium">{viewingTask.points}</p>
                  </div>
                )}
              </div>
              {/* Always rendered, both halves. The row used to be hidden entirely when neither
                  date was set, so a task generated from a programme plan — which carries no
                  task dates — looked as though it had no schedule at all. "Not set" says
                  which it is, and points at where to fix it. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Start Date</p>
                  <p className={viewingTask.startDate ? "" : "text-muted-foreground"}>
                    {viewingTask.startDate ? formatDate(viewingTask.startDate) : "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">End Date</p>
                  <p className={viewingTask.endDate ? "" : "text-muted-foreground"}>
                    {viewingTask.endDate ? formatDate(viewingTask.endDate) : "Not set"}
                  </p>
                </div>
              </div>
              {!viewingTask.startDate && !viewingTask.endDate && (
                <p className="text-xs text-muted-foreground">
                  No dates yet — an admin or mentor can set them from Assign or Edit.
                </p>
              )}
              {viewingTask.reviewComment && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Review Comment</p>
                  <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded p-2">💬 {viewingTask.reviewComment}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Assigned To</p>
                <div className="flex flex-wrap gap-2">
                  {getTaskAssignees(viewingTask).length > 0 ? (
                    getTaskAssignees(viewingTask).map((member) => (
                      <div key={member.id} className="flex items-center gap-1.5 bg-muted/40 rounded-full px-2 py-0.5">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[9px]">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{member.name}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Not assigned</span>
                  )}
                </div>
                <TaskSubmissionBadge progress={viewingTask.submissionProgress} className="mt-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">Evidence</p>
                {taskEvidenceLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : taskEvidenceItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No evidence submitted for this task.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {taskEvidenceItems.map((ev: any) => (
                      <div key={ev.id} className="border rounded p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{ev.title || ev.type}</div>
                            <div className="text-muted-foreground">
                              {ev.submitterName || ev.submittedBy} · {new Date(ev.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {ev.url && (
                              <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={async () => {
                                const firstKey = ev.metaJson?.attachments?.[0]?.objectKey;
                                if (ev.url.includes('.amazonaws.com') && firstKey) {
                                  try {
                                    const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: firstKey });
                                    window.open(resp.fileUrl, "_blank"); return;
                                  } catch {}
                                }
                                window.open(ev.url, "_blank");
                              }}>
                                <ExternalLink className="h-3 w-3 mr-1" />Link
                              </Button>
                            )}
                            {ev.metaJson?.attachments?.length > 0 && (
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={async () => {
                                const a = ev.metaJson.attachments[0];
                                if (a?.objectKey) {
                                  try {
                                    const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: a.objectKey });
                                    window.open(resp.fileUrl, "_blank"); return;
                                  } catch {}
                                }
                                if (a?.url) window.open(a.url, "_blank");
                              }}>
                                <FileText className="h-3 w-3 mr-1" />File
                              </Button>
                            )}
                          </div>
                        </div>
                        {Boolean(ev.metaJson?.notes) && (
                          <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{ev.metaJson.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowViewTaskDialog(false); setViewingTask(null); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {teamId && (
        <ProgrammePlanImport
          open={showPlanImport}
          onOpenChange={setShowPlanImport}
          teamId={teamId}
          teamName={selectedTeamDetails?.team?.name}
        />
      )}

      {/* Edit Task Dialog */}
      <Dialog open={showEditTaskDialog} onOpenChange={(open) => { if (!open) { setShowEditTaskDialog(false); setEditingTask(null); } }}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-6">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update the task details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label htmlFor="edit-task-title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="edit-task-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
                aria-invalid={editTitleError !== null && editTitle.trim() !== ""}
              />
              {/* Shown inline rather than left to the server's 400, because this dialog is
                  prefilled from the stored title. A task saved before titles were validated
                  (issue #258 mentions one titled "-") would otherwise let someone change only
                  the priority and get a confusing title error back on save. */}
              {editTitle.trim() !== "" && editTitleError !== null && (
                <p className="text-xs text-destructive">{editTitleError}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-task-description">Description</Label>
              <Textarea
                id="edit-task-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-task-priority">Priority</Label>
              <Select value={editPriority} onValueChange={(v) => setEditPriority(v as "LOW" | "MEDIUM" | "HIGH")}>
                <SelectTrigger id="edit-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Assign or reassign. This is how a task created unassigned gets an
                owner later — admins and mentors with sprint edit permission. */}
            <div className="space-y-1">
              <Label>Assignee</Label>
              <TeamMemberMultiSelect
                members={assignableMembers}
                selected={editAssigneeIds}
                onChange={setEditAssigneeIds}
                testId="select-edit-task-assignees"
              />
              <p className="text-xs text-muted-foreground">
                Select more than one to share the task. Each assignee submits their own evidence.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-task-objectives">Objectives</Label>
              <Textarea
                id="edit-task-objectives"
                value={editObjectives}
                onChange={(e) => setEditObjectives(e.target.value)}
                placeholder="What are the objectives?"
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-task-deliverables">Deliverables</Label>
              <Textarea
                id="edit-task-deliverables"
                value={editDeliverables}
                onChange={(e) => setEditDeliverables(e.target.value)}
                placeholder="What are the deliverables?"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-task-start-date">Start Date</Label>
                <Input
                  id="edit-task-start-date"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-task-end-date">End Date</Label>
                <Input
                  id="edit-task-end-date"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditTaskDialog(false); setEditingTask(null); }}>
              Cancel
            </Button>
            <Button
              disabled={editTitleError !== null || editTaskMutation.isPending}
              onClick={() => {
                if (!editingTask || editTitleError !== null) return;
                editTaskMutation.mutate({
                  taskId: editingTask.id,
                  title: editTitle.trim(),
                  description: editDescription || undefined,
                  priority: editPriority,
                  objectives: editObjectives || undefined,
                  deliverables: editDeliverables || undefined,
                  startDate: editStartDate || undefined,
                  endDate: editEndDate || undefined,
                  assigneeIds: editAssigneeIds,
                });
              }}
            >
              {editTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirm Dialog */}
      <Dialog open={showDeleteConfirmBoard} onOpenChange={(open) => { if (!open) { setShowDeleteConfirmBoard(false); setDeletingTaskIdBoard(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>Are you sure you want to delete this task? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteConfirmBoard(false); setDeletingTaskIdBoard(null); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteTaskMutation.isPending}
              onClick={() => { if (deletingTaskIdBoard) deleteTaskMutation.mutate(deletingTaskIdBoard); }}
            >
              {deleteTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
