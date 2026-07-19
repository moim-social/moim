import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import {
  GET as listAdminPlaceCategories,
  POST as createAdminPlaceCategory,
  PATCH as updateAdminPlaceCategory,
  PUT as importAdminPlaceCategories,
} from "~/server/controllers/admin/place-categories";
import {
  GET as listAdminEventCategories,
  POST as createAdminEventCategory,
  PATCH as updateAdminEventCategory,
  PUT as importAdminEventCategories,
} from "~/server/controllers/admin/event-categories";
import {
  GET as listAdminPlaces,
  PATCH as updateAdminPlace,
} from "~/server/controllers/admin/places";
import {
  GET as listAdminGroupPlaces,
  POST as assignGroupPlace,
  DELETE as unassignGroupPlace,
} from "~/server/controllers/admin/group-places";
import { POST as regeneratePlaceSnapshot } from "~/server/controllers/admin/place-snapshot";
import { POST as bulkRegeneratePlaceSnapshots } from "~/server/controllers/admin/place-snapshots-bulk";
import {
  GET as listCountries,
  PUT as importCountries,
  DELETE as clearCountries,
} from "~/server/controllers/admin/countries";
import { forwardJson } from "~/server/api/forwarding";

export function registerAdminCatalogRoutes(router: Router): void {
  router.get(
    "/admin/place-categories",
    defineEventHandler(async (event) => {
      return listAdminPlaceCategories({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/admin/place-categories",
    defineEventHandler(async (event) => {
      return createAdminPlaceCategory({ request: toWebRequest(event) });
    }),
  );

  router.put(
    "/admin/place-categories",
    defineEventHandler(async (event) => {
      return importAdminPlaceCategories({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/admin/place-categories/:categoryId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const categoryId = event.context.params?.categoryId;
      if (!categoryId)
        return Response.json(
          { error: "categoryId is required" },
          { status: 400 },
        );

      return updateAdminPlaceCategory({
        request: await forwardJson(
          request,
          `/api/admin/place-categories/${categoryId}`,
          "PATCH",
          (body) => ({
            ...(body ?? {}),
            categorySlug: categoryId,
          }),
        ),
      });
    }),
  );

  router.get(
    "/admin/event-categories",
    defineEventHandler(async (event) => {
      return listAdminEventCategories({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/admin/event-categories",
    defineEventHandler(async (event) => {
      return createAdminEventCategory({ request: toWebRequest(event) });
    }),
  );

  router.put(
    "/admin/event-categories",
    defineEventHandler(async (event) => {
      return importAdminEventCategories({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/admin/event-categories/:categorySlug",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const categorySlug = event.context.params?.categorySlug;
      if (!categorySlug)
        return Response.json(
          { error: "categorySlug is required" },
          { status: 400 },
        );

      return updateAdminEventCategory({
        request: await forwardJson(
          request,
          `/api/admin/event-categories/${categorySlug}`,
          "PATCH",
          (body) => ({
            ...(body ?? {}),
            categorySlug,
          }),
        ),
      });
    }),
  );

  router.get(
    "/admin/places",
    defineEventHandler(async (event) => {
      return listAdminPlaces({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/admin/places/:placeId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const placeId = event.context.params?.placeId;
      if (!placeId)
        return Response.json({ error: "placeId is required" }, { status: 400 });

      return updateAdminPlace({
        request: await forwardJson(
          request,
          `/api/admin/places/${placeId}`,
          "PATCH",
          (body) => ({
            ...(body ?? {}),
            id: placeId,
          }),
        ),
      });
    }),
  );

  router.post(
    "/admin/places/:placeId/regenerate-snapshot",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const placeId = event.context.params?.placeId;
      if (!placeId)
        return Response.json({ error: "placeId is required" }, { status: 400 });
      return regeneratePlaceSnapshot({
        request: await forwardJson(
          request,
          `/api/admin/places/${placeId}/regenerate-snapshot`,
          "POST",
          () => ({
            placeId,
          }),
        ),
      });
    }),
  );

  router.post(
    "/admin/places/regenerate-snapshots",
    defineEventHandler(async (event) => {
      return bulkRegeneratePlaceSnapshots({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/admin/group-places",
    defineEventHandler(async (event) => {
      return listAdminGroupPlaces({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/admin/group-places",
    defineEventHandler(async (event) => {
      return assignGroupPlace({ request: toWebRequest(event) });
    }),
  );

  router.delete(
    "/admin/group-places",
    defineEventHandler(async (event) => {
      return unassignGroupPlace({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/admin/countries",
    defineEventHandler(async (event) => {
      return listCountries({ request: toWebRequest(event) });
    }),
  );

  router.put(
    "/admin/countries",
    defineEventHandler(async (event) => {
      return importCountries({ request: toWebRequest(event) });
    }),
  );

  router.delete(
    "/admin/countries",
    defineEventHandler(async (event) => {
      return clearCountries({ request: toWebRequest(event) });
    }),
  );
}
