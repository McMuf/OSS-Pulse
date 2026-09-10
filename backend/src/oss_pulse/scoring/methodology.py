"""Structured methodology data, served as JSON so the frontend renders it
rather than hardcoding weights/descriptions itself — one source of truth,
per the spec's API design section.
"""

from __future__ import annotations

from oss_pulse.scoring.composite import BASE_WEIGHTS

SUB_METRIC_INFO = {
    "commit_velocity": {
        "label": "Commit velocity trend",
        "description": "Recent 8-week average commits vs. the repo's own 52-week average.",
        "requires": "8+ weeks of commit data (available immediately via GitHub's stats API)",
    },
    "contributor_breadth": {
        "label": "Contributor breadth",
        "description": (
            "Current contributor count, log-scaled then min-max normalized "
            "against every other tracked repo. This is self-calibrating "
            "rather than picking an arbitrary 'good' contributor count."
        ),
        "requires": "current contributor data (available immediately)",
    },
    "release_cadence": {
        "label": "Release cadence",
        "description": "Median days between recent GitHub releases.",
        "requires": (
            "2+ GitHub releases on record. Unavailable for repos that tag "
            "differently (e.g. mongodb/mongo, apache/kafka don't use GitHub Releases)"
        ),
    },
    "contributor_retention": {
        "label": "Contributor retention",
        "description": (
            "% of the top contributors from the oldest recorded snapshot "
            "still present in the latest snapshot."
        ),
        "requires": "2+ ingestion snapshots over time",
    },
    "star_fork_growth": {
        "label": "Star/fork growth",
        "description": "% change in stars/forks between the oldest and latest snapshot.",
        "requires": "2+ ingestion snapshots over time",
    },
    "issue_backlog_change": {
        "label": "Issue backlog change",
        "description": (
            "% change in open issue count. This is a coarse team-bandwidth "
            "proxy, not a real response-latency measurement (deliberately "
            "out of scope, see limitations)."
        ),
        "requires": "2+ ingestion snapshots over time",
    },
}

DATA_SOURCES = [
    {
        "name": "GitHub REST/GraphQL API (via PyGithub)",
        "used_for": "commit velocity, contributor breadth/retention, release cadence, stars/forks/open issues",
    },
    {
        "name": "yfinance",
        "used_for": "daily stock close prices, for the backtest and the detail page's price chart",
    },
    {
        "name": "companies.yaml",
        "used_for": "curated company-to-repo mapping, tier confidence level, delisted status. Hand-maintained and versioned in the repo.",
    },
]

LIMITATIONS = [
    "OSS metrics are noisy and somewhat gameable (bot commits, mirrored/forked repos, corporate-mandated commit patterns).",
    "No transaction costs, slippage, or execution latency modeled in the backtest.",
    "Small sample size across a curated universe (~10 companies, ~30 weekly points each). Not statistically robust, and not meant to be.",
    "The backtest correlates commit velocity only, not the full 6-metric composite score. Five sub-metrics only started accumulating real history when the daily ingestion cron began running.",
    "Correlation shown is not evidence of a tradeable edge; public alt-data signals decay quickly once known.",
    "This is a research and data-engineering demonstration, not investment advice.",
]


def get_methodology() -> dict:
    return {
        "sub_metrics": [
            {
                "key": key,
                "weight_pct": weight,
                **SUB_METRIC_INFO[key],
            }
            for key, weight in BASE_WEIGHTS.items()
        ],
        "renormalization_note": (
            "Missing sub-metrics are dropped and the remaining weights "
            "renormalized to 100%. They are never filled with a fake "
            "neutral value."
        ),
        "company_rollup_note": (
            "A company with multiple tracked repos (e.g. HashiCorp) gets the "
            "plain average of its repos' composite scores."
        ),
        "data_sources": DATA_SOURCES,
        "backtest": {
            "metric": "commit_velocity_only",
            "lag_windows": ["1_week", "1_month", "1_quarter"],
            "notes": (
                "Each weekly score point uses only data from before that week "
                "(an 8-week recent average vs. the preceding 12-week baseline) "
                "to avoid lookahead bias. Close to a direct re-run of the SSRN "
                "paper this project set out to replicate-and-fix, with open-core "
                "companies and longer horizons instead of big tech and next-day "
                "volatility."
            ),
        },
        "limitations": LIMITATIONS,
    }
