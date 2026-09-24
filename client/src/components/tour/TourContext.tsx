import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { tourSteps, pageTours, type PageTourStep } from "./tourSteps";

const TOUR_KEY = "sv_tour_completed";

export type TourMode = "global" | "page";

interface TourState {
  isRunning: boolean;
  showWelcome: boolean;
  currentStep: number;
  totalSteps: number;
  step: any | null;
  mode: TourMode;
  activePageKey: string | null;
  startTour: () => void;
  dismissWelcome: () => void;
  startPageTour: (pageKey: string) => void;
  startPageTourIfFirst: (pageKey: string) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  restart: () => void;
}

const TourContext = createContext<TourState | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mode, setMode] = useState<TourMode>("global");
  const [activePageKey, setActivePageKey] = useState<string | null>(null);
  const [pageSteps, setPageSteps] = useState<PageTourStep[]>([]);

  const totalSteps = mode === "page" ? pageSteps.length : tourSteps.length;
  const isRunning = currentStep >= 0;

  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY) !== "true") {
      setShowWelcome(true);
    }
  }, []);

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

  const startPageTour = useCallback((pageKey: string) => {
    const steps = pageTours[pageKey];
    if (!steps || steps.length === 0) return;
    setMode("page");
    setActivePageKey(pageKey);
    setPageSteps(steps);
    setShowWelcome(false);
    setCurrentStep(0);
  }, []);

  // Fires the page tour only the first time this pageKey is visited.
  // Subsequent manual clicks use startPageTour directly.
  const startPageTourIfFirst = useCallback((pageKey: string) => {
    // Don't start a page guide while the mentor Platform Tour is running
    if ((window as any).__svMentorPlatformTourActive) return;
    const seenKey = `sv_ptour_seen_${pageKey}`;
    if (localStorage.getItem(seenKey) === "true") return;
    localStorage.setItem(seenKey, "true");
    const steps = pageTours[pageKey];
    if (!steps || steps.length === 0) return;
    // Small delay so the page DOM is fully rendered
    const t = setTimeout(() => {
      setMode("page");
      setActivePageKey(pageKey);
      setPageSteps(steps);
      setShowWelcome(false);
      setCurrentStep(0);
    }, 700);
    return () => clearTimeout(t);
  }, []);

  const next = useCallback(() => {
    const max = (mode === "page" ? pageSteps.length : tourSteps.length) - 1;
    setCurrentStep((prev) => {
      if (prev >= max) {
        if (mode === "global") localStorage.setItem(TOUR_KEY, "true");
        if (mode === "page" && activePageKey) localStorage.setItem(`sv_ptour_seen_${activePageKey}`, "true");
        return -1;
      }
      return Math.min(prev + 1, max);
    });
  }, [mode, pageSteps.length, activePageKey]);

  const prev = useCallback(() => {
    setCurrentStep((p) => Math.max(0, p - 1));
  }, []);

  const skip = useCallback(() => {
    setCurrentStep(-1);
    if (mode === "global") localStorage.setItem(TOUR_KEY, "true");
    if (mode === "page" && activePageKey) localStorage.setItem(`sv_ptour_seen_${activePageKey}`, "true");
  }, [mode, activePageKey]);

  const restart = useCallback(() => {
    if (mode === "global") {
      localStorage.removeItem(TOUR_KEY);
    }
    setCurrentStep(0);
  }, [mode]);

  const step = isRunning
    ? mode === "page"
      ? pageSteps[Math.min(currentStep, pageSteps.length - 1)] ?? null
      : tourSteps[Math.min(currentStep, tourSteps.length - 1)] ?? null
    : null;

  return (
    <TourContext.Provider
      value={{
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
        startPageTourIfFirst,
        next,
        prev,
        skip,
        restart,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const ctx = useContext(TourContext);
  if (!ctx) {
    // Return safe no-op fallback when used outside provider (e.g. non-founder users)
    return {
      isRunning: false,
      showWelcome: false,
      currentStep: -1,
      totalSteps: 0,
      step: null,
      mode: "global" as TourMode,
      activePageKey: null,
      startTour: () => {},
      dismissWelcome: () => {},
      startPageTour: () => {},
      startPageTourIfFirst: () => {},
      next: () => {},
      prev: () => {},
      skip: () => {},
      restart: () => {},
    };
  }
  return ctx;
}
