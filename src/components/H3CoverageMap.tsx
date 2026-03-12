import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

type H3CoverageMapProps = {
  center?: [number, number];
  zoom?: number;
  latitude?: string;
  longitude?: string;
  hopCount: number;
  onMapClick?: (lat: number, lng: number) => void;
  height?: string;
  className?: string;
};

export function H3CoverageMap({
  center = [37.5665, 126.978],
  zoom = 13,
  latitude,
  longitude,
  hopCount,
  onMapClick,
  height = "300px",
  className,
}: H3CoverageMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polygonsRef = useRef<any>(null); // layer group for hex polygons
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const [isClient, setIsClient] = useState(false);
  const [cellCount, setCellCount] = useState(0);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!isClient || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity =
          "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl:
            "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        mapRef.current = L.map(containerRef.current).setView(center, zoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);

        polygonsRef.current = L.layerGroup().addTo(mapRef.current);

        mapRef.current.on("click", (e: any) => {
          onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient]);

  // Update marker + hex polygons when lat/lng/hopCount change
  useEffect(() => {
    if (!isClient || !mapRef.current || !polygonsRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      const { latLngToCell, gridDisk, cellToBoundary } = await import(
        "h3-js"
      );

      if (cancelled) return;

      // Clear previous
      polygonsRef.current.clearLayers();
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      if (!latitude || !longitude) {
        setCellCount(0);
        return;
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setCellCount(0);
        return;
      }

      // Place center marker
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      mapRef.current.setView([lat, lng], mapRef.current.getZoom());

      // Compute H3 cells
      const H3_RESOLUTION = 7;
      const centerCell = latLngToCell(lat, lng, H3_RESOLUTION);
      const cells = gridDisk(centerCell, hopCount);
      setCellCount(cells.length);

      // Draw hex polygons
      for (const cell of cells) {
        const boundary = cellToBoundary(cell);
        const latlngs = boundary.map(
          ([bLat, bLng]: [number, number]) => [bLat, bLng] as [number, number],
        );

        const isCenter = cell === centerCell;
        const polygon = L.polygon(latlngs, {
          color: isCenter ? "#ef4444" : "#3b82f6",
          fillColor: isCenter ? "#ef4444" : "#3b82f6",
          fillOpacity: isCenter ? 0.3 : 0.12,
          weight: isCenter ? 2 : 1,
        });
        polygonsRef.current.addLayer(polygon);
      }

      // Fit map to coverage area
      if (cells.length > 0) {
        const allBounds: [number, number][] = [];
        for (const cell of cells) {
          const boundary = cellToBoundary(cell);
          for (const [bLat, bLng] of boundary) {
            allBounds.push([bLat, bLng]);
          }
        }
        mapRef.current.fitBounds(L.latLngBounds(allBounds), {
          padding: [30, 30],
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, latitude, longitude, hopCount]);

  // Resize observer
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
    <div className={className}>
      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden"
        style={{ height, zIndex: 0 }}
      />
      {latitude && longitude && (
        <p className="text-muted-foreground mt-1 text-xs">
          {cellCount} hex cells · Hop count: {hopCount}
        </p>
      )}
    </div>
  );
}
