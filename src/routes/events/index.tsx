import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEventCategories, useEventCategoryMap } from "~/hooks/useEventCategories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
  validateSearch: (search: Record<string, unknown>): { category?: string; country?: string } => ({
    category: typeof search.category === "string" ? search.category : undefined,
    country: typeof search.country === "string" ? search.country : undefined,
  }),
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


type EventItem = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  country: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  location: string | null;
  headerImageUrl: string | null;
  groupHandle: string | null;
  groupName: string | null;
  organizerHandle: string | null;
  organizerDisplayName: string | null;
  organizerActorUrl: string | null;
};

type CountryOption = { code: string; name: string };

function EventsPage() {
  const { category, country } = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const { categories } = useEventCategories();
  const categoryMap = new Map(categories.map(c => [c.slug, c.label]));
  const [user, setUser] = useState<{ handle: string } | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [countries, setCountries] = useState<CountryOption[]>([]);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab === "past") params.set("past", "1");
    if (category) params.set("category", category);
    if (country) params.set("country", country);
    const qs = params.toString();
    fetch(`/api/events${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, category, country]);

  const updateSearch = (updates: { category?: string; country?: string }) => {
    const next = { category, country, ...updates };
    navigate({
      search: {
        ...(next.category ? { category: next.category } : {}),
        ...(next.country ? { country: next.country } : {}),
      },
    });
  };

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

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
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

          {countries.length > 0 && (
            <select
              className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
              value={country ?? ""}
              onChange={(e) => updateSearch({ country: e.target.value || undefined })}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Category pills — horizontal scroll */}
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <div className="flex gap-1.5 w-max items-center">
            <Button
              variant={!category ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => updateSearch({ category: undefined })}
            >
              All
            </Button>
            {categories.map((cat) => {
              const isActive = category === cat.slug;
              return (
                <Button
                  key={cat.slug}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => updateSearch({ category: isActive ? undefined : cat.slug })}
                >
                  {cat.label}
                </Button>
              );
            })}
          </div>
        </div>

        {category && (
          <Link
            to="/categories/$categoryId"
            params={{ categoryId: category }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
              <path d="M8.543 2.232a.75.75 0 0 0-1.085 0l-5.25 5.5A.75.75 0 0 0 2.75 9H4v4a1 1 0 0 0 1 1h1.5a.5.5 0 0 0 .5-.5v-2a1 1 0 0 1 2 0v2a.5.5 0 0 0 .5.5H11a1 1 0 0 0 1-1V9h1.25a.75.75 0 0 0 .543-1.268l-5.25-5.5Z" />
            </svg>
            Go to {categoryMap.get(category)} feed page
          </Link>
        )}
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
        <div className="divide-y border-t border-b">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: EventItem }) {
  const { categoryMap } = useEventCategoryMap();
  const start = new Date(event.startsAt);
  const eventTz = event.timezone ?? undefined;
  const month = start.toLocaleDateString(undefined, { month: "short", timeZone: eventTz });
  const day = start.toLocaleDateString(undefined, { day: "numeric", timeZone: eventTz });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: eventTz,
  });
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
    <Link to="/events/$eventId" params={{ eventId: event.id }} className="group block">
      <div className="flex items-start gap-4 py-4 hover:bg-[#fafafa] transition-colors px-2">
        {/* Date column or image thumbnail */}
        {event.headerImageUrl ? (
          <div
            className="shrink-0 w-16 h-16 bg-cover bg-center border"
            style={{ backgroundImage: `url(${event.headerImageUrl})` }}
          />
        ) : (
          <div className="shrink-0 w-12 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{month}</p>
            <p className="text-2xl font-extrabold tracking-tight leading-none">{day}</p>
          </div>
        )}

        {/* Event info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h3 className="font-bold tracking-tight leading-snug line-clamp-2 group-hover:underline">
            {event.title}
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>{timeStr}</span>
            {event.location && <span className="truncate max-w-[200px]">{event.location}</span>}
            {hostLabel && (
              hostLink ? (
                hostIsExternal ? (
                  <a
                    href={hostLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hostLabel}
                  </a>
                ) : (
                  <Link
                    to={hostLink}
                    className="hover:underline hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {hostLabel}
                  </Link>
                )
              ) : (
                <span>{hostLabel}</span>
              )
            )}
          </div>
          {event.categoryId && (
            <Link
              to="/categories/$categoryId"
              params={{ categoryId: event.categoryId }}
              onClick={(e) => e.stopPropagation()}
              className="inline-block"
            >
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                {categoryMap.get(event.categoryId) ?? event.categoryId}
              </Badge>
            </Link>
          )}
        </div>

        {event.country && (
          <span className="shrink-0 text-xs text-muted-foreground">{event.country}</span>
        )}
      </div>
    </Link>
  );
}
