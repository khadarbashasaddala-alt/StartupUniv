/**
 * MentorPageGuide — injects Page Guide buttons into the AppLayout header
 * for mentor-specific pages that use shared/common page components.
 *
 * This component lives entirely within the MentorTour module and never
 * touches shared page components.  It:
 *   1. Detects the current route via useLocation()
 *   2. On first visit to each target page, auto-triggers startPageTourIfFirst
 *   3. Portal-injects a PageTourButton into the AppLayout <header> element
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useTourContext } from "@/components/tour/TourContext";
import { PageTourButton } from "@/components/tour/PageTourButton";

/** Routes that need a mentor-specific Page Guide */
const MENTOR_PAGE_GUIDES: Record<string, string> = {
  "/app/sprint-board": "m-sprint-board",
  "/app/evidence": "m-evidence",
  "/app/problem-statements": "m-problem-statements",
  "/app/problem": "m-problem-statements",
};

/** Get the page key for a given path — handles dynamic segments */
function getPageKey(path: string): string | null {
  // Exact match first
  if (MENTOR_PAGE_GUIDES[path]) return MENTOR_PAGE_GUIDES[path];
  // Problem statement detail pages: /app/problem-statements/:id
  if (/^\/app\/problem-statements\/.+$/.test(path)) return "m-problem-statement-details";
  return null;
}

export function MentorPageGuide() {
  const [location] = useLocation();
  const { startPageTourIfFirst } = useTourContext();

  // The <header> element rendered by AppLayout
  const [headerEl, setHeaderEl] = useState<Element | null>(null);

  // Track which page keys we've already auto-triggered so the effect below
  // doesn't fire again when the component re-renders for unrelated reasons.
  const triggeredRef = useRef<Set<string>>(new Set());

  // Find the AppLayout header on mount and whenever the route changes
  useEffect(() => {
    // Small delay so the new page DOM is settled
    const t = setTimeout(() => {
      const el = document.querySelector("header.flex.h-16");
      setHeaderEl(el);
    }, 50);
    return () => clearTimeout(t);
  }, [location]);

  // Auto-trigger startPageTourIfFirst on first visit to each target page
  useEffect(() => {
    const key = getPageKey(location);
    if (!key) return;
    if (triggeredRef.current.has(key)) return;
    triggeredRef.current.add(key);

    // Slight delay so the page is fully rendered before the tour starts
    const t = setTimeout(() => startPageTourIfFirst(key), 700);
    return () => clearTimeout(t);
  }, [location, startPageTourIfFirst]);

  const pageKey = getPageKey(location);
  if (!pageKey || !headerEl) return null;

  return createPortal(
    <div className="flex items-center ml-auto pr-2">
      <PageTourButton pageKey={pageKey} />
    </div>,
    headerEl,
  );
}
