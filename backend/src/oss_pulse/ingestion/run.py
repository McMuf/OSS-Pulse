"""Ingestion entrypoint: pulls GitHub metrics for every repo in
companies.yaml and writes a timestamped snapshot into DuckDB.

Usage (from backend/, with the venv active):
    python -m oss_pulse.ingestion.run
"""

from __future__ import annotations

from github.GithubException import GithubException, RateLimitExceededException

from oss_pulse.config import load_companies
from oss_pulse.ingestion.github_client import RepoMetrics, fetch_repo_metrics, get_github_client
from oss_pulse.ingestion.prices import fetch_price_history
from oss_pulse.storage.db import get_connection


def _store_metrics(con, metrics: RepoMetrics) -> None:
    con.execute(
        """
        INSERT INTO repo_snapshot
            (repo, fetched_at, stars, forks, open_issues, contributor_count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (repo, fetched_at) DO NOTHING
        """,
        [
            metrics.repo,
            metrics.fetched_at,
            metrics.stars,
            metrics.forks,
            metrics.open_issues,
            metrics.contributor_count,
        ],
    )

    for week_start, commit_count in metrics.weekly_commits:
        con.execute(
            """
            INSERT INTO commit_weekly (repo, week_start, commit_count, fetched_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (repo, week_start) DO UPDATE SET
                commit_count = excluded.commit_count,
                fetched_at = excluded.fetched_at
            """,
            [metrics.repo, week_start.date(), commit_count, metrics.fetched_at],
        )

    for login, contributions in metrics.top_contributors:
        con.execute(
            """
            INSERT INTO contributor_snapshot (repo, login, contributions, fetched_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (repo, login, fetched_at) DO NOTHING
            """,
            [metrics.repo, login, contributions, metrics.fetched_at],
        )

    for tag, published_at in metrics.releases:
        con.execute(
            """
            INSERT INTO release_history (repo, tag, published_at)
            VALUES (?, ?, ?)
            ON CONFLICT (repo, tag) DO NOTHING
            """,
            [metrics.repo, tag, published_at],
        )


def _store_prices(con, ticker: str, prices: list[tuple]) -> None:
    for day, close in prices:
        con.execute(
            """
            INSERT INTO stock_price (ticker, date, close)
            VALUES (?, ?, ?)
            ON CONFLICT (ticker, date) DO UPDATE SET close = excluded.close
            """,
            [ticker, day, close],
        )


def main() -> None:
    companies = load_companies()
    repos = sorted({repo for company in companies for repo in company.repos})

    gh = get_github_client()
    con = get_connection()

    print(f"Ingesting {len(repos)} repos...")
    for repo_full_name in repos:
        try:
            metrics = fetch_repo_metrics(gh, repo_full_name)
        except RateLimitExceededException:
            print(f"  {repo_full_name}: rate limit hit, stopping early.")
            break
        except GithubException as e:
            print(f"  {repo_full_name}: skipped ({e.status} {e.data.get('message', '')})")
            continue

        _store_metrics(con, metrics)
        print(
            f"  {repo_full_name}: {metrics.stars} stars, "
            f"{len(metrics.weekly_commits)} weeks of commits, "
            f"{len(metrics.top_contributors)} top contributors, "
            f"{len(metrics.releases)} recent releases"
        )

    tickers = sorted({c.ticker for c in companies if not c.delisted})
    print(f"Ingesting price history for {len(tickers)} tickers...")
    for ticker in tickers:
        try:
            prices = fetch_price_history(ticker)
        except Exception as e:  # yfinance raises assorted/undocumented exception types
            print(f"  {ticker}: skipped ({e})")
            continue

        if not prices:
            print(f"  {ticker}: no price data returned")
            continue

        _store_prices(con, ticker, prices)
        print(f"  {ticker}: {len(prices)} days of price history")

    con.close()
    print("Done.")


if __name__ == "__main__":
    main()
