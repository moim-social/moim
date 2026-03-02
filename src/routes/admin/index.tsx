import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-muted-foreground">
          Instance administration overview.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2 rounded-lg border p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Users
          </p>
          <p className="text-3xl font-bold">--</p>
        </div>
        <div className="space-y-2 rounded-lg border p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Groups
          </p>
          <p className="text-3xl font-bold">--</p>
        </div>
        <div className="space-y-2 rounded-lg border p-6">
          <p className="text-sm font-medium text-muted-foreground">
            Total Events
          </p>
          <p className="text-3xl font-bold">--</p>
        </div>
      </div>
    </div>
  );
}
