import { randomUUID } from "crypto";
import { env } from "~/server/env";
import {
  createHackersPubSession,
  validateInstanceHostname,
} from "~/server/hackerspub-sessions";

export const POST = async ({ request }: { request: Request }) => {
  const body = (await request.json().catch(() => null)) as {
    instance?: string;
    username?: string;
  } | null;

  if (!body?.instance) {
    return Response.json({ error: "instance is required" }, { status: 400 });
  }
  if (!body?.username) {
    return Response.json({ error: "username is required" }, { status: 400 });
  }

  const instance = body.instance
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const username = body.username.trim();

  if (!validateInstanceHostname(instance)) {
    return Response.json({ error: "invalid_instance" }, { status: 400 });
  }

  const state = randomUUID();

  // Store session for callback verification
  const ttlSecondsEnv = parseInt(
    process.env.HACKERSPUB_SESSION_TTL_SECONDS ?? "600",
    10,
  );
  const ttlSeconds =
    isFinite(ttlSecondsEnv) && ttlSecondsEnv > 0 ? ttlSecondsEnv : 600; // 10 min default (email delivery can be slow)
  createHackersPubSession(state, instance, username, ttlSeconds);

  // Build verifyUrl template — HackersPub will substitute {token} and {code}
  const callbackBase = `${env.baseUrl}/auth/hackerspub/callback`;
  const verifyUrl = `${callbackBase}?token={token}&code={code}&state=${encodeURIComponent(state)}`;

  // Call HackersPub GraphQL loginByUsername mutation
  const graphqlUrl = `https://${instance}/graphql`;
  try {
    const res = await fetch(graphqlUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          mutation LoginByUsername($username: String!, $locale: Locale!, $verifyUrl: URITemplate!) {
            loginByUsername(username: $username, locale: $locale, verifyUrl: $verifyUrl) {
              ... on LoginChallenge {
                __typename
                token
              }
              ... on AccountNotFoundError {
                __typename
                query
              }
            }
          }
        `,
        variables: {
          username,
          locale: "en",
          verifyUrl,
        },
      }),
    });

    if (!res.ok) {
      return Response.json(
        { error: "graphql_request_failed" },
        { status: 502 },
      );
    }

    const data = await res.json();
    const result = data?.data?.loginByUsername;

    if (!result) {
      const gqlError = data?.errors?.[0]?.message ?? "unknown GraphQL error";
      return Response.json({ error: gqlError }, { status: 400 });
    }

    if (result.__typename === "AccountNotFoundError") {
      return Response.json(
        { error: "account_not_found", message: `Account not found: ${result.query}` },
        { status: 404 },
      );
    }

    // LoginChallenge returned — email has been sent
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "network_error" }, { status: 502 });
  }
};
