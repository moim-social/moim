import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { db } from "~/server/db/client";
import { countries } from "~/server/db/schema";

type CountryBoundary = {
  code: string;
  name: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  bboxArea: number;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
};

let cache: CountryBoundary[] | null = null;

async function loadBoundaries(): Promise<CountryBoundary[]> {
  if (cache) return cache;

  const rows = await db
    .select({
      code: countries.code,
      name: countries.name,
      bbox: countries.bbox,
      geometry: countries.geometry,
    })
    .from(countries);

  cache = rows
    .map((row) => {
      const bbox = row.bbox as [number, number, number, number];
      const bboxArea = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
      return {
        code: row.code,
        name: row.name,
        bbox,
        bboxArea,
        geometry: row.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
      };
    })
    .sort((a, b) => a.bboxArea - b.bboxArea);

  return cache;
}

export function invalidateCountryCache(): void {
  cache = null;
}

export async function reverseGeocodeCountry(
  lat: number,
  lng: number,
): Promise<{ code: string; name: string } | null> {
  const boundaries = await loadBoundaries();
  const pt = point([lng, lat]);

  for (const boundary of boundaries) {
    const [minLng, minLat, maxLng, maxLat] = boundary.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (booleanPointInPolygon(pt, boundary.geometry)) {
      return { code: boundary.code, name: boundary.name };
    }
  }

  return null;
}
