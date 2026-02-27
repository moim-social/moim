/**
 * Convert a fediverse handle (alice@mastodon.social) to proxy format (alice.mastodon.social).
 */
export function toProxyHandle(fediverseHandle: string): string {
  const cleaned = fediverseHandle.startsWith("@")
    ? fediverseHandle.slice(1)
    : fediverseHandle;
  return cleaned.replace("@", ".");
}

/**
 * Check if a handle is in proxy Person format (contains dots).
 * Group handles only contain [a-z0-9_], so dots unambiguously identify proxy handles.
 */
export function isProxyHandle(handle: string): boolean {
  return handle.includes(".");
}
