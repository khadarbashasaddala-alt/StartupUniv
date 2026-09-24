import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
// Users (Intern, Mentor, Founder, CoFounder)
import LearnerDashboard from "@/components/users/learner-dashboard";
import MentorDashboard from "@/components/users/mentor-dashboard";
import FounderDashboard from "@/components/users/founder-dashboard";
import CoFounderDashboard from "@/components/users/cofounder-dashboard";
import FounderApplicationsPage from "@/components/users/founder-applications";
// Partners (University, Corporate)
import UniversityDashboard from "@/components/partners/university-dashboard";
import CorporateDashboard from "@/components/partners/corporate-dashboard";
// Admin
import AdminDashboard from "@/components/admin/admin-dashboard";
import AdminUsersPage from "@/components/admin/admin-users";
import AdminUserDetailPage from "@/components/admin/admin-user-detail";
import AdminAssessmentsPage from "@/components/admin/admin-assessments";
import AdminApplicationsPage from "@/components/admin/admin-applications";
import AdminApplicationDetailPage from "@/components/admin/admin-application-detail";
import AdminPaymentDetailsPage from "@/components/admin/admin-payment-details";
import AdminTeamApplicationsPage from "@/components/admin/admin-team-applications";
import AdminTeamApplicationDetailPage from "@/components/admin/admin-team-application-detail";
import AdminJobPostingsPage from "@/components/admin/admin-job-postings";
import AdminNotificationsPage from "@/components/admin/admin-notifications";
import AdminCohortsPage from "@/components/admin/admin-cohorts";
import AdminChatbotEnquiriesPage from "@/components/admin/admin-chatbot-enquiries";
import AdminFeeTrackerPage from "@/components/admin/admin-fee-tracker";
import MyFeesPage from "@/pages/my-fees-page";
// Manager
import ManagerDashboard from "@/components/manager/manager-dashboard";
import ManagerApplicationsPage from "@/components/manager/manager-applications";
import ManagerApplicationDetailPage from "@/components/manager/manager-application-detail";
import ManagerTeamApplicationsPage from "@/components/manager/manager-team-applications";
import ManagerTeamApplicationDetailPage from "@/components/manager/manager-team-application-detail";
import ManagerAssessmentsPage from "@/components/manager/manager-assessments";
import ManagerMentorsPage from "@/components/manager/manager-mentors";
import ManagerNotificationsPage from "@/components/manager/manager-notifications";
// Common Pages
import SprintBoard from "@/components/common-pages/sprint-board";
import TeamPage from "@/components/common-pages/team";
import TeamDetailPage from "@/components/common-pages/team-detail";
import TasksPage from "@/components/common-pages/tasks";
import EvidencePage from "@/components/common-pages/evidence";
import ReviewQueuePage from "@/components/common-pages/review-queue";
import TicketsPage from "@/components/common-pages/tickets";
import TeamChatPage from "@/components/common-pages/team-chat";
import ProblemStatementPage from "@/components/common-pages/problem-statement";
import ProblemStatementsPage from "@/components/common-pages/problem-statements";
import ProblemStatementDetailsPage from "@/components/common-pages/problem-statement-details";
import ProblemStatementApplicationsPage from "@/components/common-pages/problem-statement-applications";
import OpenChallengesPage from "@/components/common-pages/open-challenges";
import StipendsPage from "@/components/common-pages/stipends";
import AnalyticsPage from "@/components/common-pages/analytics";
import SchedulePage from "@/components/common-pages/schedule";
import SettingsPage from "@/components/common-pages/settings";
import MyAssessmentsPage from "@/components/common-pages/my-assessments";
import NotificationsPage from "@/components/common-pages/notifications";
import CreateTeamPage from "@/components/common-pages/create-team";
import LearningPage from "@/components/common-pages/learning";
import JoinTeamPage from "@/components/common-pages/join-team";
import UserProfilePage from "@/components/common-pages/user-profile";
import MyTeamPage from "@/components/common-pages/my-team";
import ApplicationsPage from "@/components/common-pages/applications-page";
import MyMeetingsPage from "@/pages/app/my-meetings";
import AppRolesPage from "@/components/common-pages/app-roles";
import { Loader2 } from "lucide-react";

export default function AppIndex() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  console.log("🔵 AppIndex rendering:", { location, user: user?.email, role: user?.role, isLoading });

  if (isLoading) {
    console.log("🔵 AppIndex: Still loading...");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    console.log("🔵 AppIndex: No user, returning null");
    return null; // Will be redirected by App.tsx
  }

  // Handle sub-routes within the app
  // Admin user detail page
  if (location.startsWith("/app/admin/users/") && location !== "/app/admin/users") {
    // Check if user has admin privileges
    if (user.role === "ADMIN") {
      return <AdminUserDetailPage />;
    }
    // Non-admin users go to their default dashboard
  }

  if (location === "/app/admin/users" || location.startsWith("/app/admin/users")) {
    // Check if user has admin privileges
    if (user.role === "ADMIN") {
      return <AdminUsersPage />;
    }
    // Non-admin users go to their default dashboard
  }

  // Sprint board for all roles (founders, co-founders, mentors, interns, admins)
  if (location === "/app/sprint-board" || location.startsWith("/app/sprint-board")) {
    if (user.role === "FOUNDER" || user.role === "COFOUNDER" || user.role === "LEARNER" || user.role === "MENTOR" || user.role === "ADMIN") {
      return <SprintBoard />;
    }
  }

  // Team detail page for admins and mentors
  // Handle both /app/team/:id and /app/app/team/:id (production routing issue)
  const teamDetailMatch = location.match(/\/app\/app?\/team\/([^/]+)/);
  if (teamDetailMatch) {
    if (user.role === "ADMIN" || user.role === "MENTOR") {
      return <TeamDetailPage />;
    }
  }

  // Team page for admins and mentors (exclude team detail routes)
  // Only match exact /app/team or /app/teams, not /app/team/:id
  if (location === "/app/team" || location === "/app/teams") {
    if (user.role === "ADMIN" || user.role === "MENTOR") {
      return <TeamPage />;
    }
  }

  // My Team page (for founders/cofounders and interns) - shows actual team members
  if (location === "/app/my-team" || location.startsWith("/app/my-team")) {
    if (user.role === "FOUNDER" || user.role === "COFOUNDER" || user.role === "LEARNER") {
      return <MyTeamPage />;
    }
  }

  // My Meetings page (for founders, cofounders, mentors, and interns)
  if (location === "/app/my-meetings" || location.startsWith("/app/my-meetings")) {
    if (user.role === "FOUNDER" || user.role === "COFOUNDER" || user.role === "MENTOR" || user.role === "LEARNER" || user.role === "ADMIN") {
      return <MyMeetingsPage />;
    }
  }

  // Tasks page for interns
  if (location === "/app/tasks" || location.startsWith("/app/tasks")) {
    return <TasksPage />;
  }

  // Review queue — must be matched before /app/evidence, whose startsWith would swallow it.
  // Reviewers only: assignees cannot review their own work, so a learner has nothing to see.
  if (location === "/app/evidence/review" || location.startsWith("/app/evidence/review")) {
    if (user.role === "ADMIN" || user.role === "MENTOR" || user.role === "FOUNDER" || user.role === "COFOUNDER") {
      return <ReviewQueuePage />;
    }
  }

  // Evidence page
  if (location === "/app/evidence" || location.startsWith("/app/evidence")) {
    return <EvidencePage />;
  }

  // Tickets page (common to every role)
  if (location === "/app/tickets" || location.startsWith("/app/tickets")) {
    return <TicketsPage />;
  }

  // Team chat (common to every role)
  if (location === "/app/team-chat" || location.startsWith("/app/team-chat")) {
    return <TeamChatPage />;
  }

  // Problem Statement Applications page
  if (location.match(/^\/app\/problem-statements\/[^/]+\/applications$/)) {
    return <ProblemStatementApplicationsPage />;
  }

  // Problem Statements page (new feature) - check this BEFORE old problem route
  if (location.match(/^\/app\/problem-statements\/[^/]+$/)) {
    return <ProblemStatementDetailsPage />;
  }

  // Open Challenges listing (published by admin)
  if (location === "/app/open-challenges" || location.startsWith("/app/open-challenges")) {
    return <OpenChallengesPage />;
  }

  if (location === "/app/problem-statements" || location.startsWith("/app/problem-statements")) {
    return <ProblemStatementsPage />;
  }

  // Problem Statement page (old route for teams)
  if (location === "/app/problem") {
    return <ProblemStatementPage />;
  }

  // Stipends page
  if (location === "/app/stipends" || location.startsWith("/app/stipends")) {
    return <StipendsPage />;
  }

  // Analytics page
  if (location === "/app/analytics" || location.startsWith("/app/analytics")) {
    return <AnalyticsPage />;
  }

  // Schedule page
  if (location === "/app/schedule" || location.startsWith("/app/schedule")) {
    return <SchedulePage />;
  }

  // Settings page
  if (location === "/app/settings" || location.startsWith("/app/settings")) {
    return <SettingsPage />;
  }

  // Applications page (for all users - sent/received applications)
  if (location === "/app/applications" || location.startsWith("/app/applications")) {
    return <ApplicationsPage />;
  }

  // Notifications page (for interns)
  if (location === "/app/notifications" || location.startsWith("/app/notifications")) {
    if (user.role === "LEARNER" || user.role === "FOUNDER" || user.role === "COFOUNDER") {
      return <NotificationsPage />;
    }
  }

  // My Assessments page (for interns)
  if (location === "/app/my-assessments" || location.startsWith("/app/my-assessments")) {
    return <MyAssessmentsPage />;
  }

  // Learning page (for interns, founders, and co-founders)
  if (location === "/app/learning" || location.startsWith("/app/learning")) {
    if (user.role === "LEARNER" || user.role === "FOUNDER" || user.role === "COFOUNDER") {
      return <LearningPage />;
    }
  }

  // Admin Assessments page
  if (location === "/app/admin/assessments" || location.startsWith("/app/admin/assessments")) {
    if (user.role === "ADMIN") {
      return <AdminAssessmentsPage />;
    }
    // Non-admin users redirect to their dashboard
  }

  // Admin Applications page
  if (location === "/app/admin/applications" || location.startsWith("/app/admin/applications")) {
    if (user.role === "ADMIN") {
      // Check if it's a payment details page
      if (location.match(/\/app\/admin\/applications\/[^/]+\/payment-details$/)) {
        return <AdminPaymentDetailsPage />;
      }
      // Check if it's a detail page (has ID)
      if (location.match(/\/app\/admin\/applications\/[^/]+$/)) {
        return <AdminApplicationDetailPage />;
      }
      return <AdminApplicationsPage />;
    }
    // Non-admin users redirect to their dashboard
  }

  // Admin Team Applications page
  if (location === "/app/admin/team-applications" || location.startsWith("/app/admin/team-applications")) {
    if (user.role === "ADMIN") {
      // Check if it's a detail page (has ID)
      if (location.match(/\/app\/admin\/team-applications\/[^/]+$/)) {
        return <AdminTeamApplicationDetailPage />;
      }
      return <AdminTeamApplicationsPage />;
    }
    // Non-admin users redirect to their dashboard
  }

  // Admin Notifications page
  if (location === "/app/admin/notifications" || location.startsWith("/app/admin/notifications")) {
    if (user.role === "ADMIN") {
      return <AdminNotificationsPage />;
    }
    // Non-admin users redirect to their dashboard
  }

  // Admin Job Postings page
  if (location === "/app/admin/job-postings" || location.startsWith("/app/admin/job-postings")) {
    if (user.role === "ADMIN") {
      return <AdminJobPostingsPage />;
    }
    // Non-admin users redirect to their dashboard
  }

  // Admin Cohorts page (admin only)
  if (location === "/app/admin/cohorts" || location.startsWith("/app/admin/cohorts")) {
    if (user.role === "ADMIN") {
      return <AdminCohortsPage />;
    }
    // Other users redirect to their dashboard
  }

  // Admin Chatbot Enquiries page
  if (location === "/app/admin/chatbot-enquiries" || location.startsWith("/app/admin/chatbot-enquiries")) {
    if (user.role === "ADMIN") {
      return <AdminChatbotEnquiriesPage />;
    }
  }

  // Admin Fee Tracker page
  if (location === "/app/admin/fee-tracker" || location.startsWith("/app/admin/fee-tracker")) {
    if (user.role === "ADMIN") {
      return <AdminFeeTrackerPage />;
    }
  }

  // Create Team page (for founders)
  if (location === "/app/create-team" || location.startsWith("/app/create-team")) {
    if (user.role === "FOUNDER" || user.role === "COFOUNDER") {
      return <CreateTeamPage />;
    }
  }

  // Join Team page (for cofounders and interns to apply to founders)
  // if (location === "/app/join-team" || location.startsWith("/app/join-team")) {
  //   if (user.role === "COFOUNDER" || user.role === "LEARNER") {
  //     // Render OpenChallengesPage instead and let that component pick the "Join Founder Team" tab
  //     return <OpenChallengesPage />;
  //   }
  // }

  // User Profile page
  if (location.match(/^\/app\/user-profile\/[^/]+$/)) {
    return <UserProfilePage />;
  }

  // Founder Applications page
  if (location === "/app/founder/applications" || location.startsWith("/app/founder/applications")) {
    if (user.role === "FOUNDER" || user.role === "COFOUNDER") {
      return <FounderApplicationsPage />;
    }
  }

  // Roles & Responsibilities page (for all roles)
  if (location === "/app/roles") {
    return <AppRolesPage />;
  }

  // My Fees page (for founders, co-founders, and interns)
  if (location === "/app/my-fees" || location.startsWith("/app/my-fees")) {
    if (user.role === "FOUNDER" || user.role === "COFOUNDER" || user.role === "LEARNER") {
      return <MyFeesPage />;
    }
  }

  // Manager routes
  if (user.role === "MANAGER") {
    if (location === "/app/manager/applications" || location.startsWith("/app/manager/applications")) {
      // Check if it's a detail page (has ID)
      if (location.match(/\/app\/manager\/applications\/[^/]+$/)) {
        return <ManagerApplicationDetailPage />;
      }
      return <ManagerApplicationsPage />;
    }
    if (location === "/app/manager/team-applications" || location.startsWith("/app/manager/team-applications")) {
      // Check if it's a detail page (has ID)
      if (location.match(/\/app\/manager\/team-applications\/[^/]+$/)) {
        return <ManagerTeamApplicationDetailPage />;
      }
      return <ManagerTeamApplicationsPage />;
    }
    if (location === "/app/manager/assessments" || location.startsWith("/app/manager/assessments")) {
      return <ManagerAssessmentsPage />;
    }
    if (location === "/app/manager/mentors" || location.startsWith("/app/manager/mentors")) {
      return <ManagerMentorsPage />;
    }
    if (location === "/app/manager/notifications" || location.startsWith("/app/manager/notifications")) {
      return <ManagerNotificationsPage />;
    }
    // Default to manager dashboard
    return <ManagerDashboard />;
  }

  // Render dashboard based on user role
  // Check for admin role
  console.log("🔵 AppIndex: Checking user role for dashboard", { role: user.role });
  if (user.role === "ADMIN") {
    console.log("🔵 AppIndex: Rendering AdminDashboard");
    return <AdminDashboard />;
  }

  switch (user.role) {
    case "MENTOR":
      return <MentorDashboard />;
    case "UNIVERSITY":
      return <UniversityDashboard />;
    case "CORPORATE":
      return <CorporateDashboard />;
    case "FOUNDER":
      return <FounderDashboard />;
    case "COFOUNDER":
      return <CoFounderDashboard />;
    case "LEARNER":
    default:
      return <LearnerDashboard />;
  }
}
