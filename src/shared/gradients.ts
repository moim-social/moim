export const HERO_GRADIENTS: [string, string][] = [
  ["#7c3aed", "#4f46e5"], // violet → indigo
  ["#f43f5e", "#db2777"], // rose → pink
  ["#10b981", "#0d9488"], // emerald → teal
  ["#f59e0b", "#ea580c"], // amber → orange
  ["#0ea5e9", "#2563eb"], // sky → blue
  ["#d946ef", "#9333ea"], // fuchsia → purple
  ["#84cc16", "#16a34a"], // lime → green
  ["#06b6d4", "#0d9488"], // cyan → teal
];

export function pickGradient(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return HERO_GRADIENTS[Math.abs(hash) % HERO_GRADIENTS.length];
}
