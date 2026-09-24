import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  Search,
  Eye,
  GraduationCap,
  Loader2,
  FileText,
  Send,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
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

interface Application {
  id: string;
  name: string;
  email: string;
  type: string;
  status: string;
  createdAt: string;
  formData?: any;
}

interface Assessment {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount?: number;
  hasQuestions?: boolean;
}

export default function ManagerApplicationsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("new");

  // Read status from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status && ["NEW", "REVIEW", "ACCEPTED", "REJECT", "all", "new"].includes(status)) {
      setStatusFilter(status === "NEW" ? "new" : status.toLowerCase());
    }
  }, [location]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  // Fetch all applications for counts
  const { data: allApplications = [] } = useQuery<Application[]>({
    queryKey: ["/api/manager/applications", "all", ""],
    queryFn: async () => {
      const data = await apiRequest("GET", `/manager/applications`);
      return data;
    },
    enabled: !!user,
  });

  const { data: applications, isLoading, error, refetch } = useQuery<Application[]>({
    queryKey: ["/api/manager/applications", statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter === "new") {
        params.append("status", "NEW");
      } else if (statusFilter !== "all") {
        params.append("status", statusFilter.toUpperCase());
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const data = await apiRequest("GET", `/manager/applications?${params.toString()}`);
      return data;
    },
    enabled: !!user,
  });

  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ["/api/manager/assessments"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/manager/assessments");
      return data;
    },
    enabled: !!user,
  });

  const { data: selectedAssessmentDetails } = useQuery<{ questionCount?: number; hasQuestions?: boolean }>({
    queryKey: ["/api/manager/assessments", selectedAssessmentId],
    queryFn: async () => {
      if (!selectedAssessmentId) return null;
      const data = await apiRequest("GET", `/manager/assessments/${selectedAssessmentId}`);
      return data;
    },
    enabled: !!selectedAssessmentId && showAssignDialog,
  });

  const assignAssessmentMutation = useMutation({
    mutationFn: async ({ applicationId, assessmentId, email }: { applicationId: string; assessmentId: string; email: string }) => {
      // Check if assessment has questions before sending
      const assessmentDetails = await apiRequest("GET", `/manager/assessments/${assessmentId}`);
      if (!assessmentDetails.questions || assessmentDetails.questions.length === 0) {
        throw new Error("Assessment has no questions. Please add questions before assigning.");
      }
      
      return apiRequest("POST", "/manager/applications/assign-assessment", {
        applicationId,
        assessmentId,
        email,
      });
    },
    onSuccess: () => {
      toast({ title: "Assessment assigned successfully. Email sent to candidate." });
      setShowAssignDialog(false);
      setSelectedApplication(null);
      setSelectedAssessmentId("");
      queryClient.invalidateQueries({ queryKey: ["/api/manager/applications"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to assign assessment", variant: "destructive" });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "NEW":
        return "default";
      case "REVIEW":
        return "secondary";
      case "OFFER":
        return "outline";
      case "ACCEPTED":
        return "default";
      case "PAID":
        return "default";
      case "REJECT":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return format(date, "MMM d, yyyy");
  };

  const handleAssignAssessment = () => {
    if (!selectedApplication || !selectedAssessmentId) {
      toast({ title: "Please select an assessment", variant: "destructive" });
      return;
    }
    assignAssessmentMutation.mutate({
      applicationId: selectedApplication.id,
      assessmentId: selectedAssessmentId,
      email: selectedApplication.email,
    });
  };

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load applications. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Intern Applications">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Intern Applications</h1>
            <p className="text-muted-foreground">Manage and review intern candidate applications</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === "new" ? "default" : "outline"}
            onClick={() => setStatusFilter("new")}
            className={statusFilter === "new" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            New Applications ({allApplications.filter(app => app.status === "NEW").length})
          </Button>
          <Button
            variant={statusFilter === "review" ? "default" : "outline"}
            onClick={() => setStatusFilter("review")}
            className={statusFilter === "review" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            In Review ({allApplications.filter(app => app.status === "REVIEW").length})
          </Button>
          <Button
            variant={statusFilter === "accepted" ? "default" : "outline"}
            onClick={() => setStatusFilter("accepted")}
            className={statusFilter === "accepted" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            Accepted ({allApplications.filter(app => app.status === "ACCEPTED").length})
          </Button>
          <Button
            variant={statusFilter === "reject" ? "default" : "outline"}
            onClick={() => setStatusFilter("reject")}
            className={statusFilter === "reject" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            Rejected ({allApplications.filter(app => app.status === "REJECT").length})
          </Button>
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className={statusFilter === "all" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "border-primary text-primary hover:bg-primary/10 bg-card"}
          >
            All Applications ({allApplications.length})
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Applications List */}
<Card className="border border-border bg-card">
            <CardHeader>
            <CardTitle className="text-foreground">Applications</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${applications?.length || 0} applications found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : applications && applications.length > 0 ? (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => setLocation(`/app/manager/applications/${app.id}`)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{app.name}</h3>
                          <Badge variant={getStatusBadgeVariant(app.status)}>
                            {app.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{app.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Applied {formatTimeAgo(app.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={app.type !== "LEARNER"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (app.type !== "LEARNER") return;
                          setSelectedApplication(app);
                          setShowAssignDialog(true);
                        }}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Assign Assessment
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/app/manager/applications/${app.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No applications found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Assessment Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Assessment</DialogTitle>
              <DialogDescription>
                Select an assessment to assign to {selectedApplication?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Assessment</label>
                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((assessment) => (
                      <SelectItem key={assessment.id} value={assessment.id}>
                        {assessment.title} ({assessment.durationMinutes} min)
                        {assessment.hasQuestions === false && " ⚠️ No questions"}
                        {assessment.questionCount !== undefined && ` (${assessment.questionCount} questions)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                An email with the assessment link will be sent to {selectedApplication?.email}
              </p>
              {selectedAssessmentDetails && (
                <div className={`p-3 rounded-lg ${
                  selectedAssessmentDetails.hasQuestions === false 
                    ? "bg-destructive/10 border border-destructive/30" 
                    : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                }`}>
                  {selectedAssessmentDetails.hasQuestions === false ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-800 dark:text-red-300">
                            This assessment has no questions.
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                            Please add questions before assigning.
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => {
                          setShowAssignDialog(false);
                          setLocation("/app/manager/assessments");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Go to Assessments to Add Questions
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-green-800 dark:text-green-300">
                      ✓ Assessment has {selectedAssessmentDetails.questionCount || 0} question(s)
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignAssessment}
                disabled={!selectedAssessmentId || assignAssessmentMutation.isPending || selectedAssessmentDetails?.hasQuestions === false}
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

