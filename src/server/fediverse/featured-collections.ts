/**
 * FEP-7aa9 (Featured Collections) support — consumer side only.
 *
 * Moim lets remote curators (e.g. Mastodon "Collections") feature local
 * Group actors. This is intentionally stateless: the approval stamp
 * (`FeatureAuthorization`) encodes the collection URI in its own URL, so
 * no table is needed. A stamp is valid as long as the Group still exists
 * and its policy still allows the curator.
 */
import { InteractionPolicy, InteractionRule, PUBLIC_COLLECTION } from "@fedify/vocab";
import type { Context } from "@fedify/fedify";

/** Path segment: base64url of the collection URI (URL-safe, no padding). */
export function encodeCollectionUri(collection: URL): string {
  return Buffer.from(collection.href, "utf8").toString("base64url");
}

export function decodeCollectionUri(segment: string): URL | null {
  try {
    const href = Buffer.from(segment, "base64url").toString("utf8");
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Who may feature this Group. Mirrors Mastodon's own rule:
 * locked (manually approves followers) → followers only; otherwise anyone.
 */
export function buildFeaturePolicy(
  ctx: Context<void>,
  identifier: string,
  manuallyApprovesFollowers: boolean,
): InteractionPolicy {
  const allowed = manuallyApprovesFollowers
    ? ctx.getFollowersUri(identifier)
    : PUBLIC_COLLECTION;
  return new InteractionPolicy({
    canFeature: new InteractionRule({ automaticApprovals: [allowed] }),
  });
}
