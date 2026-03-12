import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Globe, Upload, Trash2, Map, List } from "lucide-react";

export const Route = createFileRoute("/admin/countries")({
  component: AdminCountriesPage,
});

type Country = {
  code: string;
  alpha3: string;
  name: string;
  createdAt: string;
};

type PreviewEntry = {
  code: string;
  name: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parsePreview(data: unknown): PreviewEntry[] {
  if (!data || typeof data !== "object") return [];
  const fc = data as Record<string, unknown>;
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return [];

  const entries: PreviewEntry[] = [];
  for (const feature of fc.features) {
    const props = (feature as Record<string, unknown>).properties as Record<string, unknown> | null;
    if (!props) continue;
    const code = String(props.ISO_A2 ?? props.iso_a2 ?? props.ISO_A2_EH ?? props.iso_a2_eh ?? "")
      .trim()
      .toUpperCase();
    const name = String(props.NAME ?? props.name ?? props.ADMIN ?? props.admin ?? "").trim();
    if (!code || code.length !== 2 || code.startsWith("-")) continue;
    entries.push({ code, name: name || code });
  }
  return entries;
}

// Random but deterministic color per country code
function countryColor(code: string): string {
  const colors = [
    "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
    "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#84cc16",
    "#6366f1", "#d946ef", "#0ea5e9", "#10b981", "#e11d48",
  ];
  const hash = code.charCodeAt(0) * 31 + code.charCodeAt(1);
  return colors[hash % colors.length];
}

function CountryMap({ visible }: { visible: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const bboxLayerRef = useRef<any>(null);
  const geojsonRef = useRef<any>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [showBbox, setShowBbox] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !visible || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }

      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current).setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 8,
        }).addTo(mapRef.current);
      }

      setMapLoading(true);
      try {
        const res = await fetch("/api/admin/countries?format=geojson");
        if (!res.ok || cancelled) return;
        const geojson = await res.json();
        geojsonRef.current = geojson;

        if (layerRef.current) {
          layerRef.current.remove();
        }

        layerRef.current = L.geoJSON(geojson, {
          style: (feature: any) => ({
            fillColor: countryColor(feature?.properties?.code ?? "XX"),
            fillOpacity: 0.4,
            color: "#334155",
            weight: 1,
          }),
          onEachFeature: (feature: any, layer: any) => {
            const props = feature?.properties;
            if (props) {
              layer.bindTooltip(
                `<strong>${props.code}</strong> ${props.name}`,
                { sticky: true },
              );
            }
          },
        }).addTo(mapRef.current);

        if (geojson.features?.length > 0) {
          mapRef.current.fitBounds(layerRef.current.getBounds(), { padding: [20, 20] });
        }
      } catch {
        // silently fail
      } finally {
        setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isClient, visible]);

  // Toggle bbox rectangles
  useEffect(() => {
    if (!mapRef.current) return;

    if (bboxLayerRef.current) {
      bboxLayerRef.current.remove();
      bboxLayerRef.current = null;
    }

    if (showBbox && geojsonRef.current) {
      (async () => {
        const L = (await import("leaflet")).default;
        const group = L.layerGroup();

        for (const feature of geojsonRef.current.features) {
          const bbox = feature.properties?.bbox as [number, number, number, number] | undefined;
          if (!bbox) continue;
          const [minLng, minLat, maxLng, maxLat] = bbox;
          const bounds: [[number, number], [number, number]] = [[minLat, minLng], [maxLat, maxLng]];
          const rect = L.rectangle(bounds, {
            color: countryColor(feature.properties?.code ?? "XX"),
            weight: 1.5,
            fillOpacity: 0.08,
            dashArray: "4 3",
          });
          rect.bindTooltip(
            `<strong>${feature.properties.code}</strong> bbox`,
            { sticky: true },
          );
          group.addLayer(rect);
        }

        group.addTo(mapRef.current);
        bboxLayerRef.current = group;
      })();
    }
  }, [showBbox]);

  // Invalidate size when becoming visible
  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 100);
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showBbox}
            onChange={(e) => setShowBbox(e.target.checked)}
            className="rounded"
          />
          Show bounding boxes
        </label>
      </div>
      <div className="rounded-lg border overflow-hidden">
        {mapLoading && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            Loading map...
          </div>
        )}
        <div
          ref={containerRef}
          style={{ height: "500px", zIndex: 0 }}
        />
      </div>
    </div>
  );
}

function AdminCountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "map">("table");
  const [showImport, setShowImport] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCountries = () => {
    setLoading(true);
    fetch("/api/admin/countries")
      .then((r) => r.json())
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result as string);
        setParsedData(json);
        setPreview(parsePreview(json));
      } catch {
        setImportError("Failed to parse file as JSON");
        setParsedData(null);
        setPreview([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/admin/countries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedData),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Import failed");
        return;
      }
      setShowImport(false);
      setParsedData(null);
      setPreview([]);
      fetchCountries();
    } catch {
      setImportError("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleClear = async () => {
    await fetch("/api/admin/countries", { method: "DELETE" });
    setShowClear(false);
    fetchCountries();
  };

  const openImport = () => {
    setImportError(null);
    setParsedData(null);
    setPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowImport(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Countries</h2>
          <p className="mt-1 text-muted-foreground">
            Manage country boundary data for offline reverse geocoding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {countries.length > 0 && (
            <>
              <div className="flex items-center rounded-md border bg-muted/30">
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("table")}
                  className="h-8 px-2"
                >
                  <List className="size-4" />
                </Button>
                <Button
                  variant={view === "map" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView("map")}
                  className="h-8 px-2"
                >
                  <Map className="size-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClear(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4 mr-1" />
                Clear All
              </Button>
            </>
          )}
          <Button onClick={openImport} size="sm">
            <Upload className="size-4 mr-1" />
            Import GeoJSON
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading countries...</p>
        </div>
      ) : countries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Globe className="size-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-2">
            No country boundaries imported yet.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Import a GeoJSON file (e.g. Natural Earth ne_110m_admin_0_countries) to enable offline reverse geocoding.
          </p>
          <Button onClick={openImport} size="sm">
            <Upload className="size-4 mr-1" />
            Import GeoJSON
          </Button>
        </div>
      ) : (
        <>
          {view === "table" ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Code</th>
                    <th className="px-4 py-3 text-left font-medium">Alpha-3</th>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Imported At</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((country) => (
                    <tr key={country.code} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{country.code}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{country.alpha3}</td>
                      <td className="px-4 py-3 font-medium">{country.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(country.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                {countries.length} {countries.length === 1 ? "country" : "countries"} imported
              </div>
            </div>
          ) : (
            <CountryMap visible={view === "map"} />
          )}
        </>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Country Boundaries</DialogTitle>
            <DialogDescription>
              Upload a GeoJSON FeatureCollection file. Recommended: Natural Earth 110m dataset (~1MB).
              This will replace all existing country data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.geojson"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
              />
            </div>

            {importError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importError}
              </div>
            )}

            {preview.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">
                  Preview: {preview.length} countries detected
                </p>
                <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                  {preview.map((entry) => (
                    <div key={entry.code} className="py-0.5">
                      <Badge variant="secondary" className="text-xs mr-1">
                        {entry.code}
                      </Badge>
                      {entry.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImport(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!parsedData || importing}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <Dialog open={showClear} onOpenChange={setShowClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Country Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all {countries.length} country boundaries?
              This will disable offline reverse geocoding until new data is imported.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClear(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
