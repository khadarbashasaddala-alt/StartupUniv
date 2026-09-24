import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compositionRoles, type RoleOption } from "@/hooks/use-roles";

interface CohortCompositionFieldsProps {
  roles: RoleOption[] | undefined;
  /** Planned headcount per role code, held as form strings. */
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** Keeps input ids unique when a page renders both a create and an edit form. */
  idPrefix: string;
}

/** "Mentor" -> "Mentors", "Co-Founder" -> "Co-Founders" — composition reads as totals. */
function pluralize(label: string): string {
  if (/s$/i.test(label)) return label;
  if (/y$/i.test(label)) return `${label.slice(0, -1)}ies`;
  return `${label}s`;
}

/**
 * One planned-headcount input per role, driven by the roles table rather than a fixed set
 * of fields, so a role an admin adds appears here automatically.
 */
export function CohortCompositionFields({
  roles,
  values,
  onChange,
  idPrefix,
}: CohortCompositionFieldsProps) {
  const fields = compositionRoles(roles);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No roles are included in composition. Add one under Users → Manage Roles.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map((role) => {
        const id = `${idPrefix}-${role.code.toLowerCase()}-count`;
        return (
          <div key={role.code}>
            <Label htmlFor={id} className="text-sm font-normal text-muted-foreground">
              {pluralize(role.label)}
            </Label>
            <Input
              id={id}
              type="number"
              min="0"
              value={values[role.code] ?? ""}
              onChange={(e) => onChange({ ...values, [role.code]: e.target.value })}
              placeholder="0"
              // Matches the ids the fixed fields used, e.g. input-cohort-mentor-count
              data-testid={`input-cohort-${role.code.toLowerCase()}-count`}
            />
          </div>
        );
      })}
    </div>
  );
}
