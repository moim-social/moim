import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { LeafletMap } from "~/components/LeafletMap";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, users } from "~/server/db/schema";
import { CATEGORIES } from "~/shared/categories";
import { pickGradient } from "~/shared/gradients";
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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { usePostHog } from "posthog-js/react";

const getEventMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ eventId: z.string() })))
  .handler(async ({ data }) => {
    const [row] = await db
      .select({
        title: events.title,
        description: events.description,
        startsAt: events.startsAt,
        location: events.location,
        organizerHandle: users.fediverseHandle,
        groupHandle: actors.handle,
        groupName: actors.name,
        groupDomain: actors.domain,
      })
      .from(events)
      .innerJoin(users, eq(events.organizerId, users.id))
      .leftJoin(actors, eq(events.groupActorId, actors.id))
      .where(eq(events.id, data.eventId))
      .limit(1);
    return row ?? null;
  });

export const Route = createFileRoute("/events/$eventId/")({
  component: EventDetailPage,
  loader: async ({ params }) => {
    return getEventMeta({ data: { eventId: params.eventId } });
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const groupFullHandle = loaderData.groupHandle
      ? `@${loaderData.groupHandle}@${loaderData.groupDomain}`
      : null;
    const host = groupFullHandle
      ? (loaderData.groupName ? `${loaderData.groupName} (${groupFullHandle})` : groupFullHandle)
      : loaderData.organizerHandle
        ? `@${loaderData.organizerHandle}`
        : null;
    const desc = loaderData.description
      ?? `${new Date(loaderData.startsAt).toLocaleDateString()}${loaderData.location ? ` · ${loaderData.location}` : ""}`;
    const title = host
      ? `${loaderData.title} — ${host}`
      : loaderData.title;
    return {
      meta: [
        { title: `${title} — Moim` },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        ...(loaderData.groupHandle
          ? [{ property: "fediverse:creator", content: `@${loaderData.groupHandle}@${loaderData.groupDomain}` }]
          : loaderData.organizerHandle
            ? [{ property: "fediverse:creator", content: `@${loaderData.organizerHandle}` }]
            : []),
      ],
    };
  },
});

const categoryMap = new Map<string, string>(
  CATEGORIES.map((c) => [c.id, c.label]),
);

type EventData = {
  event: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
    placeId: string | null;
    placeName: string | null;
    placeAddress: string | null;
    placeLatitude: string | null;
    placeLongitude: string | null;
    externalUrl: string | null;
    groupHandle: string | null;
    groupName: string | null;
    organizerHandle: string | null;
    organizerDisplayName: string | null;
    organizerActorUrl: string | null;
    createdAt: string;
  };
  organizers: {
    handle: string;
    name: string | null;
    domain: string | null;
    isLocal: boolean;
  }[];
  rsvpCounts: { accepted: number; declined: number };
  questionCount: number;
  canEdit: boolean;
};

type AttendeesData = {
  questions: Array<{ id: string; question: string; sortOrder: number }>;
  attendees: Array<{
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
    createdAt: string;
    answers: Array<{ questionId: string; answer: string }>;
  }>;
};

type RsvpData = {
  questions: Array<{
    id: string;
    question: string;
    sortOrder: number;
    required: boolean;
  }>;
  rsvpCounts: { accepted: number; declined: number };
  userRsvp: {
    status: string;
    answers: Array<{ questionId: string; answer: string }>;
  } | null;
  isAuthenticated: boolean;
};

function EventDetailPage() {
  const posthog = usePostHog();
  const { eventId } = Route.useParams();
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Map dialog
  const [mapOpen, setMapOpen] = useState(false);

  // Attendees (organizer-only)
  const [attendeesData, setAttendeesData] = useState<AttendeesData | null>(null);

  // RSVP state
  const [rsvpData, setRsvpData] = useState<RsvpData | null>(null);
  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false);
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/events/detail?id=${eventId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Event not found");
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [eventId]);

  useEffect(() => {
    fetch(`/events/rsvp-status?eventId=${eventId}`)
      .then((r) => r.json())
      .then((d) => {
        setRsvpData(d);
        if (d.userRsvp?.answers) {
          const prefilled: Record<string, string> = {};
          for (const a of d.userRsvp.answers) {
            prefilled[a.questionId] = a.answer;
          }
          setAnswers(prefilled);
        }
      })
      .catch(() => {});
  }, [eventId]);

  // Fetch attendees (will 403 for non-organizers, that's fine)
  useEffect(() => {
    fetch(`/events/attendees?eventId=${eventId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (d) setAttendeesData(d);
      })
      .catch(() => {});
  }, [eventId]);

  async function submitRsvp(status: "accepted" | "declined") {
    setRsvpSubmitting(true);
    setRsvpError("");
    try {
      const res = await fetch("/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          status,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            questionId,
            answer,
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setRsvpError(result.error ?? "Failed to submit RSVP");
        setRsvpSubmitting(false);
        return;
      }
      setRsvpDialogOpen(false);
      posthog?.capture("rsvp_submitted", { eventId, status });
      // Refresh RSVP data
      const refreshRes = await fetch(`/events/rsvp-status?eventId=${eventId}`);
      const refreshData = await refreshRes.json();
      setRsvpData(refreshData);
      if (refreshData.userRsvp?.answers) {
        const prefilled: Record<string, string> = {};
        for (const a of refreshData.userRsvp.answers) {
          prefilled[a.questionId] = a.answer;
        }
        setAnswers(prefilled);
      }
    } catch {
      setRsvpError("Network error");
    }
    setRsvpSubmitting(false);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  if (error || !data) {
    return <p className="text-destructive">{error || "Event not found"}</p>;
  }

  const { event, organizers } = data;
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  const sameDay =
    end != null &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  const startDateStr = start.toLocaleDateString(undefined, dateOpts);
  const startTimeStr = start.toLocaleTimeString(undefined, timeOpts);
  const endDateStr = end ? end.toLocaleDateString(undefined, dateOpts) : null;
  const endTimeStr = end ? end.toLocaleTimeString(undefined, timeOpts) : null;

  const attendeeCount = rsvpData?.rsvpCounts?.accepted ?? data.rsvpCounts?.accepted ?? 0;

  const [gradFrom, gradTo] = pickGradient(event.categoryId || event.id);

  const rsvpContent = event.externalUrl ? (
    <>
      <Separator />
      <Button asChild className="w-full">
        <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
          Register externally
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.5-2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22H12.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </a>
      </Button>
    </>
  ) : rsvpData ? (
    <>
      <Separator />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {attendeeCount} attending
        </span>
        {rsvpData.userRsvp && (
          <Badge variant={rsvpData.userRsvp.status === "accepted" ? "default" : "secondary"}>
            {rsvpData.userRsvp.status === "accepted" ? "Attending" : "Not attending"}
          </Badge>
        )}
      </div>
      {!rsvpData.isAuthenticated ? (
        <Button asChild className="w-full">
          <Link to="/auth/signin">Sign in to RSVP</Link>
        </Button>
      ) : rsvpData.userRsvp ? (
        <Button variant="outline" className="w-full" onClick={() => setRsvpDialogOpen(true)}>
          Change RSVP
        </Button>
      ) : (
        <Button className="w-full" onClick={() => setRsvpDialogOpen(true)}>
          RSVP
        </Button>
      )}
    </>
  ) : null;

  const dateLocationContent = (
    <>
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="min-w-0">
            {end == null ? (
              <>
                <p className="text-sm font-medium">{startDateStr}</p>
                <p className="text-sm text-muted-foreground">{startTimeStr}</p>
              </>
            ) : sameDay ? (
              <>
                <p className="text-sm font-medium">{startDateStr}</p>
                <p className="text-sm text-muted-foreground">
                  {startTimeStr} — {endTimeStr}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">{startDateStr} {startTimeStr}</p>
                <p className="text-sm text-muted-foreground">
                  to {endDateStr} {endTimeStr}
                </p>
              </>
            )}
          </div>
        </div>

        {(event.location || event.placeName) && (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                  <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                {event.placeId ? (
                  <Link
                    to="/places/$placeId"
                    params={{ placeId: event.placeId }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {event.placeName ?? event.location}
                  </Link>
                ) : (
                  <p className="text-sm">{event.location}</p>
                )}
                {event.placeAddress && event.placeAddress !== event.placeName && (
                  <p className="text-xs text-muted-foreground">{event.placeAddress}</p>
                )}
              </div>
            </div>

            {event.placeLatitude && event.placeLongitude && (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="w-full rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-shadow"
              >
                <LeafletMap
                  center={[parseFloat(event.placeLatitude), parseFloat(event.placeLongitude)]}
                  zoom={15}
                  markers={[{
                    lat: parseFloat(event.placeLatitude),
                    lng: parseFloat(event.placeLongitude),
                    label: event.placeName ?? event.location ?? "Location",
                    id: event.placeId ?? "place",
                    color: "red",
                  }]}
                  height="150px"
                  className="pointer-events-none"
                />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="pb-24 md:pb-0">
      {/* Hero */}
      <div
        className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen px-6 py-12 md:py-16 pb-20 md:pb-24"
        style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }}
      >
        <div className="mx-auto max-w-5xl">
          {event.categoryId && (
            <Badge variant="secondary" className="mb-3 bg-white/20 text-white border-white/30 hover:bg-white/30">
              {categoryMap.get(event.categoryId) ?? event.categoryId}
            </Badge>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            {event.title}
          </h1>
          {event.groupHandle ? (
            <p className="mt-3 text-white/80">
              Hosted by{" "}
              <Link
                to="/groups/$identifier"
                params={{ identifier: `@${event.groupHandle}` }}
                className="text-white underline underline-offset-2 hover:text-white/90"
              >
                {event.groupName ?? `@${event.groupHandle}`}
              </Link>
            </p>
          ) : event.organizerHandle ? (
            <p className="mt-3 text-white/80">
              Hosted by{" "}
              {event.organizerActorUrl ? (
                <a
                  href={event.organizerActorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline underline-offset-2 hover:text-white/90"
                >
                  @{event.organizerHandle}
                </a>
              ) : (
                <span className="text-white">@{event.organizerHandle}</span>
              )}
            </p>
          ) : null}
          {data.canEdit && (
            <div className="mt-4">
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                asChild
              >
                <Link to="/events/$eventId/edit" params={{ eventId }}>
                  Edit Event
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout — pulled up to overlap hero */}
      <div className="relative -mt-14 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* Main content */}
        <div className="space-y-6 min-w-0">
          {/* Date & Location — visible on mobile only (desktop shows in sidebar) */}
          <Card className="rounded-lg md:hidden">
            <CardContent className="pt-6">
              {dateLocationContent}
            </CardContent>
          </Card>

          {/* Description */}
          {event.description && (
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Organizers */}
          {organizers.length > 0 && (
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Organizers</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {organizers.map((o) => {
                    const displayHandle = o.handle.includes("@")
                      ? `@${o.handle}`
                      : `@${o.handle}@${o.domain}`;
                    return (
                      <li key={o.handle} className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                          {(o.name ?? o.handle).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium">
                            {o.name ?? o.handle}
                          </span>
                          <span className="text-sm text-muted-foreground ml-1.5">
                            {o.isLocal ? `@${o.handle}` : displayHandle}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Attendees (organizer-only) */}
          {attendeesData && (
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">
                  Attendees ({attendeesData.attendees.filter((a) => a.status === "accepted").length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {attendeesData.attendees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No RSVPs yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {attendeesData.attendees.map((a) => (
                      <li key={a.userId} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-8 shrink-0">
                              {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.displayName} />}
                              <AvatarFallback className="text-xs">
                                {a.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="text-sm font-medium">{a.displayName}</span>
                              <span className="text-sm text-muted-foreground ml-1.5">@{a.handle}</span>
                            </div>
                          </div>
                          <Badge variant={a.status === "accepted" ? "default" : "secondary"}>
                            {a.status === "accepted" ? "Attending" : "Not attending"}
                          </Badge>
                        </div>
                        {a.answers.length > 0 && attendeesData.questions.length > 0 && (
                          <div className="pl-10 space-y-1">
                            {attendeesData.questions.map((q) => {
                              const ans = a.answers.find((x) => x.questionId === q.id);
                              if (!ans) return null;
                              return (
                                <div key={q.id}>
                                  <p className="text-xs text-muted-foreground">{q.question}</p>
                                  <p className="text-sm">{ans.answer}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — desktop only */}
        <div className="hidden md:block">
          <div className="sticky top-20">
            <Card className="rounded-lg">
              <CardContent className="pt-6 space-y-4">
                {dateLocationContent}
                {rsvpContent}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      {event.externalUrl ? (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 px-6 py-3">
            <Button size="sm" asChild>
              <a href={event.externalUrl} target="_blank" rel="noopener noreferrer">
                Register externally
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.5-2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22H12.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
                </svg>
              </a>
            </Button>
          </div>
        </div>
      ) : rsvpData ? (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{attendeeCount} attending</span>
              {rsvpData.userRsvp && (
                <Badge variant={rsvpData.userRsvp.status === "accepted" ? "default" : "secondary"} className="text-xs">
                  {rsvpData.userRsvp.status === "accepted" ? "Going" : "Not going"}
                </Badge>
              )}
            </div>
            {!rsvpData.isAuthenticated ? (
              <Button size="sm" asChild>
                <Link to="/auth/signin">Sign in to RSVP</Link>
              </Button>
            ) : rsvpData.userRsvp ? (
              <Button size="sm" variant="outline" onClick={() => setRsvpDialogOpen(true)}>
                Change RSVP
              </Button>
            ) : (
              <Button size="sm" onClick={() => setRsvpDialogOpen(true)}>
                RSVP
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Map Dialog */}
      {event.placeLatitude && event.placeLongitude && (
        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{event.placeName ?? event.location}</DialogTitle>
              {event.placeAddress && (
                <DialogDescription>{event.placeAddress}</DialogDescription>
              )}
            </DialogHeader>
            <LeafletMap
              center={[parseFloat(event.placeLatitude), parseFloat(event.placeLongitude)]}
              zoom={15}
              markers={[{
                lat: parseFloat(event.placeLatitude),
                lng: parseFloat(event.placeLongitude),
                label: event.placeName ?? event.location ?? "Location",
                id: event.placeId ?? "place",
                color: "red",
              }]}
              height="400px"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* RSVP Dialog — only for events without external URL */}
      {!event.externalUrl && <Dialog open={rsvpDialogOpen} onOpenChange={setRsvpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>RSVP to {event.title}</DialogTitle>
            <DialogDescription>
              {rsvpData?.questions?.length
                ? "Please answer the questions below."
                : "Confirm your attendance."}
            </DialogDescription>
          </DialogHeader>

          {rsvpError && (
            <p className="text-sm text-destructive">{rsvpError}</p>
          )}

          {rsvpData?.questions && rsvpData.questions.length > 0 && (
            <div className="space-y-4">
              {rsvpData.questions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <Label>
                    {q.question}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    placeholder="Your answer..."
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            {rsvpData?.userRsvp?.status === "accepted" ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => submitRsvp("declined")}
                  disabled={rsvpSubmitting}
                >
                  Not attending
                </Button>
                <Button onClick={() => submitRsvp("accepted")} disabled={rsvpSubmitting}>
                  {rsvpSubmitting ? "Submitting..." : "Update"}
                </Button>
              </>
            ) : (
              <Button onClick={() => submitRsvp("accepted")} disabled={rsvpSubmitting}>
                {rsvpSubmitting ? "Submitting..." : "Attend"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
