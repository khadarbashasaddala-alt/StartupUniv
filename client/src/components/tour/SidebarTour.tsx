import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useTourContext } from "./TourContext";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SidebarStep {
  target: string;
  title: string;
  desc: string;
  route?: string;
}

const founderSteps: SidebarStep[] = [
  {
    target: "dashboard",
    title: "\u{1F44B} Welcome, Founder!",
    desc: "This is your Dashboard \u2014 your startup command center. See your team, meetings, and application stats all in one place.",
  },
  {
    target: "problem-statements",
    title: "\u{1F4DD} Start Here: Problem Statements",
    desc: "Your first task as a founder is to submit your problem statement. Describe the problem you\u2019re solving, choose a track, and upload supporting documents. This is what attracts your team.",
  },
  {
    target: "open-challenges",
    title: "\u{1F50D} Explore Open Challenges",
    desc: "Browse problem statements posted by Admins and Mentors. If you don\u2019t have your own idea yet, pick a challenge from here and start building around it.",
  },
  {
    target: "my-team",
    title: "\u{1F465} Build Your Team",
    desc: "Once your problem statement is live, invite co-founders, mentors, and interns here. See everyone on your team and manage their profiles.",
  },
  {
    target: "applications",
    title: "\u{1F4E8} Manage Applications",
    desc: "Track every invitation you\u2019ve sent. When someone accepts, come here and click \u2018Add\u2019 to officially bring them onto your team. You\u2019re in full control.",
  },
  {
    target: "sprint-board",
    title: "\u{1F3C3} Run Sprints",
    desc: "Break your work into focused sprints. Create a sprint with a goal and dates, then add tasks and assign them to your team. Watch progress update in real time.",
  },
  {
    target: "tasks",
    title: "\u2705 Your Tasks",
    desc: "See all tasks assigned specifically to you \u2014 by your mentor or anyone on the team. Stay on top of your personal responsibilities here.",
  },
  {
    target: "meetings",
    title: "\u{1F4C5} Schedule Meetings",
    desc: "Create Google Meet-linked team meetings. Set the agenda, link to a sprint, choose attendees, and everyone gets notified automatically.",
  },
  {
    target: "evidence",
    title: "\u{1F510} Evidence Locker",
    desc: "Upload proof of your team\u2019s work \u2014 GitHub PRs, CI runs, Jira tickets, documents, and demo videos. This is your accountability record for mentors and admins.",
  },
  {
    target: "learning-hub",
    title: "\u{1F4DA} Keep Learning",
    desc: "Access curated startup content, interactive tutorials, and cohort sessions. Great founders never stop learning \u2014 check here regularly for new content.",
  },
];

const internSteps: SidebarStep[] = [
  {
    target: "dashboard",
    title: "\u{1F44B} Welcome to StartupUniv, Intern!",
    desc: "This is your Dashboard \u2014 your home base. See your team, upcoming meetings, and your task progress all in one place.",
  },
  {
    target: "my-team",
    title: "\u{1F465} Meet Your Team",
    desc: "See everyone you\u2019re working with \u2014 your founder, co-founders, and mentor. Know who\u2019s who before you start contributing.",
  },
  {
    target: "tasks",
    title: "\u2705 Your Tasks \u2014 Most Important",
    desc: "Tasks assigned to you by your founder or mentor live here. This is your #1 priority. Complete tasks on time and mark them done.",
  },
  {
    target: "sprint-board",
    title: "\u{1F3C3} Sprint Board",
    desc: "See the full team\u2019s work board. Understand how your tasks fit into the bigger sprint goal and track overall team progress.",
  },
  {
    target: "meetings",
    title: "\u{1F4C5} Team Meetings",
    desc: "All team meetings you\u2019re invited to appear here. Each has a direct Google Meet join link. Show up on time \u2014 it matters.",
  },
  {
    target: "evidence",
    title: "\u{1F510} Upload Your Work",
    desc: "After completing a task, upload evidence here \u2014 a GitHub PR link, document, or demo video. This builds your portfolio and proves your contributions to mentors and admins.",
  },
  {
    target: "problem-statement",
    title: "\u{1F4C4} Problem Statement",
    desc: "Read the problem statement your team is working on. Understanding the core problem keeps all your contributions focused and meaningful.",
  },
  {
    target: "schedule",
    title: "\u{1F4C6} Your Program Schedule",
    desc: "See the full sprint timeline and program schedule. Know your deadlines, sprint start/end dates, and overall program progress at a glance.",
  },
  // Step removed with the stipends sidebar entry. A step whose target is gone still shows,
  // just without a highlight, so it would describe something the learner cannot see.
  // {
  //   target: "stipends",
  //   title: "\u20B9 Stipends",
  //   desc: "Track your stipend status and upcoming disbursements. Your stipend is tied to sprint completion \u2014 stay on track with your tasks to unlock each payment.",
  // },
  {
    target: "analytics",
    title: "\u{1F4CA} Your Analytics",
    desc: "See your personal performance metrics \u2014 task completion rate, points earned, sprint progress, and your profile standing in the team. This is your performance dashboard.",
  },
  {
    target: "learning-hub",
    title: "\u{1F4DA} Keep Learning",
    desc: "Access courses and cohort sessions assigned to your program. Learning here supports the real work you\u2019re doing with your team.",
  },
  // Step removed with the open challenges sidebar entry. A step whose target is gone still shows,
  // just without a highlight, so it would describe something the learner cannot see.
  // {
  //   target: "open-challenges",
  //   title: "\u{1F50D} Open Challenges",
  //   desc: "Browse problem statements from other founders. Great context for understanding what the platform is solving at a bigger scale.",
  // },
  // Step removed with the applications sidebar entry. A step whose target is gone still shows,
  // just without a highlight, so it would describe something the learner cannot see.
  // {
  //   target: "applications",
  //   title: "\u{1F4E8} Your Applications",
  //   desc: "Track invitations you\u2019ve received from founders. Accept or reject team invitations, and see the status of applications you\u2019ve sent.",
  // },
  {
    target: "notifications",
    title: "\u{1F514} Notifications",
    desc: "Stay updated on team activity \u2014 task assignments, meeting invites, application updates, and more. Check here regularly so nothing slips through.",
  },
  {
    target: "settings",
    title: "\u2699\uFE0F Settings",
    desc: "Customize your experience \u2014 update your profile, change your theme, manage notification preferences, and control Platform Tour and Page Guide visibility.",
  },
];

function getStepsForRole(role: string): SidebarStep[] {
  if (role === "LEARNER") return internSteps;
  return founderSteps;
}

const SIDEBAR_W = 260;
const CARD_W = 288;
const CARD_GAP = 12;

function getTargetEl(key: string): HTMLElement | null {
  return document.querySelector(`[data-sidebar-tour="${key}"]`);
}

function triggerConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:10001;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const colors = [
    "#1e2d4d",
    "#4CAF50",
    "#FF9800",
    "#E91E63",
    "#2196F3",
    "#9C27B0",
    "#FFD700",
  ];

  const particles = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    size: Math.random() * 6 + 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 3 + 2,
    drift: Math.random() * 2 - 1,
    isRect: Math.random() > 0.5,
  }));

  const start = Date.now();

  function animate() {
    if (Date.now() - start > 3000) {
      canvas.remove();
      return;
    }
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.y += p.speed;
      p.x += p.drift;
      ctx!.fillStyle = p.color;
      if (p.isRect) {
        ctx!.fillRect(p.x, p.y, p.size, p.size * 0.6);
      } else {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx!.fill();
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
}

export function SidebarTour() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const { dismissWelcome } = useTourContext();
  const userId = user?.id || "";
  const role = user?.role || "";
  const steps = getStepsForRole(role);

  const { data: experienceFlags } = useQuery<{
    hasSeenRolesResponsibilities: boolean;
    hasSeenSidebarTooltip: boolean;
  }>({
    queryKey: ["/api/auth/experience-flags"],
    queryFn: () => apiRequest("GET", "/api/auth/experience-flags"),
    enabled: !!userId,
  });

  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const closingRef = useRef(false);

  // Start only when account flags say roles modal is completed and sidebar tooltip is not yet completed.
  useEffect(() => {
    if (!userId || !role || !experienceFlags) return;

    const supportedRoles = ['FOUNDER', 'LEARNER'];
    if (!supportedRoles.includes(role)) return;

    if (experienceFlags.hasSeenSidebarTooltip) return;
    if (!experienceFlags.hasSeenRolesResponsibilities) return;

    // Dismiss the global welcome modal so both don't show simultaneously
    dismissWelcome();
    // Small delay so sidebar DOM is ready
    const timerRef = setTimeout(() => setVisible(true), 800);

    return () => {
      clearTimeout(timerRef);
    };
  }, [userId, role, experienceFlags, dismissWelcome]);

  // Listen for restart event (from Settings → Replay Sidebar Tour)
  useEffect(() => {
    const handler = () => {
      dismissWelcome();
      closingRef.current = false;
      setCurrent(0);
      setVisible(true);
    };
    window.addEventListener("restart-sidebar-tour", handler);
    return () => window.removeEventListener("restart-sidebar-tour", handler);
  }, [dismissWelcome]);

  // Position highlight around current target
  const positionStep = useCallback(
    (idx: number) => {
      if (idx >= steps.length) return; // final modal, no target
      const el = getTargetEl(steps[idx].target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    },
    [steps]
  );

  // When current step changes, reposition
  useEffect(() => {
    if (!visible) return;
    setFadeIn(false);
    const t1 = setTimeout(() => {
      if (current < steps.length) {
        positionStep(current);
      } else {
        setTargetRect(null);
      }
      const t2 = setTimeout(() => setFadeIn(true), 30);
      return () => clearTimeout(t2);
    }, 30);
    return () => clearTimeout(t1);
  }, [visible, current, positionStep, steps.length]);

  // Reposition on resize
  useEffect(() => {
    if (!visible || current >= steps.length) return;
    const handler = () => positionStep(current);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [visible, current, positionStep, steps.length]);

  // Click listeners on sidebar nav items to jump to that step
  useEffect(() => {
    if (!visible) return;

    const handlers: Array<{ el: Element; fn: EventListener }> = [];

    steps.forEach((step, index) => {
      const el = document.querySelector(
        `[data-sidebar-tour="${step.target}"]`
      );
      if (!el) return;

      const fn = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        goToStep(index);
      };
      el.addEventListener("click", fn);
      handlers.push({ el, fn });
    });

    return () => {
      handlers.forEach(({ el, fn }) => el.removeEventListener("click", fn));
    };
  }, [visible, steps]);

  // Skip/close without celebration
  const finish = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (userId) {
      void apiRequest("PATCH", "/api/auth/experience-flags", {
        hasSeenSidebarTooltip: true,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/experience-flags"] });
      });
    }
    // Also mark the global welcome tour as completed so it doesn't restart
    localStorage.setItem("sv_tour_completed", "true");
    setVisible(false);
  }, [userId]);

  // Final button click: navigate to dashboard + show completion celebration
  const completeTour = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;

    // Step 1: Navigate to dashboard first
    navigate("/app/dashboard");
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Step 2: Mark tour as complete (account-scoped)
    if (userId) {
      await apiRequest("PATCH", "/api/auth/experience-flags", {
        hasSeenSidebarTooltip: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/experience-flags"] });
    }
    localStorage.setItem("sv_tour_completed", "true");

    // Step 3: Hide the sidebar tour overlay
    setVisible(false);

    // Step 4: Show completion modal + confetti
    triggerConfetti();
    setShowCompletion(true);
  }, [userId, navigate]);

  const goToStep = useCallback(
    async (index: number) => {
      if (index >= steps.length) {
        // Moving past last step → show final modal
        setCurrent(steps.length);
        return;
      }
      if (index < 0) return;

      const step = steps[index];

      // 1. First navigate if needed
      if (step.route && location !== step.route) {
        navigate(step.route);
        // 2. Wait for navigation + render to complete
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      // 3. THEN update the step index
      setCurrent(index);
    },
    [steps, location, navigate, steps.length]
  );

  if (!visible && !showCompletion) return null;

  const isFinal = current >= steps.length;
  const stepData = isFinal ? null : steps[current];

  // Tooltip vertical position: aligned to target center, clamped to viewport
  let tipTop = 100;
  if (targetRect) {
    tipTop = targetRect.top + targetRect.height / 2 - 80;
    tipTop = Math.max(12, Math.min(tipTop, window.innerHeight - 260));
  }

  return (
    <>
      {/* Sidebar tour overlay */}
      {visible &&
        createPortal(
          <>
            {/* Main content overlay */}
            <div
              className="fixed z-[9997]"
              style={{
                top: 0,
                left: SIDEBAR_W,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.6)",
              }}
              onClick={finish}
            />

            {/* Sidebar overlay (dimming) */}
            <div
              className="fixed z-[9997]"
              style={{
                top: 0,
                left: 0,
                width: SIDEBAR_W,
                bottom: 0,
                background: "rgba(0,0,0,0.3)",
                pointerEvents: "none",
              }}
            />

            {/* Highlight box around target nav item */}
            {targetRect && !isFinal && (
              <div
                className="fixed z-[9998]"
                style={{
                  top: targetRect.top - 4,
                  left: targetRect.left - 4,
                  width: targetRect.width + 8,
                  height: targetRect.height + 8,
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: 8,
                  pointerEvents: "none",
                  transition:
                    "top 250ms ease, left 250ms ease, width 250ms ease, height 250ms ease",
                }}
              />
            )}

            {/* Tooltip card (non-final steps) */}
            {!isFinal && stepData && (
              <div
                className="fixed z-[9999]"
                style={{
                  top: tipTop,
                  left: SIDEBAR_W + CARD_GAP,
                  width: CARD_W,
                  opacity: fadeIn ? 1 : 0,
                  transform: fadeIn ? "translateX(0)" : "translateX(-8px)",
                  transition: "opacity 150ms ease, transform 150ms ease",
                }}
              >
                {/* Arrow pointing left toward sidebar */}
                <div
                  style={{
                    position: "absolute",
                    left: -8,
                    top: 36,
                    width: 0,
                    height: 0,
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                    borderRight: "8px solid white",
                  }}
                />
                <div className="bg-white rounded-2xl shadow-2xl p-5">
                  <p className="text-xs text-gray-400 mb-1">
                    Step {current + 1} of {steps.length}
                  </p>
                  <h3 className="text-base font-bold text-gray-900 mb-2">
                    {stepData.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {stepData.desc}
                  </p>
                  <div className="flex justify-between items-center">
                    <button
                      onClick={finish}
                      className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer transition-colors"
                    >
                      Skip
                    </button>
                    <div className="flex items-center gap-2">
                      {current > 0 && (
                        <button
                          onClick={() => goToStep(current - 1)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          {"\u2190"} Back
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (current === steps.length - 1) {
                            completeTour();
                          } else {
                            goToStep(current + 1);
                          }
                        }}
                        className="bg-[#1e2d4d] text-white rounded-lg px-4 py-1.5 text-xs font-medium hover:bg-[#162240] transition-colors"
                      >
                        {current === steps.length - 1 ? "Finish \u2713" : `Next \u2192`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )}

      {/* Completion celebration modal */}
      {showCompletion &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center z-[10000]"
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4 text-center flex flex-col items-center gap-4">
              {role === "LEARNER" ? (
                <>
                  <div className="text-5xl">🌟</div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    You're All Set, Intern!
                  </h2>
                  <p className="text-base text-gray-600 leading-relaxed">
                    You know your way around. Start by checking your Tasks —
                    that's your #1 priority on this platform.
                    <br />
                    <br />
                    💡 Use the 'Page Guide' button on any page to explore that
                    page's features in detail.
                  </p>
                  <button
                    onClick={() => setShowCompletion(false)}
                    className="bg-[#1e2d4d] text-white rounded-xl px-8 py-3 text-base font-semibold hover:bg-[#162240] transition-colors"
                  >
                    Let's Contribute! 💪
                  </button>
                </>
              ) : (
                <>
                  <div className="text-5xl">🎉</div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    You're All Set, Founder!
                  </h2>
                  <p className="text-base text-gray-600 leading-relaxed">
                    Your startup command center is ready. Begin by submitting
                    your Problem Statement — that's where every great startup
                    starts.
                    <br />
                    <br />
                    💡 Use the 'Page Guide' button on any page to get a detailed
                    walkthrough of that page's specific features.
                  </p>
                  <button
                    onClick={() => setShowCompletion(false)}
                    className="bg-[#1e2d4d] text-white rounded-xl px-8 py-3 text-base font-semibold hover:bg-[#162240] transition-colors"
                  >
                    Start Building! 🚀
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
