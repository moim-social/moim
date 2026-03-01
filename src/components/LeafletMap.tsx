import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

export type MarkerColor = "blue" | "red" | "green" | "gold" | "gray";

export type MapMarker = {
  lat: number;
  lng: number;
  label: string;
  id: string;
  color?: MarkerColor;
};

type LeafletMapProps = {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: string;
  className?: string;
};

export function LeafletMap({
  center = [37.5665, 126.978], // Seoul default
  zoom = 13,
  markers = [],
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
      const MARKER_COLORS: Record<MarkerColor, string> = {
        blue: "#2563eb",
        red: "#dc2626",
        green: "#16a34a",
        gold: "#eab308",
        gray: "#6b7280",
      };
      function makeIcon(color: MarkerColor) {
        const fill = MARKER_COLORS[color];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
          <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" fill="${fill}"/>
          <circle cx="12.5" cy="12.5" r="6" fill="white"/>
        </svg>`;
        return L.divIcon({
          html: svg,
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          className: "",
        });
      }

      // Add new markers
      for (const marker of markers) {
        const icon = marker.color ? makeIcon(marker.color) : undefined;
        const m = L.marker([marker.lat, marker.lng], icon ? { icon } : {})
          .addTo(mapRef.current)
          .bindTooltip(marker.label);
        if (onMarkerClickRef.current) {
          m.on("click", () => onMarkerClickRef.current?.(marker));
        }
        markersRef.current.push(m);
      }

      // Fit bounds if multiple markers
      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else if (markers.length === 1) {
        const currentZoom = mapRef.current.getZoom();
        mapRef.current.setView([markers[0].lat, markers[0].lng], Math.max(currentZoom, zoom));
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
  }, [isClient, markers, center, zoom, onMapClick]);

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
