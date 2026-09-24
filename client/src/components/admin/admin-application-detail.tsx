import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  Pencil,
  User,
  X,
  IndianRupee,
} from "lucide-react";
import { format } from "date-fns";
import { AdminPaymentDialog } from "@/components/payment/admin-payment-dialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Upload } from "lucide-react";

interface ApplicationDetail {
  id: string;
  type: string;
  status: string;
  formData?: any;
  formJson?: any;
  meetingScheduledAt?: string;
  meetingLink?: string;
  meetingAgenda?: string;
  paymentConfirmed?: boolean;
  selectionNotes?: string;
  createdAt: string;
  selectedCohort?: { id: string; name: string } | null;
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

interface DocumentInfo {
  fileName: string;
  fileSize: number;
  fileType: string;
  downloadUrl: string;
  viewUrl?: string;
}

export default function AdminApplicationDetailPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, params] = useRoute("/app/admin/applications/:id");
  const applicationId = params?.id;

  const [showManualPaymentDialog, setShowManualPaymentDialog] = useState(false);
  const [showRazorpayPaymentDialog, setShowRazorpayPaymentDialog] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showCreateCredentialsDialog, setShowCreateCredentialsDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [showCredentialDialog, setShowCredentialDialog] = useState(false);
  const [showAcceptTeamDialog, setShowAcceptTeamDialog] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionReferenceId, setTransactionReferenceId] = useState("");
  const [installmentId, setInstallmentId] = useState("");
  const [proofAttachmentUrl, setProofAttachmentUrl] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [meetingAgenda, setMeetingAgenda] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [editedPassword, setEditedPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const { data: application, isLoading, error, refetch } = useQuery<ApplicationDetail>({
    queryKey: ["/api/admin/applications", applicationId],
    queryFn: async () => {
      const data = await apiRequest("GET", `/admin/applications/${applicationId}`);
      return data;
    },
    enabled: !!applicationId && !!user,
  });

  const { data: cvDocument, isLoading: loadingCv } = useQuery<DocumentInfo>({
    queryKey: ["/api/admin/applications", applicationId, "documents", "cv"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/admin/applications/${applicationId}/documents/cv`);
      return data;
    },
    enabled: !!applicationId && !!user && application?.type !== "TEAM",
  });

  const { data: cohorts = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/cohorts"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/cohorts");
      return data;
    },
    enabled: !!user && application?.type === "TEAM",
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentData: {
      amountPaid: string;
      paymentDate: string;
      paymentMethod: string;
      transactionReferenceId?: string;
      installmentId?: string;
      notes?: string;
      proofAttachmentUrl?: string;
    }) => {
      return apiRequest("POST", `/admin/applications/${applicationId}/confirm-payment`, paymentData);
    },
    onSuccess: async (data) => {
      toast({
        title: "Payment confirmed",
        description: "Manual payment has been recorded successfully.",
      });
      setShowManualPaymentDialog(false);
      // Reset all form fields
      setAmountPaid("");
      setPaymentDate("");
      setPaymentMethod("");
      setTransactionReferenceId("");
      setInstallmentId("");
      setPaymentNotes("");
      setProofAttachmentUrl("");
      
      // Refetch to get updated application data
      const { data: updatedApplication } = await refetch();
      
      // After payment confirmation, automatically open Accept Application dialog
      // if payment is confirmed and status is not ACCEPTED
      if (updatedApplication && updatedApplication.paymentConfirmed && updatedApplication.status !== "ACCEPTED") {
        setShowAcceptDialog(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to confirm payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/admin/applications/${applicationId}/accept`);
    },
    onSuccess: (data) => {
      console.log("✅ Accept application response:", data);
      console.log("✅ Credentials in response:", data.credentials);
      
      // Check if credentials exist in the response
      if (data.credentials && data.credentials.email && data.credentials.password) {
        console.log("✅ Setting credentials:", data.credentials);
        setGeneratedCredentials(data.credentials);
        // Store userId if available for password updates
        if (data.userId) {
          setUserId(data.userId);
        }
        setShowCreateCredentialsDialog(false);
        setShowCredentialDialog(true);
      } else {
        // If no credentials (e.g., user already exists), show message
        console.warn("⚠️ No credentials in response:", data);
        toast({
          title: "Application accepted",
          description: data.message || "Application has been accepted. " + (data.existingUserEmail ? `User already exists: ${data.existingUserEmail}` : ""),
        });
        setShowCreateCredentialsDialog(false);
      }
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to accept application",
        description: error.message,
        variant: "destructive",
      });
      setShowCreateCredentialsDialog(false);
    },
  });

  const acceptTeamMutation = useMutation({
    mutationFn: async (data: { cohortId: string; selectionNotes?: string }) => {
      return apiRequest("POST", `/admin/applications/${applicationId}/accept`, data);
    },
    onSuccess: () => {
      toast({ title: "Team application accepted", description: "Invites have been sent to all members." });
      setShowAcceptTeamDialog(false);
      setSelectedCohortId("");
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept team application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const scheduleMeetingMutation = useMutation({
    mutationFn: async (data: { date: string; time: string; agenda: string }) => {
      return apiRequest("POST", `/admin/applications/${applicationId}/schedule-meeting`, data);
    },
    onSuccess: () => {
      toast({
        title: "Meeting scheduled",
        description: "Meeting has been scheduled and emails have been sent.",
      });
      setShowMeetingDialog(false);
      setMeetingDate("");
      setMeetingTime("");
      setMeetingAgenda("");
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to schedule meeting",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateAgendaMutation = useMutation({
    mutationFn: async (agenda: string) => {
      return apiRequest("PATCH", `/admin/applications/${applicationId}/meeting`, { agenda });
    },
    onSuccess: () => {
      toast({
        title: "Agenda updated",
        description: "Meeting agenda has been updated.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update agenda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScheduleMeeting = () => {
    if (!meetingDate || !meetingTime) {
      toast({
        title: "Missing information",
        description: "Please select both date and time.",
        variant: "destructive",
      });
      return;
    }
    scheduleMeetingMutation.mutate({
      date: meetingDate,
      time: meetingTime,
      agenda: meetingAgenda,
    });
  };

  const handleUpdateAgenda = () => {
    if (!meetingAgenda.trim()) {
      toast({
        title: "Agenda required",
        description: "Please enter a meeting agenda.",
        variant: "destructive",
      });
      return;
    }
    updateAgendaMutation.mutate(meetingAgenda);
  };

  const copyCredentials = () => {
    if (generatedCredentials) {
      const text = `Email: ${generatedCredentials.email}\nPassword: ${generatedCredentials.password}`;
      navigator.clipboard.writeText(text);
      toast({
        title: "Credentials copied",
        description: "Credentials have been copied to clipboard.",
      });
    }
  };

  // Password validation function
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/\d/.test(password)) {
      return "Password must include at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return "Password must include at least one special character";
    }
    return null;
  };

  // Toggle password edit mode
  const handleToggleEditPassword = () => {
    if (isEditingPassword) {
      // Cancel editing
      setIsEditingPassword(false);
      setEditedPassword("");
      setPasswordError("");
    } else {
      // Start editing
      setIsEditingPassword(true);
      setEditedPassword(generatedCredentials?.password || "");
      setPasswordError("");
    }
  };

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string; email: string }) => {
      return apiRequest("PUT", `/admin/users/${data.userId}/update-password`, {
        newPassword: data.newPassword,
        email: data.email,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Password updated",
        description: "Password has been updated and sent via email.",
      });
      // Update local credentials state
      if (generatedCredentials) {
        setGeneratedCredentials({
          ...generatedCredentials,
          password: editedPassword,
        });
      }
      setIsEditingPassword(false);
      setPasswordError("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update password",
        description: error.message || "Could not update password",
        variant: "destructive",
      });
    },
  });

  // Handle done button click
  const handleDoneClick = () => {
    if (isEditingPassword) {
      // Validate password before updating
      const error = validatePassword(editedPassword);
      if (error) {
        setPasswordError(error);
        return;
      }

      if (!userId) {
        toast({
          title: "Error",
          description: "User ID not available for password update",
          variant: "destructive",
        });
        return;
      }

      // Update password
      updatePasswordMutation.mutate({
        userId: userId,
        newPassword: editedPassword,
        email: generatedCredentials?.email || "",
      });
    } else {
      // Original behavior - just close dialog
      setShowCredentialDialog(false);
      setLocation("/app/admin/applications");
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

  if (error || !application) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load application details.</p>
              <Button onClick={() => setLocation("/app/admin/applications")} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Applications
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const formData = application.formData || application.formJson || {};

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/app/admin/applications")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Application Details</h1>
              <p className="text-muted-foreground mt-1">
                {formData.fullName || "Unknown"} - {application.type}
              </p>
            </div>
          </div>
          <Badge variant={application.status === "ACCEPTED" ? "default" : "outline"}>
            {application.status}
          </Badge>
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
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
              <div>
                <Label className="text-muted-foreground">Full Name</Label>
                <p className="font-medium break-words">{formData.fullName || "N/A"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium break-words">{formData.email || "N/A"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p className="font-medium break-words">{formData.phone || formData.contactNumber || "N/A"}</p>
              </div>
              {formData.dateOfBirth && (
                <div>
                  <Label className="text-muted-foreground">Date of Birth</Label>
                  <p className="font-medium break-words">{formData.dateOfBirth}</p>
                </div>
              )}
              {formData.gender && (
                <div>
                  <Label className="text-muted-foreground">Gender</Label>
                  <p className="font-medium break-words">{formData.gender}</p>
                </div>
              )}
              {formData.currentLocation && (
                <div>
                  <Label className="text-muted-foreground">Current Location</Label>
                  <p className="font-medium break-words">{formData.currentLocation}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Education</Label>
                <p className="font-medium break-words">{formData.education || formData.highestQualification || "N/A"}</p>
              </div>
              {formData.university && (
                <div>
                  <Label className="text-muted-foreground">University</Label>
                  <p className="font-medium break-words">{formData.university}</p>
                </div>
              )}
              {formData.workExperience && (
                <div>
                  <Label className="text-muted-foreground">Work Experience</Label>
                  <p className="font-medium break-words">{formData.workExperience}</p>
                </div>
              )}
              {formData.linkedinUrl && (
                <div>
                  <Label className="text-muted-foreground">LinkedIn</Label>
                  <a href={formData.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {formData.linkedinUrl}
                  </a>
                </div>
              )}
              {formData.githubUrl && (
                <div>
                  <Label className="text-muted-foreground">GitHub</Label>
                  <a href={formData.githubUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {formData.githubUrl}
                  </a>
                </div>
              )}
              {formData.portfolioUrl && (
                <div>
                  <Label className="text-muted-foreground">Portfolio URL</Label>
                  <a href={formData.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                    {formData.portfolioUrl}
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
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
              <div>
                <Label className="text-muted-foreground">Application Type</Label>
                <p className="font-medium">{application.type}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Badge variant={application.status === "ACCEPTED" ? "default" : "outline"}>
                  {application.status}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Applied On</Label>
                <p className="font-medium">{format(new Date(application.createdAt), "PPP")}</p>
              </div>
              
              {/* Selected Cohort for Interns */}
              {(application.type === "LEARNER" || application.type === "PROFESSIONAL") && application.selectedCohort && (
                <div>
                  <Label className="text-muted-foreground">Selected Cohort</Label>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 mt-1">
                    {application.selectedCohort.name}
                  </Badge>
                </div>
              )}
              
              {/* Mentor-specific fields */}
              {application.type === "MENTOR" && (
                <>
                  {/* Educational Background */}
                  {formData.highestQualification && (
                    <div>
                      <Label className="text-muted-foreground">Highest Qualification</Label>
                      <p className="font-medium break-words">{formData.highestQualification}</p>
                    </div>
                  )}
                  {formData.institutionName && (
                    <div>
                      <Label className="text-muted-foreground">Institution Name</Label>
                      <p className="font-medium break-words">{formData.institutionName}</p>
                    </div>
                  )}
                  {formData.yearOfCompletion && (
                    <div>
                      <Label className="text-muted-foreground">Year of Completion</Label>
                      <p className="font-medium">{formData.yearOfCompletion}</p>
                    </div>
                  )}
                  {formData.specialization && (
                    <div>
                      <Label className="text-muted-foreground">Specialization/Branch</Label>
                      <p className="font-medium break-words">{formData.specialization}</p>
                    </div>
                  )}

                  {/* Professional Experience */}
                  {formData.totalExperience && (
                    <div>
                      <Label className="text-muted-foreground">Total Experience</Label>
                      <p className="font-medium break-words">{formData.totalExperience}</p>
                    </div>
                  )}
                  {formData.currentCompany && (
                    <div>
                      <Label className="text-muted-foreground">Current/Last Company</Label>
                      <p className="font-medium break-words">{formData.currentCompany}</p>
                    </div>
                  )}
                  {formData.jobTitle && (
                    <div>
                      <Label className="text-muted-foreground">Job Title/Role</Label>
                      <p className="font-medium break-words">{formData.jobTitle}</p>
                    </div>
                  )}
                  {formData.keySkills && (
                    <div>
                      <Label className="text-muted-foreground">Key Skills & Expertise</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.keySkills}</p>
                    </div>
                  )}

                  {/* Domains */}
                  {formData.domains && Array.isArray(formData.domains) && formData.domains.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Areas of Interest</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {formData.domains.map((domain: string, idx: number) => (
                          <Badge key={idx} variant="outline">{domain}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {formData.otherDomain && (
                    <div>
                      <Label className="text-muted-foreground">Other Domain</Label>
                      <p className="font-medium break-words">{formData.otherDomain}</p>
                    </div>
                  )}

                  {/* Mentorship Experience */}
                  {formData.previousMentoringRoles && (
                    <div>
                      <Label className="text-muted-foreground">Previous Mentoring Roles</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.previousMentoringRoles}</p>
                    </div>
                  )}
                  {formData.batchStudentsGuided && (
                    <div>
                      <Label className="text-muted-foreground">Batch/Students Guided</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.batchStudentsGuided}</p>
                    </div>
                  )}
                  {formData.certificationsRewards && (
                    <div>
                      <Label className="text-muted-foreground">Certifications & Rewards</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.certificationsRewards}</p>
                    </div>
                  )}

                  {/* Motivation */}
                  {formData.motivation && (
                    <div>
                      <Label className="text-muted-foreground">Motivation</Label>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.motivation}</p>
                    </div>
                  )}

                  {/* Availability */}
                  {formData.weeklyAvailableHours && (
                    <div>
                      <Label className="text-muted-foreground">Weekly Available Hours</Label>
                      <p className="font-medium break-words">{formData.weeklyAvailableHours}</p>
                    </div>
                  )}
                  {formData.preferredMode && (
                    <div>
                      <Label className="text-muted-foreground">Preferred Mode</Label>
                      <p className="font-medium break-words">{formData.preferredMode}</p>
                    </div>
                  )}
                  {formData.earliestJoiningDate && (
                    <div>
                      <Label className="text-muted-foreground">Earliest Joining Date</Label>
                      <p className="font-medium break-words">{formData.earliestJoiningDate}</p>
                    </div>
                  )}

                  {/* Compliance */}
                  <div>
                    <Label className="text-muted-foreground">Compliance & Agreement</Label>
                    <div className="space-y-1 mt-1 text-sm">
                      <p>Follow Guidelines: {formData.followGuidelines ? "✓ Agreed" : "✗ Not Agreed"}</p>
                      <p>Assist in Assessments: {formData.assistAssessments ? "✓ Agreed" : "✗ Not Agreed"}</p>
                      <p>Participate in Reviews: {formData.participateReviews ? "✓ Agreed" : "✗ Not Agreed"}</p>
                    </div>
                  </div>

                  {/* Signature */}
                  {formData.signatureName && (
                    <div>
                      <Label className="text-muted-foreground">Signature</Label>
                      <p className="font-medium break-words">{formData.signatureName}</p>
                      {formData.signatureDate && (
                        <p className="text-sm text-muted-foreground">Date: {formData.signatureDate}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Other application types */}
              {(Array.isArray(formData.preferredTracks) && formData.preferredTracks.length > 0) || formData.preferredTrack ? (
                <div>
                  <Label className="text-muted-foreground">Interested Industry</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.isArray(formData.preferredTracks) ? (
                      formData.preferredTracks.map((track: string, idx: number) => (
                        <Badge key={idx} variant="outline">{track}</Badge>
                      ))
                    ) : (
                      <Badge variant="outline">{formData.preferredTrack}</Badge>
                    )}
                  </div>
                </div>
              ) : null}
              
              {/* Student/Professional Status - For Interns */}
              {(application.type === "LEARNER" || application.type === "PROFESSIONAL") && typeof formData.isStudent === 'boolean' && (
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={formData.isStudent ? "default" : "secondary"}>
                    {formData.isStudent ? "Student" : "Working Professional"}
                  </Badge>
                </div>
              )}
              
              {/* Year of Study - For Interns (Students) */}
              {(application.type === "LEARNER" || application.type === "PROFESSIONAL") && formData.yearOfStudy && (
                <div>
                  <Label className="text-muted-foreground">Year of Study</Label>
                  <p className="font-medium">{formData.yearOfStudy}</p>
                </div>
              )}
              
              {/* Intern-specific fields */}
              {(application.type === "LEARNER" || application.type === "PROFESSIONAL") && (
                <>
                  {/* Interested Role for Interns */}
                  {formData.interestedRole && (
                    <div>
                      <Label className="text-muted-foreground">Which role are you interested in?</Label>
                      <Badge variant="secondary">
                        {formData.interestedRole === "TECHNICAL" ? "Technical Role" : 
                         formData.interestedRole === "BUSINESS" ? "Business Role" : 
                         formData.interestedRole === "MIXED" ? "Mixed Role" :
                         formData.interestedRole}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Project Readiness */}
                  {(typeof formData.readyForProjects === 'boolean' || typeof formData.needsTraining === 'boolean') && (
                    <div>
                      <Label className="text-muted-foreground">Project Readiness</Label>
                      <Badge variant={formData.readyForProjects ? "default" : "secondary"}>
                        {formData.readyForProjects 
                          ? "Ready to work on projects immediately" 
                          : formData.needsTraining 
                            ? "Prefers training before project assignment" 
                            : "Not specified"}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Technical Skills */}
                  {formData.technicalSkills && Array.isArray(formData.technicalSkills) && formData.technicalSkills.length > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Technical Skills</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {formData.technicalSkills.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="outline">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Plan - For Interns Only */}
                  {formData.plan && (
                    <div>
                      <Label className="text-muted-foreground">Plan</Label>
                      <Badge variant={formData.plan === "premium" ? "default" : "outline"}>
                        {formData.plan === "premium" ? "Premium" : "Basic"}
                      </Badge>
                    </div>
                  )}
                </>
              )}
              
              {/* Co-Founder Role Selection */}
              {application.type === "COFOUNDER" && formData.interestedRole && (
                <div>
                  <Label className="text-muted-foreground">Which role are you applying for?</Label>
                  <Badge variant="secondary">
                    {formData.interestedRole === "CTO" ? "Chief Technology Officer (CTO)" : 
                     formData.interestedRole === "CBO" ? "Chief Business Officer (CBO)" : 
                     formData.interestedRole}
                  </Badge>
                </div>
              )}
              
              {formData.motivation && application.type !== "MENTOR" && (
                <div>
                  <Label className="text-muted-foreground">Why do you want to join StartupUniv?</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.motivation}</p>
                </div>
              )}
              {formData.founderQuestion1 && (
                <div>
                  <Label className="text-muted-foreground">What is your vision for the startup you want to build?</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.founderQuestion1}</p>
                </div>
              )}
              {formData.founderQuestion2 && (
                <div>
                  <Label className="text-muted-foreground">What leadership experience do you bring to the table?</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.founderQuestion2}</p>
                </div>
              )}
              {formData.cofounderQuestion1 && (
                <div>
                  <Label className="text-muted-foreground">How do you plan to drive sales and market growth?</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.cofounderQuestion1}</p>
                </div>
              )}
              {formData.cofounderQuestion2 && (
                <div>
                  <Label className="text-muted-foreground">What is your experience in sales, marketing, or business development?</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.cofounderQuestion2}</p>
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
              {application.type === "TEAM" ? "Team Members" : "Documents"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {application.type === "TEAM" ? (
              application.teamMembers && application.teamMembers.length > 0 ? (
                <div className="space-y-3">
                  {application.teamMembers.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{member.fullName}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-accent text-accent-foreground rounded">
                              {member.role}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Member {index + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{member.status}</p>
                        {member.cofounderRole && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Co-founder: {member.cofounderRole}
                          </p>
                        )}
                        {member.internTrack && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Track: {member.internTrack}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No team members found</p>
              )
            ) : (
              loadingCv ? (
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
                        const downloadUrl = `/api/admin/applications/${applicationId}/documents/cv/download`;
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
                <p className="text-muted-foreground">No CV uploaded</p>
              )
            )}
          </CardContent>
        </Card>

        {/* Certificates and ID Proof */}
        {formData && (
          <>
            {/* Certificates */}
            {formData.certificates && Array.isArray(formData.certificates) && formData.certificates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Certificates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {formData.certificates.map((cert: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{cert.fileName || `Certificate ${idx + 1}`}</p>
                            {cert.url && (
                              <p className="text-sm text-muted-foreground">Certificate uploaded</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                // Get signed URL for viewing certificate
                                const docResponse = await apiRequest("GET", `/admin/applications/${application.id}/documents/certificate?index=${idx}`);
                                window.open(docResponse.viewUrl || docResponse.downloadUrl, "_blank");
                              } catch (error) {
                                // Fallback to stored URL
                                if (cert.url) {
                                  window.open(cert.url, "_blank");
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to view certificate",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                // Get signed URL for downloading certificate
                                const docResponse = await apiRequest("GET", `/admin/applications/${application.id}/documents/certificate?index=${idx}`);
                                const link = document.createElement("a");
                                link.href = docResponse.downloadUrl;
                                link.download = docResponse.fileName || `certificate-${idx + 1}.pdf`;
                                link.target = "_blank";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              } catch (error) {
                                // Fallback to stored URL
                                if (cert.url) {
                                  const link = document.createElement("a");
                                  link.href = cert.url;
                                  link.download = cert.fileName || `certificate-${idx + 1}.pdf`;
                                  link.target = "_blank";
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to download certificate",
                                    variant: "destructive",
                                  });
                                }
                              }
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ID Proof */}
            {formData.idProof && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    ID Proof
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{formData.idProof.fileName || "ID Proof"}</p>
                        {formData.idProof.url && (
                          <p className="text-sm text-muted-foreground">ID proof uploaded</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            // Get signed URL for viewing ID proof
                            const docResponse = await apiRequest("GET", `/admin/applications/${application.id}/documents/id-proof`);
                            window.open(docResponse.viewUrl || docResponse.downloadUrl, "_blank");
                          } catch (error) {
                            // Fallback to stored URL
                            if (formData.idProof.url) {
                              window.open(formData.idProof.url, "_blank");
                            } else {
                              toast({
                                title: "Error",
                                description: "Failed to view ID proof",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            // Get signed URL for downloading ID proof
                            const docResponse = await apiRequest("GET", `/admin/applications/${application.id}/documents/id-proof`);
                            const link = document.createElement("a");
                            link.href = docResponse.downloadUrl;
                            link.download = docResponse.fileName || "id-proof.pdf";
                            link.target = "_blank";
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch (error) {
                            // Fallback to stored URL
                            if (formData.idProof.url) {
                              const link = document.createElement("a");
                              link.href = formData.idProof.url;
                              link.download = formData.idProof.fileName || "id-proof.pdf";
                              link.target = "_blank";
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            } else {
                              toast({
                                title: "Error",
                                description: "Failed to download ID proof",
                                variant: "destructive",
                              });
                            }
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Meeting Information */}
        {application.meetingScheduledAt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Scheduled Meeting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Scheduled Date & Time</Label>
                <p className="font-medium">
                  {format(new Date(application.meetingScheduledAt), "PPP 'at' p")}
                </p>
              </div>
              {application.meetingLink && (
                <div>
                  <Label className="text-muted-foreground">Meeting Link</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={application.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {application.meetingLink}
                    </a>
                  </div>
                </div>
              )}
              {application.meetingAgenda && (
                <div>
                  <Label className="text-muted-foreground">Agenda</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{application.meetingAgenda}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMeetingAgenda(application.meetingAgenda || "");
                    setShowMeetingDialog(true);
                  }}
                >
                  Edit Agenda
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions Section */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            {!application.meetingScheduledAt && (
              <Button onClick={() => setShowMeetingDialog(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Meeting
              </Button>
            )}
            {application.type !== "MENTOR" && application.type !== "TEAM" && (
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowRazorpayPaymentDialog(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {application.status === "OFFER" || application.status === "PARTIALLY_PAID" ? "View Payment" : "Initiate Payment"}
                </Button>
                {application.status !== "PARTIALLY_PAID" && application.status !== "FULLY_PAID" && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Pre-populate notes if payment is already confirmed
                      if (application.paymentConfirmed && application.selectionNotes) {
                        setPaymentNotes(application.selectionNotes);
                      } else {
                        setPaymentNotes("");
                      }
                      setShowManualPaymentDialog(true);
                    }}
                  >
                    Manual Payment
                  </Button>
                )}
                {(application.status === "OFFER" || application.status === "PARTIALLY_PAID" || application.status === "FULLY_PAID" || application.paymentConfirmed) && (
                  <Button 
                    variant="outline"
                    onClick={() => setLocation(`/app/admin/applications/${applicationId}/payment-details`)}
                  >
                    <IndianRupee className="h-4 w-4 mr-2" />
                    Payment Details Page
                  </Button>
                )}
              </div>
            )}
            {application.type === "TEAM" && application.status !== "ACCEPTED" && (
              <Button
                onClick={() => setShowAcceptTeamDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept & Send Invites
              </Button>
            )}
            {((application.paymentConfirmed && application.type !== "TEAM") || application.type === "MENTOR") && application.status !== "ACCEPTED" && (
              <Button
                onClick={() => setShowAcceptDialog(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept Application
              </Button>
            )}
            {(application.status === "PARTIALLY_PAID" || application.status === "FULLY_PAID") && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowCreateCredentialsDialog(true)}
              >
                Create Credentials
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Razorpay Payment Dialog */}
        <AdminPaymentDialog
          open={showRazorpayPaymentDialog}
          onOpenChange={setShowRazorpayPaymentDialog}
          application={application}
        />

        {/* Manual Payment Confirmation Dialog */}
        <Dialog 
          open={showManualPaymentDialog} 
          onOpenChange={(open) => {
            setShowManualPaymentDialog(open);
            if (!open) {
              // Reset all fields when dialog closes
              setAmountPaid("");
              setPaymentDate("");
              setPaymentMethod("");
              setTransactionReferenceId("");
              setInstallmentId("");
              setPaymentNotes("");
              setProofAttachmentUrl("");
            }
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Manual Payment</DialogTitle>
              <DialogDescription>
                Enter the details of the offline payment received from the candidate.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Amount Paid - Required */}
              <div>
                <Label htmlFor="amount-paid">
                  Amount Paid <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="amount-paid"
                  type="number"
                  step="0.01"
                  placeholder="Enter amount paid"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  required
                />
              </div>

              {/* Payment Date - Required */}
              <div>
                <Label htmlFor="payment-date">
                  Payment Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="payment-date"
                  type="datetime-local"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              {/* Payment Method - Required */}
              <div>
                <Label htmlFor="payment-method">
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Demand Draft">Demand Draft</SelectItem>
                    <SelectItem value="POS/Card">POS/Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Transaction Reference ID - Optional but recommended for non-cash */}
              <div>
                <Label htmlFor="transaction-ref">
                  Transaction / Reference ID
                  {paymentMethod && paymentMethod !== "Cash" && (
                    <span className="text-orange-500 ml-1">(Recommended)</span>
                  )}
                </Label>
                <Input
                  id="transaction-ref"
                  type="text"
                  placeholder="Enter transaction ID, UPI reference, cheque number, etc."
                  value={transactionReferenceId}
                  onChange={(e) => setTransactionReferenceId(e.target.value)}
                />
                {paymentMethod && paymentMethod !== "Cash" && !transactionReferenceId && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Please provide transaction reference for verification
                  </p>
                )}
              </div>

              {/* Installment ID - Optional */}
              <div>
                <Label htmlFor="installment-id">Installment (Optional)</Label>
                <Input
                  id="installment-id"
                  type="text"
                  placeholder="Leave empty if paying full amount or not installment-based"
                  value={installmentId}
                  onChange={(e) => setInstallmentId(e.target.value)}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter installment ID if this payment is for a specific installment
                </p>
              </div>

              {/* Proof Attachment - Optional */}
              <div>
                <Label>Proof Document (Optional)</Label>
                <div className="space-y-2">
                  <ObjectUploader
                    acceptedTypes=".pdf,image/*"
                    maxFileSize={10 * 1024 * 1024} // 10MB
                    onGetUploadParameters={async (file) => {
                      const response = await apiRequest("POST", "/api/payments/proof/upload-url", {
                        fileName: file.name,
                        fileType: file.type,
                        applicationId: applicationId,
                      });
                      const uploadUrl = response.uploadUrl || response.uploadURL;
                      if (!uploadUrl) {
                        throw new Error("No upload URL received from server");
                      }
                      return {
                        method: "PUT" as const,
                        url: uploadUrl,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl, objectKey, fileName) => {
                      if (fileUrl) {
                        setProofAttachmentUrl(fileUrl);
                        toast({
                          title: "File uploaded successfully",
                          description: `Proof document "${fileName}" has been uploaded.`,
                        });
                      }
                    }}
                    onError={(error) => {
                      toast({
                        title: "Upload failed",
                        description: error.message,
                        variant: "destructive",
                      });
                    }}
                    getViewUrlEndpoint="/api/payments/proof/view-url"
                    title="Upload Payment Proof"
                    description="Upload PDF or image (max 10MB)"
                  >
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Proof Document
                    </Button>
                  </ObjectUploader>
                  {proofAttachmentUrl && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-md">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400">
                        Proof document uploaded successfully
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setProofAttachmentUrl("");
                        }}
                        className="ml-auto h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Upload a PDF or image file (receipt, screenshot, bank statement, etc.) as proof of payment
                  </p>
                </div>
              </div>

              {/* Notes - Optional */}
              <div>
                <Label htmlFor="payment-notes">Notes (Optional)</Label>
                <Textarea
                  id="payment-notes"
                  placeholder="Add any additional notes about the payment..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManualPaymentDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!amountPaid || !paymentDate || !paymentMethod) {
                    toast({
                      title: "Missing required fields",
                      description: "Please fill in Amount Paid, Payment Date, and Payment Method.",
                      variant: "destructive",
                    });
                    return;
                  }
                  confirmPaymentMutation.mutate({
                    amountPaid,
                    paymentDate,
                    paymentMethod,
                    transactionReferenceId: transactionReferenceId || undefined,
                    installmentId: installmentId || undefined,
                    notes: paymentNotes || undefined,
                    proofAttachmentUrl: proofAttachmentUrl || undefined,
                  });
                }}
                disabled={confirmPaymentMutation.isPending}
              >
                {confirmPaymentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording Payment...
                  </>
                ) : (
                  "Record Payment"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Accept Application Dialog */}
        <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept Application</DialogTitle>
              <DialogDescription>
                {application?.type === "MENTOR" 
                  ? "This will mark the application as accepted. You'll then need to create credentials for the mentor."
                  : "This will create a user account and send login credentials via email. Are you sure?"}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAcceptDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (application?.type === "MENTOR") {
                    setShowAcceptDialog(false);
                    setShowCreateCredentialsDialog(true);
                  } else {
                    acceptMutation.mutate();
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                {application?.type === "MENTOR" ? "Accept" : "Accept & Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Credentials Dialog for Mentors */}
        <Dialog open={showCreateCredentialsDialog} onOpenChange={setShowCreateCredentialsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Credentials & Share</DialogTitle>
              <DialogDescription>
                Generate login credentials for {application?.formData?.fullName || "this mentor"} and send them via email.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCredentialsDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create and Share"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Credentials Confirmation Dialog */}
        <Dialog open={showCredentialDialog} onOpenChange={setShowCredentialDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Credentials Generated</DialogTitle>
              <DialogDescription>
                User account has been created. Credentials have been sent via email.
              </DialogDescription>
            </DialogHeader>
            {generatedCredentials && generatedCredentials.email && generatedCredentials.password ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-muted to-card border-2 border-border rounded-lg space-y-3">
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground mb-1 block">Email</Label>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-base font-semibold text-foreground bg-white px-3 py-2 rounded border border-border flex-1">
                        {generatedCredentials.email}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCredentials.email);
                          toast({
                            title: "Email copied",
                            description: "Email address has been copied to clipboard.",
                          });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground mb-1 block">Password</Label>
                    <div className="flex items-center gap-2">
                      {!isEditingPassword ? (
                        <p className="font-mono text-base font-semibold text-foreground bg-white px-3 py-2 rounded border border-border flex-1">
                          {generatedCredentials.password}
                        </p>
                      ) : (
                        <Input
                          type="text"
                          value={editedPassword}
                          onChange={(e) => {
                            setEditedPassword(e.target.value);
                            setPasswordError("");
                          }}
                          className="font-mono text-base font-semibold flex-1"
                          placeholder="Enter new password"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={handleToggleEditPassword}
                        title={isEditingPassword ? "Cancel edit" : "Edit password"}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!isEditingPassword && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedCredentials.password);
                            toast({
                              title: "Password copied",
                              description: "Password has been copied to clipboard.",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {passwordError && (
                      <p className="text-sm text-destructive mt-1">{passwordError}</p>
                    )}
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={copyCredentials} 
                  className="w-full border-primary text-primary hover:bg-accent"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Credentials
                </Button>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p>Loading credentials...</p>
              </div>
            )}
            <DialogFooter>
              <Button 
                onClick={handleDoneClick}
                disabled={updatePasswordMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {updatePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Meeting Dialog */}
        <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Meeting</DialogTitle>
              <DialogDescription>
                Create a Google Calendar event and send meeting invites to the candidate and admin.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meeting-date">Date</Label>
                  <Input
                    id="meeting-date"
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <Label htmlFor="meeting-time">Time</Label>
                  <Input
                    id="meeting-time"
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="meeting-agenda">Meeting Agenda</Label>
                <Textarea
                  id="meeting-agenda"
                  placeholder="Enter meeting agenda..."
                  value={meetingAgenda}
                  onChange={(e) => setMeetingAgenda(e.target.value)}
                  rows={6}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  You can edit this before sending the meeting invite.
                </p>
              </div>
              {meetingDate && meetingTime && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Meeting Preview:</p>
                  <p className="text-sm">
                    <strong>Date:</strong> {format(new Date(`${meetingDate}T${meetingTime}`), "PPP 'at' p")}
                  </p>
                  {meetingAgenda && (
                    <p className="text-sm mt-2">
                      <strong>Agenda:</strong> {meetingAgenda}
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleScheduleMeeting}
                disabled={scheduleMeetingMutation.isPending || !meetingDate || !meetingTime}
              >
                {scheduleMeetingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Schedule & Send Invites
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Accept Team Dialog */}
        <Dialog open={showAcceptTeamDialog} onOpenChange={setShowAcceptTeamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accept Team Application</DialogTitle>
              <DialogDescription>
                Select a cohort. Invitations will be emailed to all team members.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Cohort</Label>
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
                  acceptTeamMutation.mutate({ cohortId: selectedCohortId });
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


