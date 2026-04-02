/**
 * Sanitize a returnTo URL to prevent open redirect attacks.
 * Only allows relative paths starting with `/`.
 */
export function sanitizeReturnTo(
  value: string | null | undefined,
): string {
  if (!value || typeof value !== "string") return "/";
  // Must start with exactly one forward slash
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  // Block backslash (some browsers normalize \ to /)
  if (value.includes("\\")) return "/";
  return value;
}
