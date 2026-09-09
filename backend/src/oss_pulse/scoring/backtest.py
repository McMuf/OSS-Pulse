"""Backtest: does our one sub-metric with real history (commit velocity)
correlate with forward stock returns?

This is deliberately NOT a backtest of the full composite Health Score —
five of its six sub-metrics only started accumulating real history when
Stage 3's daily cron began running, so there's no past to reconstruct them
from yet. Commit velocity is the exception: GitHub's stats endpoint gives
every repo a genuine 52-week trailing histogram already. Treat this as
close to a direct re-run of the SSRN paper this project set out to
replicate-and-fix (spec section 0) — same core idea (commit activity vs.
returns), fixed sample size and horizon, one company universe.

Lookahead-bias note: a score "as of" week i must only use data from weeks
<= i. We compare the mean of the 8 weeks immediately before i against the
12 weeks before THAT — both windows are strictly historical relative to i.
This is different from the live composite score's commit_velocity metric,
which compares "now" against the full 52-week average (fine for a live
score, not fine for a backtest that must not peek at the future).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import duckdb
import numpy as np

RECENT_WINDOW = 8
BASELINE_WINDOW = 12
MIN_WEEKS_REQUIRED = RECENT_WINDOW + BASELINE_WINDOW  # 20

LAG_WINDOWS_DAYS = {
    "1_week": 7,
    "1_month": 30,
    "1_quarter": 91,
}

SHARP_DROP_THRESHOLD = -20.0  # velocity score points, week-over-week


def _velocity_score_series(counts: list[int]) -> list[float | None]:
    """One score per week index. None for the first MIN_WEEKS_REQUIRED-1
    weeks, where there isn't enough purely-historical data yet.
    """
    scores: list[float | None] = [None] * len(counts)
    for i in range(MIN_WEEKS_REQUIRED, len(counts)):
        recent = counts[i - RECENT_WINDOW : i]
        baseline = counts[i - MIN_WEEKS_REQUIRED : i - RECENT_WINDOW]
        baseline_avg = sum(baseline) / len(baseline)
        if baseline_avg == 0:
            continue
        recent_avg = sum(recent) / len(recent)
        ratio = recent_avg / baseline_avg
        scores[i] = max(0.0, min(100.0, 50 + (ratio - 1) * 50))
    return scores


def _repo_weekly_scores(con: duckdb.DuckDBPyConnection, repo: str) -> list[tuple[date, float]]:
    rows = con.execute(
        "SELECT week_start, commit_count FROM commit_weekly WHERE repo = ? ORDER BY week_start",
        [repo],
    ).fetchall()
    weeks = [r[0] for r in rows]
    counts = [r[1] for r in rows]
    scores = _velocity_score_series(counts)
    return [(w, s) for w, s in zip(weeks, scores) if s is not None]


def _company_weekly_scores(
    con: duckdb.DuckDBPyConnection, repos: list[str]
) -> list[tuple[date, float]]:
    """Average across a company's repos for weeks where at least one has a score."""
    by_week: dict[date, list[float]] = {}
    for repo in repos:
        for week, score in _repo_weekly_scores(con, repo):
            by_week.setdefault(week, []).append(score)
    return sorted((week, sum(vals) / len(vals)) for week, vals in by_week.items())


def _price_on_or_after(con: duckdb.DuckDBPyConnection, ticker: str, day: date) -> float | None:
    row = con.execute(
        "SELECT close FROM stock_price WHERE ticker = ? AND date >= ? ORDER BY date LIMIT 1",
        [ticker, day],
    ).fetchone()
    return row[0] if row else None


@dataclass
class LagResult:
    n: int
    correlation: float | None


@dataclass
class EventStudyResult:
    threshold: float
    n_events: int
    avg_forward_return_after_drop: float | None
    avg_forward_return_baseline: float
    n_baseline: int


@dataclass
class BacktestResult:
    metric: str
    weekly_points: int
    weekly_scores: list[tuple[date, float]]
    lag_windows: dict[str, LagResult]
    event_study: EventStudyResult | None


def compute_backtest(
    con: duckdb.DuckDBPyConnection, ticker: str, repos: list[str]
) -> BacktestResult:
    weekly_scores = _company_weekly_scores(con, repos)

    lag_results: dict[str, LagResult] = {}
    # (week, score, forward_return) for whichever weeks have a computable
    # 1-month forward return — kept explicit (not re-derived by position)
    # so the event study below can't misalign week to return.
    monthly_points: list[tuple[date, float, float]] = []

    for label, days_ahead in LAG_WINDOWS_DAYS.items():
        score_return_pairs: list[tuple[float, float]] = []
        for week, score in weekly_scores:
            start_price = _price_on_or_after(con, ticker, week)
            end_price = _price_on_or_after(con, ticker, week + timedelta(days=days_ahead))
            if start_price is None or end_price is None or start_price == 0:
                continue
            forward_return = (end_price - start_price) / start_price
            score_return_pairs.append((score, forward_return))
            if label == "1_month":
                monthly_points.append((week, score, forward_return))

        if len(score_return_pairs) < 3:
            lag_results[label] = LagResult(n=len(score_return_pairs), correlation=None)
            continue

        scores_arr = np.array([p[0] for p in score_return_pairs])
        returns_arr = np.array([p[1] for p in score_return_pairs])
        corr = float(np.corrcoef(scores_arr, returns_arr)[0, 1])
        lag_results[label] = LagResult(n=len(score_return_pairs), correlation=corr)

    event_study = None
    if len(weekly_scores) >= 2 and monthly_points:
        score_by_week = dict(weekly_scores)
        weeks_sorted = [w for w, _ in weekly_scores]
        week_index = {week: i for i, week in enumerate(weeks_sorted)}

        drop_events = []
        baseline_events = []
        for week, _, forward_return in monthly_points:
            idx = week_index[week]
            if idx == 0:
                continue  # no prior scored week to diff against
            change = score_by_week[week] - score_by_week[weeks_sorted[idx - 1]]
            if change <= SHARP_DROP_THRESHOLD:
                drop_events.append(forward_return)
            else:
                baseline_events.append(forward_return)

        if baseline_events:
            event_study = EventStudyResult(
                threshold=SHARP_DROP_THRESHOLD,
                n_events=len(drop_events),
                avg_forward_return_after_drop=(
                    sum(drop_events) / len(drop_events) if drop_events else None
                ),
                avg_forward_return_baseline=sum(baseline_events) / len(baseline_events),
                n_baseline=len(baseline_events),
            )

    return BacktestResult(
        metric="commit_velocity_only",
        weekly_points=len(weekly_scores),
        weekly_scores=weekly_scores,
        lag_windows=lag_results,
        event_study=event_study,
    )
