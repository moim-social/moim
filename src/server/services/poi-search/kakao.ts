import { env } from "~/server/env";
import { PoiSearchError, type PoiCandidate, type PoiSearchParams } from "./types";

type KakaoKeywordDoc = {
  id: string;
  place_name: string;
  address_name: string | null;
  road_address_name: string | null;
  x: string;
  y: string;
  category_name: string | null;
  distance: string | null;
};

type KakaoKeywordResponse = {
  documents?: KakaoKeywordDoc[];
};

export async function kakaoKeywordSearch(
  params: PoiSearchParams,
): Promise<PoiCandidate[]> {
  const restKey = env.kakaoMapRestKey;
  if (!restKey) {
    throw new PoiSearchError(
      "KAKAO_MAP_REST_KEY is required when MAP_PROVIDER=kakao",
      500,
    );
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", params.q);
  url.searchParams.set("x", String(params.lng));
  url.searchParams.set("y", String(params.lat));
  url.searchParams.set("radius", String(params.radius ?? 2000));
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", "10");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${restKey}` },
  });

  if (!res.ok) {
    throw new PoiSearchError(
      `Kakao local search failed: HTTP ${res.status}`,
      502,
    );
  }

  const body = (await res.json()) as KakaoKeywordResponse;
  const docs = body.documents ?? [];

  return docs.map((d) => ({
    externalId: d.id,
    source: "kakao" as const,
    name: d.place_name,
    address: d.address_name || null,
    roadAddress: d.road_address_name || null,
    lat: Number.parseFloat(d.y),
    lng: Number.parseFloat(d.x),
    categoryName: d.category_name || null,
    distanceMeters: d.distance ? Number.parseInt(d.distance, 10) : null,
  }));
}
