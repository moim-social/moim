import { createFileRoute, Link } from "@tanstack/react-router";
import { useBottomBarSlot } from "~/routes/__root";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useEffect, useState } from "react";
import { z } from "zod";
import { LeafletMap } from "~/components/LeafletMap";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { events, actors, users, userFediverseAccounts } from "~/server/db/schema";
import { useEventCategoryMap } from "~/hooks/useEventCategories";
import { renderMarkdown } from "~/lib/markdown";
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
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { ExternalLink, Users, Bookmark, BookmarkCheck } from "lucide-react";
import { RemoteDiscussionDialog } from "~/components/RemoteDiscussionDialog";

const getEventMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ eventId: z.string() })))
  .handler(async ({ data }) => {
    const [row] = await db
      .select({
        title: events.title,
        description: events.description,
        startsAt: events.startsAt,
        location: events.location,
        headerImageUrl: events.headerImageUrl,
        organizerHandle: userFediverseAccounts.fediverseHandle,
        groupHandle: actors.handle,
        groupName: actors.name,
        groupDomain: actors.domain,
      })
      .from(events)
      .innerJoin(users, eq(events.organizerId, users.id))
      .leftJoin(userFediverseAccounts, and(
        eq(userFediverseAccounts.userId, users.id),
        eq(userFediverseAccounts.isPrimary, true),
      ))
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
        ...(loaderData.headerImageUrl
          ? [{ property: "og:image", content: loaderData.headerImageUrl }]
          : []),
        ...(loaderData.groupHandle
          ? [{ property: "fediverse:creator", content: `@${loaderData.groupHandle}@${loaderData.groupDomain}` }]
          : loaderData.organizerHandle
            ? [{ property: "fediverse:creator", content: `@${loaderData.organizerHandle}` }]
            : []),
      ],
    };
  },
});

type EventData = {
  event: {
    id: string;
    title: string;
    description: string | null;
    categoryId: string;
    startsAt: string;
    endsAt: string | null;
    timezone: string | null;
    location: string | null;
    placeId: string | null;
    venueDetail: string | null;
    placeName: string | null;
    placeAddress: string | null;
    placeLatitude: string | null;
    placeLongitude: string | null;
    externalUrl: string | null;
    headerImageUrl: string | null;
    groupHandle: string | null;
    groupName: string | null;
    organizerHandle: string | null;
    organizerDisplayName: string | null;
    organizerActorUrl: string | null;
    createdAt: string;
  };
  organizers: {
    handle: string | null;
    name: string | null;
    profileUrl: string | null;
    imageUrl: string | null;
    domain: string | null;
    isLocal: boolean | null;
    homepageUrl: string | null;
    isExternal: boolean;
  }[];
  rsvpCounts: { accepted: number; declined: number; waitlisted: number };
  attendeePreview: { displayName: string; avatarUrl: string | null }[];
  questionCount: number;
  canEdit: boolean;
};

type TierInfo = {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  opensAt: string | null;
  closesAt: string | null;
  capacity: number | null;
  acceptedCount: number;
  waitlistedCount: number;
  sortOrder: number;
};

type AttendeesData = {
  questions: Array<{ id: string; question: string; sortOrder: number }>;
  tiers: TierInfo[];
  attendees: Array<{
    userId: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    status: string;
    tierId: string | null;
    tierName: string | null;
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
  tiers: TierInfo[];
  rsvpCounts: { accepted: number; declined: number; waitlisted: number };
  tierCounts: Array<{ tierId: string; status: string; count: number }>;
  userRsvp: {
    status: string;
    tierId: string | null;
    answers: Array<{ questionId: string; answer: string }>;
    waitlistPosition: number | null;
  } | null;
  isAuthenticated: boolean;
  allowAnonymousRsvp: boolean;
  anonymousContactFields: { email?: string; phone?: string } | null;
  anonymousCount: number;
};

function EventDetailPage() {
  const { categoryMap } = useEventCategoryMap();

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

  // Favourite state
  const [isFavourite, setIsFavourite] = useState(false);
  const [favouriteLoading, setFavouriteLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
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
    fetch(`/api/events/${eventId}/rsvp`)
      .then((r) => r.json())
      .then((d) => setRsvpData(d))
      .catch(() => {});
  }, [eventId]);

  useEffect(() => {
    fetch(`/api/events/${eventId}/favourite`)
      .then((r) => r.json())
      .then((d) => setIsFavourite(d.isFavourite))
      .catch(() => {});
  }, [eventId]);

  // Public discussions
  type PublicInquiry = {
    id: string;
    content: string;
    published: string;
    createdAt: string;
    lastRepliedAt: string | null;
    apUrl: string | null;
    actorHandle: string;
    actorName: string | null;
    actorAvatarUrl: string | null;
    actorDomain: string | null;
    replyCount: number;
  };
  type ThreadMessage = {
    id: string;
    content: string;
    createdAt: string;
    inReplyToPostId: string | null;
    apUrl: string | null;
    actorHandle: string;
    actorName: string | null;
    actorAvatarUrl: string | null;
    actorDomain: string | null;
  };
  const [publicInquiries, setPublicInquiries] = useState<PublicInquiry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({});
  const [threadLoading, setThreadLoading] = useState<string | null>(null);
  const isGroupEvent = !!data?.event?.groupHandle;
  const eventNoteApUrl = (data as { eventNoteApUrl?: string | null } | null)?.eventNoteApUrl ?? null;

  useEffect(() => {
    if (!isGroupEvent) return;
    fetch(`/api/events/${eventId}/discussions/public`)
      .then((r) => r.json())
      .then((d) => setPublicInquiries(d.inquiries ?? []))
      .catch(() => {});
  }, [eventId, isGroupEvent]);

  const toggleThread = (inquiryId: string) => {
    if (expandedId === inquiryId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(inquiryId);
    if (threadCache[inquiryId]) return;
    setThreadLoading(inquiryId);
    fetch(`/api/events/${eventId}/discussions/public/${inquiryId}`)
      .then((r) => r.json())
      .then((d) => {
        setThreadCache((prev) => ({ ...prev, [inquiryId]: d.messages ?? [] }));
      })
      .catch(() => {})
      .finally(() => setThreadLoading(null));
  };

  // Fetch attendees (will 403 for non-organizers, that's fine)
  useEffect(() => {
    fetch(`/api/events/${eventId}/attendees`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (d) setAttendeesData(d);
      })
      .catch(() => {});
  }, [eventId]);

  const attendeeCount = rsvpData?.rsvpCounts?.accepted ?? data?.rsvpCounts?.accepted ?? 0;
  const anonymousCount = rsvpData?.anonymousCount ?? 0;
  const attendeeLabel = anonymousCount > 0
    ? `${attendeeCount} attending (${anonymousCount} anonymous)`
    : `${attendeeCount} attending`;

  const bottomBarContent = useMemo(() => {
    if (!data) return null;
    if (data.event.externalUrl) {
      return (
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 px-6 py-3">
          <Button size="sm" asChild>
            <a href={data.event.externalUrl} target="_blank" rel="noopener noreferrer">
              Register externally
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Zm7.5-2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V5.56l-5.22 5.22a.75.75 0 1 1-1.06-1.06l5.22-5.22H12.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
              </svg>
            </a>
          </Button>
        </div>
      );
    }
    if (rsvpData) {
      return (
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{attendeeLabel}</span>
              {rsvpData.userRsvp && (
                <Badge
                  variant={rsvpData.userRsvp.status === "accepted" ? "default" : rsvpData.userRsvp.status === "waitlisted" ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {rsvpData.userRsvp.status === "accepted"
                    ? "Going"
                    : rsvpData.userRsvp.status === "waitlisted"
                      ? `Waitlisted (#${rsvpData.userRsvp.waitlistPosition ?? "?"})`
                      : "Not going"}
                </Badge>
              )}
            </div>
            {rsvpData.userRsvp?.tierId && rsvpData.tiers.length > 1 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {rsvpData.tiers.find((t) => t.id === rsvpData.userRsvp?.tierId)?.name}
              </p>
            )}
          </div>
          {!rsvpData.isAuthenticated ? (
            rsvpData.userRsvp ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/events/$eventId/register" params={{ eventId }}>View Registration</Link>
              </Button>
            ) : rsvpData.allowAnonymousRsvp ? (
              <Button size="sm" asChild>
                <Link to="/events/$eventId/register" params={{ eventId }}>Register</Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link to="/auth/signin" search={{ reason: "rsvp" }}>Sign in to RSVP</Link>
              </Button>
            )
          ) : rsvpData.userRsvp ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/events/$eventId/register" params={{ eventId }}>Change RSVP</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/events/$eventId/register" params={{ eventId }}>Register</Link>
            </Button>
          )}
        </div>
      );
    }
    return null;
  }, [data, rsvpData, attendeeCount, eventId]);

  useBottomBarSlot(bottomBarContent);

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
    start.toLocaleDateString(undefined, { timeZone: event.timezone ?? undefined }) ===
    end.toLocaleDateString(undefined, { timeZone: event.timezone ?? undefined });

  const eventTz = event.timezone ?? undefined;
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: eventTz,
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: eventTz,
    timeZoneName: "short",
  };

  const startDateStr = start.toLocaleDateString(undefined, dateOpts);
  const startTimeStr = start.toLocaleTimeString(undefined, timeOpts);
  const endDateStr = end ? end.toLocaleDateString(undefined, dateOpts) : null;
  const endTimeStr = end ? end.toLocaleTimeString(undefined, timeOpts) : null;

  // Local timezone tooltip (only show if different from event timezone)
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const showLocalTzHint = eventTz != null && browserTz !== eventTz;
  const localTimeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  const localDateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  const localStartDate = start.toLocaleDateString(undefined, localDateOpts);
  const localStartTime = start.toLocaleTimeString(undefined, localTimeOpts);
  const localEndTime = end ? end.toLocaleTimeString(undefined, localTimeOpts) : null;
  const localEndDate = end ? end.toLocaleDateString(undefined, localDateOpts) : null;
  const localSameDay = end != null && localStartDate === localEndDate;
  const localTooltip = !end
    ? `${localStartDate} ${localStartTime}`
    : localSameDay
      ? `${localStartDate} ${localStartTime} — ${localEndTime}`
      : `${localStartDate} ${localStartTime} — ${localEndDate} ${localEndTime}`;

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
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {attendeeLabel}
          </span>
          {rsvpData.userRsvp && (
            <Badge
              variant={rsvpData.userRsvp.status === "accepted" ? "default" : rsvpData.userRsvp.status === "waitlisted" ? "outline" : "secondary"}
            >
              {rsvpData.userRsvp.status === "accepted"
                ? "Attending"
                : rsvpData.userRsvp.status === "waitlisted"
                  ? `Waitlisted (#${rsvpData.userRsvp.waitlistPosition ?? "?"})`
                  : "Not attending"}
            </Badge>
          )}
        </div>
        {rsvpData.userRsvp?.tierId && rsvpData.tiers.length > 1 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {rsvpData.tiers.find((t) => t.id === rsvpData.userRsvp?.tierId)?.name}
          </p>
        )}
      </div>
      {!rsvpData.isAuthenticated ? (
        rsvpData.userRsvp ? (
          <Button variant="outline" className="w-full" asChild>
            <Link to="/events/$eventId/register" params={{ eventId }}>View Registration</Link>
          </Button>
        ) : rsvpData.allowAnonymousRsvp ? (
          <Button className="w-full" asChild>
            <Link to="/events/$eventId/register" params={{ eventId }}>Register</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to="/auth/signin" search={{ reason: "rsvp" }}>Sign in to RSVP</Link>
          </Button>
        )
      ) : rsvpData.userRsvp ? (
        <Button variant="outline" className="w-full" asChild>
          <Link to="/events/$eventId/register" params={{ eventId }}>Change RSVP</Link>
        </Button>
      ) : (
        <Button className="w-full" asChild>
          <Link to="/events/$eventId/register" params={{ eventId }}>Register</Link>
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
          <div className="flex-1 min-w-0">
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
          {showLocalTzHint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="shrink-0 mt-0.5 text-muted-foreground cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>{localTooltip}</TooltipContent>
            </Tooltip>
          )}
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
                {event.venueDetail && (
                  <p className="text-xs text-muted-foreground">{event.venueDetail}</p>
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

        {/* Attendee preview */}
        {data?.attendeePreview && data.attendeePreview.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
              <Users className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center">
                {data.attendeePreview.map((a, i) => (
                  <Avatar
                    key={i}
                    className={`size-7 border-2 border-background ${i > 0 ? "-ml-2" : ""}`}
                  >
                    {a.avatarUrl ? (
                      <AvatarImage src={a.avatarUrl} alt={a.displayName} />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {a.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {attendeeCount > 5 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    +{attendeeCount - 5}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {attendeeCount <= 3
                  ? data.attendeePreview.map((a) => a.displayName).join(", ")
                  : `${data.attendeePreview.slice(0, 3).map((a) => a.displayName).join(", ")} and ${attendeeCount - 3} others`}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="pb-24 md:pb-0">
      {/* Hero */}
      <div
        className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen px-6 py-12 md:py-16 pb-20 md:pb-24 bg-cover bg-center"
        style={{
          background: event.headerImageUrl
            ? `linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3)), url(${event.headerImageUrl}) center/cover no-repeat`
            : "#fafafa",
        }}
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
            <div className="mt-4 flex gap-2">
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
              <Button
                variant="secondary"
                size="sm"
                className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                asChild
              >
                <Link to="/events/$eventId/dashboard" params={{ eventId }}>
                  Dashboard
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
            <CardContent className="pt-6 space-y-4">
              {dateLocationContent}
              <Separator />
              <Button
                variant="ghost"
                className="w-full"
                disabled={favouriteLoading}
                onClick={async () => {
                  setFavouriteLoading(true);
                  try {
                    const res = await fetch(`/api/events/${eventId}/favourite`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ eventId }),
                    });
                    if (res.ok) {
                      const d = await res.json();
                      setIsFavourite(d.isFavourite);
                    }
                  } finally {
                    setFavouriteLoading(false);
                  }
                }}
              >
                {isFavourite ? (
                  <BookmarkCheck className="size-4 mr-1.5 text-primary" />
                ) : (
                  <Bookmark className="size-4 mr-1.5" />
                )}
                {isFavourite ? "Bookmarked" : "Bookmark"}
              </Button>
            </CardContent>
          </Card>

          {/* Description */}
          {event.description && (
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(event.description) }}
                />
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
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {organizers.map((o, i) => {
                    const initials = (o.name ?? o.handle ?? "?").charAt(0).toUpperCase();
                    const fallbackBg = o.isExternal ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary";
                    const avatar = o.imageUrl ? (
                      <img
                        src={o.imageUrl}
                        alt=""
                        className="size-16 rounded-full object-cover"
                        onError={(e) => {
                          const el = e.currentTarget;
                          const parent = el.parentElement!;
                          const fallback = document.createElement("div");
                          fallback.className = `size-16 rounded-full ${fallbackBg} flex items-center justify-center text-lg font-semibold`;
                          fallback.textContent = initials;
                          parent.replaceChild(fallback, el);
                        }}
                      />
                    ) : (
                      <div className={`size-16 rounded-full ${fallbackBg} flex items-center justify-center text-lg font-semibold`}>
                        {initials}
                      </div>
                    );

                    const isExternal = o.isExternal;
                    const link = isExternal ? o.homepageUrl : (o.homepageUrl || o.profileUrl);
                    const displayName = o.name ?? o.handle;
                    const displayHandle = !isExternal && o.handle
                      ? (o.handle.includes("@") ? `@${o.handle}` : `@${o.handle}@${o.domain}`)
                      : null;
                    const subtitle = isExternal && o.homepageUrl
                      ? new URL(o.homepageUrl).hostname
                      : displayHandle;

                    const content = (
                      <>
                        {avatar}
                        <div className="mt-2 w-full min-w-0">
                          <span className="text-sm font-semibold line-clamp-2">{displayName}</span>
                          {subtitle && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
                          )}
                        </div>
                      </>
                    );

                    const tooltip = displayHandle ?? displayName ?? undefined;

                    return link ? (
                      <a
                        key={isExternal ? `ext-${i}` : o.handle}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={tooltip}
                        className="flex flex-col items-center text-center w-36 rounded-lg border p-4 hover:bg-accent transition-colors shrink-0"
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        key={isExternal ? `ext-${i}` : o.handle}
                        title={tooltip}
                        className="flex flex-col items-center text-center w-36 rounded-lg border p-4 shrink-0"
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Public Discussions */}
          {isGroupEvent && (
            <Card className="rounded-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Discussion</CardTitle>
                  {eventNoteApUrl && publicInquiries.length > 0 && (
                    <RemoteDiscussionDialog apUrl={eventNoteApUrl} />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {publicInquiries.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      No discussions yet.
                    </p>
                    {eventNoteApUrl && (
                      <RemoteDiscussionDialog apUrl={eventNoteApUrl} />
                    )}
                  </div>
                ) : (
                  <ul className="divide-y">
                    {publicInquiries.map((inq) => {
                      const isExpanded = expandedId === inq.id;
                      const replies = threadCache[inq.id];
                      const isLoading = threadLoading === inq.id;

                      return (
                        <li key={inq.id} className="group/inq py-3 first:pt-0 last:pb-0">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => inq.replyCount > 0 && toggleThread(inq.id)}
                          >
                            <div className="flex items-start gap-3">
                              {inq.actorAvatarUrl ? (
                                <img
                                  src={inq.actorAvatarUrl}
                                  alt=""
                                  className="size-8 rounded-full shrink-0"
                                />
                              ) : (
                                <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                                  {(inq.actorName ?? inq.actorHandle)?.[0]?.toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-sm font-medium truncate">
                                    {inq.actorName ?? inq.actorHandle}
                                  </span>
                                  <span className="text-xs text-muted-foreground truncate">
                                    @{inq.actorHandle}{inq.actorDomain && !inq.actorHandle.includes("@") ? `@${inq.actorDomain}` : ""}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                    {formatRelativeTime(inq.lastRepliedAt ?? inq.createdAt)}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2 mt-1">
                                  <div
                                    className="text-sm text-muted-foreground line-clamp-3 prose prose-sm max-w-none [&_p]:my-0.5 flex-1 min-w-0"
                                    dangerouslySetInnerHTML={{ __html: stripMentionHtml(inq.content) }}
                                  />
                                  {inq.apUrl && (
                                    <span className="shrink-0 opacity-0 group-hover/inq:opacity-100 transition-opacity">
                                      <RemoteDiscussionDialog
                                        apUrl={inq.apUrl}
                                        triggerLabel={<><ExternalLink className="size-3" /> Reply</>}
                                        variant="ghost"
                                      />
                                    </span>
                                  )}
                                </div>
                                {inq.replyCount > 0 && (
                                  <p className="text-xs text-primary mt-1.5">
                                    {isExpanded ? "Hide" : "Show"} {inq.replyCount} {inq.replyCount === 1 ? "reply" : "replies"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>

                          {/* Expanded thread */}
                          {isExpanded && (
                            <div className="mt-3 ml-11 divide-y">
                              {isLoading ? (
                                <p className="text-xs text-muted-foreground py-2">Loading...</p>
                              ) : replies ? (
                                buildThreadTree(replies, inq.id).map(({ msg: m, depth }) => (
                                  <div
                                    key={m.id}
                                    className="group/reply flex items-start gap-2 py-2"
                                    style={{ paddingLeft: `${Math.min(depth, 4) * 16}px` }}
                                  >
                                    {m.actorAvatarUrl ? (
                                      <img
                                        src={m.actorAvatarUrl}
                                        alt=""
                                        className="size-5 rounded-full shrink-0 mt-0.5"
                                      />
                                    ) : (
                                      <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                                        {(m.actorName ?? m.actorHandle)?.[0]?.toUpperCase()}
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-baseline gap-1.5 flex-wrap">
                                        <span className="text-xs font-semibold">
                                          {m.actorName ?? m.actorHandle}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          @{m.actorHandle}{m.actorDomain && !m.actorHandle.includes("@") ? `@${m.actorDomain}` : ""}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {formatRelativeTime(m.createdAt)}
                                        </span>
                                        {m.apUrl && (
                                          <span className="opacity-0 group-hover/reply:opacity-100 transition-opacity">
                                            <RemoteDiscussionDialog
                                              apUrl={m.apUrl}
                                              triggerLabel={<><ExternalLink className="size-3" /> Reply</>}
                                              variant="ghost"
                                            />
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className="text-xs text-muted-foreground mt-0.5 prose prose-xs max-w-none [&_p]:my-0.5"
                                        dangerouslySetInnerHTML={{ __html: stripMentionHtml(m.content) }}
                                      />
                                    </div>
                                  </div>
                                ))
                              ) : null}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
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
                              <div>
                                <span className="text-sm font-medium">{a.displayName}</span>
                                <span className="text-sm text-muted-foreground ml-1.5">@{a.handle}</span>
                              </div>
                              {a.tierName && (
                                <span className="text-xs text-muted-foreground">{a.tierName}</span>
                              )}
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
                <Separator />
                <Button
                  variant="ghost"
                  className="w-full"
                  disabled={favouriteLoading}
                  onClick={async () => {
                    setFavouriteLoading(true);
                    try {
                      const res = await fetch(`/api/events/${eventId}/favourite`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ eventId }),
                      });
                      if (res.ok) {
                        const d = await res.json();
                        setIsFavourite(d.isFavourite);
                      }
                    } finally {
                      setFavouriteLoading(false);
                    }
                  }}
                >
                  {isFavourite ? (
                    <BookmarkCheck className="size-4 mr-1.5 text-primary" />
                  ) : (
                    <Bookmark className="size-4 mr-1.5" />
                  )}
                  {isFavourite ? "Bookmarked" : "Bookmark"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>


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

    </div>
  );
}

function buildThreadTree<T extends { id: string; inReplyToPostId: string | null }>(
  messages: T[],
  rootId: string,
): { msg: T; depth: number }[] {
  // Exclude the root post, build children map
  const nonRoot = messages.filter((m) => m.id !== rootId);
  const childrenMap = new Map<string, T[]>();
  const roots: T[] = [];

  for (const msg of nonRoot) {
    const parentId = msg.inReplyToPostId;
    if (!parentId || parentId === rootId || !nonRoot.some((m) => m.id === parentId)) {
      roots.push(msg);
    } else {
      const siblings = childrenMap.get(parentId) ?? [];
      siblings.push(msg);
      childrenMap.set(parentId, siblings);
    }
  }

  const result: { msg: T; depth: number }[] = [];
  const walk = (node: T, depth: number) => {
    result.push({ msg: node, depth });
    for (const child of childrenMap.get(node.id) ?? []) {
      walk(child, depth + 1);
    }
  };
  for (const root of roots) {
    walk(root, 0);
  }
  return result;
}

function stripMentionHtml(html: string): string {
  let result = html.replace(
    /<span[^>]*class="[^"]*h-card[^"]*"[^>]*>(<a[^>]*class="[^"]*mention[^"]*"[^>]*>[\s\S]*?<\/a>)<\/span>/g,
    "",
  );
  result = result.replace(
    /<a[^>]*class="[^"]*mention[^"]*"[^>]*>[\s\S]*?<\/a>/g,
    "",
  );
  result = result
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>\s+/g, "<p>")
    .trim();
  return result;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
