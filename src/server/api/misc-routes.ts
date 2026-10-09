import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { GET as listPublicCountries } from "~/server/controllers/countries/list";
import { GET as getCarouselSlides } from "~/server/controllers/carousel";
import { GET as getMapConfig } from "~/server/controllers/map-config/get";
import { POST as trackBannerClick } from "~/server/controllers/banner-click";
import { POST as webfingerLookup } from "~/server/controllers/api/webfinger";
import { POST as instanceLookup } from "~/server/controllers/api/instance-lookup";

export function registerMiscRoutes(router: Router): void {
  router.get(
    "/countries",
    defineEventHandler(async () => {
      return listPublicCountries();
    }),
  );

  router.get(
    "/home/carousel",
    defineEventHandler(async (event) => {
      return getCarouselSlides({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/map-config",
    defineEventHandler(async () => {
      return getMapConfig();
    }),
  );

  router.post(
    "/banner-clicks",
    defineEventHandler(async (event) => {
      return trackBannerClick({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/webfinger",
    defineEventHandler(async (event) => {
      return webfingerLookup({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/instance-lookup",
    defineEventHandler(async (event) => {
      return instanceLookup({ request: toWebRequest(event) });
    }),
  );
}
