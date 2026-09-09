"""Pulls per-repo metrics from the GitHub API via PyGithub.

Kept deliberately cheap: everything here is O(1) API calls per repo (a few
precomputed/paginated-but-capped endpoints), not full commit history walks.
Deep multi-year history is a BigQuery/GH Archive job, not this module's job.
"""

from __future__ import annotations

import itertools
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from github import Auth, Github
from github.GithubException import GithubException
from github.Repository import Repository

from oss_pulse.config import GITHUB_TOKEN

TOP_CONTRIBUTORS_LIMIT = 50
RECENT_RELEASES_LIMIT = 20
STATS_POLL_ATTEMPTS = 3
STATS_POLL_DELAY_SECONDS = 3


@dataclass
class RepoMetrics:
    repo: str
    fetched_at: datetime
    stars: int
    forks: int
    open_issues: int
    contributor_count: int
    weekly_commits: list[tuple[datetime, int]] = field(default_factory=list)
    top_contributors: list[tuple[str, int]] = field(default_factory=list)
    releases: list[tuple[str, datetime | None]] = field(default_factory=list)


def get_github_client() -> Github:
    if GITHUB_TOKEN:
        return Github(auth=Auth.Token(GITHUB_TOKEN))
    print("WARNING: no GITHUB_TOKEN set — using unauthenticated 60 req/hr limit.")
    return Github()


def _fetch_weekly_commits(repo: Repository) -> list[tuple[datetime, int]]:
    """GitHub computes this histogram async server-side. A fresh request on
    a repo it hasn't cached yet returns None (HTTP 202) while it builds the
    stats — poll a few times before giving up rather than treating it as
    an empty result.
    """
    for attempt in range(STATS_POLL_ATTEMPTS):
        stats = repo.get_stats_commit_activity()
        if stats is not None:
            return [(week.week, week.total) for week in stats]
        if attempt < STATS_POLL_ATTEMPTS - 1:
            time.sleep(STATS_POLL_DELAY_SECONDS)
    return []


def _fetch_top_contributors(repo: Repository) -> list[tuple[str, int]]:
    try:
        contributors = itertools.islice(repo.get_contributors(), TOP_CONTRIBUTORS_LIMIT)
        return [(c.login, c.contributions) for c in contributors]
    except GithubException:
        # Some repos (e.g. very large mirrors) disable the contributors list.
        return []


def _fetch_recent_releases(repo: Repository) -> list[tuple[str, datetime | None]]:
    releases = itertools.islice(repo.get_releases(), RECENT_RELEASES_LIMIT)
    return [(r.tag_name, r.published_at) for r in releases]


def fetch_repo_metrics(gh: Github, repo_full_name: str) -> RepoMetrics:
    repo = gh.get_repo(repo_full_name)

    return RepoMetrics(
        repo=repo_full_name,
        fetched_at=datetime.now(timezone.utc),
        stars=repo.stargazers_count,
        forks=repo.forks_count,
        open_issues=repo.open_issues_count,
        contributor_count=repo.get_contributors().totalCount,
        weekly_commits=_fetch_weekly_commits(repo),
        top_contributors=_fetch_top_contributors(repo),
        releases=_fetch_recent_releases(repo),
    )
