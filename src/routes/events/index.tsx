import { useState, useEffect } from "react";
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

export const Route = createFileRoute("/events/")({
  component: EventsPage,
  head: () => ({
    meta: [
      { title: "Events — Moim" },
      { name: "description", content: "Discover upcoming events from groups across the fediverse." },
      { property: "og:title", content: "Events — Moim" },
      { property: "og:description", content: "Discover upcoming events from groups across the fediverse." },
      { property: "og:type", content: "website" },
    ],
  }),
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

function EventsPage() {
  const [user, setUser] = useState<{ handle: string } | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    fetch("/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = tab === "past" ? "/events/list?past=1" : "/events/list";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
          <p className="text-muted-foreground mt-1">
            Discover upcoming events from groups across the fediverse.
          </p>
        </div>
        {user && (
          <Button asChild>
            <Link to="/events/create">Create Event</Link>
          </Button>
        )}
      </div>

      {/* Upcoming / Past toggle */}
      <div className="flex gap-1">
        <Button
          variant={tab === "upcoming" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("upcoming")}
        >
          Upcoming
        </Button>
        <Button
          variant={tab === "past" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("past")}
        >
          Past
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <Card className="flex items-center justify-center py-16">
          <CardHeader className="text-center">
            <CardTitle className="text-base text-muted-foreground">
              {tab === "past" ? "No past events" : "No upcoming events"}
            </CardTitle>
            <CardDescription>
              {tab === "past"
                ? "Past events will appear here."
                : "Create a group to start hosting events."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

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

  const hostLink = event.groupHandle
    ? `/groups/@${event.groupHandle}`
    : event.organizerActorUrl
      ? event.organizerActorUrl
      : null;

  const hostIsExternal = !event.groupHandle && !!event.organizerActorUrl;

  return (
    <Link to="/events/$eventId" params={{ eventId: event.id }} className="group block cursor-pointer">
      <Card className="rounded-lg overflow-hidden transition-shadow hover:shadow-md h-full flex flex-col gap-0 py-0 cursor-pointer">
        {/* Gradient banner */}
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

        {/* Event info */}
        <CardContent className="pt-4 pb-5 space-y-2.5 flex-1">
          <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            {/* Date */}
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
              </svg>
              <span>{dateStr} · {timeStr}</span>
            </div>

            {/* Host */}
            {hostLabel && (
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                </svg>
                {hostLink ? (
                  hostIsExternal ? (
                    <a
                      href={hostLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline hover:text-foreground cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hostLabel}
                    </a>
                  ) : (
                    <Link
                      to={hostLink}
                      className="truncate hover:underline hover:text-foreground cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {hostLabel}
                    </Link>
                  )
                ) : (
                  <span className="truncate">{hostLabel}</span>
                )}
              </div>
            )}

            {/* Location */}
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
