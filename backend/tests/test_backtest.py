"""Tests for the commit-velocity backtest and event study."""

from __future__ import annotations

from datetime import date, timedelta

from oss_pulse.scoring.backtest import (
    LAG_WINDOWS_DAYS,
    MIN_WEEKS_REQUIRED,
    _company_weekly_scores,
    _velocity_score_series,
    compute_backtest,
)
from tests.conftest import insert_weekly_commits


def test_velocity_series_constant_counts_yield_50_after_warmup():
    counts = [10] * 30
    scores = _velocity_score_series(counts)
    assert len(scores) == 30
    # First MIN_WEEKS_REQUIRED indices have no purely-historical window -> None.
    assert scores[:MIN_WEEKS_REQUIRED] == [None] * MIN_WEEKS_REQUIRED
    assert all(s == 50.0 for s in scores[MIN_WEEKS_REQUIRED:])


def test_velocity_series_acceleration_scores_above_50():
    # Baseline weeks at a low level, then a sustained ramp in the recent window.
    counts = [5] * 16 + [20] * 14  # 30 weeks total
    scores = _velocity_score_series(counts)
    scored = [s for s in scores if s is not None]
    assert scored and all(s > 50.0 for s in scored)


def test_velocity_series_clamps():
    # Extreme acceleration: 14 baseline weeks at 1 commit, then 8 recent weeks
    # at 100. Recent avg ~87 vs baseline 1 -> far past 100 -> clipped to 100.
    counts = [1] * 14 + [100] * 8
    scores = _velocity_score_series(counts)
    assert max(s for s in scores if s is not None) == 100.0


def test_company_weekly_scores_averages_across_repos(con):
    # Both repos produce identical 50-scores; company average is 50 per week.
    insert_weekly_commits(con, "a", [10] * 24)
    insert_weekly_commits(con, "b", [10] * 24)
    company = _company_weekly_scores(con, ["a", "b"])
    assert company  # non-empty (24 weeks >= MIN_WEEKS_REQUIRED=20)
    weeks, first_score = company[0]
    assert isinstance(weeks, date)
    assert first_score == 50.0


def test_company_weekly_scores_skips_repos_lacking_data(con):
    insert_weekly_commits(con, "a", [10] * 24)
    insert_weekly_commits(con, "b", [10] * 4)  # not enough weeks -> no points
    company = _company_weekly_scores(con, ["a", "b"])
    assert len(company) >= 4


def insert_prices(con, ticker: str, first_day: date, closes: list[float]) -> None:
    for i, close in enumerate(closes):
        con.execute(
            "INSERT INTO stock_price (ticker, date, close) VALUES (?, ?, ?)",
            [ticker, first_day + timedelta(days=i), close],
        )


def test_compute_backtest_returns_all_windows(con):
    insert_weekly_commits(con, "hashicorp/terraform", [10] * 28)
    insert_weekly_commits(con, "hashicorp/vault", [10] * 28)
    first = date(2025, 1, 5)
    insert_prices(con, "HCP", first, closes=[100 + i * 2 for i in range(1200)])

    result = compute_backtest(con, "HCP", ["hashicorp/terraform", "hashicorp/vault"])

    assert result.metric == "commit_velocity_only"
    # 28 weeks of commits - 20-week warmup = 8 scored weekly points.
    assert result.weekly_points == 8
    assert set(result.lag_windows) == set(LAG_WINDOWS_DAYS)
    for _, lag in result.lag_windows.items():
        assert lag.n >= 0
        # Constant scores make corrcoef nan -> correlation may be None or a float;
        # the key assertion is that the type is a real number when computed.
        assert lag.correlation is None or isinstance(lag.correlation, float)
    # weekly score points must be isoformat-able dates with floats
    for week, score in result.weekly_scores[:3]:
        assert isinstance(week, date)
        assert 0.0 <= score <= 100.0


def test_compute_backtest_weekly_point_structure(con):
    insert_weekly_commits(con, "a", [10] * 24)
    first = date(2025, 1, 5)
    insert_prices(con, "TKR", first, closes=[100] * 600)
    result = compute_backtest(con, "TKR", ["a"])
    assert result.weekly_points == 4  # 24 weeks - 20 warmup
    assert all(isinstance(week, date) and isinstance(score, float) for week, score in result.weekly_scores)