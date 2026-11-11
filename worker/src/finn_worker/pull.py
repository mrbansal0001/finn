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
    """Windows overlap by a page: drop repeats of the same statement. One sentence can carry two
    commitments (a growth target and a margin target): same quote but a different metric or figure stays."""
    out: list[dict] = []
    for it in items:
        q = _norm(it.get("quote", ""))
        if any(fuzz.partial_ratio(q, _norm(o.get("quote", ""))) >= 90
               and fuzz.token_sort_ratio(_norm(it.get("metric", "")), _norm(o.get("metric", ""))) >= 70
               and (it.get("value_low"), it.get("value_high"), it.get("value")) == (o.get("value_low"), o.get("value_high"), o.get("value"))
               for o in out):
            continue
        out.append(it)
    return out


# ------------------------------------------------------------------ verify

def _norm(s: str) -> str:
    s = html.unescape(s).replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"-\s*\n\s*", "", s)            # hyphenation at line breaks (E17)
    return re.sub(r"\s+", " ", s).strip().lower()


def _norm_case(s: str) -> str:
    """_norm without lower-casing, so positions line up with _norm's output."""
    s = html.unescape(s).replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"-\s*\n\s*", "", s)
    return re.sub(r"\s+", " ", s).strip()


def verify(item: dict, pages: dict[int, str], threshold: int = 90) -> int | None:
    """Return the page the quote really sits on (cited page, then +/-1, then anywhere), or None.
    The quote shown is then the page's own text span, so what sits in quotation marks is verbatim
    even when the model's copy differed by a word (E29: 15 of 267 quotes were near-verbatim)."""
    q = _norm(item.get("quote", ""))
    if len(q) < 12:
        return None
    cited = item.get("page") or 0
    order = [cited, cited + 1, cited - 1] + [p for p in pages if p not in (cited, cited + 1, cited - 1)]
    for p in order:
        if p not in pages:
            continue
        page_case = _norm_case(pages[p])
        page_low = page_case.lower()
        if len(page_low) != len(page_case):
            page_low = _norm(pages[p])
        al = fuzz.partial_ratio_alignment(q, page_low)
        if al is not None and al.score >= threshold:
            if len(page_low) == len(page_case):
                a, b = al.dest_start, al.dest_end
                while a > 0 and page_case[a - 1].isalnum():   # widen to whole words
                    a -= 1
                while b < len(page_case) and page_case[b].isalnum():
                    b += 1
                item["quote"] = page_case[a:b].strip()
            return p
    return None


# ------------------------------------------------------------------ ground numbers

# a currency prefix may touch the number ('INR3,000', 'Rs.500', '$2'); a digit/decimal before it may not
_NUM = re.compile(r"(?<![\d.,])(\d[\d,]*(?:\.\d+)?)\s*(%|per ?cent|crores?|cr\b|lakhs?|million|mn\b|billion|bn\b|bps|basis points"
                  r"|years?\b|months?\b|quarters?\b|weeks?\b|days?\b)?", re.I)
_TIME = {"year", "years", "month", "months", "quarter", "quarters", "week", "weeks", "day", "days"}
_SCALE = {"crore": " cr", "crores": " cr", "cr": " cr", "lakh": " lakh", "lakhs": " lakh", "million": " mn",
          "mn": " mn", "billion": " bn", "bn": " bn"}


def quote_numbers(quote: str) -> list[tuple[float, str | None]]:
    """Numbers printed in a quote with the scale word right after them ('60 million' -> (60, 'million'))."""
    out = []
    for m in _NUM.finditer(quote.replace("–", "-")):
        try:
            out.append((float(m.group(1).replace(",", "")), (m.group(2) or "").lower() or None))
        except ValueError:
            pass
    return out


def ground(item: dict) -> dict:
    """Every number shown must be printed in its quote (cite-or-drop for figures).
    A value the quote doesn't contain (the model's arithmetic, a figure from a neighbouring
    sentence, 'double' turned into '200%') is removed; the promise stays, as 'no figure'.
    Billion<->million restatements (x1000) count as printed. Also records the scale word
    the quote uses ('60 million units') so the display doesn't lose it."""
    nums = quote_numbers(item.get("quote", ""))
    if not re.search(r"year|month|quarter|week|day", item.get("unit") or "", re.I):
        nums = [(n, w) for n, w in nums if w not in _TIME]      # 'in the next 2 years' is not a value of 2
    scale = None
    for k in ("value_low", "value_high"):
        v = item.get(k)
        if v is None:
            continue
        # printed as-is, as a billion<->million restatement, or as the full number behind a scale word
        # ('60 million' given back as 60,000,000; '1 lakh crore' as 100,000 crore; E30)
        word_factor = {"lakh": 1e5, "lakhs": 1e5, "million": 1e6, "mn": 1e6, "crore": 1e7, "crores": 1e7, "cr": 1e7,
                       "billion": 1e9, "bn": 1e9}
        hit = next(((n, w) for n, w in nums for f in (1, 1000, 0.001) if abs(n * f - v) <= 0.005 * max(abs(v), 1)), None)
        if hit is None:
            for n, w in nums:
                f = word_factor.get(w or "")
                if f and abs(n * f - v) <= 0.005 * max(abs(v), 1):
                    hit = (n, w)
                    item[k] = n                     # keep the figure as printed; the scale word goes in the unit
                    break
        if hit is None:
            item["value_low"] = item["value_high"] = None
            item["ungrounded"] = True
            return item
        scale = scale or hit[1]
    if item.get("value_low") is not None and item.get("value_low") == item.get("value_high") and item.get("kind") == "range":
        item["kind"] = "point"
    if scale in _SCALE:
        item["scale"] = _SCALE[scale]
    return item


def call_month(call_label: str) -> str | None:
    """'Nov 2026' -> '2026-11' (screener date labels)."""
    m = re.search(r"([A-Za-z]{3})\w*\s+(\d{4})", call_label or "")
    if not m:
        return None
    months = "jan feb mar apr may jun jul aug sep oct nov dec".split()
    try:
        return f"{m.group(2)}-{months.index(m.group(1).lower()[:3]) + 1:02d}"
    except ValueError:
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


_BACKWARD_PERIOD = re.compile(r"^\s*(current|to date|so far|ytd)\s*$|\b(last|past|previous|trailing|preceding)\b", re.I)
_BACKWARD_QUOTE = re.compile(r"\b(had|have|has) (secured|grown|achieved|delivered|reported|won|crossed|received)\b|"
                             r"\bwe (grew|achieved|delivered|reported|secured|crossed)\b", re.I)


def looks_backward(it: dict) -> bool:
    """Statements of what already happened ('secured INR2,388 crores last quarter', 'grown 23.9% over the
    last 5 years') sometimes come back as guidance. A forward commitment never has a past period."""
    if _BACKWARD_PERIOD.search(it.get("period") or ""):
        return True
    return bool(_BACKWARD_QUOTE.search(it.get("quote") or "")) and not re.search(
        r"\b(will|expect|target|aim|guid|should|plan|going to|by (fy|q[1-4]|h[12]|march|the end))", it.get("quote") or "", re.I)


def normalise_period(period: str | None, call_label: str, actual: bool = False) -> str | None:
    """'current financial year' on a Q3FY26 call -> 'FY26'; 'next year' -> 'FY27'; 'H1 next year' -> 'H1FY27'.
    actual=True: a figure management reports as achieved -- on a Q4 call 'this year' is the year just ended."""
    if not period or str(period).strip().lower() in ("null", "none", "n/a", "na", "-"):
        return None
    p = re.sub(r"FY\s?'?20(\d{2})\b", r"FY\1", period.strip(), flags=re.I)    # FY2030 -> FY30
    if re.search(r"FY\s?\d{2}", p, re.I):
        return re.sub(r"FY\s?(\d{2})", r"FY\1", re.sub(r"\s+", "", p.upper()) if len(p) <= 8 else p, flags=re.I)
    fy = call_fy(call_label)
    if fy is None:
        return p
    # on an Apr-Jun call (reviewing Q4), "this year" is the fiscal year just begun, the one being guided
    if not actual and (re.search(r"\b(apr|may|jun)\w*\s+\d{4}", call_label or "", re.I) or re.search(r"Q4\s?FY", call_label or "")):
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


_FY_TOKEN = re.compile(r"FY\s?'?(\d{4}|\d{2})(?:\s*(?:-|–|to)\s*(?:FY\s?'?)?(\d{4}|\d{2}))?", re.I)


def fy_years(s: str | None) -> list[int]:
    """'FY27' -> [27]; 'FY2030' -> [30]; 'FY26-FY30' / 'FY26-30' -> [26, 30] (E29: FY2030 was read as FY20)."""
    out = []
    for a, b in _FY_TOKEN.findall(s or ""):
        out.append(int(a) % 100)
        if b:
            out.append(int(b) % 100)
    return out


def _period_fy(period: str | None) -> int | None:
    """The fiscal year a period ENDS in (a range ends in its last year)."""
    ys = fy_years(period)
    return max(ys) if ys else None


def period_end_month(period: str | None) -> str | None:
    """'FY27' -> '2027-03'; 'H1FY27' -> '2026-09'; 'Q3FY27' -> '2026-12'; '2027-03' stays; else None."""
    p = (period or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}", p):
        return p
    fy = _period_fy(p)
    if fy is None:
        return None
    y = 2000 + fy
    if re.search(r"\bH1|^H1", p, re.I):
        return f"{y - 1}-09"
    q = re.search(r"Q([1-4])", p, re.I)
    if q:
        return {1: f"{y - 1}-06", 2: f"{y - 1}-09", 3: f"{y - 1}-12", 4: f"{y}-03"}[int(q.group(1))]
    return f"{y}-03"


def call_reviews(call_label: str) -> str | None:
    """Quarter-end month a results call reviews: 'Nov 2026' -> '2026-09'; 'Q2FY27' -> '2026-09'."""
    q = re.search(r"Q([1-4])\s?FY\s?(\d{2})", call_label or "", re.I)
    if q:
        return period_end_month(f"Q{q.group(1)}FY{q.group(2)}")
    cm = call_month(call_label)
    if not cm:
        return None
    y, m = int(cm[:4]), int(cm[5:])
    qe = {1: (y - 1, 12), 2: (y - 1, 12), 3: (y - 1, 12), 4: (y, 3), 5: (y, 3), 6: (y, 3),
          7: (y, 6), 8: (y, 6), 9: (y, 6), 10: (y, 9), 11: (y, 9), 12: (y, 9)}[m]
    return f"{qe[0]}-{qe[1]:02d}"


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


def _fy(s: str | None) -> set[int]:
    return set(fy_years(s))


def _periods_compatible(a: str | None, b: str | None) -> bool:
    fa, fb = _fy(a), _fy(b)
    return not (fa and fb) or bool(fa & fb)


_SCOPE_GENERIC = re.compile(r"\b(company|overall|consolidated|standalone|group|total|business|segment|division|vertical|"
                            r"the|and|of|our|we)\b", re.I)


def _scope_words(scope: str | None) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", _SCOPE_GENERIC.sub(" ", (scope or "").lower()))}


def scopes_compatible(a: dict, b: dict) -> bool:
    """Company-level and a named segment/product are different promises ('revenue ~5,200 cr' for one
    segment is not a revision of another segment's). Company-level = no specific words left."""
    wa, wb = _scope_words(a.get("scope")), _scope_words(b.get("scope"))
    if not wa and not wb:
        return True
    if not wa or not wb:
        return not (a.get("scope") and b.get("scope"))   # one unstated: don't block
    return bool(wa & wb) or fuzz.token_set_ratio(" ".join(wa), " ".join(wb)) >= 70


def _mid(it: dict) -> float | None:
    lo, hi = it.get("value_low"), it.get("value_high")
    xs = [x for x in (lo, hi) if isinstance(x, (int, float))]
    return sum(xs) / len(xs) if xs else None


def values_compatible(a: dict, b: dict) -> bool:
    """Amounts more than 2x apart in the same unit are different commitments, not a revision
    (Rs 3,000 cr programme vs Rs 800 cr plant). Percentages are exempt: growth guidance can halve."""
    if _unit_class(a.get("unit")) != "money" or _unit_class(b.get("unit")) != "money":
        return True
    ma, mb = _mid(a), _mid(b)
    if not ma or not mb:
        return True
    return max(ma, mb) / min(ma, mb) <= 2.0


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
                prev = t.mentions[-1].item
                shared = names & _names(t.metric)
                same_call = [m.item for m in t.mentions if m.call == call]
                if same_call and not shared and not all(
                        _bounds(x) == _bounds(it) and (x.get("due") or None) == (it.get("due") or None) for x in same_call):
                    continue                  # a different figure in the same call is a different promise (E29: Dixon P95)
                # a shared programme name outweighs differing amounts (NGC order sized 2-3k, then 10-12k cr)
                if not scopes_compatible(it, prev) or (not shared and not values_compatible(it, prev)):
                    continue
                ua, ub = _unit_class(it.get("unit")), _unit_class(prev.get("unit"))
                if not shared and ua != ub and "none" not in (ua, ub):
                    continue                  # rupees vs a multiple or a % are different statements unless named
                same_facet = facet is None or _facet(t.metric) in (None, facet)
                if shared and same_facet:
                    s = 100
                elif not same_facet:
                    continue
                elif not _periods_compatible(per, t.period):
                    continue                  # a named programme links across periods above; unnamed items don't
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


_LOWER_BETTER = re.compile(r"\bdays?\b|cost|debt|leverage|npa|attrition|expense|receivable|inventory|working capital|"
                           r"d/e|gearing|cycle", re.I)


def lower_is_better(metric: str, unit: str | None = None) -> bool:
    return bool(_LOWER_BETTER.search(f"{metric} {unit or ''}")) and not re.search(r"payable", metric, re.I)


def _matching_actual(thread: Thread, last: dict, actuals: list[dict]) -> dict | None:
    """A stated actual settles a promise only if it is the same metric, scope and unit, for the same period,
    and of the same order of magnitude (E29: a segment target 'delivered' by whole-company revenue)."""
    lo, hi = _bounds(last)
    target = next((x for x in (lo, hi) if x is not None), None)
    best, best_s = None, 0
    for a in actuals:
        if a.get("period") != thread.period:
            continue
        s = fuzz.token_sort_ratio(_metric_key(a.get("metric", "")), _metric_key(thread.metric))
        if s < 80 or _unit_class(a.get("unit")) != _unit_class(last.get("unit")):
            continue
        if not scopes_compatible(a, last):
            continue
        v = a.get("value")
        if not isinstance(v, (int, float)):
            continue
        if target and _unit_class(last.get("unit")) == "money" and not (0.3 <= v / target <= 3):
            continue
        if s > best_s:
            best, best_s = a, s
    return best


def statuses(thread: Thread, call_order: list[str], actuals: list[dict]) -> dict[str, dict]:
    """Per-call status computed in code. Revisions come from comparing values/dates/periods/bounds
    with the previous mention -- never from management's own framing.

    early     stated (or restated) and its period hasn't ended
    revised   the figure, date or target period changed since the last mention; a date that had
              already passed when it was replaced is flagged missed_then_reset
    silent    stated on two or more calls, then dropped while still open
    closed    its period ended with no stated outcome to check against
    delivered / partly / missed   settled against a figure management stated for that period"""
    by_call = {}
    for m in thread.mentions:
        by_call.setdefault(m.call, m.item)  # link() keeps at most one item per call
    end = period_end_month(thread.period) or (str(thread.mentions[-1].item.get("due") or "")[:7] or None)
    out: dict[str, dict] = {}
    prev = None
    for call in call_order:
        it = by_call.get(call)
        reviewed = call_reviews(call)
        if prev is None and it is None:
            out[call] = {"status": None}
            continue
        if it is not None and prev is None:
            out[call] = {"status": "early", "note": f"new: {_describe(it)}"}
        elif it is not None:
            p_old, p_new = prev.get("period"), it.get("period")
            period_moved = bool(p_old and p_new and p_old != p_new and _period_fy(p_old) and _period_fy(p_new)
                                and _period_fy(p_new) != _period_fy(p_old))
            had_value = _bounds(prev) != (None, None) or bool(prev.get("due"))
            nums_of = lambda x: sorted({v for v in _bounds(x) if v is not None})
            due_of = lambda x: str(x.get("due") or "")[:7] or None
            # '2.5x' then '<2.5x' is the same figure said differently; a repeated June date is not a revision (E30)
            # a bound that weakens is a revision (">28%" -> "~28%", BEL); "2.5x" -> "<2.5x" is not (Adani Ports)
            weakened = prev.get("kind") in ("floor", "ceiling") and it.get("kind") in ("approximate", "point", "directional")
            changed = had_value and (nums_of(it) != nums_of(prev) or due_of(it) != due_of(prev) or weakened) or period_moved
            if changed:
                was = f"{_describe(prev)}{' (' + p_old + ')' if period_moved else ''}"
                now = f"{_describe(it)}{' (' + p_new + ')' if period_moved else ''}"
                cell = {"status": "revised", "note": f"{was} → {now}"}
                old_due = str(prev.get("due") or "")[:7] or (period_end_month(p_old) if period_moved else None)
                cm = call_month(call) or reviewed
                if old_due and cm and old_due < cm:
                    cell["missed_then_reset"] = True     # the old date had passed before it was replaced
                out[call] = cell
            elif not had_value and (_bounds(it) != (None, None) or it.get("due")):
                out[call] = {"status": "early", "note": f"quantified: {_describe(it)}"}   # a figure later, not a revision
            else:
                out[call] = {"status": "early", "note": f"reiterated: {_describe(it)}"}
        else:
            mentions_so_far = len({m.call for m in thread.mentions if call_order.index(m.call) < call_order.index(call)})
            due = str((prev or {}).get("due") or "")[:7] or end
            if due and reviewed and reviewed >= due:
                out[call] = {"status": "closed", "note": f"period ended ({due}); no outcome stated"}
            elif mentions_so_far >= 2:
                out[call] = {"status": "silent", "note": "repeated before, not mentioned now"}   # dropped: the signal
            else:
                out[call] = {"status": "early", "note": "open; not revisited"}
        prev = it or prev
    # settle against stated actuals for the target period, once a call has reviewed that period
    last = prev
    if last and thread.period and end:
        over = any((call_reviews(c) or "") >= end for c in call_order)
        hit = _matching_actual(thread, last, actuals) if over else None
        lo, hi = _bounds(last)
        if hit and (lo is not None or hi is not None):   # directional/milestone items have no bound to test
            v = hit["value"]
            if lower_is_better(thread.metric, last.get("unit")):
                bound = hi if hi is not None else lo
                final = "delivered" if v <= bound * 1.005 else "partly" if v <= bound * 1.1 else "missed"
                beat = " (beat)" if lo is not None and v < lo * 0.995 else ""
            else:
                if lo is not None and v < lo * 0.995:
                    final = "partly" if v >= lo * 0.9 else "missed"
                elif hi is not None and v > hi * 1.005 and last.get("kind") == "ceiling":
                    final = "missed"                       # a ceiling breached is a miss
                else:
                    final = "delivered"                    # within band, or beat it
                beat = " (beat)" if hi is not None and v > hi * 1.005 and last.get("kind") != "ceiling" else ""
            out[call_order[-1]] = {"status": final, "note": f"stated actual {v:g} {hit.get('unit', '')} vs {_describe(last)}{beat}".replace("  ", " "),
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
    sc = it.get("scale")
    if sc and not re.search(r"\b(mn|million|bn|billion|cr|crores?|lakhs?)\b", suf, re.I):
        suf = f"{sc}{suf}"                # '60 units' printed as '60 million units' -> '60 mn units'
    k = it.get("kind")
    if k == "range" and lo is not None and lo == hi:
        k = "point"
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

def _title(th: "Thread", last: dict) -> str:
    per = last.get("period") or last.get("due") or th.period
    if per and last.get("kind") == "milestone" and re.fullmatch(r"\d{4}-\d{2}", str(per)):
        per = None                              # 'by 2027-03' already carries the date
    return f"{th.metric}{' · ' + per if per else ''}: {_describe(last)}"


def build(symbol: str) -> dict:
    """End-to-end ledger for one ticker (requires a model key)."""
    found = list(reversed(discover(symbol)))           # oldest first
    calls, actuals, meta, verified, dropped = [], [], [], 0, 0
    for t in found:
        _, pages = paged_text(t.url)
        out = extract(t.url)
        items = []
        for it in out.get("guidance", []):
            if looks_backward(it):
                continue                          # an achievement, not a commitment
            it["period"] = normalise_period(it.get("period"), t.label)
            p = verify(it, pages)
            if p is None:
                dropped += 1                      # cite-or-drop (D-016)
                continue
            it["page"] = p
            it["url"] = t.url
            ground(it)
            cm = call_month(t.label)
            if it.get("due") and cm and str(it["due"])[:7] < cm:
                it["due"] = None                  # guidance can't be due before the call it was given on
            pe, rv = period_end_month(it.get("period")), call_reviews(t.label)
            if pe and rv and pe < rv:
                it["period"] = None               # a target for a period already reported is a misread year (E30)
            items.append(it)
            verified += 1
        for a in out.get("actuals", []):
            a["period"] = normalise_period(a.get("period"), t.label, actual=True)
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
        first = th.mentions[0].item
        last_call = th.mentions[-1].call
        last = next(m.item for m in th.mentions if m.call == last_call)   # the item the latest cell describes
        settled = any(c.get("evidence") for c in cells.values())
        rows.append({
            "id": th.id, "title": _title(th, last),
            "metric": th.metric, "calls": cells, "latest": sts[-1] if sts else "early",
            "evidence_source": "per management" if settled else "not checkable",
            "first_quote": {"text": first["quote"], "call": th.mentions[0].call, "page": first["page"],
                            "speaker": first.get("speaker"), "url": first.get("url")},
            "latest_quote": ({"text": last["quote"], "call": th.mentions[-1].call, "page": last["page"], "url": last.get("url")}
                             if len(th.mentions) > 1 else None),
            "verdict": "",
            "mentions": len({m.call for m in th.mentions}),
            # the latest target in structured form, so code can compare it with filed numbers
            "target": {"low": _bounds(last)[0], "high": _bounds(last)[1], "unit": last.get("unit"),
                       "kind": last.get("kind"), "period": last.get("period") or th.period, "scope": last.get("scope")},
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
    shared = _names(a.get("metric", "") + " " + (a.get("scope") or "")) & _names(b.get("metric", "") + " " + (b.get("scope") or ""))
    if not scopes_compatible(a, b) or (not shared and not values_compatible(a, b)):
        return False
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
