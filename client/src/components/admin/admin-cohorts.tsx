import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRoles, compositionRoles, compositionPayload } from "@/hooks/use-roles";
import { CohortCompositionFields } from "@/components/admin/cohort-composition-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Plus,
  Users,
  Calendar,
  ExternalLink,
  Edit,
  Trash2,
  ChevronLeft,
  Video,
  Clock,
  ListTodo,
} from "lucide-react";
import { format, parseISO } from "date-fns";

// Helper functions for 12-hour time format with AM/PM
const convert24to12 = (time24: string): { hour: string; minute: string; period: "AM" | "PM" } => {
  if (!time24) return { hour: "12", minute: "00", period: "AM" };
  const [hours, minutes] = time24.split(":");
  let hour = parseInt(hours, 10);
  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return { hour: hour.toString().padStart(2, "0"), minute: minutes || "00", period };
};

const convert12to24 = (hour: string, minute: string, period: "AM" | "PM"): string => {
  let h = parseInt(hour, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute}`;
};

// Time picker component for 12-hour format with AM/PM
const TimePicker = ({ 
  value, 
  onChange, 
  label, 
  id 
}: { 
  value: string; 
  onChange: (time: string) => void; 
  label: string; 
  id: string;
}) => {
  const { hour, minute, period } = convert24to12(value);
  
  const handleChange = (newHour: string, newMinute: string, newPeriod: "AM" | "PM") => {
    const time24 = convert12to24(newHour, newMinute, newPeriod);
    onChange(time24);
  };
  
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1 mt-1">
        <Select 
          value={hour} 
          onValueChange={(h) => handleChange(h, minute, period)}
        >
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="HH" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0")).map((h) => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="flex items-center px-1">:</span>
        <Select 
          value={minute} 
          onValueChange={(m) => handleChange(hour, m, period)}
        >
          <SelectTrigger className="w-[70px]">
            <SelectValue placeholder="MM" />
          </SelectTrigger>
          <SelectContent>
            {["00", "15", "30", "45"].map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select 
          value={period} 
          onValueChange={(p) => handleChange(hour, minute, p as "AM" | "PM")}
        >
          <SelectTrigger className="w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

/** Body accepted by POST /api/cohorts and PATCH /api/cohorts/:id. */
interface CohortFormPayload {
  name: string;
  startDate: string;
  endDate: string;
  location?: string;
  seats?: number;
  composition?: Record<string, number>;
  isOpenForRegistration?: boolean;
  isActive?: boolean;
}

interface Cohort {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  seats: number | null;
  /** Planned headcount keyed by role code, e.g. { MENTOR: 4, LEARNER: 40 }. */
  composition?: Record<string, number>;
  isActive: boolean | null;
  isOpenForRegistration?: boolean | null;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  cohortId: string;
  problemStatementId: string | null;
  health: string | null;
  memberCount?: number;
  createdAt: string;
}

interface CohortTaskSession {
  id?: string;
  cohortTaskId?: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  meetingLink?: string | null;
  isActive?: boolean;
}

interface CohortTask {
  id: string;
  cohortId: string;
  title: string;
  description: string | null;
  meetingLink: string | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  sessions?: CohortTaskSession[];
}

export default function AdminCohortsPage() {
  const { toast } = useToast();
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showEditTaskDialog, setShowEditTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<CohortTask | null>(null);
  const [showCreateCohortDialog, setShowCreateCohortDialog] = useState(false);
  const [showEditCohortDialog, setShowEditCohortDialog] = useState(false);
  const [cohortToEdit, setCohortToEdit] = useState<Cohort | null>(null);
  const [showAddTeamDialog, setShowAddTeamDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Task form state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskMeetingLink, setTaskMeetingLink] = useState("");
  const [taskStartTime, setTaskStartTime] = useState("");
  const [taskEndTime, setTaskEndTime] = useState("");

  // Cohort form state
  const [cohortName, setCohortName] = useState("");
  const [cohortLocation, setCohortLocation] = useState("");
  const [cohortSeats, setCohortSeats] = useState("100");
  const [showTeamSizeDialog, setShowTeamSizeDialog] = useState(false);
  // Planned headcount per role code; the fields rendered come from the roles table, so a
  // role added by an admin gets an input here without a code change.
  const [cohortComposition, setCohortComposition] = useState<Record<string, string>>({});
  const [cohortStartDate, setCohortStartDate] = useState("");
  const [cohortEndDate, setCohortEndDate] = useState("");
  const [cohortOpenForRegistration, setCohortOpenForRegistration] = useState(true);
  const [cohortIsActive, setCohortIsActive] = useState(true);

  // Add state for managing sessions
  const [sessions, setSessions] = useState<CohortTaskSession[]>([]);

  // Fetch all cohorts
  const { data: cohorts = [], isLoading: cohortsLoading } = useQuery<Cohort[]>({
    queryKey: ["cohorts"],
    queryFn: () => apiRequest("GET", "/api/cohorts"),
  });

  const { data: roles } = useRoles();

  // Fetch teams for selected cohort
  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: ["cohort-teams", selectedCohort?.id],
    queryFn: () => apiRequest("GET", `/api/cohorts/${selectedCohort!.id}/teams`),
    enabled: !!selectedCohort,
  });

  // Fetch tasks for selected cohort
  const { data: cohortTasks = [], isLoading: tasksLoading } = useQuery<CohortTask[]>({
    queryKey: ["cohort-tasks", selectedCohort?.id],
    queryFn: () => apiRequest("GET", `/api/cohorts/${selectedCohort!.id}/tasks`),
    enabled: !!selectedCohort,
  });

  // Fetch all teams (for adding teams to cohort)
  const { data: allTeams = [] } = useQuery<Team[]>({
    queryKey: ["all-teams"],
    queryFn: () => apiRequest("GET", "/api/teams"),
  });

  // Filter teams not in current cohort (available to add)
  const availableTeams = allTeams.filter(
    (team) => !selectedCohort || team.cohortId !== selectedCohort.id
  );

  // Add team to cohort mutation
  const addTeamToCohortMutation = useMutation({
    mutationFn: (data: { teamId: string; cohortId: string }) =>
      apiRequest("PATCH", `/api/teams/${data.teamId}`, { cohortId: data.cohortId }),
    onSuccess: () => {
      toast({ title: "Team added to cohort successfully" });
      queryClient.invalidateQueries({ queryKey: ["cohort-teams", selectedCohort?.id] });
      queryClient.invalidateQueries({ queryKey: ["all-teams"] });
      setShowAddTeamDialog(false);
      setSelectedTeamId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add team to cohort", description: error.message, variant: "destructive" });
    },
  });

  // Create cohort mutation
  const createCohortMutation = useMutation({
    mutationFn: (data: CohortFormPayload) => apiRequest("POST", "/api/cohorts", data),
    onSuccess: () => {
      toast({ title: "Cohort created successfully" });
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      setShowCreateCohortDialog(false);
      resetCohortForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create cohort", description: error.message, variant: "destructive" });
    },
  });

  // Create session mutation
  const createTaskMutation = useMutation({
    mutationFn: (data: { cohortId: string; title: string; description?: string; meetingLink?: string; startTime: string; endTime: string; sessions?: CohortTaskSession[] }) =>
      apiRequest("POST", "/api/cohort-tasks", data),
    onSuccess: () => {
      toast({ title: "Session created successfully", description: "All teams in this cohort will see this session." });
      queryClient.invalidateQueries({ queryKey: ["cohort-tasks", selectedCohort?.id] });
      setShowCreateTaskDialog(false);
      resetTaskForm();
      setSessions([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to create session", description: error.message, variant: "destructive" });
    },
  });

  // Update session mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CohortTask> & { sessions?: CohortTaskSession[] } }) =>
      apiRequest("PUT", `/api/cohort-tasks/${id}`, data),
    onSuccess: () => {
      toast({ title: "Session updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["cohort-tasks", selectedCohort?.id] });
      setShowEditTaskDialog(false);
      setEditingTask(null);
      resetTaskForm();
      setSessions([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update session", description: error.message, variant: "destructive" });
    },
  });

  // Delete session mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/cohort-tasks/${id}`),
    onSuccess: () => {
      toast({ title: "Session deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["cohort-tasks", selectedCohort?.id] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete session", description: error.message, variant: "destructive" });
    },
  });

  // Delete cohort mutation
  const deleteCohortMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/cohorts/${id}`),
    onSuccess: () => {
      toast({ title: "Cohort deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
      setSelectedCohort(null);
      setShowDeleteCohortDialog(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete cohort", description: error.message, variant: "destructive" });
    },
  });

  // Update cohort mutation
  const updateCohortMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CohortFormPayload }) =>
      apiRequest("PATCH", `/api/cohorts/${id}`, data),
    onSuccess: () => {
      toast({ title: "Cohort updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
      setShowEditCohortDialog(false);
      setCohortToEdit(null);
      resetCohortForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to update cohort", description: error.message, variant: "destructive" });
    },
  });

  // State for delete cohort confirmation dialog
  const [showDeleteCohortDialog, setShowDeleteCohortDialog] = useState(false);
  const [cohortToDelete, setCohortToDelete] = useState<typeof selectedCohort>(null);

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskMeetingLink("");
    setTaskStartTime("");
    setTaskEndTime("");
  };

  const resetCohortForm = () => {
    setCohortName("");
    setCohortLocation("");
    setCohortSeats("100");
    setCohortStartDate("");
    setCohortEndDate("");
    setCohortComposition({});
    setCohortOpenForRegistration(true);
    setCohortIsActive(true);
  };

  const openEditCohort = (cohort: Cohort) => {
    setCohortToEdit(cohort);
    setCohortName(cohort.name);
    setCohortLocation(cohort.location ?? "");
    setCohortSeats(String(cohort.seats ?? 100));
    setCohortComposition(
      Object.fromEntries(
        Object.entries(cohort.composition ?? {}).map(([code, count]) => [code, String(count)])
      )
    );
    setCohortStartDate(cohort.startDate ? String(cohort.startDate).slice(0, 10) : "");
    setCohortEndDate(cohort.endDate ? String(cohort.endDate).slice(0, 10) : "");
    setCohortOpenForRegistration(cohort.isOpenForRegistration ?? true);
    setCohortIsActive(cohort.isActive ?? true);
    setShowEditCohortDialog(true);
  };

  const handleUpdateCohort = () => {
    if (!cohortToEdit || !cohortName || !cohortStartDate || !cohortEndDate) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    updateCohortMutation.mutate({
      id: cohortToEdit.id,
      data: {
        name: cohortName,
        startDate: cohortStartDate,
        endDate: cohortEndDate,
        location: cohortLocation || undefined,
        seats: parseInt(cohortSeats, 10) || 100,
        composition: compositionPayload(cohortComposition),
        isActive: cohortIsActive,
      },
    });
  };

  const handleCreateTask = () => {
    if (!selectedCohort || !taskTitle || !taskStartTime || !taskEndTime) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    // The datetime-local input gives us "YYYY-MM-DDTHH:MM" which is local time
    // Create a Date object from the local time string, which JS interprets as local
    // Then convert to ISO string which includes proper timezone info
    const startDate = new Date(taskStartTime);
    const endDate = new Date(taskEndTime);

    createTaskMutation.mutate({
      cohortId: selectedCohort.id,
      title: taskTitle,
      description: taskDescription || undefined,
      meetingLink: taskMeetingLink || undefined,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      sessions: sessions.length > 0 ? sessions : undefined,
    });
  };

  const handleUpdateTask = () => {
    if (!editingTask || !taskTitle || !taskStartTime || !taskEndTime) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    // Convert to proper ISO string with timezone
    const startDate = new Date(taskStartTime);
    const endDate = new Date(taskEndTime);

    updateTaskMutation.mutate({
      id: editingTask.id,
      data: {
        title: taskTitle,
        description: taskDescription || null,
        meetingLink: taskMeetingLink || null,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        sessions: sessions,
      },
    });
  };

  const handleEditTask = (task: CohortTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || "");
    setTaskMeetingLink(task.meetingLink || "");
    
    // Convert UTC ISO string to local datetime-local format
    // The datetime-local input expects "YYYY-MM-DDTHH:MM" in local time
    const formatToLocalDatetimeInput = (isoString: string) => {
      const date = new Date(isoString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setTaskStartTime(formatToLocalDatetimeInput(task.startTime));
    setTaskEndTime(formatToLocalDatetimeInput(task.endTime));
    
    // Load existing sessions if available
    if (task.sessions && task.sessions.length > 0) {
      setSessions(task.sessions.map(s => ({
        startDate: s.startDate ? s.startDate.slice(0, 10) : "",
        endDate: s.endDate ? s.endDate.slice(0, 10) : "",
        startTime: s.startTime || "",
        endTime: s.endTime || "",
        meetingLink: s.meetingLink || "",
      })));
    } else {
      setSessions([]);
    }
    setShowEditTaskDialog(true);
  };

  const handleCreateCohort = () => {
    if (!cohortName || !cohortStartDate || !cohortEndDate) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createCohortMutation.mutate({
      name: cohortName,
      startDate: cohortStartDate,
      endDate: cohortEndDate,
      location: cohortLocation || undefined,
      seats: parseInt(cohortSeats) || 100,
      composition: compositionPayload(cohortComposition),
      isOpenForRegistration: cohortOpenForRegistration,
    });
  };

  // Function to add a new session
  const addSession = () => {
    setSessions([...sessions, { startDate: "", endDate: "", startTime: "", endTime: "" }]);
  };

  // Function to update a session
  const updateSession = (index: number, field: string, value: string) => {
    const updatedSessions = [...sessions];
    updatedSessions[index] = { ...updatedSessions[index], [field]: value };
    setSessions(updatedSessions);
  };

  // Function to remove a session
  const removeSession = (index: number) => {
    const updatedSessions = sessions.filter((_, i) => i !== index);
    setSessions(updatedSessions);
  };

  // Function to check if any session time slot is currently active
  const getActiveSession = (task: CohortTask): { isActive: boolean; meetingLink: string | null } => {
    const now = new Date();
    
    // If the task has sessions, check each one
    if (task.sessions && task.sessions.length > 0) {
      for (const session of task.sessions) {
        const sessionStartDate = new Date(session.startDate);
        const sessionEndDate = new Date(session.endDate);
        
        // Check if current date is within session date range
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startDateOnly = new Date(sessionStartDate.getFullYear(), sessionStartDate.getMonth(), sessionStartDate.getDate());
        const endDateOnly = new Date(sessionEndDate.getFullYear(), sessionEndDate.getMonth(), sessionEndDate.getDate());
        
        if (currentDate >= startDateOnly && currentDate <= endDateOnly) {
          // Check if current time is within session time range
          const currentTime = now.getHours() * 60 + now.getMinutes();
          const [startHour, startMin] = (session.startTime || "00:00").split(":").map(Number);
          const [endHour, endMin] = (session.endTime || "23:59").split(":").map(Number);
          const sessionStartTime = startHour * 60 + startMin;
          const sessionEndTime = endHour * 60 + endMin;
          
          if (currentTime >= sessionStartTime && currentTime <= sessionEndTime) {
            return { 
              isActive: true, 
              meetingLink: session.meetingLink || task.meetingLink 
            };
          }
        }
      }
      return { isActive: false, meetingLink: null };
    }
    
    // Fall back to default task times if no sessions
    const startTime = new Date(task.startTime);
    const endTime = new Date(task.endTime);
    const isActive = startTime <= now && endTime >= now;
    return { isActive, meetingLink: isActive ? task.meetingLink : null };
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
    } catch {
      return dateStr;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  // Show cohort list
  if (!selectedCohort) {
    return (
      <AppLayout title="Cohorts">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Cohorts</h1>
              <p className="text-muted-foreground">Manage cohorts and assign tasks to all teams</p>
            </div>
            <Button onClick={() => setShowCreateCohortDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Cohort
            </Button>
          </div>

          {cohortsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : cohorts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No cohorts yet</h3>
                <p className="text-muted-foreground mb-4">Create your first cohort to get started</p>
                <Button onClick={() => setShowCreateCohortDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Cohort
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cohorts.map((cohort) => (
                <Card
                  key={cohort.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedCohort(cohort)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{cohort.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCohort(cohort);
                          }}
                          title="Edit cohort"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Badge variant={cohort.isActive ? "default" : "secondary"}>
                          {cohort.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {cohort.location && <span>{cohort.location} • </span>}
                      {cohort.seats} seats
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCohort(cohort);
                          setShowCreateTaskDialog(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Session
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCohortToDelete(cohort);
                          setShowDeleteCohortDialog(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Delete Cohort Confirmation Dialog */}
        <Dialog open={showDeleteCohortDialog} onOpenChange={setShowDeleteCohortDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Cohort</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{cohortToDelete?.name}"? This action cannot be undone and will also delete all associated sessions and user assignments.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteCohortDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => cohortToDelete && deleteCohortMutation.mutate(cohortToDelete.id)}
                disabled={deleteCohortMutation.isPending}
              >
                {deleteCohortMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Cohort"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Cohort Dialog */}
        <Dialog open={showCreateCohortDialog} onOpenChange={setShowCreateCohortDialog}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Cohort</DialogTitle>
              <DialogDescription>
                Create a new cohort to organize teams and interns
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cohort-name">Cohort Name *</Label>
                <Input
                  id="cohort-name"
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  placeholder="e.g., Cohort 2026 Q1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cohort-start">Start Date *</Label>
                  <Input
                    id="cohort-start"
                    type="date"
                    value={cohortStartDate}
                    onChange={(e) => setCohortStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cohort-end">End Date *</Label>
                  <Input
                    id="cohort-end"
                    type="date"
                    value={cohortEndDate}
                    onChange={(e) => setCohortEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cohort-location">Location</Label>
                <Input
                  id="cohort-location"
                  value={cohortLocation}
                  onChange={(e) => setCohortLocation(e.target.value)}
                  placeholder="e.g., Bangalore"
                />
              </div>
              <div>
                <Label htmlFor="cohort-seats">Number of Seats</Label>
                <Input
                  id="cohort-seats"
                  type="number"
                  value={cohortSeats}
                  onChange={(e) => setCohortSeats(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Cohort Composition</Label>
                <p className="text-sm text-muted-foreground">Totals for the entire cohort.</p>
                <CohortCompositionFields
                  roles={roles}
                  values={cohortComposition}
                  onChange={setCohortComposition}
                  idPrefix="cohort-create"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Open for Registration</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow interns to select this cohort when applying
                  </p>
                </div>
                <Switch
                  checked={cohortOpenForRegistration}
                  onCheckedChange={setCohortOpenForRegistration}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCohortDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCohort} disabled={createCohortMutation.isPending}>
                {createCohortMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Cohort
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Cohort Dialog */}
        <Dialog open={showEditCohortDialog} onOpenChange={(open) => { setShowEditCohortDialog(open); if (!open) setCohortToEdit(null); }}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Cohort</DialogTitle>
              <DialogDescription>
                Update cohort details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-cohort-name">Cohort Name *</Label>
                <Input
                  id="edit-cohort-name"
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  placeholder="e.g., Cohort 2026 Q1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-cohort-start">Start Date *</Label>
                  <Input
                    id="edit-cohort-start"
                    type="date"
                    value={cohortStartDate}
                    onChange={(e) => setCohortStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-cohort-end">End Date *</Label>
                  <Input
                    id="edit-cohort-end"
                    type="date"
                    value={cohortEndDate}
                    onChange={(e) => setCohortEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-cohort-location">Location</Label>
                <Input
                  id="edit-cohort-location"
                  value={cohortLocation}
                  onChange={(e) => setCohortLocation(e.target.value)}
                  placeholder="e.g., Bangalore"
                />
              </div>
              <div>
                <Label htmlFor="edit-cohort-seats">Number of Seats</Label>
                <Input
                  id="edit-cohort-seats"
                  type="number"
                  value={cohortSeats}
                  onChange={(e) => setCohortSeats(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label>Cohort Composition</Label>
                <p className="text-sm text-muted-foreground">Totals for the entire cohort.</p>
                <CohortCompositionFields
                  roles={roles}
                  values={cohortComposition}
                  onChange={setCohortComposition}
                  idPrefix="cohort-edit"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Cohort is active and visible in the system
                  </p>
                </div>
                <Switch
                  checked={cohortIsActive}
                  onCheckedChange={setCohortIsActive}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEditCohortDialog(false); setCohortToEdit(null); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateCohort} disabled={updateCohortMutation.isPending}>
                {updateCohortMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Cohort
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  // Show selected cohort details
  return (
    <AppLayout title={selectedCohort.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedCohort(null)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{selectedCohort.name}</h1>
              <p className="text-muted-foreground">
                {formatDate(selectedCohort.startDate)} - {formatDate(selectedCohort.endDate)}
                {selectedCohort.location && ` • ${selectedCohort.location}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowTeamSizeDialog(true)}>
              <Users className="h-4 w-4 mr-2" />
              Team Size
            </Button>
            <Button onClick={() => setShowCreateTaskDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </div>
        </div>

        {/* Teams Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Teams ({teams.length})
                </CardTitle>
                <CardDescription>
                  Teams in this cohort will receive all cohort sessions
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowAddTeamDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Team
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : teams.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No teams assigned to this cohort yet
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{team.name}</span>
                      <Badge variant={team.health === "G" ? "default" : team.health === "A" ? "secondary" : "destructive"}>
                        {team.health === "G" ? "Good" : team.health === "A" ? "At Risk" : "Red"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {team.memberCount || 0} members
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sessions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Cohort Sessions ({cohortTasks.length})
            </CardTitle>
            <CardDescription>
              Sessions visible to all team members in this cohort
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : cohortTasks.length === 0 ? (
              <div className="text-center py-8">
                <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No sessions created for this cohort yet</p>
                <Button onClick={() => setShowCreateTaskDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Session
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Time Slots</TableHead>
                    <TableHead>Meeting Link</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohortTasks.map((task) => {
                    const now = new Date();
                    const startTime = new Date(task.startTime);
                    const endTime = new Date(task.endTime);
                    const isUpcoming = startTime > now;
                    const isOngoing = startTime <= now && endTime >= now;
                    const isPast = endTime < now;
                    
                    // Check for active session
                    const activeSessionInfo = getActiveSession(task);
                    const hasTimeSlots = task.sessions && task.sessions.length > 0;

                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(task.startTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(task.endTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {hasTimeSlots ? (
                            <Badge variant="outline">{task.sessions!.length} slot{task.sessions!.length > 1 ? 's' : ''}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Default</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {activeSessionInfo.isActive && activeSessionInfo.meetingLink ? (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => window.open(activeSessionInfo.meetingLink!, "_blank")}
                            >
                              <Video className="h-4 w-4 mr-1" />
                              Join Now
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          ) : task.meetingLink ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="opacity-50"
                              >
                                <Video className="h-4 w-4 mr-1" />
                                Not Active
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {activeSessionInfo.isActive ? (
                            <Badge className="bg-green-500">Live</Badge>
                          ) : isOngoing ? (
                            <Badge className="bg-yellow-500">In Window</Badge>
                          ) : isUpcoming ? (
                            <Badge variant="secondary">Upcoming</Badge>
                          ) : (
                            <Badge variant="outline">Past</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTask(task)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this task?")) {
                                deleteTaskMutation.mutate(task.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Size Dialog */}
      <Dialog open={showTeamSizeDialog} onOpenChange={setShowTeamSizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team Size</DialogTitle>
            <DialogDescription>
              Composition declared for {selectedCohort.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {compositionRoles(roles).map((role) => (
                <div key={role.code} className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{role.label}</p>
                  <p className="text-2xl font-bold">
                    {selectedCohort.composition?.[role.code] ?? 0}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-base font-medium">Total declared</p>
                <p className="text-sm text-muted-foreground">
                  Against {selectedCohort.seats ?? 0} seats
                </p>
              </div>
              <p className="text-2xl font-bold">
                {compositionRoles(roles).reduce(
                  (total, role) => total + (selectedCohort.composition?.[role.code] ?? 0),
                  0
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeamSizeDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                // The edit dialog lives in the cohort list view, so go back there first
                setShowTeamSizeDialog(false);
                setSelectedCohort(null);
                openEditCohort(selectedCohort);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Session Dialog */}
      <Dialog open={showCreateTaskDialog} onOpenChange={setShowCreateTaskDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Session for {selectedCohort.name}</DialogTitle>
            <DialogDescription>
              This session will be visible to all team members in this cohort.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="session-title">Session Title *</Label>
              <Input
                id="session-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Weekly Standup Meeting"
              />
            </div>
            <div>
              <Label htmlFor="session-description">Description</Label>
              <Textarea
                id="session-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe the session or meeting agenda..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="session-meeting-link">Meeting Link (Zoom/Google Meet)</Label>
              <Input
                id="session-meeting-link"
                value={taskMeetingLink}
                onChange={(e) => setTaskMeetingLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
              />
            </div>

            {/* Sessions */}
            <div className="space-y-4 border-t pt-4">
              {sessions.length === 0 ? (
                <>
                  <h4 className="text-md font-semibold">Session 1</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="session-start-date">Start Date *</Label>
                      <Input
                        id="session-start-date"
                        type="date"
                        value={taskStartTime.split('T')[0] || ''}
                        onChange={(e) => setTaskStartTime(e.target.value + 'T' + (taskStartTime.split('T')[1] || '00:00'))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="session-end-date">End Date *</Label>
                      <Input
                        id="session-end-date"
                        type="date"
                        value={taskEndTime.split('T')[0] || ''}
                        onChange={(e) => setTaskEndTime(e.target.value + 'T' + (taskEndTime.split('T')[1] || '00:00'))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      id="session-start-time"
                      label="Start Time *"
                      value={taskStartTime.split('T')[1] || ''}
                      onChange={(time) => setTaskStartTime((taskStartTime.split('T')[0] || '') + 'T' + time)}
                    />
                    <TimePicker
                      id="session-end-time"
                      label="End Time *"
                      value={taskEndTime.split('T')[1] || ''}
                      onChange={(time) => setTaskEndTime((taskEndTime.split('T')[0] || '') + 'T' + time)}
                    />
                  </div>
                </>
              ) : (
                sessions.map((session, index) => (
                  <div key={index} className="space-y-3 pb-4 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-md font-semibold">Session {index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSession(index)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`session-start-date-${index}`}>Start Date *</Label>
                        <Input
                          id={`session-start-date-${index}`}
                          type="date"
                          value={session.startDate}
                          onChange={(e) => updateSession(index, "startDate", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`session-end-date-${index}`}>End Date *</Label>
                        <Input
                          id={`session-end-date-${index}`}
                          type="date"
                          value={session.endDate}
                          onChange={(e) => updateSession(index, "endDate", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TimePicker
                        id={`session-start-time-${index}`}
                        label="Start Time *"
                        value={session.startTime}
                        onChange={(time) => updateSession(index, "startTime", time)}
                      />
                      <TimePicker
                        id={`session-end-time-${index}`}
                        label="End Time *"
                        value={session.endTime}
                        onChange={(time) => updateSession(index, "endTime", time)}
                      />
                    </div>
                  </div>
                ))
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => {
                  if (sessions.length === 0) {
                    // Move first session data to sessions array
                    const startDate = taskStartTime.split('T')[0] || '';
                    const startTime = taskStartTime.split('T')[1] || '';
                    const endDate = taskEndTime.split('T')[0] || '';
                    const endTime = taskEndTime.split('T')[1] || '';
                    setSessions([
                      { startDate, endDate, startTime, endTime, meetingLink: '' },
                      { startDate: '', endDate: '', startTime: '', endTime: '', meetingLink: '' }
                    ]);
                  } else {
                    addSession();
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Session
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateTaskDialog(false); resetTaskForm(); setSessions([]); }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={showEditTaskDialog} onOpenChange={(open) => { if (!open) { setShowEditTaskDialog(false); setEditingTask(null); resetTaskForm(); setSessions([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update the session details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-session-title">Session Title *</Label>
              <Input
                id="edit-session-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g., Weekly Standup Meeting"
              />
            </div>
            <div>
              <Label htmlFor="edit-session-description">Description</Label>
              <Textarea
                id="edit-session-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe the session or meeting agenda..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-session-meeting-link">Meeting Link (Zoom/Google Meet)</Label>
              <Input
                id="edit-session-meeting-link"
                value={taskMeetingLink}
                onChange={(e) => setTaskMeetingLink(e.target.value)}
                placeholder="https://zoom.us/j/..."
              />
            </div>

            {/* Sessions */}
            <div className="space-y-4 border-t pt-4">
              {sessions.length === 0 ? (
                <>
                  <h4 className="text-md font-semibold">Session 1</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-session-start-date">Start Date *</Label>
                      <Input
                        id="edit-session-start-date"
                        type="date"
                        value={taskStartTime.split('T')[0] || ''}
                        onChange={(e) => setTaskStartTime(e.target.value + 'T' + (taskStartTime.split('T')[1] || '00:00'))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-session-end-date">End Date *</Label>
                      <Input
                        id="edit-session-end-date"
                        type="date"
                        value={taskEndTime.split('T')[0] || ''}
                        onChange={(e) => setTaskEndTime(e.target.value + 'T' + (taskEndTime.split('T')[1] || '00:00'))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      id="edit-session-start-time"
                      label="Start Time *"
                      value={taskStartTime.split('T')[1] || ''}
                      onChange={(time) => setTaskStartTime((taskStartTime.split('T')[0] || '') + 'T' + time)}
                    />
                    <TimePicker
                      id="edit-session-end-time"
                      label="End Time *"
                      value={taskEndTime.split('T')[1] || ''}
                      onChange={(time) => setTaskEndTime((taskEndTime.split('T')[0] || '') + 'T' + time)}
                    />
                  </div>
                </>
              ) : (
                sessions.map((session, index) => (
                  <div key={index} className="space-y-3 pb-4 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-md font-semibold">Session {index + 1}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSession(index)}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`edit-session-start-date-${index}`}>Start Date *</Label>
                        <Input
                          id={`edit-session-start-date-${index}`}
                          type="date"
                          value={session.startDate}
                          onChange={(e) => updateSession(index, "startDate", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`edit-session-end-date-${index}`}>End Date *</Label>
                        <Input
                          id={`edit-session-end-date-${index}`}
                          type="date"
                          value={session.endDate}
                          onChange={(e) => updateSession(index, "endDate", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TimePicker
                        id={`edit-session-start-time-${index}`}
                        label="Start Time *"
                        value={session.startTime}
                        onChange={(time) => updateSession(index, "startTime", time)}
                      />
                      <TimePicker
                        id={`edit-session-end-time-${index}`}
                        label="End Time *"
                        value={session.endTime}
                        onChange={(time) => updateSession(index, "endTime", time)}
                      />
                    </div>
                  </div>
                ))
              )}
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => {
                  if (sessions.length === 0) {
                    // Move first session data to sessions array
                    const startDate = taskStartTime.split('T')[0] || '';
                    const startTime = taskStartTime.split('T')[1] || '';
                    const endDate = taskEndTime.split('T')[0] || '';
                    const endTime = taskEndTime.split('T')[1] || '';
                    setSessions([
                      { startDate, endDate, startTime, endTime, meetingLink: '' },
                      { startDate: '', endDate: '', startTime: '', endTime: '', meetingLink: '' }
                    ]);
                  } else {
                    addSession();
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Session
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditTaskDialog(false); setEditingTask(null); resetTaskForm(); setSessions([]); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTask} disabled={updateTaskMutation.isPending}>
              {updateTaskMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team to Cohort Dialog */}
      <Dialog open={showAddTeamDialog} onOpenChange={setShowAddTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team to Cohort</DialogTitle>
            <DialogDescription>
              Select a team to add to {selectedCohort.name}. The team will receive all cohort sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-select">Select Team</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a team..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.length === 0 ? (
                    <SelectItem value="none" disabled>No teams available</SelectItem>
                  ) : (
                    availableTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddTeamDialog(false); setSelectedTeamId(""); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedTeamId && selectedCohort) {
                  addTeamToCohortMutation.mutate({
                    teamId: selectedTeamId,
                    cohortId: selectedCohort.id,
                  });
                }
              }} 
              disabled={!selectedTeamId || addTeamToCohortMutation.isPending}
            >
              {addTeamToCohortMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
