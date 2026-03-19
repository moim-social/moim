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
import { Menu, X } from "lucide-react";
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
      className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] transition-colors hover:text-foreground [&.active]:font-bold [&.active]:text-foreground [&.active]:border-b-2 [&.active]:border-foreground [&.active]:pb-px"
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
  const [menuOpen, setMenuOpen] = useState(false);
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
            <header className="sticky top-0 z-50 w-full border-b-2 border-foreground bg-background">
              <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
                <Link to="/" className="mr-8 flex items-center">
                  <span className="text-xl font-extrabold tracking-tight">moim</span>
                </Link>
                <nav className="hidden md:flex items-center gap-6">
                  <NavLink to="/events">Events</NavLink>
                  <NavLink to="/places">Places</NavLink>
                </nav>
                {/* Hamburger button (mobile) */}
                <button
                  type="button"
                  className="ml-auto md:hidden p-2 text-foreground"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Toggle menu"
                >
                  {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
                </button>
                <div className="ml-auto hidden md:flex items-center gap-3">
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
                            <span className="hidden md:inline text-[13px] text-[#555]">@{user.handle}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => navigate({ to: "/groups/my" })}>
                            My Groups
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate({ to: "/calendar" })}>
                            My Calendar
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
              {/* Mobile menu overlay */}
              {menuOpen && (
                <div className="md:hidden border-t border-foreground/20 bg-background">
                  <nav className="mx-auto max-w-5xl flex flex-col px-6 py-4 gap-3">
                    <Link to="/events" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Events</Link>
                    <Link to="/groups/my" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Groups</Link>
                    <Link to="/places" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Places</Link>
                    {loaded && user && (
                      <>
                        <hr className="border-foreground/10" />
                        <span className="text-[13px] text-muted-foreground">@{user.handle}</span>
                        <Link to="/groups/my" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>My Groups</Link>
                        <Link to="/calendar" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>My Calendar</Link>
                        <Link to="/settings" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Settings</Link>
                        <hr className="border-foreground/10" />
                        <Link to="/groups/create" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Create Group</Link>
                        <Link to="/events/create" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Create Event</Link>
                        {user.isAdmin && (
                          <>
                            <hr className="border-foreground/10" />
                            <Link to="/admin" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Admin Panel</Link>
                          </>
                        )}
                        <hr className="border-foreground/10" />
                        <button type="button" className="text-[13px] text-[#555] hover:text-foreground text-left" onClick={() => { handleSignOut(); setMenuOpen(false); }}>Sign out</button>
                      </>
                    )}
                    {loaded && !user && (
                      <>
                        <hr className="border-foreground/10" />
                        <Link to="/auth/signin" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}>Sign in</Link>
                      </>
                    )}
                  </nav>
                </div>
              )}
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
                  <Link to="/places" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Places</Link>
                </nav>
              </div>
            </footer>

            {/* Bottom bar slot (mobile only, for page-specific CTAs) */}
            {bottomBar && (
              <div className="fixed bottom-0 inset-x-0 z-50 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                <div className="border-t bg-background">
                  {bottomBar}
                </div>
              </div>
            )}
          </div>
          <Scripts />
        </BottomBarSlotContext.Provider>
        </AuthContext.Provider>
        </PostHogWrapper>

      </body>
    </html>
  );
}
