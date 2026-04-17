import { createFileRoute, Link } from "@tanstack/react-router";
import { useBottomBarSlot } from "~/routes/__root";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo, useState } from "react";
import {
  useEventData,
  useRsvpData,
  useFavouriteStatus,
  usePublicDiscussions,
  usePublicNotices,
  useAttendeesData,
  useDiscussionThread,
  type ThreadMessage,
} from "~/hooks/useEventDetail";
import { z } from "zod";
import { UserFacingMap } from "~/components/maps";
import { getEventMeta as fetchEventMeta } from "~/server/services/events";
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
import { Users, Bookmark, BookmarkCheck } from "lucide-react";
import { PublicDiscussions } from "./-public-discussions";
import { NoticesCard } from "./-notices-card";
import { Trans, useLingui } from "@lingui/react";

const getEventMeta = createServerFn({ method: "GET" })
  .inputValidator(zodValidator(z.object({ eventId: z.string() })))
  .handler(async ({ data }) => {
    return fetchEventMeta(data.eventId);
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

function EventDetailPage() {
  const { i18n } = useLingui();
  const { categoryMap } = useEventCategoryMap();

  const { eventId } = Route.useParams();

  // Data fetching via react-query hooks
  const { data, isLoading: loading, error: eventError } = useEventData(eventId);
  const error = eventError?.message ?? "";
  const { data: rsvpData } = useRsvpData(eventId);
  const { data: favouriteData } = useFavouriteStatus(eventId);
  const [isFavourite, setIsFavourite] = useState(false);
  const [favouriteLoading, setFavouriteLoading] = useState(false);

  // Sync favourite from query
  const fetchedFav = favouriteData?.isFavourite;
  if (fetchedFav !== undefined && fetchedFav !== isFavourite && !favouriteLoading) {
    setIsFavourite(fetchedFav);
  }

  // Map dialog
  const [mapOpen, setMapOpen] = useState(false);

  const isGroupEvent = !!data?.event?.groupHandle;
  const eventNoteApUrl = (data as { eventNoteApUrl?: string | null } | null)?.eventNoteApUrl ?? null;

  const { data: publicInquiries = [] } = usePublicDiscussions(eventId, isGroupEvent);
  const { data: publicNotices = [] } = usePublicNotices(eventId);
  const { data: attendeesData } = useAttendeesData(eventId);

  // Discussion thread expansion
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: expandedThread } = useDiscussionThread(eventId, expandedId);
  const [threadCache, setThreadCache] = useState<Record<string, ThreadMessage[]>>({});

  // Cache thread data when it arrives
  if (expandedId && expandedThread && !threadCache[expandedId]) {
    setThreadCache((prev) => ({ ...prev, [expandedId]: expandedThread }));
  }

  const threadLoading = expandedId && !threadCache[expandedId] ? expandedId : null;

  const toggleThread = (inquiryId: string) => {
    setExpandedId(expandedId === inquiryId ? null : inquiryId);
  };

  const attendeeCount = rsvpData?.rsvpCounts?.accepted ?? data?.rsvpCounts?.accepted ?? 0;
  const anonymousCount = rsvpData?.anonymousCount ?? 0;
  const attendeeLabel = anonymousCount > 0
    ? i18n._("{attendeeCount} attending ({anonymousCount} anonymous)", { attendeeCount, anonymousCount })
    : i18n._("{attendeeCount} attending", { attendeeCount });

  const bottomBarContent = useMemo(() => {
    if (!data) return null;
    if (data.event.externalUrl) {
      return (
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 px-6 py-3">
          <Button size="sm" asChild>
            <a href={data.event.externalUrl} target="_blank" rel="noopener noreferrer">
              <Trans id="Register externally" message="Register externally" />
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
                    ? <Trans id="Going" message="Going" />
                    : rsvpData.userRsvp.status === "waitlisted"
                      ? i18n._("Waitlisted (#{position})", { position: rsvpData.userRsvp.waitlistPosition ?? "?" })
                      : <Trans id="Not going" message="Not going" />}
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
                <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="View Registration" message="View Registration" /></Link>
              </Button>
            ) : rsvpData.allowAnonymousRsvp ? (
              <Button size="sm" asChild>
                <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="Register" message="Register" /></Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link to="/auth/signin" search={{ reason: "rsvp", returnTo: `/events/${eventId}/register` }}><Trans id="Sign in to RSVP" message="Sign in to RSVP" /></Link>
              </Button>
            )
          ) : rsvpData.userRsvp ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="Change RSVP" message="Change RSVP" /></Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="Register" message="Register" /></Link>
            </Button>
          )}
        </div>
      );
    }
    return null;
  }, [data, rsvpData, attendeeCount, eventId]);

  useBottomBarSlot(bottomBarContent);

  if (loading) {
    return <p className="text-muted-foreground"><Trans id="Loading..." message="Loading..." /></p>;
  }

  if (error || !data) {
    return <p className="text-destructive">{error || <Trans id="Event not found" message="Event not found" />}</p>;
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
          <Trans id="Register externally" message="Register externally" />
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
                ? <Trans id="Attending" message="Attending" />
                : rsvpData.userRsvp.status === "waitlisted"
                  ? i18n._("Waitlisted (#{position})", { position: rsvpData.userRsvp.waitlistPosition ?? "?" })
                  : <Trans id="Not attending" message="Not attending" />}
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
            <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="View Registration" message="View Registration" /></Link>
          </Button>
        ) : rsvpData.allowAnonymousRsvp ? (
          <Button className="w-full" asChild>
            <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="Register" message="Register" /></Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to="/auth/signin" search={{ reason: "rsvp", returnTo: `/events/${eventId}/register` }}><Trans id="Sign in to RSVP" message="Sign in to RSVP" /></Link>
          </Button>
        )
      ) : rsvpData.userRsvp ? (
        <Button variant="outline" className="w-full" asChild>
          <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="Change RSVP" message="Change RSVP" /></Link>
        </Button>
      ) : (
        <Button className="w-full" asChild>
          <Link to="/events/$eventId/register" params={{ eventId }}><Trans id="Register" message="Register" /></Link>
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
                  <Trans id="to {endDateStr} {endTimeStr}" values={{ endDateStr, endTimeStr }} message="to {endDateStr} {endTimeStr}" />
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

        {event.eventType === "online" && event.meetingUrl && (
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 size-5 shrink-0 text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                  <path fillRule="evenodd" d="M2 4.25A2.25 2.25 0 0 1 4.25 2h8.5A2.25 2.25 0 0 1 15 4.25v5.5A2.25 2.25 0 0 1 12.75 12h-8.5A2.25 2.25 0 0 1 2 9.75v-5.5Zm2.5 4.75a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5h-8Zm13.5 0a.75.75 0 0 0-.75.75v1.19l-2 2v-5.88l2 2V5.5a.75.75 0 0 1 1.5 0v9a.75.75 0 0 1-1.5 0v-.31l-2-2v1.06a.75.75 0 0 0 1.5 0V10a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">Online event</p>
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all"
                >
                  {event.meetingUrl}
                </a>
              </div>
            </div>
          </div>
        )}

        {event.eventType !== "online" && (event.location || event.placeName) && (
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
                <UserFacingMap
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
                  : i18n._("{names} and {count} others", { names: data.attendeePreview.slice(0, 3).map((a) => a.displayName).join(", "), count: attendeeCount - 3 })}
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
      {event.headerImageUrl ? (
        <div
          className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen px-6 py-12 md:py-16 pb-20 md:pb-24 bg-cover bg-center"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3)), url(${event.headerImageUrl}) center/cover no-repeat`,
          }}
        >
          <div className="mx-auto max-w-5xl">
            {event.categoryId && (
              <Badge variant="secondary" className="mb-3 bg-black/50 text-white border-transparent text-[10px] font-semibold uppercase tracking-wide hover:bg-black/60">
                {categoryMap.get(event.categoryId) ?? event.categoryId}
              </Badge>
            )}
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              {event.title}
            </h1>
            {event.groupHandle ? (
              <p className="mt-3 text-white/80">
                <Trans id="Hosted by <0>{0}</0>" values={{ 0: event.groupName ?? `@${event.groupHandle}` }} components={{ 0: <Link to="/groups/$identifier" params={{ identifier: `@${event.groupHandle}` }} className="text-white underline underline-offset-2 hover:text-white/90" /> }} message="Hosted by <0>{0}</0>" />
              </p>
            ) : event.organizerHandle ? (
              <p className="mt-3 text-white/80">
                {event.organizerActorUrl ? (
                  <Trans id="Hosted by <0>@{0}</0>" values={{ 0: event.organizerHandle }} components={{ 0: <a href={event.organizerActorUrl} target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-2 hover:text-white/90" /> }} message="Hosted by <0>@{0}</0>" />
                ) : (
                  <Trans id="Hosted by <0>@{0}</0>" values={{ 0: event.organizerHandle }} components={{ 0: <span className="text-white" /> }} message="Hosted by <0>@{0}</0>" />
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
                    <Trans id="Edit Event" message="Edit Event" />
                  </Link>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                  asChild
                >
                  <Link to="/events/$eventId/dashboard" params={{ eventId }}>
                    <Trans id="Dashboard" message="Dashboard" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-8 w-screen px-6 py-12 md:py-16 pb-20 md:pb-24 border-b-2 border-foreground overflow-hidden"
          style={{ background: "#fafafa" }}
        >
          {/* Watermark date */}
          <div
            className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 select-none font-extrabold leading-none text-foreground opacity-[0.06]"
            style={{ fontSize: "96px" }}
            aria-hidden="true"
          >
            {start.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: eventTz })}
          </div>
          <div className="relative mx-auto max-w-5xl">
            {event.categoryId && (
              <Badge variant="outline" className="mb-3 border border-border text-[#555] bg-transparent text-[10px] font-semibold uppercase tracking-wide">
                {categoryMap.get(event.categoryId) ?? event.categoryId}
              </Badge>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              {event.title}
            </h1>
            {event.groupHandle ? (
              <p className="mt-3 text-[#666]">
                <Trans id="Hosted by <0>{0}</0>" values={{ 0: event.groupName ?? `@${event.groupHandle}` }} components={{ 0: <Link to="/groups/$identifier" params={{ identifier: `@${event.groupHandle}` }} className="font-semibold text-[#333] underline underline-offset-2 hover:text-foreground" /> }} message="Hosted by <0>{0}</0>" />
              </p>
            ) : event.organizerHandle ? (
              <p className="mt-3 text-[#666]">
                {event.organizerActorUrl ? (
                  <Trans id="Hosted by <0>@{0}</0>" values={{ 0: event.organizerHandle }} components={{ 0: <a href={event.organizerActorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#333] underline underline-offset-2 hover:text-foreground" /> }} message="Hosted by <0>@{0}</0>" />
                ) : (
                  <Trans id="Hosted by <0>@{0}</0>" values={{ 0: event.organizerHandle }} components={{ 0: <span className="font-semibold text-[#333]" /> }} message="Hosted by <0>@{0}</0>" />
                )}
              </p>
            ) : null}
            {data.canEdit && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="border border-border text-[#333] hover:bg-muted"
                  asChild
                >
                  <Link to="/events/$eventId/edit" params={{ eventId }}>
                    <Trans id="Edit Event" message="Edit Event" />
                  </Link>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="border border-border text-[#333] hover:bg-muted"
                  asChild
                >
                  <Link to="/events/$eventId/dashboard" params={{ eventId }}>
                    <Trans id="Dashboard" message="Dashboard" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

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
                {isFavourite ? <Trans id="Bookmarked" message="Bookmarked" /> : <Trans id="Bookmark" message="Bookmark" />}
              </Button>
            </CardContent>
          </Card>

          {/* Notices — only shown when at least one exists */}
          {publicNotices.length > 0 && (
            <NoticesCard notices={publicNotices as { id: string; content: string; createdAt: string }[]} />
          )}

          {/* Description */}
          {event.description && (
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-wide text-[#333]"><Trans id="About" message="About" /></CardTitle>
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
                <CardTitle className="text-xs font-bold uppercase tracking-wide text-[#333]"><Trans id="Organizers" message="Organizers" /></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {organizers.map((o, i) => {
                    const initials = (o.name ?? o.handle ?? "?").charAt(0).toUpperCase();
                    const fallbackBg = "bg-muted text-muted-foreground";
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
                        className="flex flex-col items-center text-center w-36 rounded border p-4 hover:bg-accent transition-colors shrink-0"
                      >
                        {content}
                      </a>
                    ) : (
                      <div
                        key={isExternal ? `ext-${i}` : o.handle}
                        title={tooltip}
                        className="flex flex-col items-center text-center w-36 rounded border p-4 shrink-0"
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
            <PublicDiscussions
              inquiries={publicInquiries}
              eventNoteApUrl={eventNoteApUrl}
              expandedId={expandedId}
              threadCache={threadCache}
              threadLoading={threadLoading}
              onToggleThread={toggleThread}
            />
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
                      <li key={a.userId} className="border rounded-md p-3 space-y-2 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="size-8 shrink-0">
                              {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.displayName} />}
                              <AvatarFallback className="text-xs">
                                {a.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate">
                                <span className="text-sm font-medium">{a.displayName}</span>
                                <span className="text-sm text-muted-foreground ml-1.5">@{a.handle}</span>
                              </div>
                              {a.tierName && (
                                <span className="text-xs text-muted-foreground">{a.tierName}</span>
                              )}
                            </div>
                          </div>
                          <Badge variant={a.status === "accepted" ? "default" : "secondary"} className="shrink-0">
                            {a.status === "accepted" ? <Trans id="Attending" message="Attending" /> : <Trans id="Not attending" message="Not attending" />}
                          </Badge>
                        </div>
                        {a.answers.length > 0 && attendeesData.questions.length > 0 && (
                          <div className="pl-10 space-y-1">
                            {attendeesData.questions.map((q) => {
                              const ans = a.answers.find((x) => x.questionId === q.id);
                              if (!ans) return null;
                              return (
                                <div key={q.id}>
                                  <p className="text-xs text-muted-foreground break-all">{q.question}</p>
                                  <p className="text-sm break-all">{ans.answer}</p>
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
                  {isFavourite ? <Trans id="Bookmarked" message="Bookmarked" /> : <Trans id="Bookmark" message="Bookmark" />}
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
            <UserFacingMap
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

