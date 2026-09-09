import { LAG_WINDOW_LABELS, Methodology } from "@/lib/types";

async function getMethodology(): Promise<Methodology | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/methodology`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function MethodologyPage() {
  const methodology = await getMethodology();

  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Methodology
        </h1>
        <p className="mt-2 text-foreground-muted max-w-2xl">
          How the OSS Health Score is computed, where the data comes from,
          and where this breaks down — served from{" "}
          <code className="font-mono text-sm">GET /methodology</code> so the
          weights below are the actual weights used, not a description that
          can drift out of sync with the code.
        </p>

        {methodology === null && (
          <div className="mt-6 rounded-lg border border-border bg-surface px-5 py-6 text-foreground-muted text-sm">
            Couldn&apos;t reach the backend at{" "}
            <code className="font-mono">
              {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
            </code>
            .
          </div>
        )}

        {methodology && (
          <>
            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Composite score weights
            </h2>
            <div className="mt-3 rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden">
              {methodology.sub_metrics.map((m) => (
                <div key={m.key} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{m.label}</span>
                    <span className="font-mono text-accent">{m.weight_pct}%</span>
                  </div>
                  <p className="text-sm text-foreground-muted mt-1">{m.description}</p>
                  <p className="text-xs text-foreground-muted/70 italic mt-1">
                    Requires: {m.requires}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-foreground-muted">
              {methodology.renormalization_note}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              {methodology.company_rollup_note}
            </p>

            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Data sources
            </h2>
            <div className="mt-3 rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden">
              {methodology.data_sources.map((s) => (
                <div key={s.name} className="px-5 py-4">
                  <div className="font-medium text-foreground">{s.name}</div>
                  <p className="text-sm text-foreground-muted mt-1">{s.used_for}</p>
                </div>
              ))}
            </div>

            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Backtest methodology
            </h2>
            <div className="mt-3 rounded-lg border border-border bg-surface px-5 py-4">
              <div className="text-sm text-foreground">
                Metric:{" "}
                <span className="font-mono text-foreground-muted">
                  {methodology.backtest.metric}
                </span>
              </div>
              <div className="text-sm text-foreground mt-2">
                Lag windows:{" "}
                {methodology.backtest.lag_windows
                  .map((w) => LAG_WINDOW_LABELS[w] ?? w)
                  .join(", ")}
              </div>
              <p className="text-sm text-foreground-muted mt-2">
                {methodology.backtest.notes}
              </p>
            </div>

            <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
              Limitations
            </h2>
            <ul className="mt-3 rounded-lg border border-border bg-surface px-5 py-4 space-y-2 list-disc list-inside">
              {methodology.limitations.map((l) => (
                <li key={l} className="text-sm text-foreground-muted">
                  {l}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
