"""Composite OSS Health Score (spec section 4).

Each sub-metric returns a 0-100 score or None when we don't have enough
history to compute it yet. The composite is a weighted average over
whichever sub-metrics ARE available, with weights renormalized to sum to
100% over just those — we do not fill missing metrics with a fake neutral
value. As the daily ingestion cron accumulates snapshots, churn/growth/
backlog metrics phase in on their own.

BASE_WEIGHTS below is the target weighting once every metric has enough
history; it's also what gets served on the methodology endpoint (Stage 8)
so the weighting is documented, not hidden in code.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass, field

import duckdb

from oss_pulse.scoring.common import clip_score

BASE_WEIGHTS: dict[str, float] = {
    "commit_velocity": 35,
    "contributor_breadth": 25,
    "release_cadence": 20,
    "contributor_retention": 10,
    "star_fork_growth": 5,
    "issue_backlog_change": 5,
}

RECENT_WEEKS_WINDOW = 8
MIN_WEEKS_FOR_VELOCITY = 8
MIN_RELEASES_FOR_CADENCE = 2


def _commit_velocity_score(con: duckdb.DuckDBPyConnection, repo: str) -> float | None:
    """Recent-N-week average commits vs. the repo's own 52-week average.
    ratio == 1 (steady) -> 50; ratio == 2 (velocity doubled) -> 100; ratio == 0 -> 0.
    """
    rows = con.execute(
        "SELECT commit_count FROM commit_weekly WHERE repo = ? ORDER BY week_start",
        [repo],
    ).fetchall()
    counts = [r[0] for r in rows]
    if len(counts) < MIN_WEEKS_FOR_VELOCITY:
        return None

    overall_avg = sum(counts) / len(counts)
    if overall_avg == 0:
        return None

    recent_avg = sum(counts[-RECENT_WEEKS_WINDOW:]) / RECENT_WEEKS_WINDOW
    ratio = recent_avg / overall_avg
    return clip_score(50 + (ratio - 1) * 50)


def _release_cadence_score(con: duckdb.DuckDBPyConnection, repo: str) -> float | None:
    """Median days between recent releases. 0-day gap -> 100, 300-day gap -> 0.
    Repos that don't use GitHub Releases (e.g. mongo, kafka tag differently)
    simply have no signal here rather than a misleading zero.
    """
    rows = con.execute(
        """
        SELECT published_at FROM release_history
        WHERE repo = ? AND published_at IS NOT NULL
        ORDER BY published_at DESC
        """,
        [repo],
    ).fetchall()
    dates = [r[0] for r in rows]
    if len(dates) < MIN_RELEASES_FOR_CADENCE:
        return None

    gaps = [(dates[i] - dates[i + 1]).days for i in range(len(dates) - 1)]
    gaps = [g for g in gaps if g >= 0]
    if not gaps:
        return None

    median_gap = statistics.median(gaps)
    return clip_score(100 - median_gap / 3)


def _latest_snapshot_per_repo(
    con: duckdb.DuckDBPyConnection, repos: list[str]
) -> dict[str, tuple]:
    if not repos:
        return {}
    placeholders = ",".join("?" * len(repos))
    rows = con.execute(
        f"""
        SELECT repo, fetched_at, stars, forks, open_issues, contributor_count
        FROM repo_snapshot
        WHERE repo IN ({placeholders})
        QUALIFY ROW_NUMBER() OVER (PARTITION BY repo ORDER BY fetched_at DESC) = 1
        """,
        repos,
    ).fetchall()
    return {r[0]: r[1:] for r in rows}


def _contributor_breadth_scores(
    con: duckdb.DuckDBPyConnection, repos: list[str]
) -> dict[str, float]:
    """Log-scaled, then min-max normalized across the tracked universe —
    self-calibrating rather than picking an arbitrary "good" contributor
    count. A repo with the most contributors among tracked repos scores
    100, the fewest scores 0 (or all score 50 if every repo ties).
    """
    latest = _latest_snapshot_per_repo(con, repos)
    log_counts = {
        repo: math.log10(row[4] + 1) for repo, row in latest.items() if row[4] is not None
    }
    if not log_counts:
        return {}

    lo, hi = min(log_counts.values()), max(log_counts.values())
    if hi == lo:
        return {repo: 50.0 for repo in log_counts}

    return {repo: clip_score((v - lo) / (hi - lo) * 100) for repo, v in log_counts.items()}


def _retention_score(con: duckdb.DuckDBPyConnection, repo: str) -> float | None:
    """% of the oldest snapshot's top contributors still present in the
    latest snapshot. Needs 2+ ingestion runs on record to mean anything.
    """
    dates = con.execute(
        "SELECT DISTINCT fetched_at FROM contributor_snapshot WHERE repo = ? ORDER BY fetched_at",
        [repo],
    ).fetchall()
    if len(dates) < 2:
        return None

    oldest, latest = dates[0][0], dates[-1][0]
    oldest_logins = {
        r[0]
        for r in con.execute(
            "SELECT login FROM contributor_snapshot WHERE repo = ? AND fetched_at = ?",
            [repo, oldest],
        ).fetchall()
    }
    latest_logins = {
        r[0]
        for r in con.execute(
            "SELECT login FROM contributor_snapshot WHERE repo = ? AND fetched_at = ?",
            [repo, latest],
        ).fetchall()
    }
    if not oldest_logins:
        return None

    return clip_score(len(oldest_logins & latest_logins) / len(oldest_logins) * 100)


def _star_fork_growth_score(con: duckdb.DuckDBPyConnection, repo: str) -> float | None:
    rows = con.execute(
        "SELECT stars, forks FROM repo_snapshot WHERE repo = ? ORDER BY fetched_at",
        [repo],
    ).fetchall()
    if len(rows) < 2:
        return None

    (s0, f0), (s1, f1) = rows[0], rows[-1]
    deltas = [
        (b - a) / a for a, b in ((s0, s1), (f0, f1)) if a not in (0, None) and b is not None
    ]
    if not deltas:
        return None

    return clip_score(50 + (sum(deltas) / len(deltas)) * 500)


def _backlog_change_score(con: duckdb.DuckDBPyConnection, repo: str) -> float | None:
    """Growing open-issue backlog nudges the score down (weighted low —
    this is a coarse bandwidth proxy, not a real response-latency metric).
    """
    rows = con.execute(
        "SELECT open_issues FROM repo_snapshot WHERE repo = ? ORDER BY fetched_at",
        [repo],
    ).fetchall()
    if len(rows) < 2:
        return None

    before, after = rows[0][0], rows[-1][0]
    if not before:
        return None

    return clip_score(50 - ((after - before) / before) * 100)


@dataclass
class RepoScore:
    repo: str
    composite_score: float | None
    sub_scores: dict[str, float | None]
    metrics_available: list[str] = field(default_factory=list)
    metrics_pending: list[str] = field(default_factory=list)


def compute_repo_score(
    con: duckdb.DuckDBPyConnection, repo: str, contributor_breadth: dict[str, float]
) -> RepoScore:
    sub_scores = {
        "commit_velocity": _commit_velocity_score(con, repo),
        "contributor_breadth": contributor_breadth.get(repo),
        "release_cadence": _release_cadence_score(con, repo),
        "contributor_retention": _retention_score(con, repo),
        "star_fork_growth": _star_fork_growth_score(con, repo),
        "issue_backlog_change": _backlog_change_score(con, repo),
    }
    available = {k: v for k, v in sub_scores.items() if v is not None}

    composite = None
    if available:
        weight_total = sum(BASE_WEIGHTS[k] for k in available)
        composite = round(
            sum(BASE_WEIGHTS[k] * v for k, v in available.items()) / weight_total, 1
        )

    return RepoScore(
        repo=repo,
        composite_score=composite,
        sub_scores={k: (round(v, 1) if v is not None else None) for k, v in sub_scores.items()},
        metrics_available=sorted(available.keys()),
        metrics_pending=sorted(k for k in sub_scores if k not in available),
    )


def compute_repo_scores(con: duckdb.DuckDBPyConnection, repos: list[str]) -> dict[str, RepoScore]:
    breadth = _contributor_breadth_scores(con, repos)
    return {repo: compute_repo_score(con, repo, breadth) for repo in repos}


def compute_company_score(repo_scores: list[RepoScore]) -> float | None:
    """A company's score is the plain average of its repos' composite
    scores (e.g. HashiCorp = mean(terraform, vault)) — simplest defensible
    rollup; documented so it's easy to defend or revisit in an interview.
    """
    values = [r.composite_score for r in repo_scores if r.composite_score is not None]
    return round(sum(values) / len(values), 1) if values else None
