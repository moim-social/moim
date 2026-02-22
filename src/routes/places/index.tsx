import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/places/")({
  component: PlacesPage,
});

function PlacesPage() {
  return (
    <main>
      <h2 className="text-xl font-semibold mb-2">Places</h2>
      <p className="text-muted-foreground">Place discovery coming soon.</p>
    </main>
  );
}
