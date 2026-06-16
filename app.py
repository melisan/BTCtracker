from flask import Flask, render_template, jsonify, request
import requests
import sqlite3
import os
import time
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.getLogger("yfinance").setLevel(logging.CRITICAL)

app = Flask(__name__)

DB_PATH = os.environ.get("DB_PATH", "btctracker.db")
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

STOCKS = {
    "AAPL": "Apple",
    "AMZN": "Amazon",
    "CVX": "Chevron",
    "LLY": "Eli Lilly",
    "GOOGL": "Alphabet A",
    "GOOG": "Alphabet C",
    "NVO": "Novo Nordisk",
    "OXY": "Occidental",
}

VALID_TYPES = {"BTC", "ETH", "KRW"} | set(STOCKS.keys())

_price_cache = {"data": None, "ts": 0}
_stock_cache = {"data": None, "ts": 0}
CRYPTO_TTL = 60
STOCK_TTL = 300  # 5 minutes


# ── DB ────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            asset_type TEXT NOT NULL,
            amount REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS holding_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            holding_id INTEGER,
            label TEXT,
            asset_type TEXT,
            old_amount REAL,
            new_amount REAL,
            total_krw REAL,
            changed_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_krw REAL,
            btc_price_krw REAL,
            eth_price_krw REAL,
            date TEXT UNIQUE,
            snapped_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


# ── Price fetching ────────────────────────────────────────────

def fetch_crypto_prices():
    now = time.time()
    if _price_cache["data"] and now - _price_cache["ts"] < CRYPTO_TTL:
        return _price_cache["data"]
    resp = requests.get(
        f"{COINGECKO_BASE}/simple/price",
        params={"ids": "bitcoin,ethereum", "vs_currencies": "usd,krw"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    btc_usd = data["bitcoin"]["usd"]
    btc_krw = data["bitcoin"]["krw"]
    result = {
        "btc": data["bitcoin"]["krw"],
        "eth": data["ethereum"]["krw"],
        "usd_krw": round(btc_krw / btc_usd, 2) if btc_usd else 1350,
    }
    _price_cache["data"] = result
    _price_cache["ts"] = now
    return result


def _fetch_one_stock(ticker):
    import yfinance as yf
    t = yf.Ticker(ticker)
    price = t.fast_info.last_price
    return ticker, float(price) if price else None


def fetch_stock_prices():
    now = time.time()
    if _stock_cache["data"] and now - _stock_cache["ts"] < STOCK_TTL:
        return _stock_cache["data"]

    prices = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_fetch_one_stock, t): t for t in STOCKS}
        for future in as_completed(futures, timeout=15):
            try:
                ticker, price = future.result()
                prices[ticker] = price
            except Exception:
                prices[futures[future]] = None

    result = {"prices": prices, "updated_at": datetime.utcnow().isoformat()}
    _stock_cache["data"] = result
    _stock_cache["ts"] = now
    return result


# ── Portfolio calculation ─────────────────────────────────────

def calc_total_krw(holdings, crypto_prices, stock_data=None):
    total = 0
    usd_krw = crypto_prices.get("usd_krw", 1350)
    stock_prices = (stock_data or {}).get("prices", {})
    for h in holdings:
        t = h["asset_type"]
        amt = h["amount"]
        if t == "BTC":
            total += amt * crypto_prices["btc"]
        elif t == "ETH":
            total += amt * crypto_prices["eth"]
        elif t == "KRW":
            total += amt
        elif t in STOCKS:
            usd = stock_prices.get(t) or 0
            total += amt * usd * usd_krw
    return total


def save_snapshot(conn, total_krw, crypto_prices):
    today = datetime.utcnow().date().isoformat()
    conn.execute(
        """INSERT INTO portfolio_snapshots (total_krw, btc_price_krw, eth_price_krw, date)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
               total_krw = excluded.total_krw,
               btc_price_krw = excluded.btc_price_krw,
               eth_price_krw = excluded.eth_price_krw,
               snapped_at = datetime('now')""",
        (total_krw, crypto_prices["btc"], crypto_prices["eth"], today),
    )


# ── Routes ────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/prices")
def api_prices():
    try:
        return jsonify(fetch_crypto_prices())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stocks")
def api_stocks():
    try:
        data = fetch_stock_prices()
        return jsonify({**data, "meta": STOCKS})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/holdings", methods=["GET"])
def api_get_holdings():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM holdings ORDER BY asset_type, created_at"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/holdings", methods=["POST"])
def api_add_holding():
    data = request.get_json()
    label = (data.get("label") or "").strip()
    asset_type = (data.get("asset_type") or "").upper()
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    if not label or asset_type not in VALID_TYPES or amount < 0:
        return jsonify({"error": "Invalid input"}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO holdings (label, asset_type, amount) VALUES (?, ?, ?)",
        (label, asset_type, amount),
    )
    holding_id = cur.lastrowid

    try:
        crypto = fetch_crypto_prices()
        stocks = _stock_cache["data"]
        rows = conn.execute("SELECT * FROM holdings").fetchall()
        total = calc_total_krw([dict(r) for r in rows], crypto, stocks)
        conn.execute(
            "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (?,?,?,?,?,?)",
            (holding_id, label, asset_type, 0, amount, total),
        )
        save_snapshot(conn, total, crypto)
    except Exception:
        pass

    conn.commit()
    conn.close()
    return jsonify({"id": holding_id}), 201


@app.route("/api/holdings/<int:hid>", methods=["PUT"])
def api_update_holding(hid):
    data = request.get_json()
    try:
        new_amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400
    if new_amount < 0:
        return jsonify({"error": "Amount must be non-negative"}), 400

    conn = get_db()
    row = conn.execute("SELECT * FROM holdings WHERE id = ?", (hid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    old_amount = row["amount"]
    conn.execute(
        "UPDATE holdings SET amount = ?, updated_at = datetime('now') WHERE id = ?",
        (new_amount, hid),
    )

    try:
        crypto = fetch_crypto_prices()
        stocks = _stock_cache["data"]
        rows = conn.execute("SELECT * FROM holdings").fetchall()
        total = calc_total_krw([dict(r) for r in rows], crypto, stocks)
        conn.execute(
            "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (?,?,?,?,?,?)",
            (hid, row["label"], row["asset_type"], old_amount, new_amount, total),
        )
        save_snapshot(conn, total, crypto)
    except Exception:
        pass

    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/holdings/<int:hid>", methods=["DELETE"])
def api_delete_holding(hid):
    conn = get_db()
    row = conn.execute("SELECT * FROM holdings WHERE id = ?", (hid,)).fetchone()
    if row:
        try:
            conn.execute(
                "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (?,?,?,?,?,?)",
                (hid, row["label"], row["asset_type"], row["amount"], 0, 0),
            )
        except Exception:
            pass
        conn.execute("DELETE FROM holdings WHERE id = ?", (hid,))
        conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/portfolio/history")
def api_portfolio_history():
    conn = get_db()
    rows = conn.execute(
        "SELECT date, total_krw, btc_price_krw, eth_price_krw FROM portfolio_snapshots ORDER BY date DESC LIMIT 90"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in reversed(rows)])


@app.route("/api/logs")
def api_logs():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM holding_logs ORDER BY changed_at DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
