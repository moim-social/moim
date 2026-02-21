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
