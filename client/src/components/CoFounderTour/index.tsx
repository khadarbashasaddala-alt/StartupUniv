import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { tourSteps } from "./tour-steps";
import { TourUI, TourCompletionModal } from "./TourUI";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";
import confetti from "canvas-confetti";

function fireCompletionConfetti() {
  // Create a dedicated canvas so we own the z-index, dimensions, and worker
  // settings — avoids the shared-canvas / web-worker silent-fail problem.
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:999999;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  // useWorker:false → synchronous canvas rendering, no OffscreenCanvas/Worker issues
  const fire = (confetti as any).create(canvas, { resize: false, useWorker: false });

  const colors = ["#1e3a5f", "#3b82f6", "#ffffff", "#fbbf24", "#f87171", "#34d399"];
  const end = Date.now() + 3500;

  // Side poppers
  fire({ particleCount: 130, angle: 60,  spread: 75, origin: { x: 0,   y: 1 }, colors, startVelocity: 55 });
  fire({ particleCount: 130, angle: 120, spread: 75, origin: { x: 1,   y: 1 }, colors, startVelocity: 55 });

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

export function CoFounderTour() {
  const { user, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: stats } = useQuery({
    queryKey: ["/api/founder/stats"],
    queryFn: () => apiRequest("GET", "/api/founder/stats"),
    enabled: !!user && user.role === "COFOUNDER",
  });

  const { data: receivedApplications } = useQuery({
    queryKey: ["/api/team-member-applications/received"],
    queryFn: () => apiRequest("GET", "/api/team-member-applications/received"),
    enabled: !!user && user.role === "COFOUNDER",
  });

  const { data: experienceFlags } = useQuery<{
    hasSeenRolesResponsibilities: boolean;
    hasSeenSidebarTooltip: boolean;
  }>({
    queryKey: ["/api/auth/experience-flags"],
    queryFn: () => apiRequest("GET", "/api/auth/experience-flags"),
    enabled: !!user && user.role === "COFOUNDER",
  });

  const hasPendingInvitation = receivedApplications?.some((a: any) => a.status === "PENDING") || false;
  const hasTeam = stats?.hasTeam || false;

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isSkipped, setIsSkipped] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [hasTourBeenDismissed, setHasTourBeenDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [platformTourButtonVisible, setPlatformTourButtonVisible] = useState(
    () => localStorage.getItem("sv_cofounder_platform_tour_disabled") !== "true"
  );

  // Ref always holding the latest currentStep — avoids stale closure in the sidebar click handler
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  useEffect(() => {
    const handler = () => {
      setPlatformTourButtonVisible(
        localStorage.getItem("sv_cofounder_platform_tour_disabled") !== "true"
      );
    };
    window.addEventListener("cofounder-platform-tour-visibility-changed", handler);
    return () => window.removeEventListener("cofounder-platform-tour-visibility-changed", handler);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user || user.role !== "COFOUNDER") return;
    // Wait until experienceFlags have loaded
    if (!experienceFlags) return;
    // Do not auto-trigger the Platform Tour until the co-founder has seen the
    // Roles & Responsibilities modal. This prevents the tour and the modal from
    // appearing simultaneously on first login.
    if (!experienceFlags.hasSeenRolesResponsibilities) return;

    const cacheKey = `sv-co-founder-tour-${user.id}`;
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      const state = JSON.parse(stored);
      setCurrentStep(state.currentStep || 0);
      setIsSkipped(state.isSkipped || false);
      setIsCompleted(state.isCompleted || false);
      if (state.isSkipped || state.isCompleted) {
        setHasTourBeenDismissed(true);
      }
      if (!state.isSkipped && !state.isCompleted && state.currentStep < tourSteps.length) {
        setIsTourActive(true);
      }
    } else {
      setIsTourActive(true);
    }
  }, [user, experienceFlags]);

  const saveState = (step: number, skipped: boolean, completed: boolean) => {
    if (!user) return;
    const cacheKey = `sv-co-founder-tour-${user.id}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      currentStep: step,
      isSkipped: skipped,
      isCompleted: completed,
    }));
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveState(nextStep, false, false);
    } else {
      // Last step — stop tour, fire confetti immediately, then show modal
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
    // hasTourBeenDismissed intentionally NOT reset — keeps button visible
    setIsTourActive(true);
    saveState(0, false, false);
    // Navigate to dashboard so all sidebar targets are in the DOM
    if (location !== "/app") {
      setLocation("/app");
    }
  };

  const handleGoToDashboard = () => {
    setShowCompletionModal(false);
    setIsCompleted(true);
    setIsTourActive(false);
    setHasTourBeenDismissed(true);
    saveState(currentStep, false, true);
    if (location !== "/app") {
      setLocation("/app");
    }
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
      for (let i = 0; i < tourSteps.length; i++) {
        try {
          const el = document.querySelector(tourSteps[i].targetSelector);
          if (el && el.contains(clicked)) {
            // Prevent the sidebar link from navigating away — tour stays on dashboard
            e.preventDefault();
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

  if (authLoading || !mounted || user?.role !== "COFOUNDER") return null;

  const headerLeftGroup = document.querySelector('header > div:first-child');

  const tourContext = {
    hasTeam,
    hasPendingInvitation,
    userName: user?.name?.split(' ')[0] || "there",
    avatarUrl: user?.avatarUrl,
  };

  return (
    <>
      {isTourActive && (
        <TourUI
          step={tourSteps[currentStep]}
          currentStepIndex={currentStep}
          totalSteps={tourSteps.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          context={tourContext}
        />
      )}

      {showCompletionModal && (
        <TourCompletionModal
          onClose={handleGoToDashboard}
          userName={tourContext.userName}
          avatarUrl={tourContext.avatarUrl || ""}
          hasTeam={hasTeam}
        />
      )}

      {headerLeftGroup && hasTourBeenDismissed && !isTourActive && !showCompletionModal && platformTourButtonVisible && createPortal(
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