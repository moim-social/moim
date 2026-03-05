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
  highlighted?: boolean;
};

type CircleOverlay = {
  center: [number, number];
  radiusKm: number;
};

type LeafletMapProps = {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  circle?: CircleOverlay;
  fitToMarkers?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  onZoomEnd?: (zoom: number) => void;
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
      function makeSelectedPin() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="42" viewBox="0 0 28 42">
          <defs>
            <filter id="selected-pin-shadow" x="-30%" y="-20%" width="160%" height="180%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#7f1d1d" flood-opacity="0.22"/>
            </filter>
          </defs>
          <g filter="url(#selected-pin-shadow)">
            <path d="M14 40 C20.5 29, 25 23, 25 14 C25 7.925, 20.075 3, 14 3 C7.925 3, 3 7.925, 3 14 C3 23, 7.5 29, 14 40 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
            <circle cx="14" cy="14" r="5.5" fill="#ffffff"/>
          </g>
        </svg>`;
        return L.divIcon({
          html: svg,
          iconSize: [28, 42],
          iconAnchor: [14, 42],
          popupAnchor: [0, -36],
          className: "",
        });
      }
      function makeIcon(color: MarkerColor, glyph?: string | null, highlighted = false) {
        const palette = MARKER_COLORS[color];
        const isHighlighted = highlighted && !!glyph;
        const width = isHighlighted ? 44 : 44;
        const height = isHighlighted ? 48 : 48;
        const iconAnchorX = 22;
        const iconAnchorY = 48;
        const shadowId = isHighlighted ? "marker-shadow-active" : "marker-shadow";
        const strokeColor = isHighlighted ? "#ef4444" : MARKER_BORDER;
        const fillColor = "#ffffff";
        const glyphMarkup = glyph
          ? `<text x="22" y="25.5" text-anchor="middle" font-size="18">${glyph}</text>`
          : "";
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 48 54">
          <defs>
            <filter id="marker-shadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#0f172a" flood-opacity="0.18"/>
            </filter>
            <filter id="marker-shadow-active" x="-30%" y="-30%" width="160%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#7f1d1d" flood-opacity="0.18"/>
            </filter>
          </defs>
          <g filter="url(#${shadowId})">
            <rect x="4" y="4" width="40" height="32" rx="11" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isHighlighted ? 2.25 : 1.5}"/>
            <path d="M19 36 L19 50 L29 36" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isHighlighted ? 2.25 : 1.5}" stroke-linejoin="round"/>
          </g>
          ${glyphMarkup}
        </svg>`;
        return L.divIcon({
          html: svg,
          iconSize: [width, height],
          iconAnchor: [iconAnchorX, iconAnchorY],
          popupAnchor: [0, isHighlighted ? -50 : -42],
          className: "",
        });
      }

      // Add new markers
      for (const marker of markers) {
        const icon = marker.glyph
          ? makeIcon(marker.color ?? "blue", marker.glyph, marker.highlighted)
          : marker.highlighted
            ? makeSelectedPin()
          : undefined;
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
