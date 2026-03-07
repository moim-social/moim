import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import {
  createRootRoute,
  Outlet,
  Link,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "~/server/env";
import { PostHogProvider } from "posthog-js/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { CalendarDays, MapPin, User } from "lucide-react";
import appCss from "~/styles/globals.css?url";

type SessionUser = { handle: string; displayName: string; avatarUrl?: string | null; isAdmin?: boolean } | null;

const AuthContext = createContext<{
  user: SessionUser;
  setUser: (u: SessionUser) => void;
  loaded: boolean;
}>({ user: null, setUser: () => {}, loaded: false });

export function useAuth() {
  return useContext(AuthContext);
}

const BottomBarSlotContext = createContext<{
  setBottomBar: (node: ReactNode) => void;
}>({ setBottomBar: () => {} });

export function useBottomBarSlot(node: ReactNode) {
  const { setBottomBar } = useContext(BottomBarSlotContext);
  useEffect(() => {
    setBottomBar(node);
    return () => setBottomBar(null);
  }, [node, setBottomBar]);
}

const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => ({
  posthogKey: env.posthogKey ?? null,
  posthogHost: env.posthogHost ?? null,
}));

export type PublicConfig = Awaited<ReturnType<typeof getPublicConfig>>;

export const Route = createRootRoute({
  loader: () => getPublicConfig(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Moim" },
      { property: "og:title", content: "Moim" },
      { property: "og:description", content: "Federated events & check-ins" },
      { property: "og:image", content: "/logo.png" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootLayout,
});

function PostHogWrapper({ config, children }: { config: PublicConfig; children: React.ReactNode }) {
  if (config.posthogKey) {
    return (
      <PostHogProvider apiKey={config.posthogKey} options={{ api_host: config.posthogHost ?? undefined }}>
        {children}
      </PostHogProvider>
    );
  }
  return <>{children}</>;
}

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
  const config = Route.useLoaderData();
  const [user, setUser] = useState<SessionUser>(null);
  const [loaded, setLoaded] = useState(false);
  const [bottomBar, setBottomBar] = useState<ReactNode>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSignOut() {
    await fetch("/api/session", { method: "DELETE" });
    setUser(null);
    navigate({ to: "/" });
  }

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <PostHogWrapper config={config}>
        <AuthContext.Provider value={{ user, setUser, loaded }}>
        <BottomBarSlotContext.Provider value={{ setBottomBar }}>
          <div className="relative flex min-h-screen flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
                <Link to="/" className="mr-8 flex items-center gap-2">
                  <img src="/logo.png" alt="Moim" style={{ height: 28, width: "auto" }} />
                  <span className="text-lg font-bold tracking-tight">Moim</span>
                </Link>
                <nav className="hidden md:flex items-center gap-6">
                  <NavLink to="/events">Events</NavLink>
                  <NavLink to="/places">Check-ins</NavLink>
                </nav>
                <div className="ml-auto flex items-center gap-3">
                  {loaded && (
                    user ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1.5">
                            <Avatar size="sm">
                              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} />}
                              <AvatarFallback>
                                {(user.displayName || user.handle).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="hidden md:inline text-sm">@{user.handle}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => navigate({ to: "/groups/my" })}>
                            My Groups
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate({ to: "/groups/create" })}>
                            Create Group
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: "/events/create" })}>
                            Create Event
                          </DropdownMenuItem>
                          {user.isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                                Admin Panel
                              </DropdownMenuItem>
                            </>
                          )}
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
              <div className="mx-auto w-full max-w-5xl px-6 py-8 pb-24 md:pb-8">
                <Outlet />
              </div>
            </main>

            {/* Footer (desktop only) */}
            <footer className="hidden md:block border-t">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
                <p className="text-sm text-muted-foreground">
                  Moim &mdash; Federated events & check-ins
                </p>
                <nav className="flex gap-4">
                  <Link to="/events" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Events</Link>
                  <Link to="/places" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Check-ins</Link>
                </nav>
              </div>
            </footer>

            {/* Bottom bar slot + tab bar (mobile only) */}
            <div className="fixed bottom-0 inset-x-0 z-50 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
              {bottomBar && (
                <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                  {bottomBar}
                </div>
              )}
              <nav className="border-t bg-background">
              <div className="flex items-center justify-around h-14">
                <Link
                  to="/events"
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
                >
                  <CalendarDays className="size-5" />
                  <span className="text-[10px] font-medium">Events</span>
                </Link>
                <Link
                  to="/places"
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
                >
                  <MapPin className="size-5" />
                  <span className="text-[10px] font-medium">Check-ins</span>
                </Link>
                <Link
                  to={user ? "/settings" : "/auth/signin"}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
                >
                  <User className="size-5" />
                  <span className="text-[10px] font-medium">{user ? "Profile" : "Sign in"}</span>
                </Link>
              </div>
              </nav>
            </div>
          </div>
          <Scripts />
        </BottomBarSlotContext.Provider>
        </AuthContext.Provider>
        </PostHogWrapper>

      </body>
    </html>
  );
}
