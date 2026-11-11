"""Results checks and card arithmetic, on tables transcribed by hand from real PDFs
(Cochin Shipyard p.10, Kalyan Jewellers p.12, SBI p.2 -- 10 Nov 2026)."""
from pathlib import Path

import pytest

from finn_worker import results, xbrl

FIX = Path(__file__).parent / "fixtures"

COCHIN = {"found": True, "nature": "Consolidated", "unit": "lakhs", "is_bank": False, "columns": [
    {"label": "30-Sep-26", "period_end": "2026-09-30", "months": 3, "revenue": 124919.09, "other_income": 8262.08,
     "total_income": 133181.17, "finance_costs": 2651.59, "depreciation": 3195.07, "exceptional": None,
     "jv_share": -1.59, "pbt": 7508.00, "tax": 2130.92, "pat": 5377.08},
    {"label": "30-Jun-26", "period_end": "2026-06-30", "months": 3, "revenue": 109421.43, "other_income": 6703.62,
     "total_income": 116125.05, "finance_costs": 2535.82, "depreciation": 3237.12, "pbt": 20248.63, "tax": 5103.27, "pat": 15145.36},
    {"label": "30-Sep-25", "period_end": "2025-09-30", "months": 3, "revenue": 111858.71, "other_income": 12729.64,
     "total_income": 124588.35, "finance_costs": 2014.68, "depreciation": 3090.14, "pbt": 14990.86, "tax": 4238.12, "pat": 10752.74},
]}

KALYAN = {"found": True, "nature": "Consolidated", "unit": "millions", "is_bank": False, "columns": [
    {"label": "30 September 2026", "period_end": "2026-09-30", "months": 3, "revenue": 103226.16, "other_income": 780.38,
     "total_income": 104006.54, "finance_costs": 1086.88, "depreciation": 1271.91, "exceptional": 734.64,
     "pbt": 5600.78, "tax": 1329.83, "pat": 4270.95},
    {"label": "30 June 2026", "period_end": "2026-06-30", "months": 3, "revenue": 105889.27, "other_income": 557.38,
     "total_income": 106446.65, "finance_costs": 1084.01, "depreciation": 1150.39, "exceptional": None,
     "pbt": 4648.17, "tax": 1161.52, "pat": 3486.65},
    {"label": "30 September 2025", "period_end": "2025-09-30", "months": 3, "revenue": 78560.26, "other_income": 514.14,
     "total_income": 79074.40, "finance_costs": 949.36, "depreciation": 1032.12, "exceptional": None,
     "pbt": 3502.65, "tax": 897.55, "pat": 2605.10},
]}

SBIN = {"found": True, "nature": "Consolidated", "unit": "crores", "is_bank": True, "columns": [
    {"label": "30.09.2026", "period_end": "2026-09-30", "months": 3, "interest_earned": 141073.34, "interest_expended": 84272.58,
     "operating_profit": 31591.84, "provisions": 4915.69, "pat": 25741.47, "gnpa_pct": None},
    {"label": "30.06.2026", "period_end": "2026-06-30", "months": 3, "interest_earned": 136240.49, "interest_expended": 82247.57,
     "operating_profit": 38631.68, "provisions": 5747.88, "pat": 24579.04},
    {"label": "30.09.2025", "period_end": "2025-09-30", "months": 3, "interest_earned": 127903.44, "interest_expended": 78002.37,
     "operating_profit": 32116.97, "provisions": 6486.90, "pat": 21504.49},
]}


def test_cochin_matches_xbrl():
    x = xbrl.parse_results((FIX / "results_cochinship_q2fy27_consolidated.xml").read_text(errors="replace"))
    c = results.check(COCHIN, x)
    assert c.ok and c.status == "xbrl_match"


def test_misread_digit_is_caught_by_xbrl():
    bad = {**COCHIN, "columns": [{**COCHIN["columns"][0], "revenue": 124191.09}] + COCHIN["columns"][1:]}
    x = xbrl.parse_results((FIX / "results_cochinship_q2fy27_consolidated.xml").read_text(errors="replace"))
    assert not results.check(bad, x).ok


def test_arithmetic_check_without_xbrl():
    assert results.check(KALYAN).status == "arithmetic_ok"
    broken = {**KALYAN, "columns": [{**KALYAN["columns"][0], "pat": 4720.95}] + KALYAN["columns"][1:]}
    assert not results.check(broken).ok


def test_kalyan_card_separates_exceptional_gain():
    n = results.card_numbers(KALYAN)
    assert n["current"]["revenue"] == pytest.approx(10322.616)      # Rs crore
    assert n["yoy"]["revenue"] == pytest.approx(31.4, abs=0.05)
    assert n["qoq"]["revenue"] == pytest.approx(-2.5, abs=0.05)
    assert n["yoy"]["pbt"] == pytest.approx(59.9, abs=0.05)         # headline
    assert n["yoy"]["pbt_ex_exceptional"] == pytest.approx(38.9, abs=0.05)  # the real story
    assert "ebitda_margin_bp" in n["yoy"]


def test_cochin_card_qoq_yoy():
    n = results.card_numbers(COCHIN)
    assert n["qoq"]["revenue"] == pytest.approx(14.2, abs=0.05)
    assert n["yoy"]["revenue"] == pytest.approx(11.7, abs=0.05)
    assert n["yoy"]["pbt"] == pytest.approx(-49.9, abs=0.05)


def test_bank_card_uses_nii_not_ebitda():
    n = results.card_numbers(SBIN)
    assert n["is_bank"] and "ebitda" not in n["current"]
    assert n["current"]["nii"] == pytest.approx(56800.76)
    assert n["yoy"]["pat"] == pytest.approx(19.7, abs=0.05)


def test_titan_fair_value_gain_stays_out_of_revenue_and_ebitda():
    """Titan Q2 FY27 (PDF p.10): revenue = 20,337 + 277; a 671 fair-value gain sits inside total income."""
    raw = {"found": True, "nature": "Consolidated", "unit": "crores",
           "columns": [{"label": "30-09-2026", "period_end": "2026-09-30", "months": 3},
                       {"label": "30-09-2025", "period_end": "2025-09-30", "months": 3}],
           "rows": [{"label": "I. Revenue from operations (refer note 4)", "values": [None, None]},
                    {"label": "- Sale of products/ services", "values": [20337, 16461]},
                    {"label": "- Other operating revenues", "values": [277, 2264]},
                    {"label": "II. Other income", "values": [145, 112]},
                    {"label": "III. Fair value change of put option liability over NCI", "values": [671, None]},
                    {"label": "IV. Total income (I +II+III)", "values": [21430, 18837]},
                    {"label": "Finance costs", "values": [536, 277]},
                    {"label": "Depreciation and amortisation expense", "values": [263, 189]},
                    {"label": "X. Profit before tax (VIII - IX)", "values": [3000, 1522]},
                    {"label": "XI. Total tax", "values": [607, 402]},
                    {"label": "XII. Profit for the period (X - XI)", "values": [2393, 1120]}]}
    t = results.map_rows(raw)
    c = t["columns"][0]
    assert c["revenue"] == 20614
    assert c["other_income"] == 145 + 671
    assert results.check(t).ok
    n = results.card_numbers(t)
    assert n["current"]["ebitda"] == pytest.approx(3000 + 536 + 263 - 816)   # 2,983: the gain is not operating
