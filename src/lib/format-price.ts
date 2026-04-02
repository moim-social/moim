/**
 * Format a numeric price amount as KRW currency string.
 * Falls back to the display label or "Free".
 */
export function formatPrice(
  priceAmount: number | null | undefined,
  fallbackLabel?: string | null,
): string {
  if (priceAmount == null) return fallbackLabel || "Free";
  if (priceAmount === 0) return "Free";
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(priceAmount);
}
