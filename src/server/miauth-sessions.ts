/**
 * In-memory store for MiAuth session validation.
 * Each session is created during the start phase and must be verified during callback.
 */

interface MiAuthSession {
  sessionId: string;
  instance: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, MiAuthSession>();

/**
 * Create and store a MiAuth session.
 * Sessions expire after ttlSeconds.
 */
export function createMiAuthSession(sessionId: string, instance: string, ttlSeconds: number): void {
  const now = Date.now();
  sessions.set(sessionId, {
    sessionId,
    instance,
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  });
}

/**
 * Verify a MiAuth session exists, is not expired, and matches the expected instance.
 * If valid, the session is removed to prevent replay attacks.
 */
export function verifyAndConsumeMiAuthSession(
  sessionId: string,
  instance: string,
): { valid: boolean; reason?: string } {
  const session = sessions.get(sessionId);

  if (!session) {
    return { valid: false, reason: "session_not_found" };
  }

  const now = Date.now();
  if (now > session.expiresAt) {
    sessions.delete(sessionId);
    return { valid: false, reason: "session_expired" };
  }

  if (session.instance !== instance) {
    sessions.delete(sessionId);
    return { valid: false, reason: "instance_mismatch" };
  }

  // Consume the session to prevent replay
  sessions.delete(sessionId);
  return { valid: true };
}

/**
 * Clean up expired sessions periodically (called by startup, runs every minute).
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  let count = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
      count++;
    }
  }
  if (count > 0) {
    console.debug(`[MiAuth] Cleaned up ${count} expired sessions`);
  }
}

// Start cleanup interval when module is loaded
setInterval(cleanupExpiredSessions, 60 * 1000); // Run every 60 seconds
