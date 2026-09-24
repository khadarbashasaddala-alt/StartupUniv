import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, isPast, isToday, isFuture } from "date-fns";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ExternalLink,
  FileText,
  Upload,
  FileCheck,
  Pencil,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CreateMeetingDialog } from "@/components/common-pages/create-meeting-dialog";
import { MeetingRecording } from "@/components/common-pages/MeetingRecording";
import { meetingPlatformLabel, normaliseMeetingPlatform } from "@shared/meetingPlatform";

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
  team: {
    id: string;
    name: string;
  } | null;
}

export default function MyMeetingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { startPageTourIfFirst(user?.role === "COFOUNDER" ? "cf-meetings" : user?.role === "MENTOR" ? "m-meetings" : "meetings"); }, [user?.role]);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">("upcoming");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<TeamMeeting | null>(null);

  // MOM state
  const [momMeeting, setMomMeeting] = useState<TeamMeeting | null>(null);
  const [momTitle, setMomTitle] = useState("");
  const [momDate, setMomDate] = useState("");
  const [momFile, setMomFile] = useState<File | null>(null);
  const [isUploadingMom, setIsUploadingMom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only FOUNDER, COFOUNDER, MENTOR can upload MOM
  const canUploadMom =
    user?.role === "FOUNDER" ||
    user?.role === "COFOUNDER" ||
    user?.role === "MENTOR";

  // Get user's team (for founders/cofounders)
  const { data: myTeam } = useQuery({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/my-team");
      } catch {
        return null;
      }
    },
    enabled: !!user && (user.role === "FOUNDER" || user.role === "COFOUNDER"),
  });

  // Get user's teams for create dialog (for mentors/admins)
  const { data: teams } = useQuery({
    queryKey: ["/api/teams"],
    queryFn: async () => apiRequest("GET", "/api/teams"),
    enabled: !!user && (user.role === "MENTOR" || user.role === "ADMIN"),
  });

  const { data: meetings, isLoading } = useQuery<TeamMeeting[]>({
    queryKey: ["/api/my-meetings"],
    queryFn: async () => apiRequest("GET", "/api/my-meetings"),
    enabled: !!user,
  });

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

  const getMeetingEndTime = (m: TeamMeeting) => new Date(new Date(m.scheduledAt).getTime() + (m.durationMinutes || 30) * 60 * 1000);
  const upcomingMeetings = meetings?.filter((m) => getMeetingEndTime(m) > new Date()) || [];
  const pastMeetings = meetings?.filter((m) => getMeetingEndTime(m) <= new Date()) || [];

  const canCreateMeeting =
    user?.role === "FOUNDER" ||
    user?.role === "COFOUNDER" ||
    user?.role === "MENTOR" ||
    user?.role === "ADMIN";

  const userTeams = useMemo(() => {
    if (user?.role === "FOUNDER" || user?.role === "COFOUNDER") {
      if (myTeam && (myTeam.team?.id || myTeam.id)) {
        return [{ id: myTeam.team?.id || myTeam.id || "", name: myTeam.team?.name || myTeam.name || "My Team" }];
      }
      return [];
    }
    return Array.isArray(teams) ? teams : [];
  }, [user?.role, myTeam, teams]);

  const initialTeamId = useMemo(() => {
    if ((user?.role === "FOUNDER" || user?.role === "COFOUNDER") && myTeam) {
      return myTeam.team?.id || myTeam.id || undefined;
    }
    return undefined;
  }, [user?.role, myTeam]);

  // MOM helpers
  const openMomDialog = (meeting: TeamMeeting) => {
    setMomMeeting(meeting);
    setMomTitle(meeting.momTitle || "");
    setMomDate(meeting.momDate ? format(new Date(meeting.momDate), "yyyy-MM-dd") : "");
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
        const uploadUrlRes = await apiRequest("POST", "/api/meetings/mom/upload-url", {
          fileName: momFile.name,
          fileType: momFile.type,
        });
        await fetch(uploadUrlRes.uploadUrl, {
          method: "PUT",
          body: momFile,
          headers: { "Content-Type": momFile.type },
        });
        documentKey = uploadUrlRes.objectKey;
      }

      await apiRequest("PATCH", `/api/teams/${momMeeting.teamId}/meetings/${momMeeting.id}`, {
        momTitle: momTitle.trim(),
        momDate: new Date(momDate).toISOString(),
        ...(documentKey !== undefined && { momDocument: documentKey }),
      });

      toast({ title: "MOM saved", description: "Minutes of Meeting uploaded successfully." });
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
      <AppLayout title="My Meetings">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  const displayMeetings =
    activeTab === "upcoming"
      ? upcomingMeetings
      : activeTab === "past"
      ? pastMeetings
      : meetings || [];

  return (
    <AppLayout title="My Meetings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Meetings</h1>
            <p className="text-sm text-muted-foreground">
              View and manage meetings across all your teams
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PageTourButton pageKey={user?.role === "COFOUNDER" ? "cf-meetings" : user?.role === "MENTOR" ? "m-meetings" : "meetings"} />
            {canCreateMeeting && (
              <Button onClick={() => setShowCreateDialog(true)} data-tour="create-meeting-btn">
                <Calendar className="mr-2 h-4 w-4" />
                Create Meeting
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList data-tour="meetings-upcoming-section">
            <TabsTrigger value="upcoming">Upcoming ({upcomingMeetings.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({pastMeetings.length})</TabsTrigger>
            <TabsTrigger value="all">All ({meetings?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4" data-tour="m-pg-meetings-list">
            {displayMeetings.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="font-semibold mb-2">No meetings found</h4>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "upcoming"
                      ? "You don't have any upcoming meetings scheduled."
                      : activeTab === "past"
                      ? "You don't have any past meetings."
                      : "You don't have any meetings."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {displayMeetings.map((meeting) => {
                  const meetingEndTime = new Date(new Date(meeting.scheduledAt).getTime() + (meeting.durationMinutes || 30) * 60 * 1000);
                  const isMeetingPast = meetingEndTime <= new Date();
                  return (
                    <Card key={meeting.id} className={isMeetingPast ? "opacity-75" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold">{meeting.title}</h5>
                              {isToday(new Date(meeting.scheduledAt)) && (
                                <Badge variant="default">Today</Badge>
                              )}
                              {meeting.team && (
                                <Badge variant="outline">{meeting.team.name}</Badge>
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
                              <div className="flex items-center gap-2">
                                <Video className="h-4 w-4" />
                                {meetingPlatformLabel(normaliseMeetingPlatform(meeting.meetingPlatform), meeting.meetingLink)}
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
                              {/* MOM summary if already uploaded */}
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
                            {meeting.meetingLink && new Date() <= new Date(new Date(meeting.scheduledAt).getTime() + (meeting.durationMinutes || 30) * 60 * 1000) && (
                              <div className="mt-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(meeting.meetingLink!, "_blank")}
                                >
                                  <Video className="mr-2 h-4 w-4" />
                                  Join Meeting
                                  <ExternalLink className="ml-2 h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {/* The recording of a past session, beside the session itself. The
                                panel decides for itself whether this viewer may upload, watch,
                                or only be told there is nothing yet. */}
                            {meeting.team?.id && (
                              <MeetingRecording
                                teamId={meeting.team.id}
                                meetingId={meeting.id}
                                meetingTitle={meeting.title}
                                meeting={meeting}
                                onChanged={() =>
                                  queryClient.invalidateQueries({ queryKey: ["/api/my-meetings"] })
                                }
                              />
                            )}
                          </div>
                          {/* Upload MOM button — past meetings, allowed roles only */}
                          {isMeetingPast && canUploadMom && (
                            <div className="ml-2 flex gap-2">
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
                          )}
                          {/* Edit button — upcoming meetings, allowed roles only */}
                          {!isMeetingPast && canCreateMeeting && (
                            <div className="ml-2 flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingMeeting(meeting)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Meeting Dialog */}
        {canCreateMeeting && (
          <CreateMeetingDialog
            open={showCreateDialog || !!editingMeeting}
            onOpenChange={(o) => {
              if (!o) { setShowCreateDialog(false); setEditingMeeting(null); }
              else setShowCreateDialog(true);
            }}
            teamId={initialTeamId}
            teams={userTeams}
            existingMeeting={editingMeeting}
            onSuccess={() => { setShowCreateDialog(false); setEditingMeeting(null); }}
          />
        )}

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
                <Input
                  id="mom-document"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  ref={fileInputRef}
                  onChange={(e) => setMomFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {momFile && (
                  <p className="text-xs text-muted-foreground">Selected: {momFile.name}</p>
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
    </AppLayout>
  );
}
