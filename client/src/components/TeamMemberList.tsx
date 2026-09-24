import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Users } from "lucide-react";

type Member = { userId: string; name: string };

/**
 * A named group of team members, collapsed past a threshold.
 *
 * A ten-intern team listed in full pushed the sprint header and task board below the fold,
 * so the page opened on a roster instead of on the work. Only the overflow is hidden — a
 * short list renders as-is with no toggle to click past.
 *
 * Rendered from both copies of the Team Details panel (the no-sprint branch and the board),
 * which is why it lives here rather than inline: those two copies have already drifted from
 * each other more than once.
 */
export function TeamMemberList({
  heading,
  members,
  collapseAfter = 4,
  testId,
}: {
  heading: string;
  members: Member[];
  /** Show at most this many before offering to expand. */
  collapseAfter?: number;
  testId?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (members.length === 0) return null;

  const collapsible = members.length > collapseAfter;
  const shown = collapsible && !expanded ? members.slice(0, collapseAfter) : members;
  const hiddenCount = members.length - shown.length;

  return (
    <div data-testid={testId}>
      <h5 className="text-xs font-semibold text-muted-foreground mb-2">{heading}</h5>
      <div className="space-y-1">
        {shown.map((member) => (
          <div
            key={member.userId}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Users className="h-4 w-4 text-primary" />
            <span className="truncate">{member.name}</span>
          </div>
        ))}
      </div>
      {collapsible && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-1 text-xs text-primary hover:bg-transparent hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="ml-1 h-3 w-3" />
            </>
          ) : (
            <>
              View {hiddenCount} more <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

export default TeamMemberList;
