import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  Send,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  FileQuestion,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Assessment {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  questionCount?: number;
  hasQuestions?: boolean;
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
  assessmentId: string;
  userId: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  application: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface DetailedResult {
  attempt: AssessmentAttempt;
  assessment: Assessment;
  questions: Array<{
    questionId: string;
    answerId?: string;
    type: string;
    prompt: string;
    options: string[] | null;
    userAnswer: string | null;
    correctAnswer: string | null;
    awardedScore: number;
    maxScore: number;
    isCorrect: boolean;
  }>;
  summary: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean | null;
  };
}

export default function ManagerAssessmentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<"pass" | "fail" | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [showQuestionsDialog, setShowQuestionsDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null);
  const [questionType, setQuestionType] = useState<"MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY">("MCQ");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState<string[]>(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [maxScore, setMaxScore] = useState("1");
  const [questionOrder, setQuestionOrder] = useState("1");
  const [gradingScores, setGradingScores] = useState<Record<string, string>>({});
  const [showAssessmentDialog, setShowAssessmentDialog] = useState(false);
  const [assessmentTitle, setAssessmentTitle] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [assessmentCohortId, setAssessmentCohortId] = useState("");
  const [assessmentDuration, setAssessmentDuration] = useState("60");
  const [assessmentPassingScore, setAssessmentPassingScore] = useState("70");
  const [assessmentIsActive, setAssessmentIsActive] = useState(false);

  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ["/api/manager/assessments"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/manager/assessments");
      return data;
    },
    enabled: !!user,
  });

  const { data: selectedAssessmentWithQuestions } = useQuery<Assessment>({
    queryKey: ["/api/manager/assessments", selectedAssessmentId],
    queryFn: async () => {
      if (!selectedAssessmentId) return null;
      const data = await apiRequest("GET", `/manager/assessments/${selectedAssessmentId}`);
      return data;
    },
    enabled: !!selectedAssessmentId && (showQuestionsDialog || showQuestionDialog),
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/assessments/${selectedAssessmentId}/questions`, data);
    },
    onSuccess: () => {
      toast({ title: "Question added successfully" });
      setShowQuestionDialog(false);
      resetQuestionForm();
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments", selectedAssessmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to add question", variant: "destructive" });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ questionId, data }: { questionId: string; data: any }) => {
      return apiRequest("PATCH", `/api/assessments/${selectedAssessmentId}/questions/${questionId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Question updated successfully" });
      setShowQuestionDialog(false);
      setEditingQuestion(null);
      resetQuestionForm();
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments", selectedAssessmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update question", variant: "destructive" });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      return apiRequest("DELETE", `/api/assessments/${selectedAssessmentId}/questions/${questionId}`);
    },
    onSuccess: () => {
      toast({ title: "Question deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments", selectedAssessmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to delete question", variant: "destructive" });
    },
  });

  const { data: attempts = [] } = useQuery<AssessmentAttempt[]>({
    queryKey: ["/api/manager/assessments", selectedAssessmentId, "attempts"],
    queryFn: async () => {
      if (!selectedAssessmentId) return [];
      const data = await apiRequest("GET", `/manager/assessments/${selectedAssessmentId}/attempts`);
      return data;
    },
    enabled: !!user && !!selectedAssessmentId,
  });

  const { data: detailedResult, isLoading: loadingDetails } = useQuery<DetailedResult>({
    queryKey: ["/attempts", selectedAttemptId, "details"],
    queryFn: async () => {
      if (!selectedAttemptId) throw new Error("No attempt selected");
      const data = await apiRequest("GET", `/attempts/${selectedAttemptId}/details`);
      return data;
    },
    enabled: !!selectedAttemptId && showDetailsDialog,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ attemptId, passed }: { attemptId: string; passed: boolean }) => {
      return apiRequest("POST", `/manager/assessments/attempts/${attemptId}/review`, { passed });
    },
    onSuccess: () => {
      toast({ title: "Assessment reviewed successfully" });
      setShowReviewDialog(false);
      setReviewDecision(null);
      // Invalidate the attempts query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments", selectedAssessmentId, "attempts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to review assessment", variant: "destructive" });
    },
  });

  const notifyAdminMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      console.log("📧 Notifying admin for application:", applicationId);
      const response = await apiRequest("POST", `/manager/applications/${applicationId}/notify-admin`);
      console.log("✅ Notify admin response:", response);
      return response;
    },
    onSuccess: () => {
      toast({ title: "Admin notified successfully" });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/manager/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments", selectedAssessmentId, "attempts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments"] });
    },
    onError: (error: any) => {
      console.error("❌ Failed to notify admin:", error);
      toast({ 
        title: error.message || "Failed to notify admin", 
        description: error.response?.data?.message || "Please try again or contact support.",
        variant: "destructive" 
      });
    },
  });

  const gradeAnswerMutation = useMutation({
    mutationFn: async ({ answerId, awardedScore }: { answerId: string; awardedScore: number }) => {
      return apiRequest("POST", `/api/answers/${answerId}/grade`, { awardedScore });
    },
    onSuccess: () => {
      toast({ title: "Answer graded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/attempts", selectedAttemptId, "details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments", selectedAssessmentId, "attempts"] });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to grade answer", variant: "destructive" });
    },
  });

  const handleReview = () => {
    if (!selectedAttemptId || !reviewDecision) {
      toast({ title: "Please select pass or fail", variant: "destructive" });
      return;
    }
    reviewMutation.mutate({
      attemptId: selectedAttemptId,
      passed: reviewDecision === "pass",
    });
  };

  const getStatusBadge = (attempt: AssessmentAttempt) => {
    if (attempt.status === "SUBMITTED" && attempt.passed === null) {
      return <Badge variant="secondary">Pending Review</Badge>;
    }
    if (attempt.passed === true) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Passed
      </Badge>;
    }
    if (attempt.passed === false) {
      return <Badge className="bg-destructive/15 text-destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>;
    }
    return <Badge variant="outline">{attempt.status}</Badge>;
  };

  const calculatePassingScore = (maxScore: number) => {
    return Math.ceil(maxScore * 0.75);
  };

  const resetQuestionForm = () => {
    setQuestionType("MCQ");
    setQuestionPrompt("");
    setQuestionOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setMaxScore("1");
    setQuestionOrder("1");
    setEditingQuestion(null);
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
      resetQuestionForm();
    }
    setShowQuestionDialog(true);
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionOptions];
    newOptions[index] = value;
    setQuestionOptions(newOptions);
  };

  const handleSaveQuestion = () => {
    if (!questionPrompt || !selectedAssessmentId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    const data = {
      type: questionType,
      prompt: questionPrompt,
      optionsJson: questionType === "MCQ" ? questionOptions.filter(o => o.trim()) : null,
      correctAnswer: questionType === "ESSAY" ? null : correctAnswer,
      maxScore: parseInt(maxScore),
      order: parseInt(questionOrder),
    };

    if (editingQuestion) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data });
    } else {
      createQuestionMutation.mutate(data);
    }
  };

  const { data: cohorts = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/cohorts"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/cohorts");
      return data;
    },
    enabled: !!user,
  });

  const createAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/assessments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/manager/assessments"] });
      toast({ title: "Assessment created successfully" });
      setShowAssessmentDialog(false);
      setAssessmentTitle("");
      setAssessmentDescription("");
      setAssessmentCohortId("");
      setAssessmentDuration("60");
      setAssessmentPassingScore("70");
      setAssessmentIsActive(false);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create assessment", variant: "destructive" });
    },
  });

  const handleCreateAssessment = () => {
    if (!assessmentTitle) {
      toast({ title: "Missing fields", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    createAssessmentMutation.mutate({
      title: assessmentTitle,
      description: assessmentDescription || null,
      cohortId: assessmentCohortId || null,
      durationMinutes: parseInt(assessmentDuration) || 60,
      passingScore: parseInt(assessmentPassingScore) || 70,
      isActive: assessmentIsActive,
    });
  };

  return (
    <AppLayout title="Review Assessments">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Review Assessments</h1>
          <p className="text-muted-foreground">Review candidate assessment results and make pass/fail decisions</p>
          </div>
          <Button onClick={() => setShowAssessmentDialog(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Create New Assessment
          </Button>
        </div>

        {/* Assessment Selection */}
<Card className="border border-border bg-card">
            <CardHeader>
            <CardTitle className="text-foreground">Select Assessment</CardTitle>
            <CardDescription>Choose an assessment to review attempts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedAssessmentId || ""} onValueChange={setSelectedAssessmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map((assessment) => (
                  <SelectItem key={assessment.id} value={assessment.id}>
                    {assessment.title}
                    {assessment.hasQuestions === false && " ⚠️ No questions"}
                    {assessment.questionCount !== undefined && ` (${assessment.questionCount} questions)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAssessmentId && (
              <Button
                variant="outline"
                onClick={() => setShowQuestionsDialog(true)}
                className="w-full"
              >
                <FileQuestion className="h-4 w-4 mr-2" />
                Manage Questions
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Attempts List */}
        {selectedAssessmentId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Assessment Attempts</CardTitle>
              <CardDescription>
                {attempts.length} attempt{attempts.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attempts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No attempts found for this assessment
                </p>
              ) : (
                <div className="space-y-4">
                  {attempts.map((attempt) => {
                    const passingScore = attempt.maxScore ? calculatePassingScore(attempt.maxScore) : 0;
                    const percentage = attempt.maxScore && attempt.score !== null
                      ? Math.round((attempt.score / attempt.maxScore) * 100)
                      : 0;

                    // Debug: Log attempt data for graded attempts
                    if (attempt.status === "GRADED") {
                      console.log("Graded attempt:", {
                        id: attempt.id,
                        status: attempt.status,
                        passed: attempt.passed,
                        application: attempt.application,
                        hasApplication: !!attempt.application,
                      });
                    }

                    return (
                      <div
                        key={attempt.id}
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {attempt.user?.name || attempt.application?.name || "Unknown"}
                              </h3>
                              {getStatusBadge(attempt)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {attempt.user?.email || attempt.application?.email || "N/A"}
                            </p>
                            {attempt.submittedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Submitted: {format(new Date(attempt.submittedAt), "MMM d, yyyy h:mm a")}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {attempt.score !== null && attempt.maxScore !== null && (
                              <>
                                <div className="text-2xl font-bold">
                                  {attempt.score}/{attempt.maxScore}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {percentage}% (Pass: {passingScore}+)
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAttemptId(attempt.id);
                              setGradingScores({});
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          {attempt.status === "SUBMITTED" && attempt.passed === null && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={async () => {
                                setSelectedAttemptId(attempt.id);
                                // Open details dialog first to load the data
                                setShowDetailsDialog(true);
                                // Wait a bit for data to load, then show review dialog
                                setTimeout(() => {
                                  setShowReviewDialog(true);
                                }, 500);
                              }}
                            >
                              Review
                            </Button>
                          )}
                          {attempt.status === "GRADED" && attempt.passed !== null && attempt.application && (
                            <Button
                              variant={attempt.passed ? "default" : "destructive"}
                              size="sm"
                              onClick={() => {
                                if (!attempt.application?.id) {
                                  toast({ 
                                    title: "Application ID not found", 
                                    variant: "destructive" 
                                  });
                                  return;
                                }
                                console.log("📧 Clicked notify admin for application:", attempt.application.id);
                                notifyAdminMutation.mutate(attempt.application.id);
                              }}
                              disabled={notifyAdminMutation.isPending || !attempt.application?.id}
                            >
                              {notifyAdminMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Notifying...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-2" />
                                  Notify Admin ({attempt.passed ? "Passed" : "Failed"})
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Review Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Assessment</DialogTitle>
              <DialogDescription>
                After reviewing all questions, decide if the candidate passed or failed (75% passing score required)
              </DialogDescription>
            </DialogHeader>
            {detailedResult && (() => {
              const reviewedQuestions = detailedResult.questions.filter(q => q.awardedScore !== null && q.awardedScore !== undefined);
              const allReviewed = reviewedQuestions.length === detailedResult.questions.length;
              const currentScore = reviewedQuestions.reduce((sum, q) => sum + (q.awardedScore || 0), 0);
              const currentPercentage = detailedResult.summary.maxScore > 0 
                ? Math.round((currentScore / detailedResult.summary.maxScore) * 100) 
                : 0;
              
              return (
                <div className="space-y-4 py-4">
                  {!allReviewed ? (
                    <div className="p-4 bg-muted/50 border border-border rounded-lg">
                      <p className="text-sm font-medium text-foreground">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        Please review all questions first ({reviewedQuestions.length}/{detailedResult.questions.length} reviewed)
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Go back to the details view and mark each question as correct (✓) or incorrect (✗) before making a pass/fail decision.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold">{currentScore}</p>
                            <p className="text-xs text-muted-foreground">Score</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{detailedResult.summary.maxScore}</p>
                            <p className="text-xs text-muted-foreground">Max Score</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{currentPercentage}%</p>
                            <p className="text-xs text-muted-foreground">Percentage</p>
                          </div>
                        </div>
                      </div>
                      <RadioGroup value={reviewDecision || ""} onValueChange={(value) => setReviewDecision(value as "pass" | "fail")}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pass" id="pass" />
                          <Label htmlFor="pass" className="flex items-center gap-2 cursor-pointer">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Pass (75% or above) - {currentPercentage >= 75 ? "✓ Meets requirement" : "⚠ Below 75%"}
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="fail" id="fail" />
                          <Label htmlFor="fail" className="flex items-center gap-2 cursor-pointer">
                            <XCircle className="h-4 w-4 text-red-600" />
                            Fail (Below 75%) - {currentPercentage < 75 ? "✓ Below requirement" : "⚠ Above 75%"}
                          </Label>
                        </div>
                      </RadioGroup>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          Based on your review, the candidate scored {currentPercentage}%. Select Pass if they meet the 75% threshold, or Fail if they don't.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                disabled={!reviewDecision || reviewMutation.isPending || (detailedResult && detailedResult.questions.filter(q => q.awardedScore !== null && q.awardedScore !== undefined).length !== detailedResult.questions.length)}
              >
                {reviewMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Assessment Details</DialogTitle>
              <DialogDescription>
                {detailedResult?.assessment.title || "Assessment Results"}
              </DialogDescription>
            </DialogHeader>
            {loadingDetails ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detailedResult ? (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  {/* Summary */}
                  {(() => {
                    const reviewedQuestions = detailedResult.questions.filter(q => q.awardedScore !== null && q.awardedScore !== undefined);
                    const allReviewed = reviewedQuestions.length === detailedResult.questions.length;
                    const currentScore = reviewedQuestions.reduce((sum, q) => sum + (q.awardedScore || 0), 0);
                    const currentPercentage = detailedResult.summary.maxScore > 0 
                      ? Math.round((currentScore / detailedResult.summary.maxScore) * 100) 
                      : 0;
                    
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">
                            {allReviewed ? currentScore : `${currentScore}*`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Score {!allReviewed && `(${reviewedQuestions.length}/${detailedResult.questions.length} reviewed)`}
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{detailedResult.summary.maxScore}</p>
                          <p className="text-xs text-muted-foreground">Max Score</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">
                            {allReviewed ? `${currentPercentage}%` : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">Percentage</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg text-center">
                          {allReviewed ? (
                            detailedResult.summary.passed !== null ? (
                              detailedResult.summary.passed ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  Passed
                                </Badge>
                              ) : (
                                <Badge className="bg-destructive/15 text-destructive">
                                  Failed
                                </Badge>
                              )
                            ) : (
                              <Badge variant="secondary">Pending Decision</Badge>
                            )
                          ) : (
                            <Badge variant="secondary">Review All Questions</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Questions */}
                  <div className="space-y-4">
                    {detailedResult.questions.map((question, index) => {
                      const isGraded = question.awardedScore !== null && question.awardedScore !== undefined;
                      const isCorrect = isGraded && question.awardedScore === question.maxScore;
                      
                      return (
                        <div
                          key={question.questionId}
                          className={`p-4 rounded-lg border ${
                            !isGraded
                              ? "border-border bg-muted/30"
                              : isCorrect
                              ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                              : "border-destructive/30 bg-destructive/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium">Q{index + 1}</span>
                                <Badge variant="outline" className="text-xs">
                                  {question.type}
                                </Badge>
                                {isGraded ? (
                                  isCorrect ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  )
                                ) : (
                                  <Badge variant="secondary" className="text-xs">Not Reviewed</Badge>
                                )}
                              </div>
                              <p className="text-sm mb-3">{question.prompt}</p>
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium">Answer: </span>
                                  <span className={question.type === "ESSAY" || question.type === "SHORT_ANSWER" ? "whitespace-pre-wrap" : ""}>
                                    {question.userAnswer || "(No answer)"}
                                  </span>
                                </div>
                                {question.correctAnswer && question.type !== "ESSAY" && question.type !== "SHORT_ANSWER" && (
                                  <div>
                                    <span className="font-medium">Expected Answer: </span>
                                    <span className="text-primary">{question.correctAnswer}</span>
                                  </div>
                                )}
                                
                                {/* Manual Marking UI for MCQ and TRUE_FALSE */}
                                {(question.type === "MCQ" || question.type === "TRUE_FALSE") && question.answerId && (
                                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                                    <Label className="text-sm font-medium">Mark:</Label>
                                    <Button
                                      size="sm"
                                      variant={isGraded && isCorrect ? "default" : "outline"}
                                      className="bg-green-100 hover:bg-green-200 text-green-800 border-green-300"
                                      onClick={() => {
                                        if (question.answerId) {
                                          gradeAnswerMutation.mutate({ 
                                            answerId: question.answerId, 
                                            awardedScore: question.maxScore 
                                          });
                                        }
                                      }}
                                      disabled={gradeAnswerMutation.isPending}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" />
                                      Correct
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={isGraded && !isCorrect ? "default" : "outline"}
                                      className="bg-destructive/15 hover:bg-destructive/25 text-destructive border-destructive/30"
                                      onClick={() => {
                                        if (question.answerId) {
                                          gradeAnswerMutation.mutate({ 
                                            answerId: question.answerId, 
                                            awardedScore: 0 
                                          });
                                        }
                                      }}
                                      disabled={gradeAnswerMutation.isPending}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Incorrect
                                    </Button>
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
                                      value={gradingScores[question.questionId] ?? (isGraded ? question.awardedScore.toString() : "")}
                                      onChange={(e) => setGradingScores(prev => ({
                                        ...prev,
                                        [question.questionId]: e.target.value
                                      }))}
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
                                {isGraded ? question.awardedScore : "—"}/{question.maxScore}
                              </p>
                              <p className="text-xs text-muted-foreground">points</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No details available
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowDetailsDialog(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Questions Management Dialog */}
        <Dialog open={showQuestionsDialog} onOpenChange={setShowQuestionsDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Manage Questions</DialogTitle>
              <DialogDescription>
                Add, edit, or delete questions for this assessment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {selectedAssessmentWithQuestions?.questions?.length || 0} question(s) added
                </p>
                <Button onClick={() => openQuestionDialog()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                {selectedAssessmentWithQuestions?.questions && selectedAssessmentWithQuestions.questions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedAssessmentWithQuestions.questions
                      .sort((a, b) => a.order - b.order)
                      .map((question) => (
                        <Card key={question.id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">{question.type}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    Order: {question.order} | Points: {question.maxScore}
                                  </span>
                                </div>
                                <p className="font-medium">{question.prompt}</p>
                                {question.optionsJson && question.optionsJson.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {question.optionsJson.map((option, i) => (
                                      <div key={i} className="text-sm text-muted-foreground">
                                        {i + 1}. {option}
                                        {question.correctAnswer === option && (
                                          <CheckCircle2 className="h-3 w-3 inline ml-2 text-green-600" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {question.correctAnswer && question.type !== "MCQ" && (
                                  <p className="text-sm text-muted-foreground mt-2">
                                    Correct Answer: {question.correctAnswer}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openQuestionDialog(question)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (confirm("Are you sure you want to delete this question?")) {
                                      deleteQuestionMutation.mutate(question.id);
                                    }
                                  }}
                                  disabled={deleteQuestionMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No questions added yet</p>
                    <Button onClick={() => openQuestionDialog()} className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Question
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowQuestionsDialog(false)} className="bg-primary hover:bg-primary/90 text-primary-foreground">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Question Dialog */}
        <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
          <DialogContent className="max-w-2xl">
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
                    <SelectTrigger>
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Points</Label>
                    <Input
                      type="number"
                      min="1"
                      value={maxScore}
                      onChange={(e) => setMaxScore(e.target.value)}
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
                        />
                        <Button
                          size="icon"
                          variant={correctAnswer === option && option ? "default" : "outline"}
                          onClick={() => setCorrectAnswer(option)}
                          disabled={!option}
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
                    <SelectTrigger>
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
                  />
                </div>
              )}

              {questionType === "ESSAY" && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Essay questions will be manually graded by the manager during review.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowQuestionDialog(false);
                resetQuestionForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveQuestion}
                disabled={!questionPrompt || createQuestionMutation.isPending || updateQuestionMutation.isPending}
              >
                {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingQuestion ? "Update" : "Add"} Question
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Assessment Dialog */}
        <Dialog open={showAssessmentDialog} onOpenChange={setShowAssessmentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Assessment</DialogTitle>
              <DialogDescription>Create a new assessment for candidates.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assessmentTitle">Title *</Label>
                <Input
                  id="assessmentTitle"
                  value={assessmentTitle}
                  onChange={(e) => setAssessmentTitle(e.target.value)}
                  placeholder="Entrance Test 2025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assessmentDescription">Description</Label>
                <Textarea
                  id="assessmentDescription"
                  value={assessmentDescription}
                  onChange={(e) => setAssessmentDescription(e.target.value)}
                  placeholder="Assessment description..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cohort (optional)</Label>
                  <Select value={assessmentCohortId} onValueChange={setAssessmentCohortId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cohort" />
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
                <div className="space-y-2">
                  <Label htmlFor="assessmentDuration">Duration (minutes)</Label>
                  <Input
                    id="assessmentDuration"
                    type="number"
                    min="1"
                    value={assessmentDuration}
                    onChange={(e) => setAssessmentDuration(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="assessmentPassingScore">Passing Score (%)</Label>
                  <Input
                    id="assessmentPassingScore"
                    type="number"
                    min="0"
                    max="100"
                    value={assessmentPassingScore}
                    onChange={(e) => setAssessmentPassingScore(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <Switch
                    id="assessmentIsActive"
                    checked={assessmentIsActive}
                    onCheckedChange={setAssessmentIsActive}
                  />
                  <Label htmlFor="assessmentIsActive">Active</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { 
                setShowAssessmentDialog(false); 
                setAssessmentTitle(""); 
                setAssessmentDescription("");
                setAssessmentCohortId(""); 
                setAssessmentDuration("60");
                setAssessmentPassingScore("70");
                setAssessmentIsActive(false);
              }}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateAssessment}
                disabled={!assessmentTitle || createAssessmentMutation.isPending}
              >
                {createAssessmentMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : "Create Assessment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}


