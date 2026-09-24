import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  Mail,
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Assessment {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
}

interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  passed: boolean | null;
  expiresAt: string | null;
  submittedAt: string | null;
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
  score: number | null;
  maxScore: number;
  passed: boolean | null;
  passingScore: number;
  message?: string;
}

export default function PublicAssessmentPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<AssessmentAttempt | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const submitFnRef = useRef<((attemptId: string) => void) | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Extract token from URL
  useEffect(() => {
    const pathParts = location.split("/");
    const tokenIndex = pathParts.indexOf("assessment");
    if (tokenIndex !== -1 && pathParts[tokenIndex + 1]) {
      setToken(pathParts[tokenIndex + 1]);
      setShowEmailDialog(true);
    }
  }, [location]);

  const { data: assessmentData } = useQuery<{ assignment: any; assessment: Assessment }>({
    queryKey: ["/api/public/assessment", token],
    queryFn: async () => {
      const data = await apiRequest("GET", `/public/assessment/${token}`);
      return data;
    },
    enabled: !!token,
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!token) throw new Error("Assessment token is required");
      return apiRequest("POST", `/public/assessment/${token}/verify-email`, { email });
    },
    onSuccess: () => {
      setEmailVerified(true);
      setShowEmailDialog(false);
      setShowStartDialog(true);
      setSelectedAssessment(assessmentData?.assessment || null);
      toast({ title: "Email verified successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Email verification failed", variant: "destructive" });
    },
  });

  const startAttemptMutation = useMutation({
    mutationFn: async (): Promise<StartAttemptResponse> => {
      if (!token) throw new Error("Assessment token is required");
      const res = await apiRequest("POST", `/public/assessment/${token}/start`, { email });
      return res;
    },
    onSuccess: (data) => {
      setActiveAttempt(data.attempt);
      setQuestions(data.questions.sort((a, b) => a.order - b.order));
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
      // Use public route for public assessments
      return apiRequest("POST", `/public/assessment/${attemptId}/answers`, { questionId, response });
    },
    onError: (error: Error) => {
      console.error("❌ Failed to save answer:", error);
      toast({ 
        title: "Failed to save answer", 
        description: error.message || "Your answer was not saved. Please try again or check your connection.",
        variant: "destructive" 
      });
    },
  });

  const submitAttemptMutation = useMutation({
    mutationFn: async (attemptId: string): Promise<SubmitResponse> => {
      // Use public route for public assessments
      const res = await apiRequest("POST", `/public/assessment/${attemptId}/submit`, {});
      return res;
    },
    onSuccess: (data) => {
      setResult(data);
      setActiveAttempt(null);
      setQuestions([]);
      setAnswers({});
      setTimeRemaining(null);
      setShowSubmitDialog(false);
      setShowResultDialog(true);
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to submit assessment", variant: "destructive" });
    },
  });

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Only set up timer if timeRemaining is valid and activeAttempt exists
    if (timeRemaining === null || timeRemaining <= 0 || !activeAttempt) return;

    // Store mutation function in ref to avoid dependency issues
    submitFnRef.current = submitAttemptMutation.mutate;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (activeAttempt && submitFnRef.current) {
            toast({ title: "Time expired! Submitting your assessment...", variant: "destructive" });
            submitFnRef.current(activeAttempt.id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeAttempt]);

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
  }, [activeAttempt, saveAnswerMutation]);

  const handleStartAssessment = () => {
    if (!emailVerified) {
      toast({ title: "Please verify your email first", variant: "destructive" });
      return;
    }
    startAttemptMutation.mutate();
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // Assessment taking view
  if (activeAttempt && questions.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-full flex flex-col">
          <div className="border-b p-4 bg-background sticky top-0 z-10">
            <div className="flex items-center justify-between max-w-4xl mx-auto">
              <div>
                <h1 className="text-xl font-bold">{selectedAssessment?.title || assessmentData?.assessment.title}</h1>
                <p className="text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  timeRemaining && timeRemaining < 300 ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" : "bg-muted"
                }`}>
                  <Clock className="w-4 h-4" />
                  <span className="font-mono font-bold">
                    {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowSubmitDialog(true)}
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
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{currentQuestion?.type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {currentQuestion?.maxScore} point{currentQuestion?.maxScore !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-2">{currentQuestion?.prompt}</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentQuestion?.type === "MCQ" && currentQuestion.optionsJson && (
                    <RadioGroup
                      value={answers[currentQuestion.id] || ""}
                      onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                      className="space-y-3"
                    >
                      {currentQuestion.optionsJson.map((option, i) => (
                        <div
                          key={i}
                          className={`flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted cursor-pointer ${
                            answers[currentQuestion.id] === option ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handleAnswerChange(currentQuestion.id, option)}
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
                          className={`flex items-center space-x-3 p-4 rounded-lg border hover:bg-muted cursor-pointer ${
                            answers[currentQuestion.id] === value ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => handleAnswerChange(currentQuestion.id, value)}
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
                    />
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => goToQuestion(currentQuestionIndex - 1)}
                  disabled={currentQuestionIndex === 0}
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
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => goToQuestion(currentQuestionIndex + 1)}
                  disabled={currentQuestionIndex === questions.length - 1}
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
                    <span className="block mt-2 text-red-600 dark:text-red-400">
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
                >
                  {submitAttemptMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Now
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  // Email verification dialog
  if (showEmailDialog && !emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Verify Your Email
            </CardTitle>
            <CardDescription>
              Please enter the email address associated with your assessment invitation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email) {
                    verifyEmailMutation.mutate(email);
                  }
                }}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => verifyEmailMutation.mutate(email)}
              disabled={!email || verifyEmailMutation.isPending}
            >
              {verifyEmailMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verify Email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Start dialog
  if (showStartDialog && assessmentData && !activeAttempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{assessmentData.assessment.title}</CardTitle>
            <CardDescription>{assessmentData.assessment.description || "Complete this assessment to proceed"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Duration: {assessmentData.assessment.durationMinutes} minutes</span>
              </div>
            </div>

            <div className="p-4 border border-[#E3D9CC] dark:border-[#E3D9CC] bg-[#FAF7F3] dark:bg-[#FAF7F3]/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-800 dark:text-red-300">Important</p>
                  <ul className="mt-1 space-y-1 text-red-700 dark:text-red-400">
                    <li>You have only one attempt</li>
                    <li>The timer will start once you begin</li>
                    <li>You cannot pause or restart the assessment</li>
                    <li>Your answers are saved automatically</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
          <CardContent>
            <Button
              className="w-full"
              onClick={handleStartAssessment}
              disabled={startAttemptMutation.isPending || !emailVerified}
            >
              {startAttemptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Begin Assessment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Result dialog
  if (showResultDialog && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Assessment Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 py-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold">
                Successfully Completed!
              </h3>
              <p className="text-muted-foreground mt-2">
                You have successfully completed the assessment. We will connect with you soon.
              </p>
            </div>
          </CardContent>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => {
                setShowResultDialog(false);
                setLocation("/");
              }}
            >
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default view - invalid token
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invalid Assessment Link</CardTitle>
          <CardDescription>
            The assessment link you're trying to access is invalid or has expired.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

