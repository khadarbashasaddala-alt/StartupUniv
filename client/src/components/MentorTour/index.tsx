import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { mentorTourSteps } from "./tour-steps";
import { TourUI } from "@/components/CoFounderTour/TourUI";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

function fireCompletionConfetti() {
  console.log("[MentorTour] Firing confetti!");
  // Create a dedicated canvas to control z-index, dimensions, and worker settings.
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  // useWorker:false → synchronous canvas rendering; avoids OffscreenCanvas/Worker issues.
  const fire = (confetti as any).create(canvas, { resize: false, useWorker: false });

  const colors = ["#1e3a5f", "#3b82f6", "#ffffff", "#fbbf24", "#34d399", "#a78bfa"];
  const end = Date.now() + 3500;

  // Side poppers
  fire({ particleCount: 130, angle: 60,  spread: 75, origin: { x: 0, y: 1 }, colors, startVelocity: 55 });
  fire({ particleCount: 130, angle: 120, spread: 75, origin: { x: 1, y: 1 }, colors, startVelocity: 55 });

  // Continuous shower from the top
  const id = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(id);
      setTimeout(() => canvas.remove(), 800);
      return;
    }
    fire({ particleCount: 18, angle: 90, spread: 145, origin: { x: Math.random(), y: 0 }, colors, gravity: 0.7, drift: Math.random() * 0.6 - 0.3, scalar: 0.9 });
  }, 160);

  // Grand finale
  setTimeout(() => {
    fire({ particleCount: 220, angle: 90, spread: 220, origin: { x: 0.5, y: 0.5 }, colors, startVelocity: 40, gravity: 0.55, scalar: 1.1 });
  }, 3000);
}

function MentorCompletionModal({
  onClose,
  userName,
  avatarUrl,
}: {
  onClose: () => void;
  userName: string;
  avatarUrl: string;
}) {
  return (
    <div className="fixed inset-0 z-[99995] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-8 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-chart-5 via-primary to-chart-2 rounded-t-2xl" />

        <div className="text-5xl mb-4 mt-2">🎓</div>

        <Avatar className="h-20 w-20 mx-auto mb-5 border-4 border-primary shadow-lg">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">
            {userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          You're all set, {userName}! 🚀
        </h2>
        <p className="text-primary font-medium text-sm mb-3">
          Your mentorship journey starts now.
        </p>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          Your teams are counting on you — head to the Sprint Board to see what's in progress, or check Reviews for any pending feedback.
        </p>

        <Button
          size="lg"
          className="w-full text-base font-semibold bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          onClick={onClose}
        >
          Let's Go! 🚀
        </Button>
      </motion.div>
    </div>
  );
}

export function MentorTour() {
  const { user, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: experienceFlags } = useQuery<{
    hasSeenRolesResponsibilities: boolean;
    hasSeenSidebarTooltip: boolean;
  }>({
    queryKey: ["/api/auth/experience-flags"],
    queryFn: () => apiRequest("GET", "/api/auth/experience-flags"),
    enabled: !!user && user.role === "MENTOR",
  });

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isSkipped, setIsSkipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [hasTourBeenDismissed, setHasTourBeenDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [platformTourButtonVisible, setPlatformTourButtonVisible] = useState(() => {
    const id = user?.id || "";
    return id ? localStorage.getItem(`sv_platform_tour_disabled_${id}`) !== "true" : true;
  });

  // Ref always holding the latest currentStep — avoids stale closure in the sidebar click handler
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  useEffect(() => {
    if (!user?.id) return;
    const key = `sv_platform_tour_disabled_${user.id}`;
    const handler = () => {
      setPlatformTourButtonVisible(localStorage.getItem(key) !== "true");
    };
    handler();
    window.addEventListener("platform-tour-visibility-changed", handler);
    return () => window.removeEventListener("platform-tour-visibility-changed", handler);
  }, [user?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user || user.role !== "MENTOR") return;
    // Wait until experienceFlags have loaded
    if (!experienceFlags) return;
    // Do not auto-trigger the Platform Tour until the mentor has seen the
    // Roles & Responsibilities modal. This prevents the tour and the modal from
    // appearing simultaneously on first login.
    if (!experienceFlags.hasSeenRolesResponsibilities) return;

    const cacheKey = `sv-mentor-tour-${user.id}`;
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const state = JSON.parse(stored);
      setCurrentStep(state.currentStep || 0);
      setIsSkipped(state.isSkipped || false);
      setIsCompleted(state.isCompleted || false);
      if (state.isSkipped || state.isCompleted) {
        setHasTourBeenDismissed(true);
      }
      if (!state.isSkipped && !state.isCompleted && state.currentStep < mentorTourSteps.length) {
        setIsTourActive(true);
      }
    } else {
      setIsTourActive(true);
    }
  }, [user, experienceFlags]);

  const saveState = (step: number, skipped: boolean, completed: boolean) => {
    if (!user) return;
    const cacheKey = `sv-mentor-tour-${user.id}`;
    localStorage.setItem(cacheKey, JSON.stringify({ currentStep: step, isSkipped: skipped, isCompleted: completed }));
  };

  const handleNext = () => {
    if (currentStep < mentorTourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveState(nextStep, false, false);
    } else {
      setIsTourActive(false);
      setHasTourBeenDismissed(true);
      saveState(currentStep, false, true);
      fireCompletionConfetti();
      setShowCompletionModal(true);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveState(prevStep, false, false);
    }
  };

  const handleSkip = () => {
    setIsSkipped(true);
    setIsTourActive(false);
    setHasTourBeenDismissed(true);
    saveState(currentStep, true, false);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsSkipped(false);
    setIsCompleted(false);
    setShowCompletionModal(false);
    setIsTourActive(true);
    saveState(0, false, false);
    if (location !== "/app") setLocation("/app");
  };

  const handleGoToDashboard = () => {
    setShowCompletionModal(false);
    setIsCompleted(true);
    setIsTourActive(false);
    setHasTourBeenDismissed(true);
    saveState(currentStep, false, true);
    if (location !== "/app") setLocation("/app");
  };

  useEffect(() => {
    if (!isTourActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTourActive, currentStep]);

  // Sidebar click detection — when user clicks a sidebar link during the tour,
  // shift the tooltip to that link's corresponding step
  useEffect(() => {
    if (!isTourActive) return;
    const handleSidebarClick = (e: MouseEvent) => {
      const clicked = e.target as Element;
      for (let i = 0; i < mentorTourSteps.length; i++) {
        try {
          const el = document.querySelector(mentorTourSteps[i].targetSelector);
          if (el && el.contains(clicked)) {
            if (i !== currentStepRef.current) {
              setCurrentStep(i);
              saveState(i, false, false);
            }
            return;
          }
        } catch { /* ignore invalid selectors */ }
      }
    };
    document.addEventListener("click", handleSidebarClick, true);
    return () => document.removeEventListener("click", handleSidebarClick, true);
  }, [isTourActive]);

  if (authLoading || !mounted || user?.role !== "MENTOR") return null;

  const headerLeftGroup = document.querySelector("header > div:first-child");

  const tourContext = {
    hasTeam: true,
    hasPendingInvitation: false,
    userName: user?.name?.split(" ")[0] || "there",
    avatarUrl: user?.avatarUrl,
  };

  return (
    <>
      {isTourActive && (
        <TourUI
          step={mentorTourSteps[currentStep] as any}
          currentStepIndex={currentStep}
          totalSteps={mentorTourSteps.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          context={tourContext}
        />
      )}

      {showCompletionModal && (
        <MentorCompletionModal
          onClose={handleGoToDashboard}
          userName={tourContext.userName}
          avatarUrl={tourContext.avatarUrl || ""}
        />
      )}

      {headerLeftGroup &&
        hasTourBeenDismissed &&
        !isTourActive &&
        !showCompletionModal &&
        platformTourButtonVisible &&
        createPortal(
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestart}
            className="ml-4 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Platform Tour
          </Button>,
          headerLeftGroup
        )}
    </>
  );
}
