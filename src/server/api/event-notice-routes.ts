import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { POST as createEventNotice } from "~/server/controllers/events/notices/create";
import { GET as listEventNotices } from "~/server/controllers/events/notices/list";
import { forwardGet, forwardJson } from "~/server/api/forwarding";

export function registerEventNoticeRoutes(router: Router): void {
  router.post(
    "/events/:eventId/notices",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return createEventNotice({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/notices`,
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
    "/events/:eventId/notices",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return listEventNotices({
        request: forwardGet(request, `/api/events/${eventId}/notices`, {
          eventId,
        }),
      });
    }),
  );

  router.get(
    "/events/:eventId/notices/public",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return listEventNotices({
        request: forwardGet(request, `/api/events/${eventId}/notices/public`, {
          eventId,
          public: "1",
        }),
      });
    }),
  );
}
