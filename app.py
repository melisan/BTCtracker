from flask import Flask, render_template, jsonify, request
import requests
import psycopg2
import psycopg2.extras
import os
import re
import time
import logging
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

logging.getLogger("yfinance").setLevel(logging.CRITICAL)

app = Flask(__name__)

DATABASE_URL    = os.environ.get("DATABASE_URL", "")
ADMIN_PASSWORD  = os.environ.get("ADMIN_PASSWORD", "admin1234")
COINGECKO_BASE  = "https://api.coingecko.com/api/v3"

# Ticker format: letters, digits, dots, dashes — max 20 chars
TICKER_RE = re.compile(r'^[A-Za-z0-9.\-]{1,20}$')
CRYPTO_KRW = {"BTC", "ETH", "KRW"}

def is_korean(t):
    return bool(re.search(r'\.(KS|KQ)$', t, re.IGNORECASE))

def is_us_stock(t):
    return t not in CRYPTO_KRW and not is_korean(t)

def get_held_stock_tickers():
    """Return (us_tickers, korean_tickers) from distinct holdings in DB."""
    try:
        conn = get_db()
        cur  = query(conn, "SELECT DISTINCT asset_type FROM holdings")
        all_types = [r["asset_type"] for r in cur.fetchall()]
        conn.close()
    except Exception:
        all_types = []
    us  = sorted({t for t in all_types if is_us_stock(t)})
    kor = sorted({t for t in all_types if is_korean(t)})
    return us, kor

_price_cache        = {"data": None, "date": None}
_stock_cache        = {"data": None, "ts": 0}
_stock_hist_cache   = {"data": None, "ts": 0}
STOCK_TTL      = 300
STOCK_HIST_TTL = 3600


# ── DB ────────────────────────────────────────────────────────

def get_db():
    return psycopg2.connect(DATABASE_URL)


def init_db():
    conn = get_db()
    cur  = conn.cursor()
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
            id               SERIAL PRIMARY KEY,
            total_krw        DOUBLE PRECISION,
            btc_price_krw    DOUBLE PRECISION,
            eth_price_krw    DOUBLE PRECISION,
            date             TEXT UNIQUE,
            snapped_at       TIMESTAMP DEFAULT NOW(),
            btc_total_krw    DOUBLE PRECISION DEFAULT 0,
            eth_total_krw    DOUBLE PRECISION DEFAULT 0,
            us_total_krw     DOUBLE PRECISION DEFAULT 0,
            korean_total_krw DOUBLE PRECISION DEFAULT 0,
            krw_total_krw    DOUBLE PRECISION DEFAULT 0
        )
    """)
    # Add columns to existing tables that predate this schema
    for col in ("btc_total_krw", "eth_total_krw", "us_total_krw",
                "korean_total_krw", "krw_total_krw"):
        cur.execute(f"""
            ALTER TABLE portfolio_snapshots
            ADD COLUMN IF NOT EXISTS {col} DOUBLE PRECISION DEFAULT 0
        """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tab_notes (
            id         SERIAL PRIMARY KEY,
            tab        TEXT NOT NULL,
            content    TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
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
    today = datetime.utcnow().date().isoformat()
    if _price_cache["data"] and _price_cache["date"] == today:
        return _price_cache["data"]
    resp = requests.get(
        "https://api.upbit.com/v1/ticker",
        params={"markets": "KRW-BTC,KRW-ETH,KRW-USDT"},
        headers={"Accept": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()
    items    = {item["market"]: float(item["trade_price"]) for item in resp.json()}
    result   = {
        "btc":     items.get("KRW-BTC",  0),
        "eth":     items.get("KRW-ETH",  0),
        "usd_krw": round(items.get("KRW-USDT", 1350), 2),
    }
    _price_cache["data"] = result
    _price_cache["date"] = today
    return result


def _fetch_one_stock(ticker):
    import yfinance as yf
    t     = yf.Ticker(ticker)
    price = t.fast_info.last_price
    return ticker, float(price) if price else None


def fetch_stock_prices():
    now = time.time()
    if _stock_cache["data"] and now - _stock_cache["ts"] < STOCK_TTL:
        return _stock_cache["data"]

    us_tickers, kor_tickers = get_held_stock_tickers()
    all_tickers = us_tickers + kor_tickers
    raw = {}
    if all_tickers:
        with ThreadPoolExecutor(max_workers=8) as ex:
            futures = {ex.submit(_fetch_one_stock, t): t for t in all_tickers}
            for future in as_completed(futures, timeout=20):
                try:
                    ticker, price = future.result()
                    raw[ticker] = price
                except Exception:
                    raw[futures[future]] = None

    result = {
        "prices":       {t: raw.get(t) for t in us_tickers},
        "kospi_prices": {t: raw.get(t) for t in kor_tickers},
        "updated_at":   datetime.utcnow().isoformat(),
    }
    _stock_cache["data"] = result
    _stock_cache["ts"]   = now
    return result


# ── Portfolio calculation ─────────────────────────────────────

def calc_breakdown(holdings, crypto_prices, stock_data=None):
    usd_krw = crypto_prices.get("usd_krw", 1350)
    sp  = (stock_data or {}).get("prices", {})
    kp  = (stock_data or {}).get("kospi_prices", {})
    bd  = {"btc": 0, "eth": 0, "us": 0, "korean": 0, "krw": 0}
    for h in holdings:
        t, amt = h["asset_type"], h["amount"]
        if   t == "BTC":      bd["btc"]    += amt * crypto_prices["btc"]
        elif t == "ETH":      bd["eth"]    += amt * crypto_prices["eth"]
        elif t == "KRW":      bd["krw"]    += amt
        elif is_korean(t):    bd["korean"] += amt * (kp.get(t) or 0)
        else:                 bd["us"]     += amt * (sp.get(t) or 0) * usd_krw
    bd["total"] = sum(bd.values())
    return bd


def save_snapshot(conn, crypto_prices, breakdown):
    today = datetime.utcnow().date().isoformat()
    query(conn, """
        INSERT INTO portfolio_snapshots
            (total_krw, btc_price_krw, eth_price_krw, date,
             btc_total_krw, eth_total_krw, us_total_krw, korean_total_krw, krw_total_krw)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (date) DO UPDATE SET
            total_krw        = EXCLUDED.total_krw,
            btc_price_krw    = EXCLUDED.btc_price_krw,
            eth_price_krw    = EXCLUDED.eth_price_krw,
            btc_total_krw    = EXCLUDED.btc_total_krw,
            eth_total_krw    = EXCLUDED.eth_total_krw,
            us_total_krw     = EXCLUDED.us_total_krw,
            korean_total_krw = EXCLUDED.korean_total_krw,
            krw_total_krw    = EXCLUDED.krw_total_krw,
            snapped_at       = NOW()
    """, (
        breakdown["total"], crypto_prices["btc"], crypto_prices["eth"], today,
        breakdown["btc"], breakdown["eth"], breakdown["us"],
        breakdown["korean"], breakdown["krw"],
    ))


# ── Historical backfill helpers ───────────────────────────────

def fetch_crypto_history_krw(coin_id, days=400):
    resp = requests.get(
        f"{COINGECKO_BASE}/coins/{coin_id}/market_chart",
        params={"vs_currency": "krw", "days": days, "interval": "daily"},
        timeout=20,
    )
    resp.raise_for_status()
    result = {}
    for ts, price in resp.json()["prices"]:
        date = datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d")
        result[date] = price
    return result


def fetch_stock_history_prices(ticker, days=400):
    import yfinance as yf
    t    = yf.Ticker(ticker)
    period = "2y" if days >= 365 else f"{days}d"
    hist = t.history(period=period, interval="1d")
    result = {}
    for date, row in hist.iterrows():
        result[date.strftime("%Y-%m-%d")] = float(row["Close"])
    return result


def fetch_usdkrw_history(days=400):
    import yfinance as yf
    t    = yf.Ticker("USDKRW=X")
    hist = t.history(period=f"{min(days, 365)}d", interval="1d")
    result = {}
    for date, row in hist.iterrows():
        result[date.strftime("%Y-%m-%d")] = float(row["Close"])
    return result


def get_nearest_price(price_dict, target_date):
    if not price_dict:
        return 0
    dt = datetime.strptime(target_date, "%Y-%m-%d")
    for i in range(1, 8):
        d = (dt - timedelta(days=i)).strftime("%Y-%m-%d")
        if d in price_dict:
            return price_dict[d]
    for i in range(1, 8):
        d = (dt + timedelta(days=i)).strftime("%Y-%m-%d")
        if d in price_dict:
            return price_dict[d]
    return 0


def run_backfill():
    conn = get_db()
    try:
        holdings_rows = [dict(r) for r in query(conn, "SELECT * FROM holdings").fetchall()]
        if not holdings_rows:
            conn.close()
            return 0
        existing_dates = set(
            r["date"] for r in query(conn, "SELECT date FROM portfolio_snapshots").fetchall()
        )
    except Exception:
        conn.close()
        return 0

    price_data = {}

    def do_fetch(key, func, *args):
        try:
            price_data[key] = func(*args)
        except Exception:
            price_data[key] = {}

    # Use yfinance for BTC/ETH (avoids CoinGecko rate limits)
    stock_tickers = sorted({h["asset_type"] for h in holdings_rows
                            if h["asset_type"] not in CRYPTO_KRW})
    tasks = [
        ("btc_usd", fetch_stock_history_prices, "BTC-USD", 400),
        ("eth_usd", fetch_stock_history_prices, "ETH-USD", 400),
        ("usd_krw", fetch_usdkrw_history, 400),
    ] + [(t, fetch_stock_history_prices, t, 400) for t in stock_tickers]

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(do_fetch, *task) for task in tasks]
        for f in as_completed(futs, timeout=90):
            try: f.result()
            except Exception: pass

    btc_usd_hist = price_data.get("btc_usd", {})
    eth_usd_hist = price_data.get("eth_usd", {})
    usdkrw_hist  = price_data.get("usd_krw", {})
    today        = datetime.utcnow().date().isoformat()

    inserted = 0
    for date in sorted(btc_usd_hist.keys()):
        if date >= today or date in existing_dates:
            continue
        usd_krw = usdkrw_hist.get(date) or get_nearest_price(usdkrw_hist, date) or 1350
        btc_p = (btc_usd_hist.get(date) or get_nearest_price(btc_usd_hist, date) or 0) * usd_krw
        eth_p = (eth_usd_hist.get(date) or get_nearest_price(eth_usd_hist, date) or 0) * usd_krw

        bd = {"btc": 0, "eth": 0, "us": 0, "korean": 0, "krw": 0}
        for h in holdings_rows:
            t, amt = h["asset_type"], h["amount"]
            if   t == "BTC": bd["btc"] += amt * btc_p
            elif t == "ETH": bd["eth"] += amt * eth_p
            elif t == "KRW": bd["krw"] += amt
            elif is_korean(t):
                p = price_data.get(t, {}).get(date) or get_nearest_price(price_data.get(t, {}), date) or 0
                bd["korean"] += amt * p
            else:
                p = price_data.get(t, {}).get(date) or get_nearest_price(price_data.get(t, {}), date) or 0
                bd["us"] += amt * p * usd_krw
        bd["total"] = sum(bd.values())

        try:
            query(conn, """
                INSERT INTO portfolio_snapshots
                    (total_krw, btc_price_krw, eth_price_krw, date,
                     btc_total_krw, eth_total_krw, us_total_krw, korean_total_krw, krw_total_krw)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (date) DO NOTHING
            """, (bd["total"], btc_p, eth_p, date,
                  bd["btc"], bd["eth"], bd["us"], bd["korean"], bd["krw"]))
            inserted += 1
        except Exception:
            pass

    conn.commit()
    conn.close()
    return inserted


def _do_snapshot(conn):
    try:
        crypto  = fetch_crypto_prices()
        stocks  = _stock_cache["data"]
        rows    = [dict(r) for r in query(conn, "SELECT * FROM holdings").fetchall()]
        bd      = calc_breakdown(rows, crypto, stocks)
        save_snapshot(conn, crypto, bd)
        return bd
    except Exception:
        return None


# ── Routes ────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/auth", methods=["POST"])
def api_auth():
    data = request.get_json() or {}
    if (data.get("password") or "") == ADMIN_PASSWORD:
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 401


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
        return jsonify({**data,
                        "meta":       {t: t for t in data["prices"]},
                        "kospi_meta": {t: t for t in data["kospi_prices"]}})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stocks/history")
def api_stocks_history():
    now = time.time()
    if _stock_hist_cache["data"] and now - _stock_hist_cache["ts"] < STOCK_HIST_TTL:
        return jsonify(_stock_hist_cache["data"])
    us_tickers, kor_tickers = get_held_stock_tickers()
    # app key → yfinance ticker (crypto needs -USD suffix)
    yf_map = {t: t for t in us_tickers + kor_tickers}
    yf_map["BTC"] = "BTC-USD"
    yf_map["ETH"] = "ETH-USD"
    result = {}
    def fetch_one(app_key, yf_ticker):
        import yfinance as yf
        hist = yf.Ticker(yf_ticker).history(period="35d", interval="1d")
        return app_key, {d.strftime("%Y-%m-%d"): float(row["Close"]) for d, row in hist.iterrows()}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(fetch_one, k, v): k for k, v in yf_map.items()}
        for f in as_completed(futures, timeout=30):
            try:
                k, prices = f.result()
                result[k] = prices
            except Exception:
                result[futures[f]] = {}
    _stock_hist_cache["data"] = result
    _stock_hist_cache["ts"]   = now
    return jsonify(result)


@app.route("/api/holdings", methods=["GET"])
def api_get_holdings():
    conn = get_db()
    cur  = query(conn, "SELECT * FROM holdings ORDER BY asset_type, created_at")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    return jsonify(rows)


@app.route("/api/holdings", methods=["POST"])
def api_add_holding():
    data       = request.get_json()
    label      = (data.get("label") or "").strip()
    asset_type = (data.get("asset_type") or "").strip().upper()
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400

    if not label or not TICKER_RE.match(asset_type) or amount < 0:
        return jsonify({"error": "Invalid input"}), 400

    # Invalidate price/history caches so new ticker gets fetched immediately
    _stock_cache["ts"]      = 0
    _stock_hist_cache["ts"] = 0

    conn = get_db()
    try:
        cur        = query(conn,
            "INSERT INTO holdings (label, asset_type, amount) VALUES (%s, %s, %s) RETURNING id",
            (label, asset_type, amount))
        holding_id = cur.fetchone()["id"]
        bd         = _do_snapshot(conn)
        total      = (bd or {}).get("total", 0)
        query(conn,
            "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (%s,%s,%s,%s,%s,%s)",
            (holding_id, label, asset_type, 0, amount, total))
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
    cur  = query(conn, "SELECT * FROM holdings WHERE id = %s", (hid,))
    row  = cur.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found"}), 404

    old_amount = row["amount"]
    try:
        query(conn, "UPDATE holdings SET amount = %s, updated_at = NOW() WHERE id = %s",
              (new_amount, hid))
        bd    = _do_snapshot(conn)
        total = (bd or {}).get("total", 0)
        query(conn,
            "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (%s,%s,%s,%s,%s,%s)",
            (hid, row["label"], row["asset_type"], old_amount, new_amount, total))
        conn.commit()
    except Exception as e:
        conn.rollback(); conn.close()
        return jsonify({"error": str(e)}), 500
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/holdings/<int:hid>", methods=["DELETE"])
def api_delete_holding(hid):
    conn = get_db()
    cur  = query(conn, "SELECT * FROM holdings WHERE id = %s", (hid,))
    row  = cur.fetchone()
    if row:
        try:
            query(conn,
                "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (%s,%s,%s,%s,%s,%s)",
                (hid, row["label"], row["asset_type"], row["amount"], 0, 0))
        except Exception:
            pass
        query(conn, "DELETE FROM holdings WHERE id = %s", (hid,))
        conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/portfolio/history")
def api_portfolio_history():
    range_type = request.args.get("range", "daily")
    conn = get_db()
    cur  = query(conn, """
        SELECT date, total_krw, btc_total_krw, eth_total_krw,
               us_total_krw, korean_total_krw, krw_total_krw
        FROM portfolio_snapshots ORDER BY date ASC
    """)
    all_rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()

    if range_type == "weekly":
        weeks = {}
        for r in all_rows:
            try:
                dt = datetime.strptime(r["date"], "%Y-%m-%d")
                wk = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
                weeks[wk] = r
            except Exception:
                pass
        rows = list(weeks.values())[-52:]
    elif range_type == "monthly":
        months = {}
        for r in all_rows:
            months[r["date"][:7]] = r
        rows = list(months.values())[-12:]
    else:
        rows = all_rows[-30:]

    return jsonify(rows)


@app.route("/api/portfolio/history/weekly")
def api_portfolio_history_weekly():
    conn = get_db()
    cur  = query(conn, """
        SELECT date, total_krw, btc_total_krw, eth_total_krw,
               us_total_krw, korean_total_krw, krw_total_krw
        FROM portfolio_snapshots ORDER BY date ASC
    """)
    all_rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    # Group by ISO week; prefer the entry closest to Friday (weekday=4)
    weeks = {}
    for r in all_rows:
        try:
            dt = datetime.strptime(r["date"], "%Y-%m-%d")
            year, week, _ = dt.isocalendar()
            wk = f"{year}-W{week:02d}"
            if wk not in weeks:
                weeks[wk] = r
            else:
                existing = datetime.strptime(weeks[wk]["date"], "%Y-%m-%d")
                if abs(dt.weekday() - 4) < abs(existing.weekday() - 4):
                    weeks[wk] = r
        except Exception:
            pass
    return jsonify(sorted(weeks.values(), key=lambda r: r["date"]))


@app.route("/api/portfolio/backfill", methods=["POST"])
def api_backfill():
    try:
        count = run_backfill()
        return jsonify({"inserted": count})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/logs")
def api_logs():
    conn = get_db()
    cur  = query(conn, "SELECT * FROM holding_logs ORDER BY changed_at DESC LIMIT 50")
    rows = [dict(r) for r in cur.fetchall()]
    cur.close(); conn.close()
    for r in rows:
        if isinstance(r.get("changed_at"), datetime):
            r["changed_at"] = r["changed_at"].isoformat()
    return jsonify(rows)


@app.route("/api/admin/diagnose-anomalies")
def api_diagnose_anomalies():
    """Return raw snapshot data ±15 days around any detected btc_price_krw outlier."""
    conn = get_db()
    rows = [dict(r) for r in query(conn, """
        SELECT id, date, btc_price_krw, btc_total_krw, eth_total_krw,
               us_total_krw, korean_total_krw, krw_total_krw, total_krw
        FROM portfolio_snapshots ORDER BY date
    """).fetchall()]
    conn.close()
    if len(rows) < 3:
        return jsonify({"anomalies": [], "rows": rows})

    prices   = [r["btc_price_krw"] or 0 for r in rows]
    anomalies = []
    for i, row in enumerate(rows):
        p = prices[i]
        if not p:
            continue
        window = [prices[j] for j in range(max(0,i-5), min(len(prices),i+6)) if j != i and prices[j]]
        if not window:
            continue
        window.sort()
        median = window[len(window)//2]
        if median and (p / median > 1.5 or p / median < 0.667):
            ratio = p / median
            kind  = "price_10x" if 8 < ratio < 12 else \
                    "price_100x" if 80 < ratio < 120 else \
                    "price_low_10x" if 0.08 < ratio < 0.12 else \
                    "price_low_100x" if 0.008 < ratio < 0.012 else "other"
            context = rows[max(0,i-3):i+4]
            anomalies.append({"date": row["date"], "btc_price_krw": p,
                               "median_neighbors": median, "ratio": round(ratio,3),
                               "likely_cause": kind, "context": context})
    return jsonify({"anomalies": anomalies, "total_rows": len(rows)})


@app.route("/api/admin/fix-anomalies", methods=["POST"])
def api_fix_anomalies():
    """
    Detect and correct btc_price_krw outliers via linear interpolation.
    Threshold: price deviates >2.5× or <0.4× of 5-day rolling median.
    Corrects btc_total_krw and total_krw proportionally.
    Returns list of corrected rows.
    """
    conn = get_db()
    rows = [dict(r) for r in query(conn, """
        SELECT id, date, btc_price_krw, btc_total_krw, total_krw
        FROM portfolio_snapshots ORDER BY date
    """).fetchall()]

    prices = [r["btc_price_krw"] or 0 for r in rows]
    fixed  = []

    for i, row in enumerate(rows):
        p = prices[i]
        if not p:
            continue
        window = [prices[j] for j in range(max(0,i-5), min(len(prices),i+6)) if j != i and prices[j]]
        if not window:
            continue
        window.sort()
        median = window[len(window)//2]
        if not median or not (p / median > 1.5 or p / median < 0.667):
            continue

        # Find nearest valid (non-anomalous) neighbors for interpolation
        left_p = left_i = right_p = right_i = None
        for j in range(i-1, max(-1, i-20), -1):
            nb = prices[j]
            if nb and 0.667 < nb/median < 1.5:
                left_p, left_i = nb, j
                break
        for j in range(i+1, min(len(prices), i+20)):
            nb = prices[j]
            if nb and 0.667 < nb/median < 1.5:
                right_p, right_i = nb, j
                break

        if left_p and right_p:
            t = (i - left_i) / (right_i - left_i)
            corrected_price = left_p + t * (right_p - left_p)
        elif left_p:
            corrected_price = left_p
        elif right_p:
            corrected_price = right_p
        else:
            continue

        ratio             = corrected_price / p
        old_btc_total     = row["btc_total_krw"] or 0
        new_btc_total     = old_btc_total * ratio
        new_total         = (row["total_krw"] or 0) - old_btc_total + new_btc_total

        query(conn, """
            UPDATE portfolio_snapshots
            SET btc_price_krw = %s, btc_total_krw = %s, total_krw = %s
            WHERE id = %s
        """, (corrected_price, new_btc_total, new_total, row["id"]))

        fixed.append({"date": row["date"],
                      "old_btc_price": round(p), "new_btc_price": round(corrected_price),
                      "correction_ratio": round(ratio, 4),
                      "old_btc_total": round(old_btc_total), "new_btc_total": round(new_btc_total)})

    conn.commit()
    conn.close()
    return jsonify({"fixed": len(fixed), "details": fixed})


@app.route("/api/admin/snapshots")
def api_admin_snapshots():
    """Return raw snapshot rows around a date for manual inspection."""
    around = request.args.get("around", "").strip()
    days   = min(int(request.args.get("days", 14)), 60)
    conn   = get_db()
    try:
        if around:
            center = datetime.strptime(around, "%Y-%m-%d")
            start  = (center - timedelta(days=days)).strftime("%Y-%m-%d")
            end    = (center + timedelta(days=days)).strftime("%Y-%m-%d")
            rows   = [dict(r) for r in query(conn, """
                SELECT id, date, btc_price_krw, btc_total_krw,
                       eth_price_krw, eth_total_krw,
                       us_total_krw, korean_total_krw, krw_total_krw, total_krw
                FROM portfolio_snapshots
                WHERE date >= %s AND date <= %s ORDER BY date
            """, (start, end)).fetchall()]
        else:
            rows = [dict(r) for r in query(conn, """
                SELECT id, date, btc_price_krw, btc_total_krw,
                       eth_price_krw, eth_total_krw,
                       us_total_krw, korean_total_krw, krw_total_krw, total_krw
                FROM portfolio_snapshots ORDER BY date DESC LIMIT 30
            """).fetchall()]
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 400
    conn.close()
    return jsonify(rows)


@app.route("/api/admin/patch-snapshot", methods=["POST"])
def api_patch_snapshot():
    """Manually patch any column of a snapshot row by date. Requires admin password."""
    data     = request.get_json() or {}
    password = data.get("password", "")
    if password != ADMIN_PASSWORD:
        return jsonify({"error": "Unauthorized"}), 403

    date = (data.get("date") or "").strip()
    if not date:
        return jsonify({"error": "date is required"}), 400

    allowed = {"btc_price_krw", "btc_total_krw", "eth_price_krw", "eth_total_krw",
               "us_total_krw", "korean_total_krw", "krw_total_krw", "total_krw"}
    updates = {k: float(v) for k, v in data.items() if k in allowed and v is not None}
    if not updates:
        return jsonify({"error": "No valid fields to update"}), 400

    conn = get_db()
    cur  = query(conn, "SELECT id FROM portfolio_snapshots WHERE date = %s", (date,))
    if not cur.fetchone():
        conn.close()
        return jsonify({"error": f"No snapshot for {date}"}), 404

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values     = list(updates.values()) + [date]
    query(conn, f"UPDATE portfolio_snapshots SET {set_clause} WHERE date = %s", values)
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "date": date, "updated": list(updates.keys())})


# ── Notes (per-tab journal) ───────────────────────────────────

@app.route("/api/notes")
def api_get_notes():
    tab  = request.args.get("tab", "").strip()
    conn = get_db()
    cur  = query(conn, """
        SELECT id, tab, content, created_at
        FROM tab_notes WHERE tab = %s ORDER BY created_at DESC
    """, (tab,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    for r in rows:
        if isinstance(r.get("created_at"), datetime):
            r["created_at"] = r["created_at"].isoformat()
    return jsonify(rows)


@app.route("/api/notes", methods=["POST"])
def api_add_note():
    data    = request.get_json() or {}
    tab     = (data.get("tab") or "").strip()
    content = (data.get("content") or "").strip()
    if not tab or not content:
        return jsonify({"error": "Missing tab or content"}), 400
    conn = get_db()
    cur  = query(conn, "INSERT INTO tab_notes (tab, content) VALUES (%s, %s) RETURNING id", (tab, content))
    nid  = cur.fetchone()["id"]
    conn.commit()
    conn.close()
    return jsonify({"id": nid}), 201


@app.route("/api/notes/<int:nid>", methods=["DELETE"])
def api_delete_note(nid):
    conn = get_db()
    query(conn, "DELETE FROM tab_notes WHERE id = %s", (nid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
