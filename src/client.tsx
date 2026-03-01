import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { PostHogProvider } from "posthog-js/react";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  loaded: (posthog: { register: (props: Record<string, string>) => void }) => {
    posthog.register({ env: import.meta.env.MODE });
  },
};

const app = posthogKey ? (
  <PostHogProvider apiKey={posthogKey} options={posthogOptions}>
    <StartClient />
  </PostHogProvider>
) : (
  <StartClient />
);

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>{app}</StrictMode>,
  );
});
