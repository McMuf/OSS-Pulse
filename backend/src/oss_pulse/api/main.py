"""FastAPI app. Stage 1 scaffold only — endpoints return company metadata
from companies.yaml with placeholder scores. Real scoring lands in Stage 2/3.
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from oss_pulse.config import load_companies

app = FastAPI(title="OSS Pulse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/companies")
def list_companies() -> list[dict]:
    return [
        {
            "ticker": c.ticker,
            "name": c.name,
            "tier": c.tier,
            "repos": c.repos,
            "caveat": c.caveat,
            "score": None,
            "trend_30d": None,
        }
        for c in load_companies()
    ]


@app.get("/companies/{ticker}")
def get_company(ticker: str) -> dict:
    companies = {c.ticker: c for c in load_companies()}
    company = companies.get(ticker.upper())
    if company is None:
        raise HTTPException(status_code=404, detail=f"Unknown ticker: {ticker}")

    return {
        "ticker": company.ticker,
        "name": company.name,
        "tier": company.tier,
        "repos": company.repos,
        "caveat": company.caveat,
        "score_history": [],
        "sub_metrics": {},
    }
