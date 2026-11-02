"""Retirement reconciliation: immutable origin, holdings and linked ledger spending."""
import copy
import math
import re
import threading
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

import requests

LEDGER_URL = "https://harmonious-love-production-a253.up.railway.app/api/transactions"
_cache = None
_lock = threading.Lock()


def amount(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 9e15:
        raise ValueError("Invalid amount")
    return value


def validate_plan(plan):
    if not isinstance(plan, dict):
        raise ValueError("Invalid retirement plan")
    result = copy.deepcopy(plan)
    origin = result["origin"]
    if not isinstance(origin, dict) or not isinstance(origin["accounts"], list) or len(origin["accounts"]) > 1000:
        raise ValueError("Invalid original accounts")
    ids = set()
    for row in origin["accounts"]:
        if not isinstance(row.get("id"), str) or row["id"] in ids:
            raise ValueError("Invalid original account ID")
        ids.add(row["id"])
        amount(row["amount"])
        amount(row.get("interest") or 0)
        if row.get("maturity"):
            date.fromisoformat(row["maturity"])
        for key in ("name", "description", "account", "category", "notes"):
            if not isinstance(row.get(key, ""), str) or len(row.get(key, "")) > 10000:
                raise ValueError("Invalid original account")
    amount(origin.get("other_amount", 0))
    for field in ("holdings", "major"):
        if not isinstance(result[field], list) or len(result[field]) > 1000:
            raise ValueError("Invalid items")
        item_ids = set()
        for row in result[field]:
            if not isinstance(row.get("id"), str) or row["id"] in item_ids:
                raise ValueError("Invalid item ID")
            item_ids.add(row["id"])
            amount(row["amount"])
            if not isinstance(row.get("label"), str) or len(row["label"]) > 1000:
                raise ValueError("Invalid label")
            if not isinstance(row.get("note", ""), str) or len(row.get("note", "")) > 10000:
                raise ValueError("Invalid note")
            if field == "holdings" and row.get("kind") not in ("btc", "housing", "liquid", "other"):
                raise ValueError("Invalid holding type")
    baseline = result["baseline"]
    date.fromisoformat(baseline["date"])
    for field in ("ledger_total", "recovered_total"):
        amount(baseline[field])
    for field in ("holdings_ledger_total", "holdings_recovered_total"):
        if field in result:
            amount(result[field])
    if result.get("holdings_as_of"):
        date.fromisoformat(result["holdings_as_of"])
    overrides = result.get("recovery_overrides", {})
    if not isinstance(overrides, dict) or any(key not in ids for key in overrides):
        raise ValueError("Invalid recovery source")
    for value in overrides.values():
        amount(value)
    return result


def ledger_category(row):
    memo = row.get("memo") or ""
    if re.search(r"자금이동|반환|상환|송금|이체", memo):
        return "정산·상환"
    if re.search(r"간병비", memo):
        return "간병비"
    if abs(row["amount"]) >= 500000 and re.search(r"아가페|요양", memo):
        return "요양원비"
    if re.search(r"병원|진료|약값|약품|의료|항암|초음파|기저귀|패드|안경|건강보험", memo):
        return "의료·간병용품"
    if re.search(r"핸드폰|통신|모바일", memo):
        return "통신비"
    if re.search(r"수리|전력|쉴러스|CCTV", memo):
        return "주택·관리"
    if re.search(r"포상|지원|할머니비용", memo):
        return "지원·포상"
    if re.search(r"옷|의복|바지|모자|기모|네임택", memo):
        return "의복·생활용품"
    if re.search(r"간식|식비|시장|외식|음식|커피|빵|만두|쿠키|휴게소|쿠팡|밥|파리|마켓", memo):
        return "식비·간식·선물"
    return "기타·메모 확인"


def fetch_ledger():
    """Read-only fixed-source fetch. Never report a failed refresh as current data."""
    global _cache
    with _lock:
        if _cache and time.monotonic() - _cache[0] < 60:
            return {**copy.deepcopy(_cache[1]), "stale": False}
        try:
            response = requests.get(LEDGER_URL, timeout=(5, 20))
            response.raise_for_status()
            raw = response.json()
            if not isinstance(raw, list):
                raise ValueError("Invalid ledger response")
            seen, rows = set(), []
            for row in raw:
                if row.get("type") != "hongcheon" and "홍천" not in str(row.get("category", "")):
                    continue
                if row["id"] in seen:
                    raise ValueError("Duplicate ledger transaction")
                seen.add(row["id"])
                date.fromisoformat(row["date"])
                amount(abs(row["amount"]))
                rows.append({key: row.get(key) for key in ("id", "date", "amount", "memo", "category", "payment_method")})
                rows[-1]["spending_category"] = ledger_category(row)
            rows.sort(key=lambda row: (row["date"], row["id"]), reverse=True)
            data = {"rows": rows, "fetched_at": datetime.now(ZoneInfo("Asia/Seoul")).isoformat()}
            _cache = (time.monotonic(), data)
            return {**copy.deepcopy(data), "stale": False}
        except (requests.RequestException, ValueError, TypeError, KeyError):
            if _cache:
                return {**copy.deepcopy(_cache[1]), "stale": True, "error": "가계부 연결 지연: 마지막 성공 자료입니다."}
            return {"rows": None, "fetched_at": None, "stale": True, "error": "가계부에 연결할 수 없습니다. 지출·잔액 계산을 보류합니다."}


def summarize(plan, ledger, today=None):
    plan = validate_plan(plan)
    today = today or datetime.now(ZoneInfo("Asia/Seoul")).date().isoformat()
    original = plan["origin"]["accounts"]
    deposits = [r for r in original if r["category"] == "예적금"]
    recovered = [r for r in deposits if r.get("maturity") and r["maturity"] <= today]
    bank = [r for r in deposits if r not in recovered]
    recovered_total = sum(plan.get("recovery_overrides", {}).get(r["id"], r["amount"] + (r.get("interest") or 0)) for r in recovered)
    principal = sum(r["amount"] for r in recovered)
    origin_total = sum(r["amount"] for r in original) + plan["origin"].get("other_amount", 0)
    snapshot_holdings = sum(r["amount"] for r in plan["holdings"])
    major = sum(r["amount"] for r in plan["major"])
    result = {"today": today, "origin_total": origin_total, "recovered_accounts": recovered,
              "holding_accounts": bank, "bank_total": sum(r["amount"] for r in bank),
              "recovered_total": recovered_total, "interest_received": recovered_total - principal,
              "major_total": major, "snapshot_holdings": snapshot_holdings}
    if ledger["rows"] is None:
        return result
    actual = [r for r in ledger["rows"] if r["date"] <= today]
    minor = sum(abs(r["amount"]) for r in actual)
    delta = minor - plan.get("holdings_ledger_total", plan["baseline"]["ledger_total"])
    recovery_delta = recovered_total - plan.get("holdings_recovered_total", plan["baseline"]["recovered_total"])
    current = result["bank_total"] + snapshot_holdings - delta + recovery_delta
    available = origin_total + result["interest_received"]
    result.update(minor_total=minor, ledger_change=delta, newly_recovered=recovery_delta,
                  holdings_total=current, paid_total=major + minor,
                  available_total=available, gap=available - current - major - minor,
                  liquid_projected=sum(r["amount"] for r in plan["holdings"] if r["kind"] == "liquid") - delta + recovery_delta)
    return result


def project_care(plan, ledger, summary, annual_nursing):
    """Fixed care bill plus observed overhead over completed calendar months."""
    if ledger["rows"] is None or "liquid_projected" not in summary or annual_nursing is None:
        return {"available": False, "reason": "가계부와 고정 요양비 설정을 확인한 후 전망을 계산합니다."}
    amount(annual_nursing)
    today = date.fromisoformat(summary["today"])
    cutoff = today.replace(day=1).isoformat()
    historical = [r for r in ledger["rows"] if r["date"] < cutoff]
    if not historical:
        return {"available": False, "reason": "완료된 월의 홍천지출 기록이 없어 월평균을 계산할 수 없습니다."}
    first = min(r["date"] for r in historical)[:7]
    start = date.fromisoformat(first + "-01")
    months = (today.year - start.year) * 12 + today.month - start.month
    excluded = {"요양원비", "정산·상환", "지원·포상"}
    overhead = [r for r in historical if r["spending_category"] not in excluded]
    groups = {}
    for row in overhead:
        key = row["spending_category"]
        groups[key] = groups.get(key, 0) + abs(row["amount"])
    monthly_overhead = sum(groups.values()) / months
    monthly_nursing = annual_nursing / 12
    monthly_total = monthly_nursing + monthly_overhead
    if monthly_total <= 0:
        return {"available": False, "reason": "고정 요양비를 설정해 주세요."}
    btc = sum(r["amount"] for r in plan["holdings"] if r["kind"] == "btc")
    housing = sum(r["amount"] for r in plan["holdings"] if r["kind"] == "housing")
    cash = summary["liquid_projected"]
    funds = [
        {"label": "현재 유동자금만", "amount": cash, "kind": "liquid"},
        {"label": "유동자금 + 남은 예금 원금", "amount": cash + summary["bank_total"], "kind": "bank"},
        {"label": "예금 + 유동자금 + BTC 기록값", "amount": cash + summary["bank_total"] + btc, "kind": "btc"},
        {"label": "전체 보유자산 · 보증금 포함", "amount": summary["holdings_total"], "kind": "all"},
    ]
    for row in funds:
        row["months"] = max(0, row["amount"]) / monthly_total
    observed = {r["date"][:7] for r in historical}
    missing = []
    for offset in range(months):
        year, month = divmod(start.year * 12 + start.month - 1 + offset, 12)
        key = f"{year:04d}-{month + 1:02d}"
        if key not in observed:
            missing.append(key)
    return {"available": True, "history_start": first, "history_end_exclusive": cutoff,
            "history_months": months, "missing_months": missing,
            "monthly_nursing": monthly_nursing, "monthly_overhead": monthly_overhead,
            "monthly_total": monthly_total, "annual_total": monthly_total * 12,
            "overhead_categories": [{"label": key, "total": value, "monthly": value / months} for key, value in sorted(groups.items())],
            "funds": funds, "housing": housing, "btc": btc,
            "maturities": [{"date": r["maturity"], "amount": r["amount"]} for r in summary["holding_accounts"] if r.get("maturity")]}
