import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export type MarkerColor = "blue" | "red" | "green" | "gold" | "gray";

export type MapMarker = {
  lat: number;
  lng: number;
  label: string;
  id: string;
  color?: MarkerColor;
  glyph?: string | null;
};

type LeafletMapProps = {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  fitToMarkers?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: string;
  className?: string;
};

export function LeafletMap({
  center = [37.5665, 126.978], // Seoul default
  zoom = 13,
  markers = [],
  fitToMarkers = true,
  onMapClick,
  onMarkerClick,
  height = "300px",
  className,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const gpsMarkerRef = useRef<any>(null);
  const gpsRequestedRef = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;
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

        if (onMapClick) {
          mapRef.current.on("click", (e: any) => {
            onMapClick(e.latlng.lat, e.latlng.lng);
          });
        }
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

      // Colored marker icon factory
      const MARKER_COLORS: Record<MarkerColor, { text: string }> = {
        blue: {
          text: "#1e3a8a",
        },
        red: {
          text: "#991b1b",
        },
        green: {
          text: "#166534",
        },
        gold: {
          text: "#92400e",
        },
        gray: {
          text: "#374151",
        },
      };
      const MARKER_BORDER = "#6b7280";
      function makeIcon(color: MarkerColor, glyph?: string | null) {
        const palette = MARKER_COLORS[color];
        const glyphMarkup = glyph
          ? `<text x="22" y="25.5" text-anchor="middle" font-size="18">${glyph}</text>`
          : `<text x="22" y="24.5" text-anchor="middle" font-size="14" fill="${palette.text}">•</text>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="48" viewBox="0 0 44 48">
          <defs>
            <filter id="marker-shadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.18"/>
            </filter>
          </defs>
          <g filter="url(#marker-shadow)">
            <rect x="4" y="4" width="36" height="30" rx="10" fill="#ffffff" stroke="${MARKER_BORDER}" stroke-width="1.5"/>
            <path d="M18 34 L18 44 L26 34" fill="#ffffff" stroke="${MARKER_BORDER}" stroke-width="1.5" stroke-linejoin="round"/>
          </g>
          ${glyphMarkup}
        </svg>`;
        return L.divIcon({
          html: svg,
          iconSize: [44, 48],
          iconAnchor: [22, 48],
          popupAnchor: [0, -42],
          className: "",
        });
      }

      // Add new markers
      for (const marker of markers) {
        const icon = marker.color || marker.glyph
          ? makeIcon(marker.color ?? "blue", marker.glyph)
          : undefined;
        const m = L.marker([marker.lat, marker.lng], icon ? { icon } : {})
          .addTo(mapRef.current)
          .bindTooltip(marker.label);
        if (onMarkerClickRef.current) {
          m.on("click", () => onMarkerClickRef.current?.(marker));
        }
        markersRef.current.push(m);
      }

      // Fit bounds if multiple markers
      if (fitToMarkers && markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else if (fitToMarkers && markers.length === 1) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.setView([markers[0].lat, markers[0].lng], Math.max(currentZoom, zoom));
      } else if (!fitToMarkers) {
        mapRef.current.setView(center, zoom);
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
              gpsMarkerRef.current = L.marker([lat, lng], { icon: makeIcon("green") })
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
  }, [isClient, markers, center, zoom, fitToMarkers, onMapClick]);

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
