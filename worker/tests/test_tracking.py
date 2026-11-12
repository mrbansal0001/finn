from finn_worker import tracking

RES = {"period_end": "2026-09-30", "nature": "Consolidated", "source_url": "u",
       "comparatives": {"current": {"ebitda_margin_pct": 15.6}, "yoy": {"revenue": 20.8, "pat": -7.8}}}


def row(metric, lo=None, hi=None, unit="%", period="FY27", scope=None):
    return {"metric": metric, "target": {"low": lo, "high": hi, "unit": unit, "period": period, "scope": scope}}


def test_margin_target_tracked_against_the_filed_quarter():
    t = tracking.track(row("EBITDA margin", 22, 23), RES)
    assert t["value"] == 15.6 and t["verdict"] == "below" and t["label"] == "Q2 FY27 filed (consolidated), latest quarter"


def test_ambiguous_or_segment_or_other_year_targets_are_not_tracked():
    assert tracking.track(row("growth", 26, 27), RES) is None                    # AUM? volume? not revenue
    assert tracking.track(row("fee income growth", 15, 18), RES) is None
    assert tracking.track(row("profit growth", 20, 25, period="long-term"), RES) is None
    assert tracking.track(row("EBITDA margin", 22, 23, scope="defence business"), RES) is None
    assert tracking.track(row("EBITDA margin", 22, 23, period="FY28"), RES) is None
    assert tracking.track(row("revenue growth", 15, None), RES)["verdict"] == "on track"


def test_a_standalone_target_is_not_tracked_against_consolidated_results():
    row = {"metric": "EBITDA margin", "target": {"low": 18, "high": 20, "unit": "%", "period": "FY27", "scope": "company",
                                                  "basis": "standalone"}}
    res = {"period_end": "2026-09-30", "nature": "Consolidated", "source_url": None,
           "comparatives": {"current": {"ebitda_margin_pct": 20}, "yoy": {}}}
    assert tracking.track(row, res) is None
