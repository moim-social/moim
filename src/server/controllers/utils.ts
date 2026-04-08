/**
 * Returns `undefined` (skip column) when the value was not provided in the request body,
 * or applies the transform when it was. Useful for building partial update sets with Drizzle.
 */
export function optional<T, R = T>(
  value: T | undefined,
  transform: (v: T) => R = (v) => v as unknown as R,
): R | undefined {
  return value !== undefined ? transform(value) : undefined;
}
