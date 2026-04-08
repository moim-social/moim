import { db } from "~/server/db/client";
import { countries } from "~/server/db/schema";
import { requireAdmin } from "~/server/admin";
import { invalidateCountryCache } from "~/server/geo/reverse-geocode";

type CountryImportRecord = {
  code: string;
  alpha3: string;
  name: string;
  geometry: object;
  bbox: [number, number, number, number];
};

function computeBbox(geometry: { coordinates: unknown }): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  function walk(coords: unknown) {
    if (Array.isArray(coords) && typeof coords[0] === "number") {
      const [lng, lat] = coords as [number, number];
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (const c of coords) walk(c);
    }
  }

  walk(geometry.coordinates);
  return [minLng, minLat, maxLng, maxLat];
}

function validateGeoJsonImport(body: unknown): CountryImportRecord[] {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a GeoJSON FeatureCollection");
  }

  const fc = body as Record<string, unknown>;
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection with features array");
  }

  const records: CountryImportRecord[] = [];
  const seenCodes = new Set<string>();
  const skipped: string[] = [];

  for (let i = 0; i < fc.features.length; i++) {
    const feature = fc.features[i] as Record<string, unknown>;
    const props = (feature.properties ?? {}) as Record<string, unknown>;

    const code = String(props.ISO_A2 ?? props.iso_a2 ?? props.ISO_A2_EH ?? props.iso_a2_eh ?? "")
      .trim()
      .toUpperCase();
    const alpha3 = String(props.ISO_A3 ?? props.iso_a3 ?? props.ISO_A3_EH ?? props.iso_a3_eh ?? "")
      .trim()
      .toUpperCase();
    const name = String(props.NAME ?? props.name ?? props.ADMIN ?? props.admin ?? "").trim();

    if (!code || code.length !== 2 || code.startsWith("-")) {
      skipped.push(`Feature ${i}: invalid ISO code "${code}" for "${name}"`);
      continue;
    }

    const geometry = feature.geometry as Record<string, unknown> | null;
    if (!geometry || !["Polygon", "MultiPolygon"].includes(String(geometry.type))) {
      skipped.push(`Feature ${i}: unsupported geometry type for "${name}"`);
      continue;
    }

    if (seenCodes.has(code)) {
      skipped.push(`Feature ${i}: duplicate code "${code}" for "${name}"`);
      continue;
    }

    seenCodes.add(code);
    const bbox = computeBbox(geometry as { coordinates: unknown });

    records.push({
      code,
      alpha3: alpha3.length === 3 ? alpha3 : "???",
      name: name || code,
      geometry: geometry as object,
      bbox,
    });
  }

  if (records.length === 0) {
    throw new Error(
      `No valid country features found. ${skipped.length} skipped:\n${skipped.slice(0, 10).join("\n")}`,
    );
  }

  return records;
}

export const GET = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "geojson") {
    const rows = await db
      .select({
        code: countries.code,
        alpha3: countries.alpha3,
        name: countries.name,
        geometry: countries.geometry,
        bbox: countries.bbox,
      })
      .from(countries)
      .orderBy(countries.name);

    return Response.json({
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature",
        properties: {
          code: row.code,
          alpha3: row.alpha3,
          name: row.name,
          bbox: row.bbox,
        },
        geometry: row.geometry,
      })),
    });
  }

  const rows = await db
    .select({
      code: countries.code,
      alpha3: countries.alpha3,
      name: countries.name,
      createdAt: countries.createdAt,
    })
    .from(countries)
    .orderBy(countries.name);

  return Response.json({ countries: rows, total: rows.length });
};

export const PUT = async ({ request }: { request: Request }) => {
  await requireAdmin(request);
  const body = await request.json().catch(() => null);

  try {
    const records = validateGeoJsonImport(body);

    await db.transaction(async (tx) => {
      await tx.delete(countries);

      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        await tx.insert(countries).values(batch);
      }
    });

    invalidateCountryCache();

    const rows = await db
      .select({
        code: countries.code,
        alpha3: countries.alpha3,
        name: countries.name,
        createdAt: countries.createdAt,
      })
      .from(countries)
      .orderBy(countries.name);

    return Response.json({ countries: rows, total: rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import countries";
    return Response.json({ error: message }, { status: 400 });
  }
};

export const DELETE = async ({ request }: { request: Request }) => {
  await requireAdmin(request);

  await db.delete(countries);
  invalidateCountryCache();

  return Response.json({ ok: true });
};
