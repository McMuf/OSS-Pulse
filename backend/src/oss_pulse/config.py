"""Loads repo-level config: companies.yaml and environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml
from dotenv import load_dotenv

# Resolved relative to this file's own location (config.py -> oss_pulse ->
# src -> backend), not to an assumed outer repo root. Render (rootDir:
# backend) and Vercel (root: "backend/") only ever deploy this directory,
# never anything above it, so anything computed relative to a wider
# "monorepo root" silently breaks in production while working locally.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
COMPANIES_YAML_PATH = BACKEND_ROOT / "companies.yaml"

load_dotenv(BACKEND_ROOT / ".env")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


@dataclass(frozen=True)
class Company:
    ticker: str
    name: str
    tier: int
    repos: list[str]
    caveat: str | None = None
    delisted: bool = False
    delisted_note: str | None = None


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
            delisted=entry.get("delisted", False),
            delisted_note=entry.get("delisted_note"),
        )
        for entry in raw["companies"]
    ]
