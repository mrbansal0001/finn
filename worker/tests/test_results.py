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


# --- column identity, banks, excise, owners, lenders (E29: source audit of every card) -------------

def _q(label, end, months):
    return {"label": label, "period_end": end, "months": months}


ATHER_COLS = [_q("Q2 FY27", "2026-09-30", 3), _q("Q1 FY27", "2026-06-30", 3), _q("Q2 FY26", "2025-09-30", 3),
              _q("H1 FY27", "2026-09-30", 6), _q("H1 FY26", "2025-09-30", 6), _q("FY26", "2026-03-31", 12)]


def _ather(revenue_row, pat_row):
    oi = [62.71, 42.73, 41.79, 105.44, 70.12, 151.32]
    return {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [dict(c) for c in ATHER_COLS],
            "rows": [{"label": "Revenue from operations", "values": revenue_row},
                     {"label": "Other income", "values": oi},
                     {"label": "Total income", "values": [round(a + b, 2) for a, b in zip(revenue_row, oi)]},
                     {"label": "Profit / (loss) before tax", "values": pat_row},
                     {"label": "Total tax expense", "values": [0] * 6},
                     {"label": "Profit / (loss) for the period", "values": pat_row}]}


def test_ather_true_columns_pass_and_read_as_growth():
    """Ather Q2 FY27 consolidated, PDF p3: 1,464.24 vs 898.88 a year ago; first profit (1.26)."""
    t = results.map_rows(_ather([1464.24, 1216.92, 898.88, 2681.16, 1543.46, 3671.76],
                                [1.26, -51.09, -154.07, -49.83, -332.30, -517.17]))
    assert results.check(t).ok
    n = results.card_numbers(t)
    assert n["yoy"]["revenue"] == pytest.approx(62.9, abs=0.05)
    assert n["yoy"]["pat"] is None            # a swing from loss to profit is said in words, not as a %


def test_shifted_columns_fail_the_half_year_identity():
    """The live card read last year's column as this quarter: arithmetic per column still adds up."""
    t = results.map_rows(_ather([898.88, 1216.92, 1464.24, 2681.16, 1543.46, 3671.76],
                                [-154.07, -51.09, 1.26, -49.83, -332.30, -517.17]))
    chk = results.check(t)
    assert not chk.ok and "half year" in chk.status


def test_current_column_must_be_latest():
    raw = _ather([1464.24, 1216.92, 898.88, 2681.16, 1543.46, 3671.76], [1.26, -51.09, -154.07, -49.83, -332.30, -517.17])
    raw["columns"][0]["period_end"] = "2025-06-30"
    assert "not the latest" in results.check(results.map_rows(raw)).status


def test_bank_rows_shifted_are_caught():
    """SBI consolidated as the live card read it: EPS landed in the GNPA row, PAT equal to last year's."""
    cols = [_q("Q2", "2026-09-30", 3), _q("Q1", "2026-06-30", 3), _q("Q2 LY", "2025-09-30", 3)]
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": cols,
           "rows": [{"label": "Interest earned", "values": [141073.34, 138000.0, 127903.44]},
                    {"label": "Other income", "values": [46682.85, 40000.0, 41000.0]},
                    {"label": "Total income", "values": [187756.19, 178000.0, 168903.44]},
                    {"label": "Interest expended", "values": [84272.58, 85007.08, 78002.37]},
                    {"label": "Operating profit before provisions", "values": [156164.35, 141430.18, 143740.82]},
                    {"label": "Provisions (other than tax)", "values": [31591.84, 38631.68, 32116.97]},
                    {"label": "Profit from ordinary activities before tax", "values": [33000.0, 30000.0, 28000.0]},
                    {"label": "Tax expense", "values": [3429.79, 7000.0, 7000.0]},
                    {"label": "Net profit for the period", "values": [3026.57, 6000.0, 3026.57]},
                    {"label": "% of Gross NPA", "values": [26.12, 25.0, 22.81]}]}
    chk = results.check(results.map_rows(raw))
    assert not chk.ok
    assert "operating profit" in chk.status or "gross NPA" in chk.status or "identical" in chk.status


def test_revenue_is_reported_net_of_excise():
    raw = {"found": True, "nature": "Standalone", "unit": "crores",
           "columns": [_q("Q2", "2026-09-30", 3), _q("Q2 LY", "2025-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [30578.37, 21255.83]},
                    {"label": "Other income", "values": [600.0, 500.0]},
                    {"label": "Total income", "values": [31178.37, 21755.83]},
                    {"label": "Excise duty", "values": [10309.77, 1754.23]},
                    {"label": "Finance costs", "values": [10.0, 10.0]},
                    {"label": "Depreciation", "values": [500.0, 450.0]},
                    {"label": "Profit before tax", "values": [6500.0, 6000.0]},
                    {"label": "Tax expense", "values": [1600.0, 1500.0]},
                    {"label": "Profit for the period", "values": [4900.0, 4500.0]}]}
    n = results.card_numbers(results.map_rows(raw))
    assert n["net_of_excise"] and n["current"]["revenue"] == pytest.approx(20268.6, abs=0.01)
    assert n["yoy"]["revenue"] == pytest.approx(3.9, abs=0.05)


def test_heading_row_does_not_claim_tax():
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [100.0]},
                    {"label": "Profit before tax", "values": [20.0]},
                    {"label": "Tax expense", "values": [None]},
                    {"label": "Current tax", "values": [5.0]},
                    {"label": "Total tax expense", "values": [5.0]},
                    {"label": "Profit for the period", "values": [15.0]}]}
    assert results.map_rows(raw)["columns"][0]["tax"] == 5.0


def test_owners_profit_preferred_and_wrong_finance_cost_skipped():
    """L&T-style: a financial-services finance cost line before 'Finance costs'; profit split to owners/NCI."""
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [70000.0]},
                    {"label": "Finance cost of financial services business", "values": [1968.86]},
                    {"label": "Finance costs", "values": [472.94]},
                    {"label": "Profit before share of profit of joint ventures", "values": [8000.0]},
                    {"label": "Profit before tax", "values": [8000.0]},
                    {"label": "Profit for the period", "values": [5915.0]},
                    {"label": "Owners of the Company", "values": [5202.10]},
                    {"label": "Non-controlling interests", "values": [712.90]}]}
    t = results.map_rows(raw)
    c = t["columns"][0]
    assert c["finance_costs"] == 472.94 and "jv_share" not in c
    assert results.card_numbers(t)["current"]["pat"] == pytest.approx(5202.10)


def test_lender_has_no_ebitda():
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [20000.0]},
                    {"label": "Other income", "values": [10.0]},
                    {"label": "Total income", "values": [20010.0]},
                    {"label": "Finance costs", "values": [7000.0]},
                    {"label": "Depreciation", "values": [200.0]},
                    {"label": "Profit before tax", "values": [6000.0]},
                    {"label": "Tax expense", "values": [1500.0]},
                    {"label": "Profit for the period", "values": [4500.0]}]}
    n = results.card_numbers(results.map_rows(raw))
    assert n["is_lender"] and n["current"]["ebitda"] is None and n["current"]["ebitda_margin_pct"] is None


def test_copy_leads_with_underlying_profit_when_one_offs_dominate():
    from finn_worker.cards import results_copy
    n = {"current": {"pat": 2393, "non_operating_extra": 671, "exceptional": None, "ebitda_margin_pct": 14.5},
         "prev_y": {"pat": 1120}, "yoy": {"revenue": 10.1, "pat": 113.7, "pbt_underlying": 52.1, "ebitda_margin_bp": 445}}
    head, why = results_copy(n)
    assert head == "Revenue up 10.1% YoY, profit before one-offs up 52.1%"
    assert "113.7%" in why and "671" in why


def test_copy_says_loss_widened_not_profit_down():
    from finn_worker.cards import results_copy
    n = {"current": {"pat": -154}, "prev_y": {"pat": -51}, "yoy": {"revenue": 5.0, "pat": None}}
    assert results_copy(n)[0] == "Revenue up 5.0% YoY, loss widened to ₹154 cr"


def test_cochin_labels_misprints_and_tax_components():
    """Cochin Q2 FY27 consolidated p10: '6perations' in the text layer, 'beforeTax', tax only as components."""
    raw = {"found": True, "nature": "Consolidated", "unit": "lakhs",
           "columns": [_q("Q2", "2026-09-30", 3), _q("Q2 LY", "2025-09-30", 3)],
           "rows": [{"label": "Revenue from 6perations", "values": [124919.09, 111858.71]},
                    {"label": "Other income", "values": [8262.08, 12729.64]},
                    {"label": "Total Income", "values": [133181.17, 124588.35]},
                    {"label": "Finance costs", "values": [2651.59, 2014.68]},
                    {"label": "Depreciation and amortisation expense", "values": [3195.07, 3090.14]},
                    {"label": "Profit/(loss) before share of profit/(loss) of joint venture and exceptional items", "values": [7509.59, 14990.86]},
                    {"label": "Share of profit/(loss) of joint venture", "values": [-1.59, None]},
                    {"label": "Profit beforeTax (V+VI)", "values": [7508.0, 14990.86]},
                    {"label": "Tax expense (1) Current tax", "values": [3175.84, 4400.0]},
                    {"label": "(2) Income tax of prior years", "values": [None, None]},
                    {"label": "(3) Deferred tax", "values": [-1044.92, -161.88]},
                    {"label": "Profit for the period/year (VII-VIII)", "values": [5377.08, 10752.74]}]}
    t = results.map_rows(raw)
    c = t["columns"][0]
    assert c["revenue"] == 124919.09 and c["pbt"] == 7508.0
    assert c["tax"] == pytest.approx(3175.84 - 1044.92)
    assert results.check(t).ok


def test_bel_consolidated_layout_without_a_plain_pbt_line():
    raw = {"found": True, "nature": "Consolidated", "unit": "lakhs",
           "columns": [_q("Q2", "2026-09-30", 3), _q("Q2 LY", "2025-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [729100, 576400]},
                    {"label": "Profit before share of net profit of associates accounted under equity method & tax", "values": [205411, 139625]},
                    {"label": "Tax expense", "values": [None, None]},
                    {"label": "- Current tax", "values": [55827, 37446]},
                    {"label": "- Earlier years tax", "values": [-3, -2211]},
                    {"label": "- Deferred tax", "values": [-3549, 3]},
                    {"label": "Total provision for taxation", "values": [52278, 35235]},
                    {"label": "Share of net profit of associates accounted under equity method", "values": [904, 1063]},
                    {"label": "Profit for the period (9 + 10)", "values": [154037, 105453]}]}
    t = results.map_rows(raw)
    c = t["columns"][0]
    assert c["pbt"] == 205411 and c["tax"] == 52278 and c["jv_share"] == 904
    chk = results.check(t)          # a trimmed fixture: the profit identity holds, nothing failed
    assert not chk.notes and "PBT − tax = PAT" in chk.ran


def test_lt_owners_line_with_colon_and_equity_line_ignored():
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3), _q("Q2 LY", "2025-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [70000.0, 60000.0]},
                    {"label": "5 Profit before tax (3+4)", "values": [7641.06, 6336.11]},
                    {"label": "Tax expense", "values": [1725.91, 1649.02]},
                    {"label": "7 Net profit after tax (5-6)", "values": [5915.15, 4687.09]},
                    {"label": "Attributable to: Owners of the Company", "values": [5202.1, 3926.09]},
                    {"label": "Non-controlling interests", "values": [11.99, -221.46]},
                    {"label": "13 Other equity attributable to owners of the Company", "values": [109014.67, None]}]}
    n = results.card_numbers(results.map_rows(raw))
    assert n["current"]["pat"] == pytest.approx(5202.1) and n["yoy"]["pat"] == pytest.approx(32.5, abs=0.05)


def test_mislabelled_year_ago_column_inferred_from_standard_layout():
    cols = [_q("Q Sep'26", "2026-09-30", 3), _q("Q Jun'26", "2026-06-30", 3), _q("Half Year Ended 30th Seo'25", "2025-09-30", 6),
            _q("H1 Sep'26", "2026-09-30", 6), _q("H1 Sep'25", "2025-09-30", 6), _q("FY Mar'26", "2026-03-31", 12)]
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": cols,
           "rows": [{"label": "Revenue from Operations", "values": [332861, 311850, 258898, 644711, 520000, 1100000]},
                    {"label": "Profit Before Tax", "values": [38613, 30630, 29124, 69243, 58000, 120000]},
                    {"label": "Tax expenses", "values": [9363, 7629, 6978, 16992, 14000, 30000]},
                    {"label": "Profit After Tax", "values": [29250, 23001, 22146, 52251, 44000, 90000]}]}
    n = results.card_numbers(results.map_rows(raw))
    assert n["yoy"]["revenue"] == pytest.approx(28.6, abs=0.05)


def test_bharat_forge_stray_jv_tax_line_is_not_the_tax():
    raw = {"found": True, "nature": "Consolidated", "unit": "millions", "columns": [_q("Q2", "2026-09-30", 3), _q("Q2 LY", "2025-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [45000.0, 37000.0]},
                    {"label": "Share of profit/ (loss) of associates and joint ventures", "values": [-51.86, -110.27]},
                    {"label": "Income tax expense", "values": [8.81, 2.35]},
                    {"label": "7 Profit before tax (5+6)", "values": [4178.79, 444.44]},
                    {"label": "8 Income tax expense", "values": [None, None]},
                    {"label": "a) Current tax", "values": [1616.69, 1479.53]},
                    {"label": "b) Deferred tax (credit)/charge", "values": [-224.71, -136.21]},
                    {"label": "Income tax expense (a+ b)", "values": [1391.98, 1343.32]},
                    {"label": "9 Profit/ (loss) for the period/year (7-8)", "values": [2786.81, -898.88]}]}
    t = results.map_rows(raw)
    assert t["columns"][0]["tax"] == 1391.98 and t["columns"][1]["tax"] == 1343.32
    chk = results.check(t)          # a trimmed fixture: the profit identity holds, nothing failed
    assert not chk.notes and "PBT − tax = PAT" in chk.ran


def test_owners_profit_line_under_profit_heading_not_tci():
    """Bharat Forge p3 prints the TCI-attributable owners line first, then the profit one."""
    raw = {"found": True, "nature": "Consolidated", "unit": "millions", "columns": [_q("Q2", "2026-09-30", 3), _q("Q2 LY", "2025-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [45000.0, 37250.0]},
                    {"label": "7 Profit before tax (5+6)", "values": [4178.79, 4400.0]},
                    {"label": "Income tax expense (a+ b)", "values": [1391.98, 1407.22]},
                    {"label": "9 Profit/ (loss) for the period/year (7-8)", "values": [2786.81, 2992.78]},
                    {"label": "12 Total comprehensive income/(loss) above attributable to:", "values": [None, None]},
                    {"label": "- Owners of the Company", "values": [3098.24, 2115.75]},
                    {"label": "- Non-controlling interests", "values": [28.16, 0.75]},
                    {"label": "13 Of the total comprehensive income/(loss) above, profit/(loss) for the period/year attributable to:", "values": [None, None]},
                    {"label": "- Owners of the Company", "values": [2758.65, 2991.99]},
                    {"label": "- Non-controlling interests", "values": [28.16, 0.79]}]}
    n = results.card_numbers(results.map_rows(raw))
    assert n["current"]["pat"] == pytest.approx(275.865) and n["yoy"]["pat"] == pytest.approx(-7.8, abs=0.05)


def test_unit_printed_on_the_page_wins():
    assert results.unit_from_text("Statement of results (In ₹ Million)\nParticulars") == "millions"
    assert results.unit_from_text("(Rs. in Lakhs) ... EPS in ₹") == "lakhs"
    assert results.unit_from_text("Rs in crore ... Rs in lakhs") is None          # ambiguous: keep the model's


def test_missed_exceptional_line_fails_the_income_identity():
    raw = {"found": True, "nature": "Standalone", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [5968.0]},
                    {"label": "Other income", "values": [300.0]},
                    {"label": "Total income", "values": [6268.0]},
                    {"label": "Total expenses", "values": [5500.0]},
                    {"label": "Profit before tax", "values": [3412.0]},      # includes a 2,644 exceptional not mapped
                    {"label": "Tax expense", "values": [800.0]},
                    {"label": "Profit for the period", "values": [2612.0]}]}
    assert "exceptional" in results.check(results.map_rows(raw)).status


def test_doubled_text_layer_and_equity_shareholders_line():
    assert results._norm_label("Owners Owners of the the Company Company") == "owners of the company"
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [4000.0]},
                    {"label": "Profit before tax", "values": [-20.0]},
                    {"label": "Tax expense", "values": [30.0]},
                    {"label": "Loss for the period", "values": [-50.0]},
                    {"label": "Profit/(loss) for the period attributable to:", "values": [None]},
                    {"label": "Equity shareholders of the Company", "values": [-122.0]},
                    {"label": "Non-controlling interests", "values": [72.0]}]}
    assert results.card_numbers(results.map_rows(raw))["current"]["pat"] == pytest.approx(-122.0)


def test_owners_found_by_pairing_with_minority_interest():
    """Bajaj Finserv p10: three owners/NCI pairs (profit, OCI, TCI), no headings; profit pair sums to total."""
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [43415.7]},
                    {"label": "Profit before tax", "values": [8000.0]},
                    {"label": "Tax expense", "values": [2048.0]},
                    {"label": "Profit for the period", "values": [5952.01]},
                    {"label": "Total comprehensive income", "values": [3975.06]},
                    {"label": "Owners of the company", "values": [1241.06]},
                    {"label": "Non-controlling interests", "values": [2734.0]},
                    {"label": "Owners of the company", "values": [2757.66]},
                    {"label": "Non-controlling interests", "values": [3194.35]}]}
    assert results.card_numbers(results.map_rows(raw))["current"]["pat"] == pytest.approx(2757.66)


def test_profit_after_minority_line_is_the_owners_profit():
    """HDFC Bank p9: 'Less: Minority Interest' then 'Net profit for the period'."""
    raw = {"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
           "rows": [{"label": "Interest earned", "values": [90000.0]}, {"label": "Other income", "values": [10000.0]},
                    {"label": "Total income", "values": [100000.0]}, {"label": "Interest expended", "values": [45535.8]},
                    {"label": "Operating profit before provisions and contingencies", "values": [32871.54]},
                    {"label": "Provisions (other than tax) and contingencies", "values": [4209.0]},
                    {"label": "Profit from ordinary activities before tax and minority interest", "values": [28662.54]},
                    {"label": "Tax expense", "values": [7125.45]},
                    {"label": "Net profit for the period before minority interest", "values": [21537.09]},
                    {"label": "Less: Minority Interest", "values": [837.06]},
                    {"label": "Net profit for the period", "values": [20700.03]}]}
    assert results.card_numbers(results.map_rows(raw))["current"]["pat"] == pytest.approx(20700.03)


def test_owners_label_with_list_marker():
    assert results.map_rows({"found": True, "nature": "Consolidated", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3)],
                             "rows": [{"label": "Revenue from operations", "values": [100.0]},
                                      {"label": "Profit for the period", "values": [41.0]},
                                      {"label": "Profit for the year attributable to a) Owners of the Company", "values": [34.0]},
                                      {"label": "b) Non-controlling interests", "values": [7.0]}]})["columns"][0]["pat_owners"] == 34.0


def test_add_less_exceptional_label_maps():
    raw = {"found": True, "nature": "Standalone", "unit": "crores", "columns": [_q("Q2", "2026-09-30", 3), _q("Q1", "2026-06-30", 3)],
           "rows": [{"label": "Revenue from operations", "values": [6800.0, 6500.0]},
                    {"label": "Total Income", "values": [7130.41, 6823.4]},
                    {"label": "Total Expenses", "values": [5534.31, 5369.28]},
                    {"label": "Add / (Less) : Exceptional items (Refer Note 6)", "values": [None, -2644.02]},
                    {"label": "Profit/ (Loss) before tax (3+4)", "values": [1596.1, -1189.9]},
                    {"label": "Total Tax Expense", "values": [371.65, -299.56]},
                    {"label": "Profit for the period", "values": [1224.45, -890.34]}]}
    t = results.map_rows(raw)
    assert t["columns"][1]["exceptional"] == -2644.02


def test_unit_from_rupee_amounts_in_the_notes():
    t = "adjustments of Rs. 3,830 million as at ... Rs. 55 million ... guarantee up to EUR 1,540 million"
    assert results.unit_from_amounts(t) == "millions"
    assert results.unit_from_amounts("Rs. 3,830 million and Rs 12 crore") is None


def test_a_sparse_table_cannot_claim_to_reconcile():
    """Audit F07: revenue, PBT and PAT alone run no identity; the badge must not say 'reconciled'."""
    t = {"nature": "Consolidated", "unit": "crores", "is_bank": False,
         "columns": [{"label": "Q2", "period_end": "2026-09-30", "months": 3, "revenue": 100.0, "pbt": 20.0, "pat": 15.0}]}
    chk = results.check(t)
    assert not chk.ok and chk.ran == []


def test_checks_that_ran_are_listed():
    t = {"nature": "Consolidated", "unit": "crores", "is_bank": False,
         "columns": [{"label": "Q2", "period_end": "2026-09-30", "months": 3, "revenue": 100.0, "other_income": 5.0,
                      "total_income": 105.0, "total_expenses": 85.0, "pbt": 20.0, "tax": 5.0, "pat": 15.0}]}
    chk = results.check(t)
    assert chk.ok and chk.status == "arithmetic_ok" and "PBT − tax = PAT" in chk.ran and len(chk.ran) == 3
