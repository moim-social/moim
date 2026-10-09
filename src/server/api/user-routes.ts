import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import {
  GET as getUserSettings,
  PATCH as updateUserSettings,
} from "~/server/controllers/users/settings";
import { GET as getUserFavourites } from "~/server/controllers/users/favourites";
import { GET as getUserCalendarEvents } from "~/server/controllers/users/calendar-events";
import {
  POST as generateCalendarToken,
  DELETE as revokeCalendarToken,
} from "~/server/controllers/users/calendar-token";

export function registerUserRoutes(router: Router): void {
  router.get(
    "/users/settings",
    defineEventHandler(async (event) => {
      return getUserSettings({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/users/settings",
    defineEventHandler(async (event) => {
      return updateUserSettings({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/users/calendar-token",
    defineEventHandler(async (event) => {
      return generateCalendarToken({ request: toWebRequest(event) });
    }),
  );

  router.delete(
    "/users/calendar-token",
    defineEventHandler(async (event) => {
      return revokeCalendarToken({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/users/favourites",
    defineEventHandler(async (event) => {
      return getUserFavourites({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/users/calendar-events",
    defineEventHandler(async (event) => {
      return getUserCalendarEvents({ request: toWebRequest(event) });
    }),
  );
}
