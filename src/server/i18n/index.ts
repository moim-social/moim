import { env } from "~/server/env";

/**
 * Minimal PO file parser — extracts msgid → msgstr pairs.
 */
function parsePo(content: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const lines = content.split("\n");
  let currentId = "";
  let currentStr = "";
  let section: "id" | "str" | null = null;

  function flush() {
    if (currentId) {
      entries[currentId] = currentStr || currentId;
    }
    currentId = "";
    currentStr = "";
    section = null;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      flush();
      continue;
    }
    if (line.startsWith("msgid ")) {
      flush();
      section = "id";
      currentId = parseQuoted(line.slice(6));
    } else if (line.startsWith("msgstr ")) {
      section = "str";
      currentStr = parseQuoted(line.slice(7));
    } else if (line.startsWith('"') && line.endsWith('"')) {
      const val = parseQuoted(line);
      if (section === "id") currentId += val;
      else if (section === "str") currentStr += val;
    }
  }
  flush();

  delete entries[""];
  return entries;
}

function parseQuoted(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}

// --- Load PO files at build time via Vite ---

type Catalog = Record<string, string>;

const rawModules = import.meta.glob<string>(
  "./locales/*/messages.po",
  { query: "?raw", import: "default", eager: true },
);

const catalogs: Record<string, Catalog> = {};
for (const [path, raw] of Object.entries(rawModules)) {
  const locale = path.match(/\/([^/]+)\/messages\.po$/)?.[1];
  if (locale) {
    catalogs[locale] = parsePo(raw);
  }
}

/**
 * Lightweight i18n instance.
 */
export interface I18n {
  locale: string;
  _(msgid: string, values?: Record<string, string | number>): string;
}

function createI18n(locale: string): I18n {
  const catalog = catalogs[locale] ?? {};
  return {
    locale,
    _(msgid: string, values?: Record<string, string | number>): string {
      const translated = catalog[msgid] ?? msgid;
      return interpolate(translated, values);
    },
  };
}

const instances = new Map<string, I18n>();

/**
 * Get an i18n instance for the given locale.
 * Falls back to env.defaultLocale when locale is null/unknown.
 */
export function getI18n(locale?: string | null): I18n {
  const resolved = locale && catalogs[locale] ? locale : env.defaultLocale;
  let instance = instances.get(resolved);
  if (!instance) {
    instance = createI18n(resolved);
    instances.set(resolved, instance);
  }
  return instance;
}

/**
 * Return the resolved locale string (for LanguageString).
 */
export function resolveLocale(locale?: string | null): string {
  return locale && catalogs[locale] ? locale : env.defaultLocale;
}
