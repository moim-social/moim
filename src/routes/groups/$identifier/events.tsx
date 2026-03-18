import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { EventCalendar, type CalendarEvent } from "~/components/EventCalendar";
import { UpcomingEventList } from "~/components/UpcomingEventList";
import { Calendar, CalendarPlus, ChevronLeft, List } from "lucide-react";

const getGroupMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ handle: z.string() })))
  .handler(async ({ data }) => {
    const [group] = await db
      .select({ name: actors.name, handle: actors.handle, domain: actors.domain })
      .from(actors)
      .where(and(eq(actors.handle, data.handle), eq(actors.type, "Group"), eq(actors.isLocal, true)))
      .limit(1);
    return group ?? null;
  });

export const Route = createFileRoute("/groups/$identifier/events")({
  component: GroupEventsPage,
  loader: async ({ params }) => {
    const handle = params.identifier.startsWith("@")
      ? params.identifier.slice(1)
      : params.identifier;
    return getGroupMeta({ data: { handle } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const name = loaderData.name ?? `@${loaderData.handle}`;
    return {
      meta: [
        { title: `Events — ${name} — Moim` },
        { name: "description", content: `Event calendar for ${name}` },
        { property: "og:title", content: `Events — ${name}` },
        { property: "og:type", content: "website" },
      ],
    };
  },
});

function GroupEventsPage() {
  const { identifier } = Route.useParams();
  const handle = identifier.replace(/^@/, "");

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "upcoming">("calendar");

  useEffect(() => {
    fetch(`/api/groups/by-handle/${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d) => {
        setEvents(d.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [handle]);

  const groupName = `@${handle}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link to="/groups/$identifier" params={{ identifier }}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Events</h2>
            <p className="text-sm text-muted-foreground">{groupName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={`/groups/@${handle}/events.ics`}
            title="Subscribe to calendar"
            className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <CalendarPlus className="size-4" />
          </a>
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
