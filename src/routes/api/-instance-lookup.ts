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
  const { handle } = body as { handle: string };

  if (!handle || typeof handle !== "string") {
    return Response.json(
      { error: "Fediverse handle is required." },
      { status: 400 },
    );
  }

  const match = handle.trim().match(/^@?([^@]+)@([^@]+)$/);
  if (!match) {
    return Response.json(
      { error: "Invalid fediverse handle format." },
      { status: 400 },
    );
  }

  const [, username, domain] = match;
  const normalizedId = `${username}@${domain}`;

  try {
    const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${normalizedId}`)}`;
    const wfResponse = await fetch(webfingerUrl, {
      headers: { Accept: "application/jrd+json, application/json" },
    });

    if (!wfResponse.ok) {
      return Response.json(
        { error: `Instance lookup failed: ${wfResponse.status}` },
        { status: 404 },
      );
    }

    const wfData = (await wfResponse.json()) as WebFingerResponse;

    // Priority 1: FEP-3b86 Activity Intents
    const fep3b86Link = wfData.links?.find(
      (link) => link.rel === "https://w3id.org/fep/3b86/Object",
    );

    // Priority 2: OStatus subscribe template
    const subscribeLink = wfData.links?.find(
      (link) => link.rel === "http://ostatus.org/schema/1.0/subscribe",
    );

    const interactionTemplate =
      fep3b86Link?.template ??
      subscribeLink?.template ??
      `https://${domain}/search?query={uri}`;

    return Response.json({ domain, interactionTemplate });
  } catch {
    return Response.json(
      { error: "Instance lookup failed." },
      { status: 500 },
    );
  }
}
