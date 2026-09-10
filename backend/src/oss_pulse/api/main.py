"""FastAPI app. Serves companies.yaml metadata joined with composite OSS
Health Scores computed live from DuckDB on each request — cheap at this
data volume (a handful of repos, a year of weekly rows), so no caching
layer yet (that's a later stage once traffic/cost is a real concern).
"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from oss_pulse.config import Company, load_companies
from oss_pulse.scoring.backtest import company_weekly_scores, compute_backtest, compute_trend
from oss_pulse.scoring.composite import compute_company_score, compute_repo_scores
from oss_pulse.scoring.methodology import get_methodology
from oss_pulse.storage.db import get_connection

app = FastAPI(title="OSS Pulse API")

# CORS_ALLOWED_ORIGINS is a comma-separated list, e.g.
# "http://localhost:3000,https://oss-pulse.vercel.app" for local dev plus
# a deployed frontend. Defaults to localhost only so nothing needs to
# change for local development.
_default_origins = "http://localhost:3000"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _all_repos(companies: list[Company]) -> list[str]:
    return sorted({repo for company in companies for repo in company.repos})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/methodology")
def methodology() -> dict:
    return get_methodology()


@app.get("/companies")
def list_companies() -> list[dict]:
    companies = load_companies()
    con = get_connection()
    try:
        repo_scores = compute_repo_scores(con, _all_repos(companies))
        trends = {c.ticker: compute_trend(con, c.repos) for c in companies}
        recent_scores = {
            c.ticker: [s for _, s in company_weekly_scores(con, c.repos)][-8:] for c in companies
        }
    finally:
        con.close()

    return [
        {
            "ticker": c.ticker,
            "name": c.name,
            "tier": c.tier,
            "repos": c.repos,
            "caveat": c.caveat,
            "delisted": c.delisted,
            "delisted_note": c.delisted_note,
            "score": compute_company_score([repo_scores[r] for r in c.repos if r in repo_scores]),
            "trend_direction": trends[c.ticker].direction if trends[c.ticker] else None,
            "trend_magnitude": trends[c.ticker].magnitude if trends[c.ticker] else None,
            "recent_scores": recent_scores[c.ticker],
        }
        for c in companies
    ]


@app.get("/prices")
def list_prices() -> list[dict]:
    """Real latest stock price + day-over-day change for the ticker strip —
    separate from /companies since it's simple raw price data, not a
    computed health score.
    """
    companies = [c for c in load_companies() if not c.delisted]
    con = get_connection()
    try:
        result = []
        for c in companies:
            rows = con.execute(
                "SELECT date, close FROM stock_price WHERE ticker = ? ORDER BY date DESC LIMIT 15",
                [c.ticker],
            ).fetchall()
            if not rows:
                continue
            closes = [r[1] for r in reversed(rows)]
            latest = closes[-1]
            previous = closes[-2] if len(closes) >= 2 else None
            change_pct = (latest - previous) / previous if previous else None
            result.append(
                {
                    "ticker": c.ticker,
                    "name": c.name,
                    "price": latest,
                    "change_pct": change_pct,
                    "recent_prices": closes,
                }
            )
    finally:
        con.close()

    return result


@app.get("/companies/{ticker}")
def get_company(ticker: str) -> dict:
    all_companies = load_companies()
    companies = {c.ticker: c for c in all_companies}
    company = companies.get(ticker.upper())
    if company is None:
        raise HTTPException(status_code=404, detail=f"Unknown ticker: {ticker}")

    # Contributor breadth is normalized against the whole tracked universe,
    # not just this company's repo(s) — otherwise a single-repo company
    # always gets a meaningless default of 50 (min == max of one value).
    con = get_connection()
    try:
        repo_scores = compute_repo_scores(con, _all_repos(all_companies))
        trend = compute_trend(con, company.repos)
    finally:
        con.close()

    repo_breakdown = [repo_scores[r] for r in company.repos if r in repo_scores]

    return {
        "ticker": company.ticker,
        "name": company.name,
        "tier": company.tier,
        "repos": company.repos,
        "caveat": company.caveat,
        "delisted": company.delisted,
        "delisted_note": company.delisted_note,
        "score": compute_company_score(repo_breakdown),
        "trend_direction": trend.direction if trend else None,
        "trend_magnitude": trend.magnitude if trend else None,
        "repo_breakdown": [
            {
                "repo": rs.repo,
                "composite_score": rs.composite_score,
                "sub_scores": rs.sub_scores,
                "metrics_available": rs.metrics_available,
                "metrics_pending": rs.metrics_pending,
            }
            for rs in repo_breakdown
        ],
        "score_history": [],  # Stage 6/7: needs scores persisted over time, not just live-computed
    }


@app.get("/companies/{ticker}/contributors")
def get_contributors(ticker: str) -> dict:
    companies = {c.ticker: c for c in load_companies()}
    company = companies.get(ticker.upper())
    if company is None:
        raise HTTPException(status_code=404, detail=f"Unknown ticker: {ticker}")

    con = get_connection()
    try:
        repos_data = []
        for repo in company.repos:
            rows = con.execute(
                """
                SELECT login, contributions FROM contributor_snapshot
                WHERE repo = ?
                QUALIFY ROW_NUMBER() OVER (PARTITION BY login ORDER BY fetched_at DESC) = 1
                ORDER BY contributions DESC
                """,
                [repo],
            ).fetchall()
            repos_data.append(
                {
                    "repo": repo,
                    "contributors": [
                        {"login": login, "contributions": contributions}
                        for login, contributions in rows
                    ],
                }
            )
    finally:
        con.close()

    return {"ticker": company.ticker, "repos": repos_data}


@app.get("/companies/{ticker}/backtest")
def get_backtest(ticker: str) -> dict:
    companies = {c.ticker: c for c in load_companies()}
    company = companies.get(ticker.upper())
    if company is None:
        raise HTTPException(status_code=404, detail=f"Unknown ticker: {ticker}")

    if company.delisted:
        return {
            "ticker": company.ticker,
            "applicable": False,
            "reason": company.delisted_note or "Company is no longer publicly traded.",
        }

    con = get_connection()
    try:
        result = compute_backtest(con, company.ticker, company.repos)
        price_rows = con.execute(
            "SELECT date, close FROM stock_price WHERE ticker = ? ORDER BY date",
            [company.ticker],
        ).fetchall()
    finally:
        con.close()

    return {
        "ticker": company.ticker,
        "applicable": True,
        "metric": result.metric,
        "weekly_points": result.weekly_points,
        "weekly_scores": [
            {"week": week.isoformat(), "score": score} for week, score in result.weekly_scores
        ],
        "price_history": [{"date": d.isoformat(), "close": c} for d, c in price_rows],
        "lag_windows": {
            label: {"n": lag.n, "correlation": lag.correlation}
            for label, lag in result.lag_windows.items()
        },
        "event_study": (
            {
                "threshold": result.event_study.threshold,
                "n_events": result.event_study.n_events,
                "avg_forward_return_after_drop": result.event_study.avg_forward_return_after_drop,
                "avg_forward_return_baseline": result.event_study.avg_forward_return_baseline,
                "n_baseline": result.event_study.n_baseline,
            }
            if result.event_study
            else None
        ),
    }
