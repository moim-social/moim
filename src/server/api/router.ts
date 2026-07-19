import { createRouter } from "h3";
import type { Router } from "h3";
import { registerAuthRoutes } from "~/server/api/auth-routes";
import { registerUserRoutes } from "~/server/api/user-routes";
import { registerGroupRoutes } from "~/server/api/group-routes";
import { registerEventRoutes } from "~/server/api/event-routes";
import { registerPollRoutes } from "~/server/api/poll-routes";
import { registerPlaceRoutes } from "~/server/api/place-routes";
import { registerAdminRoutes } from "~/server/api/admin/router";
import { registerMiscRoutes } from "~/server/api/misc-routes";

export function createApiRouter(): Router {
  const router = createRouter();
  registerAuthRoutes(router);
  registerUserRoutes(router);
  registerGroupRoutes(router);
  registerEventRoutes(router);
  registerPollRoutes(router);
  registerPlaceRoutes(router);
  registerAdminRoutes(router);
  registerMiscRoutes(router);
  return router;
}
