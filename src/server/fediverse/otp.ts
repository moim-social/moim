export const EMOJI_SET = [
  "\u{1F308}", "\u{1F31F}", "\u{1F338}",
  "\u{1F349}", "\u{1F366}", "\u{1F37F}",
  "\u{1F389}", "\u{1F3A8}", "\u{1F525}",
] as const;

function popcount(n: number): number {
  let count = 0;
  let v = n;
  while (v) {
    count += v & 1;
    v >>= 1;
  }
  return count;
}

/**
 * Generate a random subset of emojis from EMOJI_SET using a 9-bit bitmask.
 * Each bit determines whether the corresponding emoji is included.
 * Retries if fewer than 2 or more than 7 emojis are selected.
 */
export function generateEmojiChallenge(): string[] {
  let bits: number;
  do {
    bits = crypto.getRandomValues(new Uint16Array(1))[0] & 0x1ff;
  } while (popcount(bits) < 2 || popcount(bits) > 7);

  return EMOJI_SET.filter((_, i) => (bits >> i) & 1);
}
