import { createRootRoute, Outlet, Link } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div style={{ fontFamily: "ui-sans-serif", padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Moim</h1>
        <nav style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <Link to="/">Home</Link>
          <Link to="/events">Events</Link>
          <Link to="/places">Places</Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
