# OSS Pulse

A research/engineering demo that tracks open-source developer-activity metrics
(commit velocity, contributor retention, release cadence) for a curated set of
public companies, and backtests whether that activity correlates with forward
stock returns.

**This is not a trading system or investment advice.** See [`docs/spec.md`](docs/spec.md)
for the full spec, prior-art discussion, and the honest limitations this project
states explicitly. The starting point is a documented *negative* result (a 2026
SSRN paper found ~zero correlation between GitHub commit spikes and next-day
volatility for big tech). This project narrows scope to open-core companies and
longer horizons to see whether that fixes the signal or confirms the null result.

## Status

Core roadmap complete. Ingestion, scoring, backtest, and full dashboard
(leaderboard, detail, methodology, about pages) are all working end to end.
Remaining items are optional stretch goals, plus a deployment target still
to be chosen.

- [x] Stage 1: repo scaffold, companies.yaml, backend/frontend skeletons
- [x] Stage 2: GitHub API ingestion (commit/contributor/release data) into DuckDB
- [x] Stage 3: GitHub Actions scheduled ingestion (moved up so data keeps refreshing on its own)
- [x] Stage 4: FastAPI backend serving `/companies`, `/companies/{ticker}` from real data plus composite score
- [x] Stage 5: Next.js dark-mode leaderboard page (later replaced, see UI theme section below)
- [x] Stage 6: Company detail page (repo/sub-metric breakdown; price chart deferred to Stage 7)
- [x] Stage 7: yfinance price data and backtest (correlation, event study) plus the detail page's price chart
- [x] Stage 8: Methodology and About/disclaimer pages
- [ ] Stretch: BigQuery/GH Archive Phase 0 replication, dbt, Tier 2 confidence badges
- [ ] Stretch: GitLab API ingestion (GitLab has no actively-maintained repo on GitHub, so it's dropped from `companies.yaml` for now, see note below)

## Composite OSS Health Score

Computed live per request in `backend/src/oss_pulse/scoring/composite.py` from
whatever's in DuckDB. There is no separate batch scoring job yet. Six sub-metrics
per the spec, each 0-100 or `None` when there isn't enough history to compute it:

| Sub-metric | Base weight | Needs |
|---|---|---|
| Commit velocity trend | 35% | 8+ weeks of commit data (available now) |
| Contributor breadth | 25% | current contributor count (available now) |
| Release cadence | 20% | 2+ releases (unavailable for repos not using GitHub Releases, e.g. mongo, kafka) |
| Contributor retention | 10% | 2+ ingestion snapshots over time |
| Star/fork growth | 5% | 2+ ingestion snapshots over time |
| Issue backlog change | 5% | 2+ ingestion snapshots over time |

Missing sub-metrics are dropped and the remaining weights renormalized to
100%. They are never filled with a fake neutral value. As the Stage 3 daily
cron accumulates snapshots, the last three metrics phase in automatically.
A company with multiple repos (e.g. HashiCorp) gets the plain average of
its repos' composite scores.

## UI theme: light, Marble/Yahoo Finance-inspired (supersedes the original dark theme)

The site was originally built dark-mode (Copilot Money/Mercury reference, see
Stage 5). It was later flipped to a light theme on request (Marble
Investments and Yahoo Finance references): sharp-edged cards instead of
heavy rounding, a subtle animated market-line background
(`components/MarketLinesBackground.tsx`, pure CSS/SVG, no JS render loop),
Plus Jakarta Sans plus IBM Plex Mono fonts, and a real Yahoo-Finance-style
ticker strip (`GET /prices`, `components/TickerStrip.tsx`) showing live
stock prices site-wide. That strip uses actual price data with conventional
red/green coloring, since that's standard for raw price info and distinct
from our own derived health score, which deliberately stays off that
red/green-as-signal convention.

The contributor graph stays a dark panel on purpose even on the light site,
since that's Obsidian's native look. The theme tokens are plain CSS custom
properties, so `.graph-panel` in `globals.css` just locally overrides
`--background`/`--surface`/`--foreground`/etc. for that subtree rather than
needing every class in `ContributorGraph.tsx` rewritten.

## UI: search modal, dashboard layout, Obsidian-style graph

The dashboard was revamped after the initial build to match a trading-app
visual language (Kalshi/Yahoo Finance/TradingView references):

- **Global search** (`components/SearchModal.tsx`): a Cmd/Ctrl+K command
  palette, styled after TradingView's symbol search, with filter pills by
  tier/delisted status and keyboard navigation. It opens from the nav bar's
  search input on any page.
- **Homepage** (`app/page.tsx`, `components/Leaderboard.tsx`,
  `components/DashboardSidebar.tsx`): a two-column layout with a filterable
  leaderboard and inline sparklines (`recent_scores` from `/companies`) on
  the left, and a stats/movers sidebar on the right.
- **Contributor graph** (`components/ContributorGraph.tsx`): restyled to
  match Obsidian's actual graph view, with light monochrome nodes,
  directional arrows, and a real control panel (Filter, Groups legend,
  Display, Forces) whose sliders live-reconfigure the `d3-force` simulation
  (repel/center/link force, link distance, node size, link thickness, text
  fade threshold), plus an Animate button that reheats the simulation. This
  isn't cosmetic: dragging "Repel force" to max visibly respaces the whole
  graph.

## Trend indicator and the contributor graph

- **Trend direction** (`trend_direction` / `trend_magnitude` on `/companies`
  and `/companies/{ticker}`): reuses the same lookahead-safe weekly
  commit-velocity series the backtest computes, comparing the latest week
  to about 4 weeks prior. It is deliberately descriptive only ("trending
  up/down") and never a buy/sell/derivative recommendation. That framing
  was considered and explicitly rejected as inconsistent with this
  project's positioning.
- **Contributor graph** (`GET /companies/{ticker}/contributors`, rendered by
  `components/ContributorGraph.tsx`): a bipartite node graph of repo nodes
  and contributor nodes, where edges mean "contributes to." It's hand-rolled
  with `d3-force` for physics and an HTML canvas renderer, not a canned
  graph library, for full control over the theme and to avoid dependency
  compatibility risk on a bleeding-edge Next.js/React version. A contributor
  active on more than one of a company's tracked repos becomes a visible
  bridge node between clusters. For example, HashiCorp's `terraform` and
  `vault` share several real bridge contributors. This clusters by shared
  repo, not verified real-world collaboration, since no PR/co-review data is
  ingested.

## Backtest

`backend/src/oss_pulse/scoring/backtest.py` correlates forward stock returns
against **commit velocity only**, not the full 6-metric composite score.
Five of the six sub-metrics only started accumulating real history when the
Stage 3 cron began running. Commit velocity is the one metric GitHub already
gives us a genuine 52-week trailing history for. This is close to a direct
re-run of the SSRN paper the spec's Section 0 discusses (commit activity vs.
returns), with the fixes that paper's own diagnosis suggested: open-core
companies instead of big tech, and 1-week/1-month/1-quarter forward windows
instead of next-day volatility.

Lookahead-bias note: each weekly score point uses only data from *before*
that week (an 8-week recent average vs. the preceding 12-week baseline),
never the future. Sample sizes are small (~30 weekly points per company,
since we're limited to ~52 weeks of GitHub-provided commit history) and
explicitly reported alongside every correlation number.

**Delisted companies:** HashiCorp, Confluent, and Couchbase were all
acquired and taken private (by IBM, IBM, and Haveli Investments
respectively) after this project's knowledge was last updated, so genuinely
no public stock price exists for them anymore. They're still tracked for
OSS health, since their repos are real, active projects, but marked
`delisted` in `companies.yaml` and excluded from price ingestion and the
backtest, with an explicit "not applicable" reason shown in the UI rather
than silently omitted or faked.

## Scheduled ingestion

`.github/workflows/ingest.yml` runs the ingestion script daily (and on-demand
via the Actions tab's "Run workflow" button), then commits the refreshed
`backend/data/oss_pulse.duckdb` back to `main`. It uses the automatic
per-run `GITHUB_TOKEN` GitHub Actions provides, so no PAT secret is needed
since we're only reading public repo data.

The DuckDB file is intentionally committed to the repo, not gitignored, so a
deployed backend can serve it without its own database. The accepted
trade-off is binary diffs in git history on every run with new data. Repo
Settings, then Actions, then General, then Workflow permissions must allow
"Read and write permissions" for the commit-back step to be able to push.

## Known gaps

- **GitLab (GTLB)** is in the spec's Tier 1 list but isn't currently tracked. GitLab
  develops on gitlab.com, not GitHub. `gitlab-org/gitlab` and every `gitlab-runner`
  mirror on GitHub are stale, years-old snapshots with no real activity. Re-adding
  GitLab would mean a small second ingestion client against GitLab's own REST API,
  not a GitHub repo swap.

## Project layout

```
companies.yaml       # curated company -> repo mapping (source of truth)
backend/             # Python: ingestion, DuckDB storage, FastAPI
frontend/            # Next.js + TypeScript + Tailwind, light theme UI
```

## Backend setup

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.example` to `.env` at the repo root and fill in `GITHUB_TOKEN`
(see the PAT generation steps in the project notes: a fine-grained token
with "Public Repositories (read-only)" scope).

The committed `backend/data/oss_pulse.duckdb` already has real data from the
daily scheduled ingestion, so this step is optional unless you want to
refresh it yourself:

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

## Deployment

Once deployed, visitors just open the site's URL. Nobody needs a terminal,
and nothing needs "starting" the way local dev does. The backend always
serves its routes under `/api` (see `backend/main.py` and the `/api` prefix
in `backend/src/oss_pulse/api/main.py`), and the frontend's single
`getApiBase()` helper (`frontend/src/lib/apiUrl.ts`) is what makes both
deployment shapes below work from the same code, controlled entirely by the
`NEXT_PUBLIC_API_URL` environment variable.

### Option A: Vercel Services (one platform, one project)

Vercel can host both the Next.js frontend and the FastAPI backend as
separate "services" inside a single project, on one domain, with the
backend's `/api/*` routes and the frontend sharing an origin so there's no
cross-origin request at all.

1. Push this repo to GitHub if it isn't already there. `vercel.json` at the
   repo root defines the two services and the routing between them.
2. In Vercel, "Add New" then "Project," import this repo. Vercel should
   detect the `services` configuration in `vercel.json` automatically (the
   "Application Preset" shows "Services" with both a `frontend` and
   `backend` entry).
3. Set the environment variable `NEXT_PUBLIC_API_URL` to an empty string.
   This makes the frontend call relative `/api/...` paths, which Vercel's
   rewrite forwards to the backend service on the same domain. Next.js
   bakes `NEXT_PUBLIC_*` variables in at build time, so this has to be set
   before deploying, not after.
4. Deploy. One URL serves both pieces.

The backend's `main.py` shim at the repo's `backend/` root
(`from oss_pulse.api.main import app`) exists specifically so Vercel's
`entrypoint: "main:app"` setting can find the app object, since the real
code lives nested under `backend/src/`. DuckDB connections from the API
layer open `read_only=True` (see `storage/db.py`) because Vercel Functions
have a read-only filesystem outside of a scratch directory, and DuckDB's
normal connect mode tries to write a WAL file even for plain reads.

This is a newer Vercel feature, so if something about the Python build or
routing doesn't work as expected, Option B below is the fallback path and
needs no debugging of serverless Python internals.

### Option B: Render (backend) + Vercel (frontend), two platforms

1. In Render, choose "New" then "Blueprint," and point it at this repo.
   Render reads `render.yaml` at the repo root and configures the service
   automatically (root directory, build command, start command).
2. Render will prompt for `CORS_ALLOWED_ORIGINS` since that's marked
   `sync: false` in the blueprint. Leave it blank for now.
3. Deploy. Render gives you a URL like `https://oss-pulse-backend.onrender.com`.
   Copy it.
4. In Vercel, import this repo as a plain Next.js project with Root
   Directory set to `frontend` (not the "Services" preset).
5. Set `NEXT_PUBLIC_API_URL` to the Render URL from step 3 (no trailing
   slash, and not an empty string, since this is a separate origin).
6. Deploy. Vercel gives you a URL like `https://oss-pulse.vercel.app`.
7. Back on Render, set `CORS_ALLOWED_ORIGINS` to the Vercel URL from step 6
   and redeploy the backend. Without this, the browser blocks the
   frontend's cross-origin requests to the backend.

**Known limitation of Option B:** Render's free tier spins the service down
after 15 minutes of inactivity. The first request after a period of
idleness can take 30 to 60 seconds to wake it back up. Option A doesn't
have this specific issue, though serverless functions have their own
(usually much shorter) cold starts.

### Either way

The existing Stage 3 GitHub Actions cron keeps committing fresh data to
`main` daily, and both Render and Vercel redeploy automatically on every
push, so the data shown on the live site keeps refreshing without either of
us touching a terminal again.

## Cold-start loading state

Render's free tier sleeps the backend after inactivity, so the first request
after a while can take up to a minute. Each route that fetches from the
backend (`app/loading.tsx`, `app/companies/[ticker]/loading.tsx`,
`app/methodology/loading.tsx`) uses Next.js's built-in `loading.tsx`
convention to show a themed loading state during that wait, using
`react-spinners` for the actual spinner rather than a hand-rolled animation.
The root layout's ticker strip fetches independently in its own `<Suspense>`
boundary (`components/TickerStripLoader.tsx`), so a slow backend only delays
the ticker strip and page content, never the nav or disclaimer banner.
`lib/fetchWithTimeout.ts` bounds every server-side fetch to 65 seconds, so a
genuinely unreachable backend still falls through to the "couldn't reach
backend" message instead of hanging forever.

## Why these tools

- **DuckDB + Parquet** over a hosted Postgres: serverless, embedded OLAP,
  with no database to manage for this data volume.
- **FastAPI**: a thin, typed backend for serving pre-computed scores to the frontend.
- **Next.js**: dashboard with server and client rendering, styled as a light,
  professional trading-app dashboard (Marble Investments / Yahoo Finance
  references).
- **GitHub REST/GraphQL API first, BigQuery later**: avoids requiring a
  billing-enabled GCP project just to get an MVP running. BigQuery/GH Archive
  is added in the stretch phase for the Phase 0 SSRN replication, which needs
  bulk historical event data the REST API can't efficiently provide.
