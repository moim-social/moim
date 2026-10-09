import { defineEventHandler, toWebRequest } from "h3";
import type { App } from "h3";
import { GET as serveMap } from "~/server/controllers/maps/serve";
import { GET as serveAvatar } from "~/server/controllers/avatars/serve";
import { GET as serveBanner } from "~/server/controllers/banners/serve";
import { GET as serveEventHeader } from "~/server/controllers/event-headers/serve";

export function registerMediaRoutes(app: App): void {
  app.use(
    "/maps",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      return serveMap({ request });
    }),
  );

  app.use(
    "/avatars",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      return serveAvatar({ request });
    }),
  );

  app.use(
    "/banners",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      return serveBanner({ request });
    }),
  );

  app.use(
    "/event-headers",
    defineEventHandler(async (event) => {
      const request = toWebRequest(event);
      return serveEventHeader({ request });
    }),
  );
}
