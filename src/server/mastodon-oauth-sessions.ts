import { validateInstanceHostname } from "~/server/miauth-sessions";
import { env } from "~/server/env";

/**
 * In-memory stores for Mastodon OAuth:
 * 1. Per-instance OAuth app registrations (cached to avoid re-registering)
 * 2. Per-login-attempt OAuth sessions (keyed by CSRF `state` token)
 */

interface MastodonOAuthApp {
  clientId: string;
  clientSecret: string;
  instance: string;
  registeredAt: number;
}

interface MastodonOAuthSession {
  state: string;
  instance: string;
  clientId: string;
  clientSecret: string;
  createdAt: number;
  expiresAt: number;
  returnTo?: string;
}

const appCache = new Map<string, MastodonOAuthApp>();
const sessions = new Map<string, MastodonOAuthSession>();

const MAX_APP_CACHE_SIZE = 1000;

let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Register an OAuth app on a Mastodon instance, or return cached credentials.
 */
export async function getOrRegisterOAuthApp(instance: string): Promise<MastodonOAuthApp> {
  if (!validateInstanceHostname(instance)) {
    throw new Error("invalid_instance");
  }

  const cached = appCache.get(instance);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const redirectUri = `${env.baseUrl}/auth/mastodon/oauth-callback`;

  let res: Response;
  try {
    res = await fetch(`https://${instance}/api/v1/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Moim",
        redirect_uris: redirectUri,
        scopes: "read:accounts",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      throw new Error("instance_timeout");
    }
    throw new Error("instance_unreachable");
  }

  if (!res.ok) {
    throw new Error("app_registration_failed");
  }

  const data = await res.json() as {
    client_id?: string;
    client_secret?: string;
  };

  if (!data.client_id || !data.client_secret) {
    throw new Error("app_registration_failed");
  }

  const app: MastodonOAuthApp = {
    clientId: data.client_id,
    clientSecret: data.client_secret,
    instance,
    registeredAt: Date.now(),
  };

  // Evict oldest entry if cache is full
  if (appCache.size >= MAX_APP_CACHE_SIZE) {
    const oldest = appCache.keys().next().value;
    if (oldest) appCache.delete(oldest);
  }

  appCache.set(instance, app);
  return app;
}

/**
 * Evict a cached OAuth app for an instance (e.g. if token exchange fails with 401).
 */
export function evictOAuthApp(instance: string): void {
  appCache.delete(instance);
}

/**
 * Create and store an OAuth session keyed by the CSRF state token.
 */
export function createOAuthSession(
  state: string,
  instance: string,
  clientId: string,
  clientSecret: string,
  ttlSeconds: number,
  returnTo?: string,
): void {
  const now = Date.now();
  sessions.set(state, {
    state,
    instance,
    clientId,
    clientSecret,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    returnTo,
  });
}

/**
 * Verify an OAuth session exists and is not expired.
 * Returns the full session data (needed for token exchange).
 * Consumes the session to prevent replay.
 */
export function verifyAndConsumeOAuthSession(
  state: string,
): { valid: boolean; reason?: string; session?: MastodonOAuthSession } {
  const session = sessions.get(state);

  if (!session) {
    return { valid: false, reason: "session_not_found" };
  }

  const now = Date.now();
  if (now > session.expiresAt) {
    sessions.delete(state);
    return { valid: false, reason: "session_expired" };
  }

  sessions.delete(state);
  return { valid: true, session };
}

export function cleanupExpiredOAuthSessions(): void {
  const now = Date.now();
  let count = 0;
  for (const [state, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(state);
      count++;
    }
  }
  if (count > 0) {
    console.debug(`[Mastodon OAuth] Cleaned up ${count} expired sessions`);
  }
}

export function startOAuthCleanupInterval(): void {
  if (cleanupIntervalId !== null) return;
  cleanupIntervalId = setInterval(cleanupExpiredOAuthSessions, 60 * 1000);
}

export function stopOAuthCleanupInterval(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
