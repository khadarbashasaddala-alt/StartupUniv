import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { CoFounderTour } from "@/components/CoFounderTour/index";
import { CoFounderPageGuide } from "@/components/CoFounderTour/CoFounderPageGuide";
import { MentorTour } from "@/components/MentorTour/index";
import { MentorPageGuide } from "@/components/MentorPageGuide/index";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  KanbanSquare,
  ListTodo,
  Users,
  FileText,
  Lightbulb,
  Calendar,
  IndianRupee,
  BarChart3,
  Settings,
  ClipboardList,
  Rocket,
  LogOut,
  Bell,
  Briefcase,
  SendHorizontal,
  FolderKanban,
  BookOpen,
  MessageSquare,
  TicketIcon,
  MessagesSquare,
  HelpCircle,
  ClipboardCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TourEngine } from "@/components/tour/TourEngine";
import { TourProvider } from "@/components/tour/TourContext";
import { SidebarTour } from "@/components/tour/SidebarTour";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  headerAction?: React.ReactNode;
}

export function AppLayout({ children, title, headerAction }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const [platformTourVisible, setPlatformTourVisible] = useState(() => {
    const key = user?.id ? `sv_platform_tour_disabled_${user.id}` : null;
    return key ? localStorage.getItem(key) !== "true" : true;
  });

  useEffect(() => {
    if (!user?.id) return;
    const key = `sv_platform_tour_disabled_${user.id}`;
    // Sync initial value when userId becomes available
    setPlatformTourVisible(localStorage.getItem(key) !== "true");

    const handler = () => {
      setPlatformTourVisible(localStorage.getItem(key) !== "true");
    };
    window.addEventListener("platform-tour-visibility-changed", handler);
    return () => window.removeEventListener("platform-tour-visibility-changed", handler);
  }, [user?.id]);

  // Get avatar URL if user has one
  const { data: userAvatar } = useQuery({
    queryKey: ["user-avatar", user?.id, user?.avatarUrl],
    queryFn: async () => {
      if (!user?.avatarUrl) return null;
      const data = await apiRequest("GET", `/api/auth/profile/detailed`);
      return data.avatarUrl || null;
    },
    enabled: !!user?.id && !!user?.avatarUrl,
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Main navigation items for interns
  const mainNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app", sidebarTourId: "dashboard" },
    // Hidden for learners, commented rather than deleted so it can be put back in one line.
    // A learner on a capstone cohort is placed on a team with a problem statement already
    // assigned, so browsing and applying to other challenges is not part of their route through
    // the programme. Mentors, founders, co-founders and admins keep theirs, and the routes still
    // work for anyone who navigates to them directly.
    // { icon: Lightbulb, label: "Open Challenges", href: "/app/open-challenges", sidebarTourId: "open-challenges" },
    { icon: KanbanSquare, label: "Sprint Board", href: "/app/sprint-board", sidebarTourId: "sprint-board" },
    { icon: ListTodo, label: "Tasks", href: "/app/tasks", sidebarTourId: "tasks" },
    { icon: Users, label: "Team", href: "/app/my-team", sidebarTourId: "my-team" },
    { icon: Calendar, label: "Meetings", href: "/app/my-meetings", sidebarTourId: "meetings" },
    // Hidden for learners along with Open Challenges above — with nothing to apply to, the page
    // only ever showed "No sent applications". Other roles keep it.
    // { icon: SendHorizontal, label: "Applications", href: "/app/applications", sidebarTourId: "applications" },
    { icon: Bell, label: "Notifications", href: "/app/notifications", sidebarTourId: "notifications" },
    { icon: FileText, label: "Evidence", href: "/app/evidence", sidebarTourId: "evidence" },
    { icon: BookOpen, label: "Learning Hub", href: "/app/learning", sidebarTourId: "learning-hub" },
    { icon: TicketIcon, label: "Tickets", href: "/app/tickets" },
    { icon: MessagesSquare, label: "Team Chat", href: "/app/team-chat" },
    { icon: Rocket, label: "Roles & Responsibilities", href: "/app/roles" },
  ];

  // Mentor-specific navigation
  const mentorNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    // Hidden for mentors, commented rather than deleted so it can be put back in one line.
    // A mentor is assigned to their team's problem statement directly; browsing and applying to
    // other challenges isn't part of their route through the programme. The route still works if
    // a mentor navigates to it directly.
    // { icon: Lightbulb, label: "Open Challenges", href: "/app/open-challenges" },
    { icon: Lightbulb, label: "Problem Statement", href: "/app/problem" },
    { icon: KanbanSquare, label: "Sprint Board", href: "/app/sprint-board" },
    { icon: ListTodo, label: "Tasks", href: "/app/tasks" },
    { icon: Users, label: "Team", href: "/app/team" },
    { icon: Calendar, label: "Meetings", href: "/app/my-meetings" },
    // Hidden along with Open Challenges above — mentors have no team-invitation flow to track
    // here; that page is empty for them.
    // { icon: SendHorizontal, label: "Applications", href: "/app/applications" },
    { icon: FileText, label: "Evidence", href: "/app/evidence" },
    { icon: ClipboardCheck, label: "To Review", href: "/app/evidence/review" },
    { icon: Rocket, label: "Roles & Responsibilities", href: "/app/roles" },
    { icon: TicketIcon, label: "Tickets", href: "/app/tickets" },
    { icon: MessagesSquare, label: "Team Chat", href: "/app/team-chat" },
  ];

  // Founder navigation items
  const founderNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app", tourId: "dashboard", sidebarTourId: "dashboard" },
    { icon: Lightbulb, label: "Problem Statements", href: "/app/problem-statements", tourId: "nav-problem-statements", sidebarTourId: "problem-statements" },
    { icon: Lightbulb, label: "Open Challenges", href: "/app/open-challenges", tourId: "nav-open-challenges", sidebarTourId: "open-challenges" },
    { icon: Users, label: "My Team", href: "/app/my-team", tourId: "nav-my-team", sidebarTourId: "my-team" },
    { icon: SendHorizontal, label: "Applications", href: "/app/applications", tourId: "nav-applications", sidebarTourId: "applications" },
    { icon: IndianRupee, label: "My Fees", href: "/app/my-fees" },
    { icon: KanbanSquare, label: "Sprint Board", href: "/app/sprint-board", tourId: "nav-sprint-board", sidebarTourId: "sprint-board" },
    { icon: ListTodo, label: "Tasks", href: "/app/tasks", tourId: "nav-tasks", sidebarTourId: "tasks" },
    { icon: Calendar, label: "Meetings", href: "/app/my-meetings", tourId: "nav-meetings", sidebarTourId: "meetings" },
    { icon: FileText, label: "Evidence", href: "/app/evidence", tourId: "nav-evidence", sidebarTourId: "evidence" },
    { icon: ClipboardCheck, label: "To Review", href: "/app/evidence/review" },
    { icon: BookOpen, label: "Learning Hub", href: "/app/learning", tourId: "nav-learning-hub", sidebarTourId: "learning-hub" },
    { icon: TicketIcon, label: "Tickets", href: "/app/tickets" },
    { icon: MessagesSquare, label: "Team Chat", href: "/app/team-chat" },
    { icon: Rocket, label: "Roles & Responsibilities", href: "/app/roles" },
  ];
  // Co-Founder Nav Items
  const coFounderNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    { icon: Lightbulb, label: "Open Challenges", href: "/app/open-challenges" },
    { icon: SendHorizontal, label: "Applications", href: "/app/applications" },
    { icon: IndianRupee, label: "My Fees", href: "/app/my-fees" },
    { icon: Users, label: "My Team", href: "/app/my-team" },
    { icon: Lightbulb, label: "Problem Statements", href: "/app/problem-statements" },
    { icon: Calendar, label: "Meetings", href: "/app/my-meetings" },
    { icon: KanbanSquare, label: "Sprint Board", href: "/app/sprint-board" },
    { icon: ListTodo, label: "Tasks", href: "/app/tasks" },
    { icon: FileText, label: "Evidence", href: "/app/evidence" },
    { icon: ClipboardCheck, label: "To Review", href: "/app/evidence/review" },
    { icon: BookOpen, label: "Learning Hub", href: "/app/learning" },
    { icon: Rocket, label: "Roles & Responsibilities", href: "/app/roles" },
    { icon: TicketIcon, label: "Tickets", href: "/app/tickets" },
    { icon: MessagesSquare, label: "Team Chat", href: "/app/team-chat" },
  ];

  // Resources navigation items
  const resourcesNavItems = [
    { icon: Lightbulb, label: "Problem Statement", href: "/app/problem", sidebarTourId: "problem-statement" },
    { icon: Calendar, label: "Schedule", href: "/app/schedule", sidebarTourId: "schedule" },
    // Stipends hidden. This group renders for learners only, so nothing else is affected.
    // { icon: IndianRupee, label: "Stipends", href: "/app/stipends", sidebarTourId: "stipends" },
    { icon: BarChart3, label: "Analytics", href: "/app/analytics", sidebarTourId: "analytics" },
  ];

  // Intern navigation items (Assessments removed)
  const learnerNavItems = [
    ...mainNavItems,
    // My Fees hidden for learners. Founders and co-founders keep theirs, since their lists carry
    // their own entry rather than inheriting this one.
    // { icon: IndianRupee, label: "My Fees", href: "/app/my-fees" },
  ];

  // Admin navigation items
  const adminNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    { icon: FolderKanban, label: "Cohorts", href: "/app/admin/cohorts" },
    { icon: Lightbulb, label: "Open Challenges", href: "/app/open-challenges" },
    { icon: Bell, label: "Notifications", href: "/app/admin/notifications" },
    { icon: Users, label: "Users", href: "/app/admin/users" },
    { icon: FileText, label: "Applications", href: "/app/admin/applications" },
    { icon: IndianRupee, label: "Fee Tracker", href: "/app/admin/fee-tracker" },
    { icon: Users, label: "Team Applications", href: "/app/admin/team-applications" },
    { icon: Briefcase, label: "Job Postings", href: "/app/admin/job-postings" },
    { icon: ClipboardList, label: "Assessments", href: "/app/admin/assessments" },
    { icon: Lightbulb, label: "Problem Statements", href: "/app/problem-statements" },
    { icon: KanbanSquare, label: "Sprint Board", href: "/app/sprint-board" },
    { icon: Users, label: "Teams", href: "/app/team" },
    { icon: Calendar, label: "Meetings", href: "/app/my-meetings" },
    { icon: FileText, label: "Evidence", href: "/app/evidence" },
    // No "To Review" for admins: an admin reviews from the sprint board, where the
    // submissions sit beside the task they belong to. The queue exists because a mentor
    // spans several teams and has no single board showing everything waiting on them.
    // The route still works if an admin navigates to it directly.
    { icon: BarChart3, label: "Analytics", href: "/app/analytics" },
    { icon: MessageSquare, label: "Chatbot Enquiries", href: "/app/admin/chatbot-enquiries" },
    { icon: TicketIcon, label: "Tickets", href: "/app/tickets" },
    { icon: MessagesSquare, label: "Team Chat", href: "/app/team-chat" },
    { icon: Rocket, label: "Roles & Responsibilities", href: "/app/roles" },
  ];

  // Manager navigation items
  const managerNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app" },
    { icon: Bell, label: "Notifications", href: "/app/manager/notifications" },
    { icon: FileText, label: "Applications", href: "/app/manager/applications" },
    { icon: Users, label: "Team Applications", href: "/app/manager/team-applications" },
    { icon: ClipboardList, label: "Assessments", href: "/app/manager/assessments" },
    { icon: Users, label: "Mentors", href: "/app/manager/mentors" },
    { icon: TicketIcon, label: "Tickets", href: "/app/tickets" },
    { icon: MessagesSquare, label: "Team Chat", href: "/app/team-chat" },
  ];

  // Determine which nav items to show based on user role
  const getNavItems = () => {
    if (user?.role === "ADMIN") {
      return adminNavItems;
    }
    if (user?.role === "MANAGER") {
      return managerNavItems;
    }
    if (user?.role === "LEARNER") {
      return learnerNavItems;
    }
    if (user?.role === "FOUNDER") {
      return founderNavItems;
    }
    if (user?.role === "COFOUNDER") {
      return coFounderNavItems;
    }
    if (user?.role === "MENTOR") {
      return mentorNavItems;
    }
    return mainNavItems;
  };

  const navItems = getNavItems();

  return (
    <TourProvider>
      <SidebarProvider className="flex h-screen overflow-hidden">
        <CoFounderTour />
        <MentorTour />
        <CoFounderPageGuide />
        <MentorPageGuide />
        {/* Sidebar + main content are laid out side-by-side by SidebarProvider's flex wrapper */}
        {/* Sidebar (non-scrollable; collapses to icon rail) */}
        <Sidebar collapsible="icon" className="border-r border-sidebar-border relative z-10">
          <SidebarHeader className="border-b border-sidebar-border shrink-0 overflow-visible">
            {/* When expanded: show full logo; when collapsed to icon: show favicon only */}
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2.5 w-full min-w-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              {/* Collapsed: favicon icon */}
              <img
                src="/favicon.png"
                alt="StartupUniv Icon"
                className="h-9 w-9 shrink-0 hidden group-data-[collapsible=icon]:block"
              />
              {/* Expanded: full logo image + text */}
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                <img src="/logo.png" alt="StartupUniv Logo" className="h-9 w-auto shrink-0" />
                <span className="font-bold text-lg text-[#1e293b] truncate">
                  StartupUniv
                </span>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>

          {/* Main Navigation */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== "/app" && location.startsWith(item.href));
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={`rounded-xl transition-all duration-300 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border" : "hover:bg-sidebar-accent/80 border border-transparent"}`}>
                        <button onClick={() => setLocation(item.href)} className="flex items-center gap-2 w-full" {...("tourId" in item && item.tourId ? { "data-tour": item.tourId } : {})} {...("sidebarTourId" in item && item.sidebarTourId ? { "data-sidebar-tour": item.sidebarTourId } : {})}>
                          <item.icon className="h-4 w-4 text-sidebar-foreground" />
                          <span className={isActive ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground"}>{item.label}</span>
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Resources Section (for interns) */}
          {user?.role === "LEARNER" && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-muted-foreground">Resources</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {resourcesNavItems.map((item) => {
                    const isActive = location === item.href || location.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={`rounded-xl transition-all duration-300 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border" : "hover:bg-sidebar-accent/80 border border-transparent"}`}>
                          <button onClick={() => setLocation(item.href)} className="flex items-center gap-2 w-full" {...("sidebarTourId" in item && item.sidebarTourId ? { "data-sidebar-tour": item.sidebarTourId } : {})}>

                            <item.icon className="h-4 w-4 text-sidebar-foreground" />
                            <span className={isActive ? "font-semibold text-sidebar-foreground" : "text-sidebar-foreground"}>{item.label}</span>
                          </button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          </SidebarContent>
          <SidebarFooter className="border-t border-sidebar-border">
            {/* User Profile with Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-3 px-2 py-2 w-full rounded-md hover:bg-sidebar-accent/80 transition-all duration-300 border border-sidebar-border bg-sidebar group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                >
                  <Avatar>
                    {userAvatar ? (
                      <AvatarImage src={userAvatar} alt="Profile picture" />
                    ) : null}
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                      {getInitials(user?.name || "U")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate text-sidebar-foreground">{user?.name}</p>
                    <p className="text-xs text-sidebar-foreground/80 truncate">{user?.role}</p>
                    {user?.customTag && (user.role === "LEARNER" || user.role === "MENTOR") && (
                      <span className="mt-0.5 inline-block max-w-full truncate rounded-full border border-amber-300 bg-amber-100 px-1.5 py-px text-[10px] font-medium leading-4 text-amber-800">
                        {user.customTag}
                      </span>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-2xl">
                  <DropdownMenuLabel className="text-foreground">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="hover:bg-accent focus:bg-accent cursor-pointer" onClick={() => setLocation("/app/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await logout();
                      window.location.href = "/login";
                    }}
                    className="cursor-pointer text-destructive hover:bg-accent focus:bg-accent"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </Sidebar>

          {/* Main Content (only this area scrolls) */}
          <SidebarInset className="bg-background flex-1 overflow-hidden">
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-4">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="text-foreground hover:text-primary transition-colors" />
                {title && <h1 className="text-xl font-semibold text-foreground">{title}</h1>}
              </div>
              {headerAction && <div className="flex items-center">{headerAction}</div>}
            </header>
            <div className="flex-1 overflow-auto p-6 bg-background">{children}</div>
          </SidebarInset>
      {(user?.role === "FOUNDER" || user?.role === "COFOUNDER" || user?.role === "MENTOR" || user?.role === "LEARNER") && <TourEngine />}
      {(user?.role === "FOUNDER" || user?.role === "LEARNER") && <SidebarTour />}
    </SidebarProvider>
  </TourProvider>
  );
}
