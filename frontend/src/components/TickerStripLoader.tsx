import { TickerStrip } from "@/components/TickerStrip";
import { getApiBase } from "@/lib/apiUrl";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import type { PriceQuote } from "@/lib/types";

async function getPrices(): Promise<PriceQuote[]> {
  try {
    const res = await fetchWithTimeout(`${getApiBase()}/prices`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// A separate async component (rather than inline in the root layout) so it
// can be wrapped in its own <Suspense> boundary — a slow/cold backend only
// delays the ticker strip, not the entire page shell (nav, disclaimer).
export async function TickerStripLoader() {
  const prices = await getPrices();
  return <TickerStrip quotes={prices} />;
}

export function TickerStripSkeleton() {
  return (
    <div className="border-b border-border bg-surface px-6 py-3 h-[52px] flex items-center gap-6 overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-4 w-20 rounded-sm bg-surface-raised animate-pulse shrink-0" />
      ))}
    </div>
  );
}
