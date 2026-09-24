import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignableMember = {
  userId: string;
  name: string;
  role?: string | null;
  userRole?: string | null;
};

/**
 * Inline checkbox list of the team members a task can be assigned to.
 *
 * Deliberately NOT a popover. A Radix popover renders in a portal above the dialog, so
 * the member list covered the dialog's own footer — the Assign button ended up behind
 * the list with no way to reach it, and there was nothing to scroll because the dialog
 * itself still fitted its content. Keeping the list in the normal flow means the footer
 * stays where it is and long teams scroll inside the list.
 */
export function TeamMemberMultiSelect({
  members,
  selected,
  onChange,
  loading = false,
  emptyMessage = "No team members found",
  className,
  testId,
}: {
  members: AssignableMember[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  testId?: string;
}) {
  const toggle = (userId: string, checked: boolean) => {
    onChange(checked ? [...selected, userId] : selected.filter((id) => id !== userId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-md border py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team members...
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-md border py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)} data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "Unassigned"
            : `${selected.length} selected`}
        </span>
        {selected.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onChange([])}
          >
            Clear selection
          </Button>
        )}
      </div>
      {/* Bounded so a large team scrolls here rather than pushing the footer off screen */}
      <div className="max-h-52 overflow-y-auto rounded-md border p-1">
        {members.map((member) => (
          <label
            key={member.userId}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(member.userId)}
              onCheckedChange={(checked) => toggle(member.userId, checked === true)}
            />
            <span className="truncate text-sm">{member.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              ({member.userRole || member.role})
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default TeamMemberMultiSelect;
