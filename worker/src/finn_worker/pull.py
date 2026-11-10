"""Pull: the Promises ledger for any NSE ticker, from primary sources only (D-015, D-016, D-024).

    discover -> read -> extract (model, one call per transcript) -> verify quotes (code)
    -> link into promise threads (code) -> statuses (code) -> ledger JSON

The model only transcribes: what was promised, by whom, on which page, and any
figures management reported as actuals. It never judges hit or miss, never links
statements across calls, and never computes. Lessons from the hand-built gold set
(E17) are encoded here: speaker role (analyst numbers are not guidance), bound type
(">28%" vs "~28%"), page = PDF page, hyphenation-tolerant quote matching, revisions
detected in code rather than taken from management's "on track".
"""
from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from datetime import date

from rapidfuzz import fuzz

from . import docs, fetch, llm

SCREENER = "https://www.screener.in/company/{symbol}/"


# ------------------------------------------------------------------ discover

@dataclass
class Transcript:
    label: str        # "Nov 2026" as listed
    url: str


def discover(symbol: str, n: int = 4) -> list[Transcript]:
    """Latest `n` concall transcripts. Screener is used only to find the exchange PDF links."""
    page = fetch.get(SCREENER.format(symbol=symbol.upper()), max_age=7 * 24 * 3600).decode("utf-8", "replace")
    i = page.find("documents concalls")
    seg = page[i: page.find("</ul>", i)] if i > 0 else ""
    out = []
    for li in re.split(r'<li class="flex flex-gap-8', seg)[1:]:
        d = re.search(r'nowrap"\s*style="width: 74px">([^<]+)<', li)
        t = re.search(r'href="([^"]+)"[^>]*title="Raw Transcript"', li)
        if d and t:
            out.append(Transcript(d.group(1).strip(), html.unescape(t.group(1))))
    return out[:n]


def paged_text(url: str) -> tuple[str, dict[int, str]]:
    """Transcript text with [[page N]] markers (PDF page numbers) and a page->text map."""
    pages = {p.number: p.text for p in docs.pages(url)}
    body = "\n".join(f"[[page {n}]]\n{t}" for n, t in pages.items() if t.strip())
    return body, pages


# ------------------------------------------------------------------ extract

_ITEM = {
    "type": "OBJECT",
    "properties": {
        "quote": {"type": "STRING", "description": "verbatim sentence(s) exactly as printed"},
        "page": {"type": "INTEGER", "description": "the [[page N]] marker the quote sits under"},
        "speaker": {"type": "STRING"},
        "speaker_role": {"type": "STRING", "enum": ["management", "analyst", "moderator"]},
        "metric": {"type": "STRING", "description": "short noun phrase, e.g. 'revenue growth', 'EBITDA margin', 'QRSAM order'"},
        "scope": {"type": "STRING", "description": "company, a segment, or a plant/product"},
        "period": {"type": "STRING", "nullable": True, "description": "target period, e.g. 'FY27', 'H2FY27', 'Q3FY27'; null if none"},
        "kind": {"type": "STRING", "enum": ["range", "floor", "ceiling", "approximate", "point", "directional", "milestone"]},
        "value_low": {"type": "NUMBER", "nullable": True},
        "value_high": {"type": "NUMBER", "nullable": True},
        "unit": {"type": "STRING", "nullable": True, "description": "%, INR crore, USD mn, days, ..."},
        "due": {"type": "STRING", "nullable": True, "description": "for milestones: YYYY-MM it is due by, else null"},
        "conditional": {"type": "STRING", "nullable": True, "description": "any stated condition ('subject to', 'if')"},
        "basis": {"type": "STRING", "nullable": True, "description": "constant currency, standalone, consolidated..."},
    },
    "required": ["quote", "page", "speaker_role", "metric", "kind"],
}
_ACTUAL = {
    "type": "OBJECT",
    "properties": {
        "metric": {"type": "STRING"},
        "period": {"type": "STRING"},
        "value": {"type": "NUMBER"},
        "unit": {"type": "STRING"},
        "quote": {"type": "STRING"},
        "page": {"type": "INTEGER"},
    },
    "required": ["metric", "period", "value", "unit", "quote", "page"],
}
SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "guidance": {"type": "ARRAY", "items": _ITEM},
        "actuals": {"type": "ARRAY", "items": _ACTUAL, "description": "figures management states as achieved"},
    },
    "required": ["guidance", "actuals"],
}

SYSTEM = """You read one Indian listed company's earnings-call transcript and list two things.

1. guidance: every forward-looking, checkable statement made by MANAGEMENT -- targets for revenue,
   margins, volumes, order inflow, capex, debt, capacity, commissioning or order dates, launches,
   market share, mix. Include restatements each time they occur. Record analyst-proposed numbers
   only if management explicitly confirms them, and mark speaker_role accordingly. Exclude vague
   aspirations with no measurable target or date, and anything about the past.
2. actuals: figures management states as achieved (e.g. "we grew 16% in FY26").

Rules: quote verbatim exactly as printed, short (one or two sentences). page is the number in the
nearest [[page N]] marker above the quote. Use only this transcript -- no outside knowledge. Do not
judge whether anything was met. kind: '>28%' is floor, 'around 28%' approximate, '27-29%' range,
'by March' a milestone with due '2027-03'."""


def extract(url: str) -> dict:
    body, _ = paged_text(url)
    return llm.structured("pull_guidance", SYSTEM, [llm.Part(text=body)], SCHEMA, tier="smart")


# ------------------------------------------------------------------ verify

def _norm(s: str) -> str:
    s = html.unescape(s).replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"-\s*\n\s*", "", s)            # hyphenation at line breaks (E17)
    return re.sub(r"\s+", " ", s).strip().lower()


def verify(item: dict, pages: dict[int, str], threshold: int = 90) -> int | None:
    """Return the page the quote really sits on (cited page, then +/-1, then anywhere), or None."""
    q = _norm(item.get("quote", ""))
    if len(q) < 12:
        return None
    cited = item.get("page") or 0
    order = [cited, cited + 1, cited - 1] + [p for p in pages if p not in (cited, cited + 1, cited - 1)]
    for p in order:
        if p in pages and fuzz.partial_ratio(q, _norm(pages[p])) >= threshold:
            return p
    return None


# ------------------------------------------------------------------ link + status

@dataclass
class Mention:
    call: str
    item: dict


@dataclass
class Thread:
    id: str
    metric: str
    period: str | None
    mentions: list[Mention] = field(default_factory=list)


def _metric_key(m: str) -> str:
    m = m.lower()
    m = re.sub(r"\b(the|of|for|in|yoy|growth rate)\b", " ", m)
    return re.sub(r"\s+", " ", m).strip()


_NAMES_STOP = {"FY", "YOY", "QOQ", "EBITDA", "EBIT", "PAT", "PBT", "INR", "USD", "AI", "RD", "CC"}


def _names(s: str) -> set[str]:
    """Programme/product names and acronyms (QRSAM, NGC, MIBK, Shatrughat): strong link evidence."""
    caps = {w for w in re.findall(r"\b[A-Z][A-Z0-9-]{2,}\b", s) if w.upper() not in _NAMES_STOP and not re.match(r"^(FY|Q[1-4]|H[12])\d", w)}
    proper = {w for w in re.findall(r"\b[A-Z][a-z]{5,}\b", s)} - {"Revenue", "Margin", "Orders", "Order", "Capex", "Export",
                                                                   "Employee", "Quarterly", "Advanced", "Indigenous", "Receivable"}
    return caps | proper


_FACETS = {
    "order": r"order|receipt|award|contract|inflow",
    "delivery": r"deliver|execution|production model|fopm|supply",
    "commissioning": r"commission|onstream|start|ramp|operational|launch",
    "utilisation": r"utili[sz]ation|capacity use|run-rate",
    "funding": r"fund|cost|capex|investment|debt",
    "margin": r"margin|ebit|profitab",
    "share": r"share|mix|proportion",
    "growth": r"growth|revenue|sales|turnover",
}


def _facet(s: str) -> str | None:
    low = s.lower()
    return next((f for f, rx in _FACETS.items() if re.search(rx, low)), None)


def _fy(s: str | None) -> set[str]:
    return set(re.findall(r"FY\d{2}", s or ""))


def _periods_compatible(a: str | None, b: str | None) -> bool:
    fa, fb = _fy(a), _fy(b)
    return not (fa and fb) or bool(fa & fb)


def link(calls: list[tuple[str, list[dict]]]) -> list[Thread]:
    """Deterministic baseline: group management guidance across calls (oldest first).
    Same thread = shared programme name/acronym, or similar metric with compatible FY.
    pull.link_with_model() replaces this when a model key is configured (E19)."""
    threads: list[Thread] = []
    for call, items in calls:
        for it in items:
            if it.get("speaker_role") != "management":
                continue
            key, per = _metric_key(it["metric"]), (it.get("period") or it.get("due") or None)
            names = _names(it["metric"] + " " + (it.get("scope") or ""))
            best, best_s = None, 0
            facet = _facet(it["metric"])
            for t in threads:
                same_facet = facet is None or _facet(t.metric) in (None, facet)
                shared = names & _names(t.metric)
                if shared and same_facet:
                    s = 100
                elif not same_facet or not _periods_compatible(per, t.period):
                    continue
                else:
                    s = fuzz.token_sort_ratio(key, _metric_key(t.metric))
                if s > best_s:
                    best, best_s = t, s
            if best and best_s >= 80:
                best.mentions.append(Mention(call, it))
                best.period = best.period or per
            else:
                threads.append(Thread(f"P{len(threads) + 1}", it["metric"], per, [Mention(call, it)]))
    return threads


def _bounds(it: dict) -> tuple[float | None, float | None]:
    lo, hi = it.get("value_low"), it.get("value_high")
    kind = it.get("kind")
    if kind == "floor":
        return lo if lo is not None else hi, None
    if kind == "ceiling":
        return None, hi if hi is not None else lo
    if kind in ("point", "approximate") and lo is not None and hi is None:
        return lo, lo
    return lo, hi


def statuses(thread: Thread, call_order: list[str], actuals: list[dict]) -> dict[str, dict]:
    """Per-call status computed in code. Revisions come from comparing values/dates/bounds
    with the previous mention -- never from management's own framing."""
    by_call = {}
    for m in thread.mentions:
        by_call.setdefault(m.call, m.item)  # first mention per call
    out: dict[str, dict] = {}
    prev = None
    for call in call_order:
        it = by_call.get(call)
        if prev is None and it is None:
            out[call] = {"status": None}
            continue
        if it is not None and prev is None:
            out[call] = {"status": "early", "note": f"new: {_describe(it)}"}
        elif it is not None:
            changed = (_bounds(it) != _bounds(prev) or (it.get("due") or None) != (prev.get("due") or None)
                       or it.get("kind") != prev.get("kind"))
            if changed:
                out[call] = {"status": "revised", "note": f"{_describe(prev)} → {_describe(it)}"}
            else:
                out[call] = {"status": "early", "note": f"reiterated: {_describe(it)}"}
        else:
            out[call] = {"status": "silent", "note": "not mentioned"}
        prev = it or prev
    # settle against stated actuals for the target period, when any
    last = prev
    if last and thread.period:
        hit = next((a for a in actuals if a.get("period") == thread.period
                    and fuzz.token_set_ratio(_metric_key(a["metric"]), _metric_key(thread.metric)) >= 80), None)
        if hit:
            lo, hi = _bounds(last)
            v = hit["value"]
            ok = (lo is None or v >= lo * 0.995) and (hi is None or v <= hi * 1.005)
            near = lo is not None and v >= lo * 0.9
            final = "delivered" if ok else "partly" if near else "missed"
            out[call_order[-1]] = {"status": final, "note": f"stated actual {v:g}{hit.get('unit', '')} vs {_describe(last)}",
                                   "evidence": {"quote": hit["quote"], "page": hit["page"]}}
    return out


def _describe(it: dict) -> str:
    lo, hi, u = it.get("value_low"), it.get("value_high"), it.get("unit") or ""
    k = it.get("kind")
    if k == "milestone":
        return f"by {it.get('due') or 'unspecified date'}"
    if k == "range" and lo is not None and hi is not None:
        return f"{lo:g}–{hi:g}{u}"
    if k == "floor" and (lo is not None or hi is not None):
        return f">{(lo if lo is not None else hi):g}{u}"
    if k == "ceiling" and (hi is not None or lo is not None):
        return f"<{(hi if hi is not None else lo):g}{u}"
    if k in ("approximate", "point") and lo is not None:
        return f"{'~' if k == 'approximate' else ''}{lo:g}{u}"
    return k or "statement"


# ------------------------------------------------------------------ build

def build(symbol: str) -> dict:
    """End-to-end ledger for one ticker (requires a model key)."""
    found = list(reversed(discover(symbol)))           # oldest first
    calls, actuals, meta, verified, dropped = [], [], [], 0, 0
    for t in found:
        _, pages = paged_text(t.url)
        out = extract(t.url)
        items = []
        for it in out.get("guidance", []):
            p = verify(it, pages)
            if p is None:
                dropped += 1                      # cite-or-drop (D-016)
                continue
            it["page"] = p
            it["url"] = t.url
            items.append(it)
            verified += 1
        for a in out.get("actuals", []):
            if verify(a, pages) is not None:
                actuals.append(a)
        calls.append((t.label, items))
        meta.append({"label": t.label, "date": t.label, "url": t.url})
    order = [c for c, _ in calls]
    try:
        threads = link_with_model(calls)
    except llm.LLMUnavailable:
        threads = link(calls)                     # deterministic fallback
    rows = []
    for th in threads:
        cells = statuses(th, order, actuals)
        sts = [c["status"] for c in cells.values() if c.get("status")]
        first, last = th.mentions[0].item, th.mentions[-1].item
        settled = any(c.get("evidence") for c in cells.values())
        rows.append({
            "id": th.id, "title": f"{th.metric}{' · ' + th.period if th.period else ''}: {_describe(last)}",
            "metric": th.metric, "calls": cells, "latest": sts[-1] if sts else "early",
            "evidence_source": "per management" if settled else "not checkable",
            "first_quote": {"text": first["quote"], "call": th.mentions[0].call, "page": first["page"],
                            "speaker": first.get("speaker"), "url": first.get("url")},
            "latest_quote": ({"text": last["quote"], "call": th.mentions[-1].call, "page": last["page"], "url": last.get("url")}
                             if len(th.mentions) > 1 else None),
            "verdict": "",
        })
    from . import annual
    try:
        snap = annual.snapshot(symbol)
    except Exception:  # the ledger stands on its own if the AR can't be read
        snap = None
    return {"symbol": symbol.upper(), "calls": meta, "rows": rows, "snapshot": snap,
            "provenance": (f"Built {date.today():%d %b %Y} from {len(found)} earnings-call transcripts only. "
                           f"{verified} quotes verified against their pages; {dropped} unverifiable statements dropped. "
                           "Statuses computed in code.")}


# ------------------------------------------------------------------ model-assisted linking

LINK_SCHEMA = {
    "type": "OBJECT",
    "properties": {"assign": {"type": "ARRAY", "items": {
        "type": "OBJECT",
        "properties": {"item": {"type": "INTEGER"}, "thread": {"type": "STRING", "description": "existing thread id, or 'new'"}},
        "required": ["item", "thread"]}}},
    "required": ["assign"],
}
LINK_SYSTEM = ("You maintain a ledger of management promises across earnings calls. For each new statement, say "
               "which existing promise it restates, revises or updates (same commitment, possibly reworded, re-dated "
               "or re-scoped), or 'new' if it is a different commitment. Different facets of one programme (an order "
               "date vs a delivery timeline; commissioning vs utilisation; cost vs schedule) are different promises. "
               "Do not judge whether anything was met.")


def link_with_model(calls: list[tuple[str, list[dict]]]) -> list[Thread]:
    """Semantic linking by the model; statuses are still computed in code (E19)."""
    threads: list[Thread] = []
    for call, items in calls:
        mgmt = [it for it in items if it.get("speaker_role") == "management"]
        if not mgmt:
            continue
        if not threads:
            for it in mgmt:
                threads.append(Thread(f"P{len(threads) + 1}", it["metric"], it.get("period") or it.get("due"), [Mention(call, it)]))
            continue
        listing = "\n".join(f"{t.id}: {t.metric} ({t.period or 'no period'}) latest: \"{t.mentions[-1].item['quote'][:160]}\""
                            for t in threads)
        new = "\n".join(f"{i}: {it['metric']} ({it.get('period') or it.get('due') or 'no period'}): \"{it['quote'][:200]}\""
                        for i, it in enumerate(mgmt))
        out = llm.structured("pull_link", LINK_SYSTEM,
                             [llm.Part(text=f"EXISTING PROMISES\n{listing}\n\nNEW STATEMENTS ({call})\n{new}")],
                             LINK_SCHEMA, tier="fast")
        by_id = {t.id: t for t in threads}
        chosen = {a["item"]: a["thread"] for a in out.get("assign", [])}
        for i, it in enumerate(mgmt):
            t = by_id.get(chosen.get(i, "new"))
            if t:
                t.mentions.append(Mention(call, it))
            else:
                threads.append(Thread(f"P{len(threads) + 1}", it["metric"], it.get("period") or it.get("due"), [Mention(call, it)]))
    return threads


# ------------------------------------------------------------------ coverage queue (local mode)

def drain_requests(limit: int = 2) -> str:
    """Build ledgers that visitors asked for. Requests live in data/requests.json locally
    (Supabase coverage_requests in production, pulled by sync). Needs a model key."""
    import json as _json
    from pathlib import Path as _P
    root = _P(__file__).resolve().parents[3]
    qp = root / "data" / "requests.json"
    try:
        queue = _json.loads(qp.read_text())
    except (FileNotFoundError, _json.JSONDecodeError):
        return "no requests"
    built = 0
    for req in [r for r in queue if r["status"] == "queued"][:limit]:
        req["status"] = "building"
        qp.write_text(_json.dumps(queue, indent=1))
        try:
            if not discover(req["symbol"]):
                req["status"], req["detail"] = "unavailable", "No earnings-call transcripts filed for this company."
            else:
                ledger = build(req["symbol"])
                (root / "data" / "ledgers").mkdir(parents=True, exist_ok=True)
                (root / "data" / "ledgers" / f"{req['symbol']}.json").write_text(_json.dumps(ledger, ensure_ascii=False, indent=1))
                req["status"], built = "ready", built + 1
        except llm.LLMUnavailable as e:
            req["status"], req["detail"] = "queued", f"waiting for model: {str(e)[:80]}"
            qp.write_text(_json.dumps(queue, indent=1))
            break
        except Exception as e:  # keep the queue moving
            req["status"], req["detail"] = "unavailable", f"{type(e).__name__}: {str(e)[:120]}"
        qp.write_text(_json.dumps(queue, indent=1))
    return f"built {built}"
