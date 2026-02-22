import { db } from "~/server/db/client";
import { actors } from "~/server/db/schema";
import { env } from "~/server/env";

type WebfingerLink = { rel?: string; type?: string; href?: string };

export async function resolveActorUrl(handle: string): Promise<string> {
  const baseHost = new URL(env.baseUrl).host;
  const [username, host] = handle.split("@");
  if (!host) {
    throw new Error("Handle must include host (e.g., alice@example.com)");
  }
  if (host === baseHost) {
    return `${env.baseUrl}/ap/${username}`;
  }

  const resource = `acct:${handle}`;
  const url = `https://${host}/.well-known/webfinger?resource=${encodeURIComponent(
    resource
  )}`;
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
  const response = await fetch(actorUrl, {
    headers: { Accept: "application/activity+json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch actor: ${response.status}`);
  }
  const data = (await response.json()) as { outbox?: string };
  if (!data.outbox) {
    throw new Error("Actor missing outbox");
  }
  return data.outbox;
}

type ActorProfile = {
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
};

/**
 * Resolve a fediverse handle, fetch the actor profile, and persist in the actors table.
 * Returns the upserted actor record.
 */
export async function persistRemoteActor(
  handle: string,
): Promise<typeof actors.$inferSelect> {
  const actorUrl = await resolveActorUrl(handle);

  const response = await fetch(actorUrl, {
    headers: { Accept: "application/activity+json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch actor profile: ${response.status}`);
  }
  const data = (await response.json()) as ActorProfile;

  if (!data.id) {
    throw new Error("Actor profile missing id");
  }

  const domain = new URL(data.id).hostname;

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
