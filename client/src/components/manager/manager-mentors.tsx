import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Users,
  Plus,
  Loader2,
  Mail,
  Phone,
  GraduationCap,
  Briefcase,
  Link as LinkIcon,
  FileText,
  Video,
  Award,
  CheckCircle2,
  XCircle,
  Upload,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectUploader } from "@/components/ObjectUploader";

interface MentorProfile {
  id: string;
  userId: string;
  education: string | null;
  skills: string[] | null;
  experience: string | null;
  tracksJson: string[] | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  description: string | null;
  aboutMentor: string | null;
  cvUrl: string | null;
  certificationsUrl: string | null;
  videoUrl: string | null;
  credentialsShared: boolean;
  credentialsApprovedBy: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
}

const TRACKS = ["GovTech", "EduTech", "HealthTech", "MSME", "AgriTech", "Climate"];

export default function ManagerMentorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTrack, setSelectedTrack] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [storedPassword, setStoredPassword] = useState<string>("");
  const [storedEmail, setStoredEmail] = useState<string>("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");
  const [experience, setExperience] = useState("");
  const [tracks, setTracks] = useState<string[]>([]);
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [description, setDescription] = useState("");
  const [aboutMentor, setAboutMentor] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [certificationsUrls, setCertificationsUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");

  const { data: mentors = [], isLoading, error: mentorsError, refetch: refetchMentors } = useQuery<MentorProfile[]>({
    queryKey: ["/api/manager/mentors", selectedTrack],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTrack !== "all") {
        params.append("track", selectedTrack);
      }
      console.log("🔍 Fetching mentors, track:", selectedTrack);
      try {
        const data = await apiRequest("GET", `/manager/mentors?${params.toString()}`);
        console.log("✅ Mentors fetched:", data?.length || 0, "mentor(s)");
        return data || [];
      } catch (error: any) {
        console.error("❌ Error fetching mentors:", error);
        throw error;
      }
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds to check for approval status
  });

  // Log error if query fails
  if (mentorsError) {
    console.error("❌ Mentors query error:", mentorsError);
  }

  const createMentorMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await apiRequest("POST", "/manager/mentors", formData);
      return response;
    },
    onSuccess: (data) => {
      toast({ title: "Mentor created successfully. Waiting for admin approval." });
      setShowAddDialog(false);
      setStoredPassword(data.password);
      setStoredEmail(data.user?.email || "");
      setSelectedMentor(data.profile);
      // Don't show credentials dialog immediately - wait for admin approval
      // setShowCredentialsDialog(true);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/manager/mentors"] });
      // Refetch mentors to get updated approval status
      setTimeout(() => {
        refetchMentors();
      }, 2000);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create mentor", variant: "destructive" });
    },
  });

  const shareCredentialsMutation = useMutation({
    mutationFn: async ({ profileId, password }: { profileId: string; password: string }) => {
      return apiRequest("POST", `/manager/mentors/${profileId}/share-credentials`, { password });
    },
    onSuccess: () => {
      toast({ title: "Credentials shared successfully via email" });
      setShowCredentialsDialog(false);
      setSelectedMentor(null);
      setStoredPassword("");
      setStoredEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/manager/mentors"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to share credentials", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setEducation("");
    setSkills("");
    setExperience("");
    setTracks([]);
    setLinkedin("");
    setGithub("");
    setPortfolio("");
    setDescription("");
    setAboutMentor("");
    setCvUrl("");
    setCertificationsUrls([]);
    setVideoUrl("");
  };

  const handleSubmit = () => {
    if (tracks.length === 0 || tracks.length > 3) {
      toast({ title: "Please select 1-3 tracks", variant: "destructive" });
      return;
    }

    const skillsArray = skills.split(",").map(s => s.trim()).filter(s => s.length > 0);

    createMentorMutation.mutate({
      fullName,
      email,
      phone,
      education,
      skills: skillsArray,
      experience,
      tracks,
      linkedin,
      github,
      portfolio,
      description,
      aboutMentor,
      cvUrl,
      certificationsUrl: certificationsUrls,
      videoUrl,
    });
  };

  const handleShareCredentials = () => {
    if (!selectedMentor || !storedPassword) {
      toast({ title: "Password not available", variant: "destructive" });
      return;
    }
    shareCredentialsMutation.mutate({
      profileId: selectedMentor.id,
      password: storedPassword,
    });
  };

  const toggleTrack = (track: string) => {
    setTracks((prev) => {
      if (prev.includes(track)) {
        return prev.filter((t) => t !== track);
      }
      if (prev.length >= 3) {
        toast({ title: "Maximum 3 tracks allowed", variant: "destructive" });
        return prev;
      }
      return [...prev, track];
    });
  };

  return (
    <AppLayout title="Manage Mentors">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manage Mentors</h1>
            <p className="text-muted-foreground">View and manage mentors by sector</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add Mentor
          </Button>
        </div>

        {/* Track Filter */}
<Card className="border border-border bg-card">
            <CardHeader>
            <CardTitle className="text-foreground">Filter by Sector</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTrack} onValueChange={setSelectedTrack}>
              <TabsList className="grid w-full grid-cols-7 bg-muted/50 border border-border">
                <TabsTrigger 
                  value="all"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                >
                  All
                </TabsTrigger>
                {TRACKS.map((track) => (
                  <TabsTrigger 
                    key={track} 
                    value={track}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                  >
                    {track}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Mentors List */}
<Card className="border border-border bg-card">
            <CardHeader>
            <CardTitle className="text-foreground">Mentors</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${mentors.length} mentor${mentors.length !== 1 ? "s" : ""} found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : mentors.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No mentors found</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mentors.map((mentor) => (
                  <Card key={mentor.id} className="hover:shadow-lg transition-shadow border border-border bg-card">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold text-foreground">{mentor.user?.name || "Unknown"}</CardTitle>
                        {mentor.credentialsShared ? (
                          <Badge className="bg-green-100/50 text-green-800 border border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Credentials Shared
                          </Badge>
                        ) : mentor.credentialsApprovedBy ? (
                          <Badge className="bg-primary/15 text-primary border border-primary/30">Approved</Badge>
                        ) : (
                          <Badge className="bg-amber-100/50 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400">Pending Approval</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {mentor.user?.email}
                        {mentor.user?.phone && ` • ${mentor.user.phone}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mentor.tracksJson && mentor.tracksJson.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {mentor.tracksJson.map((track) => (
                            <Badge key={track} variant="outline" className="border-border text-muted-foreground bg-card">
                              {track}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {mentor.education && (
                        <div className="flex items-start gap-2 text-sm">
                          <GraduationCap className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{mentor.education}</span>
                        </div>
                      )}
                      {mentor.experience && (
                        <div className="flex items-start gap-2 text-sm">
                          <Briefcase className="h-4 w-4 mt-0.5 text-muted-foreground" />
                          <span className="text-muted-foreground line-clamp-2">{mentor.experience}</span>
                        </div>
                      )}
                      {mentor.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">{mentor.description}</p>
                      )}
                      <div className="flex gap-2 pt-2 flex-wrap">
                        {mentor.credentialsApprovedBy && !mentor.credentialsShared && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={async () => {
                              setSelectedMentor(mentor);
                              setStoredEmail(mentor.user?.email || "");
                              // Retrieve password from backend
                              try {
                                const data = await apiRequest("GET", `/manager/mentors/${mentor.id}/password`);
                                setStoredPassword(data.password);
                                setShowCredentialsDialog(true);
                              } catch (error: any) {
                                toast({ 
                                  title: error.message || "Failed to retrieve password", 
                                  variant: "destructive" 
                                });
                              }
                            }}
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Share Credentials
                          </Button>
                        )}
                        {mentor.linkedinUrl && (
                          <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        {mentor.githubUrl && (
                          <a href={mentor.githubUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        {mentor.portfolioUrl && (
                          <a href={mentor.portfolioUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Mentor Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Mentor</DialogTitle>
              <DialogDescription>
                Fill in all the required information to create a new mentor profile
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 1234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="education">Education *</Label>
                    <Input
                      id="education"
                      value={education}
                      onChange={(e) => setEducation(e.target.value)}
                      placeholder="B.Tech Computer Science, IIT Delhi"
                    />
                </div>

                <div>
                  <Label htmlFor="skills">Skills (comma-separated) *</Label>
                  <Input
                    id="skills"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="JavaScript, React, Node.js, Python"
                  />
                </div>

                <div>
                  <Label htmlFor="experience">Experience *</Label>
                  <Textarea
                    id="experience"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="10+ years in software development..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Sectors (Select 1-3) *</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {TRACKS.map((track) => (
                      <Button
                        key={track}
                        type="button"
                        variant={tracks.includes(track) ? "default" : "outline"}
                        onClick={() => toggleTrack(track)}
                        className="justify-start"
                      >
                        {tracks.includes(track) && <CheckCircle2 className="h-4 w-4 mr-2" />}
                        {track}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Selected: {tracks.length}/3
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="linkedin">LinkedIn URL</Label>
                    <Input
                      id="linkedin"
                      value={linkedin}
                      onChange={(e) => setLinkedin(e.target.value)}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="github">GitHub URL</Label>
                    <Input
                      id="github"
                      value={github}
                      onChange={(e) => setGithub(e.target.value)}
                      placeholder="https://github.com/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="portfolio">Portfolio URL</Label>
                    <Input
                      id="portfolio"
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      placeholder="https://portfolio.com/..."
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the mentor..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="aboutMentor">About Mentor *</Label>
                  <Textarea
                    id="aboutMentor"
                    value={aboutMentor}
                    onChange={(e) => setAboutMentor(e.target.value)}
                    placeholder="Detailed information about the mentor..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>CV Upload</Label>
                  <ObjectUploader
                    onGetUploadParameters={async (file) => {
                      // Use the actual file that was selected
                      const fileName = file?.name || `mentor-cv-${Date.now()}.pdf`;
                      const fileType = file?.type || "application/pdf";
                      
                      console.log("📋 Requesting upload URL for CV:", { fileName, fileType });
                      
                      const response = await apiRequest("POST", "/api/mentors/files/upload-url", {
                        fileName: fileName,
                        fileType: fileType,
                        fileCategory: "cv",
                      });
                      
                      console.log("✅ Got upload URL:", response.uploadURL?.substring(0, 100));
                      console.log("✅ Got objectKey:", response.objectKey);
                      
                      return { 
                        method: "PUT" as const, 
                        url: response.uploadURL,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl) => {
                      console.log("✅ CV upload complete, GET URL:", fileUrl);
                      setCvUrl(fileUrl);
                    }}
                    getViewUrlEndpoint="/api/mentors/files/view-url"
                    acceptedTypes=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    maxFileSize={10 * 1024 * 1024}
                    title="Upload CV"
                    description="Upload your CV (PDF, DOC, or DOCX format, max 10MB)"
                    fileTypeLabel="CV file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CV
                  </ObjectUploader>
                  {cvUrl && (
                    <p className="text-xs text-muted-foreground mt-1">
                      CV uploaded: <a href={cvUrl} target="_blank" rel="noopener noreferrer" className="text-primary">View</a>
                    </p>
                  )}
                </div>

                <div>
                  <Label>Certifications Upload</Label>
                  <ObjectUploader
                    onGetUploadParameters={async (file) => {
                      const fileName = file?.name || `mentor-cert-${Date.now()}.pdf`;
                      const fileType = file?.type || "application/pdf";
                      
                      const response = await apiRequest("POST", "/api/mentors/files/upload-url", {
                        fileName: fileName,
                        fileType: fileType,
                        fileCategory: "certification",
                      });
                      return { 
                        method: "PUT" as const, 
                        url: response.uploadURL,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl) => {
                      console.log("✅ Certification upload complete, GET URL:", fileUrl);
                      setCertificationsUrls((prev) => [...prev, fileUrl]);
                    }}
                    getViewUrlEndpoint="/api/mentors/files/view-url"
                    acceptedTypes=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    maxFileSize={10 * 1024 * 1024}
                    title="Upload Certification"
                    description="Upload a certification document (PDF, JPG, or PNG format, max 10MB)"
                    fileTypeLabel="certification file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Certification
                  </ObjectUploader>
                  {certificationsUrls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {certificationsUrls.map((url, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary">
                            Certification {i + 1}
                          </a>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCertificationsUrls((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Video About Mentor</Label>
                  <ObjectUploader
                    onGetUploadParameters={async (file) => {
                      const fileName = file?.name || `mentor-video-${Date.now()}.mp4`;
                      const fileType = file?.type || "video/mp4";
                      
                      const response = await apiRequest("POST", "/api/mentors/files/upload-url", {
                        fileName: fileName,
                        fileType: fileType,
                        fileCategory: "video",
                      });
                      return { 
                        method: "PUT" as const, 
                        url: response.uploadURL,
                        objectKey: response.objectKey,
                      };
                    }}
                    onComplete={(fileUrl) => {
                      console.log("✅ Video upload complete, GET URL:", fileUrl);
                      setVideoUrl(fileUrl);
                    }}
                    getViewUrlEndpoint="/api/mentors/files/view-url"
                    acceptedTypes="video/*"
                    maxFileSize={100 * 1024 * 1024}
                    title="Upload Video"
                    description="Upload a video about the mentor (MP4, MOV, or other video formats, max 100MB)"
                    fileTypeLabel="video file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Video
                  </ObjectUploader>
                  {videoUrl && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Video uploaded: <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary">View</a>
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMentorMutation.isPending}
              >
                {createMentorMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Mentor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Share Credentials Dialog */}
        <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Credentials</DialogTitle>
              <DialogDescription>
                {selectedMentor?.credentialsApprovedBy 
                  ? "Admin has approved the mentor. You can now share credentials via email."
                  : "Waiting for admin approval. Once approved, you can share credentials via email."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Mentor Credentials:</p>
                <p className="text-sm"><strong>Email:</strong> {storedEmail || selectedMentor?.user?.email || "N/A"}</p>
                <p className="text-sm"><strong>Password:</strong> {storedPassword}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Click the button below to send these credentials to the mentor via email.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCredentialsDialog(false)}>
                Close
              </Button>
              <Button
                onClick={handleShareCredentials}
                disabled={shareCredentialsMutation.isPending || !selectedMentor?.credentialsApprovedBy}
              >
                {shareCredentialsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Mail className="h-4 w-4 mr-2" />
                {selectedMentor?.credentialsApprovedBy ? "Send Credentials" : "Waiting for Approval"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

