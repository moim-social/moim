import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <main>
      <h2 className="text-xl font-semibold mb-2">Events</h2>
      <p className="text-muted-foreground">Event discovery coming soon.</p>
    </main>
  );
}
