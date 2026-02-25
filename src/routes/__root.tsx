import { useState, useEffect } from "react";
import {
  createRootRoute,
  Outlet,
  Link,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import appCss from "~/styles/globals.css?url";

type SessionUser = { handle: string; displayName: string } | null;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Moim" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootLayout,
});

function NavLink(props: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={props.to}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {props.children}
    </Link>
  );
}

function RootLayout() {
  const [user, setUser] = useState<SessionUser>(null);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSignOut() {
    await fetch("/auth/signout", { method: "POST" });
    setUser(null);
    navigate({ to: "/" });
  }

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col">
          {/* Header */}
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
              <Link to="/" className="mr-8 flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight">Moim</span>
              </Link>
              <nav className="flex items-center gap-6">
                <NavLink to="/events">Events</NavLink>
                <NavLink to="/places">Places</NavLink>
              </nav>
              <div className="ml-auto flex items-center gap-3">
                {loaded && (
                  user ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5">
                          <span className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                            {(user.displayName || user.handle).charAt(0).toUpperCase()}
                          </span>
                          <span className="text-sm">@{user.handle}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate({ to: "/groups/my" })}>
                          My Groups
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate({ to: "/groups/create" })}>
                          Create Group
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate({ to: "/events/create" })}>
                          Create Event
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                          Sign out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/auth/signin">Sign in</Link>
                    </Button>
                  )
                )}
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-5xl px-6 py-8">
              <Outlet />
            </div>
          </main>

          {/* Footer */}
          <footer className="border-t">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
              <p className="text-sm text-muted-foreground">
                Moim &mdash; Federated events & places
              </p>
              <nav className="flex gap-4">
                <Link to="/events" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Events</Link>
                <Link to="/places" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Places</Link>
              </nav>
            </div>
          </footer>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
