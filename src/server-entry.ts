import { and, eq } from "drizzle-orm";
import { createApp, createRouter, defineEventHandler, fromWebHandler, toWebHandler, toWebRequest, useBase } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { integrateFederation, onError } from "@fedify/h3";
import { Note, Place, respondWithObjectIfAcceptable } from "@fedify/fedify";
import { federation } from "./server/fediverse/federation";
import { db } from "./server/db/client";
import { actors } from "./server/db/schema";
import { POST as requestOtp } from "./routes/auth/-request-otp";
import { POST as verifyOtp } from "./routes/auth/-verify-otp";
import { GET as getMe } from "./routes/auth/-me";
import { POST as signout } from "./routes/auth/-signout";
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
import { GET as serveMap } from "./routes/maps/-serve";
import { GET as serveAvatar } from "./routes/avatars/-serve";
import { GET as serveBanner } from "./routes/banners/-serve";
import { POST as uploadBannerImage } from "./routes/admin/-banner-upload";
import { GET as listBanners, POST as createBanner, PUT as updateBanner, DELETE as deleteBanner } from "./routes/admin/-banners";
import { GET as listUsers } from "./routes/admin/users/-list";
import { GET as userDetail } from "./routes/admin/users/-detail";
import { GET as getCarouselSlides } from "./routes/-carousel";
import { POST as trackBannerClick } from "./routes/-banner-click";
import { POST as webfingerLookup } from "./routes/api/-webfinger";

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

apiRouter.get("/session", defineEventHandler(async (event) => {
  return getMe({ request: toWebRequest(event) });
}));

apiRouter.delete("/session", defineEventHandler(async (event) => {
  return signout({ request: toWebRequest(event) });
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

apiRouter.get("/admin/users/:userId", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  const userId = event.context.params?.userId;
  return userDetail({
    request: forwardGet(request, `/api/admin/users/${userId}`, { id: userId }),
  });
}));

apiRouter.get("/home/carousel", defineEventHandler(async () => {
  return getCarouselSlides();
}));

apiRouter.post("/banner-clicks", defineEventHandler(async (event) => {
  return trackBannerClick({ request: toWebRequest(event) });
}));

apiRouter.post("/webfinger", defineEventHandler(async (event) => {
  return webfingerLookup({ request: toWebRequest(event) });
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

app.use(
  fromWebHandler(async (request) => {
    // Content negotiation: serve AP object directly for /notes/{uuid} and /places/{uuid}
    const url = new URL(request.url);
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
    return startFetch(request);
  }),
);

const handler = toWebHandler(app);

export default {
  async fetch(request: Request) {
    return handler(request);
  },
};
