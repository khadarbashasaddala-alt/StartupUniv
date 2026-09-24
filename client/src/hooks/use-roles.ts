import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface RoleOption {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  includeInComposition: boolean;
  sortOrder: number;
}

export const ROLES_QUERY_KEY = ["/api/roles"];

/**
 * The platform's roles, as rows rather than a hardcoded list, so a role an admin adds
 * shows up everywhere roles are offered without a code change.
 *
 * Returned already sorted by the server (sortOrder, then code).
 */
export function useRoles(enabled = true) {
  return useQuery<RoleOption[]>({
    queryKey: ROLES_QUERY_KEY,
    queryFn: () => apiRequest("GET", "/roles"),
    enabled,
    // Roles change rarely; refetching on every mount of every consumer is wasted traffic
    staleTime: 5 * 60 * 1000,
  });
}

/** The roles that get a planned-headcount field in a cohort's composition. */
export function compositionRoles(roles: RoleOption[] | undefined): RoleOption[] {
  return (roles ?? []).filter((role) => role.includeInComposition);
}

/**
 * Converts composition form values (strings, keyed by role code) into the numeric map the
 * cohort endpoints expect. Blank and zero entries are dropped rather than sent as 0, so an
 * unplanned role simply has no row.
 */
export function compositionPayload(values: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [code, raw] of Object.entries(values)) {
    const count = parseInt(raw, 10);
    if (Number.isFinite(count) && count > 0) counts[code] = count;
  }
  return counts;
}
