// Reuse the TourStep shape from CoFounderTour so MentorTour/index.tsx can pass steps
// directly to CoFounderTour's TourUI without type mismatches.
import type { TourStep } from "@/components/CoFounderTour/tour-steps";

// Platform Tour — sidebar navigation walkthrough only.
// Each step targets a sidebar link. No in-page dashboard elements.
export const mentorTourSteps: TourStep[] = [
  {
    id: "dashboard",
    targetSelector: "a[data-sidebar='menu-button'][href='/app']",
    route: "/app",
    getTitle: () => "Dashboard 🎓",
    getDescription: () =>
      "Welcome to StartupUniv as a Mentor!\n\nThis is your home base — track assigned teams, manage sprint reviews, log sessions, and stay on top of everything your teams are working on.\n\nLet's walk through each section of your sidebar navigation.",
  },
  // Step removed with the Open Challenges sidebar entry. A step whose target is gone still
  // shows — CoFounderTour/TourUI resolves a null rect and drops the spotlight rather than
  // crashing — so it would have quietly narrated a link the mentor can no longer see.
  // {
  //   id: "open-challenges",
  //   targetSelector: "a[href='/app/open-challenges']",
  //   route: "/app",
  //   getTitle: () => "Open Challenges 🌍",
  //   getDescription: () =>
  //     "Browse problem statements posted across the platform.\n\nFounders looking for mentors often post here. Discover teams whose challenges align with your expertise and reach out to collaborate.",
  // },
  {
    id: "problem-statement",
    targetSelector: "a[href='/app/problem']",
    route: "/app",
    getTitle: () => "Problem Statement 📄",
    getDescription: () =>
      "Submit and manage your own problem statement here. Describe the kind of challenge you want to mentor — Founders browse these to find the right mentors for their teams.",
  },
  {
    id: "sprint-board",
    targetSelector: "a[href='/app/sprint-board']",
    route: "/app",
    getTitle: () => "Sprint Board 🛠️",
    getDescription: () =>
      "Jump into a team's sprint board. View the task board, check Standups, review Demo submissions, and browse Evidence.\n\nYou can create sprints and add tasks on behalf of teams when they need guidance.",
  },
  {
    id: "tasks",
    targetSelector: "a[href='/app/tasks']",
    route: "/app",
    getTitle: () => "Tasks ✅",
    getDescription: () =>
      "View all tasks across your assigned teams. Create new tasks to give teams focused direction when they need it.\n\nTrack progress across sprints and identify bottlenecks early.",
  },
  {
    id: "team",
    targetSelector: "a[href='/app/team']",
    route: "/app",
    getTitle: () => "Team Management 👥",
    getDescription: () =>
      "An overview of all teams you're assigned to. See team composition, sprint activity, and health indicators at a glance.\n\nClick into any team for a detailed view of their members and sprint history.",
  },
  {
    id: "meetings",
    targetSelector: "a[href='/app/my-meetings']",
    route: "/app",
    getTitle: () => "Meetings 📅",
    getDescription: () =>
      "Schedule and manage check-ins with your teams. Set the agenda, time, and Google Meet link — team members are notified automatically.\n\nRegular check-ins keep teams accountable and on track.",
  },
  // Step removed with the Applications sidebar entry, same reason as Open Challenges above.
  // {
  //   id: "applications",
  //   targetSelector: "a[href='/app/applications']",
  //   route: "/app",
  //   getTitle: () => "Applications 📋",
  //   getDescription: () =>
  //     "Track Founder applications to work with you as their mentor. Review profiles and problem statements before deciding to accept.\n\nOnce accepted, you'll be assigned to their team and will start receiving sprint reviews.",
  // },
  {
    id: "evidence",
    targetSelector: "a[href='/app/evidence']",
    route: "/app",
    getTitle: () => "Evidence 🔐",
    getDescription: () =>
      "View and manage the evidence your teams have submitted — Pull Requests, CI pipelines, documents, and demo videos.\n\nEvidence quality is a key criterion in sprint reviews. You can also log your own evidence here.",
  },
];
