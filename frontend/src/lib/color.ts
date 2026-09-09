// Deterministic hue per ticker so each company gets a stable, distinct
// avatar color across renders without needing a design-time color list.
export function tickerHue(ticker: string): number {
  let hash = 0;
  for (const char of ticker) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
