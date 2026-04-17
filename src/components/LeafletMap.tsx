import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import { buildMarkerArtwork, buildSelectedPinArtwork } from "~/components/maps/icon";
import type { UserFacingMapProps } from "~/components/maps/types";

export type { MapMarker, MarkerColor } from "~/components/maps/types";

type LeafletMapProps = UserFacingMapProps;

export function LeafletMap({
  center = [37.5665, 126.978], // Seoul default
  zoom = 13,
  markers = [],
  fitToMarkers = true,
  onMapClick,
  onMarkerClick,
  onZoomEnd,
  circle,
  height = "300px",
  className,
}: LeafletMapProps) {
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
      const L = (await import("leaflet")).default;

      // Import Leaflet CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      // Initialize map
      if (!mapRef.current) {
        // Fix default icon paths once (Leaflet webpack issue)
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        mapRef.current = L.map(containerRef.current).setView(center, zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        mapRef.current.on("click", (e: any) => {
          onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current.on("zoomend", () => {
          onZoomEndRef.current?.(mapRef.current.getZoom());
        });
      }

      // Clear existing markers (including GPS marker when real markers arrive)
      for (const m of markersRef.current) {
        m.remove();
      }
      markersRef.current = [];
      if (markers.length > 0 && gpsMarkerRef.current) {
        gpsMarkerRef.current.remove();
        gpsMarkerRef.current = null;
      }

      function toDivIcon(artwork: ReturnType<typeof buildMarkerArtwork>, popupOffset: number) {
        return L.divIcon({
          html: artwork.svg,
          iconSize: [artwork.width, artwork.height],
          iconAnchor: [artwork.anchorX, artwork.anchorY],
          popupAnchor: [0, popupOffset],
          className: "",
        });
      }

      // Add new markers
      for (const marker of markers) {
        let icon: any;
        if (marker.glyph) {
          const artwork = buildMarkerArtwork(marker.glyph, marker.highlighted);
          icon = toDivIcon(artwork, marker.highlighted ? -50 : -42);
        } else if (marker.highlighted) {
          icon = toDivIcon(buildSelectedPinArtwork(), -36);
        }
        const m = L.marker([marker.lat, marker.lng], icon ? { icon } : {})
          .addTo(mapRef.current)
          .bindTooltip(marker.label);
        if (onMarkerClickRef.current) {
          m.on("click", () => onMarkerClickRef.current?.(marker));
        }
        markersRef.current.push(m);
      }

      // Update circle overlay
      if (circleRef.current) {
        circleRef.current.remove();
        circleRef.current = null;
      }
      if (circle) {
        circleRef.current = L.circle(circle.center, {
          radius: circle.radiusKm * 1000,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.06,
          weight: 1.5,
          dashArray: "6 4",
        }).addTo(mapRef.current);
      }

      // Fit bounds if multiple markers
      if (fitToMarkers && markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else if (fitToMarkers && markers.length === 1) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.setView([markers[0].lat, markers[0].lng], Math.max(currentZoom, zoom));
      } else if (!fitToMarkers) {
        const prev = prevViewRef.current;
        if (!prev.center || prev.center[0] !== center[0] || prev.center[1] !== center[1] || prev.zoom !== zoom) {
          mapRef.current.setView(center, zoom);
          prevViewRef.current = { center, zoom };
        }
      } else if (markers.length === 0 && !gpsRequestedRef.current) {
        // No markers — try to center on user's GPS location and place a marker
        gpsRequestedRef.current = true;
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude: lat, longitude: lng } = pos.coords;
              if (!mapRef.current) return;
              mapRef.current.setView([lat, lng], zoom);

              // Place a green marker at the user's position
              if (gpsMarkerRef.current) gpsMarkerRef.current.remove();
              gpsMarkerRef.current = L.marker([lat, lng], {
                icon: toDivIcon(buildMarkerArtwork(null, false), -42),
              })
                .addTo(mapRef.current)
                .bindPopup("You are here")
                .openPopup();

              // Fire onMapClick so picker UIs pre-fill coordinates
              onMapClickRef.current?.(lat, lng);
            },
            () => {}, // silently fall back to default center
            { enableHighAccuracy: false, timeout: 5000 },
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, markers, center, zoom, fitToMarkers, circle]);

  // Invalidate map size when container resizes (e.g. body style changes from modals)
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [isClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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
