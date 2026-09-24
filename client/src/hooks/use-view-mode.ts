import { useState } from "react";
import type { ViewMode } from "@/components/ui/view-toggle";

/**
 * Card/table preference for one page, persisted per browser so an admin who switches to table
 * view does not get reset to cards on every visit. Scoped by storageKey rather than one shared
 * key, since a preference for the Users page says nothing about what someone wants for Teams.
 */
export function useViewMode(
  storageKey: string,
  defaultMode: ViewMode = "card"
): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === "card" || stored === "table" ? stored : defaultMode;
    } catch {
      // Private browsing or storage disabled: the toggle still works, just for this load.
      return defaultMode;
    }
  });

  const setAndPersist = (next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Same as above — losing the preference across reloads is fine, breaking is not.
    }
  };

  return [mode, setAndPersist];
}
