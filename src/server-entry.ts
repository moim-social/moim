import { and, eq } from "drizzle-orm";
import { createApp, createRouter, defineEventHandler, fromWebHandler, toWebHandler, toWebRequest, useBase } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { integrateFederation, onError } from "@fedify/h3";
import { Note, Place, Question, respondWithObjectIfAcceptable } from "@fedify/fedify";
import { federation } from "./server/fediverse/federation";
import { db } from "./server/db/client";
import { polls } from "./server/db/schema";
import { actors } from "./server/db/schema";
import { POST as requestOtp } from "./routes/auth/-request-otp";
import { POST as verifyOtp } from "./routes/auth/-verify-otp";
import { GET as getMe } from "./routes/auth/-me";
import { POST as signout } from "./routes/auth/-signout";
import { GET as listLinkedAccounts, DELETE as unlinkAccount } from "./routes/auth/-linked-accounts";
import { POST as linkAccount } from "./routes/auth/-link-account";
import { PATCH as setPrimaryAccount } from "./routes/auth/-set-primary";
import { POST as mergeAccount } from "./routes/auth/-merge-account";
import { POST as otpCheck } from "./routes/auth/-otp-check";
import { GET as searchUsers } from "./routes/groups/-search-users";
import { POST as resolveModerator } from "./routes/groups/-resolve-moderator";
import { POST as createGroup } from "./routes/groups/-create";
import { GET as myGroups } from "./routes/groups/-my-groups";
import { GET as groupDetail } from "./routes/groups/-detail";
import { POST as createGroupNote } from "./routes/groups/-create-note";
import { POST as updateGroup } from "./routes/groups/-update";
import { POST as uploadGroupAvatar } from "./routes/groups/-upload-avatar";
import { POST as createEvent } from "./routes/events/-create";
import { GET as listEvents } from "./routes/events/-list";
import { GET as eventDetail } from "./routes/events/-detail";
import { POST as submitRsvp } from "./routes/events/-rsvp";
import { POST as updateEvent } from "./routes/events/-update";
import { GET as rsvpStatus } from "./routes/events/-rsvp-status";
import { GET as eventAttendees } from "./routes/events/-attendees";
import { GET as noteDetail } from "./routes/notes/-detail";
import { GET as listPlaces } from "./routes/places/-list";
import { GET as placeDetail } from "./routes/places/-detail";
import { POST as checkinPlace } from "./routes/places/-checkin";
import { GET as placeCheckins } from "./routes/places/-checkins";
import { GET as nearbyPlaces } from "./routes/places/-nearby";
import { POST as findOrCreatePlace } from "./routes/places/-find-or-create";
import { GET as listPlaceCategories } from "./routes/places/-categories";
import { GET as listEventCategories } from "./routes/events/-categories";
import { GET as placeEvents } from "./routes/places/-events";
import { GET as serveMap } from "./routes/maps/-serve";
import { GET as serveAvatar } from "./routes/avatars/-serve";
import { GET as serveBanner } from "./routes/banners/-serve";
import { POST as uploadBannerImage } from "./routes/admin/-banner-upload";
import { GET as listBanners, POST as createBanner, PUT as updateBanner, DELETE as deleteBanner } from "./routes/admin/-banners";
import { GET as getUserSettings, PATCH as updateUserSettings } from "./routes/users/-settings";
import { GET as listAdminPlaceCategories, POST as createAdminPlaceCategory, PATCH as updateAdminPlaceCategory, PUT as importAdminPlaceCategories } from "./routes/admin/-place-categories";
import { GET as listAdminEventCategories, POST as createAdminEventCategory, PATCH as updateAdminEventCategory, PUT as importAdminEventCategories } from "./routes/admin/-event-categories";
import { GET as listAdminPlaces, PATCH as updateAdminPlace } from "./routes/admin/-places";
import { GET as listAdminGroupPlaces, POST as assignGroupPlace, DELETE as unassignGroupPlace } from "./routes/admin/-group-places";
import { GET as listGroupPlaces, PATCH as updateGroupPlace } from "./routes/groups/-places";
import { POST as regeneratePlaceSnapshot } from "./routes/admin/-place-snapshot";
import { POST as bulkRegeneratePlaceSnapshots } from "./routes/admin/-place-snapshots-bulk";
import { GET as listUsers } from "./routes/admin/users/-list";
import { GET as userDetail } from "./routes/admin/users/-detail";
import { GET as listAdminGroups, PATCH as toggleGroupVerified } from "./routes/admin/-groups";
import { GET as listAdminEvents, PATCH as updateAdminEvent } from "./routes/admin/-events";
import { GET as listCountries, PUT as importCountries, DELETE as clearCountries } from "./routes/admin/-countries";
import { GET as listPublicCountries } from "./routes/countries/-list";
import { GET as getCarouselSlides } from "./routes/-carousel";
import { POST as trackBannerClick } from "./routes/-banner-click";
import { POST as webfingerLookup } from "./routes/api/-webfinger";
import { POST as instanceLookup } from "./routes/api/-instance-lookup";
import { GET as groupFeed } from "./routes/groups/-feed";
import { GET as eventDashboard } from "./routes/events/-dashboard";
import { GET as eventDashboardActivity } from "./routes/events/-dashboard-activity";
import { GET as listDiscussions } from "./routes/events/-discussions";
import { GET as discussionDetail } from "./routes/events/-discussion-detail";
import { POST as discussionReply } from "./routes/events/-discussion-reply";
import { PATCH as discussionUpdate } from "./routes/events/-discussion-update";
import { GET as listDiscussionsPublic } from "./routes/events/-discussions-public";
import { GET as discussionDetailPublic } from "./routes/events/-discussion-detail-public";
import { POST as uploadEventHeaderImage } from "./routes/events/-upload-header-image";
import { POST as publishEvent } from "./routes/events/-publish";
import { DELETE as deleteEvent } from "./routes/events/-delete";
import { GET as serveEventHeader } from "./routes/event-headers/-serve";
import { POST as createPoll } from "./routes/polls/-create";
import { GET as listPolls } from "./routes/polls/-list";
import { GET as pollDetail } from "./routes/polls/-detail";
import { POST as castVote } from "./routes/polls/-vote";
import { POST as closePoll } from "./routes/polls/-close";

const startFetch = createStartHandler(defaultStreamHandler);

const app = createApp({ onError });
app.use(integrateFederation(federation, () => undefined));
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
  if (!groupId) return Response.json({ error: "groupId is required" }, { status: 400 });

  const handle = await resolveGroupHandle(groupId);
  if (!handle) return Response.json({ error: "Group not found" }, { status: 404 });

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

// --- Poll endpoints ---
apiRouter.post("/groups/:groupActorId/polls", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupActorId = event.context.params?.groupActorId;
  if (!groupActorId) return Response.json({ error: "groupActorId is required" }, { status: 400 });

  return createPoll({
    request: await forwardJson(request, `/api/groups/${groupActorId}/polls`, "POST", (body) => ({
      ...(body ?? {}),
      groupActorId,
    })),
  });
}));

apiRouter.get("/groups/:groupActorId/polls", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const groupActorId = event.context.params?.groupActorId;
  return listPolls({
    request: forwardGet(request, `/api/groups/${groupActorId}/polls`, { groupActorId }),
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
    // Content negotiation for /polls/{pollId} → AP Question
    const pollMatch = url.pathname.match(/^\/polls\/([0-9a-f-]{36})$/);
    if (pollMatch) {
      const [poll] = await db
        .select({ questionId: polls.questionId })
        .from(polls)
        .where(eq(polls.id, pollMatch[1]))
        .limit(1);
      if (poll) {
        const ctx = federation.createContext(request, undefined);
        const question = await ctx.getObject(Question, { questionId: poll.questionId });
        if (question) {
          const response = await respondWithObjectIfAcceptable(question, request);
          if (response) return response;
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
