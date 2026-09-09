"""FastAPI app. Serves companies.yaml metadata joined with composite OSS
Health Scores computed live from DuckDB on each request — cheap at this
data volume (a handful of repos, a year of weekly rows), so no caching
layer yet (that's a later stage once traffic/cost is a real concern).
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from oss_pulse.config import Company, load_companies
from oss_pulse.scoring.composite import compute_company_score, compute_repo_scores
from oss_pulse.storage.db import get_connection

app = FastAPI(title="OSS Pulse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _all_repos(companies: list[Company]) -> list[str]:
    return sorted({repo for company in companies for repo in company.repos})


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/companies")
def list_companies() -> list[dict]:
    companies = load_companies()
    con = get_connection()
    try:
        repo_scores = compute_repo_scores(con, _all_repos(companies))
    finally:
        con.close()

    return [
        {
            "ticker": c.ticker,
            "name": c.name,
            "tier": c.tier,
            "repos": c.repos,
            "caveat": c.caveat,
            "score": compute_company_score([repo_scores[r] for r in c.repos if r in repo_scores]),
            "trend_30d": None,  # needs historical composite scores, not just historical raw metrics
        }
        for c in companies
    ]


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
    finally:
        con.close()

    repo_breakdown = [repo_scores[r] for r in company.repos if r in repo_scores]

    return {
        "ticker": company.ticker,
        "name": company.name,
        "tier": company.tier,
        "repos": company.repos,
        "caveat": company.caveat,
        "score": compute_company_score(repo_breakdown),
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
