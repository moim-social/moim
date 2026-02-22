import { isActor } from "@fedify/fedify";
import { getFederationContext } from "~/server/fediverse/federation";
import { env } from "~/server/env";

interface WebFingerLink {
  rel?: string;
  type?: string;
  href?: string;
  template?: string;
}

interface WebFingerResponse {
  links?: WebFingerLink[];
}

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const { fediverseId, actorHandle } = body as {
    fediverseId: string;
    actorHandle: string;
  };

  if (!fediverseId || typeof fediverseId !== "string") {
    return Response.json({ error: "Fediverse handle is required." }, { status: 400 });
  }

  const match = fediverseId.trim().match(/^@?([^@]+)@([^@]+)$/);
  if (!match) {
    return Response.json({ error: "Invalid fediverse handle format." }, { status: 400 });
  }

  const [, username, domain] = match;
  const normalizedId = `${username}@${domain}`;

  try {
    // WebFinger lookup on the remote instance
    const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${normalizedId}`)}`;
    const wfResponse = await fetch(webfingerUrl, {
      headers: { Accept: "application/jrd+json, application/json" },
    });
    if (!wfResponse.ok) {
      return Response.json({ error: `WebFinger lookup failed: ${wfResponse.status}` }, { status: 404 });
    }

    const wfData = (await wfResponse.json()) as WebFingerResponse;

    // Find the ActivityPub self link
    const apLink = wfData.links?.find(
      (link) => link.rel === "self" && link.type === "application/activity+json",
    );

    // Find the subscribe template
    const subscribeLink = wfData.links?.find(
      (link) => link.rel === "http://ostatus.org/schema/1.0/subscribe",
    );

    // Build remote follow URL using the subscribe template
    const fullActorHandle = `${actorHandle}@${env.federationHandleDomain}`;
    const remoteFollowUrl = subscribeLink?.template?.replace(
      "{uri}",
      encodeURIComponent(fullActorHandle),
    );

    // Try to fetch actor profile for display info
    let actorInfo: {
      name?: string;
      handle: string;
      icon?: string;
      summary?: string;
      remoteFollowUrl?: string;
    } = {
      handle: normalizedId,
      remoteFollowUrl,
    };

    if (apLink?.href) {
      try {
        const ctx = getFederationContext();
        const actorObject = await ctx.lookupObject(apLink.href);

        if (actorObject && isActor(actorObject)) {
          const icon = await actorObject.getIcon();
          let iconUrl: string | undefined;
          if (icon?.url) {
            iconUrl = icon.url instanceof URL ? icon.url.href : icon.url?.href?.href;
          }
          if (!iconUrl && actorObject.iconId) {
            iconUrl = actorObject.iconId.href;
          }

          actorInfo = {
            name: actorObject.name?.toString(),
            handle: normalizedId,
            icon: iconUrl,
            summary: actorObject.summary?.toString(),
            remoteFollowUrl,
          };
        }
      } catch {
        // Fallback: use basic info from WebFinger
      }
    }

    return Response.json({ actor: actorInfo });
  } catch {
    return Response.json({ error: "WebFinger lookup failed." }, { status: 500 });
  }
}
