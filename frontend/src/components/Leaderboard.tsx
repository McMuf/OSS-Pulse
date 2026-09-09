"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { tickerHue } from "@/lib/color";
import type { CompanySummary } from "@/lib/types";

function CompanyAvatar({ name, ticker }: { name: string; ticker: string }) {
  const hue = tickerHue(ticker);
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
      style={{ backgroundColor: `hsl(${hue}, 45%, 32%)` }}
    >
      {name.charAt(0)}
    </div>
  );
}

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="font-mono text-foreground-muted text-sm">—</span>;
  }
  const strong = score >= 60;
  return (
    <div className="text-right">
      <div
        className={`font-mono text-lg font-semibold ${strong ? "text-accent" : "text-foreground-muted"}`}
      >
        {score.toFixed(1)}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-foreground-muted">
        Health score
      </div>
    </div>
  );
}

function TrendBadge({
  direction,
  magnitude,
}: {
  direction: CompanySummary["trend_direction"];
  magnitude: number | null;
}) {
  if (direction === null || direction === "flat" || magnitude === null) return null;
  const up = direction === "up";
  return (
    <span
      className={`text-xs font-mono ${up ? "text-accent" : "text-foreground-muted"}`}
      title="Commit-velocity trend over the last ~4 weeks — not the full composite score, not a trading signal"
    >
      {up ? "▲" : "▼"} {Math.abs(magnitude).toFixed(1)}
    </span>
  );
}

export function Leaderboard({ companies }: { companies: CompanySummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? companies.filter(
          (c) => c.name.toLowerCase().includes(q) || c.ticker.toLowerCase().includes(q)
        )
      : companies;
    return [...base].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [companies, query]);

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search companies or tickers…"
        className="mt-10 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-accent transition-colors"
      />

      <div className="mt-4 rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-5 py-6 text-foreground-muted text-sm">
            No companies match &quot;{query}&quot;.
          </div>
        )}

        {filtered.map((c, i) => (
          <Link
            key={c.ticker}
            href={`/companies/${c.ticker}`}
            className="flex items-center gap-4 px-5 py-4 hover:bg-surface-raised transition-colors"
          >
            <span className="w-4 shrink-0 text-right font-mono text-xs text-foreground-muted">
              {i + 1}
            </span>

            <CompanyAvatar name={c.name} ticker={c.ticker} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground truncate">{c.name}</span>
                <span className="text-foreground-muted text-sm">{c.ticker}</span>
                <span
                  className={`text-xs rounded-full border px-2 py-0.5 shrink-0 ${
                    c.tier === 1
                      ? "border-border text-foreground-muted"
                      : "border-border/60 text-foreground-muted/70 border-dashed"
                  }`}
                >
                  Tier {c.tier}
                </span>
                {c.delisted && (
                  <span className="text-xs rounded-full border border-border/60 px-2 py-0.5 shrink-0 text-foreground-muted/70">
                    Acquired / delisted
                  </span>
                )}
                <TrendBadge direction={c.trend_direction} magnitude={c.trend_magnitude} />
              </div>
              <div className="text-xs text-foreground-muted mt-1 truncate">
                {c.repos.join(", ")}
              </div>
              {c.caveat && (
                <div className="text-xs text-foreground-muted/70 italic mt-0.5">{c.caveat}</div>
              )}
            </div>

            <ScoreDisplay score={c.score} />
          </Link>
        ))}
      </div>
    </>
  );
}
