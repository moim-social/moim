import { createApp, toWebHandler, useBase } from "h3";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { onError } from "@fedify/h3";

import { createFederationMiddleware } from "~/server/federation-middleware";
import { createSecurityHeadersMiddleware } from "~/server/security-headers";
import { startBackgroundJobs } from "~/server/background-jobs";
import { createApiRouter } from "~/server/api/router";
import { registerAuthCallbackRoutes } from "~/server/api/auth-routes";
import { registerMediaRoutes } from "~/server/media-routes";
import { createContentNegotiationHandler } from "~/server/content-negotiation-router";

const startFetch = createStartHandler(defaultStreamHandler);

const app = createApp({ onError });

app.use(createFederationMiddleware());
app.use(createSecurityHeadersMiddleware());

startBackgroundJobs();

app.use("/api", useBase("/api", createApiRouter().handler));
registerAuthCallbackRoutes(app);
registerMediaRoutes(app);

// Must stay last: matches every remaining path and falls through to TanStack.
app.use(createContentNegotiationHandler(startFetch));

const handler = toWebHandler(app);

export default {
  async fetch(request: Request) {
    return handler(request);
  },
};
