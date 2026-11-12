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


def test_twin_filings_become_one_card():
    from datetime import datetime
    from finn_worker import cards
    base = {"symbol": "TITAN", "company_name": "Titan Company Limited", "category": "management_change", "tier": "lead",
            "subject": "Change in Directors/KMP/SMP/Auditor/RTA", "summary": "", "needs_document": 0}
    fs = [dict(base, id="a", link="https://x/CIM_1.xml", published_at="2026-11-05T18:51:00"),
          dict(base, id="b", link="https://x/TITAN_1.pdf", published_at="2026-11-05T18:55:30", subject="Retirement")]
    ed = cards.build(fs, [], {"TITAN": 5}, {"TITAN": "Titan"}, datetime(2026, 11, 5), datetime(2026, 11, 6))
    all_cards = ed["leads"] + ed["more"]
    assert len(all_cards) == 1 and len(all_cards[0]["sources"]) == 2


def test_a_truncated_feed_is_never_cached(monkeypatch, tmp_path):
    """12 Nov: NSE served the announcements RSS cut off at 239,387 bytes; it was cached for 10 minutes."""
    import pytest
    from finn_worker import fetch, feeds
    monkeypatch.setattr(fetch, "DATA_DIR", tmp_path)

    class R:
        status_code, content = 200, b"<rss><channel><item>cut"
        def raise_for_status(self): pass

    monkeypatch.setattr(fetch, "_http", lambda: type("C", (), {"get": lambda self, u: R()})())
    with pytest.raises(fetch.Incomplete):
        fetch.get("https://example.test/feed.xml", max_age=600, validate=feeds._complete_rss)
    assert not fetch.cache_path("https://example.test/feed.xml").exists()


def test_xbrl_only_filing_becomes_plain_facts_without_contact_details():
    from finn_worker.xbrl_facts import facts
    xml = ("<x><in-capmkt:NSESymbol>SBIN</in-capmkt:NSESymbol>"
           "<in-capmkt:TypeOfMeetingForWhichIntimationIsGiven>Institutional Investor Meet</in-capmkt:TypeOfMeetingForWhichIntimationIsGiven>"
           "<in-capmkt:DateOfMeetingOrCallOrConferenceOrEventForIntimation>2026-11-17</in-capmkt:DateOfMeetingOrCallOrConferenceOrEventForIntimation>"
           "<in-capmkt:PlaceOfMeetingOrCallOrConferenceOrEventForIntimation>Singapore</in-capmkt:PlaceOfMeetingOrCallOrConferenceOrEventForIntimation>"
           "<in-capmkt:NameOfContactPersonForIntimation>Mr Kaitav Shah</in-capmkt:NameOfContactPersonForIntimation>"
           "<in-capmkt:EmailIDOfContactPersonForIntimation>svp.inv@sbi.co.in</in-capmkt:EmailIDOfContactPersonForIntimation></x>")
    got = facts(xml)
    assert ["Type of meeting", "Institutional Investor Meet"] in got
    assert ["Date of meeting", "17 Nov 2026"] in got and ["Place of meeting", "Singapore"] in got
    assert not any("Shah" in v or "@" in v for _, v in got)
