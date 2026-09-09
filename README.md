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
- [ ] Stage 2 — GitHub API ingestion (commit/contributor/release data) → DuckDB
- [ ] Stage 3 — FastAPI backend serving `/companies`, `/companies/{ticker}`
- [ ] Stage 4 — Next.js dark-mode leaderboard page
- [ ] Stage 5 — Company detail page (health score vs. stock price chart)
- [ ] Stage 6 — yfinance price data + backtest (correlation, event study)
- [ ] Stage 7 — Methodology + About/disclaimer pages
- [ ] Stage 8 — GitHub Actions scheduled ingestion
- [ ] Stretch — BigQuery/GH Archive Phase 0 replication, dbt, Tier 2 confidence badges

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
