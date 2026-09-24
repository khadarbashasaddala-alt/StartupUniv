export interface TourStep {
  id: string;
  targetSelector: string;
  route: string;
  getTitle: () => string;
  getDescription: (context: any) => string;
}

export const tourSteps: TourStep[] = [
  {
    id: "dashboard",
    targetSelector: "a[data-sidebar='menu-button'][href='/app']",
    route: "/app",
    getTitle: () => "Dashboard",
    getDescription: (context) => {
      if (context.hasTeam) {
        return "Welcome back to your Co-Founder Dashboard! 🚀\n\nYou're already part of a team — let's walk you through everything available to you so you can hit the ground running.";
      }
      if (context.hasPendingInvitation) {
        return "This is your Co-Founder Dashboard. Welcome back! 🎉\n\nIt looks like you have a pending invitation from a Founder waiting for you. Head to the Applications tab to review it and decide whether to join their team.";
      }
      return "This is your Co-Founder Dashboard. From the sidebar you can access Open Challenges, Applications, your Team, Meetings, Sprint Board, Tasks, Evidence, and the Learning Hub.\n\nRight now, you're waiting for a Founder to invite you to their team. In the meantime, head to the Learning Hub to get a head start!";
    },
  },
  {
    id: "bell",
    targetSelector: "header button.h-14.w-14",
    route: "/app",
    getTitle: () => "Notifications",
    getDescription: () =>
      "Stay in the loop 🔔\n\nThis is your notification centre. All important updates — including invitations from Founders, task assignments, meeting requests, and team activity — will appear here.\n\nKeep an eye on it so you never miss anything.",
  },
  {
    id: "open-challenges",
    targetSelector: "a[href='/app/open-challenges']",
    route: "/app",
    getTitle: () => "Open Challenges",
    getDescription: () =>
      "Explore the ecosystem! 🌍\n\nOpen Challenges are problem statements published by Founders, Mentors, and Admins. Browse them to understand what real-world problems are being worked on across the platform.",
  },
  {
    id: "applications",
    targetSelector: "a[href='/app/applications']",
    route: "/app",
    getTitle: () => "Applications",
    getDescription: (context) => {
      if (context.hasPendingInvitation) {
        return "Looks like you already have an invitation waiting! Head here to review it and decide whether to join the team.";
      }
      return "When a Founder sends you an invitation to join their team, it will appear here under the Received tab.\n\nReview the Founder's profile before deciding — you can Accept or Reject the invitation.";
    },
  },
  {
    id: "my-team",
    targetSelector: "a[href='/app/my-team']",
    route: "/app",
    getTitle: () => "My Team",
    getDescription: (context) => {
      const prefix = context.hasTeam ? "Let's explore what's available to you as part of your team.\n\n" : "";
      return prefix + "After you accept a Founder's invitation, the Founder will review and add you to their team. 🤝\n\nHere you can view all your team members, browse their profiles, and understand who you'll be building with.";
    },
  },
  {
    id: "problem-statements",
    targetSelector: "a[href='/app/problem-statements']",
    route: "/app",
    getTitle: () => "Problem Statements",
    getDescription: (context) => {
      const prefix = context.hasTeam ? "Let's explore what's available to you as part of your team.\n\n" : "";
      return prefix + "Every great startup starts with a problem worth solving. 💡\n\nYour Founder will define the problem statement here — review it to align on the challenge your team is tackling.";
    },
  },
  {
    id: "meetings",
    targetSelector: "a[href='/app/my-meetings']",
    route: "/app",
    getTitle: () => "Meetings",
    getDescription: (context) => {
      const prefix = context.hasTeam ? "Let's explore what's available to you as part of your team.\n\n" : "";
      return prefix + "Collaboration is key. 📅 Schedule and manage meetings with your team directly from here.\n\nUse meetings to align on the product, plan sprints, and stay in sync with your Founder and mentors.";
    },
  },
  {
    id: "sprint-board",
    targetSelector: "a[href='/app/sprint-board']",
    route: "/app",
    getTitle: () => "Sprint Board",
    getDescription: (context) => {
      const prefix = context.hasTeam ? "Let's explore what's available to you as part of your team.\n\n" : "";
      return prefix + "Sprints keep the team focused and moving. 🚀\n\nYour Founder creates and manages sprints here. Coordinate with them through meetings to plan goals, and track task status for all team members in one place.";
    },
  },
  {
    id: "tasks",
    targetSelector: "a[href='/app/tasks']",
    route: "/app",
    getTitle: () => "Tasks",
    getDescription: (context) => {
      const prefix = context.hasTeam ? "Let's explore what's available to you as part of your team.\n\n" : "";
      return prefix + "Your personal task list lives here. ✅\n\nTasks assigned to you by your Founder or Mentor will appear here. Complete your work and update the task status to **In Review** — this automatically notifies whoever assigned it to you.";
    },
  },
  {
    id: "evidence",
    targetSelector: "a[href='/app/evidence']",
    route: "/app",
    getTitle: () => "Evidence",
    getDescription: (context) => {
      const prefix = context.hasTeam ? "Let's explore what's available to you as part of your team.\n\n" : "";
      return prefix + "Prove your work, build your record. 📎\n\nSubmit evidence to support your task completions — accepted formats include Pull Requests, videos, and CI pipeline actions.";
    },
  },
  {
    id: "learning-hub",
    targetSelector: "a[href='/app/learning']",
    route: "/app",
    getTitle: () => "Learning Hub",
    getDescription: (context) => {
      const closing = context.hasTeam
        ? "Your team is already live — use the Learning Hub to sharpen your skills and stay ahead."
        : "While you wait for a Founder's invitation, the Learning Hub is the best place to get a head start.";
      return `Level up your startup skills! 📚\n\nThe Learning Hub gives you access to curated startup content — tutorials, modules, and exercises designed to build your skills as a Co-Founder.\n\n${closing}`;
    },
  },
];
