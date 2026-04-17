import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { buildMarkerArtwork, buildSelectedPinArtwork, toDataUri } from "../icon";
import type { UserFacingMapProps } from "../types";

type KakaoAdapterProps = UserFacingMapProps & { appKey: string };

let sdkLoadPromise: Promise<void> | null = null;

function loadKakaoSdk(appKey: string): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;
  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao SDK cannot load in non-browser context"));
      return;
    }
    const w = window as unknown as { kakao?: { maps?: { load?: (cb: () => void) => void } } };
    if (w.kakao?.maps?.load) {
      w.kakao.maps.load(() => resolve());
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-sdk="true"]');
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.dataset.kakaoSdk = "true";
      script.async = true;
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      const kw = window as unknown as { kakao: { maps: { load: (cb: () => void) => void } } };
      kw.kakao.maps.load(() => resolve());
    });
    script.addEventListener("error", () => reject(new Error("Failed to load Kakao Maps SDK")));
  });
  return sdkLoadPromise;
}

// Leaflet zoom → Kakao level. Kakao is inverse (1 closest, 14 farthest).
function zoomToLevel(zoom: number): number {
  return Math.max(1, Math.min(14, Math.round(20 - zoom)));
}
function levelToZoom(level: number): number {
  return 20 - level;
}

export function KakaoAdapter({
  appKey,
  center = [37.5665, 126.978],
  zoom = 13,
  markers = [],
  fitToMarkers = true,
  onMapClick,
  onMarkerClick,
  onZoomEnd,
  circle,
  height = "300px",
  className,
}: KakaoAdapterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const gpsMarkerRef = useRef<any>(null);
  const gpsRequestedRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;
  const onZoomEndRef = useRef(onZoomEnd);
  onZoomEndRef.current = onZoomEnd;
  const prevViewRef = useRef<{ center?: [number, number]; zoom?: number }>({});
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      await loadKakaoSdk(appKey);
      if (cancelled || !containerRef.current) return;
      const kakao = (window as any).kakao;

      if (!mapRef.current) {
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(center[0], center[1]),
          level: zoomToLevel(zoom),
        });
        kakao.maps.event.addListener(mapRef.current, "click", (e: any) => {
          onMapClickRef.current?.(e.latLng.getLat(), e.latLng.getLng());
        });
        kakao.maps.event.addListener(mapRef.current, "zoom_changed", () => {
          onZoomEndRef.current?.(levelToZoom(mapRef.current.getLevel()));
        });
      }

      // Clear existing markers (including GPS marker when real markers arrive)
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
      if (markers.length > 0 && gpsMarkerRef.current) {
        gpsMarkerRef.current.setMap(null);
        gpsMarkerRef.current = null;
      }

      function toMarkerImage(artwork: ReturnType<typeof buildMarkerArtwork>) {
        return new kakao.maps.MarkerImage(
          toDataUri(artwork.svg),
          new kakao.maps.Size(artwork.width, artwork.height),
          { offset: new kakao.maps.Point(artwork.anchorX, artwork.anchorY) },
        );
      }

      for (const marker of markers) {
        let image: any;
        if (marker.glyph) {
          image = toMarkerImage(buildMarkerArtwork(marker.glyph, marker.highlighted));
        } else if (marker.highlighted) {
          image = toMarkerImage(buildSelectedPinArtwork());
        }
        const kmarker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(marker.lat, marker.lng),
          map: mapRef.current,
          title: marker.label,
          ...(image ? { image } : {}),
        });
        if (onMarkerClickRef.current) {
          kakao.maps.event.addListener(kmarker, "click", () => {
            onMarkerClickRef.current?.(marker);
          });
        }
        markersRef.current.push(kmarker);
      }

      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      if (circle) {
        circleRef.current = new kakao.maps.Circle({
          center: new kakao.maps.LatLng(circle.center[0], circle.center[1]),
          radius: circle.radiusKm * 1000,
          strokeWeight: 1.5,
          strokeColor: "#3b82f6",
          strokeOpacity: 0.8,
          strokeStyle: "dashed",
          fillColor: "#3b82f6",
          fillOpacity: 0.06,
        });
        circleRef.current.setMap(mapRef.current);
      }

      if (fitToMarkers && markers.length > 1) {
        const bounds = new kakao.maps.LatLngBounds();
        for (const m of markers) bounds.extend(new kakao.maps.LatLng(m.lat, m.lng));
        mapRef.current.setBounds(bounds);
      } else if (fitToMarkers && markers.length === 1) {
        mapRef.current.setCenter(new kakao.maps.LatLng(markers[0].lat, markers[0].lng));
        const currentLevel = mapRef.current.getLevel();
        const targetLevel = zoomToLevel(zoom);
        if (targetLevel < currentLevel) mapRef.current.setLevel(targetLevel);
      } else if (!fitToMarkers) {
        const prev = prevViewRef.current;
        if (
          !prev.center
          || prev.center[0] !== center[0]
          || prev.center[1] !== center[1]
          || prev.zoom !== zoom
        ) {
          mapRef.current.setCenter(new kakao.maps.LatLng(center[0], center[1]));
          mapRef.current.setLevel(zoomToLevel(zoom));
          prevViewRef.current = { center, zoom };
        }
      } else if (markers.length === 0 && !gpsRequestedRef.current) {
        gpsRequestedRef.current = true;
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              if (!mapRef.current) return;
              mapRef.current.setCenter(new kakao.maps.LatLng(lat, lng));
              mapRef.current.setLevel(zoomToLevel(zoom));
              if (gpsMarkerRef.current) gpsMarkerRef.current.setMap(null);
              gpsMarkerRef.current = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(lat, lng),
                map: mapRef.current,
                image: toMarkerImage(buildMarkerArtwork(null, false)),
                title: "You are here",
              });
              onMapClickRef.current?.(lat, lng);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 5000 },
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, appKey, markers, center, zoom, fitToMarkers, circle]);

  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.relayout?.();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isClient]);

  if (!isClient) {
    return (
      <div
        className={cn("bg-muted animate-pulse rounded-lg", className)}
        style={{ height }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("rounded-lg overflow-hidden", className)}
      style={{ height, zIndex: 0 }}
    />
  );
}
