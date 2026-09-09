"""Tests for the shared scoring helper."""

from oss_pulse.scoring.common import clip_score


def test_clamp_lower_bound():
    assert clip_score(-10) == 0.0
    assert clip_score(0) == 0.0


def test_clamp_upper_bound():
    assert clip_score(150) == 100.0
    assert clip_score(100) == 100.0


def test_pass_through_midrange():
    assert clip_score(0) == 0
    assert clip_score(50) == 50
    assert clip_score(100) == 100


def test_float_preserved():
    assert clip_score(33.7) == 33.7