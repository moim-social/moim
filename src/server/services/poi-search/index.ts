import { env } from "~/server/env";
import { kakaoKeywordSearch } from "./kakao";
import { PoiSearchError, type PoiCandidate, type PoiSearchParams } from "./types";

export { PoiSearchError } from "./types";
export type { PoiCandidate, PoiSearchParams } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;

type CacheEntry = { value: PoiCandidate[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function cacheKey(params: PoiSearchParams): string {
  return [
    params.q.trim().toLowerCase(),
    params.lat.toFixed(3),
    params.lng.toFixed(3),
    params.radius ?? 2000,
  ].join("|");
}

function cacheGet(key: string): PoiCandidate[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order (LRU touch)
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function cacheSet(key: string, value: PoiCandidate[]): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function searchPois(
  params: PoiSearchParams,
): Promise<PoiCandidate[]> {
  if (env.mapProvider !== "kakao") {
    throw new PoiSearchError(
      `POI search not available for MAP_PROVIDER=${env.mapProvider}`,
      501,
    );
  }

  const key = cacheKey(params);
  const cached = cacheGet(key);
  if (cached) return cached;

  const result = await kakaoKeywordSearch(params);
  cacheSet(key, result);
  return result;
}
