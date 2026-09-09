"""Loads repo-level config: companies.yaml and environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
COMPANIES_YAML_PATH = REPO_ROOT / "companies.yaml"

load_dotenv(REPO_ROOT / ".env")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


@dataclass(frozen=True)
class Company:
    ticker: str
    name: str
    tier: int
    repos: list[str]
    caveat: str | None = None


def load_companies() -> list[Company]:
    with COMPANIES_YAML_PATH.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    return [
        Company(
            ticker=entry["ticker"],
            name=entry["name"],
            tier=entry["tier"],
            repos=entry["repos"],
            caveat=entry.get("caveat"),
        )
        for entry in raw["companies"]
    ]
