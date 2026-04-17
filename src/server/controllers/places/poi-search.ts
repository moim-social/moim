import { PoiSearchError, searchPois } from "~/server/services/poi-search";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");
  const radiusStr = url.searchParams.get("radius");

  if (q.length < 1) {
    return Response.json({ candidates: [] });
  }

  const lat = latStr ? Number.parseFloat(latStr) : NaN;
  const lng = lngStr ? Number.parseFloat(lngStr) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json(
      { error: "lat and lng query params are required and must be numbers" },
      { status: 400 },
    );
  }

  const radius = radiusStr ? Number.parseInt(radiusStr, 10) : undefined;

  try {
    const candidates = await searchPois({ q, lat, lng, radius });
    return Response.json({ candidates });
  } catch (e) {
    if (e instanceof PoiSearchError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
};
