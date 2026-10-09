/**
 * LogTape configuration. Fedify emits all of its federation logs through
 * LogTape, and without a sink configured they are silently dropped.
 *
 * Set FEDIFY_LOG_LEVEL=debug to see full activity payloads for inbox/outbox
 * traffic and signature verification details. Useful categories:
 *   fedify.federation.inbox   — received activities, listener dispatch
 *   fedify.federation.outbox  — sendActivity, delivery attempts/failures
 *   fedify.federation.actor   — actor dispatcher
 *   fedify.sig.http           — HTTP Signature verification
 *   fedify.runtime.docloader  — remote document fetches
 */
import { AsyncLocalStorage } from "node:async_hooks";
import {
  configureSync,
  getConsoleSink,
  getTextFormatter,
  isLogLevel,
  type LogLevel,
} from "@logtape/logtape";
import { env } from "~/server/env";

function resolveLevel(raw: string | undefined, fallback: LogLevel): LogLevel {
  const value = raw?.trim().toLowerCase();
  return value && isLogLevel(value) ? value : fallback;
}

const fedifyLevel = resolveLevel(env.fedifyLogLevel, "info");

configureSync({
  // Fedify attaches per-request context (activity id, recipient, ...) via
  // withContext(); LogTape needs an AsyncLocalStorage to carry it.
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: {
    console: getConsoleSink({
      formatter: getTextFormatter({
        timestamp: "time",
        category: ".",
      }),
    }),
  },
  loggers: [
    { category: "fedify", lowestLevel: fedifyLevel, sinks: ["console"] },
    // Fedify logs a 404 warning for every non-federation path it hands back
    // to TanStack (i.e. every page view). Keep only real errors from it,
    // except in debug/trace where seeing every request path is the point.
    {
      category: ["fedify", "federation", "http"],
      lowestLevel:
        fedifyLevel === "debug" || fedifyLevel === "trace" ? fedifyLevel : "error",
    },
    { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
  ],
});
