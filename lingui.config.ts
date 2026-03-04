import type { defineConfig } from "@lingui/cli";

export default {
  sourceLocale: "en",
  locales: ["en", "ko", "ja"],
  catalogs: [
    {
      path: "<rootDir>/src/server/i18n/locales/{locale}/messages",
      include: ["src/server"],
    },
  ],
} satisfies ReturnType<typeof defineConfig>;
