import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Mail,
  Phone,
  User,
  GraduationCap,
  Briefcase,
  FileText,
  Play,
  Download,
  MapPin,
  Calendar,
  Globe,
  Award,
  Languages,
} from "lucide-react";
import { format } from "date-fns";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";

interface UserProfileDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  customTag?: string | null;
  phone?: string;
  bio?: string;
  specialization?: string;
  avatarUrl?: string;
  sector?: string;
  location?: string;
  dateOfBirth?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  experience?: string;
  education?: string;
  skills?: string[];
  languages?: string[];
  achievements?: string[];
  resumeUrl?: string;
  videoUrl?: string;
  profileImageUrl?: string;
  media?: Array<{ type: string; url: string; name: string }>;
  formData?: any;
}

export default function UserProfilePage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/app/user-profile/:userId");
  const userId = params?.userId;
  const { toast } = useToast();

  const { data: userProfile, isLoading, error } = useQuery<UserProfileDetails>({
    queryKey: ["/api/users", userId, "detailed-profile"],
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required");
      return await apiRequest("GET", `/users/${userId}/detailed-profile`);
    },
    enabled: !!userId,
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Edit profile state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarObjectKeyRef = useRef<string | null>(null);

  // Open edit dialog and populate fields
  const openEditDialog = () => {
    setEditName(userProfile?.name || "");
    setEditPhone(userProfile?.phone || "");
    setAvatarPreview(userProfile?.avatarUrl || null);
    avatarObjectKeyRef.current = null;
    setShowEditDialog(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "FOUNDER":
        return "default";
      case "COFOUNDER":
        return "secondary";
      case "MENTOR":
        return "outline";
      case "LEARNER":
        return "default";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "FOUNDER":
        return <User className="h-4 w-4" />;
      case "COFOUNDER":
        return <Briefcase className="h-4 w-4" />;
      case "MENTOR":
        return <Award className="h-4 w-4" />;
      case "LEARNER":
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  if (!match) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Invalid user profile URL</p>
            </CardContent>
          </Card>
              
              {/* Edit Profile Dialog */}
              <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>Update your name, phone number and profile picture.</DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Full name" />
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone number" />
                    </div>

                    <div>
                      <p className="text-sm font-medium">Profile Picture</p>
                      <ObjectUploader
                        acceptedTypes="image/*"
                        onGetUploadParameters={async (file) => {
                          // Request upload URL from server
                          const res = await apiRequest("POST", "/api/users/avatar/upload-url", { fileName: file.name, fileType: file.type });
                          // store objectKey for later save
                          avatarObjectKeyRef.current = res.objectKey;
                          return { method: "PUT", url: res.uploadURL, objectKey: res.objectKey };
                        }}
                        getViewUrlEndpoint="/api/auth/profile/avatar-url"
                        onComplete={async (fileUrl) => {
                          setAvatarPreview(fileUrl);
                          // Auto-save avatar after upload completes
                          if (avatarObjectKeyRef.current) {
                            try {
                              await apiRequest("PATCH", "/api/auth/profile", { 
                                avatarUrl: avatarObjectKeyRef.current 
                              });
                              toast({ 
                                title: "Avatar updated", 
                                description: "Your profile picture has been saved successfully." 
                              });
                            } catch (error: any) {
                              console.error("Error auto-saving avatar:", error);
                              // Don't show error toast here, user can still save manually
                            }
                          }
                        }}
                      >
                        <div className="px-3 py-2 border rounded">Upload / Change</div>
                      </ObjectUploader>
                      {avatarPreview && (
                        <div className="mt-2">
                          <img src={avatarPreview} alt="avatar preview" className="h-24 w-24 rounded-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                    <Button onClick={async () => {
                      try {
                        const payload: any = { name: editName, phone: editPhone };
                        if (avatarObjectKeyRef.current) {
                          payload.avatarUrl = avatarObjectKeyRef.current;
                        }
                        await apiRequest("PATCH", `/users/${userProfile?.id}`, payload);
                        // Invalidate and refetch
                        window.location.reload();
                      } catch (err: any) {
                        console.error(err);
                        alert(err?.message || "Failed to update profile");
                      }
                    }}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Change Password Dialog */}
              <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Change Password</DialogTitle>
                    <DialogDescription>Provide your current password and choose a new one.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Old password" type="password" id="old-pass" />
                    <Input placeholder="New password" type="password" id="new-pass" />
                    <Input placeholder="Confirm new password" type="password" id="confirm-pass" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
                    <Button onClick={async () => {
                      const oldPassword = (document.getElementById('old-pass') as HTMLInputElement).value;
                      const newPassword = (document.getElementById('new-pass') as HTMLInputElement).value;
                      const confirm = (document.getElementById('confirm-pass') as HTMLInputElement).value;
                      if (!oldPassword || !newPassword || !confirm) return alert('All fields are required');
                      if (newPassword !== confirm) return alert('Passwords do not match');
                      if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[^\w\s]/.test(newPassword)) return alert('Password must be at least 8 chars, include number and special char');
                      try {
                        await apiRequest('POST', '/api/users/change-password', { oldPassword, newPassword });
                        alert('Password changed successfully');
                        setShowPasswordDialog(false);
                      } catch (err: any) {
                        alert(err?.message || 'Failed to change password');
                      }
                    }}>Change</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load user profile. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/app/create-team")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">User Profile</h1>
            <p className="text-muted-foreground">Detailed information about the user</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                    <Skeleton className="h-6 w-32 mx-auto" />
                    <Skeleton className="h-4 w-24 mx-auto" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : userProfile ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Sidebar - Profile Summary */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Card */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <Avatar className="h-24 w-24 mx-auto">
                      <AvatarImage src={
                        userProfile.profileImageUrl ||
                        (userProfile.avatarUrl && userProfile.avatarUrl.startsWith("http") ? userProfile.avatarUrl : undefined)
                      } />
                      <AvatarFallback className="text-lg">
                        {getInitials(userProfile.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">{userProfile.name}</h3>
                      <p className="text-muted-foreground">{userProfile.email}</p>
                      <Badge 
                        variant={getRoleBadgeVariant(userProfile.role)} 
                        className="mt-2 gap-1"
                      >
                        {getRoleIcon(userProfile.role)}
                        {userProfile.role}
                      </Badge>
                      {userProfile.customTag && (
                        <Badge className="mt-2 ml-2 gap-1 bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100">
                          <Award className="h-3 w-3" />
                          {userProfile.customTag}
                        </Badge>
                      )}
                    </div>
                    {userProfile.specialization && (
                      <div className="text-center">
                        <p className="text-sm font-medium text-muted-foreground">Specialization</p>
                        <Badge variant="outline" className="mt-1">
                          {userProfile.specialization}
                        </Badge>
                      </div>
                    )}
                    {userProfile.sector && (
                      <div className="text-center">
                        <p className="text-sm font-medium text-muted-foreground">Interested Tech</p>
                        <Badge variant="secondary" className="mt-1">
                          {userProfile.sector}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* Contact Information */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Contact Information</h4>
                    {userProfile.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{userProfile.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{userProfile.email}</span>
                    </div>
                    {userProfile.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{userProfile.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Social Links */}
                  {(userProfile.website || userProfile.linkedin || userProfile.github || userProfile.portfolio) && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <h4 className="font-medium">Links</h4>
                        {userProfile.website && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={userProfile.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Website
                            </a>
                          </div>
                        )}
                        {userProfile.linkedin && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={userProfile.linkedin} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              LinkedIn
                            </a>
                          </div>
                        )}
                        {userProfile.github && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={userProfile.github} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              GitHub
                            </a>
                          </div>
                        )}
                        {userProfile.portfolio && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={userProfile.portfolio} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              Portfolio
                            </a>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Documents & Media */}
                  {(userProfile.media && userProfile.media.length > 0) ? (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <h4 className="font-medium">Documents & Media</h4>
                        {userProfile.media.map((item, index) => {
                          if (item.type === "cv") {
                            return (
                              <Button 
                                key={index}
                                variant="outline" 
                                size="sm" 
                                className="w-full gap-2"
                                onClick={() => window.open(item.url, '_blank')}
                              >
                                <FileText className="h-4 w-4" />
                                View {item.name}
                              </Button>
                            );
                          }
                          if (item.type === "video") {
                            return (
                              <Button 
                                key={index}
                                variant="outline" 
                                size="sm" 
                                className="w-full gap-2"
                                onClick={() => window.open(item.url, '_blank')}
                              >
                                <Play className="h-4 w-4" />
                                View {item.name}
                              </Button>
                            );
                          }
                          if (item.type === "certificate") {
                            return (
                              <Button 
                                key={index}
                                variant="outline" 
                                size="sm" 
                                className="w-full gap-2"
                                onClick={() => window.open(item.url, '_blank')}
                              >
                                <Award className="h-4 w-4" />
                                View {item.name}
                              </Button>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </>
                  ) : (userProfile.resumeUrl || userProfile.videoUrl) && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-3">
                        <h4 className="font-medium">Documents & Media</h4>
                        {userProfile.resumeUrl && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-2"
                            onClick={() => window.open(userProfile.resumeUrl, '_blank')}
                          >
                            <FileText className="h-4 w-4" />
                            View CV/Resume
                          </Button>
                        )}
                        {userProfile.videoUrl && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-2"
                            onClick={() => window.open(userProfile.videoUrl, '_blank')}
                          >
                            <Play className="h-4 w-4" />
                            View Video Profile
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Content - Detailed Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bio/About */}
              {userProfile.bio && (
                <Card>
                  <CardHeader>
                    <CardTitle>About</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed break-words overflow-wrap-anywhere">{userProfile.bio}</p>
                  </CardContent>
                </Card>
              )}

              {/* Experience */}
              {userProfile.experience && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      Experience
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed break-words overflow-wrap-anywhere">
                      {userProfile.experience}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Education */}
              {userProfile.education && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed break-words overflow-wrap-anywhere">
                      {userProfile.education}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skills */}
              {userProfile.skills && userProfile.skills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Languages */}
              {userProfile.languages && userProfile.languages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="h-5 w-5" />
                      Languages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {userProfile.languages.map((language, index) => (
                        <Badge key={index} variant="outline">
                          {language}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Achievements */}
              {userProfile.achievements && userProfile.achievements.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {userProfile.achievements.map((achievement, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{achievement}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Video Section */}
              {userProfile.role === "MENTOR" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Video Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userProfile.media?.some(item => item.type === "video") ? (
                      <div className="space-y-3">
                        {userProfile.media
                          .filter(item => item.type === "video")
                          .map((item, index) => (
                            <Button 
                              key={index}
                              variant="outline" 
                              size="default" 
                              className="w-full gap-2"
                              onClick={() => window.open(item.url, '_blank')}
                            >
                              <Play className="h-4 w-4" />
                              View {item.name}
                            </Button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No video profile available</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Certificates Section */}
              {userProfile.role === "MENTOR" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userProfile.media?.some(item => item.type === "certificate") ? (
                      <div className="space-y-3">
                        {userProfile.media
                          .filter(item => item.type === "certificate")
                          .map((item, index) => (
                            <Button 
                              key={index}
                              variant="outline" 
                              size="default" 
                              className="w-full gap-2"
                              onClick={() => window.open(item.url, '_blank')}
                            >
                              <Award className="h-4 w-4" />
                              View {item.name}
                            </Button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No certifications available</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Additional Information from Form Data (exclude S3 keys, file metadata, internal fields) */}
              {userProfile.formData && (() => {
                const HIDDEN_KEYS = new Set([
                  'id', 'name', 'email', 'certificationsUrl', 'videoUrl', 'cvUrl',
                  'cvS3Key', 'cvFileName', 'cvFileSize', 'cvFileType', 'avatarUrl', 'profileImageUrl',
                  'objectKey', 's3Key', 'uploadURL', 'formJson', 'tracksJson',
                  'education', 'skills', 'experience', 'tracks', 'techStack',
                  'linkedinUrl', 'githubUrl', 'portfolioUrl', 'description', 'aboutMentor',
                  'interestedTracks', 'preferredTrack', 'applicationId',
                ]);
                const isInternalKey = (k: string) =>
                  HIDDEN_KEYS.has(k) ||
                  /s3|S3|ObjectKey|objectKey|fileKey|FileKey/i.test(k) ||
                  /Key$|Url$/.test(k) && /s3|bucket|key/i.test(String(k));
                const entries = Object.entries(userProfile.formData).filter(
                  ([key]) => !isInternalKey(key)
                );
                if (entries.length === 0) return null;
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Additional Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {entries.map(([key, value]) => {
                          if (value === undefined || value === null || value === '') return null;
                          let displayValue: React.ReactNode = '';
                          if (Array.isArray(value)) {
                            if (value.length === 0) return null;
                            displayValue = value.join(', ');
                          } else if (typeof value === 'object' && value !== null && !(value instanceof Date) && Object.keys(value).length > 0) {
                            displayValue = JSON.stringify(value);
                          } else if (typeof value === 'string') {
                            if (/^[\w-]+\/[\w-]+/.test(value) && (value.includes('s3') || value.length > 80)) return null;
                            displayValue = value;
                          } else if (typeof value === 'number' || typeof value === 'boolean') {
                            displayValue = String(value);
                          }
                          return (
                            <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm min-w-0">
                              <span className="font-medium capitalize text-muted-foreground flex-shrink-0">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                              </span>
                              <span className="col-span-2 break-words overflow-wrap-anywhere min-w-0">
                                {displayValue}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">User profile not found</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}