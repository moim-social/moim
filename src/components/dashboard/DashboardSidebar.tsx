import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export function DashboardSidebar({
  backTo,
  backLabel,
  title,
  subtitle,
  headerExtra,
  sections,
  footer,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  sections: NavSection[];
  footer?: ReactNode;
}) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b p-4">
        <Link
          to={backTo}
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <h1
          className="mt-3 text-base font-semibold truncate"
          title={title}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
        {headerExtra}
      </div>

      <nav className="flex-1 space-y-4 p-3">
        {sections.map((section, sIdx) => (
          <div key={section.label ?? sIdx}>
            {section.label && (
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.exact
                  ? currentPath === item.to
                  : currentPath.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-accent font-medium text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer && <div className="border-t p-3 space-y-1">{footer}</div>}
    </aside>
  );
}
