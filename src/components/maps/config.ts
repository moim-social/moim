import { useQuery } from "@tanstack/react-query";
import type { MapConfig } from "./types";

export function useMapConfig() {
  return useQuery<MapConfig>({
    queryKey: ["map-config"],
    queryFn: async () => {
      const r = await fetch("/api/map-config");
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Failed to load map config (HTTP ${r.status})`);
      }
      return r.json();
    },
    staleTime: Infinity,
    retry: false,
  });
}
