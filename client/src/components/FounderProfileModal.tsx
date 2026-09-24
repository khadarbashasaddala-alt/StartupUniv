import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Briefcase,
  GraduationCap,
  FileText,
  Play,
  Award,
  User,
  X,
} from "lucide-react";

interface FounderProfileDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  bio?: string;
  specialization?: string;
  avatarUrl?: string;
  sector?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  experience?: string;
  education?: string;
  skills?: string[] | string;
  resumeUrl?: string;
  videoUrl?: string;
  profileImageUrl?: string;
  media?: Array<{ type: string; url: string; name: string }>;
}

interface FounderProfileModalProps {
  open: boolean;
  onClose: () => void;
  founderId: string | null;
}

export function FounderProfileModal({ open, onClose, founderId }: FounderProfileModalProps) {
  const { data: founderProfile, isLoading, error } = useQuery<FounderProfileDetails>({
    queryKey: ["/api/users", founderId, "detailed-profile"],
    queryFn: async () => {
      if (!founderId) throw new Error("Founder ID is required");
      return await apiRequest("GET", `/users/${founderId}/detailed-profile`);
    },
    enabled: !!founderId && open,
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "FOUNDER":
        return "default";
      case "COFOUNDER":
        return "secondary";
      case "MENTOR":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "FOUNDER":
        return <User className="h-3 w-3" />;
      case "COFOUNDER":
        return <User className="h-3 w-3" />;
      case "MENTOR":
        return <GraduationCap className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  // Parse skills if it's a string
  const parseSkills = (skills: string[] | string | null | undefined): string[] => {
    if (!skills) return [];
    if (Array.isArray(skills)) return skills;
    if (typeof skills === "string") {
      try {
        const parsed = JSON.parse(skills);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return skills.split(",").map(s => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const skillsArray = parseSkills(founderProfile?.skills);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">Founder Profile</DialogTitle>
          <DialogDescription className="text-gray-600">
            View founder details and background information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="text-destructive">Failed to load founder profile. Please try again.</p>
          </div>
        ) : !founderProfile ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">Founder not found</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Header Section */}
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24 border-2 border-gray-200">
                <AvatarImage src={founderProfile.profileImageUrl || founderProfile.avatarUrl} />
                <AvatarFallback className="text-xl bg-red-100 text-red-700">
                  {getInitials(founderProfile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold text-gray-900">{founderProfile.name}</h3>
                  <Badge variant={getRoleBadgeVariant(founderProfile.role)} className="gap-1">
                    {getRoleIcon(founderProfile.role)}
                    {founderProfile.role}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{founderProfile.email}</span>
                  </div>
                  {founderProfile.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{founderProfile.phone}</span>
                    </div>
                  )}
                  {founderProfile.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{founderProfile.location}</span>
                    </div>
                  )}
                </div>
                {(founderProfile.specialization || founderProfile.sector) && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {founderProfile.specialization && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {founderProfile.specialization}
                      </Badge>
                    )}
                    {founderProfile.sector && founderProfile.sector !== founderProfile.specialization && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {founderProfile.sector}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Bio Section */}
            {founderProfile.bio && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{founderProfile.bio}</p>
                </CardContent>
              </Card>
            )}

            {/* Experience Section */}
            {founderProfile.experience && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-red-600" />
                    Experience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{founderProfile.experience}</p>
                </CardContent>
              </Card>
            )}

            {/* Education Section */}
            {founderProfile.education && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-red-600" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{founderProfile.education}</p>
                </CardContent>
              </Card>
            )}

            {/* Skills Section */}
            {skillsArray.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Skills & Expertise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {skillsArray.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="bg-gray-100 text-gray-800">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Links Section */}
            {(founderProfile.website || founderProfile.linkedin || founderProfile.github || founderProfile.portfolio) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5 text-red-600" />
                    Links & Profiles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {founderProfile.website && (
                      <a
                        href={founderProfile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span>Website</span>
                      </a>
                    )}
                    {founderProfile.linkedin && (
                      <a
                        href={founderProfile.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span>LinkedIn</span>
                      </a>
                    )}
                    {founderProfile.github && (
                      <a
                        href={founderProfile.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span>GitHub</span>
                      </a>
                    )}
                    {founderProfile.portfolio && (
                      <a
                        href={founderProfile.portfolio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:text-primary/80 hover:underline transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span>Portfolio</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents & Media Section */}
            {(founderProfile.media && founderProfile.media.length > 0) || founderProfile.resumeUrl || founderProfile.videoUrl ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documents & Media</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {founderProfile.media && founderProfile.media.length > 0 ? (
                      founderProfile.media.map((item, index) => {
                        if (item.type === "cv") {
                          return (
                            <Button
                              key={index}
                              variant="outline"
                              className="w-full justify-start gap-2"
                              onClick={() => window.open(item.url, "_blank")}
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
                              className="w-full justify-start gap-2"
                              onClick={() => window.open(item.url, "_blank")}
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
                              className="w-full justify-start gap-2"
                              onClick={() => window.open(item.url, "_blank")}
                            >
                              <Award className="h-4 w-4" />
                              View {item.name}
                            </Button>
                          );
                        }
                        return null;
                      })
                    ) : (
                      <>
                        {founderProfile.resumeUrl && (
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => window.open(founderProfile.resumeUrl, "_blank")}
                          >
                            <FileText className="h-4 w-4" />
                            View CV/Resume
                          </Button>
                        )}
                        {founderProfile.videoUrl && (
                          <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => window.open(founderProfile.videoUrl, "_blank")}
                          >
                            <Play className="h-4 w-4" />
                            View Video Profile
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
