import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  FileQuestion,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

interface Assessment {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  passingScore: number | null;
  isActive: boolean;
  attempt: AssessmentAttempt | null;
  canStart: boolean;
}

interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "EXPIRED";
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  expiresAt: string | null;
  submittedAt: string | null;
  resultsPublished: boolean;
}

interface AssessmentQuestion {
  id: string;
  type: "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  prompt: string;
  optionsJson: string[] | null;
  maxScore: number;
  order: number;
}

interface StartAttemptResponse {
  attempt: AssessmentAttempt;
  questions: AssessmentQuestion[];
}

interface SubmitResponse {
  score: number;
  maxScore: number;
  passed: boolean;
  passingScore: number;
}

interface DetailedQuestionResult {
  questionId: string;
  type: string;
  prompt: string;
  options: string[] | null;
  correctAnswer: string | null;
  userAnswer: string | null;
  maxScore: number | null;
  awardedScore: number;
  isCorrect: boolean;
  order: number | null;
}

interface DetailedAttemptResult {
  attempt: {
    id: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    passed: boolean | null;
    startedAt: string;
    submittedAt: string | null;
  };
  assessment: {
    id: string;
    title: string;
    passingScore: number | null;
    durationMinutes: number | null;
  };
  questions: DetailedQuestionResult[];
  summary: {
    totalQuestions: number;
    correctAnswers: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean | null;
  };
}

export default function MyAssessments() {
  const { toast } = useToast();
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttempt | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ["/api/my-assessments"],
    queryFn: async () => {
      const res = await fetch("/api/my-assessments", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assessments");
      return res.json();
    },
  });

  const { data: detailedResults, isLoading: loadingDetails, isError: detailsError } = useQuery<DetailedAttemptResult>({
    queryKey: ["/api/attempts", selectedAttemptId, "details"],
    queryFn: async () => {
      const res = await fetch(`/api/attempts/${selectedAttemptId}/details`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch details");
      return res.json();
    },
    enabled: !!selectedAttemptId && showDetailsDialog,
  });

  const startAttemptMutation = useMutation({
    mutationFn: async (assessmentId: string): Promise<StartAttemptResponse> => {
      return apiRequest("POST", `/api/assessments/${assessmentId}/start`, {});
    },
    onSuccess: (data) => {
      if (!data.attempt || !data.questions) {
        toast({ 
          title: "Invalid response from server", 
          description: "Missing attempt or questions data",
          variant: "destructive" 
        });
        return;
      }
      setActiveAttempt(data.attempt);
      setQuestions((data.questions || []).sort((a, b) => a.order - b.order));
      setAnswers({});
      setCurrentQuestionIndex(0);
      setShowStartDialog(false);
      
      if (data.attempt.expiresAt) {
        const expiresAt = new Date(data.attempt.expiresAt).getTime();
        const now = Date.now();
        setTimeRemaining(Math.max(0, Math.floor((expiresAt - now) / 1000)));
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to start assessment", variant: "destructive" });
    },
  });

  const saveAnswerMutation = useMutation({
    mutationFn: async ({ attemptId, questionId, response }: { attemptId: string; questionId: string; response: string }) => {
      return apiRequest("POST", `/api/attempts/${attemptId}/answers`, { questionId, response });
    },
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async (attemptId: string): Promise<SubmitResponse> => {
      return apiRequest("POST", `/api/attempts/${attemptId}/submit`, {});
    },
    onSuccess: (data) => {
      setResult(data);
      setActiveAttempt(null);
      setQuestions([]);
      setAnswers({});
      setTimeRemaining(null);
      setShowSubmitDialog(false);
      setShowResultDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/my-assessments"] });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to submit assessment", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          if (activeAttempt) {
            toast({ title: "Time expired! Submitting your assessment...", variant: "destructive" });
            submitAttemptMutation.mutate(activeAttempt.id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, activeAttempt]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    
    if (activeAttempt) {
      saveAnswerMutation.mutate({
        attemptId: activeAttempt.id,
        questionId,
        response: value,
      });
    }
  }, [activeAttempt]);

  const openStartDialog = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    setShowStartDialog(true);
  };

  const openDetailsDialog = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setShowDetailsDialog(true);
  };

  const closeDetailsDialog = () => {
    setShowDetailsDialog(false);
    setSelectedAttemptId(null);
  };

  const handleStartAssessment = () => {
    if (!selectedAssessment) return;
    startAttemptMutation.mutate(selectedAssessment.id);
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (activeAttempt && questions.length > 0) {
    return (
      <AppLayout>
        <div className="h-full flex flex-col" data-testid="assessment-taking-view">
          <div className="border-b p-4 bg-background sticky top-0 z-10">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div>
                <h1 className="text-xl font-bold">{selectedAssessment?.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeRemaining && timeRemaining < 300 ? "bg-destructive/15 text-destructive" : "bg-muted"
                }`}>
                  <Clock className="w-4 h-4" />
                  <span className="font-mono font-bold" data-testid="text-time-remaining">
                    {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitDialog(true)}
                  data-testid="button-submit-assessment"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit
                </Button>
              </div>
            </div>
            <div className="max-w-4xl mx-auto mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{answeredCount} answered</span>
                <Progress value={progress} className="flex-1" />
                <span className="text-sm text-muted-foreground">{questions.length} total</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <Card className="relative overflow-hidden border border-border bg-card rounded-2xl" data-testid={`card-question-${currentQuestion?.id}`}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <CardHeader className="relative">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-border">{currentQuestion?.type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {currentQuestion?.maxScore} point{currentQuestion?.maxScore !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-2 text-foreground">{currentQuestion?.prompt}</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  {currentQuestion?.type === "MCQ" && currentQuestion.optionsJson && (
                    <RadioGroup
                      value={answers[currentQuestion.id] || ""}
                      onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                      className="space-y-3"
                    >
                      {currentQuestion.optionsJson.map((option, i) => (
                        <div
                          key={i}
                          className={`flex items-center space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer ${
                            answers[currentQuestion.id] === option ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handleAnswerChange(currentQuestion.id, option)}
                          data-testid={`option-${i}`}
                        >
                          <RadioGroupItem value={option} id={`option-${i}`} />
                          <Label htmlFor={`option-${i}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {currentQuestion?.type === "TRUE_FALSE" && (
                    <RadioGroup
                      value={answers[currentQuestion.id] || ""}
                      onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                      className="space-y-3"
                    >
                      {["true", "false"].map((value) => (
                        <div
                          key={value}
                          className={`flex items-center space-x-3 p-4 rounded-lg border hover-elevate cursor-pointer ${
                            answers[currentQuestion.id] === value ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handleAnswerChange(currentQuestion.id, value)}
                          data-testid={`option-${value}`}
                        >
                          <RadioGroupItem value={value} id={`option-${value}`} />
                          <Label htmlFor={`option-${value}`} className="flex-1 cursor-pointer capitalize">
                            {value}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {(currentQuestion?.type === "SHORT_ANSWER" || currentQuestion?.type === "ESSAY") && (
                    <Textarea
                      value={answers[currentQuestion.id] || ""}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Type your answer here..."
                      rows={currentQuestion.type === "ESSAY" ? 8 : 3}
                      className="resize-none"
                      data-testid="textarea-answer"
                    />
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => goToQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
                  data-testid="button-prev-question"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                <div className="flex gap-2 flex-wrap justify-center">
                  {questions.map((q, i) => (
                    <Button
                      key={q.id}
                      size="icon"
                      variant={i === currentQuestionIndex ? "default" : answers[q.id] ? "secondary" : "outline"}
                      onClick={() => goToQuestion(i)}
                      className="w-8 h-8 text-xs"
                      data-testid={`button-nav-question-${i}`}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={currentQuestionIndex === questions.length - 1}
                  data-testid="button-next-question"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Submit Assessment?</AlertDialogTitle>
                <AlertDialogDescription>
                  You have answered {answeredCount} out of {questions.length} questions.
                  {answeredCount < questions.length && (
                    <span className="block mt-2 text-destructive">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      Some questions are unanswered!
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continue Assessment</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => activeAttempt && submitAttemptMutation.mutate(activeAttempt.id)}
                  disabled={submitAttemptMutation.isPending}
                  data-testid="button-confirm-submit"
                >
                  {submitAttemptMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6" data-testid="my-assessments-page">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">My Assessments</h1>
          <p className="text-muted-foreground">View and take available assessments</p>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <Card className="relative overflow-hidden border border-border bg-card rounded-2xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground relative">
              <FileQuestion className="w-12 h-12 mb-4 opacity-50" />
              <p>No assessments available at this time</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assessments.map((assessment) => (
              <Card key={assessment.id} className="relative overflow-hidden border border-border bg-card rounded-2xl hover:shadow-lg transition-shadow" data-testid={`card-assessment-${assessment.id}`}>
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                <CardHeader className="relative">
                  <CardTitle className="text-lg text-foreground">{assessment.title}</CardTitle>
                  {assessment.description && (
                    <CardDescription className="line-clamp-2">{assessment.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 relative">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {assessment.durationMinutes} min
                    </div>
                    <div>Pass: {assessment.passingScore}%</div>
                  </div>

                  {assessment.attempt ? (
                    <div className="space-y-3">
                      {assessment.attempt.status === "SUBMITTED" || assessment.attempt.status === "GRADED" ? (
                        assessment.attempt.resultsPublished ? (
                          <>
                            <div className="flex items-center gap-2">
                              {assessment.attempt.passed ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Passed
                                </Badge>
                              ) : (
                                <Badge className="bg-destructive/15 text-destructive">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Failed
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-foreground">
                              Score: <span className="font-semibold">{assessment.attempt.score}/{assessment.attempt.maxScore}</span>
                              {" "}({Math.round(((assessment.attempt.score || 0) / (assessment.attempt.maxScore || 1)) * 100)}%)
                            </div>
                            {assessment.attempt.submittedAt && (
                              <div className="text-sm text-muted-foreground">
                                Submitted: {format(new Date(assessment.attempt.submittedAt), "MMM d, yyyy h:mm a")}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              className="w-full border-primary text-primary hover:bg-primary/10"
                              onClick={() => openDetailsDialog(assessment.attempt!.id)}
                              data-testid={`button-view-details-${assessment.id}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Detailed Results
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                <Clock className="w-3 h-3 mr-1" />
                                Results Pending
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Your assessment has been submitted and is being reviewed. Results will be available once the administrator publishes them.
                            </div>
                            {assessment.attempt.submittedAt && (
                              <div className="text-sm text-muted-foreground">
                                Submitted: {format(new Date(assessment.attempt.submittedAt), "MMM d, yyyy h:mm a")}
                              </div>
                            )}
                          </>
                        )
                      ) : assessment.attempt.status === "IN_PROGRESS" ? (
                        <Button 
                          className="w-full" 
                          onClick={() => openStartDialog(assessment)}
                          data-testid={`button-continue-${assessment.id}`}
                        >
                          <PlayCircle className="w-4 h-4 mr-2" />
                          Continue Assessment
                        </Button>
                      ) : (
                        <Badge variant="secondary">Expired</Badge>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => openStartDialog(assessment)}
                      disabled={!assessment.canStart}
                      data-testid={`button-start-${assessment.id}`}
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Start Assessment
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Assessment</DialogTitle>
              <DialogDescription>
                You are about to start: {selectedAssessment?.title}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Duration: {selectedAssessment?.durationMinutes} minutes</span>
                </div>
                <div>Passing Score: {selectedAssessment?.passingScore}%</div>
              </div>

              <div className="p-4 border border-border bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Important</p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      <li>The timer will start once you begin</li>
                      <li>You cannot pause or restart the assessment</li>
                      <li>Your answers are saved automatically</li>
                      <li>Make sure you have a stable internet connection</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStartDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStartAssessment}
                disabled={startAttemptMutation.isPending}
                data-testid="button-confirm-start"
              >
                {startAttemptMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Begin Assessment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assessment Complete</DialogTitle>
            </DialogHeader>

            {result && (
              <div className="space-y-6 py-4">
                <div className="text-center">
                  {result.passed ? (
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </div>
                  ) : (
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/15 mb-4">
                      <XCircle className="w-8 h-8 text-destructive" />
                    </div>
                  )}
                  <h3 className="text-2xl font-bold">
                    {result.passed ? "Congratulations!" : "Assessment Complete"}
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {result.passed ? "You passed the assessment" : "You did not meet the passing score"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{result.score}</p>
                    <p className="text-sm text-muted-foreground">Your Score</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{result.maxScore}</p>
                    <p className="text-sm text-muted-foreground">Max Score</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">
                      {Math.round((result.score / result.maxScore) * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Percentage</p>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Passing Score: {result.passingScore}%
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => setShowResultDialog(false)} data-testid="button-close-result">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detailed Results Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={closeDetailsDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Detailed Results</DialogTitle>
              <DialogDescription>
                {detailedResults?.assessment.title || "Assessment Results"}
              </DialogDescription>
            </DialogHeader>

            {loadingDetails ? (
              <div className="space-y-4 py-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : detailsError ? (
              <div className="text-center py-8 text-destructive">
                Failed to load detailed results. Please try again.
              </div>
            ) : detailedResults ? (
              <div className="flex flex-col flex-1 min-h-0 gap-6">
                {/* Summary Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResults.summary.totalScore}</p>
                    <p className="text-xs text-muted-foreground">Your Score</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResults.summary.maxScore}</p>
                    <p className="text-xs text-muted-foreground">Max Score</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResults.summary.percentage}%</p>
                    <p className="text-xs text-muted-foreground">Percentage</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold">{detailedResults.summary.correctAnswers}/{detailedResults.summary.totalQuestions}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                  </div>
                </div>

                <div className="flex items-center justify-center shrink-0">
                  {detailedResults.summary.passed ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Passed (Required: {detailedResults.assessment.passingScore}%)
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                      <XCircle className="w-4 h-4 mr-1" />
                      Failed (Required: {detailedResults.assessment.passingScore}%)
                    </Badge>
                  )}
                </div>

                {/* Question Breakdown - fills remaining space and scrolls */}
                <ScrollArea className="flex-1 min-h-[240px] pr-4">
                  <div className="space-y-4">
                    {detailedResults.questions.map((question, index) => (
                      <div 
                        key={question.questionId}
                        className={`p-4 rounded-lg border ${
                          question.isCorrect 
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20" 
                            : "border-destructive/30 bg-destructive/5"
                        }`}
                        data-testid={`question-result-${question.questionId}`}
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
                              {question.isCorrect ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-destructive" />
                              )}
                            </div>
                            <p className="text-sm mb-3">{question.prompt}</p>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex items-start gap-2">
                                <span className="font-medium min-w-[100px]">Your Answer:</span>
                                <span className={question.isCorrect ? "text-green-700 dark:text-green-300" : "text-destructive"}>
                                  {question.userAnswer || "(No answer provided)"}
                                </span>
                              </div>
                              {!question.isCorrect && question.correctAnswer && question.type !== "ESSAY" && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium min-w-[100px]">Correct:</span>
                                  <span className="text-green-700 dark:text-green-300">
                                    {question.correctAnswer}
                                  </span>
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
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No results available
              </div>
            )}

            <DialogFooter>
              <Button onClick={closeDetailsDialog} data-testid="button-close-details">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
