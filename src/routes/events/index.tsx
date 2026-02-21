import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <main>
      <h2>Events</h2>
      <p>Event discovery coming soon.</p>
    </main>
  );
}
