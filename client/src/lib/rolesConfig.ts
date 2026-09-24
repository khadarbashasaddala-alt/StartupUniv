type RoleConfig = {
  subtitle: string;
  tagline: string;
  responsibilities: { text: string }[];
};

export const rolesConfig: Record<string, RoleConfig> = {
  FOUNDER: {
    subtitle: "You lead the vision. Here's what your role is all about:",
    tagline: "Visionary • Leader • Decision Maker",
    responsibilities: [
      { text: "Define the startup's problem statement and vision" },
      { text: "Build and manage your core team" },
      { text: "Lead sprint progress and evidence submissions" },
      { text: "Represent your team in cohort reviews" },
      { text: "Make key decisions that drive the startup forward" },
    ],
  },
  COFOUNDER: {
    subtitle: "You're the backbone of execution. Here's your role:",
    tagline: "Strategist • Executor • Partner",
    responsibilities: [
      { text: "Support the Founder in strategy and decision-making" },
      { text: "Manage team applications and member onboarding" },
      { text: "Oversee task delegation on the sprint board" },
      { text: "Collaborate on evidence and deliverables" },
      { text: "Own the day-to-day operations and keep execution on track" },
    ],
  },
  MENTOR: {
    subtitle: "You're the guide every startup needs. Here's your role:",
    tagline: "Guide • Advisor • Industry Expert",
    responsibilities: [
      { text: "Review and give feedback on problem statements" },
      { text: "Connect teams with the right networks, resources, and opportunities" },
      { text: "Guide teams through sprint challenges and blockers" },
      { text: "Evaluate evidence submissions with constructive feedback" },
      { text: "Share your real-world expertise and industry insights" },
    ],
  },
  LEARNER: {
    subtitle: "You're here to grow and contribute. Here's your journey:",
    tagline: "Explorer • Contributor • Future Leader",
    responsibilities: [
      { text: "Join a startup team as an active contributing member" },
      { text: "Complete assigned tasks on the sprint board" },
      { text: "Participate in open challenges to sharpen your skills" },
      { text: "Learn through the Learning Hub resources" },
      { text: "Support founders in building and validating startup ideas" },
    ],
  },
};
