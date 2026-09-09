# OSS Pulse — GitHub Developer-Activity Signal
### Project Spec v1

**Working thesis:** the health of a company's core open-source repositories (commit velocity, contributor retention, release cadence) is a public, real-time-ish leading indicator of engineering/product health — and by extension, a signal worth tracking alongside the stock. This is *most* defensible for open-core/dev-tool companies where the OSS repo essentially *is* the product, and weaker (but still an interesting narrative) for big-tech flagship projects like React or Kubernetes.

This is a research/engineering demonstration project, not a trading system. Say that explicitly on the site — it's a credibility signal, not a hedge.

---

## 0. Prior art — what's already been tried, and why it failed

This isn't an undiscovered idea. Some of it has already been tested and shown not to work at the naive scope, and some of it is a mature, mainstream metric in an adjacent market. Both facts should shape the build and the pitch.

**A near-identical experiment already exists, and got a null result.** Subhas Angara, "Developer Activity as an Indicator: The Effect of GitHub Commit Frequency on Short-Term Stock Price Fluctuations in Major Technology Companies" (SSRN, 2026): https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6949799. Reads as an unpublished/student working paper, not peer-reviewed — small in scope but methodologically on point.

- **Setup:** 9 major tech companies, ~405 total data points, a custom commit-spike ("ACF") score, tested against *next-day* volatility via Pearson correlation and OLS regression.
- **Result:** essentially zero correlation in aggregate (r = 0.002, p = 0.963); no predictive power once trading volume and past price trends were controlled for.
- **Author's own diagnosis:** large tech companies do most of their real engineering in private repos — the public GitHub org mostly reflects PR-adjacent open source, not the actual product.

**Four stacked bottlenecks, and the fix each one implies for this project:**

| Bottleneck in the SSRN paper | Fix applied here |
|---|---|
| Wrong companies — big tech, core work is private | Tier 1 open-core companies (§2) where the public repo *is* the shipped product |
| Wrong target — next-day volatility (near-random-walk at that horizon) | Forward returns at 1-month/1-quarter horizons, plus an event study around large score changes |
| Tiny sample — 9 companies, ~405 points | Full GH Archive history, multi-year, ~15–20 companies |
| Shallow feature — one spike-detection metric | Composite Health Score across multiple independent signals (§4) |

**Related but distinct prior work, for context:**
- A 2026 *European Journal of Information Systems* study of 536 publicly listed OSS-hosting firms found external contributions to a firm's open-source projects raise long-run market valuation (Tobin's q) — a slow, structural relationship over quarters/years, not a short-term trading signal. Different mechanism, same underlying data source.
- The private-company version of this thesis is already commercialized: tools like VC Deal Flow Signal treat GitHub commit-velocity acceleration as an early signal of startup momentum ahead of a funding round.
- Developer activity as a "health metric" is completely mainstream in crypto — TradingView, IntoTheBlock, and CryptoScores have tracked GitHub commit/contributor metrics as token-health indicators for years.
- General-purpose repo analytics dashboards already exist (e.g. OSS Insight, built on GH Archive) but stop at repo health — none tie it to a company's stock price the way this project does.

**What this means for the build:** don't pitch this as an undiscovered signal — pitch it as a controlled replication-and-fix of a documented negative result. See the Phase 0 addition in §9.

---

## 1. Demo medium & UX

Deployed web dashboard, not a notebook. Structure:

- **Landing / leaderboard page** — grid of tracked companies with a current "OSS Health Score" (0–100) and 30-day trend arrow.
- **Company detail page** — dual-axis time-series chart (OSS Health Score vs. stock price), a breakdown of the sub-metrics feeding the score, and a backtest panel (lagged correlation, event study around big score drops).
- **Methodology / architecture walkthrough page** — mirrors the format you're using on the matching engine project. Explain the pipeline, the data sources, and — importantly — the limitations. This page is what a technical interviewer will actually read closely.
- **About / disclaimer** — one paragraph, always visible: this is a research tool, not investment advice, no transaction costs modeled, small sample sizes, correlation ≠ causation.

---

## 2. Company / repo universe (v1)

Don't try to cover the whole market — curate ~15–20 tickers where the OSS-to-business link is direct and easy to explain in an interview.

**Tier 1 — open-core companies where the repo *is* the product** (cleanest signal):
- MongoDB (MDB) — `mongodb/mongo`
- Elastic (ESTC) — `elastic/elasticsearch`
- GitLab (GTLB) — `gitlab-org/gitlab`
- Confluent (CFLT) — `apache/kafka` (steward, not sole owner — note this caveat on the site)
- HashiCorp (HCP) — `hashicorp/terraform`, `hashicorp/vault`
- Cloudflare (NET) — several OSS tools, weaker single-repo mapping
- JFrog (FROG), Couchbase (BASE) — smaller-cap, higher volatility, good for the backtest's variance

**Tier 2 — flagship OSS project as a proxy for a larger company** (noisier, but more recognizable narrative):
- Meta (META) — `facebook/react`, `pytorch/pytorch`
- Google (GOOGL) — `kubernetes/kubernetes`, `tensorflow/tensorflow`, `angular/angular`
- Microsoft (MSFT) — `microsoft/vscode`, `microsoft/TypeScript`

Keep the mapping in a single version-controlled config file (`companies.yaml`), not hardcoded — this is also where you'd note the caveat level (Tier 1 vs Tier 2) per company, which the frontend can surface as a confidence badge.

---

## 3. Data sources

| Source | What it gives you | Access |
|---|---|---|
| **GH Archive** (via Google BigQuery public dataset) | Historical commit, PR, issue, and release events at scale | Free tier (~1TB query/month); query the date-sharded tables (`githubarchive.day.YYYYMMDD`), always filter by repo name and date range to control cost |
| **GitHub REST/GraphQL API** | Current stars, forks, contributor list, release tags | Free with a personal access token, 5,000 req/hr — cache aggressively, use ETags for conditional requests |
| **Stock price data** | Daily close for mapped tickers | `yfinance` (free, unofficial) to start; swap to Alpha Vantage or Polygon.io free tier if you want more reliability |
| **Company↔repo mapping** | Your own curated config | `companies.yaml`, hand-maintained, versioned in the repo |

---

## 4. Metrics & signal design

Compute per repo, rolled up to a per-company composite score:

1. **Commit velocity** — rolling weekly commit count, trend vs. its own trailing average
2. **Unique contributor count** — distinct committers per period (raw activity breadth)
3. **Contributor retention/churn** — are the same top-N historical contributors still active, or has the core group gone quiet
4. **Star/fork growth rate** — community interest (note: laggy and somewhat gameable, weight it low)
5. **Issue/PR response latency & backlog growth** — proxy for team bandwidth/health
6. **Release cadence** — time between tagged releases
7. **Composite OSS Health Score** — weighted, normalized 0–100 combination of the above; document the weights transparently on the methodology page (this transparency is itself a good interview talking point — shows you're not black-boxing it)

**Backtest module:**
- Align the Health Score time series with forward stock returns at a few lag windows (e.g., 1-week, 1-month, 1-quarter forward)
- Report simple correlation coefficients per company and in aggregate
- Run an event study: what happens to forward returns in the N days after a sharp Health Score drop, vs. a random baseline
- Be honest in the write-up about small sample size and multiple-comparisons risk — this is a portfolio project, not a paper, but treating it with that level of rigor is exactly what makes it stand out

**Ethics/privacy note:** don't build a feature that names and publicly flags individual engineers as having "left." Track aggregate contributor-count churn, not named individuals — the data is public, but singling people out for a public "brain drain" dashboard is a bad look and adds nothing to the signal.

---

## 5. System architecture

```
[GH Archive on BigQuery]  [GitHub API]  [yfinance]
         |                    |              |
         └──────────► Ingestion job (daily, scheduled) ◄──────────┘
                              |
                    Storage: DuckDB + Parquet
                    (or Postgres if you want a hosted DB)
                              |
                Transform layer: pandas / duckdb SQL
                (optionally dbt — see note below)
                              |
                    Feature engineering + scoring
                              |
                     Backend API (FastAPI)
                              |
                  Frontend (Next.js + Recharts/Visx)
                              |
                        Deployed dashboard
```

**Why DuckDB:** it's a modern, serverless, embedded OLAP engine — no hosted database to manage, fast on this data volume, and it's a tool that signals you're aware of current data-engineering practice rather than just reaching for Postgres by default.

**Optional: use dbt for the transform layer.** Not required for v1, but if you want to explicitly target Plaid/Wealthsimple-style data roles, adding a small dbt project on top of the raw ingested tables (staging → intermediate → mart models) directly mirrors their actual stack and is an easy "I used the same tools you do" talking point in an interview.

**Scheduling:** a GitHub Actions cron workflow triggering the daily ingestion job is enough — free, simple, and "productionized a scheduled ETL pipeline in CI" is a legitimate resume line on its own.

---

## 6. Tech stack

- **Ingestion/ETL:** Python, `google-cloud-bigquery`, `PyGithub` or raw GraphQL queries, `yfinance`
- **Storage:** DuckDB + Parquet files (swap to Postgres later if needed)
- **Transform (optional):** dbt-duckdb
- **Backend API:** FastAPI
- **Frontend:** Next.js + TypeScript, Recharts or Visx for charts, Tailwind for styling
- **Scheduling:** GitHub Actions (cron trigger)
- **Deployment:** frontend on Vercel; backend + DuckDB file on Render, Fly.io, or Railway (small container, cheap/free tier)

---

## 7. API design (backend)

- `GET /companies` — list tracked companies with current score + trend
- `GET /companies/{ticker}` — full metric history + composite score time series
- `GET /companies/{ticker}/backtest` — correlation stats, event-study results
- `GET /companies/{ticker}/repos` — per-repo breakdown feeding the composite score
- `GET /methodology` — scoring weights and data lineage, served as structured JSON the frontend renders on the methodology page (keeps the weights in one source of truth instead of hardcoded in the frontend)

---

## 8. Limitations to state explicitly on the site

- OSS metrics are noisy and somewhat gameable (bot commits, mirrored/forked repos, corporate-mandated commit patterns)
- No transaction costs, slippage, or execution latency modeled in the backtest
- Small sample size across a curated universe — not statistically robust, and not meant to be
- Correlation shown is not evidence of a tradeable edge; public alt-data signals decay quickly once they're known
- This is a research and data-engineering demonstration, not investment advice

Stating this clearly is not a weakness — it's the thing that separates this from an AltIndex-style "AI Score" product and reads as quant maturity to anyone technical who looks at it.

---

## 9. Build roadmap

**Phase 0 (~2–3 days):** reproduce the naive SSRN setup (§0) on your own pipeline — a couple of big-tech tickers, raw commit counts, next-day volatility — and confirm you get the same near-null result. This is your baseline and your evidence that the fixes in Phases 1–2 are doing something, not just re-dressing the same failed test.

**Phase 1 (MVP, ~2 weeks):** ingestion pipeline for 5–6 Tier 1 companies, DuckDB storage, basic composite score, single-page dashboard with one chart per company, no backtest yet.

**Phase 2 (~1–2 weeks):** full company universe, backend API, methodology page, backtest module with correlation stats.

**Phase 3 (stretch):** dbt transform layer, event-study visualization, GitHub Actions scheduled refresh, contributor-retention metric, Tier 2 companies added with confidence badges.

---

## 10. How to talk about it in interviews

Lead with the pipeline, not the "signal." The story is: *large-scale data ingestion from a public event archive, a from-scratch scoring methodology with documented weights, a backend API, and a deployed full-stack dashboard* — with a backtest you're honest about the limits of. That's a data-engineering + product story that works for a bank tech-analyst interview, a Plaid data-infra interview, and a Wealthsimple DSE interview without changing the pitch, just which part you lead with.

The Phase 0 replication (§0, §9) is worth mentioning explicitly if asked "how do you know this isn't nonsense" — the honest answer is that you found a documented negative result, reproduced it, diagnosed why it failed, and tested a specific fix. That's a stronger answer than any claim about the signal itself.
