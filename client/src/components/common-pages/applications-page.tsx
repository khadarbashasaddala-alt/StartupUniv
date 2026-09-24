import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
// dialog and form UI removed — adding members happens directly
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Send,
  Inbox,
  Check,
  X,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  UserPlus,
  Eye,
} from "lucide-react";
import { FounderProfileModal } from "@/components/FounderProfileModal";
import { ProblemStatementOverviewModal } from "@/components/ProblemStatementOverviewModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Application {
  id: string;
  type: "team_invitation" | "problem_statement_application";
  status: string;
  computedStatus: "sent" | "received" | "accepted" | "rejected" | "in_team" | "assigned_to_ps";
  displayStatus: string;
  teamName?: string;
  problemStatementTitle?: string;
  message?: string;
  createdAt: string;
  // For sent applications
  recipientId?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientRole?: string;
  // For received applications
  senderId?: string;
  senderName?: string;
  senderEmail?: string;
  senderRole?: string;
  // Founder's problem statement (for received team_invitation)
  founderProblemStatement?: { id: string; title: string; overview: string | null } | null;
  // For problem statement applications
  problemStatementId?: string;
  applicantRole?: string;
}

const getStatusBadge = (computedStatus: string, displayStatus: string) => {
  switch (computedStatus) {
    case "sent":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" />{displayStatus}</Badge>;
    case "received":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Inbox className="h-3 w-3 mr-1" />{displayStatus}</Badge>;
    case "accepted":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />{displayStatus}</Badge>;
    case "rejected":
      return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><XCircle className="h-3 w-3 mr-1" />{displayStatus}</Badge>;
    case "in_team":
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><Users className="h-3 w-3 mr-1" />{displayStatus}</Badge>;
    case "assigned_to_ps":
      return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200"><FileText className="h-3 w-3 mr-1" />{displayStatus}</Badge>;
    default:
      return <Badge variant="outline">{displayStatus}</Badge>;
  }
};

const getTypeBadge = (type: string) => {
  if (type === "team_invitation") {
    return <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200"><UserPlus className="h-3 w-3 mr-1" />Team Invitation</Badge>;
  }
  return <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200"><FileText className="h-3 w-3 mr-1" />Problem Statement</Badge>;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getProblemStatementDisplayTitle = (app: Application) => {
  return app.problemStatementTitle || app.founderProblemStatement?.title || "—";
};

export default function ApplicationsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { startPageTourIfFirst(user?.role === "COFOUNDER" ? "cf-applications" : user?.role === "MENTOR" ? "m-applications" : "applications"); }, [user?.role]);
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sent");
  const [viewingApplication, setViewingApplication] = useState<Application | null>(null);
  const [showFounderProfile, setShowFounderProfile] = useState(false);
  const [founderProfileId, setFounderProfileId] = useState<string | null>(null);
  const [showPsOverview, setShowPsOverview] = useState(false);
  const [viewingPs, setViewingPs] = useState<{ id: string; title: string; overview: string | null } | null>(null);
  const [viewingPsFounderName, setViewingPsFounderName] = useState<string>("");

  // Fetch sent applications
  const { data: sentApplications = [], isLoading: sentLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications/sent"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/applications/sent");
      return data;
    },
    enabled: !!user && !authLoading,
  });

  // Fetch received applications
  const { data: receivedApplications = [], isLoading: receivedLoading } = useQuery<Application[]>({
    queryKey: ["/api/applications/received"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/applications/received");
      return data;
    },
    enabled: !!user && !authLoading,
  });

  // Accept application mutation
  const acceptMutation = useMutation({
    mutationFn: async ({ applicationId, type }: { applicationId: string; type: string }) => {
      if (type === "team_invitation") {
        return apiRequest("PATCH", `/team-member-applications/${applicationId}`, {
          status: "ACCEPTED",
        });
      } else {
        return apiRequest("PATCH", `/problem-statement-applications/${applicationId}`, {
          status: "ACCEPTED",
        });
      }
    },
    onMutate: ({ applicationId }) => {
      setProcessingId(applicationId);
    },
    onSuccess: () => {
      toast({ title: "Application accepted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/applications/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications/sent"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept application",
        description: error.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  // Reject application mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ applicationId, type }: { applicationId: string; type: string }) => {
      if (type === "team_invitation") {
        return apiRequest("PATCH", `/team-member-applications/${applicationId}`, {
          status: "REJECTED",
        });
      } else {
        return apiRequest("PATCH", `/problem-statement-applications/${applicationId}`, {
          status: "REJECTED",
        });
      }
    },
    onMutate: ({ applicationId }) => {
      setProcessingId(applicationId);
    },
    onSuccess: () => {
      toast({ title: "Application rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/applications/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications/sent"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reject application",
        description: error.message,
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const handleAccept = (applicationId: string, type: string) => {
    acceptMutation.mutate({ applicationId, type });
  };

  const handleReject = (applicationId: string, type: string) => {
    rejectMutation.mutate({ applicationId, type });
  };

  // My team (needed to know which team to add the member to)
  const { data: myTeam } = useQuery<any>({
    queryKey: ["/api/my-team"],
    queryFn: async () => {
      try { return await apiRequest("GET", "/api/my-team"); } catch (e) { return null; }
    },
    enabled: !!user,
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, userId, role, stipendBand }: { teamId: string; userId: string; role: string; stipendBand?: string | null }) => {
      return await apiRequest("POST", `/api/teams/${teamId}/members`, { userId, role, stipendBand });
    },
    onSuccess: () => {
      toast({ title: "Member added", description: "User has been added to the team" });
      queryClient.invalidateQueries({ queryKey: ["/api/applications/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-team"] });
      // dialog removed — nothing to close
    },
    onError: (error: any) => {
      toast({ title: "Failed to add member", description: error.message || "Could not add member", variant: "destructive" });
    },
  });


  const addMemberDirect = (app: Application) => {
    const teamId = myTeam?.id;
    if (!teamId) {
      toast({ title: "No team", description: "You don't have a team to add members to", variant: "destructive" });
      return;
    }
    // Map recipientRole to team role
    const rec = (app.recipientRole || "").toUpperCase();
    let role = "Member";
    if (rec.includes("MENTOR")) role = "Mentor";
    else if (rec.includes("COFOUNDER") || rec.includes("COPROMOTER")) role = "CoPromoter";
    else if (rec.includes("FOUNDER") || rec.includes("PROMOTER")) role = "Promoter";

    addMemberMutation.mutate({ teamId, userId: app.recipientId!, role, stipendBand: null });
  };

  

  if (authLoading) {
    return (
      <AppLayout title="Applications">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const renderSentApplicationsTable = () => {
    if (sentLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (sentApplications.length === 0) {
      return (
        <div className="text-center py-12">
          <Send className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sent applications</h3>
          <p className="text-gray-500">You haven't sent any applications yet.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Problem Statement</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sentApplications.map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-red-600 to-red-700 text-white text-xs">
                      {getInitials(app.recipientName || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{app.recipientName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{app.recipientEmail || app.recipientRole || "—"}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{getTypeBadge(app.type)}</TableCell>
              <TableCell>
                <span className="text-sm text-foreground">
                  {getProblemStatementDisplayTitle(app)}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">{formatDate(app.createdAt)}</span>
              </TableCell>
              <TableCell>{getStatusBadge(app.computedStatus, app.displayStatus)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setViewingApplication(app)}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  {user?.role === "FOUNDER" && app.computedStatus === "accepted" && (
                    <>
                      <Button size="sm" className="h-8 bg-green-600 text-white" onClick={() => addMemberDirect(app)}>
                        <Check className="h-4 w-4 mr-1" /> Add
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => handleReject(app.id, app.type)} disabled={processingId === app.id}>
                        {processingId === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    );
  };

  const renderReceivedApplicationsTable = () => {
    if (receivedLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      );
    }

    if (receivedApplications.length === 0) {
      return (
        <div className="text-center py-12">
          <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No received applications</h3>
          <p className="text-muted-foreground">You haven't received any applications yet.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>From</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Problem Statement</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receivedApplications.map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(app.senderName || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{app.senderName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{app.senderEmail || app.senderRole || "—"}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>{getTypeBadge(app.type)}</TableCell>
              <TableCell>
                <span className="text-sm text-foreground">
                  {getProblemStatementDisplayTitle(app)}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">{formatDate(app.createdAt)}</span>
              </TableCell>
              <TableCell>{getStatusBadge(app.computedStatus, app.displayStatus)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => setViewingApplication(app)}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  {app.computedStatus === "received" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        onClick={() => handleAccept(app.id, app.type)}
                        disabled={processingId === app.id}
                      >
                        {processingId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                        onClick={() => handleReject(app.id, app.type)}
                        disabled={processingId === app.id}
                      >
                        {processingId === app.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    );
  };

  return (
    <AppLayout title="Applications">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div data-tour="m-pg-apps-heading">
            <h1 className="text-2xl font-bold text-foreground">Applications</h1>
            <p className="text-muted-foreground mt-1">
              Track all your sent and received applications
            </p>
          </div>
          <PageTourButton pageKey={user?.role === "COFOUNDER" ? "cf-applications" : user?.role === "MENTOR" ? "m-applications" : "applications"} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2" data-tour="m-pg-apps-tabs">
            <TabsTrigger value="sent" className="flex items-center gap-2" data-tour="apps-sent-tab">
              <Send className="h-4 w-4" />
              Sent
              {sentApplications.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {sentApplications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-2" data-tour="apps-received-tab">
              <Inbox className="h-4 w-4" />
              Received
              {receivedApplications.filter(a => a.computedStatus === "received").length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {receivedApplications.filter(a => a.computedStatus === "received").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent" className="mt-6">
            <Card data-tour="apps-table">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-600" />
                  Sent Applications
                </CardTitle>
                <CardDescription>
                  Applications and invitations you have sent
                </CardDescription>
              </CardHeader>
              <CardContent>{renderSentApplicationsTable()}</CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="received" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-yellow-600" />
                  Received Applications
                </CardTitle>
                <CardDescription>
                  Applications and invitations you have received
                </CardDescription>
              </CardHeader>
              <CardContent>{renderReceivedApplicationsTable()}</CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View application details dialog */}
        <Dialog open={!!viewingApplication} onOpenChange={(open) => !open && setViewingApplication(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Application details</DialogTitle>
              <DialogDescription>View full details of this application</DialogDescription>
            </DialogHeader>
            {viewingApplication && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Type</p>
                  <div className="mt-0.5">{getTypeBadge(viewingApplication.type)}</div>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Status</p>
                  <div className="mt-0.5">{getStatusBadge(viewingApplication.computedStatus, viewingApplication.displayStatus)}</div>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">Date</p>
                  <p className="text-foreground">{formatDate(viewingApplication.createdAt)}</p>
                </div>
                {activeTab === "sent" ? (
                  <>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Recipient</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-to-br from-red-600 to-red-700 text-white text-xs">
                            {getInitials(viewingApplication.recipientName || "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{viewingApplication.recipientName || "—"}</p>
                          <p className="text-muted-foreground">{viewingApplication.recipientEmail || viewingApplication.recipientRole || "—"}</p>
                        </div>
                      </div>
                    </div>
                    {viewingApplication.teamName && (
                      <div>
                        <p className="font-medium text-muted-foreground mb-1">Team</p>
                        <p className="text-foreground">{viewingApplication.teamName}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">From</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                            {getInitials(viewingApplication.senderName || "U")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{viewingApplication.senderName || "—"}</p>
                          <p className="text-muted-foreground">{viewingApplication.senderEmail || viewingApplication.senderRole || "—"}</p>
                        </div>
                      </div>
                    </div>
                    {viewingApplication.teamName && (
                      <div>
                        <p className="font-medium text-muted-foreground mb-1">Team</p>
                        <p className="text-foreground">{viewingApplication.teamName}</p>
                      </div>
                    )}
                  </>
                )}
                {viewingApplication.problemStatementTitle && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Problem Statement</p>
                    <p className="text-foreground">{viewingApplication.problemStatementTitle}</p>
                  </div>
                )}
                {viewingApplication.message && (
                  <div>
                    <p className="font-medium text-muted-foreground mb-1">Message</p>
                    <p className="text-foreground whitespace-pre-wrap">{viewingApplication.message}</p>
                  </div>
                )}
                {activeTab === "received" && viewingApplication.type === "team_invitation" && viewingApplication.senderId && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFounderProfileId(viewingApplication.senderId!);
                        setShowFounderProfile(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View founder profile
                    </Button>
                    {viewingApplication.founderProblemStatement && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setViewingPs(viewingApplication.founderProblemStatement!);
                          setViewingPsFounderName(viewingApplication.senderName || "Founder");
                          setShowPsOverview(true);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View problem statement
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <FounderProfileModal
          open={showFounderProfile}
          onClose={() => { setShowFounderProfile(false); setFounderProfileId(null); }}
          founderId={founderProfileId}
        />
        <ProblemStatementOverviewModal
          open={showPsOverview}
          onClose={() => { setShowPsOverview(false); setViewingPs(null); setViewingPsFounderName(""); }}
          problemStatement={viewingPs}
          founderName={viewingPsFounderName || undefined}
        />
      </div>
    </AppLayout>
  );
}
