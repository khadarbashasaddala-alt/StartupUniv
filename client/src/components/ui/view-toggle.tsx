import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "card" | "table";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/** Card/Table switch reused by every admin list page — Users and Teams today. */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex shrink-0 rounded-md border border-input p-0.5"
      role="group"
      aria-label="View mode"
    >
      <Button
        type="button"
        variant={value === "card" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange("card")}
        aria-pressed={value === "card"}
        aria-label="Card view"
        data-testid="view-toggle-card"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={value === "table" ? "secondary" : "ghost"}
        size="icon"
        className="h-8 w-8"
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
        aria-label="Table view"
        data-testid="view-toggle-table"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}
