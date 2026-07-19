import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { GET as searchUsers } from "~/server/controllers/groups/search-users";
import { POST as resolveModerator } from "~/server/controllers/groups/resolve-moderator";
import { POST as createGroup } from "~/server/controllers/groups/create";
import { GET as myGroups } from "~/server/controllers/groups/my-groups";
import { GET as groupDetail } from "~/server/controllers/groups/detail";
import { POST as createGroupNote } from "~/server/controllers/groups/create-note";
import { POST as updateGroup } from "~/server/controllers/groups/update";
import { POST as uploadGroupAvatar } from "~/server/controllers/groups/upload-avatar";
import {
  GET as listGroupPlaces,
  PATCH as updateGroupPlace,
} from "~/server/controllers/groups/places";
import { forwardFormData, forwardGet, forwardJson } from "~/server/api/forwarding";
import { findGroupHandleById } from "~/server/repositories/actors";

// /users search and /actors/resolve are implemented by group-moderation
// controllers (controllers/groups/search-users, resolve-moderator) even
// though their URL paths read as user-domain — grouped here by controller
// domain rather than URL path.
export function registerGroupRoutes(router: Router): void {
  router.get(
    "/users",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const query = new URL(request.url).searchParams.get("query")?.trim();
      return searchUsers({
        request: forwardGet(request, "/api/users", {
          q: query,
          query: undefined,
        }),
      });
    }),
  );

  router.post(
    "/actors/resolve",
    defineEventHandler(async (event) => {
      return resolveModerator({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/groups",
    defineEventHandler(async (event) => {
      return createGroup({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/me/groups",
    defineEventHandler(async (event) => {
      return myGroups({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/groups/by-handle/:handle",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const handle = decodeURIComponent(event.context.params?.handle ?? "");
      return groupDetail({
        request: forwardGet(request, "/api/groups/by-handle", { handle }),
      });
    }),
  );

  router.patch(
    "/groups/:groupId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      if (!groupId) {
        return Response.json({ error: "groupId is required" }, { status: 400 });
      }

      const handle = await findGroupHandleById(groupId);
      if (!handle) {
        return Response.json({ error: "Group not found" }, { status: 404 });
      }

      return updateGroup({
        request: await forwardJson(
          request,
          `/api/groups/${groupId}`,
          "POST",
          (body) => ({
            ...body,
            handle,
          }),
        ),
      });
    }),
  );

  router.post(
    "/groups/:groupId/avatar",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      if (!groupId)
        return Response.json({ error: "groupId is required" }, { status: 400 });

      const handle = await findGroupHandleById(groupId);
      if (!handle)
        return Response.json({ error: "Group not found" }, { status: 404 });

      return uploadGroupAvatar({
        request: await forwardFormData(
          request,
          `/api/groups/${groupId}/avatar`,
          "POST",
          (formData) => {
            formData.set("handle", handle);
            return formData;
          },
        ),
      });
    }),
  );

  router.post(
    "/groups/:groupId/posts",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      if (!groupId)
        return Response.json({ error: "groupId is required" }, { status: 400 });

      const handle = await findGroupHandleById(groupId);
      if (!handle)
        return Response.json({ error: "Group not found" }, { status: 404 });

      return createGroupNote({
        request: await forwardJson(
          request,
          `/api/groups/${groupId}/posts`,
          "POST",
          (body) => ({
            groupHandle: handle,
            content: typeof body?.content === "string" ? body.content : "",
          }),
        ),
      });
    }),
  );

  router.get(
    "/groups/:groupId/places",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      if (!groupId)
        return Response.json({ error: "groupId is required" }, { status: 400 });
      return listGroupPlaces({
        request: forwardGet(request, `/api/groups/${groupId}/places`, {
          groupActorId: groupId,
        }),
      });
    }),
  );

  router.patch(
    "/groups/:groupId/places/:placeId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const groupId = event.context.params?.groupId;
      const placeId = event.context.params?.placeId;
      if (!groupId || !placeId)
        return Response.json(
          { error: "groupId and placeId are required" },
          { status: 400 },
        );
      return updateGroupPlace({
        request: await forwardJson(
          request,
          `/api/groups/${groupId}/places/${placeId}`,
          "PATCH",
          (body) => ({
            ...body,
            groupActorId: groupId,
            placeId,
          }),
        ),
      });
    }),
  );
}
