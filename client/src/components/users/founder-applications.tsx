import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ArrowLeft,
  UserPlus,
  Users,
  GraduationCap,
  Briefcase,
  Check,
  X,
  Mail,
  Phone,
} from "lucide-react";

export default function FounderApplicationsPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch applications received by the founder
  const { data: receivedApplications = [], isLoading: applicationsLoading } = useQuery<{
    id: string;
    founderId: string;
    targetUserId: string;
    targetUserRole: string;
    status: string;
    message: string | null;
    createdAt: string;
    applicantName?: string;
    applicantEmail?: string;
    applicantRole?: string;
    applicantPhone?: string;
    applicantSector?: string;
    applicationDetails?: {
      fullName?: string;
      email?: string;
      phone?: string;
      education?: string;
      workExperience?: string;
      linkedinUrl?: string;
      githubUrl?: string;
      motivation?: string;
      applyingForRole?: string;
      interestedRole?: string;
      cofounderQuestion1?: string;
      cofounderQuestion2?: string;
      [key: string]: any;
    };
  }[]>({
    queryKey: ["/api/team-member-applications/received"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/team-member-applications/received");
      return data;
    },
    enabled: !!user && !authLoading,
  });

  // Accept application mutation
  const acceptMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest("PATCH", `/team-member-applications/${applicationId}`, {
        status: "ACCEPTED",
      });
    },
    onMutate: (applicationId) => {
      setProcessingId(applicationId);
    },
    onSuccess: () => {
      toast({ title: "Application accepted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-member-applications/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to accept application", 
        description: error.message,
        variant: "destructive" 
      });
      setProcessingId(null);
    },
  });

  // Reject application mutation
  const rejectMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      return apiRequest("PATCH", `/team-member-applications/${applicationId}`, {
        status: "REJECTED",
      });
    },
    onMutate: (applicationId) => {
      setProcessingId(applicationId);
    },
    onSuccess: () => {
      toast({ title: "Application rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/team-member-applications/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to reject application", 
        description: error.message,
        variant: "destructive" 
      });
      setProcessingId(null);
    },
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "COFOUNDER":
        return <Users className="h-4 w-4" />;
      case "MENTOR":
        return <Briefcase className="h-4 w-4" />;
      case "LEARNER":
        return <GraduationCap className="h-4 w-4" />;
      default:
        return <UserPlus className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "COFOUNDER":
        return "Co-Founder";
      case "MENTOR":
        return "Mentor";
      case "LEARNER":
        return "Intern";
      default:
        return role;
    }
  };

  if (authLoading) {
    return (
      <AppLayout title="Applications Received">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Filter pending applications only
  const pendingApplications = receivedApplications.filter(a => a.status === "PENDING");
  const processedApplications = receivedApplications.filter(a => a.status !== "PENDING");

  return (
    <AppLayout title="Applications Received">
      <div className="w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 w-full max-w-full">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/app")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Applications Received</h1>
            <p className="text-muted-foreground mt-1">Review applications from team members wanting to join</p>
          </div>
        </div>
      </div>

      {/* Pending Applications */}
      <Card className="mb-6 overflow-hidden w-full max-w-full">
        <CardHeader className="w-full max-w-full">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Pending Applications ({pendingApplications.length})
          </CardTitle>
          <CardDescription>Applications awaiting your review</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-hidden w-full max-w-full">
          {applicationsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : pendingApplications.length > 0 ? (
            <div className="space-y-4 min-w-0 w-full max-w-full">
              {pendingApplications.map((app) => {
                const details = app.applicationDetails || {};
                return (
                  <Card key={app.id} className="hover-elevate border-2 overflow-hidden w-full max-w-full">
                    <CardContent className="py-6 w-full max-w-full overflow-hidden">
                      <div className="flex items-start gap-4 min-w-0 w-full max-w-full">
                        <Avatar className="h-16 w-16 flex-shrink-0">
                          <AvatarFallback className="text-lg">
                            {getInitials(app.applicantName || "Unknown")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 overflow-hidden w-full max-w-full">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4 min-w-0">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-lg font-semibold truncate">{app.applicantName || "Unknown User"}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <Badge variant="outline" className="font-normal whitespace-nowrap">
                                  {getRoleIcon(app.applicantRole || "")}
                                  <span className="ml-1">{getRoleLabel(app.applicantRole || "")}</span>
                                </Badge>
                                {app.applicantSector && (
                                  <Badge variant="secondary" className="whitespace-nowrap truncate max-w-[150px]">{app.applicantSector}</Badge>
                                )}
                                {details.interestedRole && (
                                  <Badge variant="outline" className="whitespace-nowrap">{details.interestedRole}</Badge>
                                )}
                              </div>
                            </div>
                            <Badge variant="secondary" className="flex-shrink-0">PENDING</Badge>
                          </div>
                          
                          {/* Contact Information */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {app.applicantEmail && (
                              <div className="flex items-center gap-2 text-sm min-w-0">
                                <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{app.applicantEmail}</span>
                              </div>
                            )}
                            {app.applicantPhone && (
                              <div className="flex items-center gap-2 text-sm min-w-0">
                                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{app.applicantPhone}</span>
                              </div>
                            )}
                          </div>

                          {/* Application Details */}
                          <div className="space-y-3 mb-4 min-w-0">
                            {details.education && (
                              <div className="p-3 bg-muted rounded-md min-w-0 w-full max-w-full overflow-hidden">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">EDUCATION</p>
                                <p className="text-sm break-all break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-all' }}>{details.education}</p>
                              </div>
                            )}
                            
                            {details.workExperience && (
                              <div className="p-3 bg-muted rounded-md min-w-0 w-full max-w-full overflow-hidden">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">WORK EXPERIENCE</p>
                                <p className="text-sm break-all break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-all' }}>{details.workExperience}</p>
                              </div>
                            )}

                            {details.motivation && (
                              <div className="p-3 bg-muted rounded-md min-w-0 w-full max-w-full overflow-hidden">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">MOTIVATION</p>
                                <p className="text-sm break-all break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-all' }}>{details.motivation}</p>
                              </div>
                            )}

                            {details.cofounderQuestion1 && (
                              <div className="p-3 bg-muted rounded-md min-w-0 w-full max-w-full overflow-hidden">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">WHY DO YOU WANT TO BE A CO-FOUNDER?</p>
                                <p className="text-sm break-all break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-all' }}>{details.cofounderQuestion1}</p>
                              </div>
                            )}

                            {details.cofounderQuestion2 && (
                              <div className="p-3 bg-muted rounded-md min-w-0 w-full max-w-full overflow-hidden">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">WHAT SKILLS DO YOU BRING?</p>
                                <p className="text-sm break-all break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-all' }}>{details.cofounderQuestion2}</p>
                              </div>
                            )}

                            {(details.linkedinUrl || details.githubUrl) && (
                              <div className="flex gap-2">
                                {details.linkedinUrl && (
                                  <a 
                                    href={details.linkedinUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline"
                                  >
                                    LinkedIn Profile →
                                  </a>
                                )}
                                {details.githubUrl && (
                                  <a 
                                    href={details.githubUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline"
                                  >
                                    GitHub Profile →
                                  </a>
                                )}
                              </div>
                            )}

                            {app.message && (
                              <div className="p-3 bg-accent border border-border rounded-md min-w-0 w-full max-w-full overflow-hidden">
                                <p className="text-xs font-semibold text-accent-foreground mb-1">APPLICATION MESSAGE</p>
                                <p className="text-sm italic text-accent-foreground/90 break-all break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-all' }}>"{app.message}"</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              onClick={() => acceptMutation.mutate(app.id)}
                              disabled={processingId === app.id}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                            >
                              {processingId === app.id && acceptMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Accepting...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Accept Application
                                </>
                              )}
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => rejectMutation.mutate(app.id)}
                              disabled={processingId === app.id}
                              className="flex-1"
                            >
                              {processingId === app.id && rejectMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Rejecting...
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 mr-2" />
                                  Reject Application
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No pending applications</p>
              <p className="text-sm">Applications from team members will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processed Applications */}
      {processedApplications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              Processed Applications ({processedApplications.length})
            </CardTitle>
            <CardDescription>Applications you've already reviewed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {processedApplications.map((app) => (
                <Card key={app.id} className="border">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {getInitials(app.applicantName || "Unknown")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{app.applicantName || "Unknown User"}</h4>
                          <p className="text-sm text-muted-foreground">
                            {getRoleLabel(app.applicantRole || "")} • {app.applicantEmail}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={app.status === "ACCEPTED" ? "default" : "destructive"}
                      >
                        {app.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </AppLayout>
  );
}

