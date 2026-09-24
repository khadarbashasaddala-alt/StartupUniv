import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ALL_SUBMITTERS, matchesEvidenceLockerFilter, submittersOf } from "@shared/evidenceLocker";
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
  FileText,
  GitPullRequest,
  Play,
  Rocket,
  Code2,
  ExternalLink,
  Plus,
  Loader2,
  FolderOpen,
  GitBranch,
  FileCheck,
  Ticket,
  Trash2,
  User,
} from "lucide-react";

type Evidence = {
  id: string;
  type: "PR" | "CI" | "Ticket" | "Doc" | "Demo";
  title: string;
  url: string | null;
  metaJson: Record<string, unknown> | null;
  createdAt: string;
  sprintId?: string;
  submittedBy?: string | null;
  submitterName?: string | null;
};

type TeamData = {
  id: string;
  name: string;
  track: string;
  healthStatus: string;
  userRole: string;
  userBand: string | null;
  members: { id: string; name: string; role: string; band: string | null }[];
};

export default function EvidencePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [evidenceType, setEvidenceType] = useState<string>("PR");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [attachments, setAttachments] = useState<Array<{ url: string; objectKey?: string; name?: string }>>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  // "all" or a user id. Lets anyone on the team - member, mentor, or admin - narrow the shared
  // list down to one person's submissions, without changing who can see the list in the first
  // place: that visibility is unchanged, decided server-side by isTeamMemberOrAdmin.
  const [selectedSubmitter, setSelectedSubmitter] = useState<string>(ALL_SUBMITTERS);
  const [deleteTarget, setDeleteTarget] = useState<Evidence | null>(null);

  const isAdmin = user?.role === "ADMIN";
  const isMentor = user?.role === "MENTOR";
  const needsTeamSelector = isAdmin || isMentor;

  // For learner/founder/cofounder: get their own team
  const { data: teamData, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: ["/api/my-team"],
    enabled: !needsTeamSelector,
  });

  // For admin: get all teams
  const { data: allTeams, isLoading: allTeamsLoading } = useQuery<any[]>({
    queryKey: ["/api/teams"],
    queryFn: () => apiRequest("GET", "/api/teams"),
    enabled: isAdmin,
  });

  // For mentor: get assigned teams
  const { data: mentorTeams, isLoading: mentorTeamsLoading } = useQuery<any[]>({
    queryKey: ["/api/mentor/teams"],
    queryFn: () => apiRequest("GET", "/api/mentor/teams"),
    enabled: isMentor,
  });

  // Build team selector items for admin/mentor
  const teamSelectorItems = useMemo(() => {
    if (isAdmin && allTeams) {
      return allTeams.map((t: any) => ({ id: t.id, name: t.name }));
    }
    if (isMentor && mentorTeams) {
      return mentorTeams.map((t: any) => ({ id: t.id || t.teamId, name: t.name || t.teamName }));
    }
    return [];
  }, [isAdmin, isMentor, allTeams, mentorTeams]);

  // Determine effective team ID
  const effectiveTeamId = needsTeamSelector ? selectedTeamId : teamData?.id;
  const effectiveTeamName = useMemo(() => {
    if (!needsTeamSelector) return teamData?.name || "";
    const found = teamSelectorItems.find((t) => t.id === selectedTeamId);
    return found?.name || "";
  }, [needsTeamSelector, teamData?.name, teamSelectorItems, selectedTeamId]);

  const evidenceQueryKey = effectiveTeamId ? `/api/teams/${effectiveTeamId}/evidence` : null;

  useEffect(() => {
    setSelectedSubmitter(ALL_SUBMITTERS);
  }, [effectiveTeamId]);

  const { data: evidence, isLoading: evidenceLoading } = useQuery<Evidence[]>({
    queryKey: [evidenceQueryKey],
    enabled: !!effectiveTeamId,
    queryFn: async () => {
      return await apiRequest("GET", `/api/teams/${effectiveTeamId}/evidence`);
    },
  });

  const createEvidenceMutation = useMutation({
    mutationFn: async (data: { type: string; title: string; url: string; metaJson?: Record<string, unknown> }) => {
      return await apiRequest("POST", `/api/teams/${effectiveTeamId}/evidence`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [evidenceQueryKey] });
      toast({ title: "Evidence added", description: "New evidence has been recorded" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add evidence", variant: "destructive" });
    },
  });

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/evidence/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [evidenceQueryKey] });
      toast({ title: "Evidence deleted", description: "The evidence has been removed" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete evidence", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setEvidenceType("PR");
    setEvidenceTitle("");
    setEvidenceUrl("");
    setAttachments([]);
  };

  const handleAddEvidence = () => {
    if (!evidenceTitle || !evidenceUrl) return;
    createEvidenceMutation.mutate({
      type: evidenceType,
      title: evidenceTitle,
      url: evidenceUrl,
      metaJson: attachments.length > 0 ? { attachments } : undefined,
    });
  };

  // Can the current user delete a specific evidence item?
  const canDelete = (item: Evidence) => {
    if (isAdmin) return true;
    if (item.submittedBy === user?.id) return true;
    // Founders/mentors can delete their team's evidence
    if (user?.role === "FOUNDER" || user?.role === "MENTOR") return true;
    return false;
  };

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case "PR":
        return <GitPullRequest className="h-4 w-4" />;
      case "CI":
        return <Play className="h-4 w-4" />;
      case "Ticket":
        return <Ticket className="h-4 w-4" />;
      case "Doc":
        return <FileText className="h-4 w-4" />;
      case "Demo":
        return <Rocket className="h-4 w-4" />;
      default:
        return <Code2 className="h-4 w-4" />;
    }
  };

  const getEvidenceColor = (type: string) => {
    switch (type) {
      case "PR":
        return "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
      case "CI":
        return "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400";
      case "Ticket":
        return "bg-orange-100 text-foreground dark:bg-orange-900/30 dark:text-orange-400";
      case "Doc":
        return "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
      case "Demo":
        return "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const submitters = useMemo(() => submittersOf(evidence ?? []), [evidence]);

  const filteredEvidence =
    evidence?.filter((item) => matchesEvidenceLockerFilter(item, activeTab, selectedSubmitter)) ||
    [];

  const evidenceCounts = {
    all: evidence?.length || 0,
    PR: evidence?.filter((e) => e.type === "PR").length || 0,
    CI: evidence?.filter((e) => e.type === "CI").length || 0,
    Ticket: evidence?.filter((e) => e.type === "Ticket").length || 0,
    Doc: evidence?.filter((e) => e.type === "Doc").length || 0,
    Demo: evidence?.filter((e) => e.type === "Demo").length || 0,
  };

  const isLoading = needsTeamSelector
    ? (isAdmin ? allTeamsLoading : mentorTeamsLoading)
    : teamLoading;

  if (isLoading) {
    return (
      <AppLayout title="Evidence">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppLayout>
    );
  }

  // For non-admin/mentor users: show "no team" if no team assigned
  if (!needsTeamSelector && !teamData?.id) {
    return (
      <AppLayout title="Evidence">
        <div className="flex flex-col items-center justify-center py-12">
          <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Team Assigned</h2>
          <p className="text-muted-foreground text-center max-w-md">
            You need to be assigned to a team to view and add evidence. Please contact your administrator.
          </p>
        </div>
      </AppLayout>
    );
  }

  // For admin/mentor: show team selector if no team selected yet
  if (needsTeamSelector && !selectedTeamId) {
    return (
      <AppLayout title="Evidence">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-tour="m-pg-evidence-heading-initial">Evidence Locker</h1>
            <p className="text-muted-foreground">Select a team to view and manage evidence</p>
          </div>
          <Card className="max-w-md" data-tour="m-pg-evidence-team-select-initial">
            <CardHeader>
              <CardTitle>Select Team</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Choose any team to view their evidence"
                  : "Choose from your assigned teams"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teamSelectorItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {isAdmin ? "No teams found." : "You are not assigned to any teams."}
                </p>
              ) : (
                <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teamSelectorItems.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Evidence">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title" data-tour="evidence-heading">Evidence Locker</h1>
            <p className="text-muted-foreground">
              Track PRs, CI runs, documentation, and demos for {effectiveTeamName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Team selector for admin/mentor inline */}
            {needsTeamSelector && teamSelectorItems.length > 1 && (
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="w-[200px]" data-tour="m-pg-evidence-team-switcher">
                  <SelectValue placeholder="Switch team..." />
                </SelectTrigger>
                <SelectContent>
                  {teamSelectorItems.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Hide Add Evidence button for admin */}
            {!isAdmin && (
              <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-evidence" data-tour="add-evidence-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add Evidence
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5" data-tour="evidence-stat-cards">
          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-pr">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Pull Requests</CardTitle>
              <GitPullRequest className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{evidenceCounts.PR}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-ci">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">CI Runs</CardTitle>
              <Play className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{evidenceCounts.CI}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-ticket">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{evidenceCounts.Ticket}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-doc">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Documents</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{evidenceCounts.Doc}</div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl hover:shadow-2xl transition-shadow" data-testid="stat-demo">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-full blur-lg -translate-y-1/2 translate-x-1/2"></div>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2 relative">
              <CardTitle className="text-sm font-medium text-foreground">Demos</CardTitle>
              <Rocket className="h-4 w-4 text-pink-500" />
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-bold text-foreground">{evidenceCounts.Demo}</div>
            </CardContent>
          </Card>
        </div>

        {/* Evidence List */}
        <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border shadow-xl rounded-2xl" data-tour="evidence-list">
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <CardHeader className="pb-0 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <GitBranch className="h-5 w-5" />
                  All Evidence
                </CardTitle>
                <Badge variant="outline">{evidenceCounts.all} items</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <TabsList data-tour="evidence-filter-tabs">
                  <TabsTrigger value="all" className="gap-2" data-testid="tab-all">
                    All
                    <Badge variant="secondary" className="ml-1">{evidenceCounts.all}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="PR" className="gap-2" data-testid="tab-pr">
                    <GitPullRequest className="h-3 w-3" />
                    PRs
                    <Badge variant="secondary" className="ml-1">{evidenceCounts.PR}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="CI" className="gap-2" data-testid="tab-ci">
                    <Play className="h-3 w-3" />
                    CI
                    <Badge variant="secondary" className="ml-1">{evidenceCounts.CI}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="Ticket" className="gap-2" data-testid="tab-ticket">
                    <Ticket className="h-3 w-3" />
                    Tickets
                    <Badge variant="secondary" className="ml-1">{evidenceCounts.Ticket}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="Doc" className="gap-2" data-testid="tab-doc">
                    <FileText className="h-3 w-3" />
                    Docs
                    <Badge variant="secondary" className="ml-1">{evidenceCounts.Doc}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="Demo" className="gap-2" data-testid="tab-demo">
                    <Rocket className="h-3 w-3" />
                    Demos
                    <Badge variant="secondary" className="ml-1">{evidenceCounts.Demo}</Badge>
                  </TabsTrigger>
                </TabsList>
                {submitters.length > 0 && (
                  <Select value={selectedSubmitter} onValueChange={setSelectedSubmitter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-submitter" data-tour="evidence-submitter-filter">
                      <User className="h-3.5 w-3.5 mr-1.5 shrink-0 opacity-70" />
                      <SelectValue placeholder="Submitted by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_SUBMITTERS}>All members</SelectItem>
                      {submitters.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 relative">
              {evidenceLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : filteredEvidence.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {filteredEvidence.map((item, idx) => (
                      <Card key={item.id} className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-md rounded-xl hover:shadow-lg transition-shadow" data-testid={`evidence-row-${item.id}`} data-tour={idx === 0 ? "m-pg-evidence-list-first" : undefined}>
                        <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 rounded-full blur-md -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="py-4 px-4 relative">
                          <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-full ${getEvidenceColor(item.type)}`}>
                              {getEvidenceIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {item.type}
                                </Badge>
                                <h4
                                  className="font-medium text-foreground break-words"
                                  data-testid={`evidence-title-${item.id}`}
                                >
                                  {item.title}
                                </h4>
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>Added {formatDateTime(item.createdAt)}</span>
                                {item.submitterName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {item.submitterName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.url ? (
                                <a
                                  href="#"
                                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                                  data-testid={`evidence-link-${item.id}`}
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    const url = item.url!;
                                    if (url.includes('.amazonaws.com')) {
                                      const objectKey = (item.metaJson as any)?.attachments?.[0]?.objectKey;
                                      if (objectKey) {
                                        try {
                                          const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey });
                                          window.open(resp.fileUrl, "_blank"); return;
                                        } catch {}
                                      }
                                    }
                                    window.open(url, "_blank");
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View
                                </a>
                              ) : (
                                <span className="text-sm text-muted-foreground">No link</span>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEvidence(item);
                                  setShowEvidenceDialog(true);
                                }}
                                data-testid={`button-view-details-${item.id}`}
                              >
                                Details
                              </Button>

                              {canDelete(item) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget(item)}
                                  data-testid={`button-delete-${item.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground" data-tour="cf-evidence-empty-state">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No evidence found</p>
                  <p className="text-sm mt-1">
                    {selectedSubmitter !== ALL_SUBMITTERS
                      ? `${submitters.find((s) => s.id === selectedSubmitter)?.name ?? "This person"} hasn't submitted${activeTab === "all" ? "" : ` ${activeTab}`} evidence yet`
                      : activeTab === "all"
                        ? "Start adding PRs, CI runs, and documentation to build your evidence locker"
                        : `No ${activeTab} evidence recorded yet`}
                  </p>
                  {selectedSubmitter === ALL_SUBMITTERS && (
                    <Button
                      variant="outline"
                      className="mt-4 border-primary text-primary hover:bg-primary/10"
                      onClick={() => setShowAddDialog(true)}
                      data-tour="m-pg-evidence-add-first"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Evidence
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Tabs>
        </Card>

        {/* Add Evidence Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Evidence</DialogTitle>
              <DialogDescription>
                Record a new piece of evidence for {effectiveTeamName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="evidence-type">Type</Label>
                <Select value={evidenceType} onValueChange={setEvidenceType}>
                  <SelectTrigger id="evidence-type" data-testid="select-evidence-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PR">
                      <div className="flex items-center gap-2">
                        <GitPullRequest className="h-4 w-4 text-purple-500" />
                        Pull Request
                      </div>
                    </SelectItem>
                    <SelectItem value="CI">
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-green-500" />
                        CI Run
                      </div>
                    </SelectItem>
                    <SelectItem value="Ticket">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-orange-500" />
                        Ticket
                      </div>
                    </SelectItem>
                    <SelectItem value="Doc">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Document
                      </div>
                    </SelectItem>
                    <SelectItem value="Demo">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-pink-500" />
                        Demo
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="evidence-title">Title</Label>
                <Input
                  id="evidence-title"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  placeholder="e.g., Add user authentication feature"
                  data-testid="input-evidence-title"
                />
              </div>
              <div>
                <Label htmlFor="evidence-url">URL</Label>
                <Input
                  id="evidence-url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  data-testid="input-evidence-url"
                />
              </div>
              <div>
                <Label>Attachment *</Label>
                <p className="text-sm text-muted-foreground mb-2">Upload images, videos or documents (required)</p>
                <ObjectUploader
                  acceptedTypes="image/*,video/*,application/pdf,.doc,.docx"
                  onGetUploadParameters={async () => {
                    const resp = await apiRequest("POST", "/api/objects/upload", {} as any);
                    return { method: "PUT", url: resp.uploadURL, objectKey: resp.objectKey };
                  }}
                  getViewUrlEndpoint="/api/objects/view-url"
                  onComplete={(fileUrl, objectKey, fileName) => {
                    setAttachments((s) => [...s, { url: fileUrl, objectKey, name: fileName }]);
                    if (!evidenceUrl) setEvidenceUrl(fileUrl);
                  }}
                >
                  <Button variant="outline" className="w-full">Upload File</Button>
                </ObjectUploader>

                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((a, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate max-w-xs">
                            {a.name || a.objectKey || a.url}
                          </a>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setAttachments((s) => s.filter((_, i) => i !== idx))}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddEvidence}
                disabled={!evidenceTitle || !evidenceUrl || attachments.length === 0 || createEvidenceMutation.isPending}
                data-testid="button-submit-evidence"
              >
                {createEvidenceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Evidence
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Evidence Details Dialog */}
        <Dialog open={showEvidenceDialog} onOpenChange={(v) => { if (!v) { setSelectedEvidence(null); } setShowEvidenceDialog(v); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Evidence Details</DialogTitle>
              <DialogDescription>
                Full details for the selected evidence item
              </DialogDescription>
            </DialogHeader>

            {selectedEvidence ? (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {/* Title + Type + Date */}
                <div className="p-4 bg-muted/30">
                  <h3 className="text-base font-semibold text-foreground">{selectedEvidence.title}</h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{selectedEvidence.type}</Badge>
                    <span className="text-xs text-muted-foreground">Added {formatDateTime(selectedEvidence.createdAt)}</span>
                  </div>
                </div>

                {/* Submitted By — always shown */}
                <div className="p-4 flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Submitted By</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedEvidence.submitterName || "Unknown"}
                    </p>
                  </div>
                </div>

                {/* URL */}
                <div className="p-4 flex items-center gap-3">
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">URL</p>
                    {selectedEvidence.url ? (
                      <a href="#"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={async (e) => {
                          e.preventDefault();
                          const url = selectedEvidence.url!;
                          // If it's an S3 URL, regenerate a fresh signed URL to avoid expiry
                          if (url.includes('.amazonaws.com')) {
                            const objectKey = (selectedEvidence.metaJson as any)?.attachments?.[0]?.objectKey;
                            if (objectKey) {
                              try {
                                const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey });
                                window.open(resp.fileUrl, "_blank"); return;
                              } catch {}
                            }
                          }
                          window.open(url, "_blank");
                        }}
                      >
                        Open link
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">No URL provided</p>
                    )}
                  </div>
                </div>

                {/* Attachments */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Attachments</p>
                  </div>
                  {selectedEvidence.metaJson && Array.isArray((selectedEvidence.metaJson as any).attachments) && (selectedEvidence.metaJson as any).attachments.length > 0 ? (
                    <div className="space-y-2">
                      {((selectedEvidence.metaJson as any).attachments as Array<any>).map((a, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-2 bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <a
                              href="#"
                              className="text-sm text-primary hover:underline truncate"
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  const resp = await apiRequest("POST", "/api/objects/view-url", { objectKey: a.objectKey });
                                  window.open(resp.fileUrl, "_blank");
                                } catch (err) {
                                  toast({ title: "Error", description: "Failed to fetch document URL", variant: "destructive" });
                                }
                              }}
                            >
                              {a.name || a.objectKey || a.url}
                            </a>
                          </div>
                          {a.contentType && (
                            <Badge variant="secondary" className="text-xs ml-2 shrink-0">{a.contentType}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attachments</p>
                  )}
                </div>
              </div>
            ) : (
              <p>No evidence selected</p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowEvidenceDialog(false); setSelectedEvidence(null); }}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Evidence</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteTarget) {
                    deleteEvidenceMutation.mutate(deleteTarget.id);
                  }
                }}
              >
                {deleteEvidenceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
