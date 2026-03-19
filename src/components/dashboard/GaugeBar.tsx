const GAUGE_COLORS = [
  "#111111", // near black
  "#555555", // dark gray
  "#888888", // mid gray
  "#aaaaaa", // light gray
  "#333333",
  "#666666",
  "#999999",
  "#222222",
  "#444444",
  "#777777",
];

export function GaugeBar({
  label,
  count,
  total,
  colorIndex,
}: {
  label: string;
  count: number;
  total: number;
  colorIndex: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-3 bg-muted overflow-hidden">
        <div
          className="h-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: GAUGE_COLORS[colorIndex % GAUGE_COLORS.length],
          }}
        />
      </div>
    </div>
  );
}
