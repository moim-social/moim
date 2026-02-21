import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <h2>Federated events and places</h2>
      <p>Bootstrap app for connpass + foursquare on the fediverse.</p>
    </main>
  );
}
