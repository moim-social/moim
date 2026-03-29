export type PlaceCategorySummary = {
  slug: string;
  label: string | null;
  labels?: Record<string, string>;
  emoji: string | null;
  enabled?: boolean;
};

export function resolveCategoryLabel(
  category: { label: string; labels?: Record<string, string> },
): string {
  if (category.labels) {
    const browserLocale = typeof navigator !== "undefined"
      ? navigator.language.split("-")[0]
      : undefined;
    if (browserLocale && category.labels[browserLocale]) {
      return category.labels[browserLocale];
    }
  }
  return category.label;
}

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  labels?: Record<string, string>;
  emoji: string;
  depth: number;
  enabled: boolean;
};

export type NearbyPlace = {
  id: string;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  distance: number;
  checkinCount: number;
  category: PlaceCategorySummary | null;
  latestCheckin: {
    userDisplayName: string;
    userAvatarUrl: string | null;
    createdAt: string;
  } | null;
};

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}
