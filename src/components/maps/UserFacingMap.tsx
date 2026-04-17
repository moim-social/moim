import { cn } from "~/lib/utils";
import { useMapConfig } from "./config";
import { LeafletAdapter } from "./adapters/LeafletAdapter";
import { KakaoAdapter } from "./adapters/KakaoAdapter";
import { GoogleAdapter } from "./adapters/GoogleAdapter";
import type { UserFacingMapProps } from "./types";

export function UserFacingMap(props: UserFacingMapProps) {
  const { data: config, isLoading, error } = useMapConfig();
  const height = props.height ?? "300px";

  if (isLoading || !config) {
    return (
      <div
        className={cn("bg-muted animate-pulse rounded-lg", props.className)}
        style={{ height }}
      />
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive",
          props.className,
        )}
        style={{ height, overflow: "auto" }}
      >
        <p className="font-semibold">Map unavailable</p>
        <p className="mt-1 text-xs">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    );
  }

  switch (config.provider) {
    case "kakao":
      if (!config.kakaoAppKey) {
        throw new Error("MAP_PROVIDER=kakao but kakaoAppKey is missing from /api/map-config response.");
      }
      return <KakaoAdapter {...props} appKey={config.kakaoAppKey} />;
    case "google":
      return <GoogleAdapter {...props} />;
    case "osm":
    default:
      return <LeafletAdapter {...props} />;
  }
}
