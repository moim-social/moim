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
      <body>
        <div className="font-sans p-6 max-w-4xl mx-auto">
          <header className="mb-6">
            <h1 className="text-2xl font-bold">Moim</h1>
            <nav className="flex gap-3 mt-3 items-center">
              <Link to="/" className="text-sm hover:underline">Home</Link>
              <Link to="/events" className="text-sm hover:underline">Events</Link>
              <Link to="/places" className="text-sm hover:underline">Places</Link>
              {loaded && (
                user ? (
                  <>
                    <Link to="/groups/create" className="text-sm hover:underline">Create Group</Link>
                    <Button variant="link" onClick={handleSignOut} className="p-0 h-auto text-sm">
                      Sign out (@{user.handle})
                    </Button>
                  </>
                ) : (
                  <Link to="/auth/signin" className="text-sm hover:underline">Sign in</Link>
                )
              )}
            </nav>
          </header>
          <Outlet />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
