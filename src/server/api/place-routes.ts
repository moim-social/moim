import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { GET as noteDetail } from "~/server/controllers/notes/detail";
import { GET as listPlaces } from "~/server/controllers/places/list";
import { GET as placeDetail } from "~/server/controllers/places/detail";
import { POST as checkinPlace } from "~/server/controllers/places/checkin";
import { GET as placeCheckins } from "~/server/controllers/places/checkins";
import { GET as nearbyPlaces } from "~/server/controllers/places/nearby";
import { GET as poiSearch } from "~/server/controllers/places/poi-search";
import { POST as findOrCreatePlace } from "~/server/controllers/places/find-or-create";
import { GET as listPlaceCategories } from "~/server/controllers/places/categories";
import { GET as listEventCategories } from "~/server/controllers/events/categories";
import { GET as placeEvents } from "~/server/controllers/places/events";
import { forwardGet } from "~/server/api/forwarding";

export function registerPlaceRoutes(router: Router): void {
  router.get(
    "/notes/:noteId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const noteId = event.context.params?.noteId;
      return noteDetail({
        request: forwardGet(request, `/api/notes/${noteId}`, { id: noteId }),
      });
    }),
  );

  router.get(
    "/places",
    defineEventHandler(async (event) => {
      return listPlaces({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/place-categories",
    defineEventHandler(async () => {
      return listPlaceCategories();
    }),
  );

  router.get(
    "/event-categories",
    defineEventHandler(async () => {
      return listEventCategories();
    }),
  );

  router.post(
    "/places",
    defineEventHandler(async (event) => {
      return findOrCreatePlace({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/places/nearby",
    defineEventHandler(async (event) => {
      return nearbyPlaces({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/places/poi-search",
    defineEventHandler(async (event) => {
      return poiSearch({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/places/:placeId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const placeId = event.context.params?.placeId;
      return placeDetail({
        request: forwardGet(request, `/api/places/${placeId}`, { id: placeId }),
      });
    }),
  );

  router.get(
    "/places/:placeId/events",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const placeId = event.context.params?.placeId;
      return placeEvents({
        request: forwardGet(request, `/api/places/${placeId}/events`, {
          placeId,
        }),
      });
    }),
  );

  router.get(
    "/check-ins",
    defineEventHandler(async (event) => {
      return placeCheckins({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/check-ins",
    defineEventHandler(async (event) => {
      return checkinPlace({ request: toWebRequest(event) });
    }),
  );
}
