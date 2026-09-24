import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
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
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  Send,
  User,
} from "lucide-react";
import { format } from "date-fns";

interface ApplicationDetail {
  id: string;
  type: string;
  status: string;
  formData: any;
  createdAt: string;
  teamMembers?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    cofounderRole?: string | null;
    internTrack?: string | null;
    status: string;
    individualApplicationId?: string | null;
  }>;
}

interface Assessment {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
}

interface DocumentInfo {
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadUrl: string;
  viewUrl?: string;
}

interface Cohort {
  id: string;
  name: string;
}

export default function ManagerApplicationDetailPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, params] = useRoute("/app/manager/applications/:id");
  const applicationId = params?.id;

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [showAcceptTeamDialog, setShowAcceptTeamDialog] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");

  const { data: application, isLoading, error } = useQuery<ApplicationDetail>({
    queryKey: ["/api/manager/applications", applicationId],
    queryFn: async () => {
      try {
        const data = await apiRequest("GET", `/manager/applications/${applicationId}`);
        return data;
      } catch (err: any) {
        console.error("Error fetching application:", err);
        throw err;
      }
    },
    enabled: !!applicationId && !!user,
    retry: 1,
  });

  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ["/api/manager/assessments"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/manager/assessments");
      return data;
    },
    enabled: !!user,
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
    queryFn: async () => {
      return apiRequest("GET", "/cohorts");
    },
    enabled: !!user,
  });

  const { data: cvDocument, isLoading: loadingCv } = useQuery<DocumentInfo>({
    queryKey: ["/api/manager/applications", applicationId, "documents", "cv"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/manager/applications/${applicationId}/documents/cv`);
      return data;
    },
    enabled: !!applicationId && !!user && application?.type === "LEARNER",
  });

  const acceptTeamMutation = useMutation({
    mutationFn: async (cohortId: string) => {
      return apiRequest("POST", `/manager/applications/${applicationId}/accept`, { cohortId });
    },
    onSuccess: () => {
      toast({ title: "Team application accepted", description: "Invites have been sent to all members." });
      setShowAcceptTeamDialog(false);
      setSelectedCohortId("");
      queryClient.invalidateQueries({ queryKey: ["/api/manager/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/applications", applicationId] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to accept TEAM application", variant: "destructive" });
    },
  });

  const assignAssessmentMutation = useMutation({
    mutationFn: async ({ assessmentId, email }: { assessmentId: string; email: string }) => {
      return apiRequest("POST", "/manager/applications/assign-assessment", {
        applicationId: applicationId!,
        assessmentId,
        email,
      });
    },
    onSuccess: () => {
      toast({ title: "Assessment assigned successfully. Email sent to candidate." });
      setShowAssignDialog(false);
      setSelectedAssessmentId("");
      queryClient.invalidateQueries({ queryKey: ["/api/manager/applications"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to assign assessment", variant: "destructive" });
    },
  });

  const handleAssignAssessment = () => {
    if (!selectedAssessmentId || !application) {
      toast({ title: "Please select an assessment", variant: "destructive" });
      return;
    }
    assignAssessmentMutation.mutate({
      assessmentId: selectedAssessmentId,
      email: application.formData?.email || "",
    });
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

  if (error || (!isLoading && !application)) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">
                Failed to load application details.
                {error && error instanceof Error && ` ${error.message}`}
              </p>
              {applicationId && (
                <p className="text-sm text-muted-foreground mt-2">
                  Application ID: {applicationId}
                </p>
              )}
              <Button onClick={() => setLocation("/app/manager/applications")} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Applications
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!application) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  const formData = application.formData || {};

  // TEAM application view
  if (application.type === "TEAM") {
    return (
      <AppLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/app/manager/applications")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Team Application</h1>
                <p className="text-muted-foreground mt-1">
                  {formData.team_name || "Team"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={application.status === "ACCEPTED" ? "default" : "outline"}>
                {application.status}
              </Badge>
              {application.status !== "ACCEPTED" && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setShowAcceptTeamDialog(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept & Send Invites
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Team Details</CardTitle>
                <CardDescription>Submitted by team leader</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Team Name</p>
                  <p className="font-medium">{formData.team_name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Project Description</p>
                  <p className="font-medium whitespace-pre-wrap">{formData.project_description || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Leader</p>
                  <p className="font-medium">{formData.team_leader_full_name || "N/A"}</p>
                  <p className="text-sm text-muted-foreground">{formData.team_leader_email || ""}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Members</CardTitle>
                <CardDescription>Roster and submission status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(application.teamMembers || []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="font-medium">{m.fullName}</div>
                      <div className="text-sm text-muted-foreground">{m.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.role}
                        {m.cofounderRole ? ` • ${m.cofounderRole}` : ""}
                        {m.internTrack ? ` • ${m.internTrack}` : ""}
                      </div>
                    </div>
                    <Badge variant={m.status === "SUBMITTED" ? "default" : "outline"}>{m.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Dialog open={showAcceptTeamDialog} onOpenChange={setShowAcceptTeamDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Accept Team Application</DialogTitle>
                <DialogDescription>
                  Select a cohort. Invitations will be emailed to all members.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cohort</label>
                <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAcceptTeamDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!selectedCohortId || acceptTeamMutation.isPending}
                  onClick={() => {
                    if (!selectedCohortId) return;
                    acceptTeamMutation.mutate(selectedCohortId);
                  }}
                >
                  {acceptTeamMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Accept & Send Invites"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/app/manager/applications")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Application Details</h1>
              <p className="text-muted-foreground mt-1">
                {formData.fullName || "Unknown"} - {application.type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={application.status === "ACCEPTED" ? "default" : "outline"}>
              {application.status}
            </Badge>
            <Button
              onClick={() => setShowAssignDialog(true)}
              disabled={assessments.length === 0}
            >
              <Send className="h-4 w-4 mr-2" />
              Assign Assessment
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{formData.fullName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{formData.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{formData.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Education</p>
                <p className="font-medium">{formData.education || "N/A"}</p>
              </div>
              {formData.university && (
                <div>
                  <p className="text-sm text-muted-foreground">University</p>
                  <p className="font-medium">{formData.university}</p>
                </div>
              )}
              {formData.workExperience && (
                <div>
                  <p className="text-sm text-muted-foreground">Work Experience</p>
                  <p className="font-medium">{formData.workExperience}</p>
                </div>
              )}
              {formData.linkedinUrl && (
                <div>
                  <p className="text-sm text-muted-foreground">LinkedIn</p>
                  <a href={formData.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words block max-w-full">
                    {formData.linkedinUrl}
                  </a>
                </div>
              )}
              {formData.githubUrl && (
                <div>
                  <p className="text-sm text-muted-foreground">GitHub</p>
                  <a href={formData.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words block max-w-full">
                    {formData.githubUrl}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Application Type</p>
                <p className="font-medium">{application.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={application.status === "ACCEPTED" ? "default" : "outline"}>
                  {application.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Applied On</p>
                <p className="font-medium">{format(new Date(application.createdAt), "PPP")}</p>
              </div>
              {(Array.isArray(formData.preferredTracks) && formData.preferredTracks.length > 0) || formData.preferredTrack ? (
                <div>
                  <p className="text-sm text-muted-foreground">Interested Tech</p>
                  <p className="font-medium">{Array.isArray(formData.preferredTracks) ? formData.preferredTracks.join(", ") : formData.preferredTrack}</p>
                </div>
              ) : null}
              {formData.motivation && (
                <div>
                  <p className="text-sm text-muted-foreground">Why do you want to join StartupUniv?</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{formData.motivation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCv ? (
              <Skeleton className="h-20 w-full" />
            ) : cvDocument ? (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{cvDocument.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {(cvDocument.fileSize / 1024).toFixed(2)} KB • {cvDocument.fileType}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.open(cvDocument.viewUrl || cvDocument.downloadUrl, "_blank")}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View CV
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const downloadUrl = `/api/manager/applications/${applicationId}/documents/cv/download`;
                      const link = document.createElement("a");
                      link.href = downloadUrl;
                      link.download = cvDocument.fileName || "Resume.pdf";
                      link.style.display = "none";
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CV
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                No CV uploaded for this application.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Assign Assessment Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Assessment</DialogTitle>
              <DialogDescription>
                Select an assessment to assign to {formData.fullName || "the candidate"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm font-medium mb-2">Assessment</p>
                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.title} ({assessment.durationMinutes} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                An email with the assessment link will be sent to {formData.email || "the candidate's email"}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignAssessment}
                disabled={!selectedAssessmentId || assignAssessmentMutation.isPending}
              >
                {assignAssessmentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign & Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

