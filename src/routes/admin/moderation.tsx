import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModerationPage,
});

function AdminModerationPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Moderation</h2>
      <p className="text-muted-foreground">Moderation tools coming soon.</p>
    </div>
  );
}
