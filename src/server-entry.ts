// Install the global `Temporal` first: server code uses it as a global and Fedify 2.4 uses
// the same temporal-polyfill implementation, so vocab objects and our values interoperate.
import "temporal-polyfill/global";

// Must run before any module that logs through LogTape (Fedify).
import "~/server/logging";

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
