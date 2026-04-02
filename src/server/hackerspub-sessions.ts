/**
 * In-memory store for HackersPub GraphQL auth sessions.
 * Each session is created during the start phase and consumed during callback.
 */

import { validateInstanceHostname } from "./miauth-sessions";

export { validateInstanceHostname };

interface HackersPubSession {
  state: string;
  instance: string;
  username: string;
  createdAt: number;
  expiresAt: number;
  returnTo?: string;
}

const sessions = new Map<string, HackersPubSession>();

let cleanupIntervalId: NodeJS.Timeout | null = null;

export function createHackersPubSession(
  state: string,
  instance: string,
  username: string,
  ttlSeconds: number,
  returnTo?: string,
): void {
  const now = Date.now();
  sessions.set(state, {
    state,
    instance,
    username,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
    returnTo,
  });
}

export function verifyAndConsumeHackersPubSession(
  state: string,
): { instance: string; username: string; returnTo?: string } | null {
  const session = sessions.get(state);
  if (!session) return null;

  // Always consume — prevents replay
  sessions.delete(state);

  // Check expiration
  if (Date.now() > session.expiresAt) return null;

  return { instance: session.instance, username: session.username, returnTo: session.returnTo };
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(key);
    }
  }
}

export function startHackersPubCleanupInterval(): void {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(cleanupExpiredSessions, 60_000);
}

export function stopHackersPubCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
