import { defineEventHandler, toWebRequest } from "h3";
import type { App, Router } from "h3";
import { POST as requestOtp } from "~/server/controllers/auth/request-otp";
import { POST as verifyOtp } from "~/server/controllers/auth/verify-otp";
import { GET as getMe } from "~/server/controllers/auth/me";
import { POST as signout } from "~/server/controllers/auth/signout";
import {
  GET as listLinkedAccounts,
  DELETE as unlinkAccount,
} from "~/server/controllers/auth/linked-accounts";
import { POST as linkAccount } from "~/server/controllers/auth/link-account";
import { PATCH as setPrimaryAccount } from "~/server/controllers/auth/set-primary";
import { POST as mergeAccount } from "~/server/controllers/auth/merge-account";
import { POST as otpCheck } from "~/server/controllers/auth/otp-check";
import { POST as miauthStart } from "~/server/controllers/auth/misskey/miauth-start";
import { GET as miauthCallback } from "~/server/controllers/auth/misskey/miauth-callback";
import { POST as miauthCallbackApi } from "~/server/controllers/auth/misskey/miauth-callback-api";
import { POST as mastodonOAuthStart } from "~/server/controllers/auth/mastodon/oauth-start";
import { GET as mastodonOAuthCallback } from "~/server/controllers/auth/mastodon/oauth-callback";
import { POST as mastodonOAuthCallbackApi } from "~/server/controllers/auth/mastodon/oauth-callback-api";
import { POST as hackerspubGraphqlStart } from "~/server/controllers/auth/hackerspub/graphql-start";
import { GET as hackerspubGraphqlCallback } from "~/server/controllers/auth/hackerspub/graphql-callback";
import { POST as hackerspubGraphqlCallbackApi } from "~/server/controllers/auth/hackerspub/graphql-callback-api";
import { POST as ticketPaymentCallback } from "~/server/controllers/ticket-payments/callback";

export function registerAuthRoutes(router: Router): void {
  router.post(
    "/auth/otp-requests",
    defineEventHandler(async (event) => {
      return requestOtp({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/otp-verifications",
    defineEventHandler(async (event) => {
      return verifyOtp({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/otp-check",
    defineEventHandler(async (event) => {
      return otpCheck({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/misskey/miauth-start",
    defineEventHandler(async (event) => {
      return miauthStart({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/misskey/miauth-callback",
    defineEventHandler(async (event) => {
      return miauthCallbackApi({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/mastodon/oauth-start",
    defineEventHandler(async (event) => {
      return mastodonOAuthStart({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/mastodon/oauth-callback",
    defineEventHandler(async (event) => {
      return mastodonOAuthCallbackApi({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/hackerspub/graphql-start",
    defineEventHandler(async (event) => {
      return hackerspubGraphqlStart({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/hackerspub/graphql-callback",
    defineEventHandler(async (event) => {
      return hackerspubGraphqlCallbackApi({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/ticket-payment-callbacks",
    defineEventHandler(async (event) => {
      return ticketPaymentCallback({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/session",
    defineEventHandler(async (event) => {
      return getMe({ request: toWebRequest(event) });
    }),
  );

  router.delete(
    "/session",
    defineEventHandler(async (event) => {
      return signout({ request: toWebRequest(event) });
    }),
  );

  router.get(
    "/auth/linked-accounts",
    defineEventHandler(async (event) => {
      return listLinkedAccounts({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/link-account",
    defineEventHandler(async (event) => {
      return linkAccount({ request: toWebRequest(event) });
    }),
  );

  router.patch(
    "/auth/primary-account",
    defineEventHandler(async (event) => {
      return setPrimaryAccount({ request: toWebRequest(event) });
    }),
  );

  router.delete(
    "/auth/linked-accounts",
    defineEventHandler(async (event) => {
      return unlinkAccount({ request: toWebRequest(event) });
    }),
  );

  router.post(
    "/auth/merge-account",
    defineEventHandler(async (event) => {
      return mergeAccount({ request: toWebRequest(event) });
    }),
  );
}

// Browser-visited OAuth/MiAuth provider redirect targets. These live outside
// /api because their URL shape is fixed by the external provider's redirect
// URI, not our routing convention.
export function registerAuthCallbackRoutes(app: App): void {
  app.use(
    "/auth/misskey/miauth-callback",
    defineEventHandler(async (event) => {
      return miauthCallback({ request: toWebRequest(event) });
    }),
  );

  app.use(
    "/auth/mastodon/oauth-callback",
    defineEventHandler(async (event) => {
      return mastodonOAuthCallback({ request: toWebRequest(event) });
    }),
  );

  app.use(
    "/auth/hackerspub/callback",
    defineEventHandler(async (event) => {
      return hackerspubGraphqlCallback({ request: toWebRequest(event) });
    }),
  );
}
