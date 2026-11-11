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
    assert s["Q2FY27"]["status"] == "closed" and "period ended" in s["Q2FY27"]["note"]   # closed, not settled, not silent


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


# --- ledger quality guards (E27) ---------------------------------------------------------

def test_ground_drops_a_value_the_quote_does_not_print():
    it = {"quote": "This year, we should have revenues close to INR5,200 crores.", "kind": "approximate",
          "value_low": 1500, "value_high": None, "unit": "INR crore"}
    pull.ground(it)
    assert it["value_low"] is None and it["ungrounded"] and pull._describe(it) == "no figure"


def test_ground_keeps_printed_values_and_their_scale_word():
    it = {"quote": "I'm looking at that number of displays, almost 40 million to 50 million.", "kind": "range",
          "value_low": 40, "value_high": 50, "unit": "units"}
    pull.ground(it)
    assert pull._describe(it) == "40–50 mn units"


def test_ground_accepts_billion_restated_as_million():
    it = {"quote": "The $2 billion by FY27, that's a run rate.", "kind": "point", "value_low": 2000,
          "value_high": None, "unit": "USD mn"}
    pull.ground(it)
    assert it["value_low"] == 2000 and not it.get("ungrounded")


def test_ground_rejects_double_turned_into_percent():
    it = {"quote": "We expect the revenues to grow almost to 2x in the current fiscal.", "kind": "floor",
          "value_low": 200, "value_high": None, "unit": "%"}
    pull.ground(it)
    assert it["value_low"] is None


def test_degenerate_range_reads_as_a_point():
    it = {"quote": "run rate being in the range of $500 million", "kind": "range", "value_low": 500,
          "value_high": 500, "unit": "USD mn"}
    pull.ground(it)
    assert pull._describe(it) == "$500 mn"


def test_different_segments_do_not_link():
    a = {"metric": "revenue", "scope": "lighting", "unit": "INR crore", "value_low": 1700}
    b = {"metric": "revenue", "scope": "mobile phones", "unit": "INR crore", "value_low": 1650}
    assert not pull.scopes_compatible(a, b)
    assert pull.scopes_compatible({**a, "scope": "company"}, {**b, "scope": "overall"})


def test_amounts_far_apart_without_a_shared_name_do_not_link():
    calls = [("Feb 2026", [{"metric": "capex", "speaker_role": "management", "kind": "ceiling", "value_high": 3000,
                            "unit": "INR crore", "quote": "up to INR3,000 crores"}]),
             ("May 2026", [{"metric": "capex", "speaker_role": "management", "kind": "range", "value_low": 800,
                            "value_high": 850, "unit": "INR crore", "quote": "INR800 crores to INR850 crores capex"}])]
    assert len(pull.link(calls)) == 2


def test_shared_programme_name_links_despite_resized_amount():
    calls = [("Q3FY26", [{"metric": "NGC order", "speaker_role": "management", "kind": "range", "value_low": 2000,
                          "value_high": 3000, "unit": "INR cr", "quote": "x"}]),
             ("Q4FY26", [{"metric": "NGC order", "speaker_role": "management", "kind": "range", "value_low": 10000,
                          "value_high": 12000, "unit": "INR cr", "quote": "y"}])]
    assert len(pull.link(calls)) == 1


def test_call_month():
    assert pull.call_month("Nov 2026") == "2026-11" and pull.call_month("Q3FY26") is None


def test_ground_reads_numbers_touching_a_currency_prefix():
    it = {"quote": "So Bharat Forge, we have said up to INR3,000 crores.", "kind": "ceiling", "value_low": None,
          "value_high": 3000, "unit": "INR crore"}
    pull.ground(it)
    assert pull._describe(it) == "<₹3,000 cr"


def test_ground_ignores_durations_unless_the_unit_is_time():
    dbl = {"quote": "we will double our business in the next 2 years or so.", "kind": "point", "value_low": 2,
           "value_high": None, "unit": "x"}
    assert pull.ground(dbl)["value_low"] is None
    months = {"quote": "the clearance should come in 2 to 4 months", "kind": "range", "value_low": 2, "value_high": 4,
              "unit": "months"}
    assert pull.ground(months)["value_low"] == 2


def test_backward_statements_are_not_promises():
    assert pull.looks_backward({"period": "last quarter", "quote": "In last quarter, the company had secured new business worth INR2,388 crores"})
    assert pull.looks_backward({"period": "last 5 years", "quote": "We have grown at roughly about 23.9% for the last 5 years"})
    assert not pull.looks_backward({"period": "current fiscal", "quote": "We expect 3x growth in the revenues in the current fiscal"})
    assert not pull.looks_backward({"period": "FY27", "quote": "we have achieved 20% and we will grow 25% next year"})


def test_null_period_and_doubled_scale():
    assert pull.normalise_period("null", "Nov 2026") is None
    it = {"quote": "somewhere around 60 million, 65 million units", "kind": "range", "value_low": 60, "value_high": 65,
          "unit": "million units"}
    pull.ground(it)
    assert pull._describe(it) == "60–65 million units"


# --- status logic (E29) ------------------------------------------------------------------------

def test_fy_parsing_handles_four_digits_and_ranges():
    assert pull._period_fy("FY2030") == 30 and pull._period_fy("FY26-FY30") == 30 and pull._period_fy("FY26-30") == 30
    assert pull.normalise_period("FY2030", "Nov 2026") == "FY30"
    assert pull.period_end_month("H1FY27") == "2026-09" and pull.period_end_month("Q3FY27") == "2026-12"
    assert pull.call_reviews("Nov 2026") == "2026-09" and pull.call_reviews("Q2FY27") == "2026-09"


def test_a_long_range_promise_is_not_closed_early():
    ths = thread([m("capex plan", "point", 5000, unit="INR crore", period="FY26-FY30")], [], [], [])
    s = pull.statuses(ths[0], ORDER, [])
    assert s["Q2FY27"]["status"] == "early"


def test_slipped_target_period_is_a_revision():
    ths = thread([m("QRSAM order receipt", "directional", period="FY27")],
                 [m("QRSAM order receipt", "directional", period="FY28")], [], [])
    s = pull.statuses(ths[0], ORDER, [])
    assert len(ths) == 1 and s["Q4FY26"]["status"] == "revised" and "FY28" in s["Q4FY26"]["note"]
    # recurring metrics: next year's guidance is a new promise, not a slip
    assert len(thread([m("EBITDA margin", "point", 20, period="FY27")], [m("EBITDA margin", "point", 22, period="FY28")], [], [])) == 2


def test_overdue_date_replaced_is_missed_then_reset():
    ths = thread([m("plant commissioning", "milestone", due="2026-03")], [], [m("plant commissioning", "milestone", due="2026-12")], [])
    s = pull.statuses(ths[0], ORDER, [])
    assert s["Q1FY27"]["status"] == "revised" and s["Q1FY27"].get("missed_then_reset")


def test_two_items_from_one_call_never_share_a_row():
    ths = thread([m("mobile volumes", "range", 33, 34, unit="million", period="FY27"),
                  m("mobile volumes", "range", 55, 60, unit="million", period="FY27")], [], [], [])
    assert len(ths) == 2


def test_actual_of_another_scope_or_size_does_not_settle():
    pr = m("IT hardware revenue", "approximate", 1500, unit="INR crore", period="FY26")
    pr["scope"] = "IT hardware"
    ths = thread([pr], [], [], [])
    whole = [{"metric": "revenue", "period": "FY26", "value": 48893, "unit": "INR crore", "quote": "q", "page": 1}]
    s = pull.statuses(ths[0], ORDER, whole)
    assert s["Q2FY27"]["status"] not in ("delivered", "partly", "missed")


def test_lower_is_better_metrics_are_judged_the_right_way():
    ths = thread([m("receivable days", "approximate", 60, unit="days", period="FY26")], [], [], [])
    act = [{"metric": "receivable days", "period": "FY26", "value": 75, "unit": "days", "quote": "q", "page": 1}]
    assert pull.statuses(ths[0], ORDER, act)["Q2FY27"]["status"] == "missed"


def test_half_year_promise_settles_once_the_half_is_reported():
    ths = thread([], [], [m("revenue growth", "floor", 15, period="H1FY27")], [])
    act = [{"metric": "revenue growth", "period": "H1FY27", "value": 17, "unit": "%", "quote": "q", "page": 2}]
    assert pull.statuses(ths[0], ORDER, act)["Q2FY27"]["status"] == "delivered"


def test_q4_call_actual_belongs_to_the_year_just_ended():
    assert pull.normalise_period("this year", "May 2026", actual=True) == "FY26"
    assert pull.normalise_period("this year", "May 2026") == "FY27"


def test_shared_sentence_with_two_targets_keeps_both():
    a = {"quote": "We expect revenue growth of 15% and EBITDA margin of 22%.", "metric": "revenue growth", "value_low": 15}
    b = {"quote": "We expect revenue growth of 15% and EBITDA margin of 22%.", "metric": "EBITDA margin", "value_low": 22}
    assert len(pull._dedupe([a, b])) == 2


def test_verified_quote_is_the_page_text():
    page = {4: "Finally, we feel that the margins will be 16%-17% for the year.\\nNext question please."}
    it = {"quote": "We feel confident that the margins will be 16%-17% for the year.", "page": 4}
    assert pull.verify(it, page, threshold=80) == 4
    assert it["quote"].startswith("we feel that") or it["quote"].startswith("Finally") or "the margins will be 16%-17%" in it["quote"]
    assert it["quote"] in page[4]


def test_a_figure_given_later_is_not_a_revision():
    ths = thread([m("revenue", "directional", unit=None, period="FY27")], [m("revenue", "approximate", 56000, unit="INR crore", period="FY27")], [], [])
    s = pull.statuses(ths[0], ORDER, [])
    assert s["Q4FY26"]["status"] == "early" and "quantified" in s["Q4FY26"]["note"]
