"""Shared fixtures: an in-memory DuckDB seeded with the production schema."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import duckdb
import pytest

from oss_pulse.storage.db import SCHEMA


@pytest.fixture()
def con() -> duckdb.DuckDBPyConnection:
    conn = duckdb.connect(":memory:")
    conn.execute(SCHEMA)
    yield conn
    conn.close()


def insert_snapshot(
    con: duckdb.DuckDBPyConnection,
    repo: str,
    *,
    fetched_at: datetime | None = None,
    stars: int = 0,
    forks: int = 0,
    open_issues: int = 0,
    contributor_count: int | None = None,
) -> None:
    """One row in repo_snapshot. contributor_count=None keeps the column NULL."""
    con.execute(
        """
        INSERT INTO repo_snapshot
            (repo, fetched_at, stars, forks, open_issues, contributor_count)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            repo,
            fetched_at or datetime.now(timezone.utc),
            stars,
            forks,
            open_issues,
            contributor_count,
        ],
    )


def insert_weekly_commits(
    con: duckdb.DuckDBPyConnection,
    repo: str,
    counts: list[int],
    *,
    start: date | None = None,
) -> None:
    """commit_weekly rows for consecutive weeks."""
    base = start or date(2025, 1, 5)
    for i, count in enumerate(counts):
        con.execute(
            "INSERT INTO commit_weekly (repo, week_start, commit_count, fetched_at) VALUES (?, ?, ?, ?)",
            [repo, base + timedelta(weeks=i), count, datetime.now(timezone.utc)],
        )