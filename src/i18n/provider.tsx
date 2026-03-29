import { type ReactNode } from "react";
import { I18nProvider as LinguiProvider } from "@lingui/react";
import { i18n, type Messages } from "@lingui/core";

// Eagerly load all catalogs at build time via glob (SSR-safe)
const b2cModules = import.meta.glob<{ messages: Messages }>(
  "./locales/*/b2c.po",
  { eager: true },
);

const b2bModules = import.meta.glob<{ messages: Messages }>(
  "./locales/*/b2b.po",
  { eager: true },
);

function buildCatalogMap(modules: Record<string, { messages: Messages }>) {
  const map: Record<string, Messages> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const locale = path.match(/\/([^/]+)\/[^/]+\.po$/)?.[1];
    if (locale && mod?.messages) {
      map[locale] = mod.messages;
    }
  }
  return map;
}

const catalogMap: Record<string, Record<string, Messages>> = {
  b2c: buildCatalogMap(b2cModules),
  b2b: buildCatalogMap(b2bModules),
};

// Activate a locale with the given catalogs
let activeLocale: string | null = null;

function activateLocale(locale: string, catalogs: string[]) {
  if (activeLocale === locale) return;

  const allMessages: Messages = {};
  for (const name of catalogs) {
    const msgs = catalogMap[name]?.[locale];
    if (msgs) Object.assign(allMessages, msgs);
  }
  i18n.load(locale, allMessages);
  i18n.activate(locale);
  activeLocale = locale;
}

// Ensure i18n is activated with a default locale at module load time (for SSR)
i18n.load("en", {});
i18n.activate("en");

export function I18nProvider({
  locale,
  catalogs = ["b2c"],
  children,
}: {
  locale: string;
  catalogs?: string[];
  children: ReactNode;
}) {
  activateLocale(locale, catalogs);

  return <LinguiProvider i18n={i18n}>{children}</LinguiProvider>;
}
