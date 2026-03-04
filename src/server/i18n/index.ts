import { type I18n, type Messages, setupI18n } from "@lingui/core";
import { env } from "~/server/env";

// Eagerly load all compiled PO catalogs at startup
const localeModules = import.meta.glob<{ messages: Messages }>(
  "./locales/*/messages.po",
  { eager: true },
);

const messagesMap: Record<string, Messages> = {};
for (const [path, mod] of Object.entries(localeModules)) {
  const locale = path.match(/\/([^/]+)\/messages\.po$/)?.[1];
  if (locale && mod.messages) {
    messagesMap[locale] = mod.messages;
  }
}

// Per-locale I18n instances (safe for concurrent use)
const instances = new Map<string, I18n>();

/**
 * Get a Lingui I18n instance for the given locale.
 * Falls back to `env.defaultLocale` when locale is null/undefined.
 */
export function getI18n(locale?: string | null): I18n {
  const resolved = locale && messagesMap[locale] ? locale : env.defaultLocale;
  let instance = instances.get(resolved);
  if (!instance) {
    instance = setupI18n({
      locale: resolved,
      messages: { [resolved]: messagesMap[resolved] ?? {} },
    });
    instance.activate(resolved);
    instances.set(resolved, instance);
  }
  return instance;
}

/**
 * Return the resolved locale string (for use with LanguageString).
 */
export function resolveLocale(locale?: string | null): string {
  return locale && messagesMap[locale] ? locale : env.defaultLocale;
}
