import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/@/$identifier")({
  component: ProfilePage,
});

function ProfilePage() {
  const { identifier } = Route.useParams();
  return (
    <main>
      <h2>@{identifier}</h2>
      <p>This is the human-readable profile page.</p>
    </main>
  );
}
