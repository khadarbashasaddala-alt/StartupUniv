import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Calendar, Tag, Users } from "lucide-react";
import { ProblemStatementForm } from "@/components/ProblemStatementForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ProblemStatement {
  id: string;
  title: string;
  overview: string;
  track: string;
  status: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  learnerApplicationCount?: number;
  cofounderApplicationCount?: number;
  isTaken?: boolean;
}

export function ProblemStatementsList({ onEdit }: { onEdit?: (stmt: ProblemStatement) => void } = {}) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const allowedRoles = ["ADMIN", "FOUNDER", "MENTOR"]; // Removed COFOUNDER
  const [showAssignFounderDialog, setShowAssignFounderDialog] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<ProblemStatement | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string>("");
  // Whether the team is led by a FOUNDER or a MENTOR. Either way the team is
  // created from this problem statement's applicants, so its members get the
  // same problem statement.
  const [leadRole, setLeadRole] = useState<"FOUNDER" | "MENTOR">("FOUNDER");
  const [selectedFounderId, setSelectedFounderId] = useState<string>("");
  // MENTOR path attaches the statement to a team the mentor already mentors.
  const [selectedMentorTeamId, setSelectedMentorTeamId] = useState<string>("");
  const [teamName, setTeamName] = useState<string>("");
  const isAdmin = user && user.role === 'ADMIN';

  const { data: statements, isLoading } = useQuery<ProblemStatement[]>({
    queryKey: ["/api/problem-statements"],
    queryFn: async () => await apiRequest("GET", "/api/problem-statements"),
    staleTime: 0, // Always consider data stale to ensure fresh counts
    refetchOnMount: true,
  });

  // Fetch cohorts for admin
  const { data: cohorts } = useQuery<{ id: string; name: string; isActive: boolean }[]>({
    queryKey: ["/api/cohorts"],
    enabled: !!isAdmin && showAssignFounderDialog,
  });

  // Candidate leads for the team. Founders already in a team are excluded
  // because a founder may lead only one; mentors are not filtered, since a
  // mentor deliberately spans several teams.
  const { data: leadCandidates } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ["/api/admin/users", leadRole, leadRole === "FOUNDER" ? "excludeInTeams" : "all"],
    enabled: !!isAdmin && showAssignFounderDialog,
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

  // Teams the chosen mentor already mentors. The statement attaches to one of
  // these rather than creating a new team.
  const { data: mentorTeams } = useQuery<
    { id: string; name: string; teamRole: string; problemStatementId: string | null; problemStatementTitle: string | null }[]
  >({
    queryKey: ["/api/admin/users", selectedFounderId, "teams"],
    enabled: !!isAdmin && leadRole === "MENTOR" && !!selectedFounderId,
    queryFn: async () => {
      const result = await apiRequest("GET", `/api/admin/users/${selectedFounderId}/teams`);
      return Array.isArray(result) ? result : [];
    },
  });

  const assignFounderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStatement) throw new Error("No problem statement selected");
      return await apiRequest("POST", `/api/admin/problem-statements/${selectedStatement.id}/assign-founder`, {
        leadRole,
        leadUserId: selectedFounderId,
        ...(leadRole === "MENTOR"
          // Attach to an existing team — no cohort or new team name needed.
          ? { teamId: selectedMentorTeamId }
          : { cohortId: selectedCohortId, teamName: teamName.trim() }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Team created successfully!",
      });
      setShowAssignFounderDialog(false);
      setSelectedStatement(null);
      setSelectedCohortId("");
      setSelectedFounderId("");
      setTeamName("");
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

  const handleAssignFounder = (statement: ProblemStatement) => {
    setSelectedStatement(statement);
    setShowAssignFounderDialog(true);
  };

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!statements || statements.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-4" data-tour="ps-list">
        {statements.map((statement, index) => (
        <Card key={statement.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <CardTitle className="text-xl" {...(index === 0 ? { "data-tour": "ps-card-title" } : {})}>{statement.title}</CardTitle>
                <div className="flex items-center gap-2 flex-wrap" {...(index === 0 ? { "data-tour": "ps-card-status" } : {})}>
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
          <CardContent className="space-y-4">
            <CardDescription className="line-clamp-3" {...(index === 0 ? { "data-tour": "ps-card-desc" } : {})}>
              {statement.overview}
            </CardDescription>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground" {...(index === 0 ? { "data-tour": "ps-card-date" } : {})}>
                  <Calendar className="h-4 w-4" />
                  {new Date(statement.createdAt).toLocaleDateString()}
                </div>
                {statement.status === "PUBLISHED" && !statement.isTaken && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Interns: {statement.learnerApplicationCount || 0}/7</span>
                    <span>•</span>
                    <span>Co-founders: {statement.cofounderApplicationCount || 0}/2</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Creator always sees it; admin sees it on every statement, not only ones they
                    happened to create themselves — the server now allows an admin correction
                    even after a team has formed, so the button should not depend on who wrote it. */}
                {onEdit && user && (user.id === statement.createdBy || isAdmin) && (
                  <Button
                    variant="outline"
                    onClick={() => onEdit ? onEdit(statement) : setLocation(`/app/problem-statements/${statement.id}`)}
                    {...(index === 0 ? { "data-tour": "ps-card-edit" } : {})}
                  >
                    Edit
                  </Button>
                )}

                {isAdmin && statement.status === "PUBLISHED" && !statement.isTaken && (
                  <Button
                    variant="outline"
                    onClick={() => handleAssignFounder(statement)}
                    title="Assign founder to create team"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Assign Founder
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={() => setLocation(`/app/problem-statements/${statement.id}`)}
                  {...(index === 0 ? { "data-tour": "ps-card-view" } : {})}
                >
                  View Details
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      </div>

      {/* Assign Founder Dialog */}
      <Dialog open={showAssignFounderDialog} onOpenChange={setShowAssignFounderDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Team Lead - {selectedStatement?.title}</DialogTitle>
            <DialogDescription>
              {leadRole === "FOUNDER"
                ? "Create a team from this problem statement's applicants (up to 7 interns and 2 co-founders) with a founder at its head."
                : "Assign this problem statement to a team the mentor already mentors. No new team is created."}
              Everyone added to the team is assigned this problem statement.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {leadRole === "FOUNDER" && (
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter team name"
                />
              </div>
            )}
            
            {/* Cohort only matters when a team is being created. */}
            {leadRole === "FOUNDER" && (
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
            )}
            
            <div className="space-y-2">
              <Label htmlFor="leadRole">Assign to</Label>
              <Select
                value={leadRole}
                onValueChange={(next) => {
                  setLeadRole(next as "FOUNDER" | "MENTOR");
                  // The candidate list changes with the role, so a previously
                  // picked person is no longer valid.
                  setSelectedFounderId("");
                  setSelectedMentorTeamId("");
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
                  ? "The founder leads the team and receives a Band A stipend."
                  : "The mentor is added to the team as Mentor. Mentors are paid via honorarium, not the stipend engine, and may lead more than one team."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="founder">{leadRole === "FOUNDER" ? "Founder" : "Mentor"}</Label>
              <Select value={selectedFounderId} onValueChange={setSelectedFounderId}>
                <SelectTrigger id="founder">
                  <SelectValue placeholder={leadRole === "FOUNDER" ? "Select founder" : "Select mentor"} />
                </SelectTrigger>
                <SelectContent>
                  {leadCandidates?.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      {leadRole === "FOUNDER"
                        ? "No founders available — all are already in a team."
                        : "No mentors found."}
                    </div>
                  )}
                  {leadCandidates?.map((founder) => (
                    <SelectItem key={founder.id} value={founder.id}>
                      {founder.name} ({founder.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {leadRole === "MENTOR" && (
              <div className="space-y-2">
                <Label htmlFor="mentorTeam">Team</Label>
                <Select value={selectedMentorTeamId} onValueChange={setSelectedMentorTeamId}>
                  <SelectTrigger id="mentorTeam">
                    <SelectValue
                      placeholder={selectedFounderId ? "Select the mentor's team" : "Pick a mentor first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFounderId && mentorTeams?.length === 0 && (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        This mentor isn't on any team yet. Add them to a team first.
                      </div>
                    )}
                    {mentorTeams?.map((t) => (
                      <SelectItem key={t.id} value={t.id} disabled={!!t.problemStatementId}>
                        {t.name}
                        {t.problemStatementId ? ` — already has "${t.problemStatementTitle}"` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The statement is assigned to this existing team — no new team is created,
                  and every current member gets it.
                </p>
              </div>
            )}

            {selectedStatement && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Application Summary:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Interns: </span>
                    <span className="font-medium">{selectedStatement.learnerApplicationCount || 0}/7</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Co-founders: </span>
                    <span className="font-medium">{selectedStatement.cofounderApplicationCount || 0}/2</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignFounderDialog(false);
                setSelectedStatement(null);
                setSelectedCohortId("");
                setSelectedFounderId("");
                setTeamName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => assignFounderMutation.mutate()}
              disabled={
                assignFounderMutation.isPending ||
                !selectedFounderId ||
                // Founder creates a team: needs a cohort and a name.
                // Mentor attaches to an existing team: needs that team.
                (leadRole === "FOUNDER" && (!selectedCohortId || !teamName.trim())) ||
                (leadRole === "MENTOR" && !selectedMentorTeamId)
              }
            >
              {assignFounderMutation.isPending
                ? leadRole === "MENTOR" ? "Assigning..." : "Creating Team..."
                : leadRole === "MENTOR" ? "Assign to Team" : "Create Team"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
