import { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { PlacePicker, type SelectedPlace } from "~/components/PlacePicker";

export type EventType = "in_person" | "online";

type WhereCardProps = {
  eventType: EventType;
  onEventTypeChange: (value: EventType) => void;
  selectedPlace: SelectedPlace | null;
  onSelectedPlaceChange: (place: SelectedPlace | null) => void;
  venueDetail: string;
  onVenueDetailChange: (value: string) => void;
  meetingUrl: string;
  onMeetingUrlChange: (value: string) => void;
  /** Silently emitted when eventType=online and the browser already has
   *  geolocation permission. Consumed by the server only to reverse-geocode
   *  a country code — never persisted. */
  onOrganizerCoordsChange: (coords: { lat: number; lng: number } | null) => void;
  groupActorId?: string;
};

export function WhereCard({
  eventType,
  onEventTypeChange,
  selectedPlace,
  onSelectedPlaceChange,
  venueDetail,
  onVenueDetailChange,
  meetingUrl,
  onMeetingUrlChange,
  onOrganizerCoordsChange,
  groupActorId,
}: WhereCardProps) {
  const isOnline = eventType === "online";

  // Silent GPS capture: only fires when the user is toggling to online AND
  // the browser has already granted geolocation permission. We never trigger
  // a fresh permission prompt from this form.
  useEffect(() => {
    if (!isOnline) {
      onOrganizerCoordsChange(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;

    const requestCoords = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          onOrganizerCoordsChange({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          if (cancelled) return;
          onOrganizerCoordsChange(null);
        },
        { enableHighAccuracy: false, timeout: 3000 },
      );
    };

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (cancelled) return;
          if (status.state === "granted") {
            requestCoords();
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [isOnline, onOrganizerCoordsChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where</CardTitle>
        <CardDescription>
          {isOnline ? "Add a meeting link for your online event." : "Add a location for your event."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          role="tablist"
          aria-label="Event format"
          className="inline-flex rounded-md border border-border bg-muted p-0.5 text-sm"
        >
          {(
            [
              { value: "in_person", label: "In-person" },
              { value: "online", label: "Online" },
            ] as const
          ).map((opt) => {
            const selected = eventType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onEventTypeChange(opt.value)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {isOnline ? (
          <div className="space-y-1.5">
            <Label htmlFor="meetingUrl">Meeting URL *</Label>
            <Input
              id="meetingUrl"
              type="url"
              placeholder="https://zoom.us/j/... or https://meet.google.com/..."
              value={meetingUrl}
              onChange={(e) => onMeetingUrlChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Participants will see this link on the event page. Zoom, Google Meet, Discord, etc.
            </p>
          </div>
        ) : (
          <>
            <PlacePicker
              value={selectedPlace}
              onChange={onSelectedPlaceChange}
              groupActorId={groupActorId}
            />
            <div className="space-y-1.5">
              <Label htmlFor="venueDetail">Venue detail (optional)</Label>
              <Input
                id="venueDetail"
                type="text"
                placeholder="e.g. 3F, Room 301"
                value={venueDetail}
                onChange={(e) => onVenueDetailChange(e.target.value)}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
