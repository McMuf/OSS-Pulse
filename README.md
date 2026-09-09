# OSS Pulse

A research/engineering demo that tracks open-source developer-activity metrics
(commit velocity, contributor retention, release cadence) for a curated set of
public companies, and backtests whether that activity correlates with forward
stock returns.

**This is not a trading system or investment advice.** See [`docs/spec.md`](docs/spec.md)
for the full spec, prior-art discussion, and the honest limitations this project
states explicitly. The starting point is a documented *negative* result (a 2026
SSRN paper found ~zero correlation between GitHub commit spikes and next-day
volatility for big tech); this project narrows scope to open-core companies and
longer horizons to see whether that fixes the signal or confirms the null result.

## Status

Early scaffold. Following the staged build order below — each stage ends with a
commit before moving to the next.

- [x] Stage 1 — repo scaffold, companies.yaml, backend/frontend skeletons
- [x] Stage 2 — GitHub API ingestion (commit/contributor/release data) → DuckDB
- [ ] Stage 3 — GitHub Actions scheduled ingestion (moved up so data keeps refreshing on its own)
- [ ] Stage 4 — FastAPI backend serving `/companies`, `/companies/{ticker}` from real data + composite score
- [ ] Stage 5 — Next.js dark-mode leaderboard page
- [ ] Stage 6 — Company detail page (health score vs. stock price chart)
- [ ] Stage 7 — yfinance price data + backtest (correlation, event study)
- [ ] Stage 8 — Methodology + About/disclaimer pages
- [ ] Stretch — BigQuery/GH Archive Phase 0 replication, dbt, Tier 2 confidence badges
- [ ] Stretch — GitLab API ingestion (GitLab has no actively-maintained repo on GitHub; dropped from `companies.yaml` for now, see note below)

## Known gaps

- **GitLab (GTLB)** is in the spec's Tier 1 list but isn't currently tracked. GitLab
  develops on gitlab.com, not GitHub — `gitlab-org/gitlab` and every `gitlab-runner`
  mirror on GitHub are stale, years-old snapshots with no real activity. Re-adding
  GitLab would mean a small second ingestion client against GitLab's own REST API,
  not a GitHub repo swap.

## Project layout

```
companies.yaml       # curated company → repo mapping (source of truth)
backend/             # Python: ingestion, DuckDB storage, FastAPI
frontend/            # Next.js + TypeScript + Tailwind + Recharts, dark mode UI
```

## Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.example` to `.env` at the repo root and fill in `GITHUB_TOKEN`
(see the PAT generation steps in the project notes — fine-grained token,
"Public Repositories (read-only)" scope).

Run ingestion to pull fresh GitHub data into DuckDB (`backend/data/oss_pulse.duckdb`,
gitignored — rebuilt from source each run, not a checked-in artifact):

```powershell
$env:PYTHONPATH="src"
.venv\Scripts\python.exe -m oss_pulse.ingestion.run
```

## Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

## Why these tools

- **DuckDB + Parquet** over a hosted Postgres: serverless, embedded OLAP,
  no database to manage for this data volume.
- **FastAPI**: thin, typed backend for serving pre-computed scores to the frontend.
- **Next.js + Recharts**: dashboard with server + client rendering, dark-mode
  UI styled after Mercury / Copilot Money / Wealthsimple / Robinhood.
- **GitHub REST/GraphQL API first, BigQuery later**: avoids requiring a
  billing-enabled GCP project just to get an MVP running; BigQuery/GH Archive
  is added in the stretch phase for the Phase 0 SSRN replication, which needs
  bulk historical event data the REST API can't efficiently provide.
