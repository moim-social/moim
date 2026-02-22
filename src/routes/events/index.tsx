import { createFileRoute } from "@tanstack/react-router";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
        <p className="text-muted-foreground mt-1">
          Discover upcoming events from groups across the fediverse.
        </p>
      </div>
      <Card className="flex items-center justify-center py-16">
        <CardHeader className="text-center">
          <CardTitle className="text-base text-muted-foreground">No events yet</CardTitle>
          <CardDescription>
            Event discovery is coming soon. Create a group to start hosting events.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
