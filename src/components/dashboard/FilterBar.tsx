import { Button } from "~/components/ui/button";

export function FilterBar<K extends string | null>({
  filters,
  active,
  onChange,
}: {
  filters: { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="flex gap-1">
      {filters.map((f) => (
        <Button
          key={f.key ?? "all"}
          variant={active === f.key ? "default" : "outline"}
          size="sm"
          className="text-xs h-7 px-2.5"
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}
