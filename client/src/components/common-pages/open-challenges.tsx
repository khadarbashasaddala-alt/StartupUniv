import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProblemStatementModal from "@/components/ProblemStatementModal";
import { FounderProfileModal } from "@/components/FounderProfileModal";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Eye, FileText } from "lucide-react";
import { Link } from "wouter";

export default function OpenChallengesPage() {
  const { user } = useAuth();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { startPageTourIfFirst(user?.role === "COFOUNDER" ? "cf-open-challenges" : user?.role === "MENTOR" ? "m-open-challenges" : "open-challenges"); }, [user?.role]);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"open-challenges" | "join-founder-team">("open-challenges");
  const [page, setPage] = useState(1);
  const [limit] = useState(16);
  const [selected, setSelected] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFounderId, setSelectedFounderId] = useState<string | null>(null);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const isLearnerOrCofounder = user?.role === "LEARNER" || user?.role === "COFOUNDER";

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

  // Check for problem statement ID in URL query params and open modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const problemStatementId = params.get('view');
    if (problemStatementId && !modalOpen && !selected) {
      // Fetch the specific problem statement
      apiRequest("GET", `/api/problem-statements/${problemStatementId}`)
        .then((item) => {
          if (item) {
            setSelected(item);
            setModalOpen(true);
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        })
        .catch((err) => {
          console.error("Failed to load problem statement:", err);
        });
    }
  }, [modalOpen, selected]);

  // If the route is /app/join-team or /app/open-challenges/join-founder-team, open the "View founder's problem statement" tab
  useEffect(() => {
    if (location && (location === "/app/join-team" || location.startsWith("/app/open-challenges/join-founder-team"))) {
      setActiveTab("join-founder-team");
    }
  }, [location]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/problem-statements", "published", activeTab, page],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/problem-statements?status=PUBLISHED&category=${activeTab}&page=${page}&limit=${limit}`);
      return res;
    },
    enabled: !!user,
  });

  const applyMutation = useMutation({
    mutationFn: async (problemStatementId: string) => {
      return await apiRequest("POST", `/api/problem-statements/${problemStatementId}/apply`, {
        message: "",
      });
    },
    onSuccess: (_, problemStatementId) => {
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully.",
      });
      // Invalidate all related queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", "published"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", "published", activeTab] });
      // Force refetch the current page data to update the UI immediately
      queryClient.refetchQueries({ queryKey: ["/api/problem-statements", "published", activeTab, page] });
      queryClient.invalidateQueries({ queryKey: ["/api/problem-statements", problemStatementId] });
    },
    onError: (error: any) => {
      toast({
        title: "Application Failed",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const items: any[] = data?.items || [];
  const total: number = data?.total || 0;
  
  // Filter out seed/placeholder problem statements (those with very short or empty overviews)
  const filterRealProblemStatements = (items: any[]) => {
    return items.filter(item => {
      // Only show problem statements with meaningful content
      const hasContent = item.overview && item.overview.trim().length > 20;
      const hasTitle = item.title && item.title.trim().length > 0;
      return hasContent && hasTitle;
    });
  };

  const realItems = filterRealProblemStatements(items);
  const totalPages = Math.max(1, Math.ceil(realItems.length / limit));
  const isInTeam = Boolean(myTeam);
  const canApply = isLearnerOrCofounder && !isInTeam;

  const openModal = (item: any) => {
    setSelected(item);
    setModalOpen(true);
  };
  const closeModal = () => {
    setSelected(null);
    setModalOpen(false);
  };

  const viewDetails = (item: any) => {
    // Open modal instead of navigating
    setSelected(item);
    setModalOpen(true);
  };

  const handleApply = (item: any) => {
    if (item.userApplication) {
      toast({
        title: "Already Applied",
        description: "You have already applied to this problem statement.",
      });
      return;
    }
    // Only block interns when intern count >= 7
    if (item.learnerApplicationCount >= 7 && user?.role === "LEARNER") {
      toast({
        title: "Application Limit Reached",
        description: "This problem statement has reached the maximum number of learner applications.",
        variant: "destructive",
      });
      return;
    }
    // Only block co-founders when co-founder count >= 2
    if (item.cofounderApplicationCount >= 2 && user?.role === "COFOUNDER") {
      toast({
        title: "Application Limit Reached",
        description: "This problem statement has reached the maximum number of co-founder applications.",
        variant: "destructive",
      });
      return;
    }
    // Co-founders can apply even if learner count >= 7
    applyMutation.mutate(item.id);
  };

  const isAdmin = user?.role === "ADMIN";

  // Fetch taken problem statements for admin
  const { data: takenStatements, isLoading: takenLoading } = useQuery({
    queryKey: ["/api/problem-statements", "taken"],
    queryFn: async () => {
      const allPublished = await apiRequest("GET", `/api/problem-statements?status=PUBLISHED`);
      const taken: any[] = [];
      for (const stmt of allPublished) {
        const learnerCount = stmt.learnerApplicationCount || 0;
        if (learnerCount >= 7) {
          taken.push(stmt);
        }
      }
      return taken;
    },
    enabled: !!isAdmin && !!user,
  });

  return (
    <AppLayout title="Challenges">
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div />
          <PageTourButton pageKey={user?.role === "COFOUNDER" ? "cf-open-challenges" : user?.role === "MENTOR" ? "m-open-challenges" : "open-challenges"} />
        </div>
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as "open-challenges" | "join-founder-team");
          setPage(1);
        }}>
          <TabsList className="mb-6" data-tour="m-pg-oc-tabs">
            <TabsTrigger value="open-challenges" data-tour="oc-tab-open">Open Challenges</TabsTrigger>
            <TabsTrigger value="join-founder-team" data-tour="oc-tab-founder">View founder&apos;s problem statement</TabsTrigger>
          </TabsList>

          <TabsContent value="open-challenges">
            <h2 className="text-2xl font-semibold mb-6" data-tour="m-pg-oc-heading">Open Challenges</h2>
            <p className="text-muted-foreground mb-6">
              Problem statements uploaded by Admin and Mentors
            </p>

            {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: limit }).map((_, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">Failed to load Open Challenges.</p>
            <div className="mt-4">
              <Button onClick={() => window.location.reload()} className="bg-primary hover:bg-primary/90 text-primary-foreground">Retry</Button>
            </div>
          </div>
        ) : realItems.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No published challenges found</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {realItems.map((item, itemIdx) => (
                <Card key={item.id} className="flex flex-col" data-tour={itemIdx === 0 ? "m-pg-oc-card" : undefined}>
                  <CardHeader>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {item.isTaken && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                          Taken
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      By{" "}
                      {item.creator?.id ? (
                        <button
                          onClick={() => {
                            setSelectedFounderId(item.creator.id);
                            setShowFounderModal(true);
                          }}
                          className="text-primary hover:text-primary/90 hover:underline font-medium cursor-pointer transition-colors"
                        >
                          {item.creator.name}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{item.createdBy || "Unknown"}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">{new Date(item.createdAt).toLocaleDateString()}</p>
                    {item.status === "PUBLISHED" && !item.isTaken && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {item.learnerApplicationCount || 0} interns, {item.cofounderApplicationCount || 0} co-founders applied
                      </p>
                    )}
                    <CardDescription>
                      <div className="overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3 as any, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                        {item.overview}
                      </div>
                    </CardDescription>
                  </CardContent>
                  <div className="p-4 pt-0 flex gap-2">
                    <Button
                      onClick={() => viewDetails(item)}
                      variant="outline"
                      className="flex-1"
                      data-tour={itemIdx === 0 ? "m-pg-oc-view-btn" : undefined}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    {/* Temporarily commented out - Apply button
                    {canApply && !item.isTaken && !item.userApplication && (
                      <Button 
                        onClick={() => handleApply(item)}
                        disabled={
                          applyMutation.isPending || 
                          (user?.role === "LEARNER" && item.learnerApplicationCount >= 7) ||
                          (user?.role === "COFOUNDER" && item.cofounderApplicationCount >= 2)
                        }
                        className="bg-red-600 hover:bg-red-700 text-white flex-1"
                      >
                        {applyMutation.isPending ? "Applying..." : "Apply"}
                      </Button>
                    )}
                    {canApply && !item.isTaken && item.userApplication && (
                      <Button 
                        disabled
                        variant="secondary"
                        className="flex-1"
                      >
                        Applied
                      </Button>
                    )}
                    */}
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination (only when more items than page size) */}
            {realItems.length > limit && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="bg-red-600 hover:bg-red-700 text-white disabled:bg-muted disabled:text-muted-foreground">Previous</Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="bg-red-600 hover:bg-red-700 text-white disabled:bg-muted disabled:text-muted-foreground">Next</Button>
              </div>
            )}
          </>
        )}
          </TabsContent>

          <TabsContent value="join-founder-team">
            <h2 className="text-2xl font-semibold mb-2">View founder&apos;s problem statement</h2>
            <p className="text-muted-foreground mb-6">
              {myTeam?.problemStatementId
                ? "You are in a team. View your team's problem statement below or browse other founder problem statements."
                : "Problem statements uploaded by founders. Apply to join a founder's team."}
            </p>

            {/* When user is in a team with a problem statement, show direct link to view it */}
            {isLearnerOrCofounder && myTeam?.problemStatementId && (
              <Card className="mb-6 border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Your team&apos;s problem statement
                  </CardTitle>
                  <CardDescription>
                    You have joined a founder&apos;s team. View the problem statement your team is working on.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/app/problem">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Eye className="h-4 w-4 mr-2" />
                      View founder&apos;s problem statement
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: limit }).map((_, idx) => (
                  <Card key={idx}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive">Failed to load founder problem statements.</p>
                <div className="mt-4">
                  <Button onClick={() => window.location.reload()} className="bg-primary hover:bg-primary/90 text-primary-foreground">Retry</Button>
                </div>
              </div>
            ) : realItems.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No founder problem statements found</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {realItems.map((item) => (
                    <Card key={item.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {item.isTaken && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              Taken
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          By{" "}
                          {item.creator?.id ? (
                            <button
                              onClick={() => {
                                setSelectedFounderId(item.creator.id);
                                setShowFounderModal(true);
                              }}
                              className="text-primary hover:text-primary/90 hover:underline font-medium cursor-pointer transition-colors"
                            >
                              {item.creator.name}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">{item.createdBy || "Unknown"}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">{new Date(item.createdAt).toLocaleDateString()}</p>
                        {item.status === "PUBLISHED" && !item.isTaken && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {item.learnerApplicationCount || 0} interns, {item.cofounderApplicationCount || 0} co-founders applied
                          </p>
                        )}
                        <CardDescription>
                          <div className="overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3 as any, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                            {item.overview}
                          </div>
                        </CardDescription>
                      </CardContent>
                      <div className="p-4 pt-0 flex gap-2">
                        <Button 
                          onClick={() => viewDetails(item)} 
                          variant="outline"
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        {/* Temporarily commented out - Apply button
                        {canApply && !item.isTaken && !item.userApplication && (
                          <Button 
                            onClick={() => handleApply(item)}
                            disabled={
                              applyMutation.isPending || 
                              (user?.role === "LEARNER" && item.learnerApplicationCount >= 7) ||
                              (user?.role === "COFOUNDER" && item.cofounderApplicationCount >= 2)
                            }
                            className="bg-red-600 hover:bg-red-700 text-white flex-1"
                          >
                            {applyMutation.isPending ? "Applying..." : "Apply"}
                          </Button>
                        )}
                        {canApply && !item.isTaken && item.userApplication && (
                          <Button 
                            disabled
                            variant="secondary"
                            className="flex-1"
                          >
                            Applied
                          </Button>
                        )}
                        */}
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Pagination (only when more items than page size) */}
                {realItems.length > limit && (
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="bg-red-600 hover:bg-red-700 text-white disabled:bg-muted disabled:text-muted-foreground">Previous</Button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="bg-red-600 hover:bg-red-700 text-white disabled:bg-muted disabled:text-muted-foreground">Next</Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Taken Problem Statements Section (Admin Only) */}
        {isAdmin && (
          <div className="mt-8">
            <h2 className="text-2xl font-semibold mb-4">Taken Problem Statements</h2>
            <p className="text-muted-foreground mb-6">
              Problem statements that have reached the maximum number of learner applications (7)
            </p>
            {takenLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Card key={idx}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : takenStatements && takenStatements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {takenStatements.map((item) => (
                  <Card key={item.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-sm text-muted-foreground">
                        By{" "}
                        {item.creator?.id ? (
                          <button
                            onClick={() => {
                              setSelectedFounderId(item.creator.id);
                              setShowFounderModal(true);
                            }}
                            className="text-primary hover:text-primary/90 hover:underline font-medium cursor-pointer transition-colors"
                          >
                            {item.creator.name}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">{item.createdBy || "Unknown"}</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground mb-2">{new Date(item.createdAt).toLocaleDateString()}</p>
                      <CardDescription>
                        <div className="overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3 as any, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                          {item.overview}
                        </div>
                      </CardDescription>
                      <div className="mt-2 text-sm">
                        <Badge variant="secondary">Interns: {item.learnerApplicationCount || 0}/7</Badge>
                      </div>
                    </CardContent>
                    <div className="p-4 pt-0">
                      <Button 
                        onClick={() => openModal(item)} 
                        variant="outline"
                        className="w-full"
                      >
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No taken problem statements found</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <ProblemStatementModal open={modalOpen} onClose={closeModal} statement={selected} />
        <FounderProfileModal
          open={showFounderModal}
          onClose={() => {
            setShowFounderModal(false);
            setSelectedFounderId(null);
          }}
          founderId={selectedFounderId}
        />
      </div>
    </AppLayout>
  );
}
