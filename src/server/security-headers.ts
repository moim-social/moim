import { defineEventHandler, setResponseHeader } from "h3";
import type { EventHandler } from "h3";
import { env } from "~/server/env";

export function createSecurityHeadersMiddleware(): EventHandler {
  const mapProviderScriptSrc =
    env.mapProvider === "kakao"
      ? " https://dapi.kakao.com https://t1.daumcdn.net"
      : "";

  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://us-assets.i.posthog.com${mapProviderScriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://unpkg.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return defineEventHandler((event) => {
    setResponseHeader(event, "X-Frame-Options", "SAMEORIGIN");
    setResponseHeader(event, "X-Content-Type-Options", "nosniff");
    setResponseHeader(
      event,
      "Referrer-Policy",
      "strict-origin-when-cross-origin",
    );
    setResponseHeader(
      event,
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(self)",
    );
    setResponseHeader(
      event,
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    setResponseHeader(event, "Content-Security-Policy", cspHeader);
  });
}
