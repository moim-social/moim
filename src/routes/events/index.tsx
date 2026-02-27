import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CATEGORIES } from "~/shared/categories";
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

  useEffect(() => {
    fetch("/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/events/list")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <Card className="flex items-center justify-center py-16">
          <CardHeader className="text-center">
            <CardTitle className="text-base text-muted-foreground">
              No upcoming events
            </CardTitle>
            <CardDescription>
              Create a group to start hosting events.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
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
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link to="/events/$eventId" params={{ eventId: event.id }} className="block">
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-base">{event.title}</CardTitle>
            <CardDescription>
              {dateStr} at {timeStr}
            </CardDescription>
            {event.groupHandle ? (
              <p className="text-sm text-muted-foreground">
                Hosted by {event.groupName ?? `@${event.groupHandle}`}
              </p>
            ) : event.organizerHandle ? (
              <p className="text-sm text-muted-foreground">
                Hosted by{" "}
                {event.organizerActorUrl ? (
                  <a
                    href={event.organizerActorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{event.organizerHandle}
                  </a>
                ) : (
                  <span>@{event.organizerHandle}</span>
                )}
              </p>
            ) : null}
          </div>
          <Badge variant="secondary">
            {categoryMap.get(event.categoryId) ?? event.categoryId}
          </Badge>
        </CardHeader>
        {(event.description || event.location) && (
          <CardContent className="pt-0">
            {event.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {event.description}
              </p>
            )}
            {event.location && (
              <p className="text-sm text-muted-foreground mt-1">
                {event.location}
              </p>
            )}
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
