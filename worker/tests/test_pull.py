"""Promise statuses are computed in code (D-024). Cases modelled on the real BEL / Deepak ledgers (E17)."""
from finn_worker import pull

ORDER = ["Q3FY26", "Q4FY26", "Q1FY27", "Q2FY27"]


def m(metric, kind, lo=None, hi=None, unit="%", period=None, due=None, role="management"):
    return {"metric": metric, "kind": kind, "value_low": lo, "value_high": hi, "unit": unit, "period": period,
            "due": due, "speaker_role": role, "quote": f"{metric} statement", "page": 3}


def thread(*calls_items):
    return pull.link([(c, items) for c, items in zip(ORDER, calls_items)])


def test_reset_due_dates_are_revisions_not_reiterations():
    ths = thread([m("QRSAM order receipt", "milestone", due="2026-03")],
                 [m("QRSAM order receipt", "milestone", due="2026-06")],
                 [m("QRSAM order receipt", "milestone", due="2026-09")],
                 [m("QRSAM order receipt", "milestone")])          # "very soon", undated
    assert len(ths) == 1
    s = pull.statuses(ths[0], ORDER, [])
    assert [s[c]["status"] for c in ORDER] == ["early", "revised", "revised", "revised"]
    assert "by 2026-06 → by 2026-09" in s["Q1FY27"]["note"]


def test_floor_softening_to_approximate_is_caught():
    ths = thread([], [m("EBITDA margin", "floor", 28, period="FY27")],
                 [m("EBITDA margin", "floor", 28, period="FY27")],
                 [m("EBITDA margin", "approximate", 28, period="FY27")])
    s = pull.statuses(ths[0], ORDER, [])
    assert s["Q3FY26"]["status"] is None
    assert s["Q1FY27"]["status"] == "early"
    assert s["Q2FY27"]["status"] == "revised" and ">28% → ~28%" in s["Q2FY27"]["note"]


def test_silence_is_a_signal_only_after_repetition():
    once = thread([m("Export share of turnover", "point", 5, period="FY28")], [], [], [])
    s = pull.statuses(once[0], ORDER, [])
    assert [s[c]["status"] for c in ORDER] == ["early", "early", "early", "early"]      # open, not revisited
    twice = thread([m("Export share of turnover", "point", 5, period="FY28")],
                   [m("Export share of turnover", "point", 5, period="FY28")], [], [])
    s = pull.statuses(twice[0], ORDER, [])
    assert [s[c]["status"] for c in ORDER] == ["early", "early", "silent", "silent"]  # repeated, then dropped


def test_full_year_promise_not_settled_mid_year():
    ths = thread([], [m("Order inflow", "floor", 55000, unit="INR crore", period="FY27")], [], [])
    h1 = [{"metric": "order inflow", "period": "FY27", "value": 7334, "unit": "INR crore", "quote": "q", "page": 1}]
    s = pull.statuses(ths[0], ORDER, h1)                 # last call is Q2FY27: FY27 isn't over
    assert s["Q2FY27"]["status"] != "missed"


def test_stated_actual_settles_a_floor():
    ths = thread([m("Revenue growth", "floor", 15, period="FY26")], [], [], [])
    actual = [{"metric": "revenue growth", "period": "FY26", "value": 16.2, "unit": "%", "quote": "grew 16%", "page": 3}]
    s = pull.statuses(ths[0], ORDER, actual)
    assert s["Q2FY27"]["status"] == "delivered" and s["Q2FY27"]["evidence"]["page"] == 3


def test_analyst_numbers_are_not_promises():
    ths = thread([m("EBITDA margin", "point", 30, period="FY27", role="analyst")], [], [], [])
    assert ths == []


def test_quote_verification_tolerates_hyphenation_and_fixes_page():
    pages = {1: "cover letter", 2: "Opening remarks.", 3: "We expect the commis-\nsioning of the MIBK plant within this quarter."}
    item = {"quote": "We expect the commissioning of the MIBK plant within this quarter.", "page": 2}
    assert pull.verify(item, pages) == 3
    assert pull.verify({"quote": "We will double revenue next year.", "page": 3}, pages) is None


def test_copy_lint_rejects_slop_and_numberless_why():
    from finn_worker.reader import lint
    good = lint({"headline": "Noel Tata retires as Vice Chairman", "why": "Effective 5 Nov 2026; he joined the board in 2011."})
    assert good["headline_ok"] and good["why"]
    bad = lint({"headline": "Update on board meeting outcome", "why": "This is a significant development for the company."})
    assert not bad["headline_ok"] and bad["why"] is None


def test_directional_promise_is_not_settled_by_any_actual():
    ths = thread([m("Margins", "directional", period="FY26")], [], [], [])
    actual = [{"metric": "margins", "period": "FY26", "value": 1.0, "unit": "%", "quote": "q", "page": 1}]
    s = pull.statuses(ths[0], ORDER, actual)
    assert s["Q2FY27"]["status"] is None and s["Q2FY27"]["note"] == "period ended"   # closed, not settled, not silent


def test_beating_a_range_is_delivered_not_partly():
    ths = thread([m("Revenue growth", "range", 15, 17, period="FY26")], [], [], [])
    actual = [{"metric": "revenue growth", "period": "FY26", "value": 22, "unit": "%", "quote": "q", "page": 1}]
    s = pull.statuses(ths[0], ORDER, actual)
    assert s["Q2FY27"]["status"] == "delivered" and "(beat)" in s["Q2FY27"]["note"]


def test_reader_records_filings_with_nothing_material(monkeypatch, tmp_path):
    """A filing the model finds purely routine must be stored as read (else it is re-read and re-billed)."""
    from finn_worker import reader, store
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "t.sqlite")
    con = store.connect()
    (tmp_path / "config").mkdir()
    (tmp_path / "config" / "portfolio.json").write_text('{"holdings": [{"symbol": "ABC", "weight": 1}]}')
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "data" / "t.sqlite")
    (tmp_path / "data").mkdir()
    con = store.connect()
    store.upsert(con, "filings", [{"id": "f1", "symbol": "ABC", "company_name": "ABC Ltd", "subject": "General Updates",
                                   "summary": "", "link": "https://x/a.pdf", "published_at": "2026-11-10T10:00:00",
                                   "source": "rss", "category": "unclassified", "tier": "notable", "needs_document": 1}])
    monkeypatch.setattr(reader, "read_filing", lambda f: [])
    assert reader.read_pending().startswith("read 1/1")
    assert con.execute("select count(*) from events where filing_id='f1'").fetchone()[0] == 1
    assert reader.read_pending().startswith("read 0/0")


def test_relative_periods_resolve_against_the_call():
    assert pull.normalise_period("current financial year", "Jan 2026") == "FY26"   # Q3FY26 call
    assert pull.normalise_period("next year", "Jan 2026") == "FY27"
    assert pull.normalise_period("this year", "May 2026") == "FY27"                # Q4 call guides the new year
    assert pull.normalise_period("H1 next year", "Nov 2026") == "H1FY28"
    assert pull.normalise_period("FY27", "Nov 2026") == "FY27"


def test_model_links_between_unlike_promises_are_refused():
    a = {"metric": "EBITDA margin", "unit": "%"}
    b = {"metric": "order inflow", "unit": "INR crore"}
    assert not pull._compatible(a, b)
    assert pull._compatible({"metric": "EBITDA margin", "unit": "%"}, {"metric": "EBITDA margin", "unit": "% of revenue"})
