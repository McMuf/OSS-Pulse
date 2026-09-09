type CompanySummary = {
  ticker: string;
  name: string;
  tier: number;
  repos: string[];
  caveat: string | null;
  score: number | null;
  trend_30d: number | null;
};

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

export default async function Home() {
  const companies = await getCompanies();

  return (
    <div className="flex flex-col flex-1 bg-background">
      <div className="border-b border-border bg-surface px-6 py-3 text-sm text-foreground-muted">
        Research/engineering demo, not investment advice. OSS activity
        metrics are noisy and gameable; scores shown here are historical
        context, not predictions.
      </div>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          OSS Pulse
        </h1>
        <p className="mt-2 text-foreground-muted max-w-2xl">
          Open-source developer-activity health, tracked per company and
          checked against forward stock returns.
        </p>

        <div className="mt-10 rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden">
          {companies === null && (
            <div className="px-5 py-6 text-foreground-muted text-sm">
              Couldn&apos;t reach the backend at{" "}
              <code className="font-mono">
                {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
              </code>
              . Start it with <code className="font-mono">uvicorn oss_pulse.api.main:app</code>{" "}
              from <code className="font-mono">backend/</code>.
            </div>
          )}

          {companies?.map((c) => (
            <div
              key={c.ticker}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {c.name}
                  </span>
                  <span className="text-foreground-muted text-sm">
                    {c.ticker}
                  </span>
                  <span className="text-xs rounded-full border border-border px-2 py-0.5 text-foreground-muted">
                    Tier {c.tier}
                  </span>
                </div>
                <div className="text-xs text-foreground-muted mt-1">
                  {c.repos.join(", ")}
                </div>
              </div>
              <div className="font-mono text-foreground-muted">
                {c.score ?? "—"}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
