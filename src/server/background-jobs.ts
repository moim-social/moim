import { startCleanupInterval as startMiauthCleanup } from "~/server/miauth-sessions";
import { startOAuthCleanupInterval as startMastodonOAuthCleanup } from "~/server/mastodon-oauth-sessions";
import { startHackersPubCleanupInterval as startHackersPubCleanup } from "~/server/hackerspub-sessions";
import { startGdprCleanupInterval as startEventGdprCleanup } from "~/server/events/gdpr-cleanup";

export function startBackgroundJobs(): void {
  startMiauthCleanup();
  startMastodonOAuthCleanup();
  startHackersPubCleanup();
  startEventGdprCleanup();
}
