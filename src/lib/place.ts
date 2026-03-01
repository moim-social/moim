export type NearbyPlace = {
  id: string;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  distance: number;
  checkinCount: number;
};

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}
