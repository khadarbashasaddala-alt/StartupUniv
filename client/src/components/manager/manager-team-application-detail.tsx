import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, User, Mail, Check, X, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface TeamApplicationDetail {
  id: string;
  type: string;
  status: string;
  formData: {
    team_name?: string;
    team_leader_full_name?: string;
    team_leader_email?: string;
    team_leader_phone?: string;
    project_description?: string;
    number_of_members?: number;
  };
  teamMembers?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    cofounderRole?: string | null;
    internTrack?: string | null;
    status: string;
    individualApplicationId?: string | null;
    individualApplication?: {
      id: string;
      status: string;
      userId?: string;
    } | null;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  createdAt: string;
  cohortId?: string;
  cohort?: { id: string; name: string };
}

type TeamMember = NonNullable<TeamApplicationDetail['teamMembers']>[number];

export default function ManagerTeamApplicationDetailPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [match, params] = useRoute("/app/manager/team-applications/:id");
  const applicationId = params?.id;

  const { data: application, isLoading, error } = useQuery<TeamApplicationDetail>({
    queryKey: ["/api/manager/team-applications", applicationId],
    queryFn: async () => {
      const data = await apiRequest("GET", `/manager/team-applications/${applicationId}`);
      return data;
    },
    enabled: !!applicationId && !!user,
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACCEPTED": 
      case "SUBMITTED":
        return "default";
      case "PENDING": 
      case "INVITED":
        return "secondary";
      case "REJECTED": 
        return "destructive";
      default: 
        return "outline";
    }
  };

  const getCredentialsStatus = (member: NonNullable<TeamApplicationDetail["teamMembers"]>[number]) => {
    // Check if user account exists (credentials created)
    return member.user ? "Yes" : "No";
  };

  const getIndividualApplicationStatus = (member: NonNullable<TeamApplicationDetail["teamMembers"]>[number]) => {
    if (member.individualApplication) {
      return member.individualApplication.status;
    }
    if (member.individualApplicationId) {
      return "SUBMITTED";
    }
    return member.status || "PENDING";
  };
  const getFormSubmittedStatus = (member: TeamMember) => {
    // Check if individual has submitted their application form
    return member.individualApplicationId ? "Yes" : "No";
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
              <p className="text-destructive">Failed to load team application details.</p>
              <Button onClick={() => setLocation("/app/manager/team-applications")} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Team Applications
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const formData = application.formData || {};

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/app/manager/team-applications")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Team Application Details</h1>
              <p className="text-muted-foreground mt-1">
                {formData.team_name || "Unnamed Team"}
              </p>
            </div>
          </div>
          <Badge variant={getStatusBadgeVariant(application.status)}>
            {application.status}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Team Leader Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{formData.team_leader_full_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{formData.team_leader_email || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{formData.team_leader_phone || "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Team Name</p>
                <p className="font-medium">{formData.team_name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Number of Members</p>
                <p className="font-medium">{formData.number_of_members || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Applied On</p>
                <p className="font-medium">
                  {format(new Date(application.createdAt), "MMMM do, yyyy")}
                </p>
              </div>
              {application.cohort && (
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Cohort</p>
                  <Badge variant="outline">{application.cohort.name}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Description */}
        {formData.project_description && (
          <Card>
            <CardHeader>
              <CardTitle>Project Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{formData.project_description}</p>
            </CardContent>
          </Card>
        )}

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              Individual application status and credentials information for each team member
            </CardDescription>
          </CardHeader>
          <CardContent>
            {application.teamMembers && application.teamMembers.length > 0 ? (
              <div className="space-y-4">
                {application.teamMembers.map((member, index) => {
                  const individualStatus = getIndividualApplicationStatus(member);
                  const formSubmitted = getFormSubmittedStatus(member);
                  const credentialsCreated = getCredentialsStatus(member);
                  
                  return (
                    <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
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
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {/* Individual Application Status Column */}
                        <div className="text-center min-w-[120px]">
                          <p className="text-xs text-muted-foreground mb-1">Application Status</p>
                          <Badge variant={getStatusBadgeVariant(individualStatus)}>
                            {individualStatus}
                          </Badge>
                        </div>

                        {/* Form Submitted Column */}
                        <div className="text-center min-w-[100px]">
                          <p className="text-xs text-muted-foreground mb-1">Form Submitted</p>
                          <div className="flex items-center justify-center">
                            {formSubmitted === "Yes" ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Yes</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-orange-500">
                                <XCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">No</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Credentials Created Column */}
                        <div className="text-center min-w-[100px]">
                          <p className="text-xs text-muted-foreground mb-1">Credentials</p>
                          <div className="flex items-center justify-center">
                            {credentialsCreated === "Yes" ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">Yes</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <XCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">No</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Additional Info */}
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
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">No team members found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}