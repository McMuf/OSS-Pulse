"""Entrypoint shim for platforms that expect a top-level `main.py` exposing
an `app` object (e.g. Vercel Services' `entrypoint: "main:app"`). The real
app lives at src/oss_pulse/api/main.py — locally and on Render we run it
directly via `PYTHONPATH=src uvicorn oss_pulse.api.main:app`, which doesn't
need this file at all.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from oss_pulse.api.main import app  # noqa: E402
