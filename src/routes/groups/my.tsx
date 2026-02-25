import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const Route = createFileRoute("/groups/my")({
  component: MyGroupsPage,
});

type GroupSummary = {
  id: string;
  handle: string;
  name: string | null;
};

function MyGroupsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          navigate({ to: "/auth/signin" });
          return;
        }
        return fetch("/groups/my-groups");
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.groups) setGroups(data.groups);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">My Groups</h2>
          <p className="text-muted-foreground mt-1">
            Groups you host or moderate.
          </p>
        </div>
        <Button asChild>
          <Link to="/groups/create">Create Group</Link>
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card className="flex items-center justify-center py-16">
          <CardHeader className="text-center">
            <CardTitle className="text-base text-muted-foreground">
              No groups yet
            </CardTitle>
            <CardDescription>
              Create a group to start hosting events.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {groups.map((group) => (
            <Card key={group.id} className="transition-colors hover:bg-accent/50">
              <Link
                to="/groups/$identifier/dashboard"
                params={{ identifier: `@${group.handle}` }}
                className="block"
              >
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                    {(group.name ?? group.handle).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {group.name ?? group.handle}
                    </CardTitle>
                    <CardDescription>@{group.handle}</CardDescription>
                  </div>
                </CardHeader>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
