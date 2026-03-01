import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        entry: "./server-entry.ts",
      },
    }),
    nitro({
      rollupConfig: {
        external: ["sharp"],
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
