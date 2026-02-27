import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, users } from "~/server/db/schema";
import { CATEGORIES } from "~/shared/categories";
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

export const Route = createFileRoute("/events/$eventId")({
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
};

type AttendeesData = {
  questions: Array<{ id: string; question: string; sortOrder: number }>;
  attendees: Array<{
    userId: string;
    handle: string;
    displayName: string;
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
  const { eventId } = Route.useParams();
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {event.title}
          </h2>
          <Badge variant="secondary">
            {categoryMap.get(event.categoryId) ?? event.categoryId}
          </Badge>
        </div>
        {event.groupHandle ? (
          <p className="text-sm text-muted-foreground mt-1">
            Hosted by{" "}
            <Link
              to="/groups/$identifier"
              params={{ identifier: `@${event.groupHandle}` }}
              className="text-primary hover:underline"
            >
              {event.groupName ?? `@${event.groupHandle}`}
            </Link>
          </p>
        ) : event.organizerHandle ? (
          <p className="text-sm text-muted-foreground mt-1">
            Hosted by{" "}
            {event.organizerActorUrl ? (
              <a
                href={event.organizerActorUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @{event.organizerHandle}
              </a>
            ) : (
              <span>@{event.organizerHandle}</span>
            )}
          </p>
        ) : null}
      </div>

      {/* Date & Time */}
      <Card>
        <CardContent className="pt-6">
          {end == null ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{startDateStr}</p>
              <p className="text-sm text-muted-foreground">{startTimeStr}</p>
            </div>
          ) : sameDay ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">{startDateStr}</p>
              <p className="text-sm text-muted-foreground">
                {startTimeStr} — {endTimeStr}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">{startDateStr}</p>
                <p className="text-sm text-muted-foreground">{startTimeStr}</p>
              </div>
              <span className="text-muted-foreground">—</span>
              <div className="space-y-1">
                <p className="text-sm font-medium">{endDateStr}</p>
                <p className="text-sm text-muted-foreground">{endTimeStr}</p>
              </div>
            </div>
          )}
          {event.location && (
            <>
              <Separator className="my-4" />
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Location
                </p>
                <p className="text-sm">{event.location}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      {event.description && (
        <Card>
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

      {/* RSVP Section */}
      {rsvpData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Attendance</CardTitle>
              <Badge variant="secondary">
                {attendeeCount} attending
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!rsvpData.isAuthenticated ? (
              <p className="text-sm text-muted-foreground">
                <Link to="/auth/signin" className="text-primary hover:underline">Sign in</Link> to RSVP.
              </p>
            ) : rsvpData.userRsvp ? (
              <div className="space-y-3">
                <p className="text-sm">
                  Your status:{" "}
                  <Badge variant={rsvpData.userRsvp.status === "accepted" ? "default" : "secondary"}>
                    {rsvpData.userRsvp.status === "accepted" ? "Attending" : "Not attending"}
                  </Badge>
                </p>
                <Button variant="outline" size="sm" onClick={() => setRsvpDialogOpen(true)}>
                  Change RSVP
                </Button>
              </div>
            ) : (
              <Button onClick={() => setRsvpDialogOpen(true)}>
                RSVP
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Organizers */}
      {organizers.length > 0 && (
        <Card>
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
        <Card>
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
                        <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                          {a.displayName.charAt(0).toUpperCase()}
                        </div>
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

      {/* RSVP Dialog */}
      <Dialog open={rsvpDialogOpen} onOpenChange={setRsvpDialogOpen}>
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
      </Dialog>
    </div>
  );
}
