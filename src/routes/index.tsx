import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { useAuth } from "~/routes/__root";
import { useGeolocation } from "~/hooks/useGeolocation";

export const Route = createFileRoute("/")({
  component: HomePage,
});


type EventItem = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  headerImageUrl: string | null;
  groupHandle: string | null;
  groupName: string | null;
  organizerHandle: string | null;
  organizerDisplayName: string | null;
  organizerActorUrl: string | null;
};

type BannerSlide = {
  type: "banner";
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  altText: string | null;
};

type EventSlide = {
  type: "event";
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  headerImageUrl: string | null;
  groupHandle: string | null;
  groupName: string | null;
  organizerHandle: string | null;
  organizerDisplayName: string | null;
  organizerActorUrl: string | null;
};

type CarouselSlide = BannerSlide | EventSlide;

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
  const { categoryMap } = useEventCategoryMap();
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { location: geoLocation } = useGeolocation();

  // Initial fetch (without geolocation)
  useEffect(() => {
    const fetchSlides = fetch("/api/home/carousel")
      .then((r) => r.json())
      .then((data) => setSlides(data.slides ?? []))
      .catch(() => {});

    const fetchEvents = fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => {});

    const fetchCheckins = fetch("/api/check-ins?limit=10")
      .then((r) => r.json())
      .then((data) => setCheckins(data.checkins ?? []))
      .catch(() => {});

    Promise.all([fetchSlides, fetchEvents, fetchCheckins]).finally(() => setLoading(false));
  }, []);

  // Re-fetch carousel with geolocation when available
  useEffect(() => {
    if (!geoLocation) return;
    const qs = `?lat=${geoLocation.lat}&lng=${geoLocation.lng}`;
    fetch(`/api/home/carousel${qs}`)
      .then((r) => r.json())
      .then((data) => setSlides(data.slides ?? []))
      .catch(() => {});
  }, [geoLocation]);

  const gridEvents = events.slice(0, 6);

  return (
    <div className="space-y-12">
      {/* Hero */}
      {loading ? (
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen">
          <div className="h-64 bg-muted animate-pulse" />
        </div>
      ) : slides.length > 0 ? (
        <HeroCarousel slides={slides} />
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
          <div className="flex flex-col">
            {gridEvents.map((event) => (
              <EventListRow key={event.id} event={event} />
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
                    {checkin.userAvatarUrl && <AvatarImage src={checkin.userAvatarUrl} alt={checkin.userDisplayName} />}
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
      {!loading && slides.length === 0 && events.length === 0 && checkins.length === 0 && (
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

/* ─── Hero Carousel (mixed banner + event slides) ─── */

const SLIDE_DURATION = 5000;

function HeroCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null; }
  }, []);

  const resumeTimers = useCallback(() => {
    clearTimers();
    const step = 50;
    progressRef.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (step / SLIDE_DURATION) * 100;
        if (next >= 100) {
          setCurrent((c) => (c + 1) % slides.length);
          return 0;
        }
        return next;
      });
    }, step);
  }, [slides.length, clearTimers]);

  useEffect(() => {
    if (!paused) resumeTimers();
    return clearTimers;
  }, [paused, resumeTimers, clearTimers]);

  // Reset progress on manual slide change
  useEffect(() => {
    setProgress(0);
    if (!paused) resumeTimers();
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (index: number) => {
    setCurrent(index);
  };

  const prev = () => goTo((current - 1 + slides.length) % slides.length);
  const next = () => goTo((current + 1) % slides.length);

  const slide = slides[current];

  return (
    <div
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-[200px] md:h-[340px] transition-all duration-500 overflow-hidden">
        {slide.type === "banner" ? (
          <BannerSlideContent slide={slide} />
        ) : (
          <EventSlideContent slide={slide} />
        )}
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
            aria-label="Previous slide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
            aria-label="Next slide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Per-slide indicator bars */}
          {(() => {
            const isLight = slide.type === "event" && !slide.headerImageUrl;
            const activeColor = isLight ? "#111" : "white";
            const inactiveColor = isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)";
            return (
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
                {slides.map((_, i) => {
                  if (i === current) {
                    return (
                      <div key={i} className="relative h-[3px] w-5 overflow-hidden rounded-full" style={{ background: inactiveColor }}>
                        <div
                          className="absolute inset-y-0 left-0 h-full rounded-full"
                          style={{
                            width: `${progress}%`,
                            background: activeColor,
                            transition: "width 50ms linear",
                          }}
                        />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="h-[3px] w-5 rounded-full"
                      style={{ background: inactiveColor }}
                    />
                  );
                })}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

/* ─── Banner Slide Content ─── */

function BannerSlideContent({ slide }: { slide: BannerSlide }) {
  const handleClick = () => {
    fetch("/api/banner-clicks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bannerId: slide.id }),
    }).catch(() => {});
  };

  return (
    <a
      href={slide.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="block w-full h-full relative overflow-hidden"
    >
      <img
        src={slide.imageUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl"
      />
      <img
        src={slide.imageUrl}
        alt={slide.altText ?? slide.title}
        className="relative w-full h-full object-contain"
      />
      <div className="absolute top-3 left-3 md:top-4 md:left-6">
        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-black/50 text-white">
          AD
        </span>
      </div>
    </a>
  );
}

/* ─── Event Slide Content ─── */

function EventSlideContent({ slide }: { slide: EventSlide }) {
  const { categoryMap } = useEventCategoryMap();
  const start = new Date(slide.startsAt);
  const dateStr = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayNum = start.getDate().toString();

  const hostLabel = slide.groupHandle
    ? (slide.groupName ?? `@${slide.groupHandle}`)
    : slide.organizerHandle
      ? `@${slide.organizerHandle}`
      : null;

  const hasImage = Boolean(slide.headerImageUrl);

  return (
    <div
      className="h-full px-6 py-6 md:py-0 flex items-center overflow-hidden bg-cover bg-center relative"
      style={{
        background: hasImage
          ? `linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3)), url(${slide.headerImageUrl}) center/cover no-repeat`
          : "#fafafa",
      }}
    >
      {/* Watermark date number for no-image slides */}
      {!hasImage && (
        <span
          className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl font-extrabold select-none pointer-events-none"
          style={{ color: "rgba(0,0,0,0.06)", lineHeight: 1 }}
          aria-hidden="true"
        >
          {dayNum}
        </span>
      )}

      <div className="mx-auto max-w-5xl w-full relative z-10" style={{ color: hasImage ? "white" : "#111" }}>
        <div className="flex items-center gap-3 mb-1 md:mb-2">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: hasImage ? "rgba(255,255,255,0.6)" : "#555" }}
          >
            {dateStr} · {timeStr}
          </p>
          {slide.categoryId && (
            <Badge
              variant="secondary"
              className={hasImage ? "bg-white/20 border-white/30 hover:bg-white/30" : "bg-black/8 border-black/10 hover:bg-black/12"}
              style={{ color: hasImage ? "white" : "#111" }}
            >
              {categoryMap.get(slide.categoryId) ?? slide.categoryId}
            </Badge>
          )}
        </div>

        <h1
          className="text-2xl font-extrabold tracking-tight md:text-3xl mb-1 md:mb-2 line-clamp-1 md:line-clamp-2"
          style={{ color: hasImage ? "white" : "#111" }}
        >
          {slide.title}
        </h1>

        {slide.location && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm mb-1" style={{ color: hasImage ? "rgba(255,255,255,0.8)" : "#555" }}>
            <span>@ {slide.location}</span>
          </div>
        )}

        {hostLabel && (
          <p className="text-xs md:text-sm mb-3 md:mb-6" style={{ color: hasImage ? "rgba(255,255,255,0.7)" : "#777" }}>
            Hosted by <strong style={{ color: hasImage ? "white" : "#333" }}>{hostLabel}</strong>
          </p>
        )}

        <div className="flex gap-3">
          <Button
            asChild
            className="h-8 md:h-9 text-xs md:text-sm px-3 md:px-4"
            style={hasImage ? { background: "white", color: "#111827" } : { background: "#111", color: "white" }}
          >
            <Link to="/events/$eventId" params={{ eventId: slide.id }}>
              View Event
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="h-8 md:h-9 text-xs md:text-sm px-3 md:px-4"
            style={
              hasImage
                ? { background: "transparent", color: "white", borderColor: "rgba(255,255,255,0.5)" }
                : { background: "transparent", color: "#333", borderColor: "rgba(0,0,0,0.2)" }
            }
          >
            <Link to="/events">Browse All Events</Link>
          </Button>
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

/* ─── Event List Row (horizontal editorial layout) ─── */

function EventListRow({ event }: { event: EventItem }) {
  const start = new Date(event.startsAt);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayNum = start.getDate().toString();
  const monthAbbr = start.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
  const weekdayAbbr = start.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();

  const hostLabel = event.groupHandle
    ? (event.groupName ?? `@${event.groupHandle}`)
    : event.organizerHandle
      ? `@${event.organizerHandle}`
      : null;

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="group flex items-start gap-4 py-4 border-b border-[#e0e0e0] hover:bg-[#fafafa] transition-colors"
    >
      {/* Thumbnail or date fallback */}
      {event.headerImageUrl ? (
        <img
          src={event.headerImageUrl}
          alt=""
          aria-hidden="true"
          className="rounded object-cover shrink-0"
          style={{ width: 140, height: 94, minWidth: 140, maxWidth: 140 }}
        />
      ) : (
        <div className="w-[140px] h-[94px] shrink-0 flex flex-col items-start justify-center pl-4 border-l-[3px] border-foreground">
          <span className="text-4xl font-extrabold leading-none text-foreground">{dayNum}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/60 mt-0.5">{monthAbbr}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/40">{weekdayAbbr}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 py-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#555] mb-1">
          {dateLabel} · {timeLabel}
        </p>
        <h3 className="text-lg font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1">
          {event.title}
        </h3>
        {hostLabel && (
          <p className="text-sm text-[#555] mb-1">
            Hosted by <strong className="text-foreground">{hostLabel}</strong>
          </p>
        )}
        {event.location && (
          <p className="text-sm text-[#777] truncate">{event.location}</p>
        )}
      </div>
    </Link>
  );
}
