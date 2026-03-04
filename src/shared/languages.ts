export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
];

const labelMap = new Map(LANGUAGES.map((l) => [l.code, l.label]));

export function languageLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return labelMap.get(code) ?? code;
}
