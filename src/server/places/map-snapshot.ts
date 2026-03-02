import { existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import StaticMaps from "staticmaps";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places } from "~/server/db/schema";
import { uploadBuffer } from "~/server/storage/s3";
import { env } from "~/server/env";

// Marker SVG matching LeafletMap makeSelectedPin() — red teardrop with white inner circle
const DEFAULT_MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42">
  <path d="M14 40 C20.5 29, 25 23, 25 14 C25 7.925, 20.075 3, 14 3 C7.925 3, 3 7.925, 3 14 C3 23, 7.5 29, 14 40 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
  <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
</svg>`;

// Marker SVG matching LeafletMap makeIcon() — white rounded rect with bottom pointer + emoji
function emojiMarkerSvg(emoji: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="48" viewBox="0 0 48 54">
  <rect x="4" y="4" width="40" height="32" rx="11" fill="#ffffff" stroke="#6b7280" stroke-width="1.5"/>
  <path d="M19 36 L19 50 L29 36" fill="#ffffff" stroke="#6b7280" stroke-width="1.5" stroke-linejoin="round"/>
  <text x="24" y="25.5" text-anchor="middle" font-size="18">${emoji}</text>
</svg>`;
}

const markerDir = join(tmpdir(), "moim-markers");
const markerCache = new Map<string, string>();

async function getMarkerPngPath(emoji?: string | null): Promise<{
  path: string;
  width: number;
  height: number;
}> {
  const cacheKey = emoji ?? "default";
  const cached = markerCache.get(cacheKey);
  if (cached) {
    return emoji
      ? { path: cached, width: 44, height: 48 }
      : { path: cached, width: 28, height: 42 };
  }

  mkdirSync(markerDir, { recursive: true });

  const hash = createHash("md5").update(cacheKey).digest("hex").slice(0, 8);
  const pngPath = join(markerDir, `pin-${hash}.png`);

  if (!existsSync(pngPath)) {
    const svg = emoji ? emojiMarkerSvg(emoji) : DEFAULT_MARKER_SVG;
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
  }

  markerCache.set(cacheKey, pngPath);
  return emoji
    ? { path: pngPath, width: 44, height: 48 }
    : { path: pngPath, width: 28, height: 42 };
}

/**
 * Generate a static map PNG for a place and upload it to R2.
 * Updates the place's mapImageUrl column. Returns the public URL.
 */
export async function generateAndUploadMapSnapshot(
  placeId: string,
  lat: number,
  lng: number,
  emoji?: string | null,
): Promise<string> {
  const marker = await getMarkerPngPath(emoji);

  const map = new StaticMaps({
    width: 600,
    height: 400,
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileRequestHeader: { "User-Agent": "Moim/0.1 (static map generator)" },
  });

  map.addMarker({
    coord: [lng, lat],
    img: marker.path,
    height: marker.height,
    width: marker.width,
  });

  await map.render([lng, lat], 19);
  const buffer = await map.image.buffer("image/png");

  const key = `maps/${placeId}.png`;
  await uploadBuffer(key, buffer, "image/png");

  const mapImageUrl = `${env.baseUrl}/maps/${placeId}.png?v=${Date.now()}`;

  await db
    .update(places)
    .set({ mapImageUrl })
    .where(eq(places.id, placeId));

  return mapImageUrl;
}
