import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Video,
  Users,
  MapPin,
  Trash2,
  ExternalLink,
  FileText,
  Upload,
  FileCheck,
  Pencil,
} from "lucide-react";
import { CreateMeetingDialog } from "./create-meeting-dialog";
import { MeetingRecording } from "./MeetingRecording";
import { meetingPlatformLabel, normaliseMeetingPlatform } from "@shared/meetingPlatform";
import { useAuth } from "@/lib/auth-context";

interface TeamMeeting {
  id: string;
  teamId: string;
  createdBy: string;
  title: string;
  agenda: string | null;
  scheduledAt: string;
  durationMinutes: number;
  timezone: string;
  meetingLink: string | null;
  googleEventId: string | null;
  attendeeIds: string[];
  sprintId: string | null;
  notes: string | null;
  momTitle: string | null;
  momDate: string | null;
  momDocument: string | null;
  meetingPlatform: string | null;
  recordingObjectKey: string | null;
  recordingFileName: string | null;
  recordingSizeBytes: number | string | null;
  recordingContentType: string | null;
  recordingDurationSeconds: number | null;
  recordingUploadedBy: string | null;
  recordingUploadedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  } | null;
  teamName?: string;
}

interface TeamMeetingsProps {
  teamId: string;
  teamName?: string;
  canCreate?: boolean;
  teams?: Array<{ id: string; name: string }>;
}

export function TeamMeetings({ teamId, teamName, canCreate = true, teams }: TeamMeetingsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<TeamMeeting | null>(null);
  const [deleteMeetingId, setDeleteMeetingId] = useState<string | null>(null);
  const [momMeeting, setMomMeeting] = useState<TeamMeeting | null>(null);
  const [momTitle, setMomTitle] = useState("");
  const [momDate, setMomDate] = useState("");
  const [momFile, setMomFile] = useState<File | null>(null);
  const [isUploadingMom, setIsUploadingMom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: meetings, isLoading } = useQuery<TeamMeeting[]>({
    queryKey: ["/api/teams", teamId, "meetings"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/api/teams/${teamId}/meetings`);
      return data;
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      return apiRequest("DELETE", `/api/teams/${teamId}/meetings/${meetingId}`);
    },
    onSuccess: () => {
      toast({
        title: "Meeting cancelled",
        description: "The meeting has been cancelled and notifications sent to attendees.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-meetings"] });
      setDeleteMeetingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel meeting",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const getMeetingEndTime = (m: TeamMeeting) => new Date(new Date(m.scheduledAt).getTime() + (m.durationMinutes || 30) * 60 * 1000);
  const upcomingMeetings = meetings?.filter((m) => getMeetingEndTime(m) > new Date()) || [];
  const pastMeetings = meetings?.filter((m) => getMeetingEndTime(m) <= new Date()) || [];

  const formatMeetingTime = (scheduledAt: string, timezone: string) => {
    const date = new Date(scheduledAt);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(date);
  };

  const canEditMeeting = (meeting: TeamMeeting) => {
    return user?.id === meeting.createdBy || user?.role === "ADMIN";
  };

  const openMomDialog = (meeting: TeamMeeting) => {
    setMomMeeting(meeting);
    setMomTitle(meeting.momTitle || "");
    setMomDate(
      meeting.momDate ? format(new Date(meeting.momDate), "yyyy-MM-dd") : ""
    );
    setMomFile(null);
  };

  const closeMomDialog = () => {
    setMomMeeting(null);
    setMomTitle("");
    setMomDate("");
    setMomFile(null);
  };

  const handleMomSubmit = async () => {
    if (!momMeeting) return;
    if (!momTitle.trim()) {
      toast({ title: "MOM title is required", variant: "destructive" });
      return;
    }
    if (!momDate) {
      toast({ title: "MOM date is required", variant: "destructive" });
      return;
    }

    setIsUploadingMom(true);
    try {
      let documentKey: string | undefined;

      if (momFile) {
        // Step 1: Get presigned upload URL
        const uploadUrlRes = await apiRequest("POST", "/api/meetings/mom/upload-url", {
          fileName: momFile.name,
          fileType: momFile.type,
        });

        // Step 2: Upload file directly to S3
        await fetch(uploadUrlRes.uploadUrl, {
          method: "PUT",
          body: momFile,
          headers: { "Content-Type": momFile.type },
        });

        documentKey = uploadUrlRes.objectKey;
      }

      // Step 3: Save MOM fields via PATCH
      await apiRequest("PATCH", `/api/teams/${teamId}/meetings/${momMeeting.id}`, {
        momTitle: momTitle.trim(),
        momDate: new Date(momDate).toISOString(),
        ...(documentKey !== undefined && { momDocument: documentKey }),
      });

      toast({ title: "MOM saved", description: "Minutes of Meeting uploaded successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-meetings"] });
      closeMomDialog();
    } catch (error: any) {
      toast({
        title: "Failed to save MOM",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingMom(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Meetings</h3>
          <p className="text-sm text-muted-foreground">
            Schedule and manage meetings with your team
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Create Meeting
          </Button>
        )}
      </div>

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 && (
        <div>
          <h4 className="text-md font-medium mb-3">Upcoming Meetings</h4>
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-semibold">{meeting.title}</h5>
                        {isToday(new Date(meeting.scheduledAt)) && (
                          <Badge variant="default">Today</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatMeetingTime(meeting.scheduledAt, meeting.timezone)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {meeting.durationMinutes} minutes
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {meeting.timezone}
                        </div>
                        {meeting.creator && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Created by {meeting.creator.name}
                          </div>
                        )}
                        {meeting.agenda && (
                          <p className="mt-2 text-sm">{meeting.agenda}</p>
                        )}
                      </div>
                      {meeting.meetingLink && new Date() <= new Date(new Date(meeting.scheduledAt).getTime() + (meeting.durationMinutes || 30) * 60 * 1000) && (
                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(meeting.meetingLink!, "_blank")}
                          >
                            <Video className="mr-2 h-4 w-4" />
                            Join {meetingPlatformLabel(normaliseMeetingPlatform(meeting.meetingPlatform), meeting.meetingLink)}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {/* Available before the session too, so a mentor who already has the file
                          is never left waiting for a clock to pass. */}
                      <MeetingRecording
                        teamId={meeting.teamId}
                        meetingId={meeting.id}
                        meetingTitle={meeting.title}
                        meeting={meeting}
                        onChanged={() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "meetings"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/my-meetings"] });
                        }}
                      />
                    </div>
                    {canEditMeeting(meeting) && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMeeting(meeting)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteMeetingId(meeting.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <div>
          <h4 className="text-md font-medium mb-3">Past Meetings</h4>
          <div className="space-y-3">
            {pastMeetings.map((meeting) => (
              <Card key={meeting.id} className="opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h5 className="font-semibold mb-2">{meeting.title}</h5>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {formatMeetingTime(meeting.scheduledAt, meeting.timezone)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          {meetingPlatformLabel(normaliseMeetingPlatform(meeting.meetingPlatform), meeting.meetingLink)}
                        </div>
                        {meeting.agenda && (
                          <p className="mt-2 text-sm">{meeting.agenda}</p>
                        )}
                        {/* MOM info if already uploaded */}
                        {meeting.momTitle && (
                          <div className="mt-2 pt-2 border-t border-dashed">
                            <div className="flex items-center gap-2 text-foreground font-medium">
                              <FileCheck className="h-4 w-4 text-green-600" />
                              MOM: {meeting.momTitle}
                            </div>
                            {meeting.momDate && (
                              <p className="text-xs text-muted-foreground ml-6">
                                {format(new Date(meeting.momDate), "PPP")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {/* The recording sits with the session it belongs to. Rendering it here
                          rather than behind its own nav item means the same panel serves admins
                          (any team), mentors (their teams) and learners (their own team), since
                          all three mount this component. */}
                      <MeetingRecording
                        teamId={meeting.teamId}
                        meetingId={meeting.id}
                        meetingTitle={meeting.title}
                        meeting={meeting}
                        onChanged={() => {
                          queryClient.invalidateQueries({ queryKey: ["/api/teams", teamId, "meetings"] });
                          queryClient.invalidateQueries({ queryKey: ["/api/my-meetings"] });
                        }}
                      />
                    </div>
                    <div className="flex gap-2 ml-2">
                      {meeting.momTitle && meeting.momDocument && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: meeting.momDocument });
                              window.open(resp.fileUrl, "_blank");
                            } catch {
                              toast({ title: "Error", description: "Failed to open MOM document", variant: "destructive" });
                            }
                          }}
                        >
                          <ExternalLink className="mr-1 h-4 w-4" />
                          View MOM
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openMomDialog(meeting)}
                      >
                        <Upload className="mr-1 h-4 w-4" />
                        {meeting.momTitle ? "Edit MOM" : "Upload MOM"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!meetings || meetings.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="font-semibold mb-2">No meetings scheduled</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first team meeting to discuss project progress
            </p>
            {canCreate && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Calendar className="mr-2 h-4 w-4" />
                Create Meeting
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Meeting Dialog */}
      <CreateMeetingDialog
        open={showCreateDialog || !!editingMeeting}
        onOpenChange={(o) => {
          if (!o) { setShowCreateDialog(false); setEditingMeeting(null); }
          else setShowCreateDialog(true);
        }}
        teamId={teamId}
        teams={teams}
        existingMeeting={editingMeeting}
        onSuccess={() => {
          setShowCreateDialog(false);
          setEditingMeeting(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteMeetingId} onOpenChange={() => setDeleteMeetingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this meeting? All attendees will be notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMeetingId(null)}>
              Keep Meeting
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMeetingId && deleteMeetingMutation.mutate(deleteMeetingId)}
              disabled={deleteMeetingMutation.isPending}
            >
              {deleteMeetingMutation.isPending ? "Cancelling..." : "Cancel Meeting"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload MOM Dialog */}
      <Dialog open={!!momMeeting} onOpenChange={(open) => { if (!open) closeMomDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Minutes of Meeting
            </DialogTitle>
            <DialogDescription>
              {momMeeting?.title} &mdash; {momMeeting && formatMeetingTime(momMeeting.scheduledAt, momMeeting.timezone)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* MOM Title */}
            <div className="space-y-1.5">
              <Label htmlFor="mom-title">MOM Title</Label>
              <Input
                id="mom-title"
                placeholder="e.g. Sprint Review MOM"
                value={momTitle}
                onChange={(e) => setMomTitle(e.target.value)}
              />
            </div>

            {/* MOM Date */}
            <div className="space-y-1.5">
              <Label htmlFor="mom-date">MOM Date</Label>
              <Input
                id="mom-date"
                type="date"
                value={momDate}
                onChange={(e) => setMomDate(e.target.value)}
              />
            </div>

            {/* MOM Document */}
            <div className="space-y-1.5">
              <Label htmlFor="mom-document">Document (PDF / DOC)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mom-document"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  ref={fileInputRef}
                  onChange={(e) => setMomFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
              {momFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {momFile.name}
                </p>
              )}
              {!momFile && momMeeting?.momDocument && (
                <p className="text-xs text-muted-foreground">
                  Document already uploaded. Select a new file to replace it.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeMomDialog} disabled={isUploadingMom}>
              Cancel
            </Button>
            <Button onClick={handleMomSubmit} disabled={isUploadingMom}>
              {isUploadingMom ? "Saving..." : "Save MOM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
