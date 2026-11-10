"""Read filings that rules can't summarise (D-009, D-014), when a model key is configured.

- results filings -> P&L table transcription -> code checks -> QoQ/YoY (results.py)
- everything else -> multi-label events from the first pages (or the bio annexure)

Copy rules are enforced here in code, not hoped for in the prompt (research 03 §6.2):
headline = verb + fact, no boilerplate openers; "why" is dropped unless it holds a number.
Filings about named people go only to the paid, no-training API (personal_data=True).
"""
from __future__ import annotations

import json
import re

from . import docs, llm, results, store, xbrl

MAX_PER_CYCLE = 12  # free-tier friendly; the queue drains over a few cycles

EVENT_SCHEMA = {
    "type": "OBJECT",
    "properties": {"events": {"type": "ARRAY", "items": {
        "type": "OBJECT",
        "properties": {
            "kind": {"type": "STRING", "enum": ["results", "management_change", "m_and_a", "litigation", "fund_raise",
                                                "credit_rating", "capex", "dividend", "bonus_split", "insider_trading",
                                                "pledging", "press_release", "routine"]},
            "headline": {"type": "STRING", "description": "<= 10 words, a verb and the fact, e.g. 'CFO Rao resigns, effective 30 Nov'"},
            "why": {"type": "STRING", "nullable": True,
                    "description": "<= 2 short sentences with a number from THIS filing (size, % of revenue, date, count); null if none"},
            "amount_inr_cr": {"type": "NUMBER", "nullable": True},
            "counterparty": {"type": "STRING", "nullable": True},
            "people": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                "name": {"type": "STRING"}, "change": {"type": "STRING"}, "role": {"type": "STRING"},
                "category": {"type": "STRING", "nullable": True}, "effective": {"type": "STRING", "nullable": True},
                "reason": {"type": "STRING", "nullable": True},
                "orgs": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
                    "org": {"type": "STRING"}, "role": {"type": "STRING", "nullable": True},
                    "start": {"type": "STRING", "nullable": True, "description": "YYYY or YYYY-MM if printed, else null"},
                    "end": {"type": "STRING", "nullable": True}}, "required": ["org"]}},
                "schools": {"type": "ARRAY", "items": {"type": "STRING"}}},
                "required": ["name", "change", "role", "orgs", "schools"]}},
            "quote": {"type": "STRING", "description": "verbatim sentence supporting the headline"},
            "page": {"type": "INTEGER"},
        },
        "required": ["kind", "headline", "quote", "page", "people"]}}},
    "required": ["events"],
}

SYSTEM = """You read one Indian listed company's stock-exchange filing and list the distinct events in it.
A board-meeting outcome often bundles several (results, a director retiring, an investment): list each.
Write for a portfolio manager: the headline names what changed, with a verb ("Noel Tata retires as Vice
Chairman", not "Board meeting outcome"). 'why' must hold a number printed in THIS filing (amount, % of
revenue, date, count) -- if there is none, use null. For people, copy employers, roles, years and schools
only as printed; leave years null when not printed (never guess). Use only this document. Mark pure
housekeeping (trading window, newspaper ads, certificates) as kind 'routine'. Pages are marked [[page N]]."""

_BAD_OPENERS = re.compile(r"^(update|updates|intimation|disclosure|announcement|outcome|informs?|regarding|submission)\b", re.I)
_VERBISH = re.compile(r"\b(\w+s|\w+ed|wins?|cuts?|raises?|buys?|sells?|signs?|quits?|joins?|exits?|appoints?|resigns?|"
                      r"retires?|acquires?|reports?|gets?|loses?|files?|faces?|settles?|approves?|declares?|commissions?)\b", re.I)


def lint(ev: dict) -> dict:
    """Enforce the copy rules in code."""
    h = re.sub(r"\s+", " ", (ev.get("headline") or "")).strip().rstrip(".")
    if not h or _BAD_OPENERS.match(h) or not _VERBISH.search(h) or len(h.split()) > 14:
        ev["headline_ok"] = False
    else:
        ev["headline_ok"] = True
    ev["headline"] = h
    why = (ev.get("why") or "").strip()
    ev["why"] = why if re.search(r"\d", why) else None   # no number, no line
    return ev


def _pages_for(url: str, kind_hint: str) -> list[docs.Page]:
    ps = list(docs.pages(url))
    if kind_hint == "management_change":
        # bios are often 'enclosed separately' in an annexure (E16)
        bio = [p for p in ps if re.search(r"brief profile|experience|qualification|education", p.text, re.I)]
        return (ps[:2] + [p for p in bio if p.number > 2])[:5]
    return ps[:3]


def read_filing(f: dict) -> list[dict]:
    pages = _pages_for(f["link"], f["category"])
    parts = []
    for p in pages:
        parts.append(llm.Part(text=f"[[page {p.number}]]\n{p.text}") if p.clean
                     else llm.Part(png=docs.page_png(f["link"], p.number)))
    personal = f["category"] == "management_change"
    out = llm.structured("read_filing", SYSTEM, parts, EVENT_SCHEMA, tier="fast", personal_data=personal)
    return [lint(e) for e in out.get("events", []) if e.get("kind") != "routine"]


def read_results(con, f: dict) -> str:
    got = results.extract(f["link"])
    if not got:
        return "no P&L page found"
    table, page = got
    row = con.execute("select values_json, source_url from results where symbol=? and source='xbrl' "
                      "order by period_end desc limit 1", (f["symbol"],)).fetchone()
    xq = None
    if row:
        v = json.loads(row["values_json"])
        xq = xbrl.QuarterResult(f["symbol"], None, "", "", "", "", None, v.get("_rounding"),
                                {k: x for k, x in v.items() if not k.startswith("_")})
    chk = results.check(table, xq)
    nums = results.card_numbers(table) if chk.ok else None
    store.upsert(con, "results", [{
        "symbol": f["symbol"], "period_end": table["columns"][0]["period_end"], "nature": table["nature"],
        "reporting": "Quarterly" if table["columns"][0].get("months") == 3 else "Half Yearly",
        "source": "pdf", "source_url": f"{f['link']}#page={page}",
        "values_json": {**{k: (v * results.UNIT_TO_RUPEES[table["unit"]] if isinstance(v, (int, float)) and k not in ("months",) and not k.endswith("_pct") else v)
                           for k, v in table["columns"][0].items()}, "_unit": table["unit"]},
        "comparatives_json": nums, "check_status": chk.status,
    }])
    return chk.status


def read_pending(limit: int = MAX_PER_CYCLE) -> str:
    con = store.connect()
    p = json.loads((store.DB_PATH.parents[1] / "config" / "portfolio.json").read_text())
    syms = [h["symbol"] for h in p["holdings"]] + p.get("research_set", [])
    q = ",".join("?" * len(syms))
    rows = con.execute(f"""
        select * from filings f
        where symbol in ({q}) and link like '%.pdf' and tier in ('lead','notable')
          and (needs_document = 1 or category in ('results','management_change','m_and_a','litigation','capex','fund_raise'))
          and not exists (select 1 from events e where e.filing_id = f.id)
        order by case tier when 'lead' then 0 else 1 end, published_at desc
        limit ?""", (*syms, limit)).fetchall()
    done = 0
    for f in map(dict, rows):
        try:
            if f["category"] == "results":
                status = read_results(con, f)
                evs = [{"kind": "results", "headline": None, "why": None, "people": [], "quote": "", "page": None,
                        "headline_ok": False, "results_check": status}]
            else:
                evs = read_filing(f)
        except llm.LLMUnavailable:
            break                                   # rate-limited or no key: resume next cycle
        store.upsert(con, "events", [{
            "id": f"{f['id']}:{i}", "filing_id": f["id"], "symbol": f["symbol"], "kind": e["kind"],
            "tier": f["tier"], "published_at": f["published_at"], "card": e} for i, e in enumerate(evs or [{}])])
        done += 1
    return f"read {done}/{len(rows)}"
