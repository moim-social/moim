import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { GET as listDiscussions } from "~/server/controllers/events/discussions";
import { GET as discussionDetail } from "~/server/controllers/events/discussion-detail";
import { POST as discussionReply } from "~/server/controllers/events/discussion-reply";
import { PATCH as discussionUpdate } from "~/server/controllers/events/discussion-update";
import { GET as listDiscussionsPublic } from "~/server/controllers/events/discussions-public";
import { GET as discussionDetailPublic } from "~/server/controllers/events/discussion-detail-public";
import { forwardGet, forwardJson } from "~/server/api/forwarding";

export function registerDiscussionRoutes(router: Router): void {
  router.get(
    "/events/:eventId/discussions",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return listDiscussions({
        request: forwardGet(request, `/api/events/${eventId}/discussions`, {
          eventId,
        }),
      });
    }),
  );

  router.get(
    "/events/:eventId/discussions/public",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      return listDiscussionsPublic({
        request: forwardGet(
          request,
          `/api/events/${eventId}/discussions/public`,
          { eventId },
        ),
      });
    }),
  );

  router.get(
    "/events/:eventId/discussions/public/:inquiryId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      const inquiryId = event.context.params?.inquiryId;
      return discussionDetailPublic({
        request: forwardGet(
          request,
          `/api/events/${eventId}/discussions/public/${inquiryId}`,
          { eventId, inquiryId },
        ),
      });
    }),
  );

  router.get(
    "/events/:eventId/discussions/:inquiryId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      const inquiryId = event.context.params?.inquiryId;
      return discussionDetail({
        request: forwardGet(
          request,
          `/api/events/${eventId}/discussions/${inquiryId}`,
          { eventId, inquiryId },
        ),
      });
    }),
  );

  router.post(
    "/events/:eventId/discussions/:inquiryId/replies",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      const inquiryId = event.context.params?.inquiryId;
      if (!eventId || !inquiryId)
        return Response.json(
          { error: "eventId and inquiryId are required" },
          { status: 400 },
        );

      return discussionReply({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/discussions/${inquiryId}/replies`,
          "POST",
          (body) => ({
            ...(body ?? {}),
            eventId,
            inquiryId,
          }),
        ),
      });
    }),
  );

  router.patch(
    "/events/:eventId/discussions/:inquiryId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      const inquiryId = event.context.params?.inquiryId;
      if (!eventId || !inquiryId)
        return Response.json(
          { error: "eventId and inquiryId are required" },
          { status: 400 },
        );

      return discussionUpdate({
        request: await forwardJson(
          request,
          `/api/events/${eventId}/discussions/${inquiryId}`,
          "PATCH",
          (body) => ({
            ...(body ?? {}),
            eventId,
            inquiryId,
          }),
        ),
      });
    }),
  );
}
