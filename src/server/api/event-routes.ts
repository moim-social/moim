import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { POST as createEvent } from "~/server/controllers/events/create";
import { GET as listEvents } from "~/server/controllers/events/list";
import { GET as eventDetail } from "~/server/controllers/events/detail";
import { POST as submitRsvp } from "~/server/controllers/events/rsvp";
import { POST as updateEvent } from "~/server/controllers/events/update";
import { GET as rsvpStatus } from "~/server/controllers/events/rsvp-status";
import { GET as eventAttendees } from "~/server/controllers/events/attendees";
import { PATCH as manageRsvp } from "~/server/controllers/events/rsvp-manage";
import {
  POST as submitAnonymousRsvp,
  DELETE as cancelAnonymousRsvp,
} from "~/server/controllers/events/rsvp-anonymous";
import { GET as eventDashboard } from "~/server/controllers/events/dashboard";
import { GET as eventDashboardActivity } from "~/server/controllers/events/dashboard-activity";
import { POST as uploadEventHeaderImage } from "~/server/controllers/events/upload-header-image";
import { POST as publishEvent } from "~/server/controllers/events/publish";
import { DELETE as deleteEvent } from "~/server/controllers/events/delete";
import {
  GET as getFavouriteStatus,
  POST as toggleFavourite,
} from "~/server/controllers/events/favourite";
import { forwardFormData, forwardGet, forwardJson } from "~/server/api/forwarding";
import { registerDiscussionRoutes } from "~/server/api/discussion-routes";
import { registerEventNoticeRoutes } from "~/server/api/event-notice-routes";

export function registerEventRoutes(router: Router): void {
  router.get(
    "/events",
    defineEventHandler(async (event) => {
      return listEvents({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/events",
    defineEventHandler(async (event) => {
      return createEvent({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/events/:eventId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return eventDetail({
        request: forwardGet(request, `/api/events/${eventId}`, { id: eventId }),
      });
    }),
  );

  router.patch(
    "/events/:eventId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return updateEvent({
        request: await forwardJson(
          request,
          `/api/events/${eventId}`,
          "POST",
          (body) => ({
            ...(body ?? {}),
            eventId,
          }),
        ),
      });
    }),
  );

  router.get(
    "/events/:eventId/rsvp",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return rsvpStatus({
        request: forwardGet(request, `/api/events/${eventId}/rsvp`, { eventId }),
      });
    }),
  );

  router.put(
    "/events/:eventId/rsvp",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return submitRsvp({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/rsvp`,
          "POST",
          (body) => ({
            ...(body ?? {}),
            eventId,
          }),
        ),
      });
    }),
  );

  router.put(
    "/events/:eventId/rsvp/anonymous",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return submitAnonymousRsvp({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/rsvp/anonymous`,
          "POST",
          (body) => ({
            ...(body ?? {}),
            eventId,
          }),
        ),
      });
    }),
  );

  router.delete(
    "/events/:eventId/rsvp/anonymous",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return cancelAnonymousRsvp({ request, eventId });
    }),
  );

  router.patch(
    "/events/:eventId/rsvps/:rsvpId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      const rsvpId = event.context.params?.rsvpId;
      if (!eventId || !rsvpId)
        return Response.json(
          { error: "eventId and rsvpId are required" },
          { status: 400 },
        );

      return manageRsvp({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/rsvps/${rsvpId}`,
          "PATCH",
          (body) => body ?? {},
        ),
        eventId,
        rsvpId,
      });
    }),
  );

  router.get(
    "/events/:eventId/favourite",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return getFavouriteStatus({
        request: forwardGet(request, `/api/events/${eventId}/favourite`, {
          eventId,
        }),
      });
    }),
  );

  router.post(
    "/events/:eventId/favourite",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return toggleFavourite({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/favourite`,
          "POST",
          (body) => ({
            ...body,
            eventId,
          }),
        ),
      });
    }),
  );

  router.get(
    "/events/:eventId/attendees",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return eventAttendees({
        request: forwardGet(request, `/api/events/${eventId}/attendees`, {
          eventId,
        }),
      });
    }),
  );

  router.get(
    "/events/:eventId/dashboard",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return eventDashboard({
        request: forwardGet(request, `/api/events/${eventId}/dashboard`, {
          eventId,
        }),
      });
    }),
  );

  router.get(
    "/events/:eventId/dashboard/activity",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return eventDashboardActivity({
        request: forwardGet(
          request,
          `/api/events/${eventId}/dashboard/activity`,
          { eventId },
        ),
      });
    }),
  );

  registerDiscussionRoutes(router);
  registerEventNoticeRoutes(router);

  router.post(
    "/events/:eventId/publish",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return publishEvent({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/publish`,
          "POST",
          (body) => ({
            ...(body ?? {}),
            eventId,
          }),
        ),
      });
    }),
  );

  router.delete(
    "/events/:eventId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return deleteEvent({
        request: forwardGet(request, `/api/events/${eventId}`, { eventId }),
      });
    }),
  );

  router.post(
    "/events/:eventId/header-image",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return uploadEventHeaderImage({
        request: await forwardFormData(
          request,
          `/api/events/${eventId}/header-image?eventId=${eventId}`,
          "POST",
          (formData) => formData,
        ),
      });
    }),
  );
}
