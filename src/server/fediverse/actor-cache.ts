import { eq } from "drizzle-orm";
import type {
  Application,
  Group,
  Organization,
  Person,
  Service,
} from "@fedify/fedify";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";

type FedifyActor = Application | Group | Organization | Person | Service;

/**
 * Ensure a remote actor exists in the actors table, given a Fedify Actor object
 * from an inbox activity. Uses actorUrl (AP id) as the cache key.
 *
 * Unlike persistRemoteActor() in resolve.ts (which resolves from a fediverse
 * handle via WebFinger), this works with already-resolved Fedify Actor objects
 * from inbox deliveries — no extra HTTP requests needed.
 */
export async function ensureRemoteActor(
  actor: FedifyActor,
): Promise<typeof actors.$inferSelect> {
  if (!actor.id) {
    throw new Error("Actor missing id");
  }

  // Check if already cached by actorUrl
  const [existing] = await db
    .select()
    .from(actors)
    .where(eq(actors.actorUrl, actor.id.href))
    .limit(1);

  if (existing) {
    return existing;
  }

  const username = actor.preferredUsername?.toString() ?? "unknown";
  const handle = `${username}@${actor.id.hostname}`;

  const [inserted] = await db
    .insert(actors)
    .values({
      handle,
      type: "Person",
      actorUrl: actor.id.href,
      iri: actor.id.href,
      url: actor.url instanceof URL ? actor.url.href : null,
      name: actor.name?.toString() ?? null,
      summary: actor.summary?.toString() ?? null,
      inboxUrl: actor.inboxId?.href ?? null,
      outboxUrl: actor.outboxId?.href ?? null,
      sharedInboxUrl:
        actor.endpoints?.sharedInbox instanceof URL
          ? actor.endpoints.sharedInbox.href
          : null,
      domain: actor.id.hostname,
      isLocal: false,
    })
    .returning();

  return inserted;
}
