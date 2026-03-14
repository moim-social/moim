import type { ReactNode } from "react";

const columnClasses = {
  2: "grid grid-cols-2 gap-4",
  3: "grid grid-cols-1 md:grid-cols-3 gap-4",
  4: "grid grid-cols-2 md:grid-cols-4 gap-4",
} as const;

export function StatsGrid({
  columns = 4,
  children,
}: {
  columns?: 2 | 3 | 4;
  children: ReactNode;
}) {
  return <div className={columnClasses[columns]}>{children}</div>;
}
