import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { LeafletMap, type MapMarker } from "~/components/LeafletMap";
import { formatDistance, type NearbyPlace } from "~/lib/place";

export type SelectedPlace = {
  id: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
};

type PlacePickerProps = {
  value: SelectedPlace | null;
  onChange: (place: SelectedPlace | null) => void;
};

export function PlacePicker({ value, onChange }: PlacePickerProps) {
  // GPS
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  // Nearby places
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  useEffect(() => {
    if (!userPos) return;
    setNearbyLoading(true);
    fetch(`/api/places/nearby?lat=${userPos.lat}&lng=${userPos.lng}&radius=5`)
      .then((r) => r.json())
      .then((data) => setNearby(data.places ?? []))
      .catch(() => setNearby([]))
      .finally(() => setNearbyLoading(false));
  }, [userPos]);

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NearbyPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "8" });
        if (userPos) {
          params.set("lat", String(userPos.lat));
          params.set("lng", String(userPos.lng));
        }
        const res = await fetch(`/api/places?${params}`);
        const data = await res.json();
        setSearchResults(
          (data.places ?? []).map((p: any) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            latitude: p.latitude,
            longitude: p.longitude,
            distance: p.distance ?? null,
            checkinCount: p.checkinCount ?? 0,
          })),
        );
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, userPos]);

  // New place creation state (from map click)
  const [mapLat, setMapLat] = useState("");
  const [mapLng, setMapLng] = useState("");
  const [mapName, setMapName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Name-only mode: null = disabled, string = active with value
  const [nameOnlyValue, setNameOnlyValue] = useState<string | null>(null);

  function selectPlace(place: { id: string; name: string; address: string | null; latitude: string; longitude: string }) {
    onChange({
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setQuery("");
    setSearchResults([]);
    setMapLat("");
    setMapLng("");
    setMapName("");
  }

  function handleMapClick(lat: number, lng: number) {
    setMapLat(lat.toFixed(6));
    setMapLng(lng.toFixed(6));
  }

  async function handleCreatePlace() {
    if (!mapName.trim() || !mapLat || !mapLng) return;
    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: mapLat,
          longitude: mapLng,
          name: mapName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create place");
        return;
      }
      onChange({
        id: data.place.id,
        name: data.place.name,
        address: null,
        latitude: data.place.latitude,
        longitude: data.place.longitude,
      });
      setMapLat("");
      setMapLng("");
      setMapName("");
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  }

  function handleMarkerClick(marker: MapMarker) {
    const place = nearby.find((p) => p.id === marker.id);
    if (place) selectPlace(place);
  }

  function submitNameOnly() {
    if (!nameOnlyValue?.trim()) return;
    onChange({
      id: "",
      name: nameOnlyValue.trim(),
      address: null,
      latitude: null,
      longitude: null,
    });
    setNameOnlyValue(null);
  }

  // Determine which places to show in the list
  const displayPlaces = query.length >= 2 ? searchResults : nearby;

  // Memoize map markers to avoid unnecessary LeafletMap re-renders
  const mapMarkers = useMemo(() => {
    const placeMarkers: MapMarker[] = displayPlaces
      .filter((p) => p.latitude && p.longitude)
      .map((p) => ({
        lat: parseFloat(p.latitude),
        lng: parseFloat(p.longitude),
        label: p.name,
        id: p.id,
        color: "blue" as const,
      }));
    const pickedMarker: MapMarker[] =
      mapLat && mapLng
        ? [{ lat: parseFloat(mapLat), lng: parseFloat(mapLng), label: mapName || "New place", id: "new", color: "red" as const }]
        : [];
    return [...placeMarkers, ...pickedMarker];
  }, [displayPlaces, mapLat, mapLng, mapName]);

  // -- Render --

  // Selected state — show chip with map preview
  if (value) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-md border-2 border-primary bg-primary/5 p-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{value.name}</p>
            {value.address && (
              <p className="text-xs text-muted-foreground truncate">{value.address}</p>
            )}
            {value.latitude && value.longitude && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {value.latitude}, {value.longitude}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Clear
          </Button>
        </div>
        {value.latitude && value.longitude && (
          <LeafletMap
            markers={[{
              lat: parseFloat(value.latitude),
              lng: parseFloat(value.longitude),
              label: value.name,
              id: value.id,
              color: "red",
            }]}
            height="150px"
          />
        )}
      </div>
    );
  }

  // Unselected — unified layout or name-only mode
  if (nameOnlyValue !== null) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. Tokyo Community Center"
            value={nameOnlyValue}
            onChange={(e) => setNameOnlyValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNameOnly(); } }}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={submitNameOnly}
            disabled={!nameOnlyValue.trim()}
            size="sm"
          >
            Use
          </Button>
        </div>
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => setNameOnlyValue(null)}
        >
          Pick from map instead
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Map — always visible */}
      <LeafletMap
        markers={mapMarkers}
        onMapClick={handleMapClick}
        onMarkerClick={handleMarkerClick}
        height="200px"
      />

      {/* New place creation (when user clicked on map) */}
      {mapLat && mapLng && (
        <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            New location: {mapLat}, {mapLng}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Place name"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleCreatePlace}
              disabled={creating || !mapName.trim()}
              size="sm"
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
          {createError && <p className="text-xs text-destructive">{createError}</p>}
        </div>
      )}

      {/* Search input */}
      <Input
        type="text"
        placeholder="Search places by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Place list */}
      {(gpsLoading || nearbyLoading || searching) && (
        <p className="text-xs text-muted-foreground">
          {searching ? "Searching..." : "Finding nearby places..."}
        </p>
      )}

      {displayPlaces.length > 0 ? (
        <ul className="border rounded-md max-h-[200px] overflow-auto">
          {displayPlaces.map((place) => (
            <li
              key={place.id}
              onClick={() => selectPlace(place)}
              className="px-3 py-2 cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-primary/10 hover:ring-1 hover:ring-inset hover:ring-primary/30"
            >
              <div className="font-medium text-sm">{place.name}</div>
              <div className="text-xs text-muted-foreground">
                {place.distance != null && formatDistance(place.distance)}
                {place.address && <>{place.distance != null ? " · " : ""}{place.address}</>}
                {place.checkinCount > 0 && (
                  <> · {place.checkinCount} check-in{place.checkinCount !== 1 ? "s" : ""}</>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : !gpsLoading && !nearbyLoading && !searching && query.length < 2 && nearby.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No places nearby. Search by name or click the map to create a new place.
        </p>
      ) : query.length >= 2 && !searching && searchResults.length === 0 ? (
        <p className="text-xs text-muted-foreground">No places found.</p>
      ) : null}

      {/* Name-only option */}
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => setNameOnlyValue("")}
      >
        Just type a name instead
      </button>
    </div>
  );
}
