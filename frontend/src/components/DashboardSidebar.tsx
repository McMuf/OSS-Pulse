import Link from "next/link";
import type { CompanySummary } from "@/lib/types";

export function DashboardSidebar({ companies }: { companies: CompanySummary[] }) {
  const tier1 = companies.filter((c) => c.tier === 1).length;
  const tier2 = companies.filter((c) => c.tier === 2).length;
  const delisted = companies.filter((c) => c.delisted).length;
  const repoCount = new Set(companies.flatMap((c) => c.repos)).size;

  const movers = companies
    .filter((c) => c.trend_direction && c.trend_direction !== "flat" && c.trend_magnitude !== null)
    .sort((a, b) => Math.abs(b.trend_magnitude!) - Math.abs(a.trend_magnitude!))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-sm border border-border bg-surface px-5 py-4">
        <h2 className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Universe
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-xl text-foreground">{companies.length}</div>
            <div className="text-xs text-foreground-muted">Companies</div>
          </div>
          <div>
            <div className="font-mono text-xl text-foreground">{repoCount}</div>
            <div className="text-xs text-foreground-muted">Repos tracked</div>
          </div>
          <div>
            <div className="font-mono text-xl text-foreground">
              {tier1}/{tier2}
            </div>
            <div className="text-xs text-foreground-muted">Tier 1 / Tier 2</div>
          </div>
          <div>
            <div className="font-mono text-xl text-foreground">{delisted}</div>
            <div className="text-xs text-foreground-muted">Delisted</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-foreground-muted/70">
          Refreshed daily via a scheduled GitHub Actions job.
        </p>
      </div>

      <div className="rounded-sm border border-border bg-surface px-5 py-4">
        <h2 className="text-xs font-medium text-foreground-muted uppercase tracking-wide">
          Movers
        </h2>
        <p className="text-[11px] text-foreground-muted/70 mt-1">
          Largest ~4-week commit-velocity changes. Context, not a signal.
        </p>
        <div className="mt-3 divide-y divide-border">
          {movers.map((c) => {
            const up = c.trend_direction === "up";
            return (
              <Link
                key={c.ticker}
                href={`/companies/${c.ticker}`}
                className="flex items-center justify-between py-2 hover:text-foreground transition-colors"
              >
                <span className="text-sm text-foreground">{c.ticker}</span>
                <span className={`font-mono text-sm ${up ? "text-accent" : "text-foreground-muted"}`}>
                  {up ? "▲" : "▼"} {Math.abs(c.trend_magnitude!).toFixed(1)}
                </span>
              </Link>
            );
          })}
          {movers.length === 0 && (
            <div className="py-2 text-sm text-foreground-muted">No trend data yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
