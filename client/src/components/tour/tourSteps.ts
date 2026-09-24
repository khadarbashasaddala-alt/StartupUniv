export type Position = "top" | "bottom" | "left" | "right";

export interface TourStep {
  id: string;
  route?: string;
  target?: string;
  title: string;
  description: string;
  position?: Position;
}

export interface PageTourStep {
  target: string;
  title: string;
  desc: string;
  position: Position;
  scroll?: boolean;
}

/* ─── Global tour steps (kept for reference / future use) ─── */
export const tourSteps: TourStep[] = [
  { id: "dashboard-heading", route: "/app", target: "dashboard-heading", title: "Welcome to Your Founder Dashboard", description: "Everything you need to run your startup is accessible from here.", position: "bottom" },
  { id: "dashboard-team-card", route: "/app", target: "dashboard-team-card", title: "Your Team at a Glance", description: "Current team name and member count.", position: "bottom" },
  { id: "tour-complete", title: "You're All Set! \u{1F680}", description: "You've seen everything StartupUniv has to offer. Use the '? Page Guide' buttons at the top of each page to replay any section." },
];

/* ─── Per-page mini tours ─── */
export const pageTours: Record<string, PageTourStep[]> = {
  dashboard: [
    { target: "dashboard-team-card", title: "Your Team", desc: "See your team name and current member count here. This updates live as you add co-founders, mentors, and interns.", position: "bottom" },
    { target: "dashboard-pending-card", title: "Pending Applications", desc: "Invitations you've sent that are still awaiting a response. Follow up if someone hasn't responded in a while.", position: "bottom" },
    { target: "dashboard-accepted-card", title: "Accepted — Ready to Add", desc: "People who said yes to your invitation. Head to Applications and click 'Add' to officially bring them onto your team.", position: "bottom" },
    { target: "dashboard-meetings-section", title: "Upcoming Meetings", desc: "All your scheduled team meetings with date, time, and a one-click 'Join' link to Google Meet.", position: "top" },
    { target: "dashboard-team-members-section", title: "Team Members", desc: "A quick view of everyone on your team right now. Click 'View Profile' to see anyone's full details and skills.", position: "top" },
  ],
  "problem-statements": [
    { target: "ps-page-heading", title: "Your Problem Statement", desc: "This is where your startup idea takes shape. Submit a clear problem statement so mentors and co-founders can discover and join your team.", position: "bottom" },
    { target: "ps-title-input", title: "Write a Clear Title", desc: "One line that captures your problem. Example: 'Inefficient Communication in Remote Startup Teams'. Be specific.", position: "right" },
    { target: "ps-overview-input", title: "Describe the Problem", desc: "Explain who has this problem, how big it is, and what you've tried. The more context, the better quality applicants you'll attract.", position: "right" },
    { target: "ps-track-select", title: "Choose Your Track", desc: "Select the domain — Technical, Business, Design, etc. This matches you with the right mentors and cohort sessions.", position: "right" },
    { target: "ps-upload-btn", title: "Upload Supporting Documents", desc: "Add research, wireframes, pitch decks, or diagrams. At least one document is required before submitting.", position: "top" },
    { target: "ps-submit-btn", title: "Submit for Review", desc: "Once submitted, your problem statement goes live on Open Challenges where the entire platform can discover and apply to join your team.", position: "top" },
  ],
  "problem-statements-empty": [
    { target: "ps-page-heading", title: "Your Problem Statement Hub", desc: "This is where your startup idea lives. Submit a problem statement describing the challenge you're solving — this is what attracts co-founders, mentors, and interns to your team.", position: "bottom" },
    { target: "ps-title-input", title: "Write a Clear Title", desc: "Give your problem a specific, punchy title in one line. Example: 'Inefficient Team Communication in Remote Startups'. A clear title attracts the right people to your team.", position: "right" },
    { target: "ps-overview-input", title: "Describe the Full Problem", desc: "Explain who faces this problem, how big it is, and what you've already tried. The more context you give, the better mentors can guide you and the easier it is for co-founders to decide if they want to join.", position: "right" },
    { target: "ps-track-select", title: "Choose Your Track", desc: "Select the domain your startup falls under — Technical, Business, Design, etc. This matches you with the right mentors and cohort sessions for your problem area.", position: "right" },
    { target: "ps-upload-btn", title: "Upload Supporting Documents", desc: "Attach research, wireframes, pitch decks, or diagrams that support your problem. At least one document is required. Strong evidence increases your credibility with mentors.", position: "top" },
    { target: "ps-submit-btn", title: "Submit for Review", desc: "Once submitted, your problem statement goes live on Open Challenges. Co-founders, mentors, and interns across the platform can discover it and apply to join your team. Make it count!", position: "top" },
  ],
  "problem-statements-created": [
    { target: "ps-card", title: "Your Problem Statement", desc: "This is your submitted problem statement — the foundation of your entire startup team and sprint work on StartupUniv. Everything your team does is built around solving this problem.", position: "bottom" },
    { target: "ps-card-title", title: "Your Problem Title", desc: "This is the title you gave your problem statement. This is what co-founders, mentors, and interns see first when browsing Open Challenges. Keep it clear and specific.", position: "bottom" },
    { target: "ps-card-status", title: "Review Status", desc: "Shows the current status of your submission — 'Pending Review' means admins are reviewing it, 'Approved' means it's live on Open Challenges for others to discover and apply.", position: "right" },
    { target: "ps-card-date", title: "Submission Date", desc: "The date you submitted this problem statement. Track how long it has been under review — if it's been a while, check with your program admin.", position: "top" },
    { target: "ps-card-edit", title: "Edit Your Problem Statement", desc: "Click Edit to update your title, overview, track, or supporting documents. You can refine your problem statement at any time to better attract the right team members.", position: "left" },
    { target: "ps-card-view", title: "View Full Details", desc: "Click View Details to see your complete problem statement as others see it — including all supporting documents and the full overview you submitted.", position: "left" },
  ],
  "open-challenges": [
    { target: "oc-tab-open", title: "Open Challenges", desc: "Real-world problems posted by Admins and Mentors. If you don't have your own idea yet, pick one and start building.", position: "bottom" },
    { target: "oc-tab-founder", title: "Founder Problem Statements", desc: "Browse problems posted by other founders. If you're looking to join a team as a co-founder or intern, apply from here.", position: "bottom" },
  ],
  "my-team": [
    { target: "team-name-heading", title: "Your Startup Team", desc: "This is your team home — everyone here is working together on your problem statement.", position: "bottom" },
    { target: "team-filter-tabs", title: "Filter by Role", desc: "Switch between All Members, Founders, Mentors, and Interns to quickly find and manage specific team members.", position: "bottom" },
    { target: "create-team-btn", title: "Invite People", desc: "Browse the platform and invite co-founders, mentors, or interns. They'll receive your invitation and can accept or reject based on your problem statement.", position: "left" },
  ],
  applications: [
    { target: "apps-sent-tab", title: "Sent Invitations", desc: "Every invitation you've sent with their current status — Pending, Accepted, or Rejected. Track who's responded.", position: "bottom" },
    { target: "apps-received-tab", title: "Received Applications", desc: "People who applied to join YOUR team after seeing your problem statement on Open Challenges.", position: "bottom" },
    { target: "apps-table", title: "Take Action", desc: "When someone accepts, click 'Add' to bring them officially onto your team. Or 'Reject' if they're not the right fit. You're in full control.", position: "top" },
  ],
  "sprint-board": [
    { target: "create-sprint-btn", title: "Create a Sprint", desc: "A sprint is a focused work cycle (1-4 weeks). Give it a name, set start and end dates, and define the goal for that period.", position: "bottom" },
    { target: "sprint-tabs", title: "Sprint Views", desc: "Switch between Board (tasks), Standups (daily updates), Demo (show your work), and Evidence (proof of completion). Each view serves a different purpose.", position: "bottom" },
    { target: "task-board-columns", title: "Task Board", desc: "Tasks flow left to right: To Do → In Progress → Done. Your sprint progress percentage updates automatically.", position: "top" },
    { target: "add-task-btn", title: "Add Tasks", desc: "Break your sprint goal into specific tasks. Assign to a team member, set priority, and add a description. Team members can start and complete their own tasks.", position: "left" },
  ],
  tasks: [
    { target: "tasks-stat-cards", title: "Your Task Overview", desc: "A real-time count of tasks assigned to YOU across all sprints — broken down by status.", position: "bottom" },
    { target: "tasks-filter-tabs", title: "Filter by Status", desc: "Focus on what matters now. Click 'In Progress' to see active work, or 'Review' to see what needs mentor feedback.", position: "bottom" },
    { target: "tasks-create-btn", title: "Create a Personal Task", desc: "Add a personal to-do outside of any sprint — for research, prep work, or anything you need to track just for yourself.", position: "left" },
  ],
  meetings: [
    { target: "meetings-upcoming-section", title: "Upcoming Meetings", desc: "All your scheduled meetings sorted by date. Each card has a direct 'Join' link that opens the Google Meet session instantly.", position: "bottom" },
    { target: "create-meeting-btn", title: "Schedule a Meeting", desc: "Set date, time, duration, timezone, and agenda. Link it to an active sprint and choose which team members to invite — everyone gets notified automatically.", position: "left" },
  ],
  evidence: [
    { target: "evidence-stat-cards", title: "Evidence Locker", desc: "Your team's proof-of-work vault. Every PR, CI run, ticket, document, and demo is tracked and categorized here.", position: "bottom" },
    { target: "add-evidence-btn", title: "Add Evidence", desc: "Record a new piece of work: paste a GitHub PR link, a CI pipeline URL, a Jira ticket, or upload a document or demo video. This builds your team's credibility.", position: "left" },
    { target: "evidence-filter-tabs", title: "Filter by Type", desc: "View only PRs, or only Demos, or all evidence at once. Use this when sharing specific progress with stakeholders.", position: "bottom" },
  ],
  "learning-hub": [
    { target: "learning-hub-start", title: "Your Learning Path", desc: "Access curated startup content — tutorials, modules, and exercises designed to build your founder skills.", position: "bottom" },
    { target: "start-learning-btn", title: "Start Learning", desc: "Launch your first module. Content is tailored to your cohort and track — from idea validation to investor pitching.", position: "right" },
    { target: "learning-sessions-section", title: "Cohort Sessions", desc: "Live and recorded sessions created by your mentors and program admins appear here. Check regularly for new content.", position: "top" },
  ],

  /* ─── Intern page tours ─── */
  "intern-dashboard": [
    { target: "dashboard-team-card", title: "Your Team", desc: "The startup team you've joined. Your role is Intern — you're here to contribute, learn, and build real experience.", position: "bottom" },
    { target: "dashboard-pending-card", title: "Pending Applications", desc: "Team invitations that haven't been responded to yet. Shows overall team recruitment activity your founder is managing.", position: "bottom" },
    { target: "dashboard-accepted-card", title: "Accepted Members", desc: "People who've accepted their invitations and are ready to join the team officially.", position: "bottom" },
    { target: "dashboard-meetings-section", title: "Your Upcoming Meetings", desc: "Team meetings you're invited to — with date, time, and a one-click Join link to Google Meet. Never miss a team sync.", position: "top" },
    { target: "dashboard-team-members-section", title: "Who's On Your Team", desc: "A quick view of all team members. Click 'View Profile' to learn about each person's background and skills.", position: "top" },
  ],
  "intern-tasks": [
    { target: "tasks-stat-cards", title: "Your Task Summary", desc: "Real-time count of ALL tasks assigned to you — broken down by status. Keep moving tasks from To Do to Done.", position: "bottom" },
    { target: "tasks-filter-tabs", title: "Filter by Status", desc: "Click 'To Do' to see what's waiting for you. 'In Progress' shows active work. 'Review' means it's waiting on mentor feedback.", position: "bottom" },
    { target: "tasks-create-btn", title: "Personal Tasks", desc: "Create personal reminders or prep tasks for yourself. Good for tracking your own learning goals alongside assigned team work.", position: "left" },
  ],
  "intern-sprint-board": [
    { target: "sprint-board-heading", title: "Active Sprint", desc: "The current sprint your team is running. A sprint is a focused work period — understand the goal so your tasks make sense.", position: "bottom" },
    { target: "task-board-columns", title: "Task Flow", desc: "Watch tasks move left to right: To Do → In Progress → Done. This shows everyone's work status in real time.", position: "top" },
    { target: "sprint-tabs", title: "Sprint Sections", desc: "Board shows tasks. Standups are daily updates. Demo is where you showcase work. Evidence is where proof gets linked.", position: "bottom" },
  ],
  "intern-evidence": [
    { target: "evidence-stat-cards", title: "Your Contribution Record", desc: "Everything uploaded here is permanent proof of your work on this platform. Mentors and admins review this — make it count.", position: "bottom" },
    { target: "add-evidence-btn", title: "Submit Your Work Here", desc: "Finished a task? Upload the evidence. Paste a GitHub PR link, a demo URL, or upload a document. Every submission builds your portfolio.", position: "left" },
    { target: "evidence-filter-tabs", title: "Browse by Type", desc: "Filter your evidence by PRs, documents, demos, and more. Keep track of what you've submitted across different work types.", position: "bottom" },
  ],
  "intern-meetings": [
    { target: "meetings-upcoming-section", title: "Team Meetings", desc: "All meetings you've been invited to, sorted by date. Each card shows the agenda and has a direct Google Meet join button.", position: "bottom" },
    { target: "create-meeting-btn", title: "Schedule a Meeting", desc: "As an intern, you can also schedule meetings with your teammates. Set the time, add an agenda, and pick who to invite.", position: "left" },
  ],
  "intern-learning-hub": [
    { target: "learning-hub-start", title: "Your Learning Path", desc: "Modules and content tailored to your cohort and program track. Work through these alongside your startup contributions.", position: "bottom" },
    { target: "start-learning-btn", title: "Start a Module", desc: "Click to begin your current learning module. Practical, startup-focused content that directly supports your team work.", position: "right" },
    { target: "learning-sessions-section", title: "Live Cohort Sessions", desc: "Scheduled live sessions from your mentors appear here. Join at the right time — these are direct access to expert guidance.", position: "top" },
  ],
  "intern-schedule": [
    { target: "schedule-current-sprint", title: "Current Sprint", desc: "Shows which sprint is currently active, its status, and how many days remain. Sprints are set by your mentor — stay on track with your tasks.", position: "bottom" },
    { target: "schedule-days-remaining", title: "Days Remaining", desc: "Countdown to the current sprint deadline. If this hits 0 and your tasks aren't done, it affects your stipend and program progress.", position: "bottom" },
    { target: "schedule-program-progress", title: "Program Progress", desc: "Your overall progress through the entire program. Complete all 8 sprints to finish the program and unlock your full stipend and equity.", position: "bottom" },
    { target: "schedule-sprint-timeline", title: "Sprint Timeline", desc: "A complete visual overview of all sprints in your program — past, current, and upcoming. Created and managed by your mentor.", position: "top" },
  ],
  "intern-analytics": [
    { target: "analytics-completion-rate", title: "Your Completion Rate", desc: "Percentage of assigned tasks you've completed. Mentors and admins review this — keep it above 80% to maintain good standing in the program.", position: "bottom" },
    { target: "analytics-total-tasks", title: "Total Tasks", desc: "Total tasks assigned to you across all sprints — showing completed vs in-progress breakdown.", position: "bottom" },
    { target: "analytics-points-earned", title: "Points Earned", desc: "Points you've accumulated by completing tasks. Higher points reflect stronger contributions to your team's sprint goals.", position: "bottom" },
    { target: "analytics-task-distribution", title: "Task Distribution", desc: "Breakdown of your tasks by status — To Do, In Progress, In Review, Done. Use this to identify where tasks are getting stuck.", position: "top" },
    { target: "analytics-your-profile", title: "Your Profile & Standing", desc: "Your role, stipend band, equity share, and team health score. This is how the platform evaluates your overall contribution to the team.", position: "top" },
  ],
  "intern-stipends": [
    { target: "stipends-overview", title: "Your Stipend Overview", desc: "See your total stipend, amount disbursed so far, and what's pending. Stipend releases are tied to sprint completion.", position: "bottom" },
  ],
  "learner-dashboard": [
    { target: "dashboard-team-card", title: "Tasks Pending", desc: "Shows how many tasks are assigned to you in the current sprint. This is your primary focus — complete these to progress through the program.", position: "bottom" },
    { target: "dashboard-pending-card", title: "Sprint Progress", desc: "Your completion percentage for the current sprint. Keep this moving upward — sprint progress affects your stipend release and program standing.", position: "bottom" },
    { target: "dashboard-accepted-card", title: "Team Members", desc: "Total active members on your startup team. Collaborate with them on tasks and attend meetings together.", position: "bottom" },
    { target: "dashboard-total-card", title: "Next Stipend", desc: "Your next stipend amount and disbursement status. Stipends are released after each sprint is successfully completed.", position: "bottom" },
    { target: "dashboard-meetings-section", title: "Current Sprint", desc: "The active sprint your team is running. See sprint goals, task count, and overall completion progress for this work period.", position: "top" },
    { target: "dashboard-team-members-section", title: "Your Tasks This Sprint", desc: "A quick view of tasks assigned to you in the current sprint. Click \"View Sprint Board\" to see the full task board.", position: "top" },
  ],
  "intern-applications": [
    { target: "apps-sent-tab", title: "Sent Applications", desc: "Applications you've sent to join startup teams. Track the status of each — Pending, Accepted, or Rejected.", position: "bottom" },
    { target: "apps-received-tab", title: "Received Invitations", desc: "Invitations from founders who want you on their team. Accept to join, or reject if it's not the right fit.", position: "bottom" },
    { target: "apps-table", title: "Application Details", desc: "See full details of each application — who sent it, the team, and current status. Take action directly from here.", position: "top" },
  ],
  "intern-notifications": [
    { target: "notifications-heading", title: "Your Notifications", desc: "All updates about your team activity — task assignments, meeting invites, application status changes, and more.", position: "bottom" },
    { target: "notifications-filters", title: "Filter Notifications", desc: "Switch between All, Unread, and Read to quickly find what needs your attention.", position: "bottom" },
    { target: "notifications-list", title: "Notification Feed", desc: "Click on any notification to see details and take action. Unread items are highlighted so you never miss anything important.", position: "top" },
  ],
  settings: [
    { target: "settings-profile", title: "Profile Information", desc: "Update your name, phone number, and profile photo. Keep your details current so your team can reach you.", position: "bottom" },
    { target: "settings-appearance", title: "Appearance & Theme", desc: "Switch between Light, Dark, and System themes. Choose what's comfortable for your eyes.", position: "bottom" },
    { target: "settings-tour", title: "Tour Settings", desc: "Control the Platform Tour and Page Guide buttons. Toggle them on or off depending on whether you still need guided help.", position: "bottom" },
  ],
  "intern-settings": [
    { target: "settings-profile", title: "Profile Information", desc: "Update your name, phone number, and profile photo. Keep your details current so your team can reach you.", position: "bottom" },
    { target: "settings-appearance", title: "Appearance & Theme", desc: "Switch between Light, Dark, and System themes. Choose what's comfortable for your eyes.", position: "bottom" },
    { target: "settings-tour", title: "Tour Settings", desc: "Control the Platform Tour and Page Guide buttons. Toggle them on or off depending on whether you still need guided help.", position: "bottom" },
  ],
  notifications: [
    { target: "notifications-heading", title: "Your Notifications", desc: "All updates about your team activity — task assignments, meeting invites, application status changes, and more.", position: "bottom" },
    { target: "notifications-filters", title: "Filter Notifications", desc: "Switch between All, Unread, and Read to quickly find what needs your attention.", position: "bottom" },
    { target: "notifications-list", title: "Notification Feed", desc: "Click on any notification to see details and take action. Unread items are highlighted so you never miss anything important.", position: "top" },
  ],

  /* ─── Co-Founder page tours (cf- prefix) ─── */
  "cf-dashboard": [
    { target: "cf-team-overview", title: "Your Team Status 🚀", desc: "This card shows whether you've been added to a Founder's team. Once you join, your team name and member count appear here. Until then, you're in discovery mode.", position: "bottom" },
    { target: "cf-stats-grid", title: "Your Activity at a Glance 📊", desc: "Track how many team members are in your team, how many applications you've received from Founders, and how many Co-Founders and Mentors are involved.", position: "bottom" },
    { target: "cf-applications-card", title: "Founder Invitations 📬", desc: "Founders who have invited you to join their team appear here. Review each invitation, check the Founder's profile, then Accept or Reject based on fit.", position: "top" },
  ],
  "cf-open-challenges": [
    { target: "oc-tab-open", title: "Open Challenges 🌍", desc: "Problem statements posted by Admins and Mentors. Browse these to understand what's being worked on across the platform — great inspiration for your own journey.", position: "bottom" },
    { target: "oc-tab-founder", title: "Founder Problem Statements 💡", desc: "Problems posted by Founders looking for co-founders, mentors, and interns. If you haven't joined a team yet, use this to discover Founders you'd want to build with.", position: "bottom" },
  ],
  "cf-applications": [
    { target: "apps-sent-tab", title: "Applications You've Sent 📤", desc: "Track every team you've expressed interest in. Check the status — Pending, Accepted, or Rejected — to know where things stand.", position: "bottom" },
    { target: "apps-received-tab", title: "Invitations From Founders 📥", desc: "When a Founder invites you to join their team, it appears here. This is the most important tab — review and respond to invitations promptly.", position: "bottom" },
    { target: "apps-table", title: "Review & Respond ✅", desc: "Use this table to review application details and decide next actions from one place.", position: "left" },
  ],
  "cf-my-team": [
    { target: "team-name-heading", title: "Your Startup Team 🤝", desc: "Once a Founder adds you to their team, everyone on the team — Founders, Co-Founders, Mentors, and Interns — appears here.", position: "bottom" },
    { target: "team-filter-tabs", title: "Browse by Role 🔍", desc: "Filter team members by role to quickly find the Founder, your fellow Co-Founders, assigned Mentors, or Interns on your team.", position: "bottom" },
  ],
  "cf-meetings": [
    { target: "meetings-upcoming-section", title: "Your Upcoming Meetings 📅", desc: "All team meetings you've been invited to, sorted by date. Each card shows the agenda and a 'Join' link that opens directly in Google Meet.", position: "bottom" },
    { target: "create-meeting-btn", title: "Schedule a Meeting 🗓️", desc: "Create a meeting for the team — set the date, time, timezone, and agenda. Link it to a sprint and the right team members are notified automatically.", position: "left" },
  ],
  "cf-sprint-board": [
    { target: "sprint-tabs", title: "Sprint Views 🛠️", desc: "Switch between Board (tasks in columns), Standups (daily updates), Demo (progress showcase), and Evidence (proof of completion). Each view serves a different purpose.", position: "bottom" },
    { target: "task-board-columns", title: "Task Board 📋", desc: "Tasks your Founder or Mentor has assigned to you flow through To Do → In Progress → Done. Move your tasks forward as you make progress.", position: "top" },
  ],
  "cf-tasks": [
    { target: "tasks-stat-cards", title: "Your Task Overview ✅", desc: "A real-time count of tasks assigned specifically to you — broken down by status. Use this to stay on top of your workload across all sprints.", position: "bottom" },
    { target: "tasks-filter-tabs", title: "Filter by Status 🔎", desc: "Click 'In Progress' to focus on active work, 'Review' to see tasks you've marked as done and awaiting feedback from your Founder or Mentor.", position: "bottom" },
  ],
  "cf-evidence": [
    { target: "evidence-stat-cards", title: "Your Evidence Locker 🔐", desc: "Every piece of work you've submitted as proof — Pull Requests, CI runs, documents, and demo videos — is tracked and categorised here.", position: "bottom" },
    { target: "add-evidence-btn", title: "Submit Evidence 📎", desc: "Record your work: paste a GitHub PR link, a CI pipeline URL, a Jira ticket, or upload a document or demo video. This builds your credibility with mentors and admins.", position: "left" },
    { target: "evidence-filter-tabs", title: "Filter by Type 🗂️", desc: "Quickly view just your PRs, or your demo videos, or everything at once. Useful when preparing a progress update for a mentor or sprint review.", position: "bottom" },
  ],
  "cf-learning-hub": [
    { target: "learning-hub-start", title: "Your Learning Path 📚", desc: "Access curated startup content — tutorials, modules, and exercises built specifically to grow your skills as a Co-Founder. Great for while you're waiting for your Founder's invitation.", position: "bottom" },
  ],
  "cf-problem-statements": [
    { target: "ps-page-heading", title: "Problem Statements 📄", desc: "This is where you can view the problem statements uploaded by your Founder. Read through them to understand what your team is working on and how you can contribute.", position: "bottom" },
  ],
  /* Sprint Board — no team joined yet */
  "cf-pg-sprint-board-no-team": [
    { target: "cf-pg-sb-no-team-sentinel", title: "Sprint Board", desc: "You haven't joined a founder's team yet. Once a founder invites you, your active sprint will appear here.", position: "bottom" },
  ],

  /* Sprint Board — joined a team but no sprint created yet */
  "cf-pg-sprint-board-no-sprint": [
    { target: "cf-pg-sb-no-sprint-sentinel", title: "Sprint Board", desc: "No active sprint yet. Your founder hasn't created a sprint for your team. Check back here once a sprint is underway.", position: "bottom" },
  ],

  /* Sprint Board — active sprint exists (full guide) */
  "cf-pg-sprint-board": [
    { target: "sprint-board-heading", title: "Sprint Header", desc: "This shows the sprint title, active status badge, date range, and your team name — so you always know which sprint and team context you are viewing.", position: "bottom" },
    { target: "sprint-progress", title: "Progress Bar", desc: "This percentage represents sprint completion based on how many tasks have been moved to Done in the current sprint.", position: "left" },
    { target: "sprint-tabs", title: "Board / Standups / Demo / Evidence Tabs", desc: "Board shows tasks in columns by status. Standups shows daily updates submitted by the team. Demo shows demo submissions. Evidence shows proof-of-work linked to this sprint.", position: "bottom" },
    { target: "task-board-columns", title: "Task Columns", desc: "Tasks are grouped into columns: To Do (not started), In Progress (actively being worked on), In Review (waiting for review), and Done (completed). As a co-founder you can view all task statuses here.", position: "top" },
  ],
  /* Evidence — co-founder has not been assigned to any team */
  "cf-pg-evidence-no-team": [
    { target: "cf-pg-evidence-no-team-sentinel", title: "Evidence Locker", desc: "You haven't joined a founder's team yet. Once a founder invites you, your team's evidence — pull requests, CI runs, tickets, documents, and demos — will appear here.", position: "bottom" },
  ],

  /* Evidence — co-founder has a team but no evidence submitted yet */
  "cf-pg-evidence-empty": [
    { target: "evidence-heading", title: "Evidence Locker", desc: "This is the Evidence Locker — it tracks all proof of work for your team across development, delivery, and demos.", position: "bottom" },
    { target: "evidence-stat-cards", title: "Summary Cards", desc: "These cards show totals for Pull Requests, CI Runs, Tickets, Documents, and Demos — giving you an at-a-glance view of all evidence submitted by the team.", position: "bottom" },
    { target: "add-evidence-btn", title: "Add Evidence", desc: "Use this button to add a new evidence entry — paste a GitHub PR link, CI pipeline URL, Jira ticket, or upload a document or demo video.", position: "left" },
    { target: "evidence-filter-tabs", title: "Filter Tabs", desc: "Use the All, PRs, CI, Tickets, Docs, and Demos tabs to filter evidence by type — helpful when preparing for sprint reviews.", position: "top" },
    { target: "cf-evidence-empty-state", title: "Empty State", desc: "When no evidence appears, it means nothing has been logged yet. Use 'Add Evidence' above to log the first item for your team.", position: "top" },
  ],

  /* Evidence — co-founder has a team and evidence exists */
  "cf-pg-evidence": [
    { target: "evidence-heading", title: "Evidence Locker", desc: "This is the Evidence Locker — it tracks all proof of work for your team across development, delivery, and demos.", position: "bottom" },
    { target: "evidence-stat-cards", title: "Summary Cards", desc: "These cards show totals for Pull Requests, CI Runs, Tickets, Documents, and Demos — giving you an at-a-glance view of all evidence submitted by the team.", position: "bottom" },
    { target: "add-evidence-btn", title: "Add Evidence", desc: "Use this button to add a new evidence entry — paste a GitHub PR link, CI pipeline URL, Jira ticket, or upload a document or demo video.", position: "left" },
    { target: "evidence-filter-tabs", title: "Filter Tabs", desc: "Use the All, PRs, CI, Tickets, Docs, and Demos tabs to filter evidence by type — helpful when preparing for sprint reviews.", position: "top" },
  ],
  "cf-pg-problem-statements-no-team": [
    { target: "cf-pg-ps-page-header", title: "Problem Statements", desc: "This is the Problem Statements page — you haven't been added to a founder's team yet. Once a founder invites you, their problem statement will appear here.", position: "bottom" },
    { target: "cf-pg-ps-page-header", title: "What To Do Next", desc: "Check back here after joining a team to explore the problem your team is working on.", position: "bottom" },
  ],
  "cf-pg-problem-statements-team-no-ps": [
    { target: "cf-pg-ps-page-header", title: "Problem Statements", desc: "You are part of a team, but the founder hasn't published a problem statement yet. You'll see it here once it's available.", position: "bottom" },
  ],
  "cf-pg-problem-statements-has-content": [
    { target: "cf-pg-ps-dropdown", title: "Problem Statement Dropdown", desc: "Use this dropdown to switch between available problem statements. You are view-only — co-founders cannot add or edit problem statements.", position: "bottom" },
    { target: "m-pg-ps-main-card", title: "Problem Statement Content", desc: "This card shows the title and full description uploaded by the founder. Co-founders can read but cannot add or edit problem statements.", position: "top" },
    { target: "m-pg-ps-supporting-docs", title: "Supporting Documents", desc: "Files uploaded alongside the problem statement for additional context. This section is view-only for co-founders.", position: "top" },
    { target: "m-pg-ps-expected-outcomes", title: "Expected Outcomes", desc: "Key deliverables defined by the founder. Co-founders are view-only — you cannot edit expected outcomes.", position: "top" },
    { target: "m-pg-ps-constraints", title: "Constraints & Requirements", desc: "Technical boundaries and requirements set by the founder. Co-founders are view-only — you cannot edit constraints.", position: "top" },
  ],

  /* ─── Mentor page tours (m- prefix) ─── */
  "m-dashboard": [
    { target: "m-stat-cards", title: "Your Summary 📊", desc: "Three key metrics at a glance: Assigned Teams, Pending Reviews, and Sessions This Month. If Pending Reviews is non-zero, a team is waiting for your feedback.", position: "bottom" },
    { target: "m-tab-teams", title: "Teams Tab 🤝", desc: "See every team assigned to you — their name, track, member count, and current sprint. Log a mentoring session for any team directly from here.", position: "bottom" },
    { target: "m-tab-sprints", title: "Sprints Tab 🗓️", desc: "Monitor sprint progress across all your assigned teams — track which sprints are active, completed, or pending review submission.", position: "bottom" },
    { target: "m-tab-reviews", title: "Reviews Tab ⭐", desc: "Teams waiting for your sprint review appear here. Score them across six rubric criteria — your review unlocks their stipend, so timely feedback matters.", position: "bottom" },
    { target: "m-tab-sessions", title: "Sessions Tab 📹", desc: "Log every 1:1 or group session with a team here. Select the team, session type, duration, and notes. Logged sessions feed your activity report.", position: "bottom" },
    { target: "m-tab-meetings", title: "Meetings Tab 📅", desc: "View all upcoming and past meetings with your teams. Schedule new meetings directly from here — team members are notified automatically.", position: "bottom" },
  ],
  "m-open-challenges": [
    { target: "oc-tab-open", title: "Open Challenges 🌍", desc: "Problem statements posted across the platform. Browse to discover teams whose challenges align with your expertise — great for finding future mentees.", position: "bottom" },
    { target: "oc-tab-founder", title: "Founder Problem Statements 💡", desc: "Problems posted specifically by Founders looking for mentors, co-founders, and interns. If you're looking for teams to mentor, explore here.", position: "bottom" },
  ],
  "m-problem-statements": [
    { target: "ps-page-heading", title: "Problem Statements 📄", desc: "Submit and manage your problem statement here. As a mentor, you can define challenges aligned with your expertise — Founders browse these to find the right mentors for their teams.", position: "bottom" },
    { target: "ps-title-input", title: "Statement Title ✍️", desc: "Give your problem statement a clear, concise title that conveys the core challenge. Founders will see this first when browsing.", position: "bottom" },
    { target: "ps-overview-input", title: "Problem Description 📝", desc: "Describe the problem in detail — background, context, and what kind of team or work you want to support. This is the main content Founders read to evaluate fit.", position: "top" },
    { target: "ps-track-select", title: "Track Selector 🗂️", desc: "Select the technology or industry track this problem falls under. Founders filter by track when browsing, so choose the closest match to your challenge.", position: "bottom" },
    { target: "ps-upload-btn", title: "Supporting Documents 📎", desc: "Upload reference materials — research, diagrams, or background documents that give Founders deeper context. Supported: PDF, images, and videos.", position: "left" },
    { target: "ps-submit-btn", title: "Submit for Review 🚀", desc: "Submit your problem statement for admin review. Once approved, it will be published to the platform and visible to Founders looking for mentors.", position: "top" },
    { target: "ps-list", title: "Your Submitted Statements 📋", desc: "All problem statements you've submitted are listed here. Each card shows the title, track, status, and application counts. Click 'View Details' to see full content, supporting documents, expected outcomes, and editable constraints.", position: "top" },
  ],
  "m-problem-statement-details": [
    { target: "ps-detail-content", title: "Problem Statement Content 📄", desc: "The full title and description of this problem statement. This is what Founders review when deciding whether to work with you as their mentor — it captures the challenge, context, and what kind of team you want to support.", position: "bottom" },
    { target: "ps-detail-docs", title: "Supporting Documents 📎", desc: "Files uploaded alongside the problem statement — research, diagrams, or background materials. Click any document to open it in a new tab. These give Founders deeper context before applying.", position: "bottom" },
    { target: "ps-detail-outcomes", title: "Expected Outcomes 🎯", desc: "Key deliverables and success criteria for this problem statement. As a mentor, you can define what a successful team engagement looks like. Click the pencil icon to edit and save your expectations.", position: "bottom" },
    { target: "ps-detail-constraints", title: "Constraints & Requirements ⚠️", desc: "Technical boundaries and requirements for this challenge. Use this to set expectations — preferred tech stack, scope limits, or skill requirements. Click the pencil icon to edit.", position: "bottom" },
  ],
  "m-sprint-board": [
    { target: "sb-team-selector", title: "Select a Team 🤝", desc: "Choose which team's sprint board to view. All teams assigned to you appear in the dropdown — switch between them to monitor each team's progress independently.", position: "bottom" },
    { target: "sb-team-details", title: "Team Details 👥", desc: "See the full team roster — Founders, Co-Founders, Interns, and Mentors — alongside the team's problem statement, track, and overview for quick context before reviewing.", position: "bottom" },
    { target: "sprint-selector", title: "Sprint Selector 🗓️", desc: "Switch between active and past sprints for the selected team. Each entry shows the sprint name and date range — navigate to past sprints to review completed work or track improvement over time.", position: "bottom" },
    { target: "sprint-board-heading", title: "Active Sprint Header 📋", desc: "The current sprint's name, status badge, and date range. Confirm you're viewing the correct sprint period — use the sprint selector above to switch if needed.", position: "bottom" },
    { target: "sprint-progress", title: "Sprint Progress Bar 📈", desc: "The percentage of tasks moved to Done in this sprint — calculated automatically as tasks are completed. A low percentage late in the sprint cycle is a prompt to check in with the team.", position: "left" },
    { target: "sprint-tabs", title: "Sprint Views 🛠️", desc: "Four tabs: Board (task flow columns), Standups (daily updates from the team), Demo (sprint showcase submissions), and Evidence (proof-of-work links). Switch tabs to review each aspect of the sprint.", position: "bottom" },
    { target: "task-board-columns", title: "Task Board 📋", desc: "Tasks flow through To Do → In Progress → In Review → Done. As a mentor, you can view all tasks and create new ones to guide the team. Move tasks or add targeted work when the team needs direction.", position: "top" },
    { target: "add-task-btn", title: "Add a Task ➕", desc: "Create a task for the team when they need specific guidance. Set a priority, assign to a member, and add a clear description to keep the team focused on what matters most this sprint.", position: "left" },
  ],
  "m-tasks": [
    { target: "tasks-stat-cards", title: "Task Overview ✅", desc: "A real-time count of tasks across your teams — broken down by status. Use this to understand overall team workload and identify which teams are most active.", position: "bottom" },
    { target: "tasks-filter-tabs", title: "Filter by Status 🔎", desc: "Focus on what needs attention: filter to 'In Progress' to see active work, or 'Review' to catch tasks teams have marked done and are waiting for feedback.", position: "bottom" },
    { target: "tasks-create-btn", title: "Create a Task 📝", desc: "Assign a task directly to a team or member. Useful when you identify a gap during a review or session that needs immediate action.", position: "left" },
  ],
  "m-team": [
    { target: "m-team-health", title: "Team Health Distribution 🏥", desc: "An at-a-glance view of where your teams stand: Green (on track), Amber (needs attention), Red (at risk). Click a team to drill into their details.", position: "bottom" },
    { target: "m-team-list", title: "All Your Teams 👥", desc: "Browse every team you're assigned to. Click 'View Details' to see their full member list, sprint history, and activity — everything you need to provide targeted guidance.", position: "top" },
  ],
  "m-meetings": [
    { target: "meetings-upcoming-section", title: "Your Upcoming Meetings 📅", desc: "All meetings you've been invited to or created, sorted by date. Each card shows the agenda and a 'Join' link that opens directly in Google Meet.", position: "bottom" },
    { target: "create-meeting-btn", title: "Schedule a Meeting 🗓️", desc: "Create structured check-ins with your teams — set the date, time, timezone, agenda, and meeting link. The team is notified automatically.", position: "left" },
  ],
  "m-applications": [
    { target: "apps-received-tab", title: "Founder Applications 📥", desc: "Founders who have invited you to mentor their team appear here. Review their profile and problem statement before deciding to accept.", position: "bottom" },
    { target: "apps-sent-tab", title: "Applications You've Sent 📤", desc: "Track any teams you've proactively expressed interest in mentoring. Check the status to know where things stand.", position: "bottom" },
    { target: "apps-table", title: "Review & Respond ✅", desc: "Click 'View' to see the Founder's profile and problem statement. Then Accept to be assigned to their team, or Reject if it's not the right fit.", position: "top" },
  ],
  "m-evidence": [
    { target: "evidence-heading", title: "Evidence Locker 🔐", desc: "This is where your teams log proof of their work — Pull Requests, CI pipeline runs, Jira tickets, documents, and demo videos. Evidence quality is a direct input for sprint review scores. If you mentor multiple teams, use the team selector in the top-right to switch between them.", position: "bottom" },
    { target: "add-evidence-btn", title: "Add Evidence 📎", desc: "You can also submit evidence yourself — log mentor contributions, session materials, or reference documents for the team. Click to add a new entry with type, title, and link.", position: "left" },
    { target: "evidence-stat-cards", title: "Evidence by Type 📊", desc: "A live count of evidence across five categories: Pull Requests, CI Runs, Tickets, Documents, and Demos. Use this to quickly see the volume and nature of a team's documented work before writing a sprint review.", position: "bottom" },
    { target: "evidence-filter-tabs", title: "Filter by Type 🗂️", desc: "Click any tab to view only that type of evidence — PRs, CI, Tickets, Docs, or Demos. Useful when reviewing a specific category during a sprint assessment or looking for a particular piece of work.", position: "bottom" },
    { target: "evidence-list", title: "Evidence Items 📋", desc: "Each card shows the evidence type, title, the team member who submitted it, and a direct link to view the work. For PRs and CI runs, click the external link to review the actual commit or pipeline. Use this when scoring sprint reviews.", position: "top" },
  ],

  /* ─── Mentor Page Guide steps (m-pg- prefix) ─── */

  /* No problem statement submitted yet — empty state */
  "m-pg-ps-no-ps": [
    { target: "m-pg-ps-submit-btn", title: "Submit Your First Problem Statement", desc: "You haven't submitted a problem statement yet. Click here to submit one and get started.", position: "bottom" },
  ],

  /* Submit Problem Statement form is open */
  "m-pg-ps-form-open": [
    { target: "ps-title-input", title: "Problem Statement Title", desc: "Enter a clear and concise title that summarizes the problem you want to address.", position: "bottom" },
    { target: "ps-overview-input", title: "Overview", desc: "Describe the problem in detail — include the context, current challenges, and what kind of solution you are looking for.", position: "bottom" },
    { target: "ps-track-select", title: "Select a Track", desc: "Choose the track that best fits your problem statement. This helps teams find relevant challenges.", position: "bottom" },
    { target: "ps-upload-btn", title: "Supporting Documents", desc: "Optionally upload any relevant files such as PDFs, diagrams, or research documents to support your problem statement.", position: "bottom" },
    { target: "ps-submit-btn", title: "Submit for Review", desc: "Once all fields are filled, click here to submit your problem statement for review.", position: "top" },
  ],

  /* Problem statement exists — full guide */
  "m-pg-problem-statement": [
    { target: "m-pg-ps-dropdown", title: "Switch Problem Statements", desc: "Use this dropdown to switch between your submitted problem statements.", position: "bottom" },
    { target: "m-pg-ps-submit-new", title: "Submit a New Problem Statement", desc: "Click here to submit a new problem statement for a challenge.", position: "bottom" },
    { target: "m-pg-ps-track-badge", title: "Challenge Category", desc: "This badge shows the category or domain your problem statement belongs to.", position: "bottom" },
    { target: "m-pg-ps-main-card", title: "Your Problem Statement", desc: "This card displays the title and full description of your submitted problem statement.", position: "bottom" },
    { target: "m-pg-ps-supporting-docs", title: "Supporting Documents", desc: "Upload and view files that support your problem statement. Click 'View' to open any uploaded document.", position: "bottom" },
    { target: "m-pg-ps-expected-outcomes", title: "Expected Outcomes", desc: "Define the key deliverables and success criteria for your problem statement. Click 'Edit' to add them.", position: "top" },
    { target: "m-pg-ps-constraints", title: "Constraints & Requirements", desc: "Specify technical boundaries and requirements here. Click 'Edit' to fill in the details.", position: "top" },
  ],
  /* Sprint Board — no teams assigned */
  "m-pg-sprint-board-no-teams": [
    { target: "sb-no-teams-state", title: "Sprint Board", desc: "Here you can view sprint details, tasks, and progress for your assigned teams. You are currently not assigned to any team — once a team is assigned to you, the full sprint board will be available here.", position: "bottom" },
  ],

  /* Sprint Board — has assigned teams (full guide) */
  "m-pg-sprint-board": [
    { target: "sb-team-selector", title: "Your Teams", desc: "This shows all teams you are assigned to as a mentor.", position: "bottom" },
    { target: "sb-team-dropdown", title: "Select a Team", desc: "Choose a team to view and manage their sprint board.", position: "bottom" },
    { target: "sb-team-members", title: "Team Members", desc: "View all Founders, Mentors, and Interns assigned to the selected team.", position: "bottom" },
    { target: "sb-problem-statement", title: "Team's Problem Statement", desc: "This shows the active problem statement the team is working on, along with its category and description.", position: "bottom" },
    { target: "sprint-selector", title: "Switch Sprints", desc: "Use this to navigate between different sprints for the selected team.", position: "bottom" },
    { target: "sprint-board-heading", title: "Current Sprint", desc: "This shows the name of the active sprint. The 'ACTIVE' badge indicates it is currently in progress.", position: "bottom" },
    { target: "sprint-date-range", title: "Sprint Timeline", desc: "Shows the sprint duration and the team it belongs to.", position: "bottom" },
    { target: "create-sprint-btn", title: "Create a New Sprint", desc: "Click here to create a new sprint for the team.", position: "bottom" },
    { target: "sprint-progress", title: "Sprint Progress", desc: "This shows how much of the sprint work has been completed as a percentage.", position: "left" },
    { target: "sprint-tabs", title: "Sprint Sections", desc: "Navigate between the Task Board, Standups, Demo submissions, and Evidence for this sprint.", position: "bottom" },
    { target: "add-task-btn", title: "Add a Task", desc: "Click here to add a new task to the sprint board.", position: "left" },
    { target: "task-board-columns", title: "Task Board Columns", desc: "Tasks are organized by status — To Do, In Progress, In Review, and Done. Each column shows a count of tasks.", position: "top" },
    { target: "task-card-sample", title: "Task Card", desc: "Each card shows the task name, priority level, assignee, and a Start button to begin working on it.", position: "top" },
  ],
  "m-pg-evidence-initial": [
    { target: "m-pg-evidence-heading-initial", title: "Welcome to the Evidence Locker", desc: "This is where you track all evidence submitted by your teams — PRs, CI runs, documents, tickets, and demos.", position: "bottom" },
    { target: "m-pg-evidence-team-select-initial", title: "Select a Team to Begin", desc: "Choose a team from this dropdown to load their evidence locker and start reviewing submissions.", position: "bottom" },
  ],
  "m-pg-evidence-loaded-empty": [
    { target: "evidence-heading", title: "Team Evidence Locker", desc: "You are now viewing the evidence locker for the selected team. All their submissions appear here.", position: "bottom" },
    { target: "m-pg-evidence-team-switcher", title: "Switch Teams", desc: "Use this to switch between different teams and view their evidence.", position: "bottom" },
    { target: "add-evidence-btn", title: "Add Evidence", desc: "Click here to manually add a new piece of evidence such as a PR, CI run, document, or demo.", position: "left" },
    { target: "evidence-stat-cards", title: "Evidence Overview", desc: "These tiles show a quick count of each type of evidence — Pull Requests, CI Runs, Tickets, Documents, and Demos.", position: "bottom" },
    { target: "evidence-filter-tabs", title: "Browse All Evidence", desc: "View all submitted evidence here. Use the filter tabs to narrow down by type — PRs, CI, Tickets, Docs, or Demos.", position: "bottom" },
    { target: "m-pg-evidence-add-first", title: "No Evidence Yet", desc: "When no evidence has been added yet, click 'Add First Evidence' to log the first submission.", position: "top" },
  ],
  "m-pg-evidence-loaded-has": [
    { target: "evidence-heading", title: "Team Evidence Locker", desc: "You are now viewing the evidence locker for the selected team. All their submissions appear here.", position: "bottom" },
    { target: "m-pg-evidence-team-switcher", title: "Switch Teams", desc: "Use this to switch between different teams and view their evidence.", position: "bottom" },
    { target: "add-evidence-btn", title: "Add Evidence", desc: "Click here to manually add a new piece of evidence such as a PR, CI run, document, or demo.", position: "left" },
    { target: "evidence-stat-cards", title: "Evidence Overview", desc: "These tiles show a quick count of each type of evidence — Pull Requests, CI Runs, Tickets, Documents, and Demos.", position: "bottom" },
    { target: "evidence-filter-tabs", title: "Browse All Evidence", desc: "View all submitted evidence here. Use the filter tabs to narrow down by type — PRs, CI, Tickets, Docs, or Demos.", position: "bottom" },
    { target: "m-pg-evidence-list-first", title: "Evidence Submissions", desc: "All evidence submitted by the team appears here. Each entry shows the type, title, date added, and who submitted it. Use the 'View' button to open it or 'Details' for more information.", position: "top" },
  ],

  /* ─── Mentor Page Guide — Dashboard (no teams assigned) ─── */
  "m-pg-dashboard-no-teams": [
    { target: "m-pg-dash-stat-teams", title: "Assigned Teams", desc: "Shows the total number of active teams you are currently mentoring.", position: "bottom" },
    { target: "m-pg-dash-stat-reviews", title: "Pending Reviews", desc: "Shows how many sprint or task reviews are pending from your teams this week.", position: "bottom" },
    { target: "m-pg-dash-stat-sessions", title: "Sessions This Month", desc: "Displays the total number of mentoring sessions recorded this month.", position: "bottom" },
    { target: "m-tabs-list", title: "Dashboard Sections", desc: "Use these tabs to navigate between your Teams, Sprints, Reviews, Sessions, and Meetings overview.", position: "bottom" },
    { target: "m-pg-dash-teams-title", title: "Your Teams", desc: "This section will list all teams assigned to you for mentorship once teams are assigned to you.", position: "bottom" },
  ],

  /* ─── Mentor Page Guide — Dashboard (has assigned teams) ─── */
  "m-pg-dashboard-has-teams": [
    { target: "m-pg-dash-stat-teams", title: "Assigned Teams", desc: "Shows the total number of active teams you are currently mentoring.", position: "bottom" },
    { target: "m-pg-dash-stat-reviews", title: "Pending Reviews", desc: "Shows how many sprint or task reviews are pending from your teams this week.", position: "bottom" },
    { target: "m-pg-dash-stat-sessions", title: "Sessions This Month", desc: "Displays the total number of mentoring sessions recorded this month.", position: "bottom" },
    { target: "m-tabs-list", title: "Dashboard Sections", desc: "Use these tabs to navigate between your Teams, Sprints, Reviews, Sessions, and Meetings overview.", position: "bottom" },
    { target: "m-pg-dash-teams-title", title: "Your Teams", desc: "This section lists all teams assigned to you for mentorship.", position: "bottom" },
    { target: "m-pg-dash-team-card", title: "Team Card", desc: "Each card shows the team name, category, number of members, current sprint, and a Log Session button.", position: "bottom" },
    { target: "m-pg-dash-log-session", title: "Log a Session", desc: "Click this to log a mentoring session for the selected team.", position: "left" },
  ],

  /* ─── Mentor Page Guide — Open Challenges ─── */
  "m-pg-open-challenges": [
    { target: "m-pg-oc-tabs", title: "Page Tabs", desc: "Switch between viewing Open Challenges posted by Admins and Mentors, or viewing problem statements submitted by Founders.", position: "bottom" },
    { target: "m-pg-oc-heading", title: "Open Challenges", desc: "This section lists all active challenges uploaded by Admins and Mentors that teams can apply to.", position: "bottom" },
    { target: "m-pg-oc-card", title: "Challenge Card", desc: "Each card shows the challenge title, author, date posted, number of applicants, and a short description.", position: "bottom" },
    { target: "m-pg-oc-view-btn", title: "View Challenge", desc: "Click View to open the full details of a challenge including its requirements and applicants.", position: "top" },
  ],

  /* ─── Mentor Page Guide — Tasks (no teams assigned) ─── */
  "m-pg-tasks-no-teams": [
    { target: "m-pg-tasks-count", title: "Total Tasks", desc: "Shows the total number of tasks currently assigned to you.", position: "left" },
    { target: "m-pg-tasks-stat-todo", title: "To Do", desc: "Shows how many tasks are yet to be started.", position: "bottom" },
    { target: "m-pg-tasks-stat-inprogress", title: "In Progress", desc: "Shows how many tasks you are currently working on.", position: "bottom" },
    { target: "m-pg-tasks-stat-review", title: "In Review", desc: "Shows how many of your tasks are currently awaiting review.", position: "bottom" },
    { target: "m-pg-tasks-stat-done", title: "Completed", desc: "Shows how many tasks are completed along with your overall completion percentage.", position: "bottom" },
    { target: "m-pg-tasks-list-title", title: "Task List", desc: "All your assigned tasks will be listed here once tasks are assigned to you.", position: "bottom" },
    { target: "tasks-filter-tabs", title: "Filter Tasks", desc: "Use these tabs to filter your task list by status.", position: "bottom" },
  ],

  /* ─── Mentor Page Guide — Tasks (has assigned teams, full guide) ─── */
  "m-pg-tasks": [
    { target: "m-pg-tasks-count", title: "Total Tasks", desc: "Shows the total number of tasks currently assigned to you.", position: "left" },
    { target: "tasks-create-btn", title: "Create a Task", desc: "Click here to create a new task for yourself.", position: "left" },
    { target: "m-pg-tasks-stat-todo", title: "To Do", desc: "Shows how many tasks are yet to be started.", position: "bottom" },
    { target: "m-pg-tasks-stat-inprogress", title: "In Progress", desc: "Shows how many tasks you are currently working on.", position: "bottom" },
    { target: "m-pg-tasks-stat-review", title: "In Review", desc: "Shows how many of your tasks are currently awaiting review.", position: "bottom" },
    { target: "m-pg-tasks-stat-done", title: "Completed", desc: "Shows how many tasks are completed along with your overall completion percentage.", position: "bottom" },
    { target: "m-pg-tasks-list-title", title: "Task List", desc: "All your assigned tasks are listed here in one place.", position: "bottom" },
    { target: "tasks-filter-tabs", title: "Filter Tasks", desc: "Use these tabs to filter your task list by status. Each tab shows a count of tasks in that state.", position: "bottom" },
    { target: "m-pg-tasks-row", title: "Task Row", desc: "Each row shows the task title, description, points, due date, and current status. Use the status dropdown on the right to update the task's progress.", position: "top" },
  ],

  /* ─── Mentor Page Guide — Team (no teams assigned) ─── */
  "m-pg-team-no-teams": [
    { target: "m-pg-team-dropdown", title: "Filter by Team", desc: "Use this dropdown to filter the view by a specific team or view all teams at once.", position: "bottom", scroll: false },
    { target: "m-pg-team-count", title: "Total Teams", desc: "Shows the total number of teams assigned to you.", position: "left", scroll: false },
    { target: "m-team-health", title: "Team Health Distribution", desc: "This section gives an overview of how your teams are performing across three health categories.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-green", title: "Green — Excellent", desc: "Teams with a score of 85 or above fall in this category. They are performing excellently.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-amber", title: "Amber — Good", desc: "Teams with a score between 65 and 84 fall here. They are performing well but may need some attention.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-red", title: "Red — Needs Help", desc: "Teams with a score below 65 fall in this category and require your immediate attention.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-bars", title: "Health Breakdown", desc: "These bars show the percentage of your teams in each health category visually.", position: "bottom", scroll: false },
    { target: "m-pg-team-my-teams", title: "My Teams", desc: "This section will list each of your assigned teams with their health status and sprint completion once teams are assigned to you.", position: "bottom", scroll: true },
  ],

  /* ─── Mentor Page Guide — Team (has assigned teams, full guide) ─── */
  "m-pg-team": [
    { target: "m-pg-team-dropdown", title: "Filter by Team", desc: "Use this dropdown to filter the view by a specific team or view all teams at once.", position: "bottom", scroll: false },
    { target: "m-pg-team-count", title: "Total Teams", desc: "Shows the total number of teams assigned to you.", position: "left", scroll: false },
    { target: "m-team-health", title: "Team Health Distribution", desc: "This section gives an overview of how your teams are performing across three health categories.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-green", title: "Green — Excellent", desc: "Teams with a score of 85 or above fall in this category. They are performing excellently.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-amber", title: "Amber — Good", desc: "Teams with a score between 65 and 84 fall here. They are performing well but may need some attention.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-red", title: "Red — Needs Help", desc: "Teams with a score below 65 fall in this category and require your immediate attention.", position: "bottom", scroll: false },
    { target: "m-pg-team-health-bars", title: "Health Breakdown", desc: "These bars show the percentage of your teams in each health category visually.", position: "bottom", scroll: false },
    { target: "m-pg-team-my-teams", title: "My Teams", desc: "This section lists each of your assigned teams with their individual health status and sprint completion percentage.", position: "bottom", scroll: true },
    { target: "m-pg-team-card", title: "Team Card", desc: "Each card shows the team name, health status colour, and how much of the current sprint has been completed.", position: "bottom", scroll: true },
    { target: "m-pg-team-view-btn", title: "View Team", desc: "Click View to open the full details of the team including members, sprints, and progress.", position: "top", scroll: true },
    { target: "m-pg-team-add-btn", title: "Quick Add", desc: "Click the + button to quickly add a task or sprint item directly from the team card.", position: "top", scroll: true },
  ],

  /* ─── Mentor Page Guide — Meetings ─── */
  "m-pg-meetings": [
    { target: "create-meeting-btn", title: "Create a Meeting", desc: "Click here to schedule a new meeting with your team.", position: "left" },
    { target: "meetings-upcoming-section", title: "Meeting Filters", desc: "Use these tabs to switch between Upcoming, Past, and All meetings. Each tab shows a count of meetings.", position: "bottom" },
    { target: "m-pg-meetings-list", title: "Your Meetings", desc: "All your scheduled meetings appear here. When no meetings are scheduled for the selected tab, you will see an empty state message.", position: "top" },
  ],

  /* ─── Mentor Page Guide — Applications ─── */
  "m-pg-applications": [
    { target: "m-pg-apps-heading", title: "Applications", desc: "This page lets you track all applications — both ones you have sent and ones you have received.", position: "bottom" },
    { target: "m-pg-apps-tabs", title: "Sent & Received Tabs", desc: "Switch between Sent to view applications and invitations you have sent, and Received to view applications sent to you.", position: "bottom" },
    { target: "apps-table", title: "Sent Applications", desc: "This section lists all applications and invitations you have sent out.", position: "top" },
  ],
};
