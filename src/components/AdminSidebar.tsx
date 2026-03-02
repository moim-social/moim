import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Shield,
  BarChart3,
  ArrowLeft,
} from "lucide-react";

type NavItem = { to: string; icon: LucideIcon; label: string; exact?: boolean };
type NavSection = { label: string; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Management",
    items: [{ to: "/admin/users", icon: Users, label: "Users" }],
  },
  {
    label: "Moderation",
    items: [{ to: "/admin/moderation", icon: Shield, label: "Moderation" }],
  },
  {
    label: "Insights",
    items: [{ to: "/admin/analytics", icon: BarChart3, label: "Analytics" }],
  },
];

export function AdminSidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b p-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Moim
        </Link>
        <h1 className="mt-3 text-lg font-semibold">Admin Panel</h1>
      </div>

      <nav className="flex-1 space-y-4 p-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
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
    </aside>
  );
}
