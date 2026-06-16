from flask import Flask, render_template, jsonify
import requests

app = Flask(__name__)

COINGECKO_BASE = "https://api.coingecko.com/api/v3"


def fetch_btc_price():
    resp = requests.get(
        f"{COINGECKO_BASE}/simple/price",
        params={"ids": "bitcoin", "vs_currencies": "usd", "include_24hr_change": "true", "include_24hr_vol": "true", "include_market_cap": "true"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["bitcoin"]


def fetch_btc_chart(days=7):
    resp = requests.get(
        f"{COINGECKO_BASE}/coins/bitcoin/market_chart",
        params={"vs_currency": "usd", "days": days, "interval": "daily"},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/price")
def api_price():
    try:
        data = fetch_btc_price()
        return jsonify({
            "price": data["usd"],
            "change_24h": data["usd_24h_change"],
            "volume_24h": data["usd_24h_vol"],
            "market_cap": data["usd_market_cap"],
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chart/<int:days>")
def api_chart(days):
    if days not in (1, 7, 30, 90, 365):
        return jsonify({"error": "Invalid days parameter"}), 400
    try:
        data = fetch_btc_chart(days)
        prices = [{"t": p[0], "v": p[1]} for p in data["prices"]]
        return jsonify({"prices": prices})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
