import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowLeft,
  Shield,
  Tag,
  Plus,
  Pencil,
  X,
  Check,
  Mail,
  Phone,
  Calendar,
  User,
  Building,
  GraduationCap,
  Briefcase,
  Link as LinkIcon,
  FileText,
  Award,
  Code,
  Globe,
  Linkedin,
  Github,
  Eye,
  IndianRupee,
  Users,
  ArrowRight,
} from "lucide-react";

interface UserDetail {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  customTag?: string | null;
  createdAt: string;
  avatarUrl?: string | null;
  organization?: string | null;
  department?: string | null;
  bio?: string | null;
}

interface ApplicationData {
  id: string;
  type: string;
  status: string;
  formJson: any;
  createdAt: string;
}

/** Exactly what GET /admin/users/:userId/teams already returns — see server/routes.ts. */
interface UserTeam {
  id: string;
  name: string;
  cohortId: string;
  teamRole: string;
  problemStatementId: string | null;
  problemStatementTitle: string | null;
}

export default function AdminUserDetailPage() {
  const [, params] = useRoute("/app/admin/users/:userId");
  const userId = params?.userId;
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: user, isLoading, error } = useQuery<UserDetail>({
    queryKey: [`/admin/users/${userId}`],
    enabled: !!userId && !!currentUser && !authLoading,
  });

  const { data: applicationData } = useQuery<{ application: ApplicationData | null }>({
    queryKey: [`/admin/users/${userId}/application`],
    enabled: !!userId && !!currentUser && !authLoading,
  });

  // Pre-existing endpoint (already used by the founder problem-statement picker) — this page
  // just never called it. Empty array is a real, valid answer: it means the person is not
  // currently on any team, not that the request failed.
  const { data: userTeams, isLoading: teamsLoading } = useQuery<UserTeam[]>({
    queryKey: [`/admin/users/${userId}/teams`],
    enabled: !!userId && !!currentUser && !authLoading,
  });

  const application = applicationData?.application;
  const formData = application?.formJson || {};

  // Custom tag editing state (admin-assigned tag for learners/mentors)
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");

  const updateTagMutation = useMutation({
    mutationFn: async (customTag: string | null) => {
      return apiRequest("PATCH", `/admin/users/${userId}/tag`, { customTag });
    },
    onSuccess: (_data, customTag) => {
      queryClient.invalidateQueries({ queryKey: [`/admin/users/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/admin/users"] });
      setIsEditingTag(false);
      toast({
        title: customTag ? "Tag saved" : "Tag removed",
        description: customTag
          ? `"${customTag}" is now shown on this user's profile.`
          : "The tag has been removed from this user's profile.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update tag",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  const handleSaveTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) {
      setIsEditingTag(false);
      return;
    }
    updateTagMutation.mutate(trimmed);
  };

  // Fetch CV document if application exists
  const { data: cvDocument, isLoading: loadingCv } = useQuery<{
    fileName: string;
    fileSize: number;
    fileType: string;
    downloadUrl: string;
    viewUrl?: string;
  }>({
    queryKey: ["/api/admin/applications", application?.id, "documents", "cv"],
    queryFn: async () => {
      const data = await apiRequest("GET", `/admin/applications/${application?.id}/documents/cv`);
      return data;
    },
    enabled: !!application?.id && !!currentUser && !authLoading,
  });

  // Debug: Log the data
  console.log("User data:", user);
  console.log("Application data:", application);
  console.log("Form data:", formData);
  console.log("CV Document:", cvDocument);



  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "default";
      case "MENTOR":
        return "secondary";
      case "LEARNER":
        return "outline";
      default:
        return "outline";
    }
  };

  // Check if current user has admin access
  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <AppLayout title="Access Denied">
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout title="User Details">
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => navigate("/app/admin/users")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (error || !user) {
    return (
      <AppLayout title="User Not Found">
        <Card>
          <CardContent className="py-12 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {error?.message || "The user you're looking for doesn't exist."}
            </p>
            <Button onClick={() => navigate("/app/admin/users")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`User: ${user.name}`}>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate("/app/admin/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>

        {/* User Header Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{user.name}</CardTitle>
                <CardDescription className="mt-2">
                  User ID: {user.id}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getRoleBadgeVariant(user.role)} className="text-base px-3 py-1">
                  {user.role === "COFOUNDER" ? "Co-Founder" : user.role}
                </Badge>
                {user.role === "ADMIN" ? (
                  <Badge className="gap-1 bg-primary text-base px-3 py-1">
                    <Shield className="h-4 w-4" />
                    Primary Admin
                  </Badge>
                ) : null}
                {/* Admin-assigned custom tag (learners and mentors only) */}
                {(user.role === "LEARNER" || user.role === "MENTOR") && (
                  isEditingTag ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTag();
                          if (e.key === "Escape") setIsEditingTag(false);
                        }}
                        placeholder="e.g. Top Performer"
                        maxLength={40}
                        autoFocus
                        className="h-8 w-44 text-sm"
                        data-testid="input-custom-tag"
                      />
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSaveTag}
                        disabled={updateTagMutation.isPending || !tagInput.trim()}
                        data-testid="button-save-tag"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setIsEditingTag(false)}
                        disabled={updateTagMutation.isPending}
                        data-testid="button-cancel-tag"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : user.customTag ? (
                    <Badge className="gap-1 text-base px-3 py-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                      <Tag className="h-3.5 w-3.5" />
                      {user.customTag}
                      <button
                        type="button"
                        className="ml-1 rounded p-0.5 hover:bg-amber-200"
                        title="Edit tag"
                        onClick={() => {
                          setTagInput(user.customTag || "");
                          setIsEditingTag(true);
                        }}
                        data-testid="button-edit-tag"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-amber-200"
                        title="Remove tag"
                        onClick={() => updateTagMutation.mutate(null)}
                        data-testid="button-remove-tag"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 border-dashed"
                      onClick={() => {
                        setTagInput("");
                        setIsEditingTag(true);
                      }}
                      data-testid="button-add-tag"
                    >
                      <Plus className="h-4 w-4" />
                      Add tag
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Team Membership */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Membership
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : userTeams && userTeams.length > 0 ? (
              <div className="space-y-3">
                {userTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    data-testid={`row-user-team-${team.id}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{team.name}</p>
                        <Badge variant="secondary" className="shrink-0">
                          {team.teamRole}
                        </Badge>
                      </div>
                      {team.problemStatementTitle && (
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {team.problemStatementTitle}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setLocation(`/app/team/${team.id}`)}
                      data-testid={`button-view-user-team-${team.id}`}
                    >
                      View team
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not currently on any team.
              </p>
            )}
          </CardContent>
        </Card>

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
              {/* Full Name */}
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium break-words">{formData.fullName || user.name}</p>
              </div>
              {/* Email */}
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium break-words">{formData.email || user.email}</p>
              </div>
              {/* Phone */}
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium break-words">{formData.phone || user.phone || "N/A"}</p>
              </div>
              {/* Highest Education */}
              <div>
                <p className="text-sm text-muted-foreground">Education Details</p>
                <p className="font-medium break-words">{formData.education || formData.highestQualification || "N/A"}</p>
              </div>
              {/* Work Experience - For Founder/Co-Founder and Professionals */}
              {formData.workExperience && (
                <div>
                  <p className="text-sm text-muted-foreground">Work Experience</p>
                  <p className="font-medium break-words">{formData.workExperience}</p>
                </div>
              )}
              {/* University/College - For Interns (Students) */}
              {formData.university && (
                <div>
                  <p className="text-sm text-muted-foreground">University/College</p>
                  <p className="font-medium break-words">{formData.university}</p>
                </div>
              )}
              {/* Year of Study - For Interns (Students) */}
              {formData.yearOfStudy && (
                <div>
                  <p className="text-sm text-muted-foreground">Year of Study</p>
                  <p className="font-medium break-words">{formData.yearOfStudy}</p>
                </div>
              )}
              {/* Technical Skills - For Interns */}
              {formData.technicalSkills && Array.isArray(formData.technicalSkills) && formData.technicalSkills.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Technical Skills</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {formData.technicalSkills.map((skill: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {/* LinkedIn Profile */}
              {(formData.linkedinUrl || formData.linkedin) && (
                <div>
                  <p className="text-sm text-muted-foreground">LinkedIn Profile</p>
                  <a 
                    href={(formData.linkedinUrl || formData.linkedin).startsWith('http') ? (formData.linkedinUrl || formData.linkedin) : `https://${formData.linkedinUrl || formData.linkedin}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline break-all flex items-center gap-1"
                  >
                    <Linkedin className="h-4 w-4" />
                    {formData.linkedinUrl || formData.linkedin}
                  </a>
                </div>
              )}
              {/* GitHub Profile */}
              {(formData.githubUrl || formData.github) && (
                <div>
                  <p className="text-sm text-muted-foreground">GitHub Profile</p>
                  <a 
                    href={(formData.githubUrl || formData.github).startsWith('http') ? (formData.githubUrl || formData.github) : `https://${formData.githubUrl || formData.github}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline break-all flex items-center gap-1"
                  >
                    <Github className="h-4 w-4" />
                    {formData.githubUrl || formData.github}
                  </a>
                </div>
              )}
              {/* Student/Professional Status - For Interns */}
              {typeof formData.isStudent === 'boolean' && (
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={formData.isStudent ? "default" : "secondary"}>
                    {formData.isStudent ? "Student" : "Working Professional"}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Application Details</CardTitle>
                {application && application.id && application.type !== "MENTOR" && application.type !== "TEAM" && (
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/app/admin/applications/${application.id}/payment-details?from=users&userId=${userId}`)}
                  >
                    <IndianRupee className="h-4 w-4 mr-2" />
                    Payment Details Page
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
              {application ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Application Type</p>
                    <p className="font-medium">{application.type === "COFOUNDER" ? "Co-Founder" : application.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={application.status === "ACCEPTED" ? "default" : "outline"}>
                      {application.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Applied On</p>
                    <p className="font-medium">
                      {new Date(application.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  
                  {/* Interested Industry - Single Track for Founder/Co-Founder */}
                  {formData.preferredTrack && (
                    <div>
                      <p className="text-sm text-muted-foreground">Interested Industry</p>
                      <Badge variant="outline">{formData.preferredTrack}</Badge>
                    </div>
                  )}
                  
                  {/* Interested Industries - Multiple Tracks for Interns */}
                  {formData.preferredTracks && Array.isArray(formData.preferredTracks) && formData.preferredTracks.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Interested Industries</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {formData.preferredTracks.map((track: string, index: number) => (
                          <Badge key={index} variant="outline">{track}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Why do you want to join StartupUniv? - All Roles */}
                  {formData.motivation && (
                    <div>
                      <p className="text-sm text-muted-foreground">Why do you want to join StartupUniv?</p>
                      <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.motivation}</p>
                    </div>
                  )}
                  
                  {/* ========== FOUNDER-SPECIFIC FIELDS ========== */}
                  {application.type === "FOUNDER" && (
                    <>
                      {/* Vision for startup */}
                      {formData.founderQuestion1 && (
                        <div>
                          <p className="text-sm text-muted-foreground">What is your vision for the startup you want to build?</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.founderQuestion1}</p>
                        </div>
                      )}
                      {/* Leadership experience */}
                      {formData.founderQuestion2 && (
                        <div>
                          <p className="text-sm text-muted-foreground">What leadership experience do you bring to the table?</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.founderQuestion2}</p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* ========== CO-FOUNDER-SPECIFIC FIELDS ========== */}
                  {application.type === "COFOUNDER" && (
                    <>
                      {/* Which role are you applying for? */}
                      {formData.interestedRole && (
                        <div>
                          <p className="text-sm text-muted-foreground">Which role are you applying for?</p>
                          <Badge variant="secondary">
                            {formData.interestedRole === "CTO" ? "Chief Technology Officer (CTO)" : 
                             formData.interestedRole === "CBO" ? "Chief Business Officer (CBO)" : 
                             formData.interestedRole}
                          </Badge>
                        </div>
                      )}
                      {/* How do you plan to drive sales and market growth? */}
                      {formData.cofounderQuestion1 && (
                        <div>
                          <p className="text-sm text-muted-foreground">How do you plan to drive sales and market growth?</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.cofounderQuestion1}</p>
                        </div>
                      )}
                      {/* What is your experience in sales, marketing, or business development? */}
                      {formData.cofounderQuestion2 && (
                        <div>
                          <p className="text-sm text-muted-foreground">What is your experience in sales, marketing, or business development?</p>
                          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{formData.cofounderQuestion2}</p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* ========== INTERN (LEARNER/PROFESSIONAL) SPECIFIC FIELDS ========== */}
                  {(application.type === "LEARNER" || application.type === "PROFESSIONAL") && (
                    <>
                      {/* Which role are you interested in? */}
                      {formData.interestedRole && (
                        <div>
                          <p className="text-sm text-muted-foreground">Which role are you interested in?</p>
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
                          <p className="text-sm text-muted-foreground">Project Readiness</p>
                          <Badge variant={formData.readyForProjects ? "default" : "secondary"}>
                            {formData.readyForProjects ? "Ready to work on projects immediately" : 
                             formData.needsTraining ? "Prefers training before project assignment" : "N/A"}
                          </Badge>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Plan - For Interns Only (LEARNER type) */}
                  {(application.type === "LEARNER" || application.type === "PROFESSIONAL") && formData.plan && (
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <Badge variant={formData.plan === "premium" ? "default" : "outline"}>
                        {formData.plan === "premium" ? "Premium" : "Basic"}
                      </Badge>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium">{user.role === "COFOUNDER" ? "Co-Founder" : user.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                    <p className="font-medium">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  {user.organization && (
                    <div>
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="font-medium">{user.organization}</p>
                    </div>
                  )}
                  <div className="pt-4">
                    <p className="text-sm text-muted-foreground italic">No application data available</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents Section */}
        {application && (
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
                      size="sm"
                      onClick={() => window.open(cvDocument.viewUrl || cvDocument.downloadUrl, "_blank")}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View CV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!application?.id) return;
                        const downloadUrl = `/api/admin/applications/${application.id}/documents/cv/download`;
                        const link = document.createElement("a");
                        link.href = downloadUrl;
                        link.download = cvDocument.fileName || "Resume.pdf";
                        link.style.display = "none";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Download CV
                    </Button>
                  </div>
                </div>
              ) : formData.resumeUrl ? (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Resume</p>
                      <p className="text-sm text-muted-foreground">application/pdf</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={formData.resumeUrl} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4 mr-2" />
                        View CV
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={formData.resumeUrl} download>
                        <FileText className="h-4 w-4 mr-2" />
                        Download CV
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents available</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
