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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { usePostHog } from "posthog-js/react";
import { LeafletMap } from "~/components/LeafletMap";
import { Calendar } from "lucide-react";
import { type PlaceCategorySummary, resolveCategoryLabel } from "~/lib/place";

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
    category: PlaceCategorySummary | null;
  };
  categoryPath: PlaceCategorySummary[];
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
  managedByGroup: boolean;
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
          <Link to="/places">Back to Check-ins</Link>
        </Button>
      </div>
    );
  }

  const { place, tags, recentCheckins, checkinCount, upcomingEvents, managedByGroup, mapLinkProviders } = data;
  const hasCoords = place.latitude && place.longitude;
  const categoryPath = data.categoryPath ?? [];
  const mapLinks = hasCoords
    ? mapLinkProviders
        .map((p) => MAP_LINK_BUILDERS[p]?.(place.name, parseFloat(place.latitude!), parseFloat(place.longitude!)))
        .filter((v): v is { label: string; url: string } => v != null)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between pb-5 border-b-2 border-foreground">
        <div>
          {categoryPath.length > 0 && (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {categoryPath.map((cat) => cat.label ? resolveCategoryLabel(cat as { label: string; labels?: Record<string, string> }) : cat.slug).join(" / ")}
            </p>
          )}
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
            {place.name}
          </h2>
          {place.address && (
            <p className="text-[14px] text-[#666] mt-1">{place.address}</p>
          )}
        </div>
        <div className="flex gap-2">
          {managedByGroup && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/places/$placeId/events" params={{ placeId: place.id }}>
                <Calendar className="size-4" />
                Events
              </Link>
            </Button>
          )}
          {user && (
            <Button onClick={() => setCheckinOpen(true)}>Check In</Button>
          )}
        </div>
      </div>

      {/* Map — full width */}
      {hasCoords && (
        <div className="border border-[#e5e5e5] rounded overflow-hidden">
          <LeafletMap
            center={[parseFloat(place.latitude!), parseFloat(place.longitude!)]}
            zoom={15}
            markers={[{
              lat: parseFloat(place.latitude!),
              lng: parseFloat(place.longitude!),
              label: place.name,
              id: place.id,
              glyph: place.category?.emoji ?? null,
            }]}
            height="240px"
          />
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag.slug} variant="outline" className="text-[10px] uppercase tracking-wide font-semibold">{tag.label}</Badge>
          ))}
        </div>
      )}

      {/* Two-column: check-ins + metadata */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-0">
        {/* Left: about + check-ins */}
        <div className="md:border-r md:border-[#e5e5e5] md:pr-8 space-y-8 pb-8 md:pb-0">
          {/* About */}
          {place.description && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#333] mb-3">About</h3>
              <p className="text-[14px] text-[#444] leading-relaxed whitespace-pre-wrap">{place.description}</p>
            </section>
          )}

          {/* Recent check-ins */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#333] mb-3">
              Recent Check-ins ({checkinCount})
            </h3>
            {recentCheckins.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">No check-ins yet. Be the first!</p>
            ) : (
              <div className="divide-y divide-[#f0f0f0]">
                {recentCheckins.map((checkin) => (
                  <div key={checkin.id} className="flex items-start gap-3 py-3 first:pt-0">
                    <Avatar className="size-8 shrink-0">
                      {checkin.userAvatarUrl && <AvatarImage src={checkin.userAvatarUrl} alt={checkin.userDisplayName} />}
                      <AvatarFallback className="text-xs bg-muted">
                        {checkin.userDisplayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{checkin.userDisplayName}</span>
                        <span className="text-[11px] text-[#999]">
                          {new Date(checkin.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {checkin.note && (
                        <p className="mt-1 text-[13px] text-[#666]">{checkin.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: metadata */}
        <div className="md:pl-8 space-y-6 border-t md:border-t-0 border-[#e5e5e5] pt-6 md:pt-0">
          {/* Location info */}
          <div className="space-y-4">
            {place.address && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-[#888] mb-1">Address</h4>
                <p className="text-[14px] text-[#333]">{place.address}</p>
              </div>
            )}
            {place.website && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-[#888] mb-1">Website</h4>
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-[#333] underline underline-offset-2 break-all hover:text-foreground"
                >
                  {place.website}
                </a>
              </div>
            )}
            {mapLinks.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-[#888] mb-1.5">Open in Maps</h4>
                <div className="flex flex-wrap gap-1.5">
                  {mapLinks.map(({ label, url }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-[#ddd] rounded px-2.5 py-1 text-[12px] text-[#555] hover:border-[#999] hover:text-foreground transition-colors"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="border-t border-[#e5e5e5] pt-4">
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-[#888]">Total check-ins</span>
              <span className="text-[18px] font-extrabold">{checkinCount}</span>
            </div>
          </div>

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <div className="border-t border-[#e5e5e5] pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#333] mb-3">Upcoming Events</h3>
              <div className="divide-y divide-[#f0f0f0]">
                {upcomingEvents.map((event) => {
                  const d = new Date(event.startsAt);
                  const dayNum = d.getDate().toString();
                  const monthAbbr = d.toLocaleDateString(undefined, { month: "short" });
                  const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  return (
                    <Link
                      key={event.id}
                      to="/events/$eventId"
                      params={{ eventId: event.id }}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 group"
                    >
                      <div className="shrink-0 w-10 text-center border-l-[3px] border-foreground pl-2">
                        <span className="text-xl font-extrabold leading-none">{dayNum}</span>
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#888]">{monthAbbr}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-snug group-hover:underline line-clamp-2">{event.title}</p>
                        <p className="text-[11px] text-[#888] mt-0.5">{timeStr}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
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
