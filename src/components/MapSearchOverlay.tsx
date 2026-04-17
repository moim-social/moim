import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMapConfig } from "~/components/maps/config";
import { cn } from "~/lib/utils";
import { zoomToRadius } from "~/lib/place";

export type PoiCandidate = {
  externalId: string;
  source: "kakao";
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  categoryName: string | null;
  distanceMeters: number | null;
};

type Props = {
  /** Bias the search around this coord. Usually the current map center or the user's GPS. */
  biasLat: number | null;
  biasLng: number | null;
  /** Current map zoom — used to scale the search radius.
      Higher zoom (more detail) ⇒ smaller radius so suggestions stay relevant. */
  biasZoom?: number;
  onPick: (candidate: PoiCandidate) => void;
  placeholder?: string;
  className?: string;
};

// Kakao keyword-search radius in meters. zoomToRadius() is tuned tight for the
// nearby-check-in circle ("what's literally around me"); POI search wants a
// wider net that feels like the visible map viewport, so we 2× it and cap at
// Kakao's max of 20 km.
function zoomToRadiusMeters(zoom?: number): number {
  if (zoom == null) return 5000;
  return Math.min(20000, Math.round(zoomToRadius(zoom) * 2000));
}

export function MapSearchOverlay({
  biasLat,
  biasLng,
  biasZoom,
  onPick,
  placeholder = "Search places…",
  className,
}: Props) {
  const { data: mapConfig } = useMapConfig();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 250);
    return () => clearTimeout(t);
  }, [value]);

  const enabled =
    mapConfig?.provider === "kakao"
    && biasLat != null
    && biasLng != null
    && debounced.trim().length >= 1;

  const radiusMeters = zoomToRadiusMeters(biasZoom);
  const { data, isFetching, error } = useQuery<{ candidates: PoiCandidate[] }>({
    queryKey: ["poi-search", debounced, biasLat, biasLng, radiusMeters],
    queryFn: async () => {
      const r = await fetch(
        `/api/places/poi-search?q=${encodeURIComponent(debounced.trim())}&lat=${biasLat}&lng=${biasLng}&radius=${radiusMeters}`,
      );
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  if (mapConfig?.provider !== "kakao") return null;

  const candidates = data?.candidates ?? [];
  // Always show the dropdown once the user has typed + is focused, so empty
  // or error states give visual feedback instead of silence.
  const showDropdown = open && enabled;

  return (
    <div
      ref={wrapperRef}
      className={cn("absolute left-2 top-2 z-[1000] w-56 sm:left-3", className)}
      style={{ position: "absolute", top: 8, zIndex: 1000 }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-9 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm text-foreground shadow-md outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring/30"
          style={{ backgroundColor: "#ffffff" }}
        />
      </div>
      {showDropdown && (
        <ul
          className="mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-white text-sm text-foreground shadow-md"
          role="listbox"
          style={{ backgroundColor: "#ffffff" }}
        >
          {isFetching && candidates.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">Searching…</li>
          )}
          {error && !isFetching && (
            <li className="px-3 py-2 text-destructive">
              {error instanceof Error ? error.message : "Search failed"}
            </li>
          )}
          {candidates.map((c) => (
            <li key={c.externalId}>
              <button
                type="button"
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  onPick(c);
                  setValue(c.name);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.roadAddress ?? c.address ?? ""}
                  {c.distanceMeters != null && (
                    <span className="ml-2">· {c.distanceMeters}m</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!isFetching && !error && candidates.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">
              No matches nearby. Try a different term or zoom out.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
