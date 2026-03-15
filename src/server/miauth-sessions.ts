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
 * Module-scoped interval ID for the cleanup timer.
 * Stored so it can be cleared by stopCleanupInterval.
 */
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Check if an IP address is in a private or reserved range.
 * Prevents SSRF attacks by rejecting:
 * - IPv4: 0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, 224.0.0.0/4, 240.0.0.0/4
 * - IPv6: ::1 (loopback), fc00::/7 (unique local), fe80::/10 (link-local), :: (unspecified), ::ffff:.../96 (IPv4-mapped)
 */
function isPrivateOrReservedIP(ip: string): boolean {
  // IPv4 range checks
  if (isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (!parts.every((p) => !isNaN(p))) return true;

    // 0.0.0.0/8 - this network
    if (parts[0] === 0) return true;

    // 10.0.0.0/8 - private
    if (parts[0] === 10) return true;

    // 100.64.0.0/10 - shared address space
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;

    // 127.0.0.0/8 - loopback
    if (parts[0] === 127) return true;

    // 169.254.0.0/16 - link-local
    if (parts[0] === 169 && parts[1] === 254) return true;

    // 172.16.0.0/12 - private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16 - private
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 224.0.0.0/4 - multicast
    if (parts[0] >= 224 && parts[0] <= 239) return true;

    // 240.0.0.0/4 - reserved/future
    if (parts[0] >= 240 && parts[0] <= 255) return true;

    return false;
  }

  // IPv6 range checks
  if (isIPv6(ip)) {
    // :: - unspecified address
    if (ip === "::" || ip === "0:0:0:0:0:0:0:0") return true;

    // ::1 - loopback
    if (ip === "::1" || ip.toLowerCase() === "::1") return true;

    // ::ffff:x.x.x.x - IPv4-mapped IPv6 addresses (and variants)
    if (ip.toLowerCase().startsWith("::ffff:")) return true;

    // Expand and check fc00::/7 and fe80::/10
    try {
      const parts = ip.split(":");
      // Find the first non-empty part to avoid parse errors with leading ::
      const firstNonEmptyPart = parts.find((p) => p !== "");
      if (firstNonEmptyPart) {
        const val = parseInt(firstNonEmptyPart, 16);
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
 * - Invalid DNS names (leading/trailing dots, consecutive dots, invalid labels)
 * Allows only valid public hostnames and public IP addresses.
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

  // For hostnames: validate as valid DNS name
  // Reject leading/trailing dots or consecutive dots
  if (instance.startsWith(".") || instance.endsWith(".") || instance.includes("..")) {
    return false;
  }

  // Overall hostname length must not exceed 255 characters
  if (instance.length > 255) {
    return false;
  }

  // Split and validate each label
  const labels = instance.split(".");
  for (const label of labels) {
    // Label must be 1-63 characters
    if (label.length === 0 || label.length > 63) {
      return false;
    }
    // Label must start and end with alphanumeric, may contain hyphens in the middle
    // Pattern: [a-z0-9]([a-z0-9-]{0,61}[a-z0-9])? to allow single-char labels
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) {
      return false;
    }
  }

  return true;
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
 * Clean up expired sessions periodically.
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

/**
 * Start the cleanup interval for expired sessions.
 * Runs every 60 seconds and is idempotent (safe to call multiple times).
 */
export function startCleanupInterval(): void {
  if (cleanupIntervalId !== null) {
    console.debug("[MiAuth] Cleanup interval already started");
    return;
  }
  cleanupIntervalId = setInterval(cleanupExpiredSessions, 60 * 1000);
  console.debug("[MiAuth] Cleanup interval started");
}

/**
 * Stop the cleanup interval for expired sessions.
 * Safe to call even if the interval is not running.
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.debug("[MiAuth] Cleanup interval stopped");
  }
}
