import { createFileRoute } from "@tanstack/react-router";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/places/")({
  component: PlacesPage,
});

function PlacesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Places</h2>
        <p className="text-muted-foreground mt-1">
          Find venues, spaces, and locations where communities gather.
        </p>
      </div>
      <Card className="flex items-center justify-center py-16">
        <CardHeader className="text-center">
          <CardTitle className="text-base text-muted-foreground">No places yet</CardTitle>
          <CardDescription>
            Place discovery is coming soon.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
