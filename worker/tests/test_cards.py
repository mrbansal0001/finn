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


# ---- audit 12 Nov (F01, F04, F05, F06)
from datetime import date, datetime

from finn_worker import cards as C
from finn_worker import prices


def _filing(fid, sym, cat, at, tier="lead", subject="Litigation / dispute", link="https://x/a.pdf"):
    return {"id": fid, "symbol": sym, "company_name": sym, "category": cat, "tier": tier, "published_at": at,
            "subject": subject, "summary": "", "link": link, "needs_document": 1}


def test_an_unreadable_material_filing_stays_visible_with_its_source():
    f = _filing("f1", "ABC", "litigation", "2026-11-10T12:00:00")
    ev = {"f1": [{"kind": "unreadable", "headline": None, "people": [], "error": "ReadTimeout", "retryable": True, "attempts": 1}]}
    ed = C.build([f], [], {"ABC": 5}, {"ABC": "ABC Ltd"}, datetime(2026, 11, 9), datetime(2026, 11, 11), {}, ev)
    cards = ed["leads"] + ed["more"]
    assert len(cards) == 1 and ed["routine_total"] == 0
    assert cards[0]["tier"] == "lead" and "couldn't read" in cards[0]["why"] and cards[0]["sources"][0]["url"]


def _mv(sym, day, pct, x, n=20):
    return {"symbol": sym, "day": day, "close": 100.0, "change_pct": pct, "volume": 1, "volume_multiple": x,
            "price_alert": True, "volume_alert": True, "baseline_n": n}


def test_every_qualifying_session_is_its_own_card():
    """A 6%/1.6x day must not erase a 4%/8x day: the app filters by the investor's rules afterwards."""
    mv = [_mv("ABC", "2026-11-09", 4, 8), _mv("ABC", "2026-11-10", 6, 1.6)]
    out = C.build_moves(mv, [], [], {"ABC": 5}, {"ABC": "ABC Ltd"}, datetime(2026, 11, 11), ["2026-11-09", "2026-11-10"])
    assert {c["id"] for c in out} == {"move-ABC-2026-11-09", "move-ABC-2026-11-10"}
    assert all(c["sources"][0]["url"].endswith("_F_0000.csv.zip") for c in out)


def test_a_quiet_session_on_the_calendar_stops_a_stale_filing_explaining_a_move():
    """Cochin: filed 10 Nov 14:27 (before that day's close); the 11 Nov move is not 'after' it."""
    filing_card = C.asdict(C.Card(id="c1", symbol="COCHINSHIP", company="Cochin", kind="results", tier="lead",
                                  at="2026-11-10T14:27:05", nse_subject="", headline="Results", headline_source="rule", why=None))
    mv = [_mv("COCHINSHIP", "2026-11-11", -6.8, 10.4)]
    full = C.build_moves(mv, [filing_card], [], {}, {}, datetime(2026, 11, 11), ["2026-11-07", "2026-11-10", "2026-11-11"])
    assert full[0]["facts"]["explained_by"] is None


def test_a_short_volume_baseline_is_said_as_such():
    out = C.build_moves([_mv("NEW", "2026-11-10", 3, 2, n=7)], [], [], {}, {}, datetime(2026, 11, 11), ["2026-11-10"])
    assert "only 7 earlier sessions" in out[0]["why"]


def test_moves_are_exported_down_to_the_lowest_allowed_thresholds():
    def bar(d, close, prev, vol):
        return {"ABC": prices.Bar("ABC", d, close, close, close, close, prev, vol, 0.0)}
    sessions = [bar(date(2026, 10, i + 1), 100, 100, 100) for i in range(20)] + [bar(date(2026, 10, 22), 101.5, 100, 130)]
    got = prices.moves_series(sessions, ["ABC"])
    assert any(m.day == date(2026, 10, 22) for m in got)          # 1.5% on 1.3x: inside what settings allow
