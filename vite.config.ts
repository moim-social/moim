import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "./server-entry.ts",
      },
    }),
    tsconfigPaths(),
    tailwindcss(),
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  server: {
	allowedHosts: ['moim.kodingwarrior.dev'],
  }
});
