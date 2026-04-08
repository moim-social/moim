import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { env } from "~/server/env";
import { getFederationContext } from "./federation";

type WebfingerLink = { rel?: string; type?: string; href?: string };

/**
 * Get a signed document loader using the instance actor's keys.
 * This ensures outgoing requests carry HTTP signatures, required by
 * remote servers with authorized fetch enabled.
 */
async function getSignedLoader() {
  const ctx = getFederationContext();
  const instanceHost = new URL(env.federationOrigin ?? env.baseUrl).hostname;
  return await ctx.getDocumentLoader({ identifier: instanceHost });
}

export async function resolveActorUrl(handle: string): Promise<string> {
  const baseHost = new URL(env.baseUrl).host;
  const [username, host] = handle.split("@");
  if (!host) {
    throw new Error("Handle must include host (e.g., alice@example.com)");
  }
  if (host === baseHost) {
    return `${env.baseUrl}/ap/actors/${username}`;
  }

  const resource = `acct:${handle}`;
  const url = `https://${host}/.well-known/webfinger?resource=${encodeURIComponent(
    resource
  )}`;
  // WebFinger is a public endpoint; unsigned fetch is fine here
  const response = await fetch(url, { headers: { Accept: "application/jrd+json" } });
  if (!response.ok) {
    throw new Error(`Webfinger lookup failed: ${response.status}`);
  }
  const data = (await response.json()) as { links?: WebfingerLink[] };
  const actorLink = data.links?.find(
    (link) => link.rel === "self" && link.type === "application/activity+json"
  );
  if (!actorLink?.href) {
    throw new Error("No ActivityPub actor link in webfinger response");
  }
  return actorLink.href;
}

export async function resolveOutboxUrl(actorUrl: string): Promise<string> {
  const loader = await getSignedLoader();
  const { document } = await loader(actorUrl);
  const data = document as { outbox?: string };
  if (!data.outbox) {
    throw new Error("Actor missing outbox");
  }
  return data.outbox;
}

export type ActorProfile = {
  id: string;
  type?: string;
  preferredUsername?: string;
  name?: string;
  summary?: string;
  url?: string;
  inbox?: string;
  outbox?: string;
  followers?: string;
  following?: string;
  endpoints?: { sharedInbox?: string };
  manuallyApprovesFollowers?: boolean;
  icon?: { type?: string; url?: string } | string;
};

/**
 * Fetch a remote actor profile using signed HTTP requests.
 */
export async function fetchActorProfile(actorUrl: string): Promise<ActorProfile> {
  const loader = await getSignedLoader();
  const { document } = await loader(actorUrl);
  return document as ActorProfile;
}

/**
 * Resolve a fediverse handle, fetch the actor profile, and persist in the actors table.
 * Returns the upserted actor record.
 */
export async function persistRemoteActor(
  handle: string,
): Promise<typeof actors.$inferSelect> {
  const actorUrl = await resolveActorUrl(handle);
  const data = await fetchActorProfile(actorUrl);

  if (!data.id) {
    throw new Error("Actor profile missing id");
  }

  const domain = new URL(data.id).hostname;
  const avatarUrl = typeof data.icon === "string"
    ? data.icon
    : data.icon?.url ?? null;

  const [actor] = await db
    .insert(actors)
    .values({
      handle,
      type: data.type ?? "Person",
      actorUrl: data.id,
      iri: data.id,
      url: data.url ?? null,
      name: data.name ?? null,
      summary: data.summary ?? null,
      avatarUrl,
      inboxUrl: data.inbox ?? null,
      outboxUrl: data.outbox ?? null,
      sharedInboxUrl: data.endpoints?.sharedInbox ?? null,
      followersUrl: data.followers ?? null,
      followingUrl: data.following ?? null,
      domain,
      isLocal: false,
      manuallyApprovesFollowers: data.manuallyApprovesFollowers ?? false,
      raw: data,
      lastFetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: actors.handle,
      set: {
        actorUrl: data.id,
        iri: data.id,
        url: data.url ?? null,
        name: data.name ?? null,
        summary: data.summary ?? null,
        avatarUrl,
        inboxUrl: data.inbox ?? null,
        outboxUrl: data.outbox ?? null,
        sharedInboxUrl: data.endpoints?.sharedInbox ?? null,
        followersUrl: data.followers ?? null,
        followingUrl: data.following ?? null,
        domain,
        manuallyApprovesFollowers: data.manuallyApprovesFollowers ?? false,
        raw: data,
        lastFetchedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return actor;
}

/**
 * Ensure a remote actor exists in the actors table with an inboxUrl.
 * Returns the existing record if found, otherwise resolves and persists.
 */
export async function ensurePersistedRemoteActor(
  handle: string,
): Promise<typeof actors.$inferSelect> {
  const [existing] = await db
    .select()
    .from(actors)
    .where(
      and(
        eq(actors.handle, handle),
        eq(actors.isLocal, false),
        isNotNull(actors.inboxUrl),
      ),
    )
    .limit(1);

  if (existing) return existing;

  return persistRemoteActor(handle);
}
