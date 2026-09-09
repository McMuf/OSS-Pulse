"""Daily close price history via yfinance, keyed by the tickers in
companies.yaml. Two years is more than the ~52 weeks of GitHub commit
history we can backtest against, but keeps enough runway for the price
chart and for future lag windows once more commit history accumulates.
"""

from __future__ import annotations

from datetime import date

import yfinance as yf

PRICE_HISTORY_PERIOD = "2y"


def fetch_price_history(ticker: str) -> list[tuple[date, float]]:
    hist = yf.Ticker(ticker).history(period=PRICE_HISTORY_PERIOD, interval="1d")
    if hist.empty:
        return []
    return [(idx.date(), float(row["Close"])) for idx, row in hist.iterrows()]
