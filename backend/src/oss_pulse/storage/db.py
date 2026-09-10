"""DuckDB storage layer. The file is committed to the repo (see Stage 3 in
the README), not gitignored, so a deployed backend can serve it without its
own database.
"""

from __future__ import annotations

import duckdb

from oss_pulse.config import BACKEND_ROOT

DB_PATH = BACKEND_ROOT / "data" / "oss_pulse.duckdb"

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


def get_connection(read_only: bool = False) -> duckdb.DuckDBPyConnection:
    """read_only=True is required on platforms with a read-only filesystem
    outside a scratch directory (e.g. Vercel Functions) — DuckDB's normal
    connect mode tries to acquire a write lock and touch a WAL file even for
    plain SELECT queries, which fails there. The API layer always serves
    read-only; only the ingestion script needs write access, and it never
    runs on a serverless platform, so it keeps the default.
    """
    if read_only:
        return duckdb.connect(str(DB_PATH), read_only=True)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))
    con.execute(SCHEMA)
    return con
