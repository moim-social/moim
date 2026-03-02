import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places } from "~/server/db/schema";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
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
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { usePostHog } from "posthog-js/react";
import { LeafletMap } from "~/components/LeafletMap";

const getPlaceMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ placeId: z.string() })))
  .handler(async ({ data }) => {
    const [row] = await db
      .select({
        name: places.name,
        description: places.description,
        address: places.address,
      })
      .from(places)
      .where(eq(places.id, data.placeId))
      .limit(1);
    return row ?? null;
  });

export const Route = createFileRoute("/places/$placeId/")({
  component: PlaceDetailPage,
  loader: async ({ params }) => {
    return getPlaceMeta({ data: { placeId: params.placeId } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const desc = loaderData.description ?? loaderData.address ?? "A place on Moim";
    return {
      meta: [
        { title: `${loaderData.name} — Moim` },
        { name: "description", content: desc },
        { property: "og:title", content: loaderData.name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "place" },
      ],
    };
  },
});

const MAP_LINK_BUILDERS: Record<string, (name: string, lat: number, lng: number) => { label: string; url: string }> = {
  google: (name, lat, lng) => ({
    label: "Google",
    url: `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lng},15z`,
  }),
  kakao: (name, lat, lng) => ({
    label: "Kakao",
    url: `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`,
  }),
  naver: (name, lat, lng) => ({
    label: "Naver",
    url: `https://map.naver.com/p/search/${encodeURIComponent(name)}?c=${lng},${lat},15,0,0,0,dh`,
  }),
};

type PlaceDetail = {
  place: {
    id: string;
    name: string;
    description: string | null;
    latitude: string | null;
    longitude: string | null;
    address: string | null;
    website: string | null;
  };
  tags: Array<{ slug: string; label: string }>;
  recentCheckins: Array<{
    id: string;
    note: string | null;
    createdAt: string;
    userDisplayName: string;
    userHandle: string | null;
    userAvatarUrl: string | null;
  }>;
  checkinCount: number;
  upcomingEvents: Array<{
    id: string;
    title: string;
    startsAt: string;
  }>;
  mapLinkProviders: string[];
};

function PlaceDetailPage() {
  const posthog = usePostHog();
  const { placeId } = Route.useParams();
  const [data, setData] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ handle: string } | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/places/${placeId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [placeId]);

  const handleCheckin = async () => {
    setCheckinSubmitting(true);
    try {
      const res = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: data!.place.latitude,
          longitude: data!.place.longitude,
          name: data!.place.name,
          note: checkinNote || undefined,
        }),
      });
      if (res.ok) {
        posthog?.capture("checkin_created", { placeId });
        setCheckinOpen(false);
        setCheckinNote("");
        // Refresh data
        const refreshed = await fetch(`/api/places/${placeId}`).then((r) => r.json());
        setData(refreshed);
      }
    } finally {
      setCheckinSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (!data?.place) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Place not found</h2>
        <Button asChild variant="outline">
          <Link to="/places">Back to Places</Link>
        </Button>
      </div>
    );
  }

  const { place, tags, recentCheckins, checkinCount, upcomingEvents, mapLinkProviders } = data;
  const hasCoords = place.latitude && place.longitude;

  const mapLinks = hasCoords
    ? mapLinkProviders
        .map((p) => MAP_LINK_BUILDERS[p]?.(place.name, parseFloat(place.latitude!), parseFloat(place.longitude!)))
        .filter((v): v is { label: string; url: string } => v != null)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{place.name}</h2>
          {place.address && (
            <p className="text-muted-foreground mt-1">{place.address}</p>
          )}
          {mapLinks.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1 text-sm">
              {mapLinks.map(({ label, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
        {user && (
          <Button onClick={() => setCheckinOpen(true)}>Check In</Button>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag.slug} variant="secondary">{tag.label}</Badge>
          ))}
        </div>
      )}

      {/* Map */}
      {hasCoords && (
        <LeafletMap
          center={[parseFloat(place.latitude!), parseFloat(place.longitude!)]}
          zoom={15}
          markers={[{
            lat: parseFloat(place.latitude!),
            lng: parseFloat(place.longitude!),
            label: place.name,
            id: place.id,
          }]}
          height="300px"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="md:col-span-2 space-y-6">
          {/* About */}
          {place.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{place.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Recent check-ins */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent Check-ins ({checkinCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCheckins.length === 0 ? (
                <p className="text-sm text-muted-foreground">No check-ins yet. Be the first!</p>
              ) : (
                <div className="space-y-4">
                  {recentCheckins.map((checkin) => (
                    <div key={checkin.id} className="flex items-start gap-3">
                      <Avatar className="size-8">
                        {checkin.userAvatarUrl && <AvatarImage src={checkin.userAvatarUrl} alt={checkin.userDisplayName} />}
                        <AvatarFallback className="text-xs">
                          {checkin.userDisplayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{checkin.userDisplayName}</span>
                          <span className="text-muted-foreground text-xs">
                            {new Date(checkin.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {checkin.note && (
                          <p className="text-sm text-muted-foreground mt-0.5">{checkin.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info card */}
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm">
              {place.address && (
                <div>
                  <span className="text-muted-foreground">Address</span>
                  <p>{place.address}</p>
                </div>
              )}
              {place.website && (
                <div>
                  <span className="text-muted-foreground">Website</span>
                  <p>
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {place.website}
                    </a>
                  </p>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total check-ins</span>
                <span className="font-medium">{checkinCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingEvents.map((event) => (
                    <Link
                      key={event.id}
                      to="/events/$eventId"
                      params={{ eventId: event.id }}
                      className="block text-sm hover:text-primary transition-colors"
                    >
                      <span className="font-medium">{event.title}</span>
                      <span className="text-muted-foreground ml-2">
                        {new Date(event.startsAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Check-in dialog */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check in at {place.name}</DialogTitle>
            <DialogDescription>
              Let others know you're here. Add an optional note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkin-note">Note (optional)</Label>
              <Textarea
                id="checkin-note"
                placeholder="What are you up to?"
                value={checkinNote}
                onChange={(e) => setCheckinNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckinOpen(false)}>
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
