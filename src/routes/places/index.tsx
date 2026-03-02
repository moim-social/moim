import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  formatDistance,
  type NearbyPlace,
  type PlaceCategoryOption,
  type PlaceCategorySummary,
} from "~/lib/place";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { LeafletMap, type MapMarker } from "~/components/LeafletMap";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";

export const Route = createFileRoute("/places/")({
  component: PlacesPage,
  head: () => ({
    meta: [
      { title: "Places — Moim" },
      { name: "description", content: "Find venues, spaces, and locations where communities gather." },
      { property: "og:title", content: "Places — Moim" },
      { property: "og:description", content: "Find venues, spaces, and locations where communities gather." },
      { property: "og:type", content: "website" },
    ],
  }),
});

type PlaceItem = {
  id: string;
  name: string;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  website: string | null;
  checkinCount: number;
  category: PlaceCategorySummary | null;
  tags: Array<{ slug: string; label: string }>;
};

function formatCategory(category: PlaceCategorySummary | null | undefined): string | null {
  if (!category || !category.label) return null;
  return `${category.emoji ?? ""} ${category.label}`.trim();
}

function PlacesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ handle: string } | null>(null);
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [placeCategories, setPlaceCategories] = useState<PlaceCategoryOption[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "map">("list");

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinName, setCheckinName] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinLat, setCheckinLat] = useState("");
  const [checkinLng, setCheckinLng] = useState("");
  const [checkinCategoryId, setCheckinCategoryId] = useState("");
  const [selectedNearbyPlace, setSelectedNearbyPlace] = useState<NearbyPlace | null>(null);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((data) => setUser(data.user))
      .catch(() => {});

    fetch("/api/place-categories")
      .then((response) => response.json())
      .then((data) => setPlaceCategories(data.options ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter([position.coords.latitude, position.coords.longitude]);
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  const fetchPlaces = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    fetch(`/api/places?${params}`)
      .then((response) => response.json())
      .then((data) => setPlaces(data.places ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(fetchPlaces, query ? 300 : 0);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  useEffect(() => {
    if (!checkinLat || !checkinLng) {
      setNearbyPlaces([]);
      return;
    }
    setNearbyLoading(true);
    fetch(`/api/places/nearby?lat=${checkinLat}&lng=${checkinLng}&radius=2`)
      .then((response) => response.json())
      .then((data) => setNearbyPlaces(data.places ?? []))
      .catch(() => setNearbyPlaces([]))
      .finally(() => setNearbyLoading(false));
  }, [checkinLat, checkinLng]);

  const handleCheckinMapClick = (lat: number, lng: number) => {
    setCheckinLat(lat.toFixed(6));
    setCheckinLng(lng.toFixed(6));
    setCheckinName("");
    setCheckinCategoryId("");
    setSelectedNearbyPlace(null);
  };

  const selectNearbyPlace = (place: NearbyPlace) => {
    setSelectedNearbyPlace(place);
    setCheckinLat(place.latitude);
    setCheckinLng(place.longitude);
    setCheckinName(place.name);
    setCheckinCategoryId(place.category?.slug ?? "");
  };

  const resetCheckinForm = () => {
    setCheckinOpen(false);
    setCheckinName("");
    setCheckinNote("");
    setCheckinLat("");
    setCheckinLng("");
    setCheckinCategoryId("");
    setSelectedNearbyPlace(null);
    setCheckinError("");
  };

  const handleCheckin = async () => {
    if (!checkinName.trim()) {
      setCheckinError("Place name is required");
      return;
    }
    if (!checkinLat || !checkinLng) {
      setCheckinError("Pick a location on the map");
      return;
    }
    if (!selectedNearbyPlace && !checkinCategoryId) {
      setCheckinError("Select a category for the new place");
      return;
    }

    setCheckinSubmitting(true);
    setCheckinError("");

    try {
      const response = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: checkinLat,
          longitude: checkinLng,
          name: checkinName.trim(),
          note: checkinNote.trim() || undefined,
          categoryId: selectedNearbyPlace ? undefined : checkinCategoryId,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setCheckinError(data.error || "Failed to check in");
        return;
      }

      resetCheckinForm();
      fetchPlaces();
    } catch {
      setCheckinError("Failed to check in");
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const markers: MapMarker[] = places
    .filter((place) => place.latitude && place.longitude)
    .map((place) => ({
      lat: parseFloat(place.latitude!),
      lng: parseFloat(place.longitude!),
      label: place.name,
      id: place.id,
      glyph: place.category?.emoji ?? null,
    }));

  const nearbyMapMarkers: MapMarker[] = nearbyPlaces
    .filter((place) => place.latitude && place.longitude)
    .map((place) => ({
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
      label: place.name,
      id: place.id,
      color: "blue" as const,
      glyph: place.category?.emoji ?? null,
    }));

  const pickedCheckinMarker: MapMarker[] = checkinLat && checkinLng
    ? [{
        lat: parseFloat(checkinLat),
        lng: parseFloat(checkinLng),
        label: checkinName || "Check-in",
        id: selectedNearbyPlace?.id ?? "new",
        color: "red" as const,
        glyph: selectedNearbyPlace?.category?.emoji ?? null,
      }]
    : [];

  const handleCheckinMarkerClick = (marker: MapMarker) => {
    const place = nearbyPlaces.find((candidate) => candidate.id === marker.id);
    if (place) selectNearbyPlace(place);
  };

  const isCreatingNewPlace = !!checkinLat && !!checkinLng && selectedNearbyPlace == null;
  const selectedNearbyCategory = formatCategory(selectedNearbyPlace?.category);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Places</h2>
          <p className="mt-1 text-muted-foreground">
            Find venues, spaces, and locations where communities gather.
          </p>
        </div>
        {user && <Button onClick={() => setCheckinOpen(true)}>Check In</Button>}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search places..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
        />
        <div className="ml-auto flex gap-1">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
          >
            List
          </Button>
          <Button
            variant={view === "map" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("map")}
          >
            Map
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : places.length === 0 ? (
        <Card className="flex items-center justify-center py-16">
          <CardHeader className="text-center">
            <CardTitle className="text-base text-muted-foreground">
              No places found
            </CardTitle>
            <CardDescription>
              Try a different search query.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : view === "map" ? (
        <LeafletMap
          center={mapCenter ?? undefined}
          markers={markers}
          fitToMarkers={false}
          height="500px"
          onMarkerClick={(marker) => navigate({ to: "/places/$placeId", params: { placeId: marker.id } })}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

      <Dialog open={checkinOpen} onOpenChange={(open) => {
        if (!open) {
          resetCheckinForm();
          return;
        }
        setCheckinOpen(true);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check In</DialogTitle>
            <DialogDescription>
              Pick a location on the map. New places need a category before they can be added.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <LeafletMap
              markers={[...nearbyMapMarkers, ...pickedCheckinMarker]}
              onMapClick={handleCheckinMapClick}
              onMarkerClick={handleCheckinMarkerClick}
              height="250px"
            />

            {checkinLat && checkinLng && (
              <p className="text-xs text-muted-foreground">
                {checkinLat}, {checkinLng}
              </p>
            )}

            {checkinLat && checkinLng && (nearbyLoading ? (
              <p className="text-xs text-muted-foreground">Finding nearby places...</p>
            ) : nearbyPlaces.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Nearby places</p>
                <ul className="max-h-[150px] overflow-auto rounded-md border">
                  {nearbyPlaces.map((place) => (
                    <li
                      key={place.id}
                      onClick={() => selectNearbyPlace(place)}
                      className={`cursor-pointer border-b border-border px-3 py-2 transition-colors last:border-b-0 ${
                        selectedNearbyPlace?.id === place.id
                          ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{place.name}</span>
                        {place.category?.label && (
                          <Badge variant="secondary" className="text-[10px]">
                            {formatCategory(place.category)}
                          </Badge>
                        )}
                      </div>
                      <span className="ml-0 text-xs text-muted-foreground">
                        {formatDistance(place.distance)}
                        {place.checkinCount > 0 && ` · ${place.checkinCount} check-in${place.checkinCount !== 1 ? "s" : ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null)}

            <div className="space-y-2">
              <Label htmlFor="checkin-name">Place name *</Label>
              <Input
                id="checkin-name"
                placeholder="e.g. Tokyo Community Center"
                value={checkinName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setCheckinName(nextName);
                  if (selectedNearbyPlace && nextName !== selectedNearbyPlace.name) {
                    setSelectedNearbyPlace(null);
                    setCheckinCategoryId("");
                  }
                }}
              />
            </div>

            {selectedNearbyPlace ? (
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {selectedNearbyCategory ?? "Uncategorized"}
                </div>
              </div>
            ) : checkinLat && checkinLng ? (
              <div className="space-y-2">
                <Label htmlFor="checkin-category">Category *</Label>
                <PlaceCategorySelect
                  id="checkin-category"
                  value={checkinCategoryId}
                  onChange={setCheckinCategoryId}
                  options={placeCategories}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="checkin-note">Note (optional)</Label>
              <Textarea
                id="checkin-note"
                placeholder="What are you up to?"
                value={checkinNote}
                onChange={(event) => setCheckinNote(event.target.value)}
                rows={2}
              />
            </div>

            {isCreatingNewPlace && (
              <p className="text-xs text-muted-foreground">
                This location will be added as a new place.
              </p>
            )}

            {checkinError && <p className="text-sm text-destructive">{checkinError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetCheckinForm}>
              Cancel
            </Button>
            <Button onClick={handleCheckin} disabled={checkinSubmitting}>
              {checkinSubmitting ? "Checking in..." : "Check In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlaceCard({ place }: { place: PlaceItem }) {
  return (
    <Link to="/places/$placeId" params={{ placeId: place.id }} className="group block">
      <Card className="h-full gap-0 overflow-hidden rounded-lg py-0 transition-shadow hover:shadow-md">
        <CardContent className="flex-1 space-y-2.5 pb-5 pt-5">
          <h3 className="line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
            {place.name}
          </h3>

          {place.category?.label && (
            <Badge variant="secondary" className="text-xs">
              {formatCategory(place.category)}
            </Badge>
          )}

          <div className="space-y-1.5 text-sm text-muted-foreground">
            {place.address && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{place.address}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                <path fillRule="evenodd" d="M1 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V6Zm4 1.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm2 3a4 4 0 0 0-3.665 2.395.75.75 0 0 0 .416 1A8.98 8.98 0 0 0 7 14.5a8.98 8.98 0 0 0 3.249-.604.75.75 0 0 0 .416-1.001A4.001 4.001 0 0 0 7 10.5Zm5-3.75a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Zm0 6.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Zm.75-4a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5Z" clipRule="evenodd" />
              </svg>
              <span>{place.checkinCount} check-in{place.checkinCount !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {place.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {place.tags.map((tag) => (
                <Badge key={tag.slug} variant="secondary" className="text-xs">
                  {tag.label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
