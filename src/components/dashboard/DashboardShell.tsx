import { type ReactNode, useState, useCallback, useEffect } from "react";
import { Menu } from "lucide-react";
import { Button } from "~/components/ui/button";

export function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode | ((props: { onClose: () => void }) => ReactNode);
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const sidebarContent =
    typeof sidebar === "function" ? sidebar({ onClose: closeSidebar }) : sidebar;

  // Prevent background scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sidebarOpen]);

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100dvh-3.5rem)]">
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex w-56 shrink-0">{sidebarContent}</div>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeSidebar}
          />
          <div className="absolute left-0 top-14 bottom-14 z-10 w-64 overflow-y-auto bg-background shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile top bar with hamburger */}
        <div className="sticky top-0 z-30 flex items-center border-b bg-background p-3 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
