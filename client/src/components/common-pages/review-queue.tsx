import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  Star,
} from "lucide-react";
import {
  MENTOR_KIND_LABELS,
  MIN_FEEDBACK_LENGTH,
  type MentorKind,
} from "@shared/evidenceReview";

interface PendingSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  teamName: string;
  submitterName: string;
  submittedBy: string | null;
  type: string;
  url: string;
  title: string | null;
  createdAt: string;
  requiresReviewFrom: MentorKind | null;
  /** This submission is on a task that names the reviewer's own kind of mentorship. */
  preferredForMe: boolean;
}

const QUEUE_KEY = ["/api/evidence/pending-review"];

/**
 * Everything waiting on this reviewer, across every team they are on.
 *
 * Before this existed a reviewer had to open each team's sprint board and look for cards in
 * REVIEW — with mentors spanning several teams there was no single place to see outstanding
 * work. Verdicts are recorded per submission, so a task shared by three people can have two
 * accepted and one sent back.
 */
export default function ReviewQueuePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [changesFor, setChangesFor] = useState<PendingSubmission | null>(null);
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState<"mine" | "all">("mine");

  const { data: submissions = [], isLoading } = useQuery<PendingSubmission[]>({
    queryKey: QUEUE_KEY,
    queryFn: () => apiRequest("GET", "/evidence/pending-review"),
    enabled: !!user,
  });

  const reviewMutation = useMutation({
    mutationFn: (input: { id: string; status: string; feedback?: string }) =>
      apiRequest("PATCH", `/evidence/${input.id}/review`, {
        status: input.status,
        feedback: input.feedback,
      }),
    onSuccess: (result: any, input) => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      // The task's own state follows from its submissions, so refresh the boards too.
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-sprint"] });

      const summary = result?.summary;
      const outstanding =
        summary && summary.total > 1
          ? ` ${summary.accepted} of ${summary.total} on this task accepted.`
          : "";
      toast({
        title: input.status === "ACCEPTED" ? "Submission accepted" : "Changes requested",
        description:
          (input.status === "ACCEPTED"
            ? "The learner has been notified."
            : "Sent back to the learner with your feedback.") + outstanding,
      });
      setChangesFor(null);
      setFeedback("");
    },
    onError: (error: any) => {
      toast({
        title: "Could not record that review",
        description: error?.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  // "Mine" leads with the tasks that name this reviewer's kind of mentorship. It is only an
  // ordering: any mentor on a team may review anything on it, so nothing is hidden here.
  const mine = useMemo(() => submissions.filter((s) => s.preferredForMe), [submissions]);
  const shown = filter === "mine" && mine.length > 0 ? mine : submissions;

  const canSubmitFeedback = feedback.trim().length >= MIN_FEEDBACK_LENGTH;

  return (
    <AppLayout>
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Submissions to review
              </CardTitle>
              <CardDescription>
                Everything awaiting your review, across every team you are on. Each person's
                submission is reviewed on its own — a shared task can have some accepted and
                others sent back.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 text-base">
              {submissions.length} pending
            </Badge>
          </div>
        </CardHeader>
        {mine.length > 0 && mine.length !== submissions.length && (
          <CardContent>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "mine" | "all")}>
              <TabsList>
                <TabsTrigger value="mine">For me ({mine.length})</TabsTrigger>
                <TabsTrigger value="all">Everything ({submissions.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        )}
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <p className="mt-3 font-medium text-foreground">Nothing waiting on you</p>
            <p className="text-sm text-muted-foreground">
              Submissions appear here as soon as a learner sends work for review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((item) => (
            <Card key={item.id} data-testid={`review-item-${item.id}`}>
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{item.taskTitle}</p>
                      {item.preferredForMe && item.requiresReviewFrom && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-primary/40 text-primary"
                          title="This task asks for your kind of mentorship"
                        >
                          <Star className="h-3 w-3" />
                          For you
                        </Badge>
                      )}
                      {item.requiresReviewFrom && !item.preferredForMe && (
                        <Badge variant="secondary" className="text-xs">
                          Asks for {MENTOR_KIND_LABELS[item.requiresReviewFrom]}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{item.submitterName}</span>
                      {" · "}
                      {item.teamName}
                      {" · "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.type}
                      </Badge>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {item.title || "Open submission"}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-amber-700 hover:bg-amber-50 dark:text-amber-500"
                      disabled={reviewMutation.isPending}
                      onClick={() => {
                        setChangesFor(item);
                        setFeedback("");
                      }}
                      data-testid={`button-request-changes-${item.id}`}
                    >
                      <MessageSquareWarning className="h-4 w-4" />
                      Request changes
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={reviewMutation.isPending}
                      onClick={() =>
                        reviewMutation.mutate({ id: item.id, status: "ACCEPTED" })
                      }
                      data-testid={`button-accept-${item.id}`}
                    >
                      {reviewMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Accept
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Feedback is required in this direction: sending work back without saying what is wrong
          leaves the learner guessing, which is the whole failure this replaces. */}
      <Dialog open={!!changesFor} onOpenChange={(open) => !open && setChangesFor(null)}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden p-6">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription className="break-words">
              {changesFor?.submitterName}'s submission for "{changesFor?.taskTitle}"
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            <Label htmlFor="review-feedback">What needs changing? *</Label>
            <Textarea
              id="review-feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Be specific — this is what they will work from."
              className="min-h-[120px]"
              data-testid="input-review-feedback"
            />
            <p className="text-xs text-muted-foreground">
              Only this person's submission is sent back. Anyone else's work on the task keeps
              whatever verdict it already has, and the task returns to In Progress.
            </p>
          </div>

          <DialogFooter className="shrink-0 pt-4">
            <Button variant="outline" onClick={() => setChangesFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmitFeedback || reviewMutation.isPending}
              onClick={() =>
                changesFor &&
                reviewMutation.mutate({
                  id: changesFor.id,
                  status: "CHANGES_REQUESTED",
                  feedback: feedback.trim(),
                })
              }
              data-testid="button-send-changes"
            >
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
