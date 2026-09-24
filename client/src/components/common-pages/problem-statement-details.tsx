import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar, User, Tag, FileText, ExternalLink, CheckCircle, XCircle, Users, Send, Target, AlertCircle, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface ProblemStatementDetails {
  id: string;
  title: string;
  overview: string;
  track: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
  fileUrls?: Array<{ key: string; url: string }>;
  creator?: { id: string; name: string; email: string };
  createdBy?: string;
  createdByRole?: string;
  learnerApplicationCount?: number;
  cofounderApplicationCount?: number;
  userApplication?: { id: string; status: string } | null;
  isTaken?: boolean;
  expectedOutcomes?: string | null;
  constraintsRequirements?: string | null;
}

export default function ProblemStatementDetailsPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/app/problem-statements/:id");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const statementId = params?.id;
  const { user } = useAuth();
  const [showAssignFounder, setShowAssignFounder] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  // FOUNDER or MENTOR leads the team; either way the team is built from this
  // problem statement's applicants, so its members get the same statement.
  const [leadRole, setLeadRole] = useState<"FOUNDER" | "MENTOR">("FOUNDER");
  const [selectedFounderId, setSelectedFounderId] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const isLearnerOrCofounder = user?.role === "LEARNER" || user?.role === "COFOUNDER";
  const canEdit = user?.role === "FOUNDER" || user?.role === "MENTOR";

  // Inline-edit state for outcomes / constraints
  const [editingOutcomes, setEditingOutcomes] = useState(false);
  const [editingConstraints, setEditingConstraints] = useState(false);
  const [outcomesText, setOutcomesText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");

  const { data: myTeam } = useQuery({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try {
        return await apiRequest("GET", "/api/my-team");
      } catch {
        return null;
      }
    },
    enabled: !!user && isLearnerOrCofounder,
  });

  const { data: statement, isLoading, error } = useQuery<ProblemStatementDetails>({
    queryKey: ["/api/problem-statements", statementId],
    queryFn: async () => {
      if (!statementId) throw new Error("Statement ID is required");
      return await apiRequest("GET", `/api/problem-statements/${statementId}`);
    },
    enabled: !!statementId,
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/problem-statements/${statementId}/publish`, {});
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Problem statement published to mentors",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", statementId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/problem-statements/${statementId}/reject`, {});
    },
    onSuccess: () => {
      toast({
        title: "Rejected",
        description: "Problem statement has been rejected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", statementId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject",
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/problem-statements/${statementId}/apply`, {
        message: "",
      });
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", statementId] });
    },
    onError: (error: any) => {
      toast({
        title: "Application Failed",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const isInTeam = Boolean(myTeam);
  const canApply = isLearnerOrCofounder && !isInTeam && statement?.status === "PUBLISHED" && !statement?.isTaken;
  const canViewApplications = user && !statement?.isTaken && (
    user.role === "ADMIN" ||
    (user.role === "MENTOR" && statement?.createdBy === user.id) ||
    (user.role === "FOUNDER" && statement?.createdBy === user.id)
  );
  const isTeamComplete = (statement?.learnerApplicationCount ?? 0) >= 7 && (statement?.cofounderApplicationCount ?? 0) >= 2 && !statement?.isTaken;
  const isAdmin = user && (user.role === 'ADMIN');

  // Fetch cohorts for admin (for all published problem statements)
  const { data: cohorts } = useQuery<{ id: string; name: string; isActive: boolean }[]>({
    queryKey: ["/api/cohorts"],
    enabled: !!isAdmin && statement?.status === "PUBLISHED" && !statement?.isTaken,
  });

  // Candidate leads for the team. Founders already in a team are excluded (a
  // founder leads one team); mentors are not filtered, since a mentor may lead
  // several.
  const { data: founders } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ["/api/admin/users", leadRole, leadRole === "FOUNDER" ? "excludeInTeams" : "all"],
    enabled: !!isAdmin && statement?.status === "PUBLISHED" && !statement?.isTaken,
    queryFn: async () => {
      try {
        const url =
          leadRole === "FOUNDER"
            ? "/api/admin/users?role=FOUNDER&excludeInTeams=true"
            : "/api/admin/users?role=MENTOR";
        const result = await apiRequest("GET", url);
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error(`[Frontend] Error fetching ${leadRole} list:`, error);
        return [];
      }
    },
    staleTime: 0, // Always refetch to get fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const assignFounderMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/admin/problem-statements/${statementId}/assign-founder`, {
        cohortId: selectedCohortId,
        leadRole,
        leadUserId: selectedFounderId,
        teamName: teamName.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team created successfully!",
      });
      setShowAssignFounder(false);
      setSelectedCohortId("");
      setSelectedFounderId("");
      setTeamName("");
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign founder and create team",
        variant: "destructive",
      });
    },
  });

  const saveMetaMutation = useMutation({
    mutationFn: async (data: { expectedOutcomes?: string; constraintsRequirements?: string }) =>
      apiRequest("PATCH", `/api/problem-statements/${statementId}/meta`, data),
    onSuccess: () => {
      toast({ title: "Saved", description: "Problem statement updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", statementId] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save.", variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return <Badge variant="default">Published</Badge>;
      case "PENDING":
        return <Badge variant="secondary">Pending Review</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTrackColor = (track: string) => {
    const colors: Record<string, string> = {
      SaaS_B2B: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
      AI: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
      FinTech: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      HealthTech: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      BioTech: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      EdTech: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      Consumer: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
      ECommerce: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      Logistics: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
      PropTech: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
      AgriTech: "bg-[#FAF7F3] text-[#8B6F47] dark:bg-[#FAF7F3] dark:text-[#8B6F47]",
      Climate: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      Industrial: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
      Media: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200",
      GovTech: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      MSME: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[track] || "bg-gray-100 text-gray-800";
  };

  if (!match) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Invalid problem statement URL</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load problem statement. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              // Check sessionStorage for return URL, otherwise check referrer
              const returnUrl = sessionStorage.getItem('problemStatementReturnUrl');
              if (returnUrl) {
                sessionStorage.removeItem('problemStatementReturnUrl');
                setLocation(returnUrl);
              } else {
                const referrer = document.referrer;
                if (referrer.includes('/open-challenges')) {
                  setLocation("/app/open-challenges");
                } else {
                  setLocation("/app/problem-statements");
                }
              }
            }}
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Problem Statement Details</h1>
            <p className="text-muted-foreground">Full details and documents</p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ) : statement ? (
          <div className="grid gap-6">
            {/* Main Content */}
            <Card data-tour="ps-detail-content">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <CardTitle className="text-2xl">{statement.title}</CardTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statement.isTaken ? (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          Taken
                        </Badge>
                      ) : (
                        getStatusBadge(statement.status)
                      )}
                      <Badge className={getTrackColor(statement.track)} variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {statement.track}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Overview</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{statement.overview}</p>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  {statement.creator && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{statement.creator.name}</p>
                        <p className="text-muted-foreground">{statement.creator.email}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Submitted</p>
                      <p>{new Date(statement.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {statement.publishedAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <p className="font-medium">Published</p>
                        <p>{new Date(statement.publishedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}
                </div>

                {statement.fileUrls && statement.fileUrls.length > 0 && (
                  <>
                    <Separator />
                    <div data-tour="ps-detail-docs">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Supporting Documents
                      </h3>
                      <div className="space-y-2">
                        {statement.fileUrls.map((file, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            className="w-full justify-between"
                            onClick={() => window.open(file.url, "_blank")}
                          >
                            <span className="truncate">{file.key.split('/').pop()}</span>
                            <ExternalLink className="h-4 w-4 ml-2 flex-shrink-0" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Expected Outcomes & Constraints panels */}
                <>
                  <Separator />
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Expected Outcomes */}
                    <div className="space-y-2" data-tour="ps-detail-outcomes">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2 text-sm">
                          <Target className="h-4 w-4 text-green-500" />
                          Expected Outcomes
                        </h3>
                        {canEdit && !editingOutcomes && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setOutcomesText(statement.expectedOutcomes ?? "");
                              setEditingOutcomes(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        )}
                      </div>
                      {editingOutcomes ? (
                        <div className="space-y-2">
                          <Textarea
                            value={outcomesText}
                            onChange={(e) => setOutcomesText(e.target.value)}
                            placeholder="Describe the expected outcomes..."
                            className="min-h-[100px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              disabled={saveMetaMutation.isPending}
                              onClick={() =>
                                saveMetaMutation.mutate(
                                  { expectedOutcomes: outcomesText },
                                  { onSuccess: () => setEditingOutcomes(false) }
                                )
                              }
                            >
                              <Save className="h-3 w-3" />
                              {saveMetaMutation.isPending ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 text-xs"
                              onClick={() => setEditingOutcomes(false)}
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {statement.expectedOutcomes || (
                            <span className="italic">
                              No outcomes defined yet.{canEdit && " Click Edit to add."}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Constraints & Requirements */}
                    <div className="space-y-2" data-tour="ps-detail-constraints">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          Constraints & Requirements
                        </h3>
                        {canEdit && !editingConstraints && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setConstraintsText(statement.constraintsRequirements ?? "");
                              setEditingConstraints(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                        )}
                      </div>
                      {editingConstraints ? (
                        <div className="space-y-2">
                          <Textarea
                            value={constraintsText}
                            onChange={(e) => setConstraintsText(e.target.value)}
                            placeholder="Describe constraints and technical requirements..."
                            className="min-h-[100px] text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              disabled={saveMetaMutation.isPending}
                              onClick={() =>
                                saveMetaMutation.mutate(
                                  { constraintsRequirements: constraintsText },
                                  { onSuccess: () => setEditingConstraints(false) }
                                )
                              }
                            >
                              <Save className="h-3 w-3" />
                              {saveMetaMutation.isPending ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 h-7 text-xs"
                              onClick={() => setEditingConstraints(false)}
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {statement.constraintsRequirements || (
                            <span className="italic">
                              No constraints defined yet.{canEdit && " Click Edit to add."}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </>

                {/* Application Info */}
                {statement.status === "PUBLISHED" && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Intern Applications</p>
                        <p className="text-lg font-semibold">{statement.learnerApplicationCount || 0} / 7</p>
                      </div>
                      <div className="text-sm">
                        <p className="text-muted-foreground">Co-Founder Applications</p>
                        <p className="text-lg font-semibold">{statement.cofounderApplicationCount || 0} / 2</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Apply Button (for LEARNER and COFOUNDER) */}
                {canApply && (
                  <>
                    <Separator />
                    <div className="flex gap-4">
                      {statement.userApplication ? (
                        <Button disabled variant="secondary" className="flex-1">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Already Applied
                        </Button>
                      ) : (
                        <Button
                          onClick={() => applyMutation.mutate()}
                          disabled={
                            applyMutation.isPending ||
                            (user?.role === "LEARNER" && (statement.learnerApplicationCount || 0) >= 7) ||
                            (user?.role === "COFOUNDER" && (statement.cofounderApplicationCount || 0) >= 2)
                          }
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {applyMutation.isPending ? "Applying..." : "Apply"}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* View Applications Button (for ADMIN, MENTOR creator, FOUNDER creator) */}
                {canViewApplications && statement.status === "PUBLISHED" && (
                  <>
                    <Separator />
                    <Button
                      onClick={() => setLocation(`/app/problem-statements/${statementId}/applications`)}
                      variant="outline"
                      className="w-full"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      View Applications ({((statement.learnerApplicationCount || 0) + (statement.cofounderApplicationCount || 0))})
                    </Button>
                  </>
                )}

                {/* Assign Founder Section (for admin on all published problem statements) */}
                {isAdmin && statement?.status === "PUBLISHED" && !statement?.isTaken && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Assign Founder</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {isTeamComplete 
                            ? "This problem statement has 7 interns and 2 co-founders applied. Assign a founder to create the team."
                            : `Current applications: ${statement.learnerApplicationCount || 0} interns, ${statement.cofounderApplicationCount || 0} co-founders. As admin, you can assign a founder even with fewer applications.`
                          }
                        </p>
                        {!showAssignFounder ? (
                          <Button 
                            onClick={() => setShowAssignFounder(true)}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Assign Founder
                          </Button>
                        ) : (
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="space-y-2">
                              <Label htmlFor="teamName">Team Name</Label>
                              <Input
                                id="teamName"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                placeholder="Enter team name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cohort">Cohort</Label>
                              <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
                                <SelectTrigger id="cohort">
                                  <SelectValue placeholder="Select cohort" />
                                </SelectTrigger>
                                <SelectContent>
                                  {cohorts?.map((cohort) => (
                                    <SelectItem key={cohort.id} value={cohort.id}>
                                      {cohort.name} {cohort.isActive && "(Active)"}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="leadRole">Assign to</Label>
                              <Select
                                value={leadRole}
                                onValueChange={(next) => {
                                  setLeadRole(next as "FOUNDER" | "MENTOR");
                                  setSelectedFounderId("");
                                }}
                              >
                                <SelectTrigger id="leadRole">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FOUNDER">Founder</SelectItem>
                                  <SelectItem value="MENTOR">Mentor</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {leadRole === "FOUNDER"
                                  ? "Leads the team and receives a Band A stipend."
                                  : "Added as Mentor. Paid via honorarium, not the stipend engine, and may lead more than one team."}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="founder">
                                {leadRole === "FOUNDER" ? "Founder" : "Mentor"}
                              </Label>
                              <Select value={selectedFounderId} onValueChange={setSelectedFounderId}>
                                <SelectTrigger id="founder">
                                  <SelectValue
                                    placeholder={leadRole === "FOUNDER" ? "Select founder" : "Select mentor"}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {founders?.length === 0 && (
                                    <div className="px-2 py-3 text-sm text-muted-foreground">
                                      {leadRole === "FOUNDER"
                                        ? "No founders available — all are already in a team."
                                        : "No mentors found."}
                                    </div>
                                  )}
                                  {founders?.map((founder) => (
                                    <SelectItem key={founder.id} value={founder.id}>
                                      {founder.name} ({founder.email})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => assignFounderMutation.mutate()}
                                disabled={
                                  assignFounderMutation.isPending || 
                                  !selectedCohortId || 
                                  !selectedFounderId || 
                                  !teamName.trim()
                                }
                                className="flex-1"
                              >
                                {assignFounderMutation.isPending ? "Creating Team..." : "Create Team"}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setShowAssignFounder(false);
                                  setSelectedCohortId("");
                                  setSelectedFounderId("");
                                  setTeamName("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Admin Actions (visible to admins only) */}
                {statement.status === "PENDING" && user && (user.role === 'ADMIN') && (
                  <>
                    <Separator />
                    <div className="flex gap-4">
                      <Button
                        onClick={() => publishMutation.mutate()}
                        disabled={publishMutation.isPending}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {publishMutation.isPending ? "Publishing..." : "Publish"}
                      </Button>
                      <Button
                        onClick={() => rejectMutation.mutate()}
                        disabled={rejectMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Problem statement not found</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
