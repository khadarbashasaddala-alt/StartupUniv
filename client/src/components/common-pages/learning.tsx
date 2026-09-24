import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTourButton } from "@/components/tour/PageTourButton";
import { useTourContext } from "@/components/tour/TourContext";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Play, CalendarDays, Clock, Video, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Type for cohort task (same as dashboard uses)
type CohortTask = {
  id: string;
  cohortId: string;
  title: string;
  description: string | null;
  meetingLink: string | null;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
};

export default function LearningPage() {
  const { user } = useAuth();
  const { startPageTourIfFirst } = useTourContext();
  useEffect(() => { startPageTourIfFirst(user?.role === "COFOUNDER" ? "cf-learning-hub" : "learning-hub"); }, [user?.role]);
  // Fetch cohort tasks for the current user
  const { data: cohortTasks = [], isLoading: cohortTasksLoading } = useQuery<CohortTask[]>({
    queryKey: ["/api/my-cohort-tasks"],
    queryFn: () => apiRequest("GET", "/api/my-cohort-tasks"),
  });

  const handleStartLearning = () => {
    // Start Moodle login flow via server-side redirect (prevents hardcoding LMS URLs in the client)
    window.open("/api/lms/start", "_blank", "noopener,noreferrer");
  };

  // Sort tasks by start time
  const sortedTasks = [...cohortTasks].sort((a, b) => 
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Categorize tasks
  const now = new Date();
  const upcomingTasks = sortedTasks.filter(task => {
    const startTime = new Date(task.startTime);
    return startTime > now;
  });
  const pastTasks = sortedTasks.filter(task => {
    const endTime = new Date(task.endTime);
    return endTime < now;
  });
  const ongoingTasks = sortedTasks.filter(task => {
    const startTime = new Date(task.startTime);
    const endTime = new Date(task.endTime);
    return startTime <= now && endTime >= now;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const SessionCard = ({ 
    task, 
    status 
  }: { 
    task: CohortTask; 
    status: 'ongoing' | 'upcoming' | 'past';
  }) => {
    return (
      <Card 
        className={`relative overflow-hidden border-2 shadow-lg rounded-xl transition-all duration-300 ${
          status === 'ongoing' 
            ? 'border-green-400 bg-green-50 hover:shadow-xl' 
            : status === 'upcoming' 
              ? 'border-primary/40 bg-primary/10 hover:shadow-xl' 
              : 'border-border bg-muted/50'
        }`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {status === 'ongoing' && (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              )}
              <CardTitle className="text-lg text-foreground">{task.title}</CardTitle>
            </div>
            {status === 'ongoing' && (
              <Badge className="bg-green-500 text-white">LIVE</Badge>
            )}
            {status === 'upcoming' && (
              <Badge variant="secondary" className="bg-primary/10 text-primary">Upcoming</Badge>
            )}
            {status === 'past' && (
              <Badge variant="outline" className="text-muted-foreground">Completed</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
          )}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Start:</span>
              <span>{formatDate(task.startTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">End:</span>
              <span>{formatDate(task.endTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Time:</span>
              <span>{formatTime(task.startTime)} - {formatTime(task.endTime)}</span>
            </div>
          </div>
          {task.meetingLink && status !== 'past' && (
            <Button
              className={`w-full mt-2 ${
                status === 'ongoing' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : ''
              } text-white`}
              onClick={() => window.open(task.meetingLink!, "_blank")}
            >
              <Video className="h-4 w-4 mr-2" />
              {status === 'ongoing' ? 'Join Now' : 'Join Session'}
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout title="Learning Hub">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Learning Hub</h1>
            <p className="text-muted-foreground mt-1">
              Access your learning sessions and continue your journey
            </p>
          </div>
          <PageTourButton pageKey={user?.role === "COFOUNDER" ? "cf-learning-hub" : "learning-hub"} />
        </div>

        {/* Main Learning Card */}
        <Card className="relative overflow-hidden bg-card border border-border backdrop-blur-sm shadow-xl rounded-2xl" data-tour="learning-hub-start">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <CardHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl text-foreground">Start Your Learning Journey</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Begin with interactive modules and hands-on exercises
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground leading-relaxed">
                Ready to dive into your learning path? Access curated content, interactive tutorials, 
                and practical exercises designed to enhance your startup skills.
              </p>
              
              <Button 
                onClick={handleStartLearning}
                className="w-fit font-semibold px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                data-testid="start-learning-button"
                data-tour="start-learning-btn"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Learning
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {cohortTasksLoading && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Your Sessions
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        )}

        {/* Ongoing Sessions */}
        {!cohortTasksLoading && ongoingTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              Live Sessions
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ongoingTasks.map(task => (
                <SessionCard key={task.id} task={task} status="ongoing" />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {!cohortTasksLoading && upcomingTasks.length > 0 && (
          <div className="space-y-4" data-tour="learning-sessions-section">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Upcoming Sessions
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTasks.map(task => (
                <SessionCard key={task.id} task={task} status="upcoming" />
              ))}
            </div>
          </div>
        )}

        {/* Past Sessions */}
        {!cohortTasksLoading && pastTasks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Past Sessions
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastTasks.slice(0, 6).map(task => (
                <SessionCard key={task.id} task={task} status="past" />
              ))}
            </div>
            {pastTasks.length > 6 && (
              <p className="text-sm text-muted-foreground text-center">
                Showing 6 of {pastTasks.length} past sessions
              </p>
            )}
          </div>
        )}

        {/* No Sessions Message */}
        {!cohortTasksLoading && sortedTasks.length === 0 && (
          <Card className="bg-card border border-border shadow-lg">
            <CardContent className="py-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Sessions Available</h3>
              <p className="text-muted-foreground">
                You don't have any scheduled sessions yet. Sessions will appear here once they are created for your cohort.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
