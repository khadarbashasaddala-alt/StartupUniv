import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useTracks, useCreateTrack } from "@/hooks/use-tracks";
import {
  findExistingTrack,
  labelForTrack,
  TRACK_LABEL_MAX_LENGTH,
} from "@shared/tracks";

interface TrackSelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Forwarded so the existing product tour can still target the control. */
  "data-tour"?: string;
}

/**
 * Searchable track picker.
 *
 * Admins additionally get an "Add <typed name>" row when their search doesn't
 * match anything, which creates the track and selects it. Non-admins only see
 * the existing list — matching the server, which rejects POST /api/tracks for
 * anyone else.
 */
export function TrackSelect({
  value,
  onChange,
  id,
  disabled,
  placeholder = "Select a track",
  ...rest
}: TrackSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const { tracks, isLoading, refetch: refetchTracks } = useTracks();
  const createTrack = useCreateTrack();

  const isAdmin = user?.role === "ADMIN";
  const trimmedSearch = search.trim();

  const selectedLabel = value ? labelForTrack(value, tracks) : "";

  // Offer creation only when the text doesn't already match a track, so we
  // never end up with "Fintech" sitting next to "FinTech".
  const duplicate = useMemo(
    () => (trimmedSearch ? findExistingTrack(trimmedSearch, tracks) : undefined),
    [trimmedSearch, tracks]
  );

  const canCreate =
    isAdmin &&
    trimmedSearch.length > 0 &&
    trimmedSearch.length <= TRACK_LABEL_MAX_LENGTH &&
    !duplicate &&
    !createTrack.isPending;

  function select(next: string) {
    onChange(next);
    setSearch("");
    setOpen(false);
  }

  async function handleCreate() {
    if (!canCreate) return;
    try {
      const created = await createTrack.mutateAsync(trimmedSearch);
      select(created.value);
      toast({
        title: created.reactivated ? "Track restored" : "Track added",
        description: `"${created.label}" is now available to everyone.`,
      });
    } catch (error: any) {
      // apiRequest throws a plain Error carrying only `message`, so the 409
      // body (including its `track`) is not reachable here. Re-read the catalog
      // instead — the duplicate is by definition already in it — and select
      // that row rather than showing the admin an error for a track that exists.
      let existing = findExistingTrack(trimmedSearch, tracks);
      if (!existing) {
        const refreshed = await refetchTracks();
        existing = findExistingTrack(trimmedSearch, refreshed);
      }
      if (existing?.value) {
        select(existing.value);
        toast({
          title: "Track already exists",
          description: `Selected "${existing.label}".`,
        });
        return;
      }
      toast({
        title: "Could not add track",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
          {...rest}
        >
          {selectedLabel || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder={isAdmin ? "Search or type a new track..." : "Search tracks..."}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading tracks...
              </div>
            )}

            {!isLoading && (
              <CommandEmpty>
                {isAdmin ? (
                  trimmedSearch.length > TRACK_LABEL_MAX_LENGTH ? (
                    <span className="text-sm">
                      Track names must be {TRACK_LABEL_MAX_LENGTH} characters or fewer.
                    </span>
                  ) : (
                    <span className="text-sm">
                      No match. Type a name, then choose “Add”.
                    </span>
                  )
                ) : (
                  <span className="text-sm">
                    No matching track. Ask an admin to add it.
                  </span>
                )}
              </CommandEmpty>
            )}

            <CommandGroup>
              {tracks.map((track) => (
                <CommandItem
                  key={track.value}
                  value={`${track.label} ${track.value}`}
                  onSelect={() => select(track.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === track.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {track.label}
                </CommandItem>
              ))}
            </CommandGroup>

            {canCreate && (
              /*
               * forceMount is required on BOTH the group and the item. A
               * force-mounted item deliberately skips registering itself with
               * the filter store, so the group would never appear in
               * `filtered.groups` and cmdk would mark it hidden — which is
               * precisely when we need it, since canCreate implies an active
               * search. See the Group implementation in cmdk:
               *   c || filter() === false ? true : search ? filtered.groups.has(id) : true
               */
              <CommandGroup heading="New track" forceMount>
                <CommandItem
                  value={`__create__${trimmedSearch}`}
                  onSelect={handleCreate}
                  forceMount
                >
                  {createTrack.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add “{trimmedSearch}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
