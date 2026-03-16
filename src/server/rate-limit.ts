// --- Configurable hourly limit (global per IP) ---
const DEFAULT_WINDOW_MS = 3600000; // 1 hour
const DEFAULT_MAX_REQUESTS = 10;

const windowMs = Number(process.env.ANON_RSVP_RATE_LIMIT_WINDOW_MS) || DEFAULT_WINDOW_MS;
const maxRequests = Number(process.env.ANON_RSVP_RATE_LIMIT_MAX) || DEFAULT_MAX_REQUESTS;

// --- Short burst limit (prevents rapid-fire within seconds) ---
const BURST_WINDOW_MS = 10_000; // 10 seconds
const BURST_MAX = 2;

type WindowEntry = { count: number; resetAt: number };

const windows = new Map<string, WindowEntry>();
const burstWindows = new Map<string, WindowEntry>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
  for (const [key, entry] of burstWindows) {
    if (entry.resetAt <= now) burstWindows.delete(key);
  }
}, 600000);

function checkWindow(
  store: Map<string, WindowEntry>,
  key: string,
  max: number,
  windowDuration: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowDuration });
    return { allowed: true, retryAfterSec: 0 };
  }

  entry.count++;
  if (entry.count > max) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Check if a request from the given key is within the rate limit.
 * Applies two layers:
 *   1. Burst limit — max 2 requests per 10 seconds (blocks rapid-fire)
 *   2. Hourly limit — max 10 requests per hour (blocks sustained abuse)
 * Returns null if allowed, or a 429 Response if rate limited.
 */
export function checkRateLimit(key: string): Response | null {
  // Check burst limit first (tighter window)
  const burst = checkWindow(burstWindows, key, BURST_MAX, BURST_WINDOW_MS);
  if (!burst.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment before trying again." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(burst.retryAfterSec),
        },
      },
    );
  }

  // Check hourly limit
  const hourly = checkWindow(windows, key, maxRequests, windowMs);
  if (!hourly.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many anonymous RSVP requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(hourly.retryAfterSec),
        },
      },
    );
  }

  return null;
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
