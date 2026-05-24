/**
 * Pure helpers for resolving a fediverse instance into a remote interaction
 * URL. Kept dependency-free so it can be unit tested in isolation (mirrors the
 * `ticketing` / `ticketing-domain` split used elsewhere in the codebase).
 */

/** Known interaction URL patterns keyed by NodeInfo `software.name`. */
const SOFTWARE_TEMPLATES: Record<string, string> = {
  mastodon: "https://{domain}/authorize_interaction?uri={uri}",
  hometown: "https://{domain}/authorize_interaction?uri={uri}",
  gotosocial: "https://{domain}/authorize_interaction?uri={uri}",
  pleroma: "https://{domain}/ostatus_subscribe?acct={uri}",
  akkoma: "https://{domain}/ostatus_subscribe?acct={uri}",
  misskey: "https://{domain}/authorize-follow?acct={uri}",
  firefish: "https://{domain}/authorize-follow?acct={uri}",
  iceshrimp: "https://{domain}/authorize-follow?acct={uri}",
  sharkey: "https://{domain}/authorize-follow?acct={uri}",
  cherrypick: "https://{domain}/authorize-follow?acct={uri}",
};

/** Used when the software is unknown — Mastodon's pattern is the most common. */
const FALLBACK_TEMPLATE = "https://{domain}/authorize_interaction?uri={uri}";

/**
 * Normalizes user input (a bare domain, a `@user@domain` handle, or a URL) to a
 * lowercase domain. Returns `null` for inputs that fail a basic SSRF guard
 * (IP literals, localhost, non-public TLDs).
 */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  // Strip protocol and any path.
  value = value.replace(/^https?:\/\//, "").split("/")[0];
  // `@user@domain` or `user@domain` -> take the last segment.
  value = value.replace(/^@/, "");
  if (value.includes("@")) value = value.split("@").pop() ?? "";
  // Drop any port.
  value = value.split(":")[0];

  if (!value || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) return null;
  // Reject loopback / internal-only names.
  if (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local") ||
    value.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(value)
  ) {
    return null;
  }
  return value;
}

/** Picks the interaction URL template for a detected software name. */
export function templateForSoftware(software: string | null): string {
  if (!software) return FALLBACK_TEMPLATE;
  return SOFTWARE_TEMPLATES[software.toLowerCase()] ?? FALLBACK_TEMPLATE;
}
