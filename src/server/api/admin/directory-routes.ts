import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { GET as listUsers } from "~/server/controllers/admin/users/list";
import { GET as userDetail } from "~/server/controllers/admin/users/detail";
import {
  GET as listAdminGroups,
  PATCH as toggleGroupVerified,
} from "~/server/controllers/admin/groups";
import {
  GET as listAdminEvents,
  PATCH as updateAdminEvent,
} from "~/server/controllers/admin/events";
import { forwardGet, forwardJson } from "~/server/api/forwarding";

export function registerAdminDirectoryRoutes(router: Router): void {
  router.get(
    "/admin/users",
    defineEventHandler(async (event) => {
      return listUsers({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/admin/groups",
    defineEventHandler(async (event) => {
      return listAdminGroups({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/admin/groups",
    defineEventHandler(async (event) => {
      return toggleGroupVerified({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/admin/events",
    defineEventHandler(async (event) => {
      return listAdminEvents({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/admin/events/:eventId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const eventId = event.context.params?.eventId;
      if (!eventId)
        return Response.json({ error: "eventId is required" }, { status: 400 });

      return updateAdminEvent({
        request: await forwardJson(
          request,
          `/api/admin/events/${eventId}`,
          "PATCH",
          (body) => ({
            ...(body ?? {}),
            id: eventId,
          }),
        ),
      });
    }),
  );

  router.get(
    "/admin/users/:userId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const userId = event.context.params?.userId;
      return userDetail({
        request: forwardGet(request, `/api/admin/users/${userId}`, {
          id: userId,
        }),
      });
    }),
  );
}
