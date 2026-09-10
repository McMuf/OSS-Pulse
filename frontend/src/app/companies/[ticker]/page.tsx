import Link from "next/link";
import { notFound } from "next/navigation";
import { ContributorGraph } from "@/components/ContributorGraph";
import { PriceScoreChart } from "@/components/PriceScoreChart";
import { getApiBaseServer } from "@/lib/apiUrl";
import { tickerHue } from "@/lib/color";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import {
  BacktestResult,
  CompanyDetail,
  ContributorGraphData,
  LAG_WINDOW_LABELS,
  SUB_METRIC_LABELS,
  SubScores,
  pendingReason,
} from "@/lib/types";

async function getCompany(
  apiBase: string,
  ticker: string
): Promise<CompanyDetail | null | "unreachable"> {
  try {
    const res = await fetchWithTimeout(`${apiBase}/companies/${ticker}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) return "unreachable";
    return res.json();
  } catch {
    return "unreachable";
  }
}

async function getContributorGraph(
  apiBase: string,
  ticker: string
): Promise<ContributorGraphData | null> {
  try {
    const res = await fetchWithTimeout(`${apiBase}/companies/${ticker}/contributors`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getBacktest(apiBase: string, ticker: string): Promise<BacktestResult | null> {
  try {
    const res = await fetchWithTimeout(`${apiBase}/companies/${ticker}/backtest`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-foreground-muted";
  return score >= 60 ? "text-accent" : "text-foreground-muted";
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

function SubMetricRow({
  metric,
  value,
  pending,
}: {
  metric: keyof SubScores;
  value: number | null;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-foreground">{SUB_METRIC_LABELS[metric]}</span>
      {pending ? (
        <span className="text-xs text-foreground-muted italic">
          Pending. {pendingReason(metric)}
        </span>
      ) : (
        <span className={`font-mono text-sm ${scoreColor(value)}`}>
          {value?.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function BacktestPanel({ backtest }: { backtest: BacktestResult }) {
  if (!backtest.applicable) {
    return (
      <div className="mt-10 rounded-sm border border-border bg-surface px-5 py-6">
        <h2 className="text-sm font-medium text-foreground-muted uppercase tracking-wide">
          Health score vs. stock price
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Not applicable. {backtest.reason}
        </p>
      </div>
    );
  }

  if (backtest.weekly_points === 0 || backtest.price_history.length === 0) {
    return (
      <div className="mt-10 rounded-sm border border-border bg-surface px-5 py-6">
        <h2 className="text-sm font-medium text-foreground-muted uppercase tracking-wide">
          Health score vs. stock price
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Not enough overlapping commit and price history yet.
        </p>
      </div>
    );
  }

  const priceByDate = new Map(backtest.price_history.map((p) => [p.date, p.close]));
  const sortedPriceDates = backtest.price_history.map((p) => p.date).sort();

  function nearestPriceOnOrAfter(date: string): number | null {
    if (priceByDate.has(date)) return priceByDate.get(date)!;
    const next = sortedPriceDates.find((d) => d >= date);
    return next ? priceByDate.get(next)! : null;
  }

  const chartData = backtest.weekly_scores.map((point) => ({
    date: point.week,
    score: point.score,
    price: nearestPriceOnOrAfter(point.week),
  }));

  return (
    <div className="mt-10 rounded-sm border border-border bg-surface px-5 py-6">
      <h2 className="text-sm font-medium text-foreground-muted uppercase tracking-wide">
        Health score vs. stock price
      </h2>
      <p className="mt-2 text-xs text-foreground-muted">
        The green line is a commit-velocity-only score computed at each past
        week using only data available as of that week. It is not the full
        6-metric composite shown above, since the other sub-metrics don&apos;t
        have historical data yet (see the README for why). Not investment
        advice; correlation here is not evidence of a tradeable edge.
      </p>

      <div className="mt-4">
        <PriceScoreChart data={chartData} />
      </div>

      <h3 className="mt-6 text-xs font-medium text-foreground-muted uppercase tracking-wide">
        Forward-return correlation ({backtest.weekly_points} weekly points)
      </h3>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {Object.entries(backtest.lag_windows).map(([label, result]) => (
          <div key={label} className="rounded border border-border px-3 py-2">
            <div className="text-xs text-foreground-muted">
              {LAG_WINDOW_LABELS[label] ?? label}
            </div>
            <div className="font-mono text-lg text-foreground mt-1">
              {result.correlation !== null ? result.correlation.toFixed(2) : "—"}
            </div>
            <div className="text-[10px] text-foreground-muted">n={result.n}</div>
          </div>
        ))}
      </div>

      {backtest.event_study && (
        <div className="mt-4 text-xs text-foreground-muted">
          <span className="font-medium text-foreground">Event study: </span>
          in {backtest.event_study.n_events} week
          {backtest.event_study.n_events === 1 ? "" : "s"} with a sharp score
          drop (≤{backtest.event_study.threshold} pts week-over-week),
          average 1-month forward return was{" "}
          {backtest.event_study.avg_forward_return_after_drop !== null
            ? pct(backtest.event_study.avg_forward_return_after_drop)
            : "n/a (no qualifying weeks)"}
          , vs. {pct(backtest.event_study.avg_forward_return_baseline)} across
          the other {backtest.event_study.n_baseline} weeks. Sample sizes this
          small are not statistically meaningful on their own. They are shown
          for transparency, not as a signal.
        </div>
      )}
    </div>
  );
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();
  const apiBase = await getApiBaseServer();
  const [company, backtest, contributorGraph] = await Promise.all([
    getCompany(apiBase, upperTicker),
    getBacktest(apiBase, upperTicker),
    getContributorGraph(apiBase, upperTicker),
  ]);

  if (company === null) notFound();

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          ← Leaderboard
        </Link>

        {company === "unreachable" && (
          <div className="mt-6 rounded-sm border border-border bg-surface px-5 py-6 text-foreground-muted text-sm">
            Couldn&apos;t reach the backend at{" "}
            <code className="font-mono">{apiBase}</code>
            .
          </div>
        )}

        {company !== "unreachable" && (
          <>
            <div className="flex items-center gap-4 mt-6">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-medium text-white"
                style={{
                  backgroundColor: `hsl(${tickerHue(company.ticker)}, 45%, 32%)`,
                }}
              >
                {company.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    {company.name}
                  </h1>
                  <span className="text-foreground-muted">{company.ticker}</span>
                  <span
                    className={`text-xs rounded-full border px-2 py-0.5 ${
                      company.tier === 1
                        ? "border-border text-foreground-muted"
                        : "border-border/60 text-foreground-muted/70 border-dashed"
                    }`}
                  >
                    Tier {company.tier}
                  </span>
                  {company.delisted && (
                    <span className="text-xs rounded-full border border-border/60 px-2 py-0.5 text-foreground-muted/70">
                      Acquired / delisted
                    </span>
                  )}
                </div>
                {company.caveat && (
                  <p className="text-sm text-foreground-muted/70 italic mt-1">
                    {company.caveat}
                  </p>
                )}
                {company.delisted && company.delisted_note && (
                  <p className="text-sm text-foreground-muted/70 italic mt-1">
                    {company.delisted_note}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className={`font-mono text-3xl font-semibold ${scoreColor(company.score)}`}>
                  {company.score?.toFixed(1) ?? "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-foreground-muted">
                  Health score
                </div>
              </div>
            </div>

            {backtest && <BacktestPanel backtest={backtest} />}

            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Repo breakdown
            </h2>
            <div className="mt-3 space-y-4">
              {company.repo_breakdown.map((repo) => (
                <div
                  key={repo.repo}
                  className="rounded-sm border border-border bg-surface px-5 py-4"
                >
                  <div className="flex items-center justify-between">
                    <a
                      href={`https://github.com/${repo.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-foreground hover:text-accent transition-colors"
                    >
                      {repo.repo} ↗
                    </a>
                    <span className={`font-mono text-sm font-semibold ${scoreColor(repo.composite_score)}`}>
                      {repo.composite_score?.toFixed(1) ?? "—"}
                    </span>
                  </div>
                  <div className="mt-3">
                    {(Object.keys(SUB_METRIC_LABELS) as (keyof SubScores)[]).map(
                      (metric) => (
                        <SubMetricRow
                          key={metric}
                          metric={metric}
                          value={repo.sub_scores[metric]}
                          pending={repo.metrics_pending.includes(metric)}
                        />
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Contributors
            </h2>
            {contributorGraph && contributorGraph.repos.some((r) => r.contributors.length > 0) ? (
              <div className="mt-3">
                <ContributorGraph data={contributorGraph} />
              </div>
            ) : (
              <div className="mt-3 rounded-sm border border-border bg-surface px-5 py-6 text-sm text-foreground-muted">
                No contributor data yet.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
