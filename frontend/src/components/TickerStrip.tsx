import { Sparkline } from "@/components/Sparkline";
import type { PriceQuote } from "@/lib/types";

// Real stock prices (not our health score) — Yahoo-Finance-style ticker
// strip. Conventional red/down, green/up coloring is standard here since
// this is plain price data, not our own derived score (where we
// deliberately avoid that convention to not imply a trading signal).
export function TickerStrip({ quotes }: { quotes: PriceQuote[] }) {
  if (quotes.length === 0) return null;

  return (
    <div className="border-b border-border bg-surface overflow-x-auto">
      <div className="flex gap-6 px-6 py-3 w-max">
        {quotes.map((q) => {
          const up = (q.change_pct ?? 0) >= 0;
          return (
            <div key={q.ticker} className="flex items-center gap-2 shrink-0">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-foreground">{q.ticker}</span>
                  <span className="font-mono text-sm text-foreground">
                    ${q.price.toFixed(2)}
                  </span>
                </div>
                {q.change_pct !== null && (
                  <span
                    className={`font-mono text-xs ${up ? "text-accent" : "text-negative"}`}
                  >
                    {up ? "▲" : "▼"} {Math.abs(q.change_pct * 100).toFixed(2)}%
                  </span>
                )}
              </div>
              <Sparkline
                values={q.recent_prices}
                width={48}
                height={20}
                color={up ? "#0f9d63" : "#d64545"}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
