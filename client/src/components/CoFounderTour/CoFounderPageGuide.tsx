import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTourContext } from "@/components/tour/TourContext";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function CoFounderPageGuide() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { startPageTour, startPageTourIfFirst } = useTourContext();
  const [headerEl, setHeaderEl] = useState<Element | null>(null);
  const triggeredRef = useRef<Set<string>>(new Set());

  const { data: stats } = useQuery({
    queryKey: ["/api/founder/stats"],
    queryFn: () => apiRequest("GET", "/api/founder/stats"),
    enabled: user?.role === "COFOUNDER",
  });

  const hasTeam = !!stats?.hasTeam;

  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector("header.flex.h-16 > div:first-child");
      setHeaderEl(el);
    }, 80);
    return () => clearTimeout(t);
  }, [location]);

  // Auto-trigger first-visit tours
  useEffect(() => {
    if (user?.role !== "COFOUNDER") return;
    if (!stats) return;

    let key: string | null = null;

    if (location === "/app/problem" || location === "/app/problem-statements") {
      if (!hasTeam) {
        key = "cf-pg-problem-statements-no-team";
      } else {
        const hasProblemContent =
          !!document.querySelector('[data-tour="m-pg-ps-main-card"]') ||
          !!document.querySelector('[data-tour="ps-list"]') ||
          !!document.querySelector('[data-tour="ps-card-title"]');
        key = hasProblemContent
          ? "cf-pg-problem-statements-has-content"
          : "cf-pg-problem-statements-team-no-ps";
      }
    } else if (location === "/app/sprint-board") {
      if (!hasTeam) {
        key = "cf-pg-sprint-board-no-team";
      } else {
        const hasActiveSprint = !!document.querySelector('[data-tour="sprint-board-heading"]');
        key = hasActiveSprint ? "cf-pg-sprint-board" : "cf-pg-sprint-board-no-sprint";
      }
    } else if (location === "/app/evidence") {
      if (!hasTeam) {
        key = "cf-pg-evidence-no-team";
      } else {
        const hasEvidence = !!document.querySelector('[data-testid^="evidence-row-"]');
        key = hasEvidence ? "cf-pg-evidence" : "cf-pg-evidence-empty";
      }
    }

    if (!key) return;
    if (triggeredRef.current.has(key)) return;
    triggeredRef.current.add(key);
    const t = setTimeout(() => startPageTourIfFirst(key!), 700);
    return () => clearTimeout(t);
  }, [location, user?.role, hasTeam, stats, startPageTourIfFirst]);

  if (user?.role !== "COFOUNDER") return null;

  const isPS =
    location === "/app/problem" || location === "/app/problem-statements";
  const isSprint = location === "/app/sprint-board";
  const isEvidence = location === "/app/evidence";

  if (!isPS && !isSprint && !isEvidence) return null;
  if (!headerEl) return null;

  const handleClick = () => {
    if (isPS) {
      if (!hasTeam) {
        startPageTour("cf-pg-problem-statements-no-team");
      } else {
        const hasProblemContent =
          !!document.querySelector('[data-tour="m-pg-ps-main-card"]') ||
          !!document.querySelector('[data-tour="ps-list"]') ||
          !!document.querySelector('[data-tour="ps-card-title"]');
        startPageTour(
          hasProblemContent
            ? "cf-pg-problem-statements-has-content"
            : "cf-pg-problem-statements-team-no-ps"
        );
      }
    } else if (isSprint) {
      if (!hasTeam) {
        startPageTour("cf-pg-sprint-board-no-team");
      } else {
        const hasActiveSprint = !!document.querySelector(
          '[data-tour="sprint-board-heading"]'
        );
        startPageTour(
          hasActiveSprint ? "cf-pg-sprint-board" : "cf-pg-sprint-board-no-sprint"
        );
      }
    } else if (isEvidence) {
      if (!hasTeam) {
        startPageTour("cf-pg-evidence-no-team");
      } else {
        const hasEvidence = !!document.querySelector(
          '[data-testid^="evidence-row-"]'
        );
        startPageTour(hasEvidence ? "cf-pg-evidence" : "cf-pg-evidence-empty");
      }
    }
  };

  return createPortal(
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="ml-2 h-8 rounded-full border border-border/70 bg-background/90 px-3 text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground"
    >
      <HelpCircle className="mr-1 h-4 w-4" />
      Page Guide
    </Button>,
    headerEl
  );
}
