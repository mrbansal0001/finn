from types import SimpleNamespace as NS

from finn_worker.cards import explaining_card


def _card(sym, kind, at, headline="h", tier="lead"):
    return NS(symbol=sym, kind=kind, at=at, headline=headline, tier=tier)


def test_results_filed_after_close_explain_the_next_session():
    """Kalyan: results 10 Nov 17:08 (after the close), +8.6% on 11 Nov. Reliance: Fri 19:40 -> Mon move."""
    days = ["2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11"]
    res = _card("KALYANKJIL", "results", "2026-11-10T17:08:00")
    assert explaining_card({"symbol": "KALYANKJIL", "day": "2026-11-11"}, [res], days) is res
    rel = _card("RELIANCE", "results", "2026-10-30T19:40:00")
    assert explaining_card({"symbol": "RELIANCE", "day": "2026-11-02"}, [rel], ["2026-10-30", "2026-11-02"]) is rel


def test_filing_before_the_previous_close_does_not_explain():
    days = ["2026-11-09", "2026-11-10", "2026-11-11"]
    old = _card("TITAN", "results", "2026-11-10T11:00:00")
    assert explaining_card({"symbol": "TITAN", "day": "2026-11-11"}, [old], days) is None


def test_results_preferred_over_other_same_window_filings():
    days = ["2026-11-10", "2026-11-11"]
    order = _card("COCHINSHIP", "capex", "2026-11-11T09:00:00")
    res = _card("COCHINSHIP", "results", "2026-11-10T16:30:00")
    assert explaining_card({"symbol": "COCHINSHIP", "day": "2026-11-11"}, [order, res], days) is res


from finn_worker.cards import people_tier, scrub_event, _fallback_copy


def test_seniority_decides_people_tier():
    assert people_tier([{"name": "Anup Bagchi", "change": "appointed", "role": "Managing Director and Chief Executive Officer"}]) == "lead"
    assert people_tier([{"name": "Noel N. Tata", "change": "retire", "role": "Non-Executive Director and Vice-Chairman"}]) == "lead"
    assert people_tier([{"name": "V. N. Srivatsan", "change": "appointed", "role": "Chief Compliance Officer"}]) == "notable"
    assert people_tier([{"name": "Prashant Verma", "change": "re-appointed", "role": "Chief Information Security Officer"}]) == "routine"
    assert people_tier([{"name": "Price Waterhouse", "change": "appointed", "role": "Statutory Auditor"}]) == "routine"
    assert people_tier([{"name": "Lily Vadera", "change": "re-appointed", "role": "Independent Director"},
                        {"name": "Kaizad Bharucha", "change": "resigned", "role": "Deputy Managing Director"}]) == "lead"


def test_scrub_removes_null_text_and_keeps_qualifiers():
    ev = scrub_event({"headline": "Sanjay D'Souza superannuates as Group Head", "why": "He served the Bank for nearly 27 years; null",
                      "people": [{"name": "Prashant Verma", "change": "null", "role": "null"}], "quote": ""})
    assert ev["why"] == "He served the Bank for nearly 27 years" and ev["people"] == []
    ev = scrub_event({"headline": "Bharat Forge invests Rs. 2,905.08 million in KSSL", "why": None, "people": [],
                      "quote": "an investment not exceeding Rs. 2,905.08 million"})
    assert ev["headline"] == "Bharat Forge invests up to Rs. 2,905.08 million in KSSL"


def test_transcript_cards_never_promise_a_summary():
    fs = [{"subject": "Analysts/Institutional Investor Meet/Con. Call Updates", "summary": "about Transcript",
           "link": "x_Transcript.pdf", "needs_document": 0}]
    head, _, needs = _fallback_copy("earnings_call", fs, None, True)
    assert head == "Earnings-call transcript filed" and needs is False


def test_no_actual_change_is_not_people_news():
    assert people_tier([{"name": "Tarun Mehta", "change": "comments", "role": "CEO"}], "Tarun Mehta comments on strong quarter") == "routine"
    assert people_tier([], "Price Waterhouse appointed as Statutory Auditor") == "routine"
    assert people_tier([], "CFO Rao resigns, effective 30 Nov") == "lead"


def test_a_minor_people_filing_does_not_explain_a_move():
    days = ["2026-11-05", "2026-11-06"]
    cco = _card("HDFCBANK", "management_change", "2026-11-06T15:21:00", tier="notable")
    assert explaining_card({"symbol": "HDFCBANK", "day": "2026-11-06"}, [cco], days) is None
