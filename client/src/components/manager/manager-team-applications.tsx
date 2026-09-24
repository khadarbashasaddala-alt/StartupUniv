import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, Users, Calendar, Search } from "lucide-react";
import { format } from "date-fns";

interface TeamApplication {
  id: string;
  type: string;
  status: string;
  formData: {
    team_name?: string;
    team_leader_full_name?: string;
    team_leader_email?: string;
    project_description?: string;
    number_of_members?: number;
  };
  teamMembers?: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
    individualApplicationId?: string | null;
  }>;
  createdAt: string;
  cohortId?: string;
  cohort?: { id: string; name: string };
}

export default function ManagerTeamApplicationsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: teamApplications, isLoading } = useQuery<TeamApplication[]>({
    queryKey: ["/api/manager/team-applications"],
    queryFn: async () => {
      const data = await apiRequest("GET", "/manager/team-applications");
      return data;
    },
    enabled: !!user,
  });

  const filteredApplications = teamApplications?.filter((app) => {
    const matchesSearch = 
      app.formData.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.formData.team_leader_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.formData.team_leader_email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "ACCEPTED": return "default";
      case "PENDING": return "secondary";
      case "REJECTED": return "destructive";
      default: return "outline";
    }
  };

  const getMemberSubmissionCount = (teamMembers?: TeamApplication["teamMembers"]) => {
    if (!teamMembers) return { submitted: 0, total: 0 };
    const submitted = teamMembers.filter(m => m.individualApplicationId).length;
    return { submitted, total: teamMembers.length };
  };

  if (isLoading) {
    return (
      <AppLayout title="Team Applications">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Team Applications</h1>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Team Applications">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Team Applications</h1>
          <Badge variant="outline" className="text-base">
            {filteredApplications.length} Applications
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="ACCEPTED">Accepted</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Team Applications Grid */}
        {filteredApplications.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredApplications.map((application) => {
              const { submitted, total } = getMemberSubmissionCount(application.teamMembers);
              
              return (
                <Card key={application.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {application.formData.team_name || "Unnamed Team"}
                        </CardTitle>
                        <CardDescription>
                          {application.formData.team_leader_full_name}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusBadgeVariant(application.status)}>
                        {application.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {submitted}/{total} members submitted applications
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Applied {format(new Date(application.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>

                    {application.formData.project_description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {application.formData.project_description}
                      </p>
                    )}

                    {application.cohort && (
                      <Badge variant="outline">
                        {application.cohort.name}
                      </Badge>
                    )}

                    <Button
                      onClick={() => setLocation(`/app/manager/team-applications/${application.id}`)}
                      className="w-full"
                      variant="outline"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No team applications found</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Team applications will appear here when submitted"}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}