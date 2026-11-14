"""Read filings that rules can't summarise (D-009, D-014), when a model key is configured.

- results filings -> P&L table transcription -> code checks -> QoQ/YoY (results.py)
- everything else -> multi-label events from the first pages (or the bio annexure)

Copy rules are enforced here in code, not hoped for in the prompt (research 03 §6.2):
headline = verb + fact, no boilerplate openers; "why" is dropped unless it holds a number.
Every filing goes to the Gemini free tier first; OpenAI is only the fallback when Gemini fails (D-060).
FINN_PEOPLE_PAID_ONLY=1 restores the stricter routing (filings naming people never on the free tier, D-030).
"""
from __future__ import annotations

import json
import os
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
    # free tier first for every filing (D-060, owner's choice: this is a demo on public filings). With
    # FINN_PEOPLE_PAID_ONLY=1, anything that can name people stays off the free tier again (D-030)
    strict = os.getenv("FINN_PEOPLE_PAID_ONLY", "0") == "1"
    personal = strict and f["category"] not in ("capex", "credit_rating", "fund_raise", "dividend", "bonus_split")
    out = llm.structured("read_filing", SYSTEM, parts, EVENT_SCHEMA, tier="fast", personal_data=personal)
    from .cards import scrub_event
    texts = {p.number: p.text for p in pages if p.clean}
    imaged = any(not p.clean for p in pages)
    return [ground(lint(scrub_event(e)), texts, imaged) for e in out.get("events", []) if e.get("kind") != "routine"]


def ground(ev: dict, texts: dict[int, str], imaged: bool = False) -> dict:
    """Cite or drop, for filing events too (full review F03).

    - The quote must be on a page FINN read; a quote the model shortened with "..." is checked piece by piece, and a
      rupee sign the PDF garbled into "?" doesn't have to match. The page is corrected to where the quote sits.
    - No quote: a people event passes only if every person it names appears in the filing's text.
    - Scanned pages have no text to check: the event keeps its headline, marked "quote not checked", so the card
      can say so rather than hide real news (BEL's order filings are scans).
    - An amount must appear in the document's text, or it is dropped.
    Anything that fails can't headline a card; the filing stays visible as "not read"."""
    from . import pull
    if not texts:
        ev["unverified"] = "scanned"               # nothing to check against: shown, and labelled as unchecked
        return ev
    # a garbled rupee sign ("?") and trademark signs needn't match character for character
    quote = re.sub(r"[?®™©]", " ", ev.get("quote") or "")
    texts = {n: re.sub(r"[®™©]", " ", t) for n, t in texts.items()}
    if quote.strip():
        pieces = [q.strip() for q in re.split(r"\.{3}|…", quote) if len(q.strip()) >= 12]
        pages = [pull.verify({"quote": q, "page": ev.get("page")}, texts) for q in pieces] if pieces else [None]
        if any(p is None for p in pages) and imaged:
            ev["unverified"] = "scanned"           # some pages read were images: the quote may sit there, unchecked
        elif any(p is None for p in pages):
            ev["headline_ok"] = False
            ev["unverified"] = "quote not found on the pages read"
        else:
            ev["page"] = pages[0]
    else:
        whole_low = " ".join(texts.values()).lower()
        names = [p.get("name") for p in ev.get("people") or [] if p.get("name")]
        if not names or not all(re.sub(r"^(mr|ms|mrs|dr|shri|smt)\.?\s+", "", n.lower()) in re.sub(r"\s+", " ", whole_low) for n in names):
            ev["headline_ok"] = False              # nothing quoted and no named person to check it against
            ev["unverified"] = "no quote"
    amt = ev.get("amount_inr_cr")
    if amt is not None:
        whole = re.sub(r"(\d),(?=\d)", r"\1", " ".join(texts.values()))
        num = f"{float(amt):g}"
        if not re.search(rf"(?<![\d.]){re.escape(num)}(?![\d])", whole):
            ev["amount_inr_cr"] = None             # an amount not printed in the filing is not shown
    return ev


def _xbrl_for(con, symbol: str):
    """Lookup of the Integrated Filing XBRL for the SAME period and SAME nature (consolidated vs standalone).
    If it hasn't arrived yet, a table is checked on its own identities and re-checked at export."""
    def look(period_end, nature):
        row = con.execute("select values_json from results where symbol=? and source='xbrl' and period_end=? and nature=?",
                          (symbol, period_end, nature)).fetchone()
        if not row:
            return None
        v = json.loads(row["values_json"])
        return xbrl.QuarterResult(symbol, None, "", "", "", "", None, v.get("_rounding"),
                                  {k: x for k, x in v.items() if not k.startswith("_")})
    return look


def read_results(con, f: dict) -> str:
    look = _xbrl_for(con, f["symbol"])
    got = results.extract(f["link"], look)
    if not got:
        return "no P&L page found"
    table, page = got
    xq = look(table["columns"][0].get("period_end"), table["nature"])
    chk = results.check(table, xq)
    # the checks that ran travel with the numbers, so the app names only those (audit F07)
    nums = {**results.card_numbers(table), "checks": chk.ran} if chk.ok else None
    store.upsert(con, "results", [{
        "symbol": f["symbol"], "period_end": table["columns"][0]["period_end"], "nature": table["nature"],
        "reporting": "Quarterly" if table["columns"][0].get("months") == 3 else "Half Yearly",
        "source": "pdf", "source_url": f"{f['link']}#page={page}",
        "values_json": {**{k: (v * results.UNIT_TO_RUPEES[table["unit"]] if isinstance(v, (int, float)) and k not in ("months",) and not k.endswith("_pct") else v)
                           for k, v in table["columns"][0].items()}, "_unit": table["unit"]},
        "comparatives_json": nums, "check_status": chk.status,
    }])
    if chk.ok and table["nature"] == "Consolidated":
        # a passing consolidated table supersedes an older standalone read of the same quarter
        con.execute("delete from results where symbol=? and source='pdf' and period_end=? and nature='Standalone'",
                    (f["symbol"], table["columns"][0]["period_end"]))
        con.commit()
    return chk.status


def retryable(e: Exception) -> bool:
    """Timeouts, connection drops, 5xx and malformed model output can succeed later; a 4xx or an
    unsupported file won't. An explicit refusal is never retried around (fetch.Refused)."""
    import httpx
    from . import fetch
    if isinstance(e, fetch.Refused):
        return False
    if isinstance(e, httpx.HTTPStatusError):
        return e.response.status_code >= 500 or e.response.status_code == 429
    return isinstance(e, (httpx.TimeoutException, httpx.TransportError, json.JSONDecodeError, TimeoutError, ConnectionError))


def read_pending(limit: int = MAX_PER_CYCLE) -> str:
    con = store.connect()
    p = json.loads((store.DB_PATH.parents[1] / "config" / "portfolio.json").read_text())
    syms = [h["symbol"] for h in p["holdings"]] + p.get("research_set", [])
    q = ",".join("?" * len(syms))
    rows = con.execute(f"""
        select * from filings f
        where symbol in ({q}) and link like '%.pdf' and tier in ('lead','notable')
          and (needs_document = 1 or category in ('results','management_change','m_and_a','litigation','capex','fund_raise','credit_rating'))
          -- read already, unless every attempt so far failed on something temporary (retry up to 3 times)
          and not exists (select 1 from events e where e.filing_id = f.id
                          and not (e.kind = 'unreadable' and json_extract(e.card, '$.retryable') = 1
                                   and coalesce(json_extract(e.card, '$.attempts'), 1) < 3))
          -- its twin already read successfully: a different filing, same company, type and subject within 10 minutes
          -- (not this filing's own failed attempt, which the clause used to match, so retries never ran; full review F11)
          and not exists (select 1 from events e join filings g on g.id = e.filing_id
                          where g.id != f.id and g.symbol = f.symbol and g.category = f.category and g.subject = f.subject
                            and e.kind != 'unreadable'
                            and abs(julianday(g.published_at) - julianday(f.published_at)) * 1440 <= 10)
        order by case tier when 'lead' then 0 else 1 end, published_at desc
        limit ?""", (*syms, limit)).fetchall()
    done = skipped = 0
    for f in map(dict, rows):
        try:
            if f["category"] == "results":
                status = read_results(con, f)
                evs = [{"kind": "results", "headline": None, "why": None, "people": [], "quote": "", "page": None,
                        "headline_ok": False, "results_check": status}]
            else:
                evs = read_filing(f)
        except llm.LLMUnavailable:
            skipped += 1                            # no capable model right now (rate limit, no key, budget):
            continue                                # leave it queued; other filings may still be readable
        except Exception as e:                      # a broken PDF or a 4xx must not block the queue forever
            prior = con.execute("select card from events where id = ?", (f"{f['id']}:0",)).fetchone()
            attempts = (json.loads(prior["card"]).get("attempts", 1) + 1) if prior else 1
            # the card keeps the filing visible as material-but-unread (audit F04); a temporary failure is retried
            evs = [{"kind": "unreadable", "headline": None, "why": None, "people": [], "quote": "", "page": None,
                    "headline_ok": False, "error": f"{type(e).__name__}: {str(e)[:160]}",
                    "retryable": retryable(e), "attempts": attempts}]
        store.upsert(con, "events", [{
            "id": f"{f['id']}:{i}", "filing_id": f["id"], "symbol": f["symbol"], "kind": e["kind"],
            "tier": f["tier"], "published_at": f["published_at"], "card": e}
            # nothing material inside: record that it was read, so it's never paid for again
            for i, e in enumerate(evs or [{"kind": "routine", "headline": None, "headline_ok": False, "people": []}])])
        done += 1
    return f"read {done}/{len(rows)}, waiting {skipped}"
