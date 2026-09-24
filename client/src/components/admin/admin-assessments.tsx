import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Eye,
  Clock,
  FileQuestion,
  CheckCircle2,
  XCircle,
  GripVertical,
  UserPlus,
  X,
  RefreshCw,
  Users,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  cohortId: string | null;
  type: string | null;
  durationMinutes: number | null;
  passingScore: number | null;
  isActive: boolean;
  scheduledAt: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  questions?: AssessmentQuestion[];
}

interface AssessmentQuestion {
  id: string;
  assessmentId: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  prompt: string;
  optionsJson: string[] | null;
  correctAnswer: string | null;
  maxScore: number;
  order: number;
}

interface AssessmentAttempt {
  id: string;
  userId: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  resultsPublished: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface Cohort {
  id: string;
  name: string;
}

interface Learner {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AssessmentAssignment {
  id: string;
  assessmentId: string;
  userId: string;
  assignedBy: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface DetailedAttemptResult {
  attempt: {
    id: string;
    userId: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  };
  assessment: {
    id: string;
    title: string;
    passingScore: number | null;
  };
  questions: Array<{
    questionId: string;
    answerId: string | null;
    type: string;
    prompt: string;
    userAnswer: string | null;
    correctAnswer: string | null;
    awardedScore: number;
    maxScore: number;
    isCorrect: boolean;
  }>;
  summary: {
    totalQuestions: number;
    correctAnswers: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean | null;
  };
}

export default function AdminAssessments() {
  const { toast } = useToast();
  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showDetailedResultsDialog, setShowDetailedResultsDialog] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [gradingScores, setGradingScores] = useState<Record<string, string>>({});
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>([]);
  const [learnerSearchQuery, setLearnerSearchQuery] = useState("");
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamCohortId, setTeamCohortId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [duration, setDuration] = useState("60");
  const [passingScore, setPassingScore] = useState("70");
  const [isActive, setIsActive] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [questionType, setQuestionType] = useState<"MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY">("MCQ");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState<string[]>(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [maxScore, setMaxScore] = useState("1");
  const [questionOrder, setQuestionOrder] = useState("1");

  const { data: assessments = [], isLoading: loadingAssessments } = useQuery<Assessment[]>({
    queryKey: ["/api/assessments"],
  });

  const { data: cohorts = [] } = useQuery<Cohort[]>({
    queryKey: ["/api/cohorts"],
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; cohortId: string }) => {
      return apiRequest("POST", "/api/teams", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({ title: "Team created successfully" });
      setShowTeamDialog(false);
      setTeamName("");
      setTeamCohortId("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create team", variant: "destructive" });
    },
  });

  const handleCreateTeam = () => {
    if (!teamName || !teamCohortId) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    createTeamMutation.mutate({ name: teamName, cohortId: teamCohortId });
  };

  const { data: selectedAssessmentData } = useQuery<Assessment>({
    queryKey: ["/api/assessments", selectedAssessmentId],
    enabled: !!selectedAssessmentId,
    queryFn: async () => {
      const res = await fetch(`/api/assessments/${selectedAssessmentId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch assessment");
      return res.json();
    },
  });

  const { data: resultsData } = useQuery<{ assessment: Assessment; attempts: AssessmentAttempt[] }>({
    queryKey: ["/api/assessments", selectedAssessmentId, "results"],
    enabled: !!selectedAssessmentId && showResultsDialog,
    queryFn: async () => {
      const res = await fetch(`/api/assessments/${selectedAssessmentId}/results`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch results");
      return res.json();
    },
  });

  const { data: learners = [] } = useQuery<Learner[]>({
    queryKey: ["/api/users", "LEARNER"],
    enabled: showAssignDialog,
    queryFn: async () => {
      const res = await fetch("/api/users?role=LEARNER", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch interns");
      return res.json();
    },
  });

  const { data: currentAssignments = [] } = useQuery<AssessmentAssignment[]>({
    queryKey: ["/api/assessments", selectedAssessmentId, "assignments"],
    enabled: !!selectedAssessmentId && showAssignDialog,
    queryFn: async () => {
      const res = await fetch(`/api/assessments/${selectedAssessmentId}/assignments`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
  });

  const { data: detailedResultsData, isLoading: loadingDetailedResults, isError: detailedResultsError } = useQuery<DetailedAttemptResult>({
    queryKey: ["/api/attempts", selectedAttemptId, "details"],
    enabled: !!selectedAttemptId && showDetailedResultsDialog,
    queryFn: async () => {
      const res = await fetch(`/api/attempts/${selectedAttemptId}/details`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch detailed results");
      return res.json();
    },
  });

  const createAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/assessments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      toast({ title: "Assessment created successfully" });
      closeAssessmentDialog();
    },
    onError: () => {
      toast({ title: "Failed to create assessment", variant: "destructive" });
    },
  });

  const updateAssessmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/assessments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      toast({ title: "Assessment updated successfully" });
      closeAssessmentDialog();
    },
    onError: () => {
      toast({ title: "Failed to update assessment", variant: "destructive" });
    },
  });

  const deleteAssessmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/assessments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      toast({ title: "Assessment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete assessment", variant: "destructive" });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async ({ assessmentId, data }: { assessmentId: string; data: any }) => {
      return apiRequest("POST", `/api/assessments/${assessmentId}/questions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId] });
      toast({ title: "Question created successfully" });
      closeQuestionDialog();
    },
    onError: () => {
      toast({ title: "Failed to create question", variant: "destructive" });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ assessmentId, questionId, data }: { assessmentId: string; questionId: string; data: any }) => {
      return apiRequest("PATCH", `/api/assessments/${assessmentId}/questions/${questionId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId] });
      toast({ title: "Question updated successfully" });
      closeQuestionDialog();
    },
    onError: () => {
      toast({ title: "Failed to update question", variant: "destructive" });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async ({ assessmentId, questionId }: { assessmentId: string; questionId: string }) => {
      return apiRequest("DELETE", `/api/assessments/${assessmentId}/questions/${questionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId] });
      toast({ title: "Question deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete question", variant: "destructive" });
    },
  });

  const createAssignmentsMutation = useMutation({
    mutationFn: async ({ assessmentId, userIds }: { assessmentId: string; userIds: string[] }) => {
      return apiRequest("POST", `/api/assessments/${assessmentId}/assignments`, { userIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId, "assignments"] });
      toast({ title: "Interns assigned successfully" });
      setSelectedLearnerIds([]);
    },
    onError: () => {
      toast({ title: "Failed to assign interns", variant: "destructive" });
    },
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async ({ assessmentId, userId }: { assessmentId: string; userId: string }) => {
      return apiRequest("DELETE", `/api/assessments/${assessmentId}/assignments/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId, "assignments"] });
      toast({ title: "Assignment removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove assignment", variant: "destructive" });
    },
  });

  const gradeAnswerMutation = useMutation({
    mutationFn: async ({ answerId, awardedScore }: { answerId: string; awardedScore: number }) => {
      return apiRequest("POST", `/api/answers/${answerId}/grade`, { awardedScore });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", selectedAttemptId, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      toast({ title: "Answer graded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to grade answer", variant: "destructive" });
    },
  });

  const publishResultsMutation = useMutation({
    mutationFn: async ({ attemptId, publish }: { attemptId: string; publish: boolean }) => {
      const endpoint = publish ? "publish" : "unpublish";
      return apiRequest("POST", `/api/attempts/${attemptId}/${endpoint}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId, "results"] });
      toast({ 
        title: variables.publish ? "Results published successfully" : "Results unpublished successfully",
        description: variables.publish ? "The intern can now view their results." : "The results are now hidden from the intern."
      });
    },
    onError: () => {
      toast({ title: "Failed to update publish status", variant: "destructive" });
    },
  });

  const rescoreMutation = useMutation({
    mutationFn: async (attemptId: string) => {
      return apiRequest("POST", `/api/attempts/${attemptId}/rescore`);
    },
    onSuccess: async (data) => {
      // mutationFn returns apiRequest's parsed body, so this is already the data. It used to call
      // .json() on it, which threw inside onSuccess and swallowed the success message.
      queryClient.invalidateQueries({ queryKey: ["/api/assessments", selectedAssessmentId, "results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", selectedAttemptId, "details"] });
      toast({ 
        title: "Rescored successfully",
        description: data.message || `New score: ${data.totalScore}/${data.maxScore}`
      });
    },
    onError: () => {
      toast({ title: "Failed to rescore attempt", variant: "destructive" });
    },
  });

  const openAssessmentDialog = (assessment?: Assessment) => {
    if (assessment) {
      setEditingAssessment(assessment);
      setTitle(assessment.title);
      setDescription(assessment.description || "");
      setCohortId(assessment.cohortId || "");
      setDuration(assessment.durationMinutes?.toString() || "60");
      setPassingScore(assessment.passingScore?.toString() || "70");
      setIsActive(assessment.isActive);
      setScheduledAt(assessment.scheduledAt ? format(new Date(assessment.scheduledAt), "yyyy-MM-dd'T'HH:mm") : "");
      setExpiresAt(assessment.expiresAt ? format(new Date(assessment.expiresAt), "yyyy-MM-dd'T'HH:mm") : "");
    } else {
      setEditingAssessment(null);
      setTitle("");
      setDescription("");
      setCohortId("");
      setDuration("60");
      setPassingScore("70");
      setIsActive(false);
      setScheduledAt("");
      setExpiresAt("");
    }
    setShowAssessmentDialog(true);
  };

  const closeAssessmentDialog = () => {
    setShowAssessmentDialog(false);
    setEditingAssessment(null);
  };

  const openQuestionDialog = (question?: AssessmentQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionType(question.type);
      setQuestionPrompt(question.prompt);
      setQuestionOptions(question.optionsJson || ["", "", "", ""]);
      setCorrectAnswer(question.correctAnswer || "");
      setMaxScore(question.maxScore.toString());
      setQuestionOrder(question.order.toString());
    } else {
      setEditingQuestion(null);
      setQuestionType("MCQ");
      setQuestionPrompt("");
      setQuestionOptions(["", "", "", ""]);
      setCorrectAnswer("");
      setMaxScore("1");
      setQuestionOrder(((selectedAssessmentData?.questions?.length || 0) + 1).toString());
    }
    setShowQuestionDialog(true);
  };

  const closeQuestionDialog = () => {
    setShowQuestionDialog(false);
    setEditingQuestion(null);
  };

  const handleSaveAssessment = () => {
    const data = {
      title,
      description: description || null,
      cohortId: cohortId || null,
      durationMinutes: parseInt(duration),
      passingScore: parseInt(passingScore),
      isActive,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (editingAssessment) {
      updateAssessmentMutation.mutate({ id: editingAssessment.id, data });
    } else {
      createAssessmentMutation.mutate(data);
    }
  };

  const handleSaveQuestion = () => {
    if (!selectedAssessmentId) return;

    const data = {
      type: questionType,
      prompt: questionPrompt,
      optionsJson: questionType === "MCQ" ? questionOptions.filter(o => o.trim()) : null,
      correctAnswer: questionType === "ESSAY" ? null : correctAnswer,
      maxScore: parseInt(maxScore),
      order: parseInt(questionOrder),
    };

    if (editingQuestion) {
      updateQuestionMutation.mutate({
        assessmentId: selectedAssessmentId,
        questionId: editingQuestion.id,
        data,
      });
    } else {
      createQuestionMutation.mutate({
        assessmentId: selectedAssessmentId,
        data,
      });
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionOptions];
    newOptions[index] = value;
    setQuestionOptions(newOptions);
  };

  const openAssignDialog = (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setSelectedLearnerIds([]);
    setLearnerSearchQuery("");
    setShowAssignDialog(true);
  };

  const closeAssignDialog = () => {
    setShowAssignDialog(false);
    setSelectedLearnerIds([]);
    setLearnerSearchQuery("");
  };

  const openDetailedResultsDialog = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setShowDetailedResultsDialog(true);
  };

  const closeDetailedResultsDialog = () => {
    setShowDetailedResultsDialog(false);
    setSelectedAttemptId(null);
    setGradingScores({});
  };

  const toggleLearnerSelection = (learnerId: string) => {
    setSelectedLearnerIds(prev => 
      prev.includes(learnerId) 
        ? prev.filter(id => id !== learnerId)
        : [...prev, learnerId]
    );
  };

  const handleAssignLearners = () => {
    if (!selectedAssessmentId || selectedLearnerIds.length === 0) return;
    createAssignmentsMutation.mutate({
      assessmentId: selectedAssessmentId,
      userIds: selectedLearnerIds,
    });
  };

  const filteredLearners = learners.filter(learner => 
    learner.name.toLowerCase().includes(learnerSearchQuery.toLowerCase()) ||
    learner.email.toLowerCase().includes(learnerSearchQuery.toLowerCase())
  );

  const assignedUserIds = new Set(currentAssignments.map(a => a.userId));

  return (
    <AppLayout>
      <div className="space-y-6 p-6" data-testid="admin-assessments-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Assessment Management</h1>
            <p className="text-muted-foreground">Create and manage entrance assessments</p>
          </div>
          <Button onClick={() => openAssessmentDialog()} className="bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-create-assessment">
            <Plus className="w-4 h-4 mr-2" />
            Create Assessment
          </Button>
        </div>

        <Tabs defaultValue="assessments" className="space-y-6">
          <TabsList>
            <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments</TabsTrigger>
            <TabsTrigger value="questions" data-testid="tab-questions" disabled={!selectedAssessmentId}>
              Questions {selectedAssessmentId && `(${selectedAssessmentData?.questions?.length || 0})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assessments">
            <Card className="relative overflow-hidden bg-gradient-to-br from-card via-card to-muted border-2 border-border backdrop-blur-sm shadow-xl rounded-2xl">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <CardHeader className="relative">
                <CardTitle className="text-foreground">All Assessments</CardTitle>
                <CardDescription className="text-slate-700">Manage entrance tests and evaluations</CardDescription>
              </CardHeader>
              <CardContent className="relative">
                {loadingAssessments ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : assessments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileQuestion className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No assessments created yet</p>
                    <Button variant="outline" className="mt-4 border-primary text-primary hover:bg-accent" onClick={() => openAssessmentDialog()}>
                      Create your first assessment
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Passing Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assessments.map((assessment) => (
                        <TableRow
                          key={assessment.id}
                          className={selectedAssessmentId === assessment.id ? "bg-muted/50" : ""}
                          data-testid={`row-assessment-${assessment.id}`}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{assessment.title}</span>
                              {assessment.description && (
                                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {assessment.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {assessment.durationMinutes} min
                            </div>
                          </TableCell>
                          <TableCell>{assessment.passingScore}%</TableCell>
                          <TableCell>
                            <Badge variant={assessment.isActive ? "default" : "secondary"}>
                              {assessment.isActive ? "Active" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {assessment.questions?.length || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedAssessmentId(assessment.id);
                                  setShowResultsDialog(true);
                                }}
                                data-testid={`button-results-${assessment.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openAssignDialog(assessment.id)}
                                data-testid={`button-assign-${assessment.id}`}
                                title="Assign Interns"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openAssessmentDialog(assessment)}
                                data-testid={`button-edit-${assessment.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteAssessmentMutation.mutate(assessment.id)}
                                data-testid={`button-delete-${assessment.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions">
            {selectedAssessmentId && selectedAssessmentData && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground">{selectedAssessmentData.title} - Questions</CardTitle>
                    <CardDescription>Build and manage assessment questions</CardDescription>
                  </div>
                  <Button onClick={() => openQuestionDialog()} data-testid="button-add-question">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </CardHeader>
                <CardContent>
                  {!selectedAssessmentData.questions?.length ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileQuestion className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No questions added yet</p>
                      <Button variant="outline" className="mt-4" onClick={() => openQuestionDialog()}>
                        Add your first question
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedAssessmentData.questions.map((question, index) => (
                        <Card key={question.id} className="border" data-testid={`card-question-${question.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <GripVertical className="w-4 h-4" />
                                <span className="font-medium">Q{question.order}</span>
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{question.type}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {question.maxScore} point{question.maxScore !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <p className="font-medium">{question.prompt}</p>
                                {question.type === "MCQ" && question.optionsJson && (
                                  <div className="grid grid-cols-2 gap-2 mt-2">
                                    {question.optionsJson.map((option, i) => (
                                      <div
                                        key={i}
                                        className={`p-2 rounded text-sm ${
                                          option === question.correctAnswer
                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                            : "bg-muted"
                                        }`}
                                      >
                                        {option}
                                        {option === question.correctAnswer && (
                                          <CheckCircle2 className="w-3 h-3 inline ml-2" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {question.type === "TRUE_FALSE" && (
                                  <p className="text-sm text-muted-foreground">
                                    Correct: {question.correctAnswer}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openQuestionDialog(question)}
                                  data-testid={`button-edit-question-${question.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    deleteQuestionMutation.mutate({
                                      assessmentId: selectedAssessmentId,
                                      questionId: question.id,
                                    })
                                  }
                                  data-testid={`button-delete-question-${question.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showAssessmentDialog} onOpenChange={setShowAssessmentDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingAssessment ? "Edit Assessment" : "Create Assessment"}</DialogTitle>
              <DialogDescription>
                Configure the assessment details and settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Entrance Test 2025"
                  data-testid="input-assessment-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Assessment description..."
                  rows={2}
                  data-testid="textarea-assessment-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cohort">Cohort (optional)</Label>
                  <Select value={cohortId} onValueChange={setCohortId}>
                    <SelectTrigger data-testid="select-assessment-cohort">
                      <SelectValue placeholder="Select cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    data-testid="input-assessment-duration"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="passingScore">Passing Score (%)</Label>
                  <Input
                    id="passingScore"
                    type="number"
                    min="0"
                    max="100"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    data-testid="input-assessment-passing-score"
                  />
                </div>

                <div className="flex items-center gap-4 pt-6">
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    data-testid="switch-assessment-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Scheduled Start</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    data-testid="input-assessment-scheduled"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    data-testid="input-assessment-expires"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeAssessmentDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveAssessment}
                disabled={!title || createAssessmentMutation.isPending || updateAssessmentMutation.isPending}
                data-testid="button-save-assessment"
              >
                {(createAssessmentMutation.isPending || updateAssessmentMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingAssessment ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
              <DialogDescription>
                Configure the question and answer options
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select value={questionType} onValueChange={(v) => setQuestionType(v as any)}>
                    <SelectTrigger data-testid="select-question-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MCQ">Multiple Choice</SelectItem>
                      <SelectItem value="TRUE_FALSE">True/False</SelectItem>
                      <SelectItem value="SHORT_ANSWER">Short Answer</SelectItem>
                      <SelectItem value="ESSAY">Essay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Order</Label>
                    <Input
                      type="number"
                      min="1"
                      value={questionOrder}
                      onChange={(e) => setQuestionOrder(e.target.value)}
                      data-testid="input-question-order"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Points</Label>
                    <Input
                      type="number"
                      min="1"
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
                      data-testid="input-question-points"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Question Prompt</Label>
                <Textarea
                  value={questionPrompt}
                  onChange={(e) => setQuestionPrompt(e.target.value)}
                  placeholder="Enter the question..."
                  rows={3}
                  data-testid="textarea-question-prompt"
                />
              </div>

              {questionType === "MCQ" && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="space-y-2">
                    {questionOptions.map((option, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={option}
                          onChange={(e) => handleOptionChange(i, e.target.value)}
                          placeholder={`Option ${i + 1}`}
                          data-testid={`input-option-${i}`}
                        />
                        <Button
                          size="icon"
                          variant={correctAnswer === option && option ? "default" : "outline"}
                          onClick={() => setCorrectAnswer(option)}
                          disabled={!option}
                          data-testid={`button-correct-${i}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Click the checkmark to set the correct answer</p>
                </div>
              )}

              {questionType === "TRUE_FALSE" && (
                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Select value={correctAnswer} onValueChange={setCorrectAnswer}>
                    <SelectTrigger data-testid="select-true-false">
                      <SelectValue placeholder="Select correct answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">True</SelectItem>
                      <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {questionType === "SHORT_ANSWER" && (
                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Input
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    placeholder="Expected answer (exact match)"
                    data-testid="input-short-answer"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeQuestionDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveQuestion}
                disabled={!questionPrompt || createQuestionMutation.isPending || updateQuestionMutation.isPending}
                data-testid="button-save-question"
              >
                {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingQuestion ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Assessment Results</DialogTitle>
              <DialogDescription>
                View all attempts for this assessment
              </DialogDescription>
            </DialogHeader>

            {resultsData && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{resultsData.assessment.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Passing Score: {resultsData.assessment.passingScore}%
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {resultsData.attempts.length} Attempts
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                <div className="border rounded-lg overflow-hidden overflow-x-auto">
                  <ScrollArea className="h-[400px] min-w-[700px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[200px]">Applicant</TableHead>
                          <TableHead className="w-[100px]">Score</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[110px]">Published</TableHead>
                          <TableHead className="w-[140px]">Submitted</TableHead>
                          <TableHead className="text-right w-[280px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                      {resultsData.attempts.map((attempt) => (
                        <TableRow key={attempt.id} data-testid={`row-attempt-${attempt.id}`}>
                          <TableCell className="w-[200px]">
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{attempt.user?.name || "Unknown"}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {attempt.user?.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="w-[100px] whitespace-nowrap">
                            {attempt.score !== null ? (
                              <div className="flex flex-col">
                                <span className="font-medium">{attempt.score}/{attempt.maxScore}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({Math.round((attempt.score / (attempt.maxScore || 1)) * 100)}%)
                                </span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="w-[100px]">
                            {attempt.passed !== null ? (
                              attempt.passed ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 whitespace-nowrap">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Passed
                                </Badge>
                              ) : (
                                <Badge className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive whitespace-nowrap">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Failed
                                </Badge>
                              )
                            ) : (
                              <Badge variant="secondary">{attempt.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="w-[110px]">
                            {attempt.resultsPublished ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 whitespace-nowrap">
                                Published
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="whitespace-nowrap">Not Published</Badge>
                            )}
                          </TableCell>
                          <TableCell className="w-[140px] text-xs">
                            {attempt.submittedAt
                              ? format(new Date(attempt.submittedAt), "MMM d, yyyy h:mm a")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right w-[280px]">
                            <div className="flex items-center justify-end gap-1">
                              {(attempt.status === "SUBMITTED" || attempt.status === "GRADED") && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => rescoreMutation.mutate(attempt.id)}
                                    disabled={rescoreMutation.isPending}
                                    data-testid={`button-rescore-${attempt.id}`}
                                  >
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    Rescore
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={attempt.resultsPublished ? "outline" : "default"}
                                    onClick={() => publishResultsMutation.mutate({ 
                                      attemptId: attempt.id, 
                                      publish: !attempt.resultsPublished 
                                    })}
                                    disabled={publishResultsMutation.isPending}
                                    data-testid={`button-publish-${attempt.id}`}
                                  >
                                    {attempt.resultsPublished ? "Unpublish" : "Publish Result"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openDetailedResultsDialog(attempt.id)}
                                    data-testid={`button-view-details-${attempt.id}`}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    Details
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResultsDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detailed Results Dialog */}
        <Dialog open={showDetailedResultsDialog} onOpenChange={closeDetailedResultsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Detailed Attempt Results</DialogTitle>
              <DialogDescription>
                {detailedResultsData?.assessment.title || "Assessment Results"}
              </DialogDescription>
            </DialogHeader>

            {loadingDetailedResults ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detailedResultsError ? (
              <div className="text-center py-8 text-destructive">
                Failed to load detailed results. Please try again.
              </div>
            ) : detailedResultsData ? (
              <div className="space-y-6">
                {/* Summary Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResultsData.summary.totalScore}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResultsData.summary.maxScore}</p>
                    <p className="text-xs text-muted-foreground">Max Score</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResultsData.summary.percentage}%</p>
                    <p className="text-xs text-muted-foreground">Percentage</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResultsData.summary.correctAnswers}/{detailedResultsData.summary.totalQuestions}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  {detailedResultsData.summary.passed ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Passed (Required: {detailedResultsData.assessment.passingScore}%)
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                      <XCircle className="w-4 h-4 mr-1" />
                      Failed (Required: {detailedResultsData.assessment.passingScore}%)
                    </Badge>
                  )}
                </div>

                {/* Question Breakdown */}
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-4">
                    {detailedResultsData.questions.map((question, index) => {
                      const needsGrading = (question.type === "SHORT_ANSWER" || question.type === "ESSAY") && question.awardedScore === 0;
                      const isGraded = (question.type === "SHORT_ANSWER" || question.type === "ESSAY") && question.awardedScore > 0;
                      return (
                      <div 
                        key={question.questionId}
                        className={`p-4 rounded-lg border ${
                          needsGrading
                            ? "border-border bg-muted dark:border-border dark:bg-muted/20"
                            : isGraded || question.isCorrect 
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                            : "border-destructive/20 bg-destructive/10 dark:border-destructive/30 dark:bg-destructive/10"
                        }`}
                        data-testid={`admin-question-result-${question.questionId}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-muted-foreground">
                                Q{index + 1}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {question.type}
                              </Badge>
                              {(question.type === "SHORT_ANSWER" || question.type === "ESSAY") ? (
                                question.awardedScore > 0 ? (
                                  <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                    Graded
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    Requires grading
                                  </Badge>
                                )
                              ) : question.isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive" />
                              )}
                            </div>
                            <p className="text-sm mb-3">{question.prompt}</p>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="font-medium min-w-[100px]">Answer:</span>
                                <span className={question.isCorrect ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}>
                                  {question.userAnswer || "(No answer provided)"}
                                </span>
                              </div>
                              {!question.isCorrect && question.correctAnswer && question.type !== "ESSAY" && question.type !== "SHORT_ANSWER" && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium min-w-[100px]">Correct:</span>
                                  <span className="text-green-700 dark:text-green-300">
                                    {question.correctAnswer}
                                  </span>
                                </div>
                              )}
                              
                              {/* Grading UI for SHORT_ANSWER and ESSAY */}
                              {(question.type === "SHORT_ANSWER" || question.type === "ESSAY") && question.answerId && (
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                                  <Label className="text-sm font-medium">Grade:</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={question.maxScore || 1}
                                    className="w-20 h-8"
                                    placeholder={`0-${question.maxScore}`}
                                    value={gradingScores[question.questionId] ?? (question.awardedScore > 0 ? question.awardedScore.toString() : "")}
                                    onChange={(e) => setGradingScores(prev => ({
                                      ...prev,
                                      [question.questionId]: e.target.value
                                    }))}
                                    data-testid={`input-grade-${question.questionId}`}
                                  />
                                  <span className="text-sm text-muted-foreground">/ {question.maxScore}</span>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const score = parseInt(gradingScores[question.questionId] || "0");
                                      if (!isNaN(score) && score >= 0 && score <= (question.maxScore || 1)) {
                                        if (question.answerId) {
                                          gradeAnswerMutation.mutate({ 
                                            answerId: question.answerId, 
                                            awardedScore: score 
                                          });
                                        }
                                      }
                                    }}
                                    disabled={gradeAnswerMutation.isPending}
                                    data-testid={`button-save-grade-${question.questionId}`}
                                  >
                                    {gradeAnswerMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      "Save"
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {question.awardedScore}/{question.maxScore}
                            </p>
                            <p className="text-xs text-muted-foreground">points</p>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No results available
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={closeDetailedResultsDialog} data-testid="button-close-detailed-results">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Interns Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Interns</DialogTitle>
              <DialogDescription>
                Select interns to assign to this assessment
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search Input */}
              <Input
                placeholder="Search interns by name or email..."
                value={learnerSearchQuery}
                onChange={(e) => setLearnerSearchQuery(e.target.value)}
                data-testid="input-learner-search"
              />

              {/* Current Assignments */}
              {currentAssignments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Currently Assigned ({currentAssignments.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {currentAssignments.map((assignment) => (
                      <Badge 
                        key={assignment.id} 
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {assignment.user?.name || "Unknown"}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => {
                            if (selectedAssessmentId) {
                              deleteAssignmentMutation.mutate({
                                assessmentId: selectedAssessmentId,
                                userId: assignment.userId,
                              });
                            }
                          }}
                          data-testid={`button-remove-assignment-${assignment.userId}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Interns */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Available Interns ({filteredLearners.filter(l => !assignedUserIds.has(l.id)).length})
                </Label>
                <ScrollArea className="h-[250px] border rounded-md">
                  <div className="p-2 space-y-1">
                    {filteredLearners
                      .filter(learner => !assignedUserIds.has(learner.id))
                      .map((learner) => (
                        <div
                          key={learner.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => toggleLearnerSelection(learner.id)}
                          data-testid={`learner-row-${learner.id}`}
                        >
                          <Checkbox
                            checked={selectedLearnerIds.includes(learner.id)}
                            onCheckedChange={() => toggleLearnerSelection(learner.id)}
                            data-testid={`checkbox-learner-${learner.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{learner.name}</p>
                            <p className="text-xs text-muted-foreground">{learner.email}</p>
                          </div>
                        </div>
                      ))}
                    {filteredLearners.filter(l => !assignedUserIds.has(l.id)).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
{learners.length === 0
                          ? "No interns found"
                          : "All interns are already assigned"}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {selectedLearnerIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedLearnerIds.length} intern(s) selected
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeAssignDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignLearners}
                disabled={selectedLearnerIds.length === 0 || createAssignmentsMutation.isPending}
                data-testid="button-confirm-assign"
              >
                {createAssignmentsMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Assign Selected
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Team Dialog */}
        <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>Create a new startup team within a cohort.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name *</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Innovators"
                />
              </div>
              <div className="space-y-2">
                <Label>Cohort *</Label>
                <Select value={teamCohortId} onValueChange={setTeamCohortId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts?.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowTeamDialog(false); setTeamName(""); setTeamCohortId(""); }}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={!teamName || !teamCohortId || createTeamMutation.isPending}
              >
                {createTeamMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : "Create Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
