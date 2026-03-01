import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import StaticMaps from "staticmaps";
import { eq } from "drizzle-orm";
import { db } from "~/server/db/client";
import { places } from "~/server/db/schema";
import { uploadBuffer } from "~/server/storage/s3";
import { env } from "~/server/env";

const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="white" stroke-width="2"/>
</svg>`;

let markerPath: string | undefined;

function getMarkerPath(): string {
  if (markerPath) return markerPath;
  const dir = join(tmpdir(), "moim-markers");
  mkdirSync(dir, { recursive: true });
  markerPath = join(dir, "pin.svg");
  writeFileSync(markerPath, MARKER_SVG);
  return markerPath;
}

/**
 * Generate a static map PNG for a place and upload it to R2.
 * Updates the place's mapImageUrl column. Returns the public URL.
 */
export async function generateAndUploadMapSnapshot(
  placeId: string,
  lat: number,
  lng: number,
): Promise<string> {
  const map = new StaticMaps({
    width: 600,
    height: 400,
    tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileRequestHeader: { "User-Agent": "Moim/0.1 (static map generator)" },
  });

  map.addMarker({
    coord: [lng, lat],
    img: getMarkerPath(),
    height: 24,
    width: 24,
  });

  await map.render([lng, lat], 19);
  const buffer = await map.image.buffer("image/png");

  const key = `maps/${placeId}.png`;
  await uploadBuffer(key, buffer, "image/png");

  const mapImageUrl = `${env.baseUrl}/maps/${placeId}.png`;

  await db
    .update(places)
    .set({ mapImageUrl })
    .where(eq(places.id, placeId));

  return mapImageUrl;
}
