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

Core roadmap complete — ingestion, scoring, backtest, and full dashboard
(leaderboard, detail, methodology, about pages) are all working end to end.
Remaining items are optional stretch goals, plus a deployment target still
to be chosen.

- [x] Stage 1 — repo scaffold, companies.yaml, backend/frontend skeletons
- [x] Stage 2 — GitHub API ingestion (commit/contributor/release data) → DuckDB
- [x] Stage 3 — GitHub Actions scheduled ingestion (moved up so data keeps refreshing on its own)
- [x] Stage 4 — FastAPI backend serving `/companies`, `/companies/{ticker}` from real data + composite score
- [x] Stage 5 — Next.js dark-mode leaderboard page
- [x] Stage 6 — Company detail page (repo/sub-metric breakdown; price chart deferred to Stage 7)
- [x] Stage 7 — yfinance price data + backtest (correlation, event study) + the detail page's price chart
- [x] Stage 8 — Methodology + About/disclaimer pages
- [ ] Stretch — BigQuery/GH Archive Phase 0 replication, dbt, Tier 2 confidence badges
- [ ] Stretch — GitLab API ingestion (GitLab has no actively-maintained repo on GitHub; dropped from `companies.yaml` for now, see note below)

## Composite OSS Health Score

Computed live per request in `backend/src/oss_pulse/scoring/composite.py` from
whatever's in DuckDB — no separate batch scoring job yet. Six sub-metrics per
the spec, each 0-100 or `None` when there isn't enough history to compute it:

| Sub-metric | Base weight | Needs |
|---|---|---|
| Commit velocity trend | 35% | 8+ weeks of commit data (available now) |
| Contributor breadth | 25% | current contributor count (available now) |
| Release cadence | 20% | 2+ releases (unavailable for repos not using GitHub Releases, e.g. mongo, kafka) |
| Contributor retention | 10% | 2+ ingestion snapshots over time |
| Star/fork growth | 5% | 2+ ingestion snapshots over time |
| Issue backlog change | 5% | 2+ ingestion snapshots over time |

Missing sub-metrics are dropped and the remaining weights renormalized to
100% — not filled with a fake neutral value. As the Stage 3 daily cron
accumulates snapshots, the last three metrics phase in automatically.
A company with multiple repos (e.g. HashiCorp) gets the plain average of
its repos' composite scores.

## Backtest

`backend/src/oss_pulse/scoring/backtest.py` correlates forward stock returns
against **commit velocity only** — not the full 6-metric composite score.
Five of the six sub-metrics only started accumulating real history when the
Stage 3 cron began running; commit velocity is the one metric GitHub already
gives us a genuine 52-week trailing history for. This is close to a direct
re-run of the SSRN paper the spec's §0 discusses (commit activity vs.
returns), with the fixes that paper's own diagnosis suggested: open-core
companies instead of big tech, and 1-week/1-month/1-quarter forward windows
instead of next-day volatility.

Lookahead-bias note: each weekly score point uses only data from *before*
that week (an 8-week recent average vs. the preceding 12-week baseline) —
never the future. Sample sizes are small (~30 weekly points per company,
since we're limited to ~52 weeks of GitHub-provided commit history) and
explicitly reported alongside every correlation number.

**Delisted companies:** HashiCorp, Confluent, and Couchbase were all
acquired and taken private (by IBM, IBM, and Haveli Investments
respectively) after this project's knowledge was last updated — genuinely
no public stock price exists for them anymore. They're still tracked for
OSS health (their repos are real, active projects), but marked `delisted`
in `companies.yaml` and excluded from price ingestion and the backtest,
with an explicit "not applicable" reason shown in the UI rather than
silently omitted or faked.

## Scheduled ingestion

`.github/workflows/ingest.yml` runs the ingestion script daily (and on-demand
via the Actions tab's "Run workflow" button), then commits the refreshed
`backend/data/oss_pulse.duckdb` back to `main`. It uses the automatic
per-run `GITHUB_TOKEN` GitHub Actions provides — no PAT secret needed, since
we're only reading public repo data.

The DuckDB file is intentionally committed to the repo (not gitignored) so a
future deployed backend can serve it without its own database — accepted
trade-off: binary diffs in git history on every run with new data. Repo
Settings → Actions → General → Workflow permissions must allow "Read and
write permissions" for the commit-back step to be able to push.

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
