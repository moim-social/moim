import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { lingui } from "@lingui/vite-plugin";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

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
        external: ["sharp", "staticmaps", "h3-js"],
      },
    }),
    tsconfigPaths(),
    tailwindcss(),
    lingui(),
  ],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
	allowedHosts: ['moim.kodingwarrior.dev'],
  }
});
