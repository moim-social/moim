import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionUser } from "~/server/auth";
import { isAdmin } from "~/server/admin";
import { AdminSidebar } from "~/components/AdminSidebar";

const checkAdminAccess = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const user = await getSessionUser(request);
    if (!user || !isAdmin(user)) {
      throw redirect({ to: "/" });
    }
    return {
      handle: user.fediverseHandle ?? user.handle,
      displayName: user.displayName,
    };
  },
);

export const Route = createFileRoute("/admin")({
  beforeLoad: () => checkAdminAccess(),
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100vh-3.5rem)]">
      <AdminSidebar />
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
