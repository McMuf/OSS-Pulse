"""DuckDB storage layer. One file on disk, gitignored — rebuilt by ingestion."""

from __future__ import annotations

import duckdb

from oss_pulse.config import REPO_ROOT

DB_PATH = REPO_ROOT / "backend" / "data" / "oss_pulse.duckdb"

SCHEMA = """
CREATE TABLE IF NOT EXISTS repo_snapshot (
    repo VARCHAR,
    fetched_at TIMESTAMP,
    stars INTEGER,
    forks INTEGER,
    open_issues INTEGER,
    contributor_count INTEGER,
    PRIMARY KEY (repo, fetched_at)
);

CREATE TABLE IF NOT EXISTS commit_weekly (
    repo VARCHAR,
    week_start DATE,
    commit_count INTEGER,
    fetched_at TIMESTAMP,
    PRIMARY KEY (repo, week_start)
);

CREATE TABLE IF NOT EXISTS contributor_snapshot (
    repo VARCHAR,
    login VARCHAR,
    contributions INTEGER,
    fetched_at TIMESTAMP,
    PRIMARY KEY (repo, login, fetched_at)
);

CREATE TABLE IF NOT EXISTS release_history (
    repo VARCHAR,
    tag VARCHAR,
    published_at TIMESTAMP,
    PRIMARY KEY (repo, tag)
);

CREATE TABLE IF NOT EXISTS stock_price (
    ticker VARCHAR,
    date DATE,
    close DOUBLE,
    PRIMARY KEY (ticker, date)
);
"""


def get_connection() -> duckdb.DuckDBPyConnection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))
    con.execute(SCHEMA)
    return con
