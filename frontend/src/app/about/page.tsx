export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1">
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          About
        </h1>

        <div className="mt-6 rounded-sm border border-border bg-surface px-5 py-4">
          <p className="text-sm text-foreground">
            OSS Pulse is a research and data-engineering demonstration
            project. It is <span className="font-medium">not</span> a trading
            system, and nothing on this site is investment advice. No
            transaction costs are modeled, sample sizes are small by design,
            and correlation shown here is not evidence of a tradeable edge.
          </p>
        </div>

        <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
          The thesis
        </h2>
        <p className="mt-3 text-sm text-foreground-muted">
          The working idea: a company&apos;s public open-source repository
          activity (commit velocity, contributor retention, release cadence)
          is a real-time-ish, public signal of engineering health. It is most
          defensible for open-core companies where the repo essentially{" "}
          <em>is</em> the product. For big-tech flagship projects like React
          or Kubernetes, the signal is weaker but still an interesting
          narrative.
        </p>

        <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
          This isn&apos;t a new idea, and that&apos;s the point
        </h2>
        <p className="mt-3 text-sm text-foreground-muted">
          A 2026 SSRN working paper tested almost this exact thesis on 9 major
          tech companies and found essentially zero correlation between
          GitHub commit spikes and next-day stock volatility. Its own
          diagnosis: large tech companies do most of their real engineering
          in private repos, so the public GitHub org doesn&apos;t reflect the
          actual product.
        </p>
        <p className="mt-3 text-sm text-foreground-muted">
          This project is a controlled replication and fix of that result,
          not a claim of an undiscovered signal. It tracks open-core
          companies where the repo genuinely is the product, uses longer
          forward windows instead of next-day volatility, and reports sample
          sizes and correlation honestly rather than only when they look
          good. See{" "}
          <a
            href="https://github.com/McMuf/OSS-Pulse/blob/main/docs/spec.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-accent transition-colors underline"
          >
            the full project spec
          </a>{" "}
          for the complete prior-art discussion, and the{" "}
          <a href="/methodology" className="text-foreground hover:text-accent transition-colors underline">
            methodology page
          </a>{" "}
          for exactly how the numbers on this site are computed.
        </p>

        <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
          What this actually is, engineering-wise
        </h2>
        <p className="mt-3 text-sm text-foreground-muted">
          Large-scale ingestion from the GitHub API and yfinance, a
          from-scratch scoring methodology with weights documented (not
          hardcoded in the frontend), a scheduled CI pipeline that keeps the
          data current, a backend API, and a full-stack dashboard. It
          includes a backtest this project is upfront about the limits of.
          There is no custom-trained model here; this is a plain
          data-engineering and orchestration project.
        </p>

        <h2 className="mt-10 text-sm font-medium text-foreground-muted uppercase tracking-wide">
          Source
        </h2>
        <p className="mt-3 text-sm text-foreground-muted">
          <a
            href="https://github.com/McMuf/OSS-Pulse"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-accent transition-colors underline"
          >
            github.com/McMuf/OSS-Pulse
          </a>
        </p>
      </main>
    </div>
  );
}
