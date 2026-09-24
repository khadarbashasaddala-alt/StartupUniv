import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Mail,
  Briefcase,
  GraduationCap,
  Code,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface ApplicantProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  title?: string;
  description?: string;
}

export function ApplicantProfileModal({
  open,
  onOpenChange,
  userId,
  title = "Applicant Details",
  description = "Complete profile information",
}: ApplicantProfileModalProps) {
  const { toast } = useToast();

  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ["/api/users", userId, "detailed-profile"],
    queryFn: async () => {
      if (!userId) return null;
      return await apiRequest("GET", `/users/${userId}/detailed-profile`);
    },
    enabled: !!userId && open,
    retry: false,        // Do not use cached failure — always re-attempt on next open
    gcTime: 0,           // Clear cache immediately when modal closes, so next open is always fresh
    staleTime: 0,        // Always consider data stale, force refetch on every open
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load applicant details",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const getInitials = (name: string) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {userId && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {(error as Error).message || "Failed to load applicant details"}
              </div>
            ) : profileData ? (
              <>
                {/* Basic Info */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    {profileData.avatarUrl ? (
                      <img src={profileData.avatarUrl} alt={profileData.name} className="object-cover" />
                    ) : (
                      <AvatarFallback className="text-lg">
                        {getInitials(profileData.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-bold">{profileData.name}</h3>
                    <p className="text-muted-foreground">{profileData.email}</p>
                    {profileData.specialization && (
                      <Badge variant="secondary" className="mt-2">
                        {profileData.specialization}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Contact & Role Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-medium">{profileData.role}</p>
                    </div>
                  </div>
                  {profileData.phone && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Phone</p>
                        <p className="font-medium">{profileData.phone}</p>
                      </div>
                    </div>
                  )}
                  {profileData.specialization && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Specialization</p>
                        <p className="font-medium">{profileData.specialization}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Education */}
                {profileData.education && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Education</p>
                    </div>
                    <p className="text-sm">{profileData.education}</p>
                  </div>
                )}

                {/* Experience (for mentors) */}
                {profileData.experience && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Experience</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{profileData.experience}</p>
                  </div>
                )}

                {/* About Mentor */}
                {profileData.aboutMentor && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">About</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{profileData.aboutMentor}</p>
                  </div>
                )}

                {/* Description */}
                {profileData.description && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{profileData.description}</p>
                  </div>
                )}

                {/* Tech Stack / Skills */}
                {profileData.skills && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Tech Stack / Skills</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(profileData.skills) ? (
                        profileData.skills.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm">{profileData.skills}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tracks */}
                {profileData.tracks && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Tracks</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(profileData.tracks) ? (
                        profileData.tracks.map((track: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {track}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm">{profileData.tracks}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Links (for mentors) */}
                {(profileData.linkedinUrl || profileData.githubUrl || profileData.portfolioUrl || profileData.certificationsUrl) && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Links</p>
                    <div className="flex flex-wrap gap-2">
                      {profileData.linkedinUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(profileData.linkedinUrl, '_blank')}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          LinkedIn
                        </Button>
                      )}
                      {profileData.githubUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(profileData.githubUrl, '_blank')}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          GitHub
                        </Button>
                      )}
                      {profileData.portfolioUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(profileData.portfolioUrl, '_blank')}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Portfolio
                        </Button>
                      )}
                      {profileData.certificationsUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(profileData.certificationsUrl, '_blank')}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Certifications
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Video URL (for mentors) */}
                {profileData.videoUrl && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Video Profile</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(profileData.videoUrl, '_blank')}
                      className="gap-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Video
                    </Button>
                  </div>
                )}

                {/* CV */}
                {profileData.cv && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">CV / Resume</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">{profileData.cv.fileName}</p>
                      {profileData.cv.fileSize && (
                        <span className="text-xs text-muted-foreground">
                          ({(profileData.cv.fileSize / 1024).toFixed(1)} KB)
                        </span>
                      )}
                      {(profileData.cv.downloadUrl || profileData.cv.url) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(profileData.cv.downloadUrl || profileData.cv.url, '_blank')}
                          className="gap-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View CV
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Application Status */}
                {profileData.applicationStatus && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium text-muted-foreground">Application Status</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={profileData.applicationStatus === 'ACCEPTED' ? 'default' : 'secondary'}>
                        {profileData.applicationStatus}
                      </Badge>
                      {profileData.applicationType && (
                        <Badge variant="outline">{profileData.applicationType}</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Application Form Data */}
                {profileData.formData && Object.keys(profileData.formData).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Additional Details</p>
                    <div className="space-y-3 p-4 bg-muted rounded-lg max-h-60 overflow-y-auto">
                      {Object.entries(profileData.formData)
                        .filter(([key, value]) => {
                          if (value === null || value === undefined || value === '') return false;
                          // Filter out fields already displayed separately
                          if (['cvFileName', 'cvFileSize', 'cvFileType', 'cvS3Key', 'cvUrl', 'education', 'skills', 'tracksJson', 'tracks', 'techStack', 'experience', 'aboutMentor', 'description', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'certificationsUrl', 'videoUrl'].includes(key)) return false;
                          return true;
                        })
                        .map(([key, value]) => (
                          <div key={key} className="border-b pb-2 last:border-0">
                            <p className="text-xs font-medium text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                            </p>
                            <p className="text-sm mt-1 break-words">
                              {typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No details available</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
