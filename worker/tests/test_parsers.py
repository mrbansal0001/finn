"""Parser tests on real NSE filings (10 Nov 2026). Expected values were checked by
hand against each company's results PDF (docs/research/00-hands-on-experiments.md E13-E15)."""
from pathlib import Path

import pytest

from finn_worker import xbrl
from finn_worker.classify import classify

FIX = Path(__file__).parent / "fixtures"


def load(name: str) -> str:
    return (FIX / f"{name}.xml").read_text(encoding="utf-8", errors="replace")


def test_cochinship_results_match_pdf():
    r = xbrl.parse_results(load("results_cochinship_q2fy27_consolidated"))
    assert (r.symbol, r.nature, r.reporting, r.rounding) == ("COCHINSHIP", "Consolidated", "Quarterly", "Lakhs")
    assert r.period_end == "2026-09-30"
    # PDF p.10, Rs lakh: revenue 124,919.09, finance 2,651.59, D&A 3,195.07, PAT 5,377.08
    assert r.values["revenue"] == 12_491_909_000
    assert r.values["finance_costs"] == 265_159_000
    assert r.values["depreciation"] == 319_507_000
    assert r.values["pat"] == 537_708_000
    # XBRL PBT is *before* the JV share (taxonomy quirk); PDF PBT 7,508.00 = 7,509.59 - 1.59
    assert r.values["pbt"] + r.values["jv_share"] == pytest.approx(750_800_000)


def test_kalyan_exceptional_item_kept_out_of_ebitda():
    r = xbrl.parse_results(load("results_kalyankjil_q2fy27_consolidated"))
    assert r.rounding == "Millions"
    assert r.values["exceptional"] == 734_640_000
    assert r.values["pbt"] == 5_600_780_000
    # EBITDA uses PBT before exceptional: 4,866.14 + 1,086.88 + 1,271.91 - 780.38 (Rs m)
    assert r.ebitda() == pytest.approx(6_444_550_000)


def test_nonindas_tag_aliases_and_half_yearly():
    r = xbrl.parse_results(load("results_dccl_h1fy27_nonindas"))
    assert r.reporting == "Half Yearly"
    assert r.values["depreciation"] == 4_000_000      # NONINDAS: DepreciationAndAmortisationExpense
    assert "pbt" in r.values and "pat" in r.values


def test_cim_single_appointment_with_bio():
    symbol, people = xbrl.parse_cim(load("cim_huhtamaki_appointment"))
    assert symbol == "HUHTAMAKI"
    (p,) = people
    assert (p.name, p.change, p.category) == ("Leyton Bright", "Appointment", "Senior Management Personnel")
    assert p.bio and "Amcor for 19 years" in p.bio


def test_cim_two_people_in_one_file():
    symbol, people = xbrl.parse_cim(load("cim_repco_two_people"))
    assert symbol == "REPCOHOME"
    assert [p.name for p in people] == ["R.Vaithianathan", "Usha Ravi"]
    assert all(p.change == "Tenure completion" and p.category == "Director" for p in people)


@pytest.mark.parametrize("subject,summary,category,tier,needs", [
    ("Outcome of Board Meeting", "has submitted to the Exchange, the financial results for the period ended September 30, 2026.", "results", "lead", False),
    ("Outcome of Board Meeting", "has informed the Exchange regarding Board meeting held on 10-Nov-2026", "unclassified", "notable", True),
    ("Change in Directors/KMP/SMP/Auditor/RTA", "", "management_change", "lead", False),
    ("Initiation of Forensic Audit", "", "litigation", "lead", False),
    ("Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company", "", "litigation", "lead", False),
    ("Acquisition-XBRL", "", "m_and_a", "lead", False),
    ("Credit Rating- Revision", "", "credit_rating", "notable", False),
    ("Analysts/Institutional Investor Meet/Con. Call Updates", "Transcript of earnings call", "earnings_call", "notable", False),
    ("Analysts/Institutional Investor Meet/Con. Call Updates", "Schedule of meet", "investor_meetings", "routine", False),
    ("Copy of Newspaper Publication", "", "unclassified", "routine", False),
    ("General Updates", "", "unclassified", "notable", True),
])
def test_classifier_rules(subject, summary, category, tier, needs):
    label = classify(subject, summary)
    assert (label.category, label.tier, label.needs_document) == (category, tier, needs)
