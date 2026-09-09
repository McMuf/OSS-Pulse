import Link from "next/link";
import { notFound } from "next/navigation";
import { tickerHue } from "@/lib/color";
import {
  CompanyDetail,
  SUB_METRIC_LABELS,
  SubScores,
  pendingReason,
} from "@/lib/types";

async function getCompany(ticker: string): Promise<CompanyDetail | null | "unreachable"> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/companies/${ticker}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) return "unreachable";
    return res.json();
  } catch {
    return "unreachable";
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-foreground-muted";
  return score >= 60 ? "text-accent" : "text-foreground-muted";
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
          Pending — {pendingReason(metric)}
        </span>
      ) : (
        <span className={`font-mono text-sm ${scoreColor(value)}`}>
          {value?.toFixed(1)}
        </span>
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
  const company = await getCompany(ticker.toUpperCase());

  if (company === null) notFound();

  return (
    <div className="flex flex-col flex-1 bg-background">
      <div className="border-b border-border bg-surface px-6 py-3 text-sm text-foreground-muted">
        Research/engineering demo, not investment advice. OSS activity
        metrics are noisy and gameable; scores shown here are historical
        context, not predictions.
      </div>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          ← Leaderboard
        </Link>

        {company === "unreachable" && (
          <div className="mt-6 rounded-lg border border-border bg-surface px-5 py-6 text-foreground-muted text-sm">
            Couldn&apos;t reach the backend at{" "}
            <code className="font-mono">
              {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
            </code>
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
                </div>
                {company.caveat && (
                  <p className="text-sm text-foreground-muted/70 italic mt-1">
                    {company.caveat}
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

            <div className="mt-10 rounded-lg border border-border bg-surface px-5 py-6">
              <h2 className="text-sm font-medium text-foreground-muted uppercase tracking-wide">
                Health score vs. stock price
              </h2>
              <p className="mt-2 text-sm text-foreground-muted">
                Coming once stock price data is wired up (yfinance
                integration) — showing a chart with no price data behind it
                would be worse than showing nothing.
              </p>
            </div>

            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Repo breakdown
            </h2>
            <div className="mt-3 space-y-4">
              {company.repo_breakdown.map((repo) => (
                <div
                  key={repo.repo}
                  className="rounded-lg border border-border bg-surface px-5 py-4"
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
          </>
        )}
      </main>
    </div>
  );
}
