import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="flex flex-col items-center text-center py-12 space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Discover events,<br />together across the fediverse
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Moim is a federated events and places service — like connpass meets
          foursquare, powered by ActivityPub.
        </p>
        <div className="flex gap-3 pt-2">
          <Button asChild>
            <Link to="/events">Browse Events</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/auth/signin">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
            <CardDescription>
              Create, discover, and RSVP to events hosted by groups across the fediverse.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Places</CardTitle>
            <CardDescription>
              Find and share venues, spaces, and locations where communities gather.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Federated</CardTitle>
            <CardDescription>
              Sign in with your fediverse account. Follow groups from Mastodon, Misskey, and more.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
