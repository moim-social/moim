export type MapProvider = "osm" | "kakao" | "google";

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

export type CircleOverlay = {
  center: [number, number];
  radiusKm: number;
};

export type UserFacingMapProps = {
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

export type MapConfig = {
  provider: MapProvider;
  kakaoAppKey?: string;
  googleApiKey?: string;
};
