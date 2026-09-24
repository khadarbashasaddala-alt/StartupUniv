import { useState, useCallback, useEffect } from "react";
import { tourSteps, pageTours, type PageTourStep } from "./tourSteps";

const TOUR_KEY = "sv_tour_completed";

export type TourMode = "global" | "page";

export function useTour() {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not running
  const [showWelcome, setShowWelcome] = useState(false);
  const [mode, setMode] = useState<TourMode>("global");
  const [activePageKey, setActivePageKey] = useState<string | null>(null);
  const [pageSteps, setPageSteps] = useState<PageTourStep[]>([]);

  const totalSteps = mode === "page" ? pageSteps.length : tourSteps.length;
  const isRunning = currentStep >= 0;

  // Auto-start for first-time users (global tour welcome)
  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY) !== "true") {
      setShowWelcome(true);
    }
  }, []);

  /* ── Global tour controls ── */
  const startTour = useCallback(() => {
    setShowWelcome(false);
    setMode("global");
    setActivePageKey(null);
    setPageSteps([]);
    setCurrentStep(0);
  }, []);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem(TOUR_KEY, "true");
  }, []);

  /* ── Page tour controls ── */
  const startPageTour = useCallback((pageKey: string) => {
    const steps = pageTours[pageKey];
    if (!steps || steps.length === 0) return;
    setMode("page");
    setActivePageKey(pageKey);
    setPageSteps(steps);
    setShowWelcome(false);
    setCurrentStep(0);
  }, []);

  /* ── Navigation ── */
  const next = useCallback(() => {
    setCurrentStep((prev) => {
      const max = (mode === "page" ? pageSteps.length : tourSteps.length) - 1;
      if (prev >= max) {
        if (mode === "global") localStorage.setItem(TOUR_KEY, "true");
        return -1; // end tour
      }
      return Math.min(prev + 1, max);
    });
  }, [mode, pageSteps.length]);

  const prev = useCallback(() => {
    setCurrentStep((p) => Math.max(0, p - 1));
  }, []);

  const skip = useCallback(() => {
    setCurrentStep(-1);
    if (mode === "global") localStorage.setItem(TOUR_KEY, "true");
  }, [mode]);

  const restart = useCallback(() => {
    if (mode === "global") {
      localStorage.removeItem(TOUR_KEY);
    }
    setCurrentStep(0);
  }, [mode]);

  // Current step data
  const step = isRunning
    ? mode === "page"
      ? pageSteps[Math.min(currentStep, pageSteps.length - 1)] ?? null
      : tourSteps[Math.min(currentStep, tourSteps.length - 1)] ?? null
    : null;

  return {
    isRunning,
    showWelcome,
    currentStep,
    totalSteps,
    step,
    mode,
    activePageKey,
    startTour,
    dismissWelcome,
    startPageTour,
    next,
    prev,
    skip,
    restart,
  };
}
