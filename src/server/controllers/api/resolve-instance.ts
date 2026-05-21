import { env } from "~/server/env";
import { normalizeDomain, templateForSoftware } from "./resolve-instance-domain";

/**
 * Resolves a fediverse instance into a ready-to-open remote interaction URL
 * (remote follow / remote vote / remote reply).
 *
 * Unlike a per-account WebFinger lookup, the OStatus `subscribe` template is
 * instance-wide, so the caller only needs to supply an instance domain. When a
 * full `user@domain` handle is given we still use the canonical per-account
 * WebFinger template; otherwise we detect the server software via NodeInfo and
 * fall back to its known interaction URL pattern.
 */

interface WebFingerLink {
  rel?: string;
  template?: string;
  href?: string;
}

interface NodeInfoDoc {
  software?: { name?: string };
  metadata?: { nodeName?: string };
}

const FETCH_TIMEOUT_MS = 5000;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/jrd+json, application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Fetches `software.name` and `metadata.nodeName` (the instance title) via NodeInfo. */
async function fetchNodeInfo(
  domain: string,
): Promise<{ software: string | null; title: string | null }> {
  const index = await fetchJson<{ links?: WebFingerLink[] }>(
    `https://${domain}/.well-known/nodeinfo`,
  );
  const href =
    index?.links?.find((l) => l.rel?.endsWith("/2.1"))?.href ??
    index?.links?.find((l) => l.rel?.endsWith("/2.0"))?.href ??
    index?.links?.[0]?.href;
  if (!href) return { software: null, title: null };

  const doc = await fetchJson<NodeInfoDoc>(href);
  return {
    software: doc?.software?.name?.toLowerCase() ?? null,
    title: doc?.metadata?.nodeName ?? null,
  };
}

/** Canonical per-account lookup: returns the FEP-3b86 / OStatus subscribe template. */
async function fetchWebFingerTemplate(handle: string): Promise<string | null> {
  const match = handle.trim().replace(/^@/, "").match(/^([^@]+)@([^@]+)$/);
  if (!match) return null;
  const [, username, domain] = match;
  const wf = await fetchJson<{ links?: WebFingerLink[] }>(
    `https://${domain}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${username}@${domain}`)}`,
  );
  // Priority 1: FEP-3b86 Activity Intents. Priority 2: OStatus subscribe.
  return (
    wf?.links?.find((l) => l.rel === "https://w3id.org/fep/3b86/Object")
      ?.template ??
    wf?.links?.find((l) => l.rel === "http://ostatus.org/schema/1.0/subscribe")
      ?.template ??
    null
  );
}

export async function POST({ request }: { request: Request }) {
  const body = (await request.json().catch(() => null)) as {
    instance?: string;
    target?: { type?: "handle" | "url"; value?: string };
  } | null;

  const rawInstance = body?.instance;
  const target = body?.target;
  if (!rawInstance || typeof rawInstance !== "string") {
    return Response.json({ error: "An instance is required." }, { status: 400 });
  }
  if (!target?.value || (target.type !== "handle" && target.type !== "url")) {
    return Response.json({ error: "A valid target is required." }, { status: 400 });
  }

  const domain = normalizeDomain(rawInstance);
  if (!domain) {
    return Response.json(
      { error: "Enter a valid instance domain, e.g. mastodon.social" },
      { status: 400 },
    );
  }

  // The {uri} the remote instance will act on.
  const targetUri =
    target.type === "handle"
      ? `${target.value.replace(/^@/, "")}@${env.federationHandleDomain}`
      : target.value;

  try {
    const { software, title } = await fetchNodeInfo(domain);

    // Prefer the canonical WebFinger template when a full handle was supplied.
    let template: string | null = null;
    if (rawInstance.trim().replace(/^@/, "").includes("@")) {
      template = await fetchWebFingerTemplate(rawInstance);
    }
    template ??= templateForSoftware(software);

    const interactionUrl = template
      .replace("{domain}", domain)
      .replace("{uri}", encodeURIComponent(targetUri));

    return Response.json({
      domain,
      title: title ?? domain,
      software,
      interactionUrl,
    });
  } catch {
    return Response.json({ error: "Instance lookup failed." }, { status: 500 });
  }
}
