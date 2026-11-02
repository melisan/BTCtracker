import copy
import unittest
from unittest.mock import Mock, patch

import retirement
import test_asset_status as asset_tests
from test_asset_status import SAMPLE


def plan():
    return {
        "origin": {"accounts": [
            {"id": "deposit-a", "amount": 100, "interest": 10, "maturity": "2026-11-02", "category": "예적금"},
            {"id": "deposit-b", "amount": 100, "interest": 5, "maturity": "2026-11-03", "category": "예적금"},
            {"id": "btc", "amount": 50, "category": "코인"},
        ], "other_amount": 0},
        "holdings": [
            {"id": "btc", "kind": "btc", "label": "BTC", "amount": 50},
            {"id": "housing", "kind": "housing", "label": "보증금", "amount": 20},
            {"id": "cash", "kind": "liquid", "label": "유동계좌", "amount": 30},
        ],
        "major": [{"id": "car", "label": "자동차", "amount": 20}],
        "recovery_overrides": {},
        "baseline": {"date": "2026-11-02", "ledger_total": 30, "recovered_total": 110},
    }


class ReconciliationTests(unittest.TestCase):
    def test_maturity_moves_principal_into_liquidity_not_spending(self):
        ledger = {"rows": [{"date": "2026-11-02", "amount": 30}]}
        before = retirement.summarize(plan(), ledger, "2026-11-01")
        self.assertEqual(before["bank_total"], 200)
        self.assertEqual(before["recovered_total"], 0)
        result = retirement.summarize(plan(), ledger, "2026-11-02")
        self.assertEqual(result["bank_total"], 100)
        self.assertEqual(result["recovered_total"], 110)
        self.assertEqual(result["gap"], 10)
        self.assertEqual(result["holdings_total"], 200)
        later = retirement.summarize(plan(), ledger, "2026-11-03")
        self.assertEqual(later["liquid_projected"], 135)
        self.assertEqual(later["bank_total"], 0)
        self.assertEqual(later["gap"], 10)
        self.assertEqual(later["paid_total"], result["paid_total"])

    def test_new_expenses_reduce_liquid_once_and_future_entries_wait(self):
        ledger = {"rows": [{"date": "2026-11-02", "amount": 30},
                            {"date": "2026-11-03", "amount": 7},
                            {"date": "2026-12-01", "amount": 9}]}
        result = retirement.summarize(plan(), ledger, "2026-11-03")
        self.assertEqual(result["minor_total"], 37)
        self.assertEqual(result["ledger_change"], 7)
        self.assertEqual(result["liquid_projected"], 128)
        self.assertEqual(result["gap"], 10)

    def test_received_amount_overrides_estimated_interest(self):
        p = plan(); p["recovery_overrides"]["deposit-a"] = 108
        result = retirement.summarize(p, {"rows": []}, "2026-11-02")
        self.assertEqual(result["interest_received"], 8)

    def test_outage_does_not_turn_spending_into_zero(self):
        result = retirement.summarize(plan(), {"rows": None}, "2026-11-02")
        self.assertNotIn("gap", result)
        self.assertNotIn("minor_total", result)

    def test_confirmed_balance_snapshot_is_not_charged_for_old_spending_again(self):
        p = plan()
        p.update(holdings_ledger_total=37, holdings_recovered_total=215, holdings_as_of="2026-11-03")
        p["holdings"][2]["amount"] = 128
        ledger = {"rows": [{"date": "2026-11-03", "amount": 37}]}
        result = retirement.summarize(p, ledger, "2026-11-03")
        self.assertEqual(result["ledger_change"], 0)
        self.assertEqual(result["newly_recovered"], 0)
        self.assertEqual(result["liquid_projected"], 128)
        self.assertEqual(result["gap"], 10)

    def test_cache_failure_is_explicitly_stale(self):
        old = retirement._cache
        try:
            retirement._cache = None
            with patch("retirement.requests.get", side_effect=retirement.requests.ConnectionError):
                self.assertIsNone(retirement.fetch_ledger()["rows"])
                retirement._cache = (-1000000, {"rows": [], "fetched_at": "old"})
                self.assertTrue(retirement.fetch_ledger()["stale"])
        finally:
            retirement._cache = old

    def test_fetch_includes_all_hongcheon_types_and_preserves_memos(self):
        rows = [{"id": 1, "type": "hongcheon", "category": "기타", "date": "2026-11-02", "amount": 600000, "memo": "아가페 요양비"},
                {"id": 2, "type": "special", "category": "홍천지출", "date": "2026-11-02", "amount": 20, "memo": "자금이동 반환"},
                {"id": 3, "type": "fixed", "category": "식비", "date": "2026-11-02", "amount": 10}]
        old = retirement._cache
        try:
            retirement._cache = None
            with patch("retirement.requests.get", return_value=Mock(json=lambda: rows)):
                result = retirement.fetch_ledger()
            self.assertEqual(len(result["rows"]), 2)
            self.assertEqual({r["spending_category"] for r in result["rows"]}, {"요양원비", "정산·상환"})
        finally:
            retirement._cache = old


class RetirementPersistenceTests(unittest.TestCase):
    setUp = asset_tests.SecurityTests.setUp
    tearDown = asset_tests.SecurityTests.tearDown
    def test_plan_survives_legacy_save_and_original_cannot_change(self):
        doc = copy.deepcopy(SAMPLE); doc["retirement"] = plan()
        saved = self.client.post("/asset-status/records", json=doc, headers=self.headers)
        self.assertEqual(saved.status_code, 200)
        current = saved.json["document"]
        legacy = copy.deepcopy(current); del legacy["retirement"]
        legacy["other"] = "preserved old screen edit"
        saved = self.client.put("/asset-status/records", json=legacy, headers=self.headers)
        self.assertEqual(saved.json["document"]["retirement"], plan())
        current = saved.json["document"]
        current["retirement"]["origin"]["accounts"][0]["amount"] = 999
        self.assertEqual(self.client.put("/asset-status/records", json=current, headers=self.headers).status_code, 409)
        fresh = self.client.get("/asset-status/records").json["document"]
        self.assertEqual(fresh["retirement"], plan())
        self.assertEqual(fresh["accounts"], saved.json["document"]["accounts"])

    def test_summary_uses_ledger_and_never_writes_assets(self):
        doc = copy.deepcopy(SAMPLE); doc["retirement"] = plan()
        self.client.post("/asset-status/records", json=doc, headers=self.headers)
        before = self.client.get("/asset-status/records").json
        with patch("asset_status.fetch_ledger", return_value={"rows": [], "stale": False}):
            self.assertEqual(self.client.get("/asset-status/retirement-summary").status_code, 200)
        self.assertEqual(before, self.client.get("/asset-status/records").json)


if __name__ == "__main__":
    unittest.main()
