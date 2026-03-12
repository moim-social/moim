import { useState, useEffect, useCallback } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useIsMobile } from "~/hooks/useIsMobile";
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
} from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { LeafletMap, type MapMarker } from "~/components/LeafletMap";
import { PlaceCategorySelect } from "~/components/PlaceCategorySelect";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { X, Copy, Check, MapPin, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/places/")({
  component: CheckinsPage,
  head: () => ({
    meta: [
      { title: "Check-ins — Moim" },
      { name: "description", content: "See where people are hanging out nearby." },
      { property: "og:title", content: "Check-ins — Moim" },
      { property: "og:description", content: "See where people are hanging out nearby." },
      { property: "og:type", content: "website" },
    ],
  }),
});

function formatCategory(category: PlaceCategorySummary | null | undefined): string | null {
  if (!category || !category.label) return null;
  return `${category.emoji ?? ""} ${category.label}`.trim();
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function zoomToRadius(zoom: number): number {
  if (zoom >= 18) return 0.2;
  if (zoom >= 16) return 0.5;
  if (zoom >= 14) return 1;
  if (zoom >= 12) return 2;
  if (zoom >= 10) return 5;
  return 10;
}


type CheckinConfirmation = {
  placeName: string;
  placeEmoji: string | null;
  placeId: string;
  note: string | null;
  createdAt: string;
  mapImageUrl: string | null;
};

function CheckinsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<{ handle: string } | null>(null);
  const [placeCategories, setPlaceCategories] = useState<PlaceCategoryOption[]>([]);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(13);
  const [gpsLoading, setGpsLoading] = useState(true);

  // Nearby places
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  // Recent check-ins for selected place
  const [placeCheckins, setPlaceCheckins] = useState<{
    id: string;
    note: string | null;
    createdAt: string;
    userDisplayName: string;
    userHandle: string | null;
    userAvatarUrl: string | null;
  }[]>([]);
  const [placeCheckinsLoading, setPlaceCheckinsLoading] = useState(false);

  // Check-in form state
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [checkinName, setCheckinName] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinLat, setCheckinLat] = useState("");
  const [checkinLng, setCheckinLng] = useState("");
  const [checkinCategoryId, setCheckinCategoryId] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [checkinError, setCheckinError] = useState("");

  // Pinned location (persists on map after dialog/form closes)
  const [pinnedLocation, setPinnedLocation] = useState<{ lat: string; lng: string; placeId?: string } | null>(null);

  // Confirmation card
  const [confirmation, setConfirmation] = useState<CheckinConfirmation | null>(null);
  const [copied, setCopied] = useState(false);

  // Check-in dialog state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Open dialog for new place check-in
  const openNewCheckin = () => {
    // Use pinned location if user already clicked the map, otherwise fall back to GPS
    if (pinnedLocation) {
      setCheckinLat(pinnedLocation.lat);
      setCheckinLng(pinnedLocation.lng);
    } else if (mapCenter) {
      setCheckinLat(mapCenter[0].toFixed(6));
      setCheckinLng(mapCenter[1].toFixed(6));
    }
    setSelectedPlace(null);
    setCheckinName("");
    setCheckinCategoryId("");
    setCheckinError("");
    setDialogOpen(true);
  };

  const isCreatingNewPlace = !!checkinLat && !!checkinLng && selectedPlace == null;

  // Init: fetch session + categories
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});

    fetch("/api/place-categories")
      .then((r) => r.json())
      .then((data) => setPlaceCategories(data.options ?? []))
      .catch(() => {});
  }, []);

  // GPS auto-detect
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        setPinnedLocation({ lat, lng });
        setCheckinLat(lat);
        setCheckinLng(lng);
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, []);

  // Fetch nearby places when map center or zoom changes
  const fetchNearby = useCallback((lat: number, lng: number, radius: number) => {
    setNearbyLoading(true);
    fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}`)
      .then((r) => r.json())
      .then((data) => setNearbyPlaces(data.places ?? []))
      .catch(() => setNearbyPlaces([]))
      .finally(() => setNearbyLoading(false));
  }, []);

  useEffect(() => {
    if (mapCenter) fetchNearby(mapCenter[0], mapCenter[1], zoomToRadius(mapZoom));
  }, [mapCenter, mapZoom, fetchNearby]);

  // Select a nearby place (sets pin, fetches recent check-ins, does NOT open dialog)
  const selectPlace = (place: NearbyPlace) => {
    setSelectedPlace(place);
    setCheckinLat(place.latitude);
    setCheckinLng(place.longitude);
    setCheckinName(place.name);
    setCheckinCategoryId(place.category?.slug ?? "");
    setCheckinError("");
    setPinnedLocation({ lat: place.latitude, lng: place.longitude, placeId: place.id });

    // Fetch recent check-ins for this place
    setPlaceCheckinsLoading(true);
    setPlaceCheckins([]);
    fetch(`/api/check-ins?placeId=${place.id}&limit=5`)
      .then((r) => r.json())
      .then((data) => setPlaceCheckins(data.checkins ?? []))
      .catch(() => setPlaceCheckins([]))
      .finally(() => setPlaceCheckinsLoading(false));
  };

  // Map click: pick a new location (sets pin, does NOT open dialog)
  const handleMapClick = (lat: number, lng: number) => {
    setCheckinLat(lat.toFixed(6));
    setCheckinLng(lng.toFixed(6));
    setCheckinName("");
    setCheckinCategoryId("");
    setSelectedPlace(null);
    setCheckinError("");
    setPinnedLocation({ lat: lat.toFixed(6), lng: lng.toFixed(6) });
    fetchNearby(lat, lng, zoomToRadius(mapZoom));
  };

  // Map marker click
  const handleMarkerClick = (marker: MapMarker) => {
    const place = nearbyPlaces.find((p) => p.id === marker.id);
    if (place) selectPlace(place);
    else navigate({ to: "/places/$placeId", params: { placeId: marker.id } });
  };

  const resetForm = () => {
    setSelectedPlace(null);
    setCheckinName("");
    setCheckinNote("");
    setCheckinLat("");
    setCheckinLng("");
    setCheckinCategoryId("");
    setCheckinError("");
    setDialogOpen(false);
    // pinnedLocation is intentionally NOT cleared — red pin stays on map
  };

  // Submit check-in
  const handleCheckin = async () => {
    if (!checkinName.trim()) {
      setCheckinError("Place name is required");
      return;
    }
    if (!checkinLat || !checkinLng) {
      setCheckinError("Pick a location on the map");
      return;
    }
    if (!selectedPlace && !checkinCategoryId) {
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
          categoryId: selectedPlace ? undefined : checkinCategoryId,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setCheckinError(data.error || "Failed to check in");
        return;
      }

      const result = await response.json();
      setConfirmation({
        placeName: result.place.name,
        placeEmoji: result.place.category?.emoji ?? null,
        placeId: result.place.id,
        note: result.checkin.note,
        createdAt: result.checkin.createdAt,
        mapImageUrl: result.place.mapImageUrl,
      });
      resetForm();
      setPinnedLocation(null);

      // Re-fetch nearby to update counts
      if (mapCenter) fetchNearby(mapCenter[0], mapCenter[1], zoomToRadius(mapZoom));
    } catch {
      setCheckinError("Failed to check in");
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const handleCopyLink = async (placeId: string) => {
    const url = `${window.location.origin}/places/${placeId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map markers
  const nearbyMarkers: MapMarker[] = nearbyPlaces
    .filter((p) => p.latitude && p.longitude)
    .map((p) => ({
      lat: parseFloat(p.latitude),
      lng: parseFloat(p.longitude),
      label: p.name,
      id: p.id,
      color: (pinnedLocation?.placeId === p.id || selectedPlace?.id === p.id) ? "red" as const : "blue" as const,
      highlighted: pinnedLocation?.placeId === p.id || selectedPlace?.id === p.id,
      glyph: p.category?.emoji ?? null,
    }));

  const pickedMarker: MapMarker[] =
    pinnedLocation && !pinnedLocation.placeId
      ? [{
          lat: parseFloat(pinnedLocation.lat),
          lng: parseFloat(pinnedLocation.lng),
          label: checkinName || "New place",
          id: "new",
          color: "red" as const,
          highlighted: true,
          glyph: placeCategories.find((c) => c.slug === checkinCategoryId)?.emoji ?? null,
        }]
      : [];

  // Check-in form fields (shared between inline and drawer)
  const checkinFormFields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="checkin-name">Place name *</Label>
        <Input
          id="checkin-name"
          placeholder="e.g. Tokyo Community Center"
          value={checkinName}
          onChange={(e) => {
            setCheckinName(e.target.value);
            if (selectedPlace && e.target.value !== selectedPlace.name) {
              setSelectedPlace(null);
              setCheckinCategoryId("");
            }
          }}
        />
      </div>

      {selectedPlace ? (
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {formatCategory(selectedPlace.category) ?? "Uncategorized"}
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
          onChange={(e) => setCheckinNote(e.target.value)}
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
  );

  const checkinFormActions = (
    <div className="flex gap-2 justify-end">
      <Button variant="outline" size="sm" onClick={resetForm}>
        Cancel
      </Button>
      <Button size="sm" onClick={handleCheckin} disabled={checkinSubmitting}>
        {checkinSubmitting ? "Checking in..." : "Check In"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Check-ins</h2>
          <p className="mt-1 text-muted-foreground">
            See where people are hanging out nearby.
          </p>
        </div>
        {user && (
          <Button onClick={openNewCheckin} className="hidden md:inline-flex">
            <MapPin className="size-4" />
            Check In
          </Button>
        )}
      </div>

      {user && (
        <Button onClick={openNewCheckin} className="w-full md:hidden">
          <MapPin className="size-4" />
          Check In
        </Button>
      )}

      {/* Map */}
      <LeafletMap
        center={mapCenter ?? undefined}
        markers={[...nearbyMarkers, ...pickedMarker]}
        circle={pinnedLocation ? { center: [parseFloat(pinnedLocation.lat), parseFloat(pinnedLocation.lng)], radiusKm: zoomToRadius(mapZoom) } : undefined}
        fitToMarkers={false}
        onMapClick={handleMapClick}
        onMarkerClick={handleMarkerClick}
        onZoomEnd={setMapZoom}
        height={isMobile ? "350px" : "500px"}
      />

      {/* Nearby places — horizontal scroll */}
      {gpsLoading ? (
        <p className="text-sm text-muted-foreground">Getting your location...</p>
      ) : nearbyLoading ? (
        <p className="text-sm text-muted-foreground">Finding nearby places...</p>
      ) : nearbyPlaces.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Nearby</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {nearbyPlaces.map((place) => (
              <NearbyPlaceCard
                key={place.id}
                place={place}
                selected={pinnedLocation?.placeId === place.id}
                onSelect={() => selectPlace(place)}
              />
            ))}
          </div>
        </div>
      ) : mapCenter ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          <span>No places nearby yet. Tap the map to check in somewhere new!</span>
        </div>
      ) : null}

      {/* Recent check-ins for selected place */}
      {selectedPlace && (
        <Card>
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedPlace.category?.emoji && (
                  <span className="text-xl">{selectedPlace.category.emoji}</span>
                )}
                <div>
                  <h3 className="text-sm font-semibold leading-tight">{selectedPlace.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatDistance(selectedPlace.distance)} away
                    {selectedPlace.checkinCount > 0 && ` · ${selectedPlace.checkinCount} check-in${selectedPlace.checkinCount !== 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
              <Link
                to="/places/$placeId"
                params={{ placeId: selectedPlace.id }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
              >
                View details
                <ExternalLink className="size-3" />
              </Link>
            </div>

            {placeCheckinsLoading ? (
              <div className="flex items-center gap-2 py-3">
                <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading check-ins...</span>
              </div>
            ) : placeCheckins.length > 0 ? (
              <div className="divide-y">
                {placeCheckins.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Avatar className="size-8 shrink-0 mt-0.5">
                      {c.userAvatarUrl && <AvatarImage src={c.userAvatarUrl} alt={c.userDisplayName} />}
                      <AvatarFallback className="text-xs">
                        {c.userDisplayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{c.userDisplayName}</span>
                        <span className="text-[11px] text-muted-foreground/60 shrink-0">
                          {formatRelativeTime(c.createdAt)}
                        </span>
                      </div>
                      {c.note && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{c.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 py-2">No check-ins yet. Be the first!</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation card */}
      {confirmation && (
        <ConfirmationCard
          confirmation={confirmation}
          copied={copied}
          onCopyLink={() => handleCopyLink(confirmation.placeId)}
          onDismiss={() => setConfirmation(null)}
        />
      )}

      {/* Check-in dialog */}
      {(
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogContent className="max-h-[85vh] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] sm:w-full sm:max-w-md flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                {selectedPlace
                  ? `Check in at ${selectedPlace.category?.emoji ?? ""} ${selectedPlace.name}`.trim()
                  : "Check in at a new place"}
              </DialogTitle>
              <DialogDescription>
                {checkinLat && checkinLng ? `${checkinLat}, ${checkinLng}` : "Pick a location on the map"}
              </DialogDescription>
            </DialogHeader>
            {!user ? (
              <p className="text-sm text-muted-foreground py-4">Sign in to check in at this place.</p>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto min-w-0 space-y-4">
                  {/* Nearby places for easy selection */}
                  {nearbyPlaces.length > 0 && !selectedPlace && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Nearby places</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                        {nearbyPlaces.slice(0, 10).map((place) => (
                          <button
                            key={place.id}
                            type="button"
                            onClick={() => selectPlace(place)}
                            className="flex-none snap-start rounded-md border border-border px-3 py-2 text-left hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center gap-1">
                              {place.category?.emoji && <span className="text-sm">{place.category.emoji}</span>}
                              <span className="text-sm font-medium truncate max-w-[120px]">{place.name}</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{formatDistance(place.distance)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {checkinFormFields}
                </div>
                <DialogFooter>
                  {checkinFormActions}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

function NearbyPlaceCard({
  place,
  selected,
  onSelect,
}: {
  place: NearbyPlace;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-none snap-start w-[160px] rounded-lg border p-3 text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-accent"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {place.category?.emoji && (
          <span className="text-lg">{place.category.emoji}</span>
        )}
        <span className="font-medium text-sm truncate">{place.name}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {formatDistance(place.distance)}
      </div>
      <div className="mt-2">
        {place.latestCheckin ? (
          <div className="flex items-center gap-1.5">
            <Avatar className="size-4">
              {place.latestCheckin.userAvatarUrl && (
                <AvatarImage src={place.latestCheckin.userAvatarUrl} alt={place.latestCheckin.userDisplayName} />
              )}
              <AvatarFallback className="text-[8px]">
                {place.latestCheckin.userDisplayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground truncate">
              {place.latestCheckin.userDisplayName}
            </span>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {formatRelativeTime(place.latestCheckin.createdAt)}
            </span>
          </div>
        ) : place.checkinCount > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {place.checkinCount} check-in{place.checkinCount !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/60">No check-ins yet</span>
        )}
      </div>
    </button>
  );
}

function ConfirmationCard({
  confirmation,
  copied,
  onCopyLink,
  onDismiss,
}: {
  confirmation: CheckinConfirmation;
  copied: boolean;
  onCopyLink: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="relative overflow-hidden">
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-3 right-3 rounded-full p-1 hover:bg-accent transition-colors"
      >
        <X className="size-4 text-muted-foreground" />
      </button>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Checked in
          </Badge>
        </div>
        <h3 className="font-semibold">
          {confirmation.placeEmoji && <span className="mr-1">{confirmation.placeEmoji}</span>}
          {confirmation.placeName}
        </h3>
        {confirmation.note && (
          <p className="text-sm text-muted-foreground italic">"{confirmation.note}"</p>
        )}
        <div className="flex items-center gap-4">
          {confirmation.mapImageUrl && (
            <img
              src={confirmation.mapImageUrl}
              alt={`Map of ${confirmation.placeName}`}
              className="w-24 h-24 rounded-md object-cover border"
            />
          )}
          <div className="flex-1 space-y-2">
            <p className="text-xs text-muted-foreground">
              {new Date(confirmation.createdAt).toLocaleString()}
            </p>
            <Button variant="outline" size="sm" onClick={onCopyLink} className="gap-1.5">
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
