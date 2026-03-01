import { createApp, defineEventHandler, fromWebHandler, toWebHandler, toWebRequest } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { integrateFederation, onError } from "@fedify/h3";
import { Note, respondWithObjectIfAcceptable } from "@fedify/fedify";
import { federation } from "./server/fediverse/federation";
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
import { POST as webfingerLookup } from "./routes/api/-webfinger";

const startFetch = createStartHandler(defaultStreamHandler);

const app = createApp({ onError });
app.use(integrateFederation(federation, () => undefined));

// Auth API routes (pathless route files, registered explicitly via h3)
app.use("/auth/request-otp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return requestOtp({ request });
}));

app.use("/auth/verify-otp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return verifyOtp({ request });
}));

app.use("/auth/me", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return getMe({ request });
}));

app.use("/auth/signout", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return signout({ request });
}));

// Group API routes
app.use("/groups/search-users", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return searchUsers({ request });
}));

app.use("/groups/resolve-moderator", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return resolveModerator({ request });
}));

app.use("/groups/create-note", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return createGroupNote({ request });
}));

app.use("/groups/create", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return createGroup({ request });
}));

app.use("/groups/my-groups", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return myGroups({ request });
}));

app.use("/groups/detail", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return groupDetail({ request });
}));

app.use("/groups/update", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return updateGroup({ request });
}));

// Event API routes
app.use("/events/create", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return createEvent({ request });
}));

app.use("/events/list", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return listEvents({ request });
}));

app.use("/events/detail", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return eventDetail({ request });
}));

app.use("/events/rsvp-status", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return rsvpStatus({ request });
}));

app.use("/events/attendees", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return eventAttendees({ request });
}));

app.use("/events/rsvp", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return submitRsvp({ request });
}));

app.use("/events/update", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return updateEvent({ request });
}));

// Note API routes
app.use("/notes/detail", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return noteDetail({ request });
}));

// Place API routes
app.use("/places/list", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return listPlaces({ request });
}));

app.use("/places/detail", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return placeDetail({ request });
}));

app.use("/places/checkin", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return checkinPlace({ request });
}));

app.use("/places/checkins", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return placeCheckins({ request });
}));

app.use("/places/nearby", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return nearbyPlaces({ request });
}));

app.use("/places/find-or-create", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return findOrCreatePlace({ request });
}));

// API routes
app.use("/api/webfinger", defineEventHandler(async (event) => {
  const request = toWebRequest(event);
  return webfingerLookup({ request });
}));

app.use(
  fromWebHandler(async (request) => {
    // Content negotiation: serve AP object directly for /notes/{uuid}
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
    return startFetch(request);
  }),
);

const handler = toWebHandler(app);

export default {
  async fetch(request: Request) {
    return handler(request);
  },
};
