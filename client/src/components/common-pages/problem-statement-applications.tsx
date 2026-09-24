import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, Calendar, CheckCircle2, XCircle, Clock, Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Application {
  id: string;
  problemStatementId: string;
  applicantId: string;
  applicantRole: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  message: string | null;
  createdAt: string;
  applicant: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

interface ProblemStatement {
  id: string;
  title: string;
  overview: string;
  createdBy: string;
  createdByRole: string;
}

export default function ProblemStatementApplicationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/app/problem-statements/:id/applications");
  const problemStatementId = params?.id || "";

  const { data: statement, isLoading: statementLoading, error: statementError } = useQuery<ProblemStatement>({
    queryKey: ["/api/problem-statements", problemStatementId],
    queryFn: async () => await apiRequest("GET", `/api/problem-statements/${problemStatementId}`),
    enabled: !!problemStatementId,
  });

  const { data: applications, isLoading: applicationsLoading, error: applicationsError } = useQuery<Application[]>({
    queryKey: ["/api/problem-statements", problemStatementId, "applications"],
    queryFn: async () => await apiRequest("GET", `/api/problem-statements/${problemStatementId}/applications`),
    enabled: !!problemStatementId && !!statement,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: "ACCEPTED" | "REJECTED" }) => {
      return await apiRequest("PUT", `/api/problem-statements/applications/${applicationId}/status`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Application status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", problemStatementId, "applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", problemStatementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] }); // Invalidate list to update counts
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update application status",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Accepted</Badge>;
      case "REJECTED":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "PENDING":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      LEARNER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      COFOUNDER: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return (
      <Badge className={colors[role] || "bg-gray-100 text-gray-800"} variant="outline">
        {role}
      </Badge>
    );
  };

  if (statementLoading || applicationsLoading) {
    return (
      <AppLayout title="Applications">
        <div className="container mx-auto p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-4 w-96 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (statementError || (!statement && !statementLoading)) {
    return (
      <AppLayout title="Applications">
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-destructive">
                {statementError ? (statementError as any)?.message || "Failed to load problem statement" : "Problem statement not found"}
              </p>
              <Button onClick={() => setLocation("/app/problem-statements")} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Problem Statements
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!statement) {
    return null; // Still loading
  }

  const learnerApplications = applications?.filter(app => app.applicantRole === "LEARNER") || [];
  const cofounderApplications = applications?.filter(app => app.applicantRole === "COFOUNDER") || [];

  return (
    <AppLayout title="Problem Statement Applications">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/app/problem-statements")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{statement.title}</h1>
            <p className="text-muted-foreground mt-1">{statement.overview}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intern Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{learnerApplications.length} / 7</div>
              <p className="text-sm text-muted-foreground">Maximum 7 interns allowed</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Co-Founder Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{cofounderApplications.length} / 2</div>
              <p className="text-sm text-muted-foreground">Maximum 2 co-founders allowed</p>
            </CardContent>
          </Card>
        </div>

        {applicationsError ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-destructive">
                {(applicationsError as any)?.message || "Failed to load applications"}
              </p>
            </CardContent>
          </Card>
        ) : applications && applications.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No applications received yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">All Applications</h2>
            {applications?.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">
                          {app.applicant?.name || "Unknown User"}
                        </CardTitle>
                        {getRoleBadge(app.applicantRole)}
                        {getStatusBadge(app.status)}
                      </div>
                      {app.applicant?.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {app.applicant.email}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Applied on {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {app.applicant?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (app.applicant?.id) {
                              setLocation(`/app/user-profile/${app.applicant.id}`);
                            }
                          }}
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                      )}
                      <Select
                        value={app.status}
                        onValueChange={(value) => {
                          if (value !== app.status && (value === "ACCEPTED" || value === "REJECTED")) {
                            updateStatusMutation.mutate({
                              applicationId: app.id,
                              status: value as "ACCEPTED" | "REJECTED",
                            });
                          }
                        }}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pending</SelectItem>
                          <SelectItem value="ACCEPTED">Accept</SelectItem>
                          <SelectItem value="REJECTED">Reject</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                {app.message && (
                  <CardContent>
                    <CardDescription>
                      <strong>Message:</strong> {app.message}
                    </CardDescription>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

