import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES } from "~/shared/categories";
import { pickGradient } from "~/shared/gradients";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { useAuth } from "~/routes/__root";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const categoryMap = new Map<string, string>(
  CATEGORIES.map((c) => [c.id, c.label]),
);

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  groupHandle: string | null;
  groupName: string | null;
  organizerHandle: string | null;
  organizerDisplayName: string | null;
  organizerActorUrl: string | null;
};

type CheckinItem = {
  id: string;
  note: string | null;
  createdAt: string;
  placeName: string;
  placeId: string;
  userDisplayName: string;
  userHandle: string | null;
  userAvatarUrl: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function HomePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = fetch("/events/list")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {});

    const fetchCheckins = fetch("/places/checkins?limit=10")
      .then((r) => r.json())
      .then((data) => setCheckins(data.checkins ?? []))
      .catch(() => {});

    Promise.all([fetchEvents, fetchCheckins]).finally(() => setLoading(false));
  }, []);

  const carouselEvents = events.slice(0, 5);
  const gridEvents = events.slice(0, 6);

  return (
    <div className="space-y-12">
      {/* Hero */}
      {loading ? (
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen">
          <div className="h-64 bg-muted animate-pulse" />
        </div>
      ) : carouselEvents.length > 0 ? (
        <EventCarousel events={carouselEvents} />
      ) : (
        <FallbackHero user={user} />
      )}

      {/* Upcoming Events */}
      {gridEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Upcoming Events</h2>
            <Link to="/events" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gridEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Check-ins */}
      {checkins.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Check-ins</h2>
            <div className="flex items-center gap-3">
              {user && (
                <Button size="sm" asChild>
                  <Link to="/places">Check In</Link>
                </Button>
              )}
              <Link to="/places" className="text-sm text-primary hover:underline">
                View all →
              </Link>
            </div>
          </div>
          <Card className="py-2">
            <CardContent className="px-4 pt-2 pb-1 divide-y divide-border/60">
              {checkins.map((checkin) => (
                <div key={checkin.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {checkin.userDisplayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{checkin.userDisplayName}</span>
                      {" checked in at "}
                      <Link
                        to="/places/$placeId"
                        params={{ placeId: checkin.placeId }}
                        className="inline-flex items-center gap-0.5 font-medium text-primary underline underline-offset-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0">
                          <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                        </svg>
                        {checkin.placeName}
                      </Link>
                    </p>
                    {checkin.note && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{checkin.note}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {timeAgo(checkin.createdAt)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {/* Show fallback feature cards when there's no content at all */}
      {!loading && events.length === 0 && checkins.length === 0 && (
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events</CardTitle>
              <CardDescription>
                Create, discover, and RSVP to events hosted by groups across the fediverse.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Places</CardTitle>
              <CardDescription>
                Find and share venues, spaces, and locations where communities gather.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Federated</CardTitle>
              <CardDescription>
                Sign in with your fediverse account. Follow groups from Mastodon, Misskey, and more.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      )}
    </div>
  );
}

/* ─── Event Carousel ─── */

function EventCarousel({ events }: { events: EventItem[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % events.length);
    }, 5000);
  }, [events.length]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  const goTo = (index: number) => {
    setCurrent(index);
    resetTimer();
  };

  const prev = () => goTo((current - 1 + events.length) % events.length);
  const next = () => goTo((current + 1) % events.length);

  const event = events[current];
  const [gradFrom, gradTo] = pickGradient(event.categoryId || event.id);
  const start = new Date(event.startsAt);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hostLabel = event.groupHandle
    ? (event.groupName ?? `@${event.groupHandle}`)
    : event.organizerHandle
      ? `@${event.organizerHandle}`
      : null;

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen">
      <div
        className="relative px-6 py-12 md:py-16 transition-colors duration-500"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        <div className="mx-auto max-w-5xl" style={{ color: "white" }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>
            Coming up next
          </p>

          {event.categoryId && (
            <Badge variant="secondary" className="mb-3 bg-white/20 border-white/30 hover:bg-white/30" style={{ color: "white" }}>
              {categoryMap.get(event.categoryId) ?? event.categoryId}
            </Badge>
          )}

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-2" style={{ color: "white" }}>
            {event.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
            <span>{dateStr} · {timeStr}</span>
            {event.location && <span>@ {event.location}</span>}
          </div>

          {hostLabel && (
            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
              Hosted by {hostLabel}
            </p>
          )}

          <div className="flex gap-3">
            <Button asChild className="bg-white hover:bg-white/90" style={{ color: "#111827" }}>
              <Link to="/events/$eventId" params={{ eventId: event.id }}>
                View Event
              </Link>
            </Button>
            <Button variant="outline" asChild className="bg-transparent hover:bg-white/20" style={{ color: "white", borderColor: "rgba(255,255,255,0.5)" }}>
              <Link to="/events">Browse All Events</Link>
            </Button>
          </div>

          {/* Navigation arrows */}
          {events.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
                aria-label="Previous event"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                  <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
                aria-label="Next event"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                  <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dots */}
              <div className="flex justify-center gap-2 mt-6">
                {events.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`size-2 rounded-full transition-colors ${i === current ? "bg-white" : "bg-white/40 hover:bg-white/60"}`}
                    aria-label={`Go to event ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Fallback Hero ─── */

function FallbackHero({ user }: { user: { handle: string } | null }) {
  return (
    <section className="flex flex-col items-center text-center py-12 space-y-4">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Discover events,<br />together across the fediverse
      </h1>
      <p className="max-w-lg text-lg text-muted-foreground">
        Moim is a federated events and places service — like connpass meets
        foursquare, powered by ActivityPub.
      </p>
      <div className="flex gap-3 pt-2">
        <Button asChild>
          <Link to="/events">Browse Events</Link>
        </Button>
        {!user && (
          <Button variant="outline" asChild>
            <Link to="/auth/signin">Sign in</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

/* ─── Event Card (inline, same as /events page) ─── */

function EventCard({ event }: { event: EventItem }) {
  const start = new Date(event.startsAt);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const [gradFrom, gradTo] = pickGradient(event.categoryId || event.id);

  const hostLabel = event.groupHandle
    ? (event.groupName ?? `@${event.groupHandle}`)
    : event.organizerHandle
      ? `@${event.organizerHandle}`
      : null;

  return (
    <Link to="/events/$eventId" params={{ eventId: event.id }} className="group block cursor-pointer">
      <Card className="rounded-lg overflow-hidden transition-shadow hover:shadow-md h-full flex flex-col gap-0 py-0 cursor-pointer">
        <div
          className="h-24 relative"
          style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
        >
          {event.categoryId && (
            <Badge
              variant="secondary"
              className="absolute bottom-3 left-4 bg-white/20 text-white border-white/30 text-xs"
            >
              {categoryMap.get(event.categoryId) ?? event.categoryId}
            </Badge>
          )}
        </div>
        <CardContent className="pt-4 pb-5 space-y-2.5 flex-1">
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
              </svg>
              <span>{dateStr} · {timeStr}</span>
            </div>
            {hostLabel && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                </svg>
                <span className="truncate">{hostLabel}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                </svg>
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
