import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { RemoteFollowDialog } from "~/components/RemoteFollowDialog";

export const Route = createFileRoute("/groups/$identifier/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { identifier } = Route.useParams();
  const handle = identifier.replace(/^@/, "");

  // Check if current user is a member of this group
  const [isMember, setIsMember] = useState(false);
  useEffect(() => {
    fetch(`/groups/detail?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.currentUserRole) setIsMember(true);
      })
      .catch(() => {});
  }, [handle]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {handle.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">@{handle}</CardTitle>
              <Badge variant="secondary">Group</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMember && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to="/groups/$identifier/dashboard"
                  params={{ identifier }}
                >
                  Dashboard
                </Link>
              </Button>
            )}
            <RemoteFollowDialog actorHandle={handle} />
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            This is the profile page for group <strong>@{handle}</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
