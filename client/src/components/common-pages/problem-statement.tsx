import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ProblemStatementForm } from "@/components/ProblemStatementForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Target,
  Users,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileText,
  ExternalLink,
  Pencil,
  Save,
  X,
  PlusCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type TeamMember = { id: string; name: string; role: string; band: string | null };

type TeamData = {
  id: string;
  name: string;
  track: string;
  healthStatus: string;
  problemStatementId: string | null;
  userRole: string;
  userBand: string | null;
  members: TeamMember[];
};

type ProblemStatement = {
  id: string;
  title: string;
  track: string;
  description?: string;
  overview?: string;
  expectedOutcomes?: string | null;
  constraintsRequirements?: string | null;
  sponsorName?: string | null;
  createdAt: string;
  fileKeys?: string[] | null;
};

type MentorPSItem = {
  type: "own" | "team";
  label: string;
  teamName?: string;
  ps: ProblemStatement;
};

// ── Utility ────────────────────────────────────────────────────────────────────

function getTrackColor(track: string) {
  const colors: Record<string, string> = {
    EduTech: "bg-blue-100 text-blue-700",
    HealthTech: "bg-green-100 text-green-700",
    FinTech: "bg-red-100 text-red-700",
    AgriTech: "bg-orange-100 text-orange-700",
    CleanTech: "bg-teal-100 text-teal-700",
    DeepTech: "bg-indigo-100 text-indigo-700",
  };
  return colors[track] || "bg-gray-100 text-gray-700";
}

// ── Shared card that renders a PS in the same rich layout everywhere ────────────

function PSDetailCard({
  problem,
  teamData,
  canEditMeta,
}: {
  problem: ProblemStatement;
  teamData?: TeamData;
  canEditMeta: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingOutcomes, setEditingOutcomes] = useState(false);
  const [editingConstraints, setEditingConstraints] = useState(false);
  const [outcomesText, setOutcomesText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");

  const saveMetaMutation = useMutation({
    mutationFn: async (data: { expectedOutcomes?: string; constraintsRequirements?: string }) =>
      apiRequest("PATCH", `/api/problem-statements/${problem.id}/meta`, data),
    onSuccess: () => {
      toast({ title: "Saved", description: "Problem statement updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
      queryClient.invalidateQueries({ queryKey: [`/api/problems/${problem.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/mentor/my-problem-statements"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Main card */}
      <Card className="bg-white border border-gray-200 shadow-lg" data-tour="m-pg-ps-main-card">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-xl text-gray-900">{problem.title}</CardTitle>
            <BookOpen className="h-8 w-8 text-red-600 shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto pr-1">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {problem.description ?? problem.overview ?? "No description provided."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Supporting Documents */}
      {problem.fileKeys && problem.fileKeys.length > 0 && (
        <Card className="bg-white border border-gray-200 shadow-lg" data-tour="m-pg-ps-supporting-docs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
              <FileText className="h-5 w-5 text-red-600" />
              Supporting Documents
            </CardTitle>
            <CardDescription className="text-gray-600">
              Files uploaded for this problem statement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {problem.fileKeys.map((key) => {
                const displayName = key.split("/").pop() || key;
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="text-sm text-gray-700 break-all">{displayName}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1"
                      onClick={async () => {
                        try {
                          const res = await apiRequest("POST", "/api/problem-statements/files/view-url", { objectKey: key });
                          if (res?.fileUrl) window.open(res.fileUrl, "_blank");
                        } catch {
                          toast({ title: "Error", description: "Could not open file.", variant: "destructive" });
                        }
                      }}
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Expected Outcomes */}
        <Card className="bg-white border border-gray-200 shadow-lg" data-tour="m-pg-ps-expected-outcomes">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                  <Target className="h-5 w-5 text-green-500" />
                  Expected Outcomes
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Key deliverables and success criteria
                </CardDescription>
              </div>
              {canEditMeta && !editingOutcomes && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-gray-500 hover:text-gray-900"
                  onClick={() => { setOutcomesText(problem.expectedOutcomes ?? ""); setEditingOutcomes(true); }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingOutcomes ? (
              <div className="space-y-3">
                <Textarea
                  value={outcomesText}
                  onChange={(e) => setOutcomesText(e.target.value)}
                  placeholder="Describe the expected outcomes and deliverables..."
                  className="min-h-[120px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={saveMetaMutation.isPending}
                    onClick={() => saveMetaMutation.mutate({ expectedOutcomes: outcomesText }, { onSuccess: () => setEditingOutcomes(false) })}
                  >
                    <Save className="h-4 w-4" /> {saveMetaMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingOutcomes(false)}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            ) : problem.expectedOutcomes ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{problem.expectedOutcomes}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No specific outcomes defined yet.{canEditMeta && " Click Edit to add them."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Constraints & Requirements */}
        <Card className="bg-white border border-gray-200 shadow-lg" data-tour="m-pg-ps-constraints">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Constraints &amp; Requirements
                </CardTitle>
                <CardDescription className="text-gray-600 mt-1">
                  Boundaries and technical requirements
                </CardDescription>
              </div>
              {canEditMeta && !editingConstraints && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-gray-500 hover:text-gray-900"
                  onClick={() => { setConstraintsText(problem.constraintsRequirements ?? ""); setEditingConstraints(true); }}
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editingConstraints ? (
              <div className="space-y-3">
                <Textarea
                  value={constraintsText}
                  onChange={(e) => setConstraintsText(e.target.value)}
                  placeholder="Describe constraints, boundaries, and technical requirements..."
                  className="min-h-[120px] text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={saveMetaMutation.isPending}
                    onClick={() => saveMetaMutation.mutate({ constraintsRequirements: constraintsText }, { onSuccess: () => setEditingConstraints(false) })}
                  >
                    <Save className="h-4 w-4" /> {saveMetaMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingConstraints(false)}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </div>
            ) : problem.constraintsRequirements ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{problem.constraintsRequirements}</p>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No specific constraints defined yet.{canEditMeta && " Click Edit to add them."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team */}
      {teamData && (
        <Card className="bg-white border border-gray-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
              <Users className="h-5 w-5 text-red-600" />
              Your Team
            </CardTitle>
            <CardDescription className="text-gray-600">
              Team members working on this problem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {teamData.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-medium text-red-700">
                    {member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{member.name}</p>
                    <p className="text-xs text-gray-600">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Mentor View ────────────────────────────────────────────────────────────────

function MentorView() {
  const [showForm, setShowForm] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { data: allPSs = [], isLoading } = useQuery<MentorPSItem[]>({
    queryKey: ["/api/mentor/my-problem-statements"],
  });

  if (isLoading) {
    return (
      <AppLayout title="Problem Statement">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (showForm) {
    return (
      <AppLayout title="Submit Problem Statement">
        <div className="max-w-2xl mx-auto space-y-4">
          <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
            ← Back
          </Button>
          <ProblemStatementForm onSaved={() => setShowForm(false)} />
        </div>
      </AppLayout>
    );
  }

  if (allPSs.length === 0) {
    return (
      <AppLayout title="Problem Statement">
        <div className="flex flex-col items-center justify-center py-16">
          <FolderOpen className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-gray-900">No Problem Statements Yet</h2>
          <p className="text-gray-600 text-center max-w-md mb-6">
            You haven't submitted a problem statement yet. Submit one to get started, or wait for a team to be assigned to you.
          </p>
          <Button onClick={() => setShowForm(true)} className="gap-2" data-tour="m-pg-ps-submit-btn">
            <PlusCircle className="h-4 w-4" />
            Submit Problem Statement
          </Button>
        </div>
      </AppLayout>
    );
  }

  const current = allPSs[selectedIndex] ?? allPSs[0];

  return (
    <AppLayout title="Problem Statement">
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Problem Statement</h1>
            <p className="text-gray-600 text-sm">
              {current.type === "own"
                ? "Your submitted problem statement"
                : `Assigned to team: ${current.teamName}`}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={getTrackColor(current.ps.track)} data-tour="m-pg-ps-track-badge">{current.ps.track}</Badge>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="gap-2" data-tour="m-pg-ps-submit-new">
              <PlusCircle className="h-4 w-4" />
              Submit New PS
            </Button>
          </div>
        </div>

        {/* Dropdown when multiple PSs */}
        {allPSs.length > 1 && (
          <Select
            value={String(selectedIndex)}
            onValueChange={(v) => setSelectedIndex(Number(v))}
          >
            <SelectTrigger className="w-full sm:w-72" data-tour="m-pg-ps-dropdown">
              <SelectValue placeholder="Select problem statement" />
            </SelectTrigger>
            <SelectContent>
              {allPSs.map((item, i) => (
                <SelectItem key={`${item.type}-${item.ps.id}`} value={String(i)}>
                  {item.type === "own" ? `My PS: ${item.ps.title}` : `Team ${item.teamName}: ${item.ps.title}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <PSDetailCard problem={current.ps} canEditMeta={true} />
      </div>
    </AppLayout>
  );
}

// ── Founder View ───────────────────────────────────────────────────────────────

function FounderView() {
  const { user } = useAuth();
  const isCofounder = user?.role === "COFOUNDER";
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedProblemId, setSelectedProblemId] = useState<string>("");

  const { data: allPSs = [], isLoading: psLoading } = useQuery<ProblemStatement[]>({
    queryKey: ["/api/problem-statements"],
  });

  const { data: teamData, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: ["/api/my-team"],
  });

  const isLoading = psLoading || teamLoading;

  useEffect(() => {
    if (!selectedProblemId && allPSs.length > 0) {
      setSelectedProblemId(allPSs[0].id);
    }
  }, [allPSs, selectedProblemId]);

  if (isLoading) {
    return (
      <AppLayout title="Problem Statement">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const problem = allPSs.find((item) => item.id === selectedProblemId) ?? allPSs[0] ?? null;

  if (!problem) {
    if (isCofounder) {
      return (
        <AppLayout title="Problem Statement">
          <div className="flex flex-col items-center justify-center py-12" data-tour="cf-pg-ps-page-header">
            <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-gray-900">No Problem Statement Published Yet</h2>
            <p className="text-gray-600 text-center max-w-md">
              Your founder has not published a problem statement yet. You will be notified once it is available.
            </p>
          </div>
        </AppLayout>
      );
    }
    return (
      <AppLayout title="Submit Problem Statement">
        <div className="max-w-2xl mx-auto">
          <ProblemStatementForm onSaved={() => {}} />
        </div>
      </AppLayout>
    );
  }

  if (showEditForm) {
    return (
      <AppLayout title="Edit Problem Statement">
        <div className="max-w-2xl mx-auto space-y-4">
          <Button variant="outline" size="sm" onClick={() => setShowEditForm(false)}>
            ← Back
          </Button>
          <ProblemStatementForm
            initialData={{
              id: problem.id,
              title: problem.title,
              overview: problem.overview ?? problem.description,
              track: problem.track,
              fileKeys: problem.fileKeys ?? [],
            }}
            onSaved={() => setShowEditForm(false)}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Problem Statement">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-tour="cf-pg-ps-page-header">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Problem Statement</h1>
            <p className="text-gray-600 text-sm">
              {isCofounder ? "View-only problem statement context from your founder" : "Your submitted problem statement"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getTrackColor(problem.track)}>{problem.track}</Badge>
            {!isCofounder && (
              <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit Problem Statement
              </Button>
            )}
          </div>
        </div>

        {(isCofounder || allPSs.length > 1) && (
          <Select value={problem.id} onValueChange={setSelectedProblemId}>
            <SelectTrigger className="w-full sm:w-80" data-tour="cf-pg-ps-dropdown" disabled={allPSs.length <= 1}>
              <SelectValue placeholder="Select problem statement" />
            </SelectTrigger>
            <SelectContent>
              {allPSs.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <PSDetailCard problem={problem} teamData={teamData} canEditMeta={!isCofounder} />
      </div>
    </AppLayout>
  );
}

// ── Learner View ───────────────────────────────────────────────────────────────

function LearnerView() {
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: ["/api/my-team"],
  });

  const { data: problem, isLoading: problemLoading } = useQuery<ProblemStatement>({
    queryKey: [`/api/problems/${teamData?.problemStatementId}`],
    enabled: !!teamData?.problemStatementId,
  });

  const isLoading = teamLoading || problemLoading;

  if (isLoading) {
    return (
      <AppLayout title="Problem Statement">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!teamData?.id) {
    return (
      <AppLayout title="Problem Statement">
        <div className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-gray-900">No Team Assigned</h2>
          <p className="text-gray-600 text-center max-w-md">
            You need to be assigned to a team to view your problem statement. Please contact your administrator.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (!teamData.problemStatementId || !problem) {
    return (
      <AppLayout title="Problem Statement">
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-gray-900">No Problem Statement Assigned</h2>
          <p className="text-gray-600 text-center max-w-md">
            Your team hasn't been assigned a problem statement yet. Please wait for your mentor or admin to assign one.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Problem Statement">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Problem Statement</h1>
            <p className="text-gray-600">Your team's assigned challenge for {teamData.name}</p>
          </div>
          <Badge className={getTrackColor(problem.track)}>{problem.track}</Badge>
        </div>

        <PSDetailCard problem={problem} teamData={teamData} canEditMeta={false} />

        {/* Tips for Success */}
        <Card className="bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-[#F5E6D3] border border-[#E3D9CC] shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
              <Lightbulb className="h-5 w-5 text-red-600" />
              Tips for Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-600 mt-0.5" />
                <span className="text-gray-700">Break down the problem into smaller, manageable sprints</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-600 mt-0.5" />
                <span className="text-gray-700">Conduct customer interviews early to validate assumptions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-600 mt-0.5" />
                <span className="text-gray-700">Build an MVP before adding advanced features</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-600 mt-0.5" />
                <span className="text-gray-700">Document your progress and learnings regularly</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ── Page entry point ───────────────────────────────────────────────────────────

export default function ProblemStatementPage() {
  const { user } = useAuth();
  if (user?.role === "MENTOR") return <MentorView />;
  if (user?.role === "FOUNDER" || user?.role === "COFOUNDER") return <FounderView />;
  return <LearnerView />;
}

