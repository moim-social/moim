import { useState, useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Eye, Copy } from "lucide-react";

export const Route = createFileRoute("/admin/users/")({
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  handle: string;
  fediverseHandle: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  groupCount: number;
  eventCount: number;
  checkinCount: number;
};

const LIMIT = 50;

function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = (q: string, off: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(LIMIT));
    params.set("offset", String(off));
    fetch(`/admin/users/list?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchUsers(search, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    fetchUsers(search, offset);
  }, [offset]);

  const navigate = useNavigate();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="mt-1 text-muted-foreground">
            Manage registered users across the instance.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by handle, name, or fediverse handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {search ? "No users match your search." : "No users found."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Fediverse Handle
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Groups</th>
                  <th className="px-4 py-3 text-center font-medium">Events</th>
                  <th className="px-4 py-3 text-center font-medium">
                    Check-ins
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() =>
                      navigate({
                        to: "/admin/users/$userId",
                        params: { userId: user.id },
                      })
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar size="default">
                          {user.avatarUrl ? (
                            <AvatarImage src={user.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback>
                            {user.displayName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[200px]">
                            {user.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {user.handle}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {user.fediverseHandle || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{user.groupCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{user.eventCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{user.checkinCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({
                                to: "/admin/users/$userId",
                                params: { userId: user.id },
                              });
                            }}
                          >
                            <Eye className="size-4" />
                            View detail
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              const handle = user.fediverseHandle
                                  ? `@${user.fediverseHandle}`
                                  : `@${user.handle}`;
                              navigator.clipboard.writeText(handle);
                            }}
                          >
                            <Copy className="size-4" />
                            Copy handle
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              >
                <ChevronLeft className="size-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
              >
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
