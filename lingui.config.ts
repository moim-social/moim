import type { defineConfig } from "@lingui/cli";

const defaultLocales = ["en", "ko", "ja"];
const locales = process.env.SUPPORTED_LOCALES
  ? process.env.SUPPORTED_LOCALES.split(",").map((s) => s.trim()).filter(Boolean)
  : defaultLocales;

export default {
  sourceLocale: "en",
  locales,
  catalogs: [
    {
      path: "<rootDir>/src/server/i18n/locales/{locale}/messages",
      include: ["src/server/fediverse/**"],
    },
    {
      path: "<rootDir>/src/i18n/locales/{locale}/b2b",
      include: [
        "src/routes/*/dashboard/**",
        "src/routes/admin/**",
        "src/components/event-form/**",
      ],
    },
    {
      path: "<rootDir>/src/i18n/locales/{locale}/b2c",
      include: [
        "src/routes/**",
        "src/components/**",
      ],
      exclude: [
        "src/routes/*/dashboard/**",
        "src/routes/admin/**",
        "src/components/event-form/**",
      ],
    },
  ],
} satisfies ReturnType<typeof defineConfig>;
