from flask import Flask, render_template, jsonify, request
import requests
import sqlite3
import os
import time
from datetime import datetime

app = Flask(__name__)

DB_PATH = os.environ.get("DB_PATH", "btctracker.db")
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

_price_cache = {"data": None, "ts": 0}
CACHE_TTL = 60


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


def fetch_prices():
    now = time.time()
    if _price_cache["data"] and now - _price_cache["ts"] < CACHE_TTL:
        return _price_cache["data"]
    resp = requests.get(
        f"{COINGECKO_BASE}/simple/price",
        params={"ids": "bitcoin,ethereum", "vs_currencies": "krw"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    result = {"btc": data["bitcoin"]["krw"], "eth": data["ethereum"]["krw"]}
    _price_cache["data"] = result
    _price_cache["ts"] = now
    return result


def calc_total_krw(holdings, prices):
    total = 0
    for h in holdings:
        if h["asset_type"] == "BTC":
            total += h["amount"] * prices["btc"]
        elif h["asset_type"] == "ETH":
            total += h["amount"] * prices["eth"]
        elif h["asset_type"] == "KRW":
            total += h["amount"]
    return total


def save_snapshot(conn, total_krw, prices):
    today = datetime.utcnow().date().isoformat()
    conn.execute(
        """INSERT INTO portfolio_snapshots (total_krw, btc_price_krw, eth_price_krw, date)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
               total_krw = excluded.total_krw,
               btc_price_krw = excluded.btc_price_krw,
               eth_price_krw = excluded.eth_price_krw,
               snapped_at = datetime('now')""",
        (total_krw, prices["btc"], prices["eth"], today),
    )


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/prices")
def api_prices():
    try:
        return jsonify(fetch_prices())
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

    if not label or asset_type not in ("BTC", "ETH", "KRW") or amount < 0:
        return jsonify({"error": "Invalid input"}), 400

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO holdings (label, asset_type, amount) VALUES (?, ?, ?)",
        (label, asset_type, amount),
    )
    holding_id = cur.lastrowid

    try:
        prices = fetch_prices()
        rows = conn.execute("SELECT * FROM holdings").fetchall()
        total = calc_total_krw([dict(r) for r in rows], prices)
        conn.execute(
            "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (?,?,?,?,?,?)",
            (holding_id, label, asset_type, 0, amount, total),
        )
        save_snapshot(conn, total, prices)
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
        prices = fetch_prices()
        rows = conn.execute("SELECT * FROM holdings").fetchall()
        total = calc_total_krw([dict(r) for r in rows], prices)
        conn.execute(
            "INSERT INTO holding_logs (holding_id, label, asset_type, old_amount, new_amount, total_krw) VALUES (?,?,?,?,?,?)",
            (hid, row["label"], row["asset_type"], old_amount, new_amount, total),
        )
        save_snapshot(conn, total, prices)
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
            prices = fetch_prices()
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
