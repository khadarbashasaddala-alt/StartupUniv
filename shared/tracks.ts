/**
 * Track definitions shared between the application forms and the
 * problem-statement form.
 *
 * The selectable list is no longer hardcoded here — it lives in the `tracks`
 * table and is fetched via GET /api/tracks (see client/src/hooks/use-tracks).
 * What remains in this file is:
 *
 *  - SEED_TRACKS: the offline fallback, used only if GET /api/tracks fails, so
 *    a form is never left with an empty dropdown. It does NOT seed the table —
 *    scripts/sql/add-tracks.sql carries its own list, because SQL can't import
 *    TypeScript. The two are kept in sync by hand; if you add a track here, add
 *    it there too (and vice versa). The catalog table is the source of truth at
 *    runtime, so drift only affects what an offline client sees.
 *  - helpers for turning a typed-in track name into a stable stored value.
 *
 * Renamed from `tracks` to avoid colliding with the `tracks` table exported
 * from @shared/schema.
 */
export const SEED_TRACKS = [
  { value: "SaaS_B2B" as const, label: "SaaS & B2B Software" },
  { value: "AI" as const, label: "Artificial Intelligence" },
  { value: "FinTech" as const, label: "FinTech" },
  { value: "HealthTech" as const, label: "HealthTech" },
  { value: "BioTech" as const, label: "BioTech" },
  { value: "EdTech" as const, label: "EdTech" },
  { value: "Consumer" as const, label: "Consumer & Lifestyle" },
  { value: "ECommerce" as const, label: "E-Commerce & D2C" },
  { value: "Logistics" as const, label: "Logistics, Mobility & Transportation" },
  { value: "PropTech" as const, label: "PropTech / Real Estate" },
  { value: "AgriTech" as const, label: "AgriTech" },
  { value: "Climate" as const, label: "Energy, Climate & Sustainability" },
  { value: "Industrial" as const, label: "Industrial, Manufacturing & Robotics" },
  { value: "Media" as const, label: "Media, Content & Entertainment" },
  { value: "GovTech" as const, label: "GovTech" },
  { value: "MSME" as const, label: "MSME" },
  // Domain-specific values that existed in the old `track` enum but were never
  // exposed in the UI. Included so the fallback matches the seeded catalog.
  { value: "AI_Dev" as const, label: "AI Development" },
  { value: "FullStack_GenAI" as const, label: "Full Stack & GenAI" },
  { value: "Data_Analysis" as const, label: "Data Analysis" },
  { value: "DevOps_Cloud" as const, label: "DevOps & Cloud" },
  { value: "Cybersecurity" as const, label: "Cybersecurity" },
] as const;

/** Shape returned by GET /api/tracks and accepted by the pickers. */
export interface TrackOption {
  value: string;
  label: string;
}

export type TrackValue = (typeof SEED_TRACKS)[number]["value"];

/** Fallback values, for use when the catalog request hasn't resolved. */
export const trackValues: string[] = SEED_TRACKS.map((t) => t.value);

/** Fallback value -> label map. */
export const trackLabels: Record<string, string> = SEED_TRACKS.reduce(
  (acc, track) => {
    acc[track.value] = track.label;
    return acc;
  },
  {} as Record<string, string>
);

export const TRACK_LABEL_MAX_LENGTH = 60;

/**
 * Turns a human-typed track name into the stable identifier stored on rows,
 * e.g. "Space & Defence Tech" -> "Space_Defence_Tech".
 *
 * Follows the existing convention (capitalised words, underscore separated) so
 * new values sit alongside "SaaS_B2B" and "FullStack_GenAI" without looking out
 * of place. Returns "" when nothing usable remains — callers treat that as
 * invalid rather than storing an empty track.
 */
export function slugifyTrack(input: string): string {
  return input
    .normalize("NFKD")
    // Strip the combining marks NFKD just split off, rather than letting the
    // next replace turn them into spaces — otherwise "Ürban" becomes "U_Rban".
    .replace(/\p{M}+/gu, "")
    .replace(/&/g, " and ") // so "A & B" and "A and B" collapse to one value
    .replace(/[^\p{L}\p{N}\s_-]/gu, " ") // drop remaining punctuation and symbols
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("_")
    .slice(0, TRACK_LABEL_MAX_LENGTH);
}

/** Display label for a stored value, falling back to the seed map then the raw value. */
export function labelForTrack(
  value: string | null | undefined,
  catalog: TrackOption[] = []
): string {
  if (!value) return "";
  const fromCatalog = catalog.find((t) => t.value === value);
  if (fromCatalog) return fromCatalog.label;
  return trackLabels[value] ?? value.replace(/_/g, " ");
}

/**
 * Finds an existing track that `label` would duplicate, comparing
 * case-insensitively on both the label and the derived value, so nobody creates
 * "Fintech" next to "FinTech".
 */
export function findExistingTrack(
  label: string,
  catalog: TrackOption[]
): TrackOption | undefined {
  const normalizedLabel = label.trim().toLowerCase();
  const derivedValue = slugifyTrack(label).toLowerCase();
  if (!normalizedLabel && !derivedValue) return undefined;

  return catalog.find((t) => {
    // Compare the raw forms first: cheap, and catches exact/casing matches.
    if (t.label.trim().toLowerCase() === normalizedLabel) return true;
    if (t.value.toLowerCase() === derivedValue) return true;

    // Then compare with BOTH sides normalised. Seeded values are not slugs of
    // their own labels ("SaaS & B2B Software" is stored as "SaaS_B2B"), so
    // normalising only the input cannot bridge them — without this,
    // "SaaS and B2B Software" slips past and creates a near-duplicate.
    const labelSlug = slugifyTrack(t.label).toLowerCase();
    return labelSlug.length > 0 && labelSlug === derivedValue;
  });
}
