import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/@/$identifier")({
  component: ProfilePage,
});

function ProfilePage() {
  const { identifier } = Route.useParams();
  return (
    <main>
      <h2 className="text-xl font-semibold mb-2">@{identifier}</h2>
      <p className="text-muted-foreground">This is the human-readable profile page.</p>
    </main>
  );
}
