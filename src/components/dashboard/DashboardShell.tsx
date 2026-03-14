import type { ReactNode } from "react";

export function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-3.5rem)]">
      {sidebar}
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
