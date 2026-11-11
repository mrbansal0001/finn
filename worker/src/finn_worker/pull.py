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
import os
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

1. guidance: every forward-looking, checkable commitment made by MANAGEMENT. Go through the whole
   transcript in order, including every Q&A answer -- most commitments are made in answers, not in
   the opening remarks. Count:
   - financial targets: revenue / volume growth, margins, cost ratios (e.g. employee cost as % of
     turnover), order inflow, order book, capex, R&D spend, debt, working-capital days, tax rate
   - expected timing of specific orders, contracts, approvals, launches, plant commissioning,
     capacity utilisation -- including conversational ones: "we are hopeful of getting the X order
     by H1", "maybe Q4 of FY27, else FY28", "around 2028-29 we may get production orders"
   - mix / share targets (exports, non-defence, segment share), indigenisation, market share
   One item per distinct commitment per call: if management repeats the same target later in the
   call (closing remarks often restate several), list it once, using the clearest statement.
   A different target, period or programme is a different item.
   Record analyst-proposed numbers only if management explicitly confirms them (speaker_role says who).
   Exclude: pure aspiration with no number, date or measurable end-state; anything about the past.
2. actuals: figures management states as achieved (e.g. "we grew 16% in FY26").

Rules: quote verbatim exactly as printed, one or two sentences. page is the number in the nearest
[[page N]] marker above the quote. Use only this transcript -- no outside knowledge. Do not judge
whether anything was met. kind: '>28%' is floor, 'around 28%' approximate, '27-29%' range,
'by March' a milestone with due '2027-03'. A typical call has 8-20 commitments."""


def extract(url: str) -> dict:
    """One model call per overlapping window of pages, merged in code.
    A single pass over a whole transcript under-reads long calls (E24); windows of
    FINN_PULL_CHUNK pages (default 6, 1-page overlap) recover the missed commitments."""
    _, pages = paged_text(url)
    nums = [n for n, t in pages.items() if t.strip()]
    size = int(os.getenv("FINN_PULL_CHUNK", "6"))
    tier = os.getenv("FINN_PULL_TIER", "fast")   # measured on the gold set before choosing (evals/eval_extraction.py)
    if size <= 0 or len(nums) <= size:
        windows = [nums]
    else:
        windows = [nums[i:i + size] for i in range(0, len(nums), size - 1) if nums[i:i + size]]
    guidance, actuals = [], []
    for w in windows:
        body = "\n".join(f"[[page {n}]]\n{pages[n]}" for n in w)
        out = llm.structured("pull_guidance", SYSTEM, [llm.Part(text=body)], SCHEMA, tier=tier)
        guidance += out.get("guidance", [])
        actuals += out.get("actuals", [])
    return {"guidance": _drop_vague(_dedupe(guidance)), "actuals": _dedupe(actuals)}


def _drop_vague(items: list[dict]) -> list[dict]:
    """'Directional' talk with no number and no date isn't checkable -- not a promise (E24)."""
    return [it for it in items
            if not (it.get("kind") == "directional" and not re.search(r"\d", it.get("quote", "")) and not it.get("due"))]


def _dedupe(items: list[dict]) -> list[dict]:
    """Windows overlap by a page: drop repeats of the same quote."""
    out: list[dict] = []
    for it in items:
        q = _norm(it.get("quote", ""))
        if any(fuzz.partial_ratio(q, _norm(o.get("quote", ""))) >= 90 for o in out):
            continue
        out.append(it)
    return out


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


# ------------------------------------------------------------------ periods

def call_fy(call_label: str) -> int | None:
    """'Q3FY26' -> 26; 'Nov 2026' (screener date label) -> FY of that month."""
    m = re.search(r"FY\s?(\d{2})", call_label or "")
    if m:
        return int(m.group(1))
    m = re.search(r"([A-Za-z]{3})\w*\s+(\d{4})", call_label or "")
    if m:
        months = "jan feb mar apr may jun jul aug sep oct nov dec".split()
        mon, y = months.index(m.group(1).lower()[:3]) + 1, int(m.group(2))
        # a results call reviews the quarter just ended:
        # Jan-Mar -> Dec quarter (prev calendar year), Apr-Jun -> Mar, Jul-Sep -> Jun, Oct-Dec -> Sep
        qe_month, qe_year = {1: (12, y - 1), 2: (12, y - 1), 3: (12, y - 1), 4: (3, y), 5: (3, y), 6: (3, y),
                             7: (6, y), 8: (6, y), 9: (6, y), 10: (9, y), 11: (9, y), 12: (9, y)}[mon]
        fy = qe_year + 1 if qe_month >= 4 else qe_year        # Indian FY ends in March
        return fy % 100
    return None


def normalise_period(period: str | None, call_label: str) -> str | None:
    """'current financial year' on a Q3FY26 call -> 'FY26'; 'next year' -> 'FY27'; 'H1 next year' -> 'H1FY27'."""
    if not period:
        return None
    p = period.strip()
    if re.search(r"FY\s?\d{2}", p):
        return re.sub(r"FY\s?(\d{2})", r"FY\1", re.sub(r"\s+", "", p.upper()) if len(p) <= 8 else p)
    fy = call_fy(call_label)
    if fy is None:
        return p
    # on an Apr-Jun call (reviewing Q4), "this year" is the fiscal year just begun, the one being guided
    if re.search(r"\b(apr|may|jun)\w*\s+\d{4}", call_label or "", re.I) or re.search(r"Q4\s?FY", call_label or ""):
        fy += 1
    low = p.lower()
    half = "H1" if re.search(r"\bh1\b|first half", low) else "H2" if re.search(r"\bh2\b|second half", low) else ""
    if re.search(r"next (financial )?year|next fy|coming year", low):
        return f"{half}FY{fy + 1}"
    if re.search(r"(this|current) (financial )?year|this fy|current fy|full year|year end", low):
        return f"{half}FY{fy}"
    if half:
        return f"{half}FY{fy}"
    return p


def _period_fy(period: str | None) -> int | None:
    m = re.search(r"FY(\d{2})", period or "")
    return int(m.group(1)) if m else None


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
            due_fy = _period_fy(thread.period)
            mentions_so_far = len({m.call for m in thread.mentions if call_order.index(m.call) < call_order.index(call)})
            if due_fy is not None and call_fy(call) is not None and call_fy(call) > due_fy:
                out[call] = {"status": None, "note": "period ended"}      # closed, not silent
            elif mentions_so_far >= 2:
                out[call] = {"status": "silent", "note": "repeated before, not mentioned now"}   # dropped: the signal
            else:
                out[call] = {"status": "early", "note": "open; not revisited"}
        prev = it or prev
    # settle against stated actuals for the target period, when any
    last = prev
    if last and thread.period:
        hit = next((a for a in actuals if a.get("period") == thread.period
                    and fuzz.token_set_ratio(_metric_key(a["metric"]), _metric_key(thread.metric)) >= 80), None)
        lo, hi = _bounds(last)
        due = _period_fy(thread.period)
        # a full-year promise can't be settled mid-year: only from the call that reviews that year
        over = due is not None and any(
            (call_fy(c) or 0) > due or ((call_fy(c) or 0) == due and re.search(r"Q4|\b(apr|may|jun)", c, re.I))
            for c in call_order)
        if not over or (thread.period and re.match(r"(H[12]|Q[1-4])", thread.period)):
            hit = hit if over else None
        if hit and (lo is not None or hi is not None):   # directional/milestone items have no bound to test
            v = hit["value"]
            if lo is not None and v < lo * 0.995:
                final = "partly" if v >= lo * 0.9 else "missed"
            elif hi is not None and v > hi * 1.005 and last.get("kind") == "ceiling":
                final = "missed"                           # a ceiling breached is a miss
            else:
                final = "delivered"                        # within band, or beat it
            beat = " (beat)" if hi is not None and v > hi * 1.005 and last.get("kind") != "ceiling" else ""
            out[call_order[-1]] = {"status": final, "note": f"stated actual {v:g}{hit.get('unit', '')} vs {_describe(last)}{beat}",
                                   "evidence": {"quote": hit["quote"], "page": hit["page"]}}
    return out


def _fmt_unit(u: str) -> tuple[str, str]:
    """('₹', ' cr') style prefix/suffix for a unit string."""
    low = (u or "").lower()
    if re.search(r"inr|rs\.?|₹", low) and "cr" in low:
        return "₹", " cr"
    if re.search(r"usd|\$", low) and re.search(r"mn|million", low):
        return "$", " mn"
    if "%" in low:
        return "", "%"
    return "", f" {u}" if u else ""


def _g(x: float) -> str:
    return f"{x:,.0f}" if abs(x) >= 1000 else f"{x:g}"


def _describe(it: dict) -> str:
    lo, hi = it.get("value_low"), it.get("value_high")
    pre, suf = _fmt_unit(it.get("unit") or "")
    k = it.get("kind")
    if k == "milestone":
        return f"by {it.get('due') or 'unspecified date'}"
    if k == "range" and lo is not None and hi is not None:
        return f"{pre}{_g(lo)}–{_g(hi)}{suf}"
    if k == "floor" and (lo is not None or hi is not None):
        return f">{pre}{_g(lo if lo is not None else hi)}{suf}"
    if k == "ceiling" and (hi is not None or lo is not None):
        return f"<{pre}{_g(hi if hi is not None else lo)}{suf}"
    if k in ("approximate", "point") and lo is not None:
        return f"{'~' if k == 'approximate' else ''}{pre}{_g(lo)}{suf}"
    return "direction only" if k == "directional" else "no figure"


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
            it["period"] = normalise_period(it.get("period"), t.label)
            p = verify(it, pages)
            if p is None:
                dropped += 1                      # cite-or-drop (D-016)
                continue
            it["page"] = p
            it["url"] = t.url
            items.append(it)
            verified += 1
        for a in out.get("actuals", []):
            a["period"] = normalise_period(a.get("period"), t.label)
            if verify(a, pages) is not None:
                actuals.append(a)
        calls.append((t.label, items))
        meta.append({"label": t.label, "date": t.label, "url": t.url})
    order = [c for c, _ in calls]
    # deterministic linking by default: as accurate as model-assisted linking on the gold set and
    # stable run to run (E26); FINN_LINK=model switches the model-assisted variant on
    threads = link(calls)
    if os.getenv("FINN_LINK") == "model":
        try:
            threads = link_with_model(calls)
        except llm.LLMUnavailable:
            pass
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


def _unit_class(u: str | None) -> str:
    u = (u or "").lower()
    return "pct" if "%" in u or "percent" in u else "money" if re.search(r"inr|rs|₹|crore|cr\b|lakh|million|mn|bn|usd|\$", u) \
        else "days" if "day" in u else "other" if u else "none"


def _compatible(a: dict, b: dict) -> bool:
    fa, fb = _facet(a.get("metric", "")), _facet(b.get("metric", ""))
    if fa and fb and fa != fb:
        return False
    ua, ub = _unit_class(a.get("unit")), _unit_class(b.get("unit"))
    return ua == ub or "none" in (ua, ub) or "other" in (ua, ub)


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
        # hybrid (E26): a shared programme name + same promise type links deterministically;
        # only the remaining statements go to the model
        rest = []
        for it in mgmt:
            names, facet = _names(it["metric"] + " " + (it.get("scope") or "")), _facet(it["metric"])
            sure = next((t for t in threads if names & _names(t.metric) and (facet is None or _facet(t.metric) in (None, facet))
                         and _compatible(it, t.mentions[-1].item)), None)
            if sure:
                sure.mentions.append(Mention(call, it))
            else:
                rest.append(it)
        mgmt = rest
        if not mgmt:
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
            if t and not _compatible(it, t.mentions[-1].item):
                t = None          # the model linked unlike things (a margin with an order value): keep apart
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
    try:
        valid = {s for s, _ in _json.loads((root / "data" / "universe.json").read_text())}
    except FileNotFoundError:
        valid = set()
    for req in [r for r in queue if r["status"] == "queued" and r["symbol"] in valid][:limit]:
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
