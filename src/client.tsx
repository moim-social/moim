import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { PostHogProvider } from "posthog-js/react";

const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  loaded: (posthog: { register: (props: Record<string, string>) => void }) => {
    posthog.register({ env: import.meta.env.MODE });
  },
};

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <PostHogProvider
        apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
        options={posthogOptions}
      >
        <StartClient />
      </PostHogProvider>
    </StrictMode>,
  );
});
