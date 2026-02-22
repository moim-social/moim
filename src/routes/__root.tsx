import { useState, useEffect } from "react";
import {
  createRootRoute,
  Outlet,
  Link,
  HeadContent,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";

type SessionUser = { handle: string; displayName: string } | null;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Moim" },
    ],
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
        <div style={{ fontFamily: "ui-sans-serif", padding: 24 }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0 }}>Moim</h1>
            <nav style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <Link to="/">Home</Link>
              <Link to="/events">Events</Link>
              <Link to="/places">Places</Link>
              {loaded && (
                user ? (
                  <button
                    onClick={handleSignOut}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      font: "inherit",
                      cursor: "pointer",
                      color: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    Sign out (@{user.handle})
                  </button>
                ) : (
                  <Link to="/auth/signin">Sign in</Link>
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
