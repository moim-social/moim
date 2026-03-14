export function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">
        {value}
        {suffix && (
          <span className="text-base font-normal text-muted-foreground ml-1">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}
