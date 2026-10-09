import { defineEventHandler, toWebRequest } from "h3";
import type { Router } from "h3";
import { POST as uploadBannerImage } from "~/server/controllers/admin/banner-upload";
import {
  GET as listBanners,
  POST as createBanner,
  PUT as updateBanner,
  DELETE as deleteBanner,
} from "~/server/controllers/admin/banners";
import { forwardGet, forwardJson } from "~/server/api/forwarding";

export function registerAdminBannerRoutes(router: Router): void {
  router.post(
    "/admin/banners/assets",
    defineEventHandler(async (event) => {
      return uploadBannerImage({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/admin/banners",
    defineEventHandler(async (event) => {
      return listBanners({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/admin/banners",
    defineEventHandler(async (event) => {
      return createBanner({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/admin/banners/:bannerId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const bannerId = event.context.params?.bannerId;
      if (!bannerId)
        return Response.json({ error: "bannerId is required" }, { status: 400 });

      return updateBanner({
        request: await forwardJson(
          request,
          `/api/admin/banners/${bannerId}`,
          "PUT",
          (body) => ({
            ...body,
            id: bannerId,
          }),
        ),
      });
    }),
  );

  router.delete(
    "/admin/banners/:bannerId",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      const bannerId = event.context.params?.bannerId;
      return deleteBanner({
        request: forwardGet(request, `/api/admin/banners/${bannerId}`, {
          id: bannerId,
        }),
      });
    }),
  );
}
