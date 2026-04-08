import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  Outlet,
  Link,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Trans } from "@lingui/react";
import { i18n } from "@lingui/core";

// Ensure i18n has an active locale before any component renders (SSR safety)
if (!i18n.locale) {
  i18n.load("en", {});
  i18n.activate("en");
}

const SUPPORTED_LOCALES = ["en", "ko", "ja"];

function resolveLocaleFromHeader(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) return null;
  const parts = acceptLanguage.split(",").map((part) => {
    const [lang, q] = part.trim().split(";q=");
    return { lang: lang.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
  });
  parts.sort((a, b) => b.q - a.q);
  for (const { lang } of parts) {
    const exact = SUPPORTED_LOCALES.find((l) => l === lang);
    if (exact) return exact;
    const prefix = SUPPORTED_LOCALES.find((l) => lang.startsWith(l + "-"));
    if (prefix) return prefix;
  }
  return null;
}
import { env } from "~/server/env";
import { PostHogProvider, usePostHog } from "posthog-js/react";
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
import { I18nProvider } from "~/i18n/provider";
import appCss from "~/styles/globals.css?url";

type SessionUser = { handle: string; displayName: string; avatarUrl?: string | null; isAdmin?: boolean; posthogId?: string } | null;

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

const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const acceptLang = request.headers.get("accept-language");
  const locale = resolveLocaleFromHeader(acceptLang) ?? env.defaultLocale;
  return {
    posthogKey: env.posthogKey ?? null,
    posthogHost: env.posthogHost ?? null,
    locale,
  };
});

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

function PostHogIdentify({ user }: { user: SessionUser }) {
  const posthog = usePostHog();
  useEffect(() => {
    if (!posthog) return;
    if (user?.posthogId) {
      posthog.identify(user.posthogId);
    } else {
      posthog.reset();
    }
  }, [posthog, user?.posthogId]);
  return null;
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

  const queryClientRef = useRef<QueryClient>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
    });
  }

  return (
    <html lang={config.locale}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryClientProvider client={queryClientRef.current}>
          <I18nProvider locale={config.locale}>
            <PostHogWrapper config={config}>
              {config.posthogKey && <PostHogIdentify user={user} />}
              <AuthContext.Provider value={{ user, setUser, loaded }}>
                <BottomBarSlotContext.Provider value={{ setBottomBar }}>
                  <div className="relative flex min-h-screen flex-col">
                    {/* Header */}
                    <header className="sticky top-0 z-50 w-full border-b-2 border-foreground bg-background">
                      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
                        <Link to="/" className="mr-8 flex items-center gap-2">
                          <img src="/logo.png" alt="" className="h-6 w-6 grayscale" />
                          <span className="text-xl font-extrabold tracking-tight">moim</span>
                        </Link>
                        <nav className="hidden md:flex items-center gap-6">
                          <NavLink to="/events"><Trans id="Events" message="Events" /></NavLink>
                          <NavLink to="/places"><Trans id="Check-ins" message="Check-ins" /></NavLink>
                        </nav>
                        {/* Hamburger button (mobile) */}
                        <button
                          type="button"
                          className="ml-auto md:hidden p-2 text-foreground"
                          onClick={() => setMenuOpen((v) => !v)}
                          aria-label={i18n._("Toggle menu")}
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
                                    <Trans id="My Groups" message="My Groups" />
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate({ to: "/calendar" })}>
                                    <Trans id="My Calendar" message="My Calendar" />
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                                    <Trans id="Settings" message="Settings" />
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => navigate({ to: "/groups/create" })}>
                                    <Trans id="Create Group" message="Create Group" />
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate({ to: "/events/create" })}>
                                    <Trans id="Create Event" message="Create Event" />
                                  </DropdownMenuItem>
                                  {user.isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => navigate({ to: "/admin" })}>
                                        <Trans id="Admin Panel" message="Admin Panel" />
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={handleSignOut}>
                                    <Trans id="Sign out" message="Sign out" />
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button variant="outline" size="sm" asChild>
                                <Link to="/auth/signin"><Trans id="Sign in" message="Sign in" /></Link>
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                      {/* Mobile menu overlay */}
                      {menuOpen && (
                        <div className="md:hidden border-t border-foreground/20 bg-background">
                          <nav className="mx-auto max-w-5xl flex flex-col px-6 py-4 gap-3">
                            <Link to="/events" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Events" message="Events" /></Link>
                            <Link to="/places" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Check-ins" message="Check-ins" /></Link>
                            {loaded && user && (
                              <>
                                <hr className="border-foreground/10" />
                                <span className="text-[13px] text-muted-foreground">@{user.handle}</span>
                                <Link to="/groups/my" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="My Groups" message="My Groups" /></Link>
                                <Link to="/calendar" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="My Calendar" message="My Calendar" /></Link>
                                <Link to="/settings" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Settings" message="Settings" /></Link>
                                <hr className="border-foreground/10" />
                                <Link to="/groups/create" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Create Group" message="Create Group" /></Link>
                                <Link to="/events/create" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Create Event" message="Create Event" /></Link>
                                {user.isAdmin && (
                                  <>
                                    <hr className="border-foreground/10" />
                                    <Link to="/admin" className="text-[13px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Admin Panel" message="Admin Panel" /></Link>
                                  </>
                                )}
                                <hr className="border-foreground/10" />
                                <button type="button" className="text-[13px] text-[#555] hover:text-foreground text-left" onClick={() => { handleSignOut(); setMenuOpen(false); }}><Trans id="Sign out" message="Sign out" /></button>
                              </>
                            )}
                            {loaded && !user && (
                              <>
                                <hr className="border-foreground/10" />
                                <Link to="/auth/signin" className="text-[13px] font-medium uppercase tracking-[0.5px] text-[#555] hover:text-foreground" onClick={() => setMenuOpen(false)}><Trans id="Sign in" message="Sign in" /></Link>
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

                    {/* Footer */}
                    <footer className="border-t-2 border-foreground mt-12 bg-muted/30">
                      <div className="mx-auto w-full max-w-5xl px-6 py-10">
                        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                          {/* Branding & Business Info */}
                          <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center gap-2">
                              <img src="/logo.png" alt="" className="h-5 w-5 grayscale" />
                              <span className="text-base font-extrabold tracking-tight">moim</span>
                            </div>
                            <p className="mt-2 text-[12px] text-muted-foreground">
                              <Trans id="Federated events & check-ins" message="Federated events & check-ins" />
                            </p>
                            <div className="mt-4 space-y-1 text-[11px] text-muted-foreground/70">
                              <p>상호명: 모임라이브 / 대표자: 이재열</p>
                              <p>사업자등록번호: 612-33-03754</p>
                              <p>주소: 서울특별시 송파구 중대로 207, 2층 201-J561호</p>
                              <p>이메일: support@moim.live</p>
                            </div>
                          </div>

                          {/* Service */}
                          <div>
                            <h4 className="text-[13px] font-bold mb-3"><Trans id="footer.service" message="Service" /></h4>
                            <nav className="flex flex-col gap-2">
                              <Link to="/events" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"><Trans id="Events" message="Events" /></Link>
                              <Link to="/places" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"><Trans id="Check-ins" message="Check-ins" /></Link>
                            </nav>
                          </div>

                          {/* Legal */}
                          <div>
                            <h4 className="text-[13px] font-bold mb-3"><Trans id="footer.legal" message="Legal" /></h4>
                            <nav className="flex flex-col gap-2">
                              <Link to="/legal/terms" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"><Trans id="Terms of Service" message="Terms of Service" /></Link>
                              <Link to="/legal/privacy" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"><Trans id="Privacy Policy" message="Privacy Policy" /></Link>
                              <Link to="/legal/refund" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"><Trans id="Refund Policy" message="Refund Policy" /></Link>
                            </nav>
                          </div>
                        </div>
                        <div className="mt-8 border-t border-foreground/10 pt-4">
                          <p className="text-[11px] text-muted-foreground/50">&copy; 2026 모임라이브. All rights reserved.</p>
                        </div>
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
          </I18nProvider>
        </QueryClientProvider>

      </body>
    </html>
  );
}
