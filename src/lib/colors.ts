/** Deterministic pleasant palette per subject code — stable across sessions and phases. */

const PALETTE = [
  "#f5b83d", // amber
  "#5cc8ff", // sky
  "#8ce99a", // green
  "#ff8fa3", // rose
  "#b197fc", // violet
  "#63e6be", // teal
  "#ffa94d", // orange
  "#74c0fc", // blue
  "#e599f7", // pink-purple
  "#ffd43b", // yellow
  "#69db7c", // lime
  "#ff8787", // coral
  "#38d9a9", // mint
  "#a9e34b", // chartreuse
  "#faa2c1", // pink
  "#91a7ff", // indigo
];

function hash(code: string): number {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Picks a palette color for a subject code. Deterministic for a given code;
 * when `avoid` is provided, walks forward until it finds a color not in the set.
 */
export function colorFor(code: string, avoid?: Iterable<string>): string {
  const start = hash(code) % PALETTE.length;
  const skip = avoid ? new Set(avoid) : undefined;
  for (let i = 0; i < PALETTE.length; i++) {
    const c = PALETTE[(start + i) % PALETTE.length];
    if (!skip?.has(c)) return c;
  }
  return PALETTE[start];
}

export const SUBJECT_PALETTE = PALETTE;
