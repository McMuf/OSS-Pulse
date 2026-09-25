"""Tests for the composite OSS Health Score sub-metrics and rollups."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from oss_pulse.scoring.composite import (
    BASE_WEIGHTS,
    _backlog_change_score,
    _commit_velocity_score,
    _contributor_breadth_scores,
    _latest_snapshot_per_repo,
    _release_cadence_score,
    _retention_score,
    _star_fork_growth_score,
    compute_company_score,
    compute_repo_score,
    compute_repo_scores,
)
from tests.conftest import insert_snapshot, insert_weekly_commits


# --- commit velocity ---


def test_commit_velocity_steady_is_50(con):
    insert_weekly_commits(con, "a", [10] * 12)
    assert _commit_velocity_score(con, "a") == 50.0


def test_commit_velocity_insufficient_history_is_none(con):
    insert_weekly_commits(con, "a", [10] * 7)
    assert _commit_velocity_score(con, "a") is None


def test_commit_velocity_acceleration_scores_higher(con):
    # Slow for 4 weeks then steady 20/week for 8 weeks ->
    # recent 8-week avg (20) > overall avg, pushes score above 50.
    insert_weekly_commits(con, "a", [5, 5, 10, 10, 20, 20, 20, 20, 20, 20, 20, 20])
    score = _commit_velocity_score(con, "a")
    assert score is not None
    assert score > 50.0


# --- release cadence ---


def test_release_cadence_median_gap(con):
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i, days in enumerate([0, 30, 60]):
        con.execute(
            "INSERT INTO release_history (repo, tag, published_at) VALUES (?, ?, ?)",
            ["a", f"v{i}", start + timedelta(days=days)],
        )
    # gaps: 30 and 30 days -> median 30 -> 100 - 30/3 = 90
    assert _release_cadence_score(con, "a") == 90.0


def test_release_cadence_insufficient_is_none(con):
    con.execute(
        "INSERT INTO release_history (repo, tag, published_at) VALUES (?, ?, ?)",
        ["a", "v1", datetime(2026, 1, 1, tzinfo=timezone.utc)],
    )
    assert _release_cadence_score(con, "a") is None


def test_release_cadence_no_releases_is_none(con):
    assert _release_cadence_score(con, "a") is None


# --- contributor breadth (regression: must use contributor_count, not open_issues) ---


def test_contributor_breadth_uses_contributor_count_not_open_issues(con):
    # Repo A: 9 contributors (log10(10)=1) but 100 open issues.
    # Repo B: 99 contributors (log10(100)=2) but 1 open issue.
    # Correct breadth scores the two by contributor count -> B higher.
    # If the bug (using open_issues) were live, A would outscore B.
    insert_snapshot(con, "repoA", open_issues=100, contributor_count=9)
    insert_snapshot(con, "repoB", open_issues=1, contributor_count=99)
    scores = _contributor_breadth_scores(con, ["repoA", "repoB"])
    assert scores["repoA"] == 0.0
    assert scores["repoB"] == 100.0


def test_contributor_breadth_all_tie_is_50(con):
    insert_snapshot(con, "a", contributor_count=10)
    insert_snapshot(con, "b", contributor_count=10)
    scores = _contributor_breadth_scores(con, ["a", "b"])
    assert scores == {"a": 50.0, "b": 50.0}


def test_contributor_breadth_takes_latest_snapshot_per_repo(con):
    # Older snapshot says repoA=9 contributors; the newer one says 99.
    # Breadth must use the latest.
    old = datetime(2026, 1, 1, tzinfo=timezone.utc)
    new = datetime(2026, 6, 1, tzinfo=timezone.utc)
    insert_snapshot(con, "repoA", fetched_at=old, contributor_count=9)
    insert_snapshot(con, "repoA", fetched_at=new, contributor_count=99)
    insert_snapshot(con, "repoB", fetched_at=new, contributor_count=9)
    scores = _contributor_breadth_scores(con, ["repoA", "repoB"])
    assert scores["repoA"] == 100.0
    assert scores["repoB"] == 0.0


# --- retention ---


def test_retention_fraction(con):
    old = datetime(2026, 1, 1, tzinfo=timezone.utc)
    latest = datetime(2026, 6, 1, tzinfo=timezone.utc)
    for login in ("a", "b", "c"):
        con.execute(
            "INSERT INTO contributor_snapshot (repo, login, contributions, fetched_at) VALUES (?, ?, ?, ?)",
            ["r", login, 5, old],
        )
    for login in ("a", "b"):
        con.execute(
            "INSERT INTO contributor_snapshot (repo, login, contributions, fetched_at) VALUES (?, ?, ?, ?)",
            ["r", login, 5, latest],
        )
    assert _retention_score(con, "r") == pytest.approx(2 / 3 * 100)


def test_retention_needs_two_snapshots(con):
    con.execute(
        "INSERT INTO contributor_snapshot (repo, login, contributions, fetched_at) VALUES (?, ?, ?, ?)",
        ["r", "a", 5, datetime(2026, 1, 1, tzinfo=timezone.utc)],
    )
    assert _retention_score(con, "r") is None


# --- star/fork growth ---


def test_star_fork_growth(con):
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        stars=100,
        forks=10,
    )
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        stars=150,
        forks=20,
    )
    # deltas 0.5 and 1.0 -> mean 0.75 -> 50 + 375 = 425 -> clipped to 100
    assert _star_fork_growth_score(con, "a") == 100.0


def test_star_fork_growth_needs_two_snapshots(con):
    insert_snapshot(con, "a", stars=100, forks=10)
    assert _star_fork_growth_score(con, "a") is None


# --- backlog change ---


def test_backlog_growth_penalizes(con):
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        open_issues=100,
    )
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        open_issues=120,
    )
    assert _backlog_change_score(con, "a") == 30.0  # 50 - ((120-100)/100)*100


def test_backlog_clearing_bonus(con):
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        open_issues=100,
    )
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        open_issues=60,
    )
    # 50 - ((60-100)/100)*100 = 50 + 40 = 90 -> backlog shrank, score up.
    assert _backlog_change_score(con, "a") == 90.0


def test_backlog_no_baseline_is_none(con):
    insert_snapshot(con, "a", fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc), open_issues=0)
    insert_snapshot(con, "a", fetched_at=datetime(2026, 6, 1, tzinfo=timezone.utc), open_issues=5)
    assert _backlog_change_score(con, "a") is None


# --- latest snapshot helper ---


def test_latest_snapshot_returns_latest_fetched_at(con):
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        stars=1,
        contributor_count=2,
    )
    insert_snapshot(
        con,
        "a",
        fetched_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
        stars=100,
        contributor_count=200,
    )
    latest = _latest_snapshot_per_repo(con, ["a"])
    assert latest["a"][1] == 100        # stars
    assert latest["a"][4] == 200        # contributor_count


# --- repo / company rollup ---


def test_compute_repo_score_renormalized_weights(con):
    # Only two metrics available -> weights renormalized over {velocity:35, cadence:20}.
    insert_weekly_commits(con, "a", [10] * 12)  # velocity = 50
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for i, days in enumerate([0, 30, 60]):     # cadence = 90
        con.execute(
            "INSERT INTO release_history (repo, tag, published_at) VALUES (?, ?, ?)",
            ["a", f"v{i}", start + timedelta(days=days)],
        )
    result = compute_repo_score(con, "a", {})
    # (35*50 + 20*90) / 55 = (1750 + 1800)/55 = 3550/55 = 64.5
    assert result.composite_score == 64.5
    assert sorted(result.metrics_available) == ["commit_velocity", "release_cadence"]
    assert "star_fork_growth" in result.metrics_pending
    assert BASE_WEIGHTS["commit_velocity"] == 35


def test_compute_repo_score_single_metric_is_that_metric(con):
    insert_weekly_commits(con, "a", [10] * 12)
    result = compute_repo_score(con, "a", {})
    assert result.composite_score == 50.0
    assert result.metrics_available == ["commit_velocity"]


def test_compute_repo_score_all_metrics_use_base_weights(con):
    result = compute_repo_score(con, "empty", {})
    assert result.composite_score is None
    assert result.metrics_available == []
    assert len(result.metrics_pending) == len(BASE_WEIGHTS)


def test_compute_repo_scores_maps_over_repos(con):
    insert_weekly_commits(con, "a", [10] * 12)
    insert_weekly_commits(con, "b", [10] * 12)
    scores = compute_repo_scores(con, ["a", "b"])
    assert set(scores) == {"a", "b"}
    assert scores["a"].composite_score == 50.0


def test_compute_company_score_averages_repos(con):
    from oss_pulse.scoring.composite import RepoScore

    repos = [
        RepoScore("a", composite_score=50.0, sub_scores={}),
        RepoScore("b", composite_score=60.0, sub_scores={}),
        RepoScore("c", composite_score=None, sub_scores={}),
    ]
    assert compute_company_score(repos) == 55.0


def test_compute_company_score_none_when_no_scores(con):
    from oss_pulse.scoring.composite import RepoScore

    assert compute_company_score([RepoScore("a", None, {})]) is None