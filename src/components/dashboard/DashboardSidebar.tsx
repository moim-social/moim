import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";

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
  onClose,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  sections: NavSection[];
  footer?: ReactNode;
  onClose?: () => void;
}) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="flex h-full w-full shrink-0 flex-col md:border-r bg-background md:bg-muted/30">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <Link
            to={backTo}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 md:hidden"
              onClick={onClose}
            >
              <X className="size-4" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          )}
        </div>
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
                      onClick={onClose}
                      className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "border-l-2 border-foreground bg-[#f5f5f5] font-semibold text-foreground"
                          : "text-muted-foreground hover:bg-[#fafafa] hover:text-foreground"
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
