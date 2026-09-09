"""Tests for the methodology endpoint data."""

from oss_pulse.scoring.composite import BASE_WEIGHTS
from oss_pulse.scoring.methodology import DATA_SOURCES, SUB_METRIC_INFO, get_methodology


def test_sub_metric_info_has_all_base_weights():
    assert BASE_WEIGHTS.keys() == SUB_METRIC_INFO.keys()


def test_methodology_renormalizes_weights_to_100():
    payload = get_methodology()
    sub_metrics = payload["sub_metrics"]
    assert len(sub_metrics) == len(BASE_WEIGHTS)
    # Each carries its raw weight_pct (not renormalized when metrics present).
    for entry in sub_metrics:
        assert entry["weight_pct"] == BASE_WEIGHTS[entry["key"]]
    assert sum(e["weight_pct"] for e in sub_metrics) == 100


def test_methodology_has_documented_backtest_config():
    payload = get_methodology()["backtest"]
    assert payload["metric"] == "commit_velocity_only"
    assert payload["lag_windows"] == ["1_week", "1_month", "1_quarter"]


def test_data_sources_listed():
    names = {d["name"] for d in DATA_SOURCES}
    assert "yfinance" in " ".join(names)
    assert any("GitHub" in n for n in names)