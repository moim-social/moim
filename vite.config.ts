import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "./server-entry.ts",
      },
    }),
    tsconfigPaths(),
  ],
});
