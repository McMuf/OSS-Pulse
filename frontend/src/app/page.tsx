import Link from "next/link";
import { tickerHue } from "@/lib/color";
import type { CompanySummary } from "@/lib/types";

async function getCompanies(): Promise<CompanySummary[] | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/companies`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
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

export default async function Home() {
  const companies = await getCompanies();
  const ranked = companies
    ? [...companies].sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    : null;

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          OSS Pulse
        </h1>
        <p className="mt-2 text-foreground-muted max-w-2xl">
          Open-source developer-activity health, tracked per company and
          checked against forward stock returns.
        </p>

        <div className="mt-10 rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden">
          {ranked === null && (
            <div className="px-5 py-6 text-foreground-muted text-sm">
              Couldn&apos;t reach the backend at{" "}
              <code className="font-mono">
                {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
              </code>
              . Start it with{" "}
              <code className="font-mono">uvicorn oss_pulse.api.main:app</code>{" "}
              from <code className="font-mono">backend/</code>.
            </div>
          )}

          {ranked?.map((c, i) => (
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
                  <span className="font-medium text-foreground truncate">
                    {c.name}
                  </span>
                  <span className="text-foreground-muted text-sm">
                    {c.ticker}
                  </span>
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
                </div>
                <div className="text-xs text-foreground-muted mt-1 truncate">
                  {c.repos.join(", ")}
                </div>
                {c.caveat && (
                  <div className="text-xs text-foreground-muted/70 italic mt-0.5">
                    {c.caveat}
                  </div>
                )}
              </div>

              <ScoreDisplay score={c.score} />
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
