import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTourContext } from "@/components/tour/TourContext";
import { Button } from "@/components/ui/button";

export function MentorPageGuide() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { startPageTour } = useTourContext();
  const [mounted, setMounted] = useState(false);
  const userId = user?.id || "";
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!userId) return;
    setVisible(localStorage.getItem(`sv_tour_buttons_disabled_${userId}`) !== "true");
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const handler = () => {
      setVisible(localStorage.getItem(`sv_tour_buttons_disabled_${userId}`) !== "true");
    };
    window.addEventListener("tour-buttons-visibility-changed", handler);
    return () => window.removeEventListener("tour-buttons-visibility-changed", handler);
  }, [userId]);

  if (!mounted || user?.role !== "MENTOR" || !visible) return null;

  const isPS = location === "/app/problem" || location.startsWith("/app/problem/");
  const isSprint = location === "/app/sprint-board";
  const isEvidence = location === "/app/evidence";
  const isDashboard = location === "/app" || location === "/app/";
  const isOpenChallenges = location === "/app/open-challenges";
  const isTasks = location === "/app/tasks";
  const isTeam = location === "/app/team" || location === "/app/my-team";
  const isMeetings = location === "/app/my-meetings";
  const isApplications = location === "/app/applications";

  if (!isPS && !isSprint && !isEvidence && !isDashboard && !isOpenChallenges && !isTasks && !isTeam && !isMeetings && !isApplications) return null;

  const headerLeftGroup = document.querySelector("header > div:first-child");
  if (!headerLeftGroup) return null;

  const handleClick = () => {
    if (isPS) {
      // State 1: submit form is open
      if (document.querySelector('[data-tour="ps-title-input"]')) {
        startPageTour("m-pg-ps-form-open");
      // State 2: no PS submitted yet — empty state
      } else if (!document.querySelector('[data-tour="m-pg-ps-main-card"]')) {
        startPageTour("m-pg-ps-no-ps");
      // State 3: PS exists — full guide
      } else {
        startPageTour("m-pg-problem-statement");
      }
    } else if (isSprint) {
      const hasTeams = !!document.querySelector('[data-tour="sb-team-selector"]');
      startPageTour(hasTeams ? "m-pg-sprint-board" : "m-pg-sprint-board-no-teams");
    } else if (isEvidence) {
      const hasTeamSelected = !!document.querySelector('[data-tour="evidence-stat-cards"]');
      if (!hasTeamSelected) {
        startPageTour("m-pg-evidence-initial");
      } else {
        const hasEvidence = !!document.querySelector('[data-testid^="evidence-row-"]');
        startPageTour(hasEvidence ? "m-pg-evidence-loaded-has" : "m-pg-evidence-loaded-empty");
      }
    } else if (isDashboard) {
      const hasTeams = !!document.querySelector('[data-tour="m-pg-dash-team-card"]');
      startPageTour(hasTeams ? "m-pg-dashboard-has-teams" : "m-pg-dashboard-no-teams");
    } else if (isOpenChallenges) {
      startPageTour("m-pg-open-challenges");
    } else if (isTasks) {
      const hasTaskRows = !!document.querySelector('[data-tour="m-pg-tasks-row"]');
      startPageTour(hasTaskRows ? "m-pg-tasks" : "m-pg-tasks-no-teams");
    } else if (isTeam) {
      const hasTeams = !!document.querySelector('[data-tour="m-pg-team-card"]');
      startPageTour(hasTeams ? "m-pg-team" : "m-pg-team-no-teams");
    } else if (isMeetings) {
      startPageTour("m-pg-meetings");
    } else if (isApplications) {
      startPageTour("m-pg-applications");
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
    headerLeftGroup
  );
}
