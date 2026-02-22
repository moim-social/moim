import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <h2 className="text-xl font-semibold mb-2">Federated events and places</h2>
      <p className="text-muted-foreground">Bootstrap app for connpass + foursquare on the fediverse.</p>
    </main>
  );
}
