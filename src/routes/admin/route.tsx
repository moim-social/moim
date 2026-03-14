import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionUser } from "~/server/auth";
import { isAdmin } from "~/server/admin";
import { AdminSidebar } from "~/components/AdminSidebar";
import { DashboardShell } from "~/components/dashboard";

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
    <DashboardShell
      sidebar={({ onClose }) => <AdminSidebar onClose={onClose} />}
    >
      <Outlet />
    </DashboardShell>
  );
}
