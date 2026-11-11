"""Network matching: evidence-graded wording (D-023), insiders flagged, decoys rejected."""
from datetime import date

from finn_worker import network

TODAY = date(2026, 11, 11)
CONTACTS, EDGES = network.load()


def test_dates_overlap_says_worked_together_years():
    # Huhtamaki CIM bio (real filing): Amcor for 19 years before joining Huhtamaki in Jan 2023
    leyton = {"name": "Leyton Bright", "orgs": [{"org": "Amcor", "start": "2004", "end": "2022"},
                                                 {"org": "Huhtamaki", "start": "2023-01", "end": None}]}
    lines = network.for_person(leyton, CONTACTS, TODAY)
    assert lines[0]["name"] == "Aisha Khan"
    assert lines[0]["confidence"] == "dates overlap"
    assert "2009–2022" in lines[0]["relation"]


def test_undated_bio_never_claims_worked_together():
    # SUNDARMFIN-style bio: employers named, no years
    person = {"name": "A. Director", "orgs": [{"org": "Bharat Forge", "start": None, "end": None}]}
    lines = network.for_person(person, CONTACTS, TODAY)
    assert lines and all(l["confidence"] == "same organisation" for l in lines)
    assert all("dates not disclosed" in l["relation"] for l in lines)


def test_namesake_from_other_company_is_not_a_match():
    decoy = {"name": "Rhea Kapur", "orgs": [{"org": "Zomato", "start": "2019", "end": "2024"}]}
    assert network.for_person(decoy, CONTACTS, TODAY) == []


def test_company_alumni_rank_above_current_insiders():
    lines = network.for_company("TITAN", CONTACTS, TODAY, kind="management_change")
    assert lines[0]["name"] == "Rhea Kapoor"            # ex-Head of Strategy, strong tie
    insiders = [l for l in lines if l["insider"]]
    assert all(l["relation"].startswith("works at") for l in insiders)
    assert not any(l["insider"] for l in lines[:1])


def test_topic_routes_irdai_action_to_regulatory_expert():
    lines = network.for_company("ATHERENERG", CONTACTS, TODAY, kind="litigation",
                                text="Insurance Regulatory and Development Authority of India corporate agency licence")
    names = [l["name"] for l in lines]
    assert "Ananya Rao" in names                         # ex-IRDAI
    assert "Sandeep Kulkarni" in names                   # ex-Ather sourcing


def test_strength_formula_orders_recent_frequent_above_stale():
    k = next(c for c in CONTACTS if c.id == "c11")       # 14 interactions, 9 days ago
    t = next(c for c in CONTACTS if c.id == "c13")       # 1 interaction, a year ago
    assert network.strength(k, TODAY) > 0.8 > 0.4 > network.strength(t, TODAY)


def test_price_move_never_suggests_an_insider():
    lines = network.for_company("SBIN", CONTACTS, TODAY, kind="move")
    assert not any(l["insider"] for l in lines)


TODAY = date(2026, 11, 11)


def test_tenure_from_the_filings_own_words():
    p = {"name": "Sanjay D'Souza", "change": "superannuated", "role": "Group Head"}
    t = network.tenure_from_text(p, ["He served the Bank for nearly 27 years"], 2026)
    assert t == {"start": "1999", "end": "2026", "inferred": True}
    assert network.tenure_from_text({**p, "change": "appointed"}, ["served for 27 years"], 2026) is None


def test_alumni_who_overlapped_with_a_leaving_person_are_named():
    person = {"name": "Sanjay D'Souza", "orgs": [{"org": "HDFC Bank", "start": "1999", "end": "2026", "inferred": True}], "schools": []}
    lines = network.for_person(person, CONTACTS, TODAY)
    assert lines and all("while Sanjay D'Souza was there" in ln["relation"] for ln in lines)
    assert all(ln["confidence"] == "dates overlap" for ln in lines)


def test_irrelevant_generic_experts_are_dropped_when_someone_knows_the_company():
    lines = network.for_company("TATACHEM", CONTACTS, TODAY, kind="litigation", text="Tribunal rejects claim")
    assert not any("nbfc" in ln["relation"].lower() for ln in lines)
    assert lines[0]["confidence"] == "certain"


def test_best_reason_explains_the_first_person():
    lines = network.for_company("TATACHEM", CONTACTS, TODAY, kind="litigation", text="Tribunal rejects claim")
    r = network.best_reason(network.second_degree(lines, CONTACTS, EDGES, TODAY)[0])
    assert "closest to this legal matter" in r or "Legal" in r


def test_decades_of_service_count_as_tenure():
    p = {"name": "Kaizad Bharucha", "change": "resigned", "role": "Deputy Managing Director"}
    assert network.tenure_from_text(p, ["Resignation effective December 31, 2026, after over three decades of service."], 2026)["start"] == "1996"


def test_studied_at_the_same_school_is_found():
    CONTACTS2, _ = network.load()
    lines = network.for_person({"name": "V. N. Srivatsan", "orgs": [], "schools": ["PSG College of Technology"]}, CONTACTS2, TODAY)
    assert any("alumnus of PSG College of Technology" in ln["relation"] for ln in lines)


def test_sibling_companies_are_not_the_same_organisation():
    assert network._org_match("HDFC Bank Limited", "HDFC Bank")
    assert not network._org_match("HDFC Ltd", "HDFC Bank")
    assert not network._org_match("Reliance Industries", "Reliance Capital")
    assert not network._org_match("State Bank of India", "SBI Mauritius")


def test_overlap_by_month_not_year():
    assert network._overlap({"start": "2010-01", "end": "2015-02"}, {"start": "2015-11", "end": "2018-01"}) is None
    assert network._overlap({"start": "2010", "end": "2016"}, {"start": "2015-11", "end": None}) == (2015, 2016)
