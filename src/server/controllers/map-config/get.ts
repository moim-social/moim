import { env } from "~/server/env";

export const GET = async () => {
  const provider = env.mapProvider;

  if (provider !== "osm" && provider !== "kakao" && provider !== "google") {
    return Response.json(
      { error: `Invalid MAP_PROVIDER: ${String(provider)}. Expected osm | kakao | google.` },
      { status: 500 },
    );
  }

  if (provider === "kakao" && !env.kakaoMapAppKey) {
    return Response.json(
      { error: "MAP_PROVIDER=kakao requires KAKAO_MAP_APP_KEY to be set." },
      { status: 500 },
    );
  }

  if (provider === "google" && !env.googleMapsApiKey) {
    return Response.json(
      { error: "MAP_PROVIDER=google requires GOOGLE_MAPS_API_KEY to be set." },
      { status: 500 },
    );
  }

  return Response.json({
    provider,
    kakaoAppKey: provider === "kakao" ? env.kakaoMapAppKey : undefined,
    googleApiKey: provider === "google" ? env.googleMapsApiKey : undefined,
  });
};
