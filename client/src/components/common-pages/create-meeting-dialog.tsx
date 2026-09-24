import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_MEETING_PLATFORM,
  MeetingPlatform,
  meetingLinkError,
  normaliseMeetingPlatform,
} from "@shared/meetingPlatform";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Calendar, Clock, Users, MapPin, Video } from "lucide-react";

// Time conversion utilities
const convert24to12 = (time24: string) => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return {
    hour: hour12.toString().padStart(2, '0'),
    minute: minutes.toString().padStart(2, '0'),
    period: period as 'AM' | 'PM'
  };
};

const convert12to24 = (hour: string, minute: string, period: 'AM' | 'PM'): string => {
  let h = parseInt(hour);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute}`;
};

// Time picker component
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
  const { hour, minute, period } = convert24to12(value || '09:00');
  
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
            {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map((h) => (
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

interface TeamMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
}

interface Team {
  id: string;
  name: string;
}

interface ExistingMeeting {
  id: string;
  teamId: string;
  title: string;
  agenda?: string | null;
  scheduledAt: string | Date;
  durationMinutes?: number | null;
  timezone?: string | null;
  attendeeIds?: string[] | null;
  sprintId?: string | null;
  meetingPlatform?: string | null;
  meetingLink?: string | null;
}

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId?: string;
  teams?: Team[]; // For mentors with multiple teams
  teamMembers?: TeamMember[];
  onSuccess?: () => void;
  existingMeeting?: ExistingMeeting | null;
}

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEDT)" },
];

export function CreateMeetingDialog({
  open,
  onOpenChange,
  teamId: initialTeamId,
  teams = [],
  teamMembers = [],
  onSuccess,
  existingMeeting,
}: CreateMeetingDialogProps) {
  const isEditing = !!existingMeeting;
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Determine if user can select team (only mentors and admins)
  const canSelectTeam = user?.role === "MENTOR" || user?.role === "ADMIN";
  
  // Determine initial team ID
  const safeTeams = Array.isArray(teams) ? teams : [];
  const getInitialTeamId = () => {
    if (initialTeamId) return initialTeamId;
    if (safeTeams.length === 1 && safeTeams[0]?.id) return safeTeams[0].id;
    return "";
  };
  
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState(() => getInitialTeamId());
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [meetingPlatform, setMeetingPlatform] = useState<MeetingPlatform>(DEFAULT_MEETING_PLATFORM);
  const [meetingLink, setMeetingLink] = useState("");
  const [sprintId, setSprintId] = useState<string>("none");

  // Pre-fill form when editing an existing meeting
  useEffect(() => {
    if (open && existingMeeting) {
      const dt = new Date(existingMeeting.scheduledAt);
      // Format date in IST as YYYY-MM-DD
      const istDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: existingMeeting.timezone || 'Asia/Kolkata',
        year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(dt);
      // Format time in IST as HH:MM
      const istTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: existingMeeting.timezone || 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(dt);
      setTitle(existingMeeting.title || '');
      setAgenda(existingMeeting.agenda || '');
      setDate(istDate);
      setTime(istTime);
      setDurationMinutes(existingMeeting.durationMinutes || 30);
      setTimezone(existingMeeting.timezone || 'Asia/Kolkata');
      setSelectedAttendees(existingMeeting.attendeeIds || []);
      setSprintId(existingMeeting.sprintId || 'none');
      setSelectedTeamId(existingMeeting.teamId || initialTeamId || '');
      setMeetingPlatform(normaliseMeetingPlatform(existingMeeting.meetingPlatform));
      setMeetingLink(existingMeeting.meetingLink || '');
    }
  }, [open, existingMeeting]);

  // Get minimum date (today)
  // No minimum date. It used to be today, which -- together with a server rule demanding ten
  // minutes' notice -- made it impossible to log a session that had already happened, and that is
  // now the main reason a mentor creates a meeting: to attach the recording of one they just ran.
  const minDate = undefined;
  
  // Reset form when dialog closes - simplified to prevent crashes
  const handleDialogChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form when dialog closes - use setTimeout to avoid state update during render
      setTimeout(() => {
        setTitle("");
        setAgenda("");
        setDate("");
        setTime("09:00");
        setDurationMinutes(30);
        setTimezone("Asia/Kolkata");
        setSelectedAttendees([]);
        setSprintId("none");
        // Reset team selection - use the initial value directly
        if (initialTeamId) {
          setSelectedTeamId(initialTeamId);
        } else if (safeTeams.length === 1 && safeTeams[0]?.id) {
          setSelectedTeamId(safeTeams[0].id);
        } else {
          setSelectedTeamId("");
        }
        setSelectedCohortId("");
      }, 0);
    }
    onOpenChange(isOpen);
  };

  // Fetch all cohorts (admin only)
  const { data: cohorts } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/cohorts"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/cohorts");
      return Array.isArray(data) ? data : [];
    },
    enabled: user?.role === "ADMIN" && open,
  });

  // Fetch teams for the selected cohort (admin only)
  const { data: cohortTeams } = useQuery<Team[]>({
    queryKey: ["/api/cohorts", selectedCohortId, "teams"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/api/cohorts/${selectedCohortId}/teams`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCohortId && user?.role === "ADMIN" && open,
  });

  // For admins: use teams fetched from the selected cohort; for others: use prop teams
  const teamsToShow: Team[] = user?.role === "ADMIN" && selectedCohortId
    ? (cohortTeams ?? [])
    : safeTeams;

  const handleCohortChange = (cohortId: string) => {
    setSelectedCohortId(cohortId);
    setSelectedTeamId("");
    setSelectedAttendees([]);
  };

  // Fetch team members when team is selected
  const { data: members, isLoading: membersLoading, error: membersError } = useQuery<TeamMember[]>({
    queryKey: ["/api/teams", selectedTeamId, "members"],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      try {
        const data = await apiRequest("GET", `/api/teams/${selectedTeamId}/members`);
        return Array.isArray(data) ? data : [];
      } catch (error: any) {
        console.error("Error fetching team members:", error);
        return [];
      }
    },
    enabled: !!selectedTeamId && open,
  });

  const currentMembers: TeamMember[] = Array.isArray(members) 
    ? members 
    : (Array.isArray(teamMembers) ? teamMembers : []);

  // Fetch sprints for selected team
  const { data: sprints } = useQuery({
    queryKey: ["/api/teams", selectedTeamId, "sprints"],
    queryFn: async () => {
      if (!selectedTeamId) return [];
      const data = await apiRequest("GET", `/api/teams/${selectedTeamId}/sprints`);
      return data;
    },
    enabled: !!selectedTeamId && open,
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: {
      teamId: string;
      title: string;
      agenda?: string;
      date: string;
      time: string;
      durationMinutes: number;
      timezone: string;
      attendeeIds: string[];
      sprintId?: string;
      meetingPlatform: MeetingPlatform;
      meetingLink?: string;
    }) => {
      try {
        if (existingMeeting) {
          return await apiRequest("PATCH", `/api/teams/${existingMeeting.teamId}/meetings/${existingMeeting.id}`, data);
        }
        return await apiRequest("POST", `/api/teams/${data.teamId}/meetings`, data);
      } catch (error: any) {
        console.error("API Error in createMeetingMutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      try {
        toast({
          title: existingMeeting ? "Meeting updated" : "Meeting created",
          description: existingMeeting
            ? "The meeting has been updated successfully."
            : "The meeting has been scheduled and notifications sent to attendees.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/teams", selectedTeamId, "meetings"] });
        queryClient.invalidateQueries({ queryKey: ["/api/my-meetings"] });
        // Close dialog directly instead of using handleDialogChange to avoid state update issues
        onOpenChange(false);
        onSuccess?.();
      } catch (error: any) {
        console.error("Error in onSuccess:", error);
        toast({
          title: existingMeeting ? "Meeting updated" : "Meeting created",
          description: "The meeting was saved, but there was an issue refreshing the list.",
        });
        // Close dialog directly
        onOpenChange(false);
      }
    },
    onError: (error: any) => {
      console.error("Error in createMeetingMutation:", error);
      toast({
        title: existingMeeting ? "Failed to update meeting" : "Failed to create meeting",
        description: error?.message || "Please check all fields and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    try {
      if (!selectedTeamId) {
        toast({
          title: "Validation error",
          description: "Please select a team.",
          variant: "destructive",
        });
        return;
      }

      if (!title || !title.trim()) {
        toast({
          title: "Validation error",
          description: "Please enter a meeting title.",
          variant: "destructive",
        });
        return;
      }

      if (!date) {
        toast({
          title: "Validation error",
          description: "Please select a date.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedAttendees || selectedAttendees.length === 0) {
        toast({
          title: "Validation error",
          description: "Please select at least one attendee.",
          variant: "destructive",
        });
        return;
      }

      // Validate minimum 10 minutes notice (only when creating a new meeting)
      if (!isEditing) {
        try {
          const meetingDateTime = new Date(`${date}T${time}`);
          if (isNaN(meetingDateTime.getTime())) {
            toast({
              title: "Validation error",
              description: "Invalid date or time format.",
              variant: "destructive",
            });
            return;
          }
          
          const now = new Date();
          const minutesUntilMeeting = (meetingDateTime.getTime() - now.getTime()) / (1000 * 60);
          
          if (minutesUntilMeeting < 10) {
            toast({
              title: "Validation error",
              description: "Meeting must be scheduled at least 10 minutes in advance.",
              variant: "destructive",
            });
            return;
          }
        } catch (dateError) {
          toast({
            title: "Validation error",
            description: "Invalid date or time. Please check your selections.",
            variant: "destructive",
          });
          return;
        }
      }

      // Ensure all required data is valid before mutation
      if (!selectedTeamId || !title.trim() || !date || !time || !selectedAttendees.length) {
        toast({
          title: "Validation error",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // Same function the server runs, so the wording a mentor sees here is the wording they
      // would have got back from the API.
      const linkProblem = meetingLinkError(meetingPlatform, meetingLink);
      if (linkProblem) {
        toast({ title: "Check the meeting link", description: linkProblem, variant: "destructive" });
        return;
      }

      createMeetingMutation.mutate({
        teamId: selectedTeamId,
        title: title.trim(),
        agenda: agenda ? agenda.trim() : undefined,
        date,
        time,
        durationMinutes: durationMinutes || 30,
        timezone: timezone || "Asia/Kolkata",
        attendeeIds: Array.isArray(selectedAttendees) ? selectedAttendees : [],
        sprintId: sprintId && sprintId !== "none" ? sprintId : undefined,
        meetingPlatform,
        meetingLink: meetingPlatform === "OTHER" ? meetingLink.trim() : undefined,
      });
    } catch (error: any) {
      console.error("Error in handleSubmit:", error);
      toast({
        title: "Error",
        description: error?.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllAttendees = () => {
    if (currentMembers.length === 0) return;
    const allUserIds = currentMembers.map((m: TeamMember) => m.userId).filter(Boolean);
    setSelectedAttendees(allUserIds);
  };

  const deselectAllAttendees = () => {
    setSelectedAttendees([]);
  };

  // Early return if dialog is not open
  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Meeting" : "Create Team Meeting"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the meeting details below"
              : "Schedule a meeting to discuss project progress with your team"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cohort Selection - Admin only */}
          {user?.role === "ADMIN" && (
            <div>
              <Label htmlFor="cohort-select">Cohort *</Label>
              <Select value={selectedCohortId} onValueChange={handleCohortChange}>
                <SelectTrigger id="cohort-select">
                  <SelectValue placeholder="Select a cohort" />
                </SelectTrigger>
                <SelectContent>
                  {(cohorts ?? []).map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Team Selection - Only show for mentors and admins */}
          {canSelectTeam && user?.role === "ADMIN" && selectedCohortId && (teamsToShow.length > 1 || (teamsToShow.length === 1 && !selectedTeamId)) ? (
            <div>
              <Label htmlFor="team-select">Team *</Label>
              <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setSelectedAttendees([]); }}>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teamsToShow.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : canSelectTeam && user?.role !== "ADMIN" && (safeTeams.length > 1 || (safeTeams.length === 1 && !selectedTeamId)) ? (
            <div>
              <Label htmlFor="team-select">Team *</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger id="team-select">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {safeTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : !canSelectTeam && safeTeams.length === 1 && selectedTeamId && safeTeams[0] ? (
            // For founders/cofounders: Show read-only team name (they can only create for their own team)
            <div>
              <Label>Team</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/50">
                <span className="text-sm font-medium">{safeTeams[0].name}</span>
              </div>
            </div>
          ) : null}

          {/* Meeting Title */}
          <div>
            <Label htmlFor="meeting-title">Meeting Title *</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprint Planning, Daily Standup"
            />
          </div>

          {/* Where the session happens. Google Meet keeps the original sequence -- the portal asks
              Google for a link. Other takes the mentor's own, for Zoom/Teams/anything else, which
              is the case that matters when they want a recording: Meet only records on paid
              Workspace tiers. */}
          <div>
            <Label htmlFor="meeting-platform">
              <Video className="inline h-4 w-4 mr-1" />
              Meeting platform *
            </Label>
            <Select
              value={meetingPlatform}
              onValueChange={(v) => setMeetingPlatform(normaliseMeetingPlatform(v))}
            >
              <SelectTrigger id="meeting-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOOGLE_MEET">Google Meet — link created for you</SelectItem>
                <SelectItem value="OTHER">Other — paste your own link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {meetingPlatform === "OTHER" && (
            <div>
              <Label htmlFor="meeting-link">Meeting link *</Label>
              <Input
                id="meeting-link"
                type="url"
                inputMode="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://zoom.us/j/1234567890"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Learners join with this link. Paste it from Zoom, Teams, Webex or wherever you are
                hosting.
              </p>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="meeting-date">
                <Calendar className="inline h-4 w-4 mr-1" />
                Date *
              </Label>
              <Input
                id="meeting-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
              />
            </div>
            <TimePicker
              id="meeting-time"
              label="Time *"
              value={time}
              onChange={setTime}
            />
          </div>

          {/* Duration and Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration">
                <Clock className="inline h-4 w-4 mr-1" />
                Duration (minutes) *
              </Label>
              <Input
                id="duration"
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Math.max(15, parseInt(e.target.value) || 30))}
                min={15}
                max={480}
              />
            </div>
            <div>
              <Label htmlFor="timezone">
                <MapPin className="inline h-4 w-4 mr-1" />
                Timezone *
              </Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Agenda */}
          <div>
            <Label htmlFor="meeting-agenda">Agenda (Optional)</Label>
            <Textarea
              id="meeting-agenda"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Describe what will be discussed in this meeting..."
              className="min-h-[100px]"
            />
          </div>

          {/* Sprint Selection (Optional) */}
          {sprints && sprints.length > 0 && (
            <div>
              <Label htmlFor="sprint-select">Link to Sprint (Optional)</Label>
              <Select value={sprintId} onValueChange={setSprintId}>
                <SelectTrigger id="sprint-select">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {sprints.map((sprint: any) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      Sprint {sprint.index} ({new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Attendees Selection */}
          {selectedTeamId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>
                  <Users className="inline h-4 w-4 mr-1" />
                  Select Attendees * (At least one required)
                </Label>
                {currentMembers.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={selectAllAttendees}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={deselectAllAttendees}
                    >
                      Deselect All
                    </Button>
                  </div>
                )}
              </div>
              {membersLoading ? (
                <div className="h-48 border rounded-md p-4 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading team members...</span>
                </div>
              ) : currentMembers.length > 0 ? (
                <ScrollArea className="h-48 border rounded-md p-4">
                  <div className="space-y-2">
                    {currentMembers.map((member: TeamMember) => {
                      if (!member.user) return null;
                      const isSelected = selectedAttendees.includes(member.userId);
                      return (
                        <div
                          key={member.userId}
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                        >
                          <Checkbox
                            id={`attendee-${member.userId}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleAttendee(member.userId)}
                          />
                          <Label
                            htmlFor={`attendee-${member.userId}`}
                            className="flex-1 cursor-pointer"
                          >
                            {member.user.name} ({member.user.email})
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : membersError ? (
                <div className="h-48 border rounded-md p-4 flex items-center justify-center">
                  <p className="text-sm text-destructive">Error loading team members. Please try again.</p>
                </div>
              ) : (
                <div className="h-48 border rounded-md p-4 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No team members found</p>
                </div>
              )}
              {selectedAttendees.length === 0 && currentMembers.length > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Please select at least one attendee
                </p>
              )}
            </div>
          )}
          {!selectedTeamId && user?.role === "ADMIN" && !selectedCohortId && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Please select a cohort to continue
              </p>
            </div>
          )}
          {!selectedTeamId && user?.role === "ADMIN" && selectedCohortId && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Please select a team to view team members
              </p>
            </div>
          )}
          {!selectedTeamId && user?.role !== "ADMIN" && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Please select a team to view team members
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleDialogChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createMeetingMutation.isPending || !selectedTeamId || !title || !date || selectedAttendees.length === 0 || (meetingPlatform === "OTHER" && !meetingLink.trim()) || (user?.role === "ADMIN" && !selectedCohortId && !isEditing)}
          >
            {createMeetingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Saving..." : "Creating..."}
              </>
            ) : (
              isEditing ? "Save Changes" : "Create Meeting"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
