import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  Search,
  Eye,
  Crown,
  TrendingUp,
  GraduationCap,
  Loader2,
  Users,
} from "lucide-react";
import { format } from "date-fns";

interface Application {
  id: string;
  name: string;
  email: string;
  type: string;
  status: string;
  createdAt: string;
  userId?: string | null; // Set when credentials are created
  formData?: any;
  selectedCohort?: { id: string; name: string } | null;
}

export default function AdminApplicationsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState<"FOUNDER" | "COFOUNDER" | "LEARNER" | "TEAM" | "MENTOR">("FOUNDER");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: applications, isLoading, error, refetch } = useQuery<Application[]>({
    queryKey: ["/api/admin/applications", selectedTab, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("type", selectedTab);
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const data = await apiRequest("GET", `/admin/applications?${params.toString()}`);
      // Show all applications that need admin attention (excluding only fully processed ones)
      // Include: NEW, PENDING, UNDER_REVIEW, OFFER, PARTIALLY_PAID, PAID
      // Exclude: REJECTED, and ACCEPTED only if credentials are created (userId exists)
      return data.filter((app: Application) => 
        app.status === "NEW" || 
        app.status === "PENDING" || 
        app.status === "UNDER_REVIEW" ||
        app.status === "REVIEW" ||
        app.status === "OFFER" ||
        app.status === "PARTIALLY_PAID" ||
        app.status === "PAID" ||
        (app.status === "ACCEPTED" && !app.userId) // Show ACCEPTED only if credentials not created yet
      );
    },
    enabled: !!user,
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "NEW":
        return "default";
      case "PENDING":
      case "UNDER_REVIEW":
        return "secondary";
      case "OFFER":
        return "outline";
      case "PARTIALLY_PAID":
        return "default";
      case "ACCEPTED":
        return "default";
      case "REJECTED":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return format(date, "MMM d, yyyy");
  };

  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">Failed to load applications. Please try again.</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Applications Management</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all applications by type
          </p>
        </div>

        <Card className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="relative">
            <CardTitle className="text-foreground">Applications</CardTitle>
            <CardDescription className="text-slate-700">
              Filter applications by type and search by name, email, or application ID
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as any)}>
              <div className="flex items-center justify-between mb-6">
                <TabsList className="bg-muted border-border">
                  <TabsTrigger 
                    value="FOUNDER" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                  >
                    <Crown className="h-4 w-4" />
                    Founder
                  </TabsTrigger>
                  <TabsTrigger 
                    value="COFOUNDER" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                  >
                    <TrendingUp className="h-4 w-4" />
                    Co-Founder
                  </TabsTrigger>
                  <TabsTrigger 
                    value="LEARNER" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                  >
                    <GraduationCap className="h-4 w-4" />
                    Intern
                  </TabsTrigger>
                  <TabsTrigger 
                    value="TEAM" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                  >
                    <Users className="h-4 w-4" />
                    Team
                  </TabsTrigger>
                  <TabsTrigger 
                    value="MENTOR" 
                    className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold text-foreground font-semibold"
                  >
                    <Users className="h-4 w-4" />
                    Mentor
                  </TabsTrigger>
                </TabsList>
                <div className="flex-1 max-w-sm ml-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email, or ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <TabsContent value="FOUNDER" className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : applications && applications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {applications.map((app) => (
                      <Card key={app.id} className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="pt-6 relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-slate-900">{app.name}</h3>
                              <p className="text-sm text-slate-700">{app.email}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(app.status)}>
                              {app.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                            <span>{formatTimeAgo(app.createdAt)}</span>
                          </div>
                          <Button
                            className="w-full border-primary text-primary hover:bg-accent"
                            variant="outline"
                            onClick={() => setLocation(`/app/admin/applications/${app.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No {selectedTab.toLowerCase()} applications found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="COFOUNDER" className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : applications && applications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {applications.map((app) => (
                      <Card key={app.id} className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="pt-6 relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-slate-900">{app.name}</h3>
                              <p className="text-sm text-slate-700">{app.email}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(app.status)}>
                              {app.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                            <span>{formatTimeAgo(app.createdAt)}</span>
                          </div>
                          <Button
                            className="w-full border-primary text-primary hover:bg-accent"
                            variant="outline"
                            onClick={() => setLocation(`/app/admin/applications/${app.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No co-founder applications found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="LEARNER" className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : applications && applications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {applications.map((app) => (
                      <Card key={app.id} className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="pt-6 relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-slate-900">{app.name}</h3>
                              <p className="text-sm text-slate-700">{app.email}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(app.status)}>
                              {app.status}
                            </Badge>
                          </div>
                          {app.selectedCohort && (
                            <div className="mb-3">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Cohort: {app.selectedCohort.name}
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                            <span>{formatTimeAgo(app.createdAt)}</span>
                          </div>
                          <Button
                            className="w-full border-primary text-primary hover:bg-accent"
                            variant="outline"
                            onClick={() => setLocation(`/app/admin/applications/${app.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No intern applications found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="TEAM" className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : applications && applications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {applications.map((app) => (
                      <Card key={app.id} className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="pt-6 relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-slate-900">{app.name}</h3>
                              <p className="text-sm text-slate-700">{app.email}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(app.status)}>
                              {app.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                            <span>{formatTimeAgo(app.createdAt)}</span>
                          </div>
                          <Button
                            className="w-full border-primary text-primary hover:bg-accent"
                            variant="outline"
                            onClick={() => setLocation(`/app/admin/applications/${app.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No {selectedTab.toLowerCase()} applications found</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="MENTOR" className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : applications && applications.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {applications.map((app) => (
                      <Card key={app.id} className="relative overflow-hidden bg-card backdrop-blur-xl border border-border before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:rounded-2xl shadow-xl rounded-2xl hover:shadow-2xl transition-shadow">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <CardContent className="pt-6 relative">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-slate-900">{app.name}</h3>
                              <p className="text-sm text-slate-700">{app.email}</p>
                              {app.formData?.jobTitle && (
                                <p className="text-xs text-slate-500 mt-1">Applied for: {app.formData.jobTitle}</p>
                              )}
                            </div>
                            <Badge variant={getStatusBadgeVariant(app.status)}>
                              {app.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm text-slate-600 mb-4">
                            <span>{formatTimeAgo(app.createdAt)}</span>
                          </div>
                          <Button
                            className="w-full border-primary text-primary hover:bg-accent"
                            variant="outline"
                            onClick={() => setLocation(`/app/admin/applications/${app.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No mentor applications found</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}


