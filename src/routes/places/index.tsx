import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/places/")({
  component: PlacesPage,
});

function PlacesPage() {
  return (
    <main>
      <h2>Places</h2>
      <p>Place discovery coming soon.</p>
    </main>
  );
}
