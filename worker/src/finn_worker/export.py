"""Export what the app shows: Editions per window, results, moves.

Writes data/snapshot.json (local development) -- the same payload sync.py
pushes to Supabase for the deployed app.
"""
from __future__ import annotations

import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from . import fetch, tracking, cards, network, prices, store, universe, xbrl_facts

ROOT = Path(__file__).resolve().parents[3]
WINDOWS = {"24h": timedelta(hours=24), "3d": timedelta(days=3), "7d": timedelta(days=7), "30d": timedelta(days=30)}


def portfolio() -> dict:
    return json.loads((ROOT / "config" / "portfolio.json").read_text())


def snapshot(until: datetime | None = None) -> dict:
    p = portfolio()
    # holdings and the research list both get filings and prices (three-pillars plan P1); research names carry
    # no weight, so they rank below holdings and never lead (cards.build, cards.build_moves)
    syms = list(dict.fromkeys([h["symbol"] for h in p["holdings"]] + p.get("research_set", [])))
    weights = {h["symbol"]: h["weight"] for h in p["holdings"]}
    u = universe.load()
    names = {s: u[s].name for s in syms if s in u}
    con = store.connect()
    q = ",".join("?" * len(syms))
    filings = [dict(r) for r in con.execute(f"select * from filings where symbol in ({q})", syms)] if syms else []
    # first run / new portfolio: no filings yet is a valid (empty) edition, not a crash
    # the edition runs to when it was built, not to the newest filing: on a Saturday with nothing new from the
    # holdings, "the last 24 hours" must mean the last 24 hours, and the masthead must say Saturday (14 Nov).
    # The newest filing's time is kept separately (freshness.filings_until) for the footer and "since last visit".
    newest_filing = max((datetime.fromisoformat(f["published_at"]) for f in filings), default=None)
    until = until or datetime.now().replace(microsecond=0)

    res = {}
    rank = lambda r: (r["period_end"], r["nature"] == "Consolidated",
                      r["comparatives_json"] is not None and r["check_status"] in ("xbrl_match", "arithmetic_ok"))
    # results for every company FINN covers: holdings, research set and any company with a ledger (Pull)
    covered = list(dict.fromkeys(syms + p.get("research_set", []) + [f.stem for f in (ROOT / "data" / "ledgers").glob("*.json")]))
    qc = ",".join("?" * len(covered))
    all_results = [dict(r) for r in con.execute(f"select * from results where symbol in ({qc})", covered)] if covered else []
    xbrl_rows = {(r["symbol"], r["period_end"], r["nature"]): json.loads(r["values_json"])
                 for r in all_results if r["source"] == "xbrl"}
    for r in all_results:
        # a PDF table read before its XBRL arrived is re-checked now, on the 1:1 lines (D-021)
        x = xbrl_rows.get((r["symbol"], r["period_end"], r["nature"]))
        if r["source"] == "pdf" and r["check_status"] == "arithmetic_ok" and x:
            v = json.loads(r["values_json"])
            both = [k for k in ("revenue", "other_income", "finance_costs", "depreciation", "pat")
                    if v.get(k) is not None and x.get(k) is not None]
            bad = [k for k in both if abs(v[k] - x[k]) > max(1e5, 0.0002 * abs(x[k]))]
            if bad:
                r["check_status"] = f"failed: {', '.join(bad)} differ from XBRL"
            elif len(both) >= 2:                  # a match needs fields actually compared (audit F07)
                r["check_status"] = "xbrl_match"
                if r["comparatives_json"]:
                    cj = json.loads(r["comparatives_json"])
                    cj["checks"] = [c for c in cj.get("checks", []) if not c.startswith("XBRL")] + [f"XBRL: {', '.join(both)} equal"]
                    r["comparatives_json"] = json.dumps(cj)
    for r in sorted(all_results, key=rank):
        # newest period, consolidated preferred (D-021), checked table with QoQ/YoY preferred over XBRL-only
        if (r["check_status"] or "").startswith("failed") or (r["source"] == "pdf" and r["check_status"] not in ("xbrl_match", "arithmetic_ok")):
            continue  # a table that failed (or never passed) its checks is never shown
        res[r["symbol"]] = {"period_end": r["period_end"], "nature": r["nature"], "reporting": r["reporting"],
                            "source": r["source"], "source_url": r["source_url"], "check": r["check_status"],
                            "values": json.loads(r["values_json"]),
                            "comparatives": json.loads(r["comparatives_json"]) if r["comparatives_json"] else None}

    try:
        sessions = prices.history(until.date(), trading_days=42, max_calendar_days=70)
    except Exception:  # an exchange hiccup must not freeze the app on a stale snapshot
        sessions = []
    latest = [{**m.__dict__, "day": m.day.isoformat()} for m in prices.moves(sessions, syms)]
    mv = [{**m.__dict__, "day": m.day.isoformat()} for m in prices.moves_series(sessions, syms)]
    cal = prices.calendar(sessions)

    events: dict[str, list[dict]] = {}
    for e in con.execute(f"select filing_id, card from events where symbol in ({q})", syms):
        events.setdefault(e["filing_id"], []).append(json.loads(e["card"]))
    editions = {k: cards.build(filings, mv, weights, names, until - w, until, res, events, cal) for k, w in WINDOWS.items()}
    # an XBRL-only filing (no PDF) is shown as plain-words facts, not a link that renders raw XML
    xml_cache: dict[str, list] = {}
    for ed in editions.values():
        for it in ed.get("routine_items", []):
            link = it.get("link") or ""
            if link.lower().endswith(".xml"):
                if link not in xml_cache:
                    try:
                        xml_cache[link] = xbrl_facts.for_link(link)
                    except Exception:      # refused or unreachable: keep the link, no facts
                        xml_cache[link] = []
                it["facts"] = xml_cache[link]
    # every qualifying session as its own card; the app keeps those that meet the investor's rules (F01/F05)
    move_cards = cards.build_moves(mv, editions["30d"]["leads"] + editions["30d"]["more"], filings, weights, names, until, cal)

    # The Network, inside Push and Pull (D-023). Local and deterministic.
    contacts, edges = network.load()
    today = until.date()
    # move cards borrow the company's lines in the app ("company:SYM"): no extra private rows per visitor
    for ed in editions.values():
        network.annotate(ed["leads"] + ed["more"], today, contacts, edges)
        # people named in a filing: person-level matches first (dates overlap > same organisation)
        for c in ed["leads"] + ed["more"]:
            # the filing company itself isn't an insight without dates ("also worked at Titan" on Titan's own
            # card); with a tenure the filing states, alumni who overlapped with the person are (E29)
            own = universe.normalise_name(c["company"])
            is_own = lambda o: universe.normalise_name(o) in own or own in universe.normalise_name(o)
            texts = [c.get("why") or "", c["facts"].get("quote") or "", c.get("headline") or ""]
            people = []
            for person in c["facts"].get("people", []):
                orgs = [o for o in person.get("orgs", []) if not is_own(o.get("org", ""))]
                ten = network.tenure_from_text(person, texts, int(c["at"][:4]))
                if ten:
                    orgs.append({"org": c["company"], **ten})
                people.append({**person, "orgs": orgs})
            person_lines = [ln for person in people for ln in network.for_person(person, contacts, today)]
            if person_lines:
                seen = {ln["contact_id"] for ln in person_lines}
                c["network"] = (person_lines + [ln for ln in c["network"] if ln["contact_id"] not in seen])[:3]
            # (the "no overlap" sentence is written in the app from the visitor's own private lines: card
            # facts are public, so nothing derived from contacts may go into them)
            if c["network"]:
                c["network"][0]["best_reason"] = network.best_reason(c["network"][0])
    people = {s: network.second_degree(network.for_company(s, contacts, today), contacts, edges, today)
              for s in names}
    ledger_index = {}
    verifiers = {}
    # the machine-built ledgers shown by default (BEL, Deepak) get tracking and verifiers too (audit F11);
    # their row ids (P1..) never collide with the hand-checked reference's (T1..)
    for lp in [*(ROOT / "data" / "ledgers").glob("*.json"), *(ROOT / "data" / "ledgers_model").glob("*.json")]:
        led = json.loads(lp.read_text())
        before = json.dumps(led, ensure_ascii=False, sort_keys=True)
        tracking.apply(led, res.get(led["symbol"]))
        if json.dumps(led, ensure_ascii=False, sort_keys=True) != before:
            lp.write_text(json.dumps(led, ensure_ascii=False, indent=1))
        ledger_index[led["symbol"]] = _index_entry(led)
        for row in led["rows"]:
            text = f"{row['title']} {row.get('metric', '')}"
            cands = [l for l in network.for_company(led["symbol"], contacts, today, kind="", text=text) if not l["insider"]]
            if cands:
                verifiers[f"{led['symbol']}:{row['id']}"] = cands[0]
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "data_until": until.isoformat(),
        "portfolio": p["holdings"], "research_set": p.get("research_set", []), "names": names,
        "editions": editions, "move_cards": move_cards, "results": res,
        # what each part of the data is current to, separately (audit F09)
        "freshness": {"filings_until": (newest_filing or until).isoformat(), "price_session": cal[-1] if cal else None,
                      "price_sessions": len(cal), "worker_last_ok": _worker_last_ok()}, "people": people, "verifiers": verifiers,
        # private to the owner; in production this lives behind Supabase row-level security
        "contacts": json.loads((ROOT / "config" / "network.json").read_text())["contacts"],
        "prices": {m["symbol"]: m for m in latest},
        # the last 30 sessions per company, for the price/volume chart (computed as the alert is)
        "price_history": prices.series(sessions, syms),
        # one small entry per ledger, for the Research page and the promise line on results cards
        "ledger_index": ledger_index,
        "nifty50": _nifty50(),
        "trajectory": _trajectory(),
    }


def _worker_last_ok() -> dict:
    """When each worker step last succeeded (no private data): lets the app tell 'quiet' from 'stale'."""
    try:
        st = json.loads((ROOT / "data" / "worker_state.json").read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    return {k: v for k, v in (st.get("last_ok") or {}).items() if k in ("announcements", "backfill", "read_filings", "coverage_queue")}


def write_universe() -> int:
    """All NSE equities (symbol, name) for search and validation in the app."""
    rows = sorted([c.symbol, c.name] for c in universe.load().values() if c.series in ("EQ", "BE", "BZ", "SM", "ST"))
    (ROOT / "data" / "universe.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
    return len(rows)


def _index_entry(led: dict) -> dict:
    """What the Research page and the edition need from a ledger, without the ledger: when it was built, the
    latest call, counts by status, the promise most worth attention, and the promise tracked against filed
    results. Rows are trimmed to the fields the app's question rules read."""
    rows = led.get("rows", [])
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["latest"]] = counts.get(r["latest"], 0) + 1
    vague = lambda r: r["title"].endswith((": no figure", ": direction only"))
    pick = lambda st: sorted((r for r in rows if r["latest"] in st and not vague(r)), key=lambda r: -(r.get("mentions") or 1))
    top = (pick(("revised",)) or pick(("silent", "missed", "partly")) or [None])[0]
    tracked = next((r for r in rows if r.get("tracking")), None)
    slim = lambda r: r and {k: r.get(k) for k in ("id", "title", "metric", "latest", "mentions", "tracking", "target")} | {
        "calls": {c: {"status": v.get("status"), "note": v.get("note")} for c, v in r["calls"].items()}}
    built = re.search(r"Built (\d{1,2} \w{3} \d{4})", led.get("provenance", ""))
    return {
        "built": built.group(1) if built else None,
        "last_call": led["calls"][-1]["label"] if led.get("calls") else None,
        "calls": [{"label": c["label"], "date": c["date"]} for c in led.get("calls", [])],
        "rows": len(rows), "counts": counts, "top": slim(top), "tracked": slim(tracked),
        "reference": bool(led.get("reference")) or (ROOT / "data" / "ledgers" / f"{led['symbol']}.json").exists()
        and json.loads((ROOT / "data" / "ledgers" / f"{led['symbol']}.json").read_text()).get("provenance", "").startswith("Reference"),
    }


def _trajectory() -> dict:
    """Five years of revenue and profit from each annual report's own multi-year table (trajectory.py)."""
    out = {}
    for p in sorted((ROOT / "data" / "trajectory").glob("*.json")):
        d = json.loads(p.read_text())
        if not d.get("none"):
            out[d["symbol"]] = {k: d[k] for k in ("url", "page", "report_year", "basis", "revenue_label", "profit_label", "unit_printed")} | {
                "years": [{"fy": y["fy"], "revenue": y["revenue_cr"], "pat": y["pat_cr"]} for y in d["years"]]}
    return out


def _nifty50() -> list[str]:
    """Nifty 50 members from NSE's published list (cached a week); empty if it can't be read."""
    try:
        import csv
        import io
        b = fetch.get("https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv", max_age=7 * 24 * 3600)
        return [r["Symbol"] for r in csv.DictReader(io.StringIO(b.decode("utf-8-sig")))]
    except Exception:  # the Research page then simply has no Nifty 50 filter
        return []


def main() -> None:
    write_universe()
    out = ROOT / "data" / "snapshot.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot(), ensure_ascii=False, indent=1, default=str))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
