import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  CheckCircle2,
  FileText,
  Lightbulb,
  Rocket,
  Target,
  Users,
} from "lucide-react";

const sponsoredChallenges = [
  {
    title: "Supply Chain Optimization",
    track: "MSME",
    status: "In Progress",
    teams: 2,
    progress: 65,
  },
  {
    title: "Digital Payment Integration",
    track: "GovTech",
    status: "Demo Ready",
    teams: 1,
    progress: 100,
  },
];

const pilotOpportunities = [
  {
    startup: "Team Phoenix",
    solution: "EduLearn Platform",
    status: "Evaluation",
  },
  {
    startup: "Team Nexus",
    solution: "GovConnect API",
    status: "Interested",
  },
];

export default function CorporateDashboard() {
  return (
    <AppLayout title="Corporate Dashboard">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground mb-8">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">TechCorp Innovation Hub</h1>
              <p className="text-primary-foreground/80">
                2 Active Challenges • 2 Pilot Evaluations
              </p>
            </div>
            <Button variant="secondary">
              Sponsor New Challenge
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Challenges</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Sponsored</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Teams Working</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">On your challenges</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Pilots</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">In evaluation</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Hires</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">From alumni</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Sponsored Challenges */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sponsored Challenges</CardTitle>
                <Button variant="outline" size="sm">
                  Add Challenge
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sponsoredChallenges.map((challenge, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium">{challenge.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`track-${challenge.track.toLowerCase()}`}>
                          {challenge.track}
                        </Badge>
                        <Badge
                          variant={challenge.status === "Demo Ready" ? "default" : "outline"}
                        >
                          {challenge.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{challenge.teams} teams</div>
                      <p className="text-xs text-muted-foreground">working on this</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{challenge.progress}%</span>
                    </div>
                    <Progress value={challenge.progress} className="h-2" />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="outline" className="flex-1">
                      View Teams
                    </Button>
                    {challenge.status === "Demo Ready" && (
                      <Button size="sm" className="flex-1">
                        Watch Demo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Pilot Opportunities */}
          <Card>
            <CardHeader>
              <CardTitle>Pilot Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pilotOpportunities.map((pilot, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{pilot.startup}</p>
                    <p className="text-sm text-muted-foreground">{pilot.solution}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={pilot.status === "Evaluation" ? "default" : "secondary"}
                    >
                      {pilot.status}
                    </Badge>
                    <Button size="sm" variant="outline">
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Demo Day Access */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Upcoming Demo Day</h3>
              <p className="text-primary-foreground/80 text-sm mb-4">
                December 20, 2024 • 10 AM IST
              </p>
              <p className="text-sm mb-4">
                Watch presentations from all teams working on your challenges.
              </p>
              <Button variant="secondary" className="w-full">
                Register for Demo Day
              </Button>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "Challenge SOW", status: "Signed" },
                { name: "IP Agreement", status: "Signed" },
                { name: "Pilot Terms", status: "Draft" },
              ].map((doc, i) => (
                <Button key={i} variant="ghost" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {doc.name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {doc.status}
                  </Badge>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full gap-2">
                <Briefcase className="h-4 w-4" />
                Post Hiring Need
              </Button>
              <Button variant="outline" className="w-full gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Provide Feedback
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
