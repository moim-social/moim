import { isIP, isIPv4, isIPv6 } from "net";

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
 * Check if an IP address is in a private or reserved range.
 * Prevents SSRF attacks by rejecting:
 * - IPv4: 127.0.0.0/8 (loopback), 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (private), 169.254.0.0/16 (link-local)
 * - IPv6: ::1 (loopback), fc00::/7 (unique local), fe80::/10 (link-local)
 */
function isPrivateOrReservedIP(ip: string): boolean {
  // IPv4 range checks
  if (isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (!parts.every((p) => !isNaN(p))) return true;

    // 127.0.0.0/8 - loopback
    if (parts[0] === 127) return true;

    // 10.0.0.0/8 - private
    if (parts[0] === 10) return true;

    // 172.16.0.0/12 - private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16 - private
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 169.254.0.0/16 - link-local
    if (parts[0] === 169 && parts[1] === 254) return true;

    return false;
  }

  // IPv6 range checks
  if (isIPv6(ip)) {
    // ::1 - loopback
    if (ip === "::1" || ip.toLowerCase() === "::1") return true;

    // Expand and check fc00::/7 and fe80::/10
    try {
      const firstGroup = ip.split(":")[0];
      if (firstGroup) {
        const val = parseInt(firstGroup, 16);
        // fc00::/7 - unique local addresses
        if (val >= 0xfc00 && val <= 0xfdff) return true;
        // fe80::/10 - link-local
        if (val >= 0xfe80 && val <= 0xfebf) return true;
      }
    } catch {
      // If parsing fails, be conservative and reject
      return true;
    }

    return false;
  }

  return false;
}

/**
 * Validate instance hostname to prevent SSRF attacks.
 * Rejects:
 * - Loopback/localhost hostnames
 * - IP addresses in private/reserved ranges
 * Allows only public hostnames and public IP addresses.
 */
export function validateInstanceHostname(instance: string): boolean {
  // Reject localhost variations
  if (/^localhost(\.?.*)?$/i.test(instance)) {
    return false;
  }

  // Check if it's an IP address
  const ipType = isIP(instance);
  if (ipType !== 0) {
    // It's an IP (IPv4 or IPv6), check if it's in private/reserved ranges
    return !isPrivateOrReservedIP(instance);
  }

  // For hostnames: basic validation (no spaces, slashes, special chars)
  return /^[a-z0-9.-]+$/i.test(instance) && !instance.includes("//") && !instance.includes("@");
}

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
