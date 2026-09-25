"""Shared helpers for the scoring pipeline."""

from __future__ import annotations


def clip_score(score: float) -> float:
    """Clamp a score into the canonical [0, 100] range.

    Sub-metrics agree on this range (see spec section 4), so the clamp
    lives in one place instead of being inlined in every scorer.
    """
    return max(0.0, min(100.0, score))