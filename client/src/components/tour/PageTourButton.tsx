import { useState, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { useTourContext } from "./TourContext";
import { useAuth } from "@/lib/auth-context";
import { pageTours } from "./tourSteps";

export function PageTourButton({ pageKey }: { pageKey: string }) {
  const { startPageTour } = useTourContext();
  const { user } = useAuth();
  const userId = user?.id || "";

  // Default to visible (fail open); update once userId is known
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setVisible(localStorage.getItem(`sv_tour_buttons_disabled_${userId}`) !== "true");
  }, [userId]);

  useEffect(() => {
    const handler = () => {
      if (!userId) return;
      setVisible(localStorage.getItem(`sv_tour_buttons_disabled_${userId}`) !== "true");
    };
    window.addEventListener("tour-buttons-visibility-changed", handler);
    return () => window.removeEventListener("tour-buttons-visibility-changed", handler);
  }, [userId]);

  const userRole = user?.role || "";
  if (userRole !== "FOUNDER" && userRole !== "COFOUNDER" && userRole !== "LEARNER") return null;
  if (!visible) return null;

  // Resolve role-specific tour key, fallback to generic
  // LEARNER role uses "intern-" prefixed tours (interns are LEARNER role in the system)
  const rolePrefix = userRole === "LEARNER" ? "intern" : userRole.toLowerCase();
  const roleKey = `${rolePrefix}-${pageKey}`;
  const tourKey = pageTours[roleKey] ? roleKey : pageKey;

  return (
    <button
      onClick={() => startPageTour(tourKey)}
      className="border border-gray-300 text-gray-500 hover:border-[#1e2d4d] hover:text-[#1e2d4d] rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors"
    >
      <HelpCircle size={14} />
      Page Guide
    </button>
  );
}
