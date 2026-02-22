import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

export const Route = createFileRoute("/groups/$identifier")({
  component: ProfilePage,
});

function ProfilePage() {
  const { identifier } = Route.useParams();
  const handle = identifier.replace(/^@/, "");
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-semibold shrink-0">
            {handle.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">@{handle}</CardTitle>
            <Badge variant="secondary">Group</Badge>
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
