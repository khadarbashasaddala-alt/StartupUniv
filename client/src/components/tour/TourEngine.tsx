import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useTourContext } from "./TourContext";

/* ─── Types ─── */
type Placement = "top" | "bottom" | "left" | "right";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const GAP = 12;
const TIP_W = 320;
const TIP_H = 220;
const NAV_DELAY = 600;           // ms to wait after page navigation
const SCROLL_DELAY = 400;        // ms to wait for smooth scroll to settle
const SPOTLIGHT_TRANSITION = 300; // ms — must match CSS transition duration

/* ─── CSS injected once ─── */
const STYLE_ID = "tour-engine-styles";
function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes tour-pulse {
      0%, 100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 0 rgba(255,255,255,0.4); }
      50%      { box-shadow: 0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 6px rgba(255,255,255,0.15); }
    }
    .tour-spotlight {
      animation: tour-pulse 2s ease-in-out infinite;
      border: 2px solid rgba(255,255,255,0.4);
      transition: top 300ms ease, left 300ms ease, width 300ms ease, height 300ms ease, box-shadow 300ms ease;
    }
  `;
  document.head.appendChild(style);
}

/* ─── Helpers ─── */
function getEl(target: string): HTMLElement | null {
  return document.querySelector(`[data-tour="${target}"]`);
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function hasSpace(rect: Rect, place: Placement): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  switch (place) {
    case "bottom": return vh - (rect.top + rect.height + PAD) >= TIP_H + GAP;
    case "top":    return rect.top - PAD >= TIP_H + GAP;
    case "right":  return vw - (rect.left + rect.width + PAD) >= TIP_W + GAP;
    case "left":   return rect.left - PAD >= TIP_W + GAP;
  }
}

function bestPlacement(rect: Rect, pref?: Placement): Placement {
  const priority: Placement[] = ["bottom", "top", "right", "left"];
  if (pref && hasSpace(rect, pref)) return pref;
  return priority.find((p) => hasSpace(rect, p)) ?? "bottom";
}

function calcTipPos(rect: Rect, place: Placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const MARGIN = 12; // min distance from any viewport edge

  // Anchor lines that guarantee the gap between tooltip edge and target spotlight
  const anchorBelow  = rect.top  + rect.height + PAD + GAP; // min top  for "bottom"
  const anchorAbove  = rect.top  - PAD - GAP - TIP_H;       // max top  for "top"
  const anchorRight  = rect.left + rect.width  + PAD + GAP; // min left for "right"
  const anchorLeft   = rect.left - PAD - GAP - TIP_W;       // max left for "left"

  let top: number;
  let left: number;

  switch (place) {
    case "bottom":
      // Fix the top at the anchor — never clamp it upward (that would overlap)
      top  = anchorBelow;
      // Float the horizontal position, clamped to viewport edges
      left = rect.left + rect.width / 2 - TIP_W / 2;
      left = Math.max(MARGIN, Math.min(left, vw - TIP_W - MARGIN));
      break;

    case "top":
      // Fix the top at the anchor — never clamp it downward (that would overlap)
      top  = anchorAbove;
      left = rect.left + rect.width / 2 - TIP_W / 2;
      left = Math.max(MARGIN, Math.min(left, vw - TIP_W - MARGIN));
      break;

    case "right":
      // Fix the left at the anchor — never clamp it leftward (that would overlap)
      left = anchorRight;
      // Float the vertical position, clamped to viewport edges
      top  = rect.top + rect.height / 2 - TIP_H / 2;
      top  = Math.max(MARGIN, Math.min(top, vh - TIP_H - MARGIN));
      break;

    case "left":
      // Fix the left at the anchor — never clamp it rightward (that would overlap)
      left = anchorLeft;
      top  = rect.top + rect.height / 2 - TIP_H / 2;
      top  = Math.max(MARGIN, Math.min(top, vh - TIP_H - MARGIN));
      break;
  }

  // Hard clamp — safety net so the card never exits the viewport
  top  = Math.max(MARGIN, Math.min(top,  window.innerHeight - TIP_H - MARGIN));
  left = Math.max(MARGIN, Math.min(left, window.innerWidth  - TIP_W - MARGIN));

  return { top, left };
}

/* ─── Spotlight Overlay ─── */
function SpotlightOverlay({ rect, onClick }: { rect: Rect | null; onClick: () => void }) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{ background: "rgba(0,0,0,0.55)" }}
      />
    );
  }
  const x = rect.left - PAD;
  const y = rect.top - PAD;
  const w = rect.width + 2 * PAD;
  const h = rect.height + 2 * PAD;
  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none" onClick={onClick}>
      <div
        className="absolute pointer-events-auto tour-spotlight"
        style={{ top: y, left: x, width: w, height: h, borderRadius: 8 }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/* ─── Welcome Modal ─── */
function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" style={{ background: "rgba(0,0,0,0.6)" }} />
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <h2 className="text-2xl font-bold text-[#1e2d4d] mb-3">Welcome to StartupUniv 👋</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            You're 2 minutes away from knowing everything. Let us show you around — or skip and explore on your own.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onStart}
              className="px-6 py-2.5 rounded-lg bg-[#1e2d4d] text-white font-medium hover:bg-[#162240] transition-colors"
            >
              Start Tour
            </button>
            <button
              onClick={onSkip}
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ─── Tooltip Card ─── */
function TooltipCard({
  title,
  description,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  style,
  isLast,
  visible,
  isPageTour,
}: {
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  style: React.CSSProperties;
  isLast: boolean;
  visible: boolean;
  isPageTour: boolean;
}) {
  return (
    <div
      className="fixed z-[9999] bg-white rounded-2xl shadow-2xl p-6 w-80"
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 150ms ease, transform 150ms ease",
        pointerEvents: "all",
      }}
    >
      <p className="text-xs text-gray-400 mb-1">
        Step {stepIndex + 1} of {totalSteps}
      </p>
      <h3 className="text-lg font-bold text-[#1e2d4d] mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed mb-5">{description}</p>
      {isLast && isPageTour && (
        <p className="text-xs text-green-600 font-medium mb-3">✓ Done exploring this page!</p>
      )}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {isPageTour ? "Close" : "Skip Tour"}
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={onPrev}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          )}
          <button
            onClick={onNext}
            className="px-4 py-1.5 rounded-lg bg-[#1e2d4d] text-white text-sm font-medium hover:bg-[#162240] transition-colors"
          >
            {isLast ? (isPageTour ? "Done" : "Let's Go!") : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Center Modal (final step of global tour) ─── */
function CenterModal({
  title,
  description,
  stepIndex,
  totalSteps,
  onFinish,
}: {
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  onFinish: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <p className="text-xs text-gray-400 mb-2">
          Step {stepIndex + 1} of {totalSteps}
        </p>
        <h2 className="text-2xl font-bold text-[#1e2d4d] mb-3">{title}</h2>
        <p className="text-gray-600 leading-relaxed mb-8">{description}</p>
        <button
          onClick={onFinish}
          className="px-8 py-2.5 rounded-lg bg-[#1e2d4d] text-white font-medium hover:bg-[#162240] transition-colors"
        >
          Let's Go!
        </button>
      </div>
    </div>
  );
}

/* ─── Main TourEngine ─── */
export function TourEngine() {
  const [location, setLocation] = useLocation();
  const {
    isRunning,
    showWelcome,
    currentStep,
    totalSteps,
    step,
    mode,
    startTour,
    dismissWelcome,
    next,
    prev,
    skip,
  } = useTourContext();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const navigatingRef = useRef(false);

  useEffect(ensureStyles, []);

  // Reset visible state when the tour stops so there's no flash on next open
  useEffect(() => {
    if (!isRunning) {
      setVisible(false);
      setTargetRect(null);
    }
  }, [isRunning]);

  /* Helper to get current step's target string */
  const getStepTarget = useCallback((): string | undefined => {
    if (!step) return undefined;
    if (mode === "page") {
      return (step as { target?: string }).target;
    }
    return (step as { target?: string }).target;
  }, [step, mode]);

  /* Helper to get current step's preferred position */
  const getStepPosition = useCallback((): Placement | undefined => {
    if (!step) return undefined;
    return (step as { position?: Placement }).position;
  }, [step]);

  const shouldScrollToStep = useCallback((): boolean => {
    if (!step) return true;
    return (step as { scroll?: boolean }).scroll !== false;
  }, [step]);

  /* Helper to get current step's title/description */
  const getStepTitle = useCallback((): string => {
    if (!step) return "";
    return (step as { title: string }).title;
  }, [step]);

  const getStepDesc = useCallback((): string => {
    if (!step) return "";
    if (mode === "page") return (step as { desc: string }).desc;
    return (step as { description: string }).description;
  }, [step, mode]);

  /* Full step transition: scroll → spotlight glides → popover fades in */
  const positionTooltip = useCallback(() => {
    const target = getStepTarget();
    if (!target) return;
    const el = getEl(target);
    if (!el) {
      setTargetRect(null);
      setTipPos({
        top: window.innerHeight - TIP_H - 80,
        left: Math.max(12, window.innerWidth / 2 - TIP_W / 2),
      });
      setVisible(true);
      return;
    }

    const settleDelay = shouldScrollToStep() ? SCROLL_DELAY : 0;
    if (shouldScrollToStep()) {
      // Phase 1 — scroll to element
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Phase 2 — after optional scroll settles, move spotlight (CSS transition animates it)
    const t1 = setTimeout(() => {
      try {
        const r = getRect(el);
        setTargetRect(r);
        setTipPos(calcTipPos(r, bestPlacement(r, getStepPosition())));
      } catch {
        setTargetRect(null);
        setTipPos({ top: window.innerHeight - TIP_H - 80, left: 24 });
      }

      // Phase 3 — after spotlight finishes gliding, fade in popover
      setTimeout(() => setVisible(true), SPOTLIGHT_TRANSITION);
    }, settleDelay);

    return () => clearTimeout(t1);
  }, [getStepTarget, getStepPosition, shouldScrollToStep]);

  /* Reposition only (no scroll) — used by resize/scroll event handlers */
  const repositionOnly = useCallback(() => {
    const target = getStepTarget();
    if (!target) return;
    const el = getEl(target);
    if (!el) return;
    try {
      const r = getRect(el);
      setTargetRect(r);
      setTipPos(calcTipPos(r, bestPlacement(r, getStepPosition())));
    } catch { /* ignore */ }
  }, [getStepTarget, getStepPosition]);

  /* Core effect: navigate if needed (global), then position */
  useEffect(() => {
    if (!isRunning || !step) return;

    const target = getStepTarget();

    // Global tour: center modal for final step (no target element)
    if (mode === "global" && !target) {
      setTargetRect(null);
      setVisible(true);
      return;
    }

    setVisible(false);
    navigatingRef.current = false;

    // Global tour: navigate if needed
    if (mode === "global") {
      const route = (step as { route?: string }).route;
      if (route && route !== location) {
        navigatingRef.current = true;
        setLocation(route);
        const timer = setTimeout(() => {
          navigatingRef.current = false;
          positionTooltip();
        }, NAV_DELAY);
        return () => clearTimeout(timer);
      }
    }

    // Page tour OR already on correct route — position with small delay for DOM settle
    // Retry with increasing delays if target element not found (handles first-load timing)
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tryPosition = (delay: number, retriesLeft: number) => {
      const t = setTimeout(() => {
        const el = target ? getEl(target) : null;
        if (el || retriesLeft <= 0) {
          positionTooltip();
        } else {
          tryPosition(delay + 200, retriesLeft - 1);
        }
      }, delay);
      timers.push(t);
    };
    tryPosition(150, 3);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, currentStep, mode]);

  /* Re-position on resize / scroll (no scroll animation, just recalculate) */
  useEffect(() => {
    if (!isRunning || !getStepTarget()) return;
    const handler = () => {
      if (!navigatingRef.current) repositionOnly();
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isRunning, step, repositionOnly, getStepTarget]);

  /* ─── Render ─── */
  if (showWelcome) {
    return <WelcomeModal onStart={startTour} onSkip={dismissWelcome} />;
  }

  if (!isRunning || !step) return null;

  const target = getStepTarget();
  const isCenterModal = mode === "global" && !target;
  const isLast = currentStep === totalSteps - 1;
  const isPageTour = mode === "page";

  return createPortal(
    <>
      <SpotlightOverlay rect={targetRect} onClick={skip} />
      {isCenterModal ? (
        <CenterModal
          title={getStepTitle()}
          description={getStepDesc()}
          stepIndex={currentStep}
          totalSteps={totalSteps}
          onFinish={next}
        />
      ) : (
        <TooltipCard
          title={getStepTitle()}
          description={getStepDesc()}
          stepIndex={currentStep}
          totalSteps={totalSteps}
          onNext={next}
          onPrev={prev}
          onSkip={skip}
          style={{ top: tipPos.top, left: tipPos.left }}
          isLast={isLast}
          visible={visible}
          isPageTour={isPageTour}
        />
      )}
    </>,
    document.body,
  );
}
