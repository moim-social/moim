import { and, eq } from "drizzle-orm";
import { createApp, createRouter, defineEventHandler, fromWebHandler, setResponseHeader, toWebHandler, toWebRequest, useBase } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { integrateFederation, onError } from "@fedify/h3";
import { Note, Place, respondWithObjectIfAcceptable } from "@fedify/fedify";
import { federation } from "./server/fediverse/federation";
import { db } from "./server/db/client";
import { polls } from "./server/db/schema";
import { actors } from "./server/db/schema";
import { POST as requestOtp } from "./server/controllers/auth/request-otp";
import { POST as verifyOtp } from "./server/controllers/auth/verify-otp";
import { GET as getMe } from "./server/controllers/auth/me";
import { POST as signout } from "./server/controllers/auth/signout";
import { GET as listLinkedAccounts, DELETE as unlinkAccount } from "./server/controllers/auth/linked-accounts";
import { POST as linkAccount } from "./server/controllers/auth/link-account";
import { PATCH as setPrimaryAccount } from "./server/controllers/auth/set-primary";
import { POST as mergeAccount } from "./server/controllers/auth/merge-account";
import { POST as otpCheck } from "./server/controllers/auth/otp-check";
import { GET as searchUsers } from "./server/controllers/groups/search-users";
import { POST as resolveModerator } from "./server/controllers/groups/resolve-moderator";
import { POST as createGroup } from "./server/controllers/groups/create";
import { GET as myGroups } from "./server/controllers/groups/my-groups";
import { GET as groupDetail } from "./server/controllers/groups/detail";
import { POST as createGroupNote } from "./server/controllers/groups/create-note";
import { POST as updateGroup } from "./server/controllers/groups/update";
import { POST as uploadGroupAvatar } from "./server/controllers/groups/upload-avatar";
import { POST as createEvent } from "./server/controllers/events/create";
import { GET as listEvents } from "./server/controllers/events/list";
import { GET as eventDetail } from "./server/controllers/events/detail";
import { POST as submitRsvp } from "./server/controllers/events/rsvp";
import { POST as updateEvent } from "./server/controllers/events/update";
import { GET as rsvpStatus } from "./server/controllers/events/rsvp-status";
import { GET as eventAttendees } from "./server/controllers/events/attendees";
import { PATCH as manageRsvp } from "./server/controllers/events/rsvp-manage";
import { POST as submitAnonymousRsvp, DELETE as cancelAnonymousRsvp } from "./server/controllers/events/rsvp-anonymous";
import { GET as noteDetail } from "./server/controllers/notes/detail";
import { GET as listPlaces } from "./server/controllers/places/list";
import { GET as placeDetail } from "./server/controllers/places/detail";
import { POST as checkinPlace } from "./server/controllers/places/checkin";
import { GET as placeCheckins } from "./server/controllers/places/checkins";
import { GET as nearbyPlaces } from "./server/controllers/places/nearby";
import { GET as poiSearch } from "./server/controllers/places/poi-search";
import { POST as findOrCreatePlace } from "./server/controllers/places/find-or-create";
import { GET as listPlaceCategories } from "./server/controllers/places/categories";
import { GET as listEventCategories } from "./server/controllers/events/categories";
import { GET as placeEvents } from "./server/controllers/places/events";
import { GET as serveMap } from "./server/controllers/maps/serve";
import { GET as serveAvatar } from "./server/controllers/avatars/serve";
import { GET as serveBanner } from "./server/controllers/banners/serve";
import { POST as uploadBannerImage } from "./server/controllers/admin/banner-upload";
import { GET as listBanners, POST as createBanner, PUT as updateBanner, DELETE as deleteBanner } from "./server/controllers/admin/banners";
import { GET as getUserSettings, PATCH as updateUserSettings } from "./server/controllers/users/settings";
import { GET as getUserFavourites } from "./server/controllers/users/favourites";
import { GET as getUserCalendarEvents } from "./server/controllers/users/calendar-events";
import { POST as generateCalendarToken, DELETE as revokeCalendarToken } from "./server/controllers/users/calendar-token";
import { GET as personalIcsFeed } from "./server/controllers/events/personal-ics";
import { GET as listAdminPlaceCategories, POST as createAdminPlaceCategory, PATCH as updateAdminPlaceCategory, PUT as importAdminPlaceCategories } from "./server/controllers/admin/place-categories";
import { GET as listAdminEventCategories, POST as createAdminEventCategory, PATCH as updateAdminEventCategory, PUT as importAdminEventCategories } from "./server/controllers/admin/event-categories";
import { GET as listAdminPlaces, PATCH as updateAdminPlace } from "./server/controllers/admin/places";
import { GET as listAdminGroupPlaces, POST as assignGroupPlace, DELETE as unassignGroupPlace } from "./server/controllers/admin/group-places";
import { GET as listGroupPlaces, PATCH as updateGroupPlace } from "./server/controllers/groups/places";
import { POST as regeneratePlaceSnapshot } from "./server/controllers/admin/place-snapshot";
import { POST as bulkRegeneratePlaceSnapshots } from "./server/controllers/admin/place-snapshots-bulk";
import { GET as listUsers } from "./server/controllers/admin/users/list";
import { GET as userDetail } from "./server/controllers/admin/users/detail";
import { GET as listAdminGroups, PATCH as toggleGroupVerified } from "./server/controllers/admin/groups";
import { GET as listAdminEvents, PATCH as updateAdminEvent } from "./server/controllers/admin/events";
import { GET as listCountries, PUT as importCountries, DELETE as clearCountries } from "./server/controllers/admin/countries";
import { GET as listPublicCountries } from "./server/controllers/countries/list";
import { GET as getCarouselSlides } from "./server/controllers/carousel";
import { GET as getMapConfig } from "./server/controllers/map-config/get";
import { env } from "./server/env";
import { POST as trackBannerClick } from "./server/controllers/banner-click";
import { POST as webfingerLookup } from "./server/controllers/api/webfinger";
import { POST as instanceLookup } from "./server/controllers/api/instance-lookup";
import { GET as groupFeed } from "./server/controllers/groups/feed";
import { GET as eventDashboard } from "./server/controllers/events/dashboard";
import { GET as eventDashboardActivity } from "./server/controllers/events/dashboard-activity";
import { GET as listDiscussions } from "./server/controllers/events/discussions";
import { GET as discussionDetail } from "./server/controllers/events/discussion-detail";
import { POST as discussionReply } from "./server/controllers/events/discussion-reply";
import { PATCH as discussionUpdate } from "./server/controllers/events/discussion-update";
import { GET as listDiscussionsPublic } from "./server/controllers/events/discussions-public";
import { GET as discussionDetailPublic } from "./server/controllers/events/discussion-detail-public";
import { POST as createEventNotice } from "./server/controllers/events/notices/create";
import { GET as listEventNotices } from "./server/controllers/events/notices/list";
import { POST as uploadEventHeaderImage } from "./server/controllers/events/upload-header-image";
import { POST as publishEvent } from "./server/controllers/events/publish";
import { DELETE as deleteEvent } from "./server/controllers/events/delete";
import { GET as serveEventHeader } from "./server/controllers/event-headers/serve";
import { POST as createPoll } from "./server/controllers/polls/create";
import { GET as listPolls } from "./server/controllers/polls/list";
import { GET as pollDetail } from "./server/controllers/polls/detail";
import { POST as castVote } from "./server/controllers/polls/vote";
import { POST as closePoll } from "./server/controllers/polls/close";
import { GET as icsFeed } from "./server/controllers/events/ics";
import { GET as getFavouriteStatus, POST as toggleFavourite } from "./server/controllers/events/favourite";
import { POST as miauthStart } from "./server/controllers/auth/misskey/miauth-start"
import { GET as miauthCallback } from "./server/controllers/auth/misskey/miauth-callback"
import { POST as miauthCallbackApi } from "./server/controllers/auth/misskey/miauth-callback-api"
import { startCleanupInterval } from "./server/miauth-sessions"
import { POST as mastodonOAuthStart } from "./server/controllers/auth/mastodon/oauth-start"
import { GET as mastodonOAuthCallback } from "./server/controllers/auth/mastodon/oauth-callback"
import { POST as mastodonOAuthCallbackApi } from "./server/controllers/auth/mastodon/oauth-callback-api"
import { startOAuthCleanupInterval } from "./server/mastodon-oauth-sessions"
import { POST as hackerspubGraphqlStart } from "./server/controllers/auth/hackerspub/graphql-start"
import { GET as hackerspubGraphqlCallback } from "./server/controllers/auth/hackerspub/graphql-callback"
import { POST as hackerspubGraphqlCallbackApi } from "./server/controllers/auth/hackerspub/graphql-callback-api"
import { startHackersPubCleanupInterval } from "./server/hackerspub-sessions"
import { startGdprCleanupInterval } from "./server/events/gdpr-cleanup"

const startFetch = createStartHandler(defaultStreamHandler);

const app = createApp({ onError });
app.use(integrateFederation(federation, () => undefined));

// Security headers
const mapProviderScriptSrc =
  env.mapProvider === "kakao"
    ? " https://dapi.kakao.com https://t1.daumcdn.net"
    : "";

const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://us-assets.i.posthog.com${mapProviderScriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

app.use(defineEventHandler((event) => {
  setResponseHeader(event, "X-Frame-Options", "SAMEORIGIN");
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  setResponseHeader(event, "Referrer-Policy", "strict-origin-when-cross-origin");
  setResponseHeader(event, "Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  setResponseHeader(event, "Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  setResponseHeader(event, "Content-Security-Policy", cspHeader);
}));

// Start the MiAuth session cleanup interval
startCleanupInterval();
startOAuthCleanupInterval();
startHackersPubCleanupInterval();
startGdprCleanupInterval();

const apiRouter = createRouter();

function buildForwardUrl(
  request: Request,
  pathname: string,
  query: Record<string, string | undefined> = {},
): URL {
  const url = new URL(request.url);
  const next = new URL(pathname, url.origin);
  for (const [key, value] of url.searchParams.entries()) {
    next.searchParams.set(key, value);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value == null) next.searchParams.delete(key);
    else next.searchParams.set(key, value);
  }
  return next;
}

function forwardGet(
  request: Request,
  pathname: string,
  query: Record<string, string | undefined> = {},
): Request {
  return new Request(buildForwardUrl(request, pathname, query), {
    method: "GET",
    headers: new Headers(request.headers),
  });
}

async function forwardJson(
  request: Request,
  pathname: string,
  method: string,
  mutate: (body: Record<string, unknown> | null) => Record<string, unknown>,
): Promise<Request> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(buildForwardUrl(request, pathname), {
    method,
    headers,
    body: JSON.stringify(mutate(body)),
  });
}

async function forwardFormData(
  request: Request,
  pathname: string,
  method: string,
  mutate: (formData: FormData) => Promise<FormData> | FormData,
): Promise<Request> {
  const formData = await request.formData();
  const nextFormData = await mutate(formData);
  const headers = new Headers(request.headers);
  headers.delete("content-type");
  return new Request(buildForwardUrl(request, pathname), {
    method,
    headers,
    body: nextFormData,
  });
}

async function resolveGroupHandle(groupId: string): Promise<string | null> {
  const [group] = await db
    .select({ handle: actors.handle })
    .from(actors)
    .where(and(eq(actors.id, groupId), eq(actors.type, "Group")))
    .limit(1);

  return group?.handle ?? null;
}

apiRouter.post("/auth/otp-requests", defineEventHandler(async (event) => {
  return requestOtp({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/otp-verifications", defineEventHandler(async (event) => {
  return verifyOtp({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/otp-check", defineEventHandler(async (event) => {
  return otpCheck({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/misskey/miauth-start", defineEventHandler(async (event) => {
  return miauthStart({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/misskey/miauth-callback", defineEventHandler(async (event) => {
  return miauthCallbackApi({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/mastodon/oauth-start", defineEventHandler(async (event) => {
  return mastodonOAuthStart({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/mastodon/oauth-callback", defineEventHandler(async (event) => {
  return mastodonOAuthCallbackApi({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/hackerspub/graphql-start", defineEventHandler(async (event) => {
  return hackerspubGraphqlStart({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/hackerspub/graphql-callback", defineEventHandler(async (event) => {
  return hackerspubGraphqlCallbackApi({ request: toWebRequest(event) });
}));

apiRouter.get("/session", defineEventHandler(async (event) => {
  return getMe({ request: toWebRequest(event) });
}));

apiRouter.delete("/session", defineEventHandler(async (event) => {
  return signout({ request: toWebRequest(event) });
}));

apiRouter.get("/auth/linked-accounts", defineEventHandler(async (event) => {
  return listLinkedAccounts({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/link-account", defineEventHandler(async (event) => {
  return linkAccount({ request: toWebRequest(event) });
}));

apiRouter.patch("/auth/primary-account", defineEventHandler(async (event) => {
  return setPrimaryAccount({ request: toWebRequest(event) });
}));

apiRouter.delete("/auth/linked-accounts", defineEventHandler(async (event) => {
  return unlinkAccount({ request: toWebRequest(event) });
}));

apiRouter.post("/auth/merge-account", defineEventHandler(async (event) => {
  return mergeAccount({ request: toWebRequest(event) });
}));

apiRouter.get("/users/settings", defineEventHandler(async (event) => {
  return getUserSettings({ request: toWebRequest(event) });
}));

apiRouter.patch("/users/settings", defineEventHandler(async (event) => {
  return updateUserSettings({ request: toWebRequest(event) });
}));

apiRouter.post("/users/calendar-token", defineEventHandler(async (event) => {
  return generateCalendarToken({ request: toWebRequest(event) });
}));

apiRouter.delete("/users/calendar-token", defineEventHandler(async (event) => {
  return revokeCalendarToken({ request: toWebRequest(event) });
}));

apiRouter.get("/users/favourites", defineEventHandler(async (event) => {
  return getUserFavourites({ request: toWebRequest(event) });
}));

apiRouter.get("/users/calendar-events", defineEventHandler(async (event) => {
  return getUserCalendarEvents({ request: toWebRequest(event) });
}));

apiRouter.get("/users", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const query = new URL(request.url).searchParams.get("query")?.trim();
  return searchUsers({
    request: forwardGet(request, "/api/users", { q: query, query: undefined }),
  });
}));

apiRouter.post("/actors/resolve", defineEventHandler(async (event) => {
  return resolveModerator({ request: toWebRequest(event) });
}));


apiRouter.post("/groups", defineEventHandler(async (event) => {
  return createGroup({ request: toWebRequest(event) });
}));

apiRouter.get("/me/groups", defineEventHandler(async (event) => {
  return myGroups({ request: toWebRequest(event) });
}));

apiRouter.get("/groups/by-handle/:handle", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const handle = decodeURIComponent(event.context.params?.handle ?? "");
  return groupDetail({
    request: forwardGet(request, "/api/groups/by-handle", { handle }),
  });
}));

apiRouter.patch("/groups/:groupId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  if (!groupId) {
    return Response.json({ error: "groupId is required" }, { status: 400 });
  }

  const handle = await resolveGroupHandle(groupId);
  if (!handle) {
    return Response.json({ error: "Group not found" }, { status: 404 });
  }

  return updateGroup({
    request: await forwardJson(request, `/api/groups/${groupId}`, "POST", (body) => ({
      ...(body ?? {}),
      handle,
    })),
  });
}));

apiRouter.post("/groups/:groupId/avatar", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  if (!groupId) return Response.json({ error: "groupId is required" }, { status: 400 });

  const handle = await resolveGroupHandle(groupId);
  if (!handle) return Response.json({ error: "Group not found" }, { status: 404 });

  return uploadGroupAvatar({
    request: await forwardFormData(request, `/api/groups/${groupId}/avatar`, "POST", (formData) => {
      formData.set("handle", handle);
      return formData;
    }),
  });
}));

apiRouter.post("/groups/:groupId/posts", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  if (!groupId) return Response.json({ error: "groupId is required" }, { status: 400 });

  const handle = await resolveGroupHandle(groupId);
  if (!handle) return Response.json({ error: "Group not found" }, { status: 404 });

  return createGroupNote({
    request: await forwardJson(request, `/api/groups/${groupId}/posts`, "POST", (body) => ({
      groupHandle: handle,
      content: typeof body?.content === "string" ? body.content : "",
    })),
  });
}));

apiRouter.get("/groups/:groupId/places", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  if (!groupId) return Response.json({ error: "groupId is required" }, { status: 400 });
  return listGroupPlaces({
    request: forwardGet(request, `/api/groups/${groupId}/places`, { groupActorId: groupId }),
  });
}));

apiRouter.patch("/groups/:groupId/places/:placeId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  const placeId = event.context.params?.placeId;
  if (!groupId || !placeId) return Response.json({ error: "groupId and placeId are required" }, { status: 400 });
  return updateGroupPlace({
    request: await forwardJson(request, `/api/groups/${groupId}/places/${placeId}`, "PATCH", (body) => ({
      ...(body ?? {}),
      groupActorId: groupId,
      placeId,
    })),
  });
}));

apiRouter.get("/events", defineEventHandler(async (event) => {
  return listEvents({ request: toWebRequest(event) });
}));

apiRouter.post("/events", defineEventHandler(async (event) => {
  return createEvent({ request: toWebRequest(event) });
}));

apiRouter.get("/events/:eventId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return eventDetail({
    request: forwardGet(request, `/api/events/${eventId}`, { id: eventId }),
  });
}));

apiRouter.patch("/events/:eventId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return updateEvent({
    request: await forwardJson(request, `/api/events/${eventId}`, "POST", (body) => ({
      ...(body ?? {}),
      eventId,
    })),
  });
}));

apiRouter.get("/events/:eventId/rsvp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return rsvpStatus({
    request: forwardGet(request, `/api/events/${eventId}/rsvp`, { eventId }),
  });
}));

apiRouter.put("/events/:eventId/rsvp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return submitRsvp({
    request: await forwardJson(request, `/api/events/${eventId}/rsvp`, "POST", (body) => ({
      ...(body ?? {}),
      eventId,
    })),
  });
}));

apiRouter.put("/events/:eventId/rsvp/anonymous", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return submitAnonymousRsvp({
    request: await forwardJson(request, `/api/events/${eventId}/rsvp/anonymous`, "POST", (body) => ({
      ...(body ?? {}),
      eventId,
    })),
  });
}));

apiRouter.delete("/events/:eventId/rsvp/anonymous", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return cancelAnonymousRsvp({ request, eventId });
}));

apiRouter.patch("/events/:eventId/rsvps/:rsvpId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  const rsvpId = event.context.params?.rsvpId;
  if (!eventId || !rsvpId) return Response.json({ error: "eventId and rsvpId are required" }, { status: 400 });

  return manageRsvp({
    request: await forwardJson(request, `/api/events/${eventId}/rsvps/${rsvpId}`, "PATCH", (body) => body ?? {}),
    eventId,
    rsvpId,
  });
}));

apiRouter.get("/events/:eventId/favourite", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return getFavouriteStatus({
    request: forwardGet(request, `/api/events/${eventId}/favourite`, { eventId }),
  });
}));

apiRouter.post("/events/:eventId/favourite", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return toggleFavourite({
    request: await forwardJson(request, `/api/events/${eventId}/favourite`, "POST", (body) => ({
      ...body,
      eventId,
    })),
  });
}));

apiRouter.get("/events/:eventId/attendees", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return eventAttendees({
    request: forwardGet(request, `/api/events/${eventId}/attendees`, { eventId }),
  });
}));

apiRouter.get("/events/:eventId/dashboard", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return eventDashboard({
    request: forwardGet(request, `/api/events/${eventId}/dashboard`, { eventId }),
  });
}));

apiRouter.get("/events/:eventId/dashboard/activity", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return eventDashboardActivity({
    request: forwardGet(request, `/api/events/${eventId}/dashboard/activity`, { eventId }),
  });
}));

// --- Discussion endpoints (CRM) ---
apiRouter.get("/events/:eventId/discussions", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return listDiscussions({
    request: forwardGet(request, `/api/events/${eventId}/discussions`, { eventId }),
  });
}));

apiRouter.get("/events/:eventId/discussions/public", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return listDiscussionsPublic({
    request: forwardGet(request, `/api/events/${eventId}/discussions/public`, { eventId }),
  });
}));

apiRouter.get("/events/:eventId/discussions/public/:inquiryId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  const inquiryId = event.context.params?.inquiryId;
  return discussionDetailPublic({
    request: forwardGet(request, `/api/events/${eventId}/discussions/public/${inquiryId}`, { eventId, inquiryId }),
  });
}));

apiRouter.get("/events/:eventId/discussions/:inquiryId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  const inquiryId = event.context.params?.inquiryId;
  return discussionDetail({
    request: forwardGet(request, `/api/events/${eventId}/discussions/${inquiryId}`, { eventId, inquiryId }),
  });
}));

apiRouter.post("/events/:eventId/discussions/:inquiryId/replies", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  const inquiryId = event.context.params?.inquiryId;
  if (!eventId || !inquiryId) return Response.json({ error: "eventId and inquiryId are required" }, { status: 400 });

  return discussionReply({
    request: await forwardJson(request, `/api/events/${eventId}/discussions/${inquiryId}/replies`, "POST", (body) => ({
      ...(body ?? {}),
      eventId,
      inquiryId,
    })),
  });
}));

apiRouter.patch("/events/:eventId/discussions/:inquiryId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  const inquiryId = event.context.params?.inquiryId;
  if (!eventId || !inquiryId) return Response.json({ error: "eventId and inquiryId are required" }, { status: 400 });

  return discussionUpdate({
    request: await forwardJson(request, `/api/events/${eventId}/discussions/${inquiryId}`, "PATCH", (body) => ({
      ...(body ?? {}),
      eventId,
      inquiryId,
    })),
  });
}));

// --- Event Notice endpoints ---
apiRouter.post("/events/:eventId/notices", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return createEventNotice({
    request: await forwardJson(request, `/api/events/${eventId}/notices`, "POST", (body) => ({
      ...(body ?? {}),
      eventId,
    })),
  });
}));

apiRouter.get("/events/:eventId/notices", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return listEventNotices({
    request: forwardGet(request, `/api/events/${eventId}/notices`, { eventId }),
  });
}));

apiRouter.get("/events/:eventId/notices/public", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  return listEventNotices({
    request: forwardGet(request, `/api/events/${eventId}/notices/public`, { eventId, public: "1" }),
  });
}));

// --- Poll endpoints ---
apiRouter.post("/groups/:groupId/polls", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  if (!groupId) return Response.json({ error: "groupId is required" }, { status: 400 });

  return createPoll({
    request: await forwardJson(request, `/api/groups/${groupId}/polls`, "POST", (body) => ({
      ...(body ?? {}),
      groupActorId: groupId,
    })),
  });
}));

apiRouter.get("/groups/:groupId/polls", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupId = event.context.params?.groupId;
  return listPolls({
    request: forwardGet(request, `/api/groups/${groupId}/polls`, { groupActorId: groupId }),
  });
}));

apiRouter.get("/polls/:pollId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const pollId = event.context.params?.pollId;
  return pollDetail({
    request: forwardGet(request, `/api/polls/${pollId}`, { pollId }),
  });
}));

apiRouter.post("/polls/:pollId/vote", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const pollId = event.context.params?.pollId;
  if (!pollId) return Response.json({ error: "pollId is required" }, { status: 400 });

  return castVote({
    request: await forwardJson(request, `/api/polls/${pollId}/vote`, "POST", (body) => ({
      ...(body ?? {}),
      pollId,
    })),
  });
}));

apiRouter.post("/polls/:pollId/close", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const pollId = event.context.params?.pollId;
  if (!pollId) return Response.json({ error: "pollId is required" }, { status: 400 });

  return closePoll({
    request: await forwardJson(request, `/api/polls/${pollId}/close`, "POST", (body) => ({
      ...(body ?? {}),
      pollId,
    })),
  });
}));

apiRouter.post("/events/:eventId/publish", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return publishEvent({
    request: await forwardJson(request, `/api/events/${eventId}/publish`, "POST", (body) => ({
      ...(body ?? {}),
      eventId,
    })),
  });
}));

apiRouter.delete("/events/:eventId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return deleteEvent({
    request: forwardGet(request, `/api/events/${eventId}`, { eventId }),
  });
}));

apiRouter.post("/events/:eventId/header-image", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return uploadEventHeaderImage({
    request: await forwardFormData(request, `/api/events/${eventId}/header-image?eventId=${eventId}`, "POST", (formData) => formData),
  });
}));

apiRouter.get("/notes/:noteId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const noteId = event.context.params?.noteId;
  return noteDetail({
    request: forwardGet(request, `/api/notes/${noteId}`, { id: noteId }),
  });
}));

apiRouter.get("/places", defineEventHandler(async (event) => {
  return listPlaces({ request: toWebRequest(event) });
}));

apiRouter.get("/place-categories", defineEventHandler(async (event) => {
  return listPlaceCategories();
}));

apiRouter.get("/event-categories", defineEventHandler(async () => {
  return listEventCategories();
}));

apiRouter.post("/places", defineEventHandler(async (event) => {
  return findOrCreatePlace({ request: toWebRequest(event) });
}));

apiRouter.get("/places/nearby", defineEventHandler(async (event) => {
  return nearbyPlaces({ request: toWebRequest(event) });
}));

apiRouter.get("/places/poi-search", defineEventHandler(async (event) => {
  return poiSearch({ request: toWebRequest(event) });
}));

apiRouter.get("/places/:placeId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const placeId = event.context.params?.placeId;
  return placeDetail({
    request: forwardGet(request, `/api/places/${placeId}`, { id: placeId }),
  });
}));

apiRouter.get("/places/:placeId/events", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const placeId = event.context.params?.placeId;
  return placeEvents({
    request: forwardGet(request, `/api/places/${placeId}/events`, { placeId }),
  });
}));

apiRouter.get("/check-ins", defineEventHandler(async (event) => {
  return placeCheckins({ request: toWebRequest(event) });
}));

apiRouter.post("/check-ins", defineEventHandler(async (event) => {
  return checkinPlace({ request: toWebRequest(event) });
}));

apiRouter.post("/admin/banners/assets", defineEventHandler(async (event) => {
  return uploadBannerImage({ request: toWebRequest(event) });
}));

apiRouter.get("/admin/banners", defineEventHandler(async (event) => {
  return listBanners({ request: toWebRequest(event) });
}));

apiRouter.post("/admin/banners", defineEventHandler(async (event) => {
  return createBanner({ request: toWebRequest(event) });
}));

apiRouter.patch("/admin/banners/:bannerId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const bannerId = event.context.params?.bannerId;
  if (!bannerId) return Response.json({ error: "bannerId is required" }, { status: 400 });

  return updateBanner({
    request: await forwardJson(request, `/api/admin/banners/${bannerId}`, "PUT", (body) => ({
      ...(body ?? {}),
      id: bannerId,
    })),
  });
}));

apiRouter.delete("/admin/banners/:bannerId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const bannerId = event.context.params?.bannerId;
  return deleteBanner({
    request: forwardGet(request, `/api/admin/banners/${bannerId}`, { id: bannerId }),
  });
}));

apiRouter.get("/admin/users", defineEventHandler(async (event) => {
  return listUsers({ request: toWebRequest(event) });
}));

apiRouter.get("/admin/groups", defineEventHandler(async (event) => {
  return listAdminGroups({ request: toWebRequest(event) });
}));

apiRouter.patch("/admin/groups", defineEventHandler(async (event) => {
  return toggleGroupVerified({ request: toWebRequest(event) });
}));

apiRouter.get("/admin/events", defineEventHandler(async (event) => {
  return listAdminEvents({ request: toWebRequest(event) });
}));

apiRouter.patch("/admin/events/:eventId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const eventId = event.context.params?.eventId;
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  return updateAdminEvent({
    request: await forwardJson(request, `/api/admin/events/${eventId}`, "PATCH", (body) => ({
      ...(body ?? {}),
      id: eventId,
    })),
  });
}));

apiRouter.get("/admin/place-categories", defineEventHandler(async (event) => {
  return listAdminPlaceCategories({ request: toWebRequest(event) });
}));

apiRouter.post("/admin/place-categories", defineEventHandler(async (event) => {
  return createAdminPlaceCategory({ request: toWebRequest(event) });
}));

apiRouter.put("/admin/place-categories", defineEventHandler(async (event) => {
  return importAdminPlaceCategories({ request: toWebRequest(event) });
}));

apiRouter.patch("/admin/place-categories/:categoryId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const categoryId = event.context.params?.categoryId;
  if (!categoryId) return Response.json({ error: "categoryId is required" }, { status: 400 });

  return updateAdminPlaceCategory({
    request: await forwardJson(request, `/api/admin/place-categories/${categoryId}`, "PATCH", (body) => ({
      ...(body ?? {}),
      categorySlug: categoryId,
    })),
  });
}));

apiRouter.get("/admin/event-categories", defineEventHandler(async (event) => {
  return listAdminEventCategories({ request: toWebRequest(event) });
}));

apiRouter.post("/admin/event-categories", defineEventHandler(async (event) => {
  return createAdminEventCategory({ request: toWebRequest(event) });
}));

apiRouter.put("/admin/event-categories", defineEventHandler(async (event) => {
  return importAdminEventCategories({ request: toWebRequest(event) });
}));

apiRouter.patch("/admin/event-categories/:categorySlug", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const categorySlug = event.context.params?.categorySlug;
  if (!categorySlug) return Response.json({ error: "categorySlug is required" }, { status: 400 });

  return updateAdminEventCategory({
    request: await forwardJson(request, `/api/admin/event-categories/${categorySlug}`, "PATCH", (body) => ({
      ...(body ?? {}),
      categorySlug,
    })),
  });
}));

apiRouter.get("/admin/places", defineEventHandler(async (event) => {
  return listAdminPlaces({ request: toWebRequest(event) });
}));

apiRouter.patch("/admin/places/:placeId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const placeId = event.context.params?.placeId;
  if (!placeId) return Response.json({ error: "placeId is required" }, { status: 400 });

  return updateAdminPlace({
    request: await forwardJson(request, `/api/admin/places/${placeId}`, "PATCH", (body) => ({
      ...(body ?? {}),
      id: placeId,
    })),
  });
}));

apiRouter.post("/admin/places/:placeId/regenerate-snapshot", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const placeId = event.context.params?.placeId;
  if (!placeId) return Response.json({ error: "placeId is required" }, { status: 400 });
  return regeneratePlaceSnapshot({
    request: await forwardJson(request, `/api/admin/places/${placeId}/regenerate-snapshot`, "POST", () => ({
      placeId,
    })),
  });
}));

apiRouter.post("/admin/places/regenerate-snapshots", defineEventHandler(async (event) => {
  return bulkRegeneratePlaceSnapshots({ request: toWebRequest(event) });
}));

apiRouter.get("/admin/group-places", defineEventHandler(async (event) => {
  return listAdminGroupPlaces({ request: toWebRequest(event) });
}));

apiRouter.post("/admin/group-places", defineEventHandler(async (event) => {
  return assignGroupPlace({ request: toWebRequest(event) });
}));

apiRouter.delete("/admin/group-places", defineEventHandler(async (event) => {
  return unassignGroupPlace({ request: toWebRequest(event) });
}));

apiRouter.get("/admin/countries", defineEventHandler(async (event) => {
  return listCountries({ request: toWebRequest(event) });
}));

apiRouter.put("/admin/countries", defineEventHandler(async (event) => {
  return importCountries({ request: toWebRequest(event) });
}));

apiRouter.delete("/admin/countries", defineEventHandler(async (event) => {
  return clearCountries({ request: toWebRequest(event) });
}));

apiRouter.get("/admin/users/:userId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const userId = event.context.params?.userId;
  return userDetail({
    request: forwardGet(request, `/api/admin/users/${userId}`, { id: userId }),
  });
}));

apiRouter.get("/countries", defineEventHandler(async () => {
  return listPublicCountries();
}));

apiRouter.get("/home/carousel", defineEventHandler(async (event) => {
  return getCarouselSlides({ request: toWebRequest(event) });
}));

apiRouter.get("/map-config", defineEventHandler(async () => {
  return getMapConfig();
}));

apiRouter.post("/banner-clicks", defineEventHandler(async (event) => {
  return trackBannerClick({ request: toWebRequest(event) });
}));

apiRouter.post("/webfinger", defineEventHandler(async (event) => {
  return webfingerLookup({ request: toWebRequest(event) });
}));

apiRouter.post("/instance-lookup", defineEventHandler(async (event) => {
  return instanceLookup({ request: toWebRequest(event) });
}));

app.use("/api", useBase("/api", apiRouter.handler));

// MiAuth callback (outside /api)
app.use("/auth/misskey/miauth-callback", defineEventHandler(async (event) => {
  return miauthCallback({ request: toWebRequest(event) });
}));

// Mastodon OAuth callback (outside /api)
app.use("/auth/mastodon/oauth-callback", defineEventHandler(async (event) => {
  return mastodonOAuthCallback({ request: toWebRequest(event) });
}));

// HackersPub GraphQL callback (outside /api)
app.use("/auth/hackerspub/callback", defineEventHandler(async (event) => {
  return hackerspubGraphqlCallback({ request: toWebRequest(event) });
}));

// Map image routes
app.use("/maps", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return serveMap({ request });
}));

// Avatar image routes
app.use("/avatars", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return serveAvatar({ request });
}));

// Banner image routes
app.use("/banners", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return serveBanner({ request });
}));

// Event header image routes
app.use("/event-headers", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return serveEventHeader({ request });
}));

app.use(
  fromWebHandler(async (request) => {
    const url = new URL(request.url);

    // RSS feed for groups
    const feedMatch = url.pathname.match(/^\/groups\/@([^/]+)\/feed\.xml$/);
    if (feedMatch) {
      const handle = decodeURIComponent(feedMatch[1]);
      return groupFeed({
        request: forwardGet(request, "/groups/feed", { handle }),
      });
    }

    // ICS calendar feed for groups
    const groupIcsMatch = url.pathname.match(/^\/groups\/@([^/]+)\/events\.ics$/);
    if (groupIcsMatch) {
      const handle = decodeURIComponent(groupIcsMatch[1]);
      const [group] = await db
        .select({ id: actors.id, name: actors.name, handle: actors.handle })
        .from(actors)
        .where(and(eq(actors.handle, handle), eq(actors.type, "Group")))
        .limit(1);
      if (group) {
        const calendarName = group.name ?? `@${group.handle}`;
        return icsFeed({
          request: forwardGet(request, "/events/ics", {
            groupActorId: group.id,
            calendarName,
          }),
        });
      }
      return new Response("Group not found", { status: 404 });
    }
    // ICS calendar feed for categories (optionally filtered by country)
    const categoryIcsMatch = url.pathname.match(
      /^\/categories\/([^/]+)(?:\/countries\/([A-Z]{2}))?\/events\.ics$/,
    );
    if (categoryIcsMatch) {
      const slug = decodeURIComponent(categoryIcsMatch[1]);
      const country = categoryIcsMatch[2] ?? undefined;
      const calendarName = country
        ? `${slug} (${country}) — Moim`
        : `${slug} — Moim`;
      return icsFeed({
        request: forwardGet(request, "/events/ics", {
          categoryId: slug,
          country,
          calendarName,
        }),
      });
    }

    // Personal RSVP calendar feed
    if (url.pathname === "/calendar.ics") {
      return personalIcsFeed({ request });
    }

    // Content negotiation: serve AP object directly for /notes/{uuid} and /places/{uuid}
    const noteMatch = url.pathname.match(/^\/notes\/([0-9a-f-]{36})$/);
    if (noteMatch) {
      const ctx = federation.createContext(request, undefined);
      const note = await ctx.getObject(Note, { noteId: noteMatch[1] });
      if (note) {
        const response = await respondWithObjectIfAcceptable(note, request);
        if (response) return response;
      }
    }
    const placeMatch = url.pathname.match(/^\/places\/([0-9a-f-]{36})$/);
    if (placeMatch) {
      const ctx = federation.createContext(request, undefined);
      const place = await ctx.getObject(Place, { placeId: placeMatch[1] });
      if (place) {
        const response = await respondWithObjectIfAcceptable(place, request);
        if (response) return response;
      }
    }
    // /ap/notes/{noteId} + browser → redirect to /notes/{noteId}
    const apNoteMatch = url.pathname.match(/^\/ap\/notes\/([0-9a-f-]{36})$/);
    if (apNoteMatch) {
      const accept = request.headers.get("Accept") ?? "";
      const isAP = accept.includes("application/activity+json")
        || accept.includes("application/ld+json");
      if (!isAP) {
        return Response.redirect(
          new URL(`/notes/${apNoteMatch[1]}`, url.origin),
          302,
        );
      }
    }
    // /ap/questions/{questionId} + browser → redirect to /polls/{pollId}
    const apQuestionMatch = url.pathname.match(/^\/ap\/questions\/([0-9a-f-]{36})$/);
    if (apQuestionMatch) {
      const accept = request.headers.get("Accept") ?? "";
      const isAP = accept.includes("application/activity+json")
        || accept.includes("application/ld+json");
      if (!isAP) {
        const [poll] = await db
          .select({ id: polls.id })
          .from(polls)
          .where(eq(polls.questionId, apQuestionMatch[1]))
          .limit(1);
        if (poll) {
          return Response.redirect(new URL(`/polls/${poll.id}`, url.origin), 302);
        }
      }
    }
    // /polls/{pollId} + AP Accept → redirect to /ap/questions/{questionId}
    const pollMatch = url.pathname.match(/^\/polls\/([0-9a-f-]{36})$/);
    if (pollMatch) {
      const accept = request.headers.get("Accept") ?? "";
      const isAP = accept.includes("application/activity+json")
        || accept.includes("application/ld+json");
      if (isAP) {
        const [poll] = await db
          .select({ questionId: polls.questionId })
          .from(polls)
          .where(eq(polls.id, pollMatch[1]))
          .limit(1);
        if (poll) {
          return Response.redirect(
            new URL(`/ap/questions/${poll.questionId}`, url.origin),
            302,
          );
        }
      }
    }
    return startFetch(request);
  }),
);

const handler = toWebHandler(app);

export default {
  async fetch(request: Request) {
    return handler(request);
  },
};
