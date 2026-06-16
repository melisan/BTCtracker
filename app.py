from flask import Flask, render_template, jsonify, request
import requests
import psycopg2
import psycopg2.extras
import os
import time
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.getLogger("yfinance").setLevel(logging.CRITICAL)

app = Flask(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

STOCKS = {
    "AAPL":  "Apple",
    "AMZN":  "Amazon",
    "CVX":   "Chevron",
    "LLY":   "Eli Lilly",
    "GOOGL": "Alphabet A",
    "GOOG":  "Alphabet C",
    "NVO":   "Novo Nordisk",
    "OXY":   "Occidental",
    "MSTR":  "MicroStrategy",
    "NVDA":  "NVIDIA",
}

KOSPI = {
    "005930.KS": "Samsung Electronics",
    "000660.KS": "SK Hynix",
}

VALID_TYPES = {"BTC", "ETH", "KRW"} | set(STOCKS.keys()) | set(KOSPI.keys())

_price_cache = {"data": None, "ts": 0}
_stock_cache = {"data": None, "ts": 0}
CRYPTO_TTL = 60
STOCK_TTL = 300


# ── DB ────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS holdings (
            id         SERIAL PRIMARY KEY,
            label      TEXT NOT NULL,
            asset_type TEXT NOT NULL,
            amount     DOUBLE PRECISION NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS holding_logs (
            id          SERIAL PRIMARY KEY,
            holding_id  INTEGER,
            label       TEXT,
            asset_type  TEXT,
            old_amount  DOUBLE PRECISION,
            new_amount  DOUBLE PRECISION,
            total_krw   DOUBLE PRECISION,
            changed_at  TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS portfolio_snapshots (
            id            SERIAL PRIMARY KEY,
            total_krw     DOUBLE PRECISION,
            btc_price_krw DOUBLE PRECISION,
            eth_price_krw DOUBLE PRECISION,
            date          TEXT UNIQUE,
            snapped_at    TIMESTAMP DEFAULT NOW()
        )
    """)
    conn.commit()
    cur.close()
    conn.close()


def query(conn, sql, params=None):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params or ())
    return cur


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

    all_tickers = list(STOCKS.keys()) + list(KOSPI.keys())
    raw = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_fetch_one_stock, t): t for t in all_tickers}
        for future in as_completed(futures, timeout=20):
            try:
                ticker, price = future.result()
                raw[ticker] = price
            except Exception:
                raw[futures[future]] = None

    result = {
        "prices":       {t: raw.get(t) for t in STOCKS},
        "kospi_prices": {t: raw.get(t) for t in KOSPI},
        "updated_at":   datetime.utcnow().isoformat(),
    }
    _stock_cache["data"] = result
    _stock_cache["ts"] = now
    return result


# ── Portfolio calculation ─────────────────────────────────────

def calc_total_krw(holdings, crypto_prices, stock_data=None):
    total = 0
    usd_krw = crypto_prices.get("usd_krw", 1350)
    stock_prices = (stock_data or {}).get("prices", {})
    kospi_prices = (stock_data or {}).get("kospi_prices", {})
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
            total += amt * (stock_prices.get(t) or 0) * usd_krw
        elif t in KOSPI:
            total += amt * (kospi_prices.get(t) or 0)  # already KRW
    return total


def save_snapshot(conn, total_krw, crypto_prices):
    today = datetime.utcnow().date().isoformat()
    query(conn, """
        INSERT INTO portfolio_snapshots (total_krw, btc_price_krw, eth_price_krw, date)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (date) DO UPDATE SET
            total_krw     = EXCLUDED.total_krw,
            btc_price_krw = EXCLUDED.btc_price_krw,
            eth_price_krw = EXCLUDED.eth_price_krw,
            snapped_at    = NOW()
    """, (total_krw, crypto_prices["btc"], crypto_prices["eth"], today))


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
        return jsonify({**data, "meta": STOCKS, "kospi_meta": KOSPI})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/holdings", methods=["GET"])
def api_get_holdings():
    conn = get_db()
    cur = query(conn, "SELECT * FROM holdings ORDER BY asset_type, created_at")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return jsonify(rows)


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
    try:
        cur = query(
            conn,
            "INSERT INTO holdings (label, asset_type, amount) VALUES (%s, %s, %s) RETURNING id",
            (label, asset_type, amount),
        )
        holding_id = cur.fetchone()["id"]

        try:
            crypto = fetch_crypto_prices()
            stocks = _stock_cache["data"]
            all_rows = [dict(r) for r in query(conn, "SELECT * FROM holdings").fetchall()]
            total = calc_total_krw(all_rows, crypto, stocks)
            query(conn,
                "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (%s,%s,%s,%s,%s,%s)",
                (holding_id, label, asset_type, 0, amount, total),
            )
            save_snapshot(conn, total, crypto)
        except Exception:
            pass

        conn.commit()
    except Exception as e:
        conn.rollback(); conn.close()
        return jsonify({"error": str(e)}), 500

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
    cur = query(conn, "SELECT * FROM holdings WHERE id = %s", (hid,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    old_amount = row["amount"]
    try:
        query(conn,
            "UPDATE holdings SET amount = %s, updated_at = NOW() WHERE id = %s",
            (new_amount, hid),
        )
        try:
            crypto = fetch_crypto_prices()
            stocks = _stock_cache["data"]
            all_rows = [dict(r) for r in query(conn, "SELECT * FROM holdings").fetchall()]
            total = calc_total_krw(all_rows, crypto, stocks)
            query(conn,
                "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (%s,%s,%s,%s,%s,%s)",
                (hid, row["label"], row["asset_type"], old_amount, new_amount, total),
            )
            save_snapshot(conn, total, crypto)
        except Exception:
            pass
        conn.commit()
    except Exception as e:
        conn.rollback(); conn.close()
        return jsonify({"error": str(e)}), 500

    conn.close()
    return jsonify({"ok": True})


@app.route("/api/holdings/<int:hid>", methods=["DELETE"])
def api_delete_holding(hid):
    conn = get_db()
    cur = query(conn, "SELECT * FROM holdings WHERE id = %s", (hid,))
    row = cur.fetchone()
    if row:
        try:
            query(conn,
                "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (%s,%s,%s,%s,%s,%s)",
                (hid, row["label"], row["asset_type"], row["amount"], 0, 0),
            )
        except Exception:
            pass
        query(conn, "DELETE FROM holdings WHERE id = %s", (hid,))
        conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/portfolio/history")
def api_portfolio_history():
    conn = get_db()
    cur = query(conn,
        "SELECT date, total_krw, btc_price_krw, eth_price_krw FROM portfolio_snapshots ORDER BY date DESC LIMIT 90"
    )
    rows = [dict(r) for r in reversed(cur.fetchall())]
    cur.close(); conn.close()
    return jsonify(rows)


@app.route("/api/logs")
def api_logs():
    conn = get_db()
    cur = query(conn, "SELECT * FROM holding_logs ORDER BY changed_at DESC LIMIT 50")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()

    # serialize timestamps
    for r in rows:
        if isinstance(r.get("changed_at"), datetime):
            r["changed_at"] = r["changed_at"].isoformat()

    return jsonify(rows)


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
