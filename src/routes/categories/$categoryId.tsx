import { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { pickGradient } from "~/shared/gradients";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { RemoteFollowDialog } from "~/components/RemoteFollowDialog";
import { EventCalendar, type CalendarEvent } from "~/components/EventCalendar";
import { UpcomingEventList } from "~/components/UpcomingEventList";
import { useIsMobile } from "~/hooks/useIsMobile";
import { ChevronLeft, ChevronRight } from "lucide-react";

function slugToLabel(slug: string) {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const Route = createFileRoute("/categories/$categoryId")({
  component: CategoryDetailPage,
  validateSearch: (search: Record<string, unknown>): { country?: string } => ({
    country: typeof search.country === "string" ? search.country : undefined,
  }),
  head: ({ params }) => {
    const label = slugToLabel(params.categoryId);
    return {
      meta: [
        { title: `${label} Events — Moim` },
        { name: "description", content: `Discover ${label} events on Moim.` },
        { property: "og:title", content: `${label} Events — Moim` },
        { property: "og:description", content: `Discover ${label} events on Moim.` },
        { property: "og:type", content: "website" },
      ],
    };
  },
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

function toCalendarEvent(event: EventItem): CalendarEvent {
  return {
    id: event.id,
    title: event.title,
    categoryId: event.categoryId,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    location: event.location,
    country: event.country,
    organizerName: event.organizerDisplayName,
    groupName: event.groupName,
  };
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });
}

function CategoryDetailPage() {
  const { categoryId } = Route.useParams();
  const { country } = Route.useSearch();
  const navigate = useNavigate({ from: "/categories/$categoryId" });
  const { categoryMap: dbCategoryMap } = useEventCategoryMap();
  const categoryLabel = dbCategoryMap.get(categoryId);
  const category = categoryLabel ? { slug: categoryId, label: categoryLabel } : null;
  const isMobile = useIsMobile();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryOption[]>([]);

  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => {});
  }, []);

  // Fetch events for visible month
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("category", categoryId);
    params.set("year", String(currentYear));
    params.set("month", String(currentMonth));
    if (country) params.set("country", country);
    fetch(`/api/events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryId, country, currentYear, currentMonth]);

  const calendarEvents = useMemo(() => events.map(toCalendarEvent), [events]);

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  if (!category) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Category not found</h2>
        <p className="text-muted-foreground">
          The category "{categoryId}" does not exist.
        </p>
        <Button asChild variant="outline">
          <Link to="/categories">Back to categories</Link>
        </Button>
      </div>
    );
  }

  const [gradFrom, gradTo] = pickGradient(categoryId);
  const feedHandle = country
    ? `feed_${categoryId}_${country.toLowerCase()}`
    : `feed_${categoryId}`;

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <div
        className="rounded-xl p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        <Link
          to="/categories"
          className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="size-3.5">
            <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          All categories
        </Link>
        <h2 className="text-2xl font-bold mt-2">{category.label} Events</h2>
        <p className="text-white/80 text-sm mt-1">
          Follow this feed from your fediverse account to get notified about new {category.label.toLowerCase()} events.
        </p>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-white/60">@{feedHandle}</span>
            <RemoteFollowDialog actorHandle={feedHandle} className="bg-white text-gray-900 border-white hover:bg-white/90" />
          </div>
          {country && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-white/60">@feed_{categoryId} (global)</span>
              <RemoteFollowDialog actorHandle={`feed_${categoryId}`} className="bg-white/20 text-white border-white/40 hover:bg-white/30" />
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {countries.length > 0 && (
          <select
            className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
            value={country ?? ""}
            onChange={(e) => {
              navigate({
                search: e.target.value ? { country: e.target.value } : {},
              });
            }}
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

      {/* Content */}
      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !isMobile ? (
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <EventCalendar
              events={calendarEvents}
              showCountry={!country}
              onMonthChange={handleMonthChange}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Month navigation for list view */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon-xs" onClick={goToPrevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold">
              {formatMonthYear(currentYear, currentMonth)}
            </span>
            <Button variant="ghost" size="icon-xs" onClick={goToNextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <UpcomingEventList events={calendarEvents} />
        </div>
      )}
    </div>
  );
}
