"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { tickerHue } from "@/lib/color";
import { Sparkline } from "@/components/Sparkline";
import type { CompanySummary } from "@/lib/types";

type FilterKey = "all" | "tier1" | "tier2" | "delisted";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tier1", label: "Tier 1" },
  { key: "tier2", label: "Tier 2" },
  { key: "delisted", label: "Delisted" },
];

function matchesFilter(c: CompanySummary, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "delisted") return c.delisted;
  if (filter === "tier1") return c.tier === 1;
  return c.tier === 2;
}

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
      title="Commit-velocity trend over the last ~4 weeks. Not the full composite score, not a trading signal"
    >
      {up ? "▲" : "▼"} {Math.abs(magnitude).toFixed(1)}
    </span>
  );
}

export function Leaderboard({ companies }: { companies: CompanySummary[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    const base = companies.filter((c) => matchesFilter(c, filter));
    return [...base].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [companies, filter]);

  return (
    <>
      <div className="flex gap-2 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-sm px-3 py-2 border-b-2 transition-colors ${
              filter === f.key
                ? "border-accent text-foreground"
                : "border-transparent text-foreground-muted hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-sm border border-border bg-surface divide-y divide-border overflow-hidden">
        {filtered.length === 0 && (
          <div className="px-5 py-6 text-foreground-muted text-sm">
            No companies in this filter.
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

            <Sparkline
              values={c.recent_scores}
              color={c.trend_direction === "up" ? "#3ecf8e" : "#8b8f98"}
            />

            <ScoreDisplay score={c.score} />
          </Link>
        ))}
      </div>
    </>
  );
}
