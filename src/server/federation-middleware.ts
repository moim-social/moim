import { integrateFederation } from "@fedify/h3";
import type { EventHandler } from "h3";
import { federation } from "~/server/fediverse/federation";

export function createFederationMiddleware(): EventHandler {
  return integrateFederation(federation, () => undefined);
}
