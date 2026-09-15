"""Exercise history routes without connecting to the production database."""
import ast
from datetime import datetime
import json
import math
from pathlib import Path
import time
import types
import unittest
from unittest.mock import Mock, patch
from concurrent.futures import ThreadPoolExecutor, as_completed

from flask import Flask, jsonify, request


def history_app():
    source = ast.parse(Path(__file__).with_name("app.py").read_text())
    names = {"finite_close_history", "api_stocks_history", "api_portfolio_history"}
    module = ast.Module(
        body=[node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names],
        type_ignores=[],
    )
    app = Flask(__name__)
    namespace = dict(
        app=app, jsonify=jsonify, request=request, time=time, math=math,
        datetime=datetime, ThreadPoolExecutor=ThreadPoolExecutor, as_completed=as_completed,
        TRACKER_START_DATE="2026-05-01", STOCK_HIST_TTL=3600, _stock_hist_cache={},
        get_held_stock_tickers=lambda: (["AAPL"], ["005930.KS"]),
        get_db=Mock(), query=Mock(),
    )
    exec(compile(module, "app.py", "exec"), namespace)
    return app, namespace


class TrackerRangeTests(unittest.TestCase):
    def setUp(self):
        self.app, self.ns = history_app()
        self.client = self.app.test_client()

    def test_since_includes_start_and_latest_but_not_earlier_or_future(self):
        dates = ["2026-04-30", "2026-05-01", datetime.utcnow().date().isoformat(), "9999-01-01"]
        self.ns["query"].return_value.fetchall.return_value = [{"date": d, "total_krw": 100} for d in dates]
        result = self.client.get("/api/portfolio/history?range=since").json
        self.assertEqual([r["date"] for r in result], dates[1:3])

    def test_recent_portfolio_still_returns_last_30_snapshots(self):
        rows = [{"date": f"2026-05-{d:02}", "total_krw": d} for d in range(1, 32)]
        self.ns["query"].return_value.fetchall.return_value = rows
        self.assertEqual(self.client.get("/api/portfolio/history?range=daily").json, rows[-30:])

    def test_stock_ranges_use_separate_caches_and_preserve_nan_filter(self):
        frame = Mock()
        frame.iterrows.side_effect = lambda: iter([
            (datetime(2026, 5, 1), {"Close": 100}),
            (datetime(2026, 9, 14), {"Close": float("nan")}),
            (datetime(2026, 9, 15), {"Close": 120}),
        ])
        ticker = Mock()
        ticker.history.return_value = frame
        yf = types.SimpleNamespace(Ticker=Mock(return_value=ticker))
        with patch.dict("sys.modules", {"yfinance": yf}):
            since = self.client.get("/api/stocks/history?range=since")
            self.assertEqual(since.status_code, 200)
            ticker.history.assert_called_with(interval="1d", start="2026-05-01")
            self.assertEqual(set(since.json["AAPL"]), {"2026-05-01", "2026-09-15"})
            json.dumps(since.json, allow_nan=False)
            before = ticker.history.call_count
            self.client.get("/api/stocks/history?range=since")
            self.assertEqual(ticker.history.call_count, before)
            self.client.get("/api/stocks/history?range=recent")
            ticker.history.assert_called_with(interval="1d", period="35d")
            self.assertGreater(ticker.history.call_count, before)


if __name__ == "__main__":
    unittest.main()
