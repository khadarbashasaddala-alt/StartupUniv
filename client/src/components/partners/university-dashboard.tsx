import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Award,
  BookOpen,
  FileText,
  GraduationCap,
  Rocket,
  Users,
} from "lucide-react";

const universityStats = {
  studentsEnrolled: 25,
  teamsFormed: 3,
  creditHours: 8,
  mouStatus: "ACTIVE",
};

const enrolledStudents = [
  { name: "Ananya Singh", role: "Promoter", team: "Team Phoenix", status: "Active" },
  { name: "Rahul Kumar", role: "Co-Promoter", team: "Team Phoenix", status: "Active" },
  { name: "Priya Sharma", role: "Member", team: "Team Nexus", status: "Active" },
  { name: "Vikram Patel", role: "Co-Promoter", team: "Team Quantum", status: "Active" },
  { name: "Neha Gupta", role: "Member", team: "Team Phoenix", status: "Active" },
];

const creditMapping = {
  programHours: 600,
  creditHours: 8,
  outcomes: [
    "Entrepreneurship fundamentals",
    "Product development lifecycle",
    "Team collaboration",
    "Market research and validation",
    "Pitch and presentation skills",
  ],
};

export default function UniversityDashboard() {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <AppLayout title="University Dashboard">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground mb-8">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">IIT Delhi Partnership</h1>
              <p className="text-primary-foreground/80">
                Cohort 2024 • {universityStats.studentsEnrolled} students enrolled
              </p>
            </div>
            <Badge className="bg-green-500 text-white">
              MoU {universityStats.mouStatus}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{universityStats.studentsEnrolled}</div>
            <p className="text-xs text-muted-foreground">Currently enrolled</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Teams</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{universityStats.teamsFormed}</div>
            <p className="text-xs text-muted-foreground">With your students</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Credit Hours</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{universityStats.creditHours}</div>
            <p className="text-xs text-muted-foreground">Mapped credits</p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">On track</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Enrolled Students */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Enrolled Students</CardTitle>
                <Button variant="outline" size="sm">
                  Export List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {enrolledStudents.map((student, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <p className="text-sm text-muted-foreground">{student.team}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{student.role}</Badge>
                      <Badge className="bg-green-500/10 text-green-600">
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-4">
                View All Students
              </Button>
            </CardContent>
          </Card>

          {/* Program Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Program Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span>Overall Cohort Progress</span>
                  <span className="font-medium">65%</span>
                </div>
                <Progress value={65} className="h-3" />

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-primary">3</div>
                    <p className="text-sm text-muted-foreground">Sprints Completed</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-primary">5</div>
                    <p className="text-sm text-muted-foreground">Sprints Remaining</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Credit Mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credit Mapping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Program Hours</span>
                  <span className="font-medium">{creditMapping.programHours}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credit Hours</span>
                  <span className="font-medium">{creditMapping.creditHours}</span>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Learning Outcomes</p>
                  <ul className="space-y-1">
                    {creditMapping.outcomes.map((outcome, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { name: "MoU Agreement", status: "Signed" },
                { name: "Credit Map", status: "Approved" },
                { name: "Progress Report Q3", status: "Available" },
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
                <Users className="h-4 w-4" />
                Refer New Students
              </Button>
              <Button variant="outline" className="w-full gap-2">
                <FileText className="h-4 w-4" />
                Request Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
