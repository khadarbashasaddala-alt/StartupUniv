import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SEED_TRACKS, type TrackOption } from "@shared/tracks";

const TRACKS_KEY = ["/api/tracks"] as const;

/** The seed list, used only until the request resolves or if it fails. */
const FALLBACK: TrackOption[] = SEED_TRACKS.map((t) => ({
  value: t.value,
  label: t.label,
}));

/**
 * The selectable track list, fetched from the catalog table.
 *
 * Falls back to the seed list on error so a form never renders an empty
 * dropdown — better to show the standard 16 than nothing at all.
 */
export function useTracks() {
  const query = useQuery<TrackOption[]>({
    queryKey: TRACKS_KEY,
    staleTime: 5 * 60 * 1000, // the list changes rarely
  });

  return {
    tracks: query.data && query.data.length > 0 ? query.data : FALLBACK,
    isLoading: query.isLoading,
    isFallback: !query.data || query.data.length === 0,
    error: query.error,
    /** Forces a re-read; used to resolve a 409 against a stale catalog. */
    refetch: async (): Promise<TrackOption[]> => {
      const { data } = await query.refetch();
      return data && data.length > 0 ? data : FALLBACK;
    },
  };
}

/**
 * Creates a track. Admin-only server-side (403 otherwise).
 *
 * A 409 means the track already exists — callers should treat that as "just
 * select the existing one" rather than a failure.
 */
export function useCreateTrack() {
  return useMutation<TrackOption & { reactivated?: boolean }, Error, string>({
    mutationFn: async (label: string) => {
      return apiRequest("POST", "/api/tracks", { label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRACKS_KEY });
    },
  });
}
