import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TourStep } from "./tour-steps";

export interface TourUIProps {
  step: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  context: any;
}

function renderWithBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

export function TourUI({ step, currentStepIndex, totalSteps, onNext, onPrev, onSkip, context }: TourUIProps) {
  // liveRect: continuously polled from rAF. null when element not found.
  const [liveRect, setLiveRect] = useState<DOMRect | null>(null);
  // displayRect: persists between steps so the spotlight smoothly slides
  // from the old element to the new one rather than jumping.
  const [displayRect, setDisplayRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    let timeoutId: any;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      }, 100);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let rafId: number;
    let hasScrolled = false;

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setLiveRect(rect);
        setDisplayRect(rect);
        if (!hasScrolled) {
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          hasScrolled = true;
        }
      } else {
        setLiveRect(null);
      }
      rafId = requestAnimationFrame(updateRect);
    };
    rafId = requestAnimationFrame(updateRect);
    return () => {
      cancelAnimationFrame(rafId);
      // Reset liveRect when step changes but keep displayRect so the spotlight
      // stays at the last known position while the new element is being found.
      setLiveRect(null);
    };
  }, [step]);

  // Track navigation direction so the slide animates correctly.
  // 1 = going forward (Next), -1 = going backward (Prev).
  const prevStepIndexRef = useRef(currentStepIndex);
  const [direction, setDirection] = useState(1);
  useEffect(() => {
    if (currentStepIndex > prevStepIndexRef.current) {
      setDirection(1);
    } else if (currentStepIndex < prevStepIndexRef.current) {
      setDirection(-1);
    }
    prevStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // Tooltip is shown as soon as the target element is found in the DOM.
  const isTooltipReady = liveRect !== null;

  // Nothing to render at all until we've located the element at least once.
  if (!displayRect) {
    return null;
  }

  const tooltipWidth = 350;
  // Use a generous height estimate so bottom-of-screen clamping is reliable.
  // The actual card can exceed 250 px when the description is long.
  const tooltipHeight = 360;
  const margin = 16;

  // Determine whether the target is in the bottom half of the screen.
  const targetMidY = displayRect.top + displayRect.height / 2;
  const inBottomHalf = targetMidY > windowSize.height * 0.5;

  // Default: place to the right of the target, vertically aligned with its top.
  let tooltipTop = displayRect.top;
  let tooltipLeft = displayRect.right + margin;

  // Special case: element is in the top-right corner → drop below it.
  if (displayRect.right > windowSize.width * 0.6 && displayRect.top < windowSize.height * 0.2) {
    tooltipTop = displayRect.bottom + margin;
    tooltipLeft = displayRect.left - tooltipWidth + displayRect.width;
  }

  // If placing to the right would overflow, try the left side instead.
  if (tooltipLeft + tooltipWidth > windowSize.width - margin) {
    tooltipLeft = displayRect.left - tooltipWidth - margin;
  }

  // If the target is in the bottom half of the screen, anchor the tooltip so
  // its BOTTOM edge aligns near the target rather than its top — this stops it
  // from running off the bottom of the viewport.
  if (inBottomHalf) {
    tooltipTop = displayRect.bottom - tooltipHeight;
  }

  // Final guardrails: keep fully within the viewport on all sides.
  if (tooltipLeft + tooltipWidth > windowSize.width - margin) tooltipLeft = windowSize.width - tooltipWidth - margin;
  if (tooltipLeft < margin) tooltipLeft = margin;
  if (tooltipTop + tooltipHeight > windowSize.height - margin) tooltipTop = windowSize.height - tooltipHeight - margin;
  if (tooltipTop < margin) tooltipTop = margin;

  const isMobile = windowSize.width < 768;

  const getTooltipStyle = () => {
    if (isMobile) {
      return {
        position: 'fixed' as const,
        bottom: '16px',
        top: 'auto',
        left: '50%',
        width: 'calc(100vw - 32px)',
        maxWidth: '400px',
      };
    }
    return {
      position: 'fixed' as const,
      top: tooltipTop,
      left: tooltipLeft,
      width: '350px',
      maxWidth: 'calc(100vw - 20px)',
    };
  };

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none">
      {/* Spotlight — highlights the current sidebar target */}
      <div
        className="absolute"
        style={{
          top: displayRect.top - 10,
          left: displayRect.left - 10,
          width: displayRect.width + 20,
          height: displayRect.height + 20,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          borderRadius: '12px',
          opacity: 1,
          transition: 'top 0.4s ease, left 0.4s ease, width 0.4s ease, height 0.4s ease',
        }}
      />
      <div
        className="absolute border-2 border-primary animate-pulse"
        style={{
          top: displayRect.top - 10,
          left: displayRect.left - 10,
          width: displayRect.width + 20,
          height: displayRect.height + 20,
          borderRadius: '12px',
          opacity: 0.5,
          transition: 'top 0.4s ease, left 0.4s ease, width 0.4s ease, height 0.4s ease',
        }}
      />

      {/* Tooltip card */}
      <AnimatePresence mode="wait" custom={direction}>
        {isTooltipReady && (
          <motion.div
            key={step.id}
            custom={direction}
            variants={{
              enter: (dir: number) => ({
                opacity: 0,
                x: isMobile ? "-50%" : dir * 80,
                y: isMobile ? 20 : 0,
              }),
              visible: {
                opacity: 1,
                x: isMobile ? "-50%" : 0,
                y: 0,
              },
              exit: (dir: number) => ({
                opacity: 0,
                x: isMobile ? "-50%" : dir * -40,
                y: isMobile ? 20 : 0,
              }),
            }}
            initial="enter"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl p-5 pointer-events-auto"
            style={getTooltipStyle()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
          >
            {currentStepIndex === 0 ? (
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10 border-2 border-primary">
                  <AvatarImage src={context.avatarUrl} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {context.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-lg" id="tour-title">Welcome, {context.userName}! 👋</h3>
              </div>
            ) : (
              <h3 className="font-semibold text-lg mb-2" id="tour-title">{step.getTitle()}</h3>
            )}

            <div className="text-sm text-muted-foreground whitespace-pre-wrap mb-6">
              {renderWithBold(step.getDescription(context))}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Step {currentStepIndex + 1} of {totalSteps}</span>
                <span>{Math.round(((currentStepIndex + 1) / totalSteps) * 100)}%</span>
              </div>
              <Progress value={((currentStepIndex + 1) / totalSteps) * 100} className="h-2" />

              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground h-8 px-2">
                  Skip Tour
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={onPrev} disabled={currentStepIndex === 0} className="h-8 px-3">
                    Prev
                  </Button>
                  <Button variant="default" size="sm" onClick={onNext} className="h-8 px-3">
                    {currentStepIndex === totalSteps - 1 ? 'Finish 🎉' : 'Next →'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TourCompletionModal({
  onClose,
  userName,
  avatarUrl,
  hasTeam,
}: {
  onClose: () => void;
  userName: string;
  avatarUrl: string;
  hasTeam: boolean;
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

        <div className="text-5xl mb-4 mt-2">🎉</div>

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
          Your journey as a Co-Founder starts now.
        </p>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          {hasTeam
            ? "Your team is waiting — let's get started! Head to the Sprint Board or check your Tasks to hit the ground running."
            : "Head to the Learning Hub while you wait for your Founder's invitation, or check Applications for any pending invites."}
        </p>

        <Button
          size="lg"
          className="w-full text-base font-semibold bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          onClick={onClose}
        >
          {hasTeam ? "Let's Go! 🚀" : "Go to Learning Hub 📚"}
        </Button>
      </motion.div>
    </div>
  );
}