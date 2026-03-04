import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places } from "~/server/db/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { EventCalendar, type CalendarEvent } from "~/components/EventCalendar";
import { UpcomingEventList } from "~/components/UpcomingEventList";
import { Calendar, ChevronLeft, List } from "lucide-react";

const getPlaceMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ placeId: z.string() })))
  .handler(async ({ data }) => {
    const [row] = await db
      .select({ name: places.name })
      .from(places)
      .where(eq(places.id, data.placeId))
      .limit(1);
    return row ?? null;
  });

export const Route = createFileRoute("/places/$placeId/events")({
  component: PlaceEventsPage,
  loader: async ({ params }) => {
    return getPlaceMeta({ data: { placeId: params.placeId } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return {
      meta: [
        { title: `Events — ${loaderData.name} — Moim` },
        { name: "description", content: `Event calendar for ${loaderData.name}` },
        { property: "og:title", content: `Events — ${loaderData.name}` },
        { property: "og:type", content: "website" },
      ],
    };
  },
});

function PlaceEventsPage() {
  const { placeId } = Route.useParams();
  const loaderData = Route.useLoaderData();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "upcoming">("calendar");

  useEffect(() => {
    fetch(`/api/places/${placeId}/events`)
      .then((r) => r.json())
      .then((d) => {
        setEvents(d.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [placeId]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link to="/places/$placeId" params={{ placeId }}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Events</h2>
            <p className="text-sm text-muted-foreground">
              {loaderData?.name ?? "Place"}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("calendar")}
          >
            <Calendar className="size-4" />
            Calendar
          </Button>
          <Button
            variant={view === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("upcoming")}
          >
            <List className="size-4" />
            Upcoming
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : view === "calendar" ? (
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <EventCalendar events={events} />
          </CardContent>
        </Card>
      ) : (
        <UpcomingEventList events={events} />
      )}
    </div>
  );
}
