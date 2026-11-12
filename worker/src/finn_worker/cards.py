"""Turn filings + moves into Edition cards, ranked (docs/research/03 §10, D-018, D-019).

Card copy schema: kicker (tier, ticker, time), headline (verb + fact), why
(must contain a number), sources, network line, actions. Fields the model
writes (headline/why for documents that need reading) stay empty until it has
read the filing -- the UI shows that state honestly rather than padding.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta

# Ranking weights. Tier first; within tier, kind; then holding weight, then recency.
TIER_WEIGHT = {"lead": 300, "notable": 200, "routine": 0}
KIND_WEIGHT = {
    "litigation": 60, "management_change": 55, "m_and_a": 50, "results": 45, "move": 40,
    "credit_rating": 35, "fund_raise": 30, "capex": 28, "pledging": 27, "insider_trading": 26,
    "press_release": 20, "earnings_call": 18, "dividend": 15, "bonus_split": 15, "unclassified": 10,
}
# Seniority decides how loud a people card is, read from the filing's own event (E29: a Chief Compliance
# Officer appointment was the #1 lead while the new MD & CEO sat in "unclassified").
SENIOR_ROLE = re.compile(r"managing director|\bmd\b|chief executive|\bceo\b|chief financial|\bcfo\b|chair(man|person|woman)?\b|"
                         r"vice[- ]chair|whole[- ]?time director|executive director|deputy managing|\bpresident\b|promoter", re.I)
ROUTINE_PEOPLE = re.compile(r"re-?appoint|continuation|auditor|scrutini[sz]er|registrar|\brta\b", re.I)
MATERIAL_KINDS = ("management_change", "m_and_a", "litigation", "fund_raise", "capex", "credit_rating",
                  "insider_trading", "pledging", "dividend", "bonus_split")
WEAK_CATEGORIES = ("unclassified", "press_release", "earnings_call")
READ_CATEGORIES = ("results", "management_change", "m_and_a", "litigation", "capex", "fund_raise", "credit_rating")


CHANGE_VERB = re.compile(r"appoint|resign|retir|cessation|ceas|vacat|step(s|ped)? down|superannuat|demise|death|elevat|"
                         r"redesignat|re-?designat|join|leav|exit|remov|assum|takes? charge|took charge|promot|nominat|"
                         r"induct|co-?opt|terminat|relinquish|completion of (tenure|term)", re.I)


def real_changes(people: list[dict]) -> list[dict]:
    """People whose record states an actual change (not 'comments on the quarter')."""
    return [p for p in people if p.get("name") and CHANGE_VERB.search(f"{p.get('change') or ''}")]


def people_tier(people: list[dict], headline: str = "") -> str:
    """lead: a senior role changes; routine: only re-appointments / auditors / registrars, or no actual
    change at all (an ESOP committee note, a CEO quote); else notable."""
    real = real_changes(people)
    if not real:
        # no structured change: fall back to the headline ('CFO Rao resigns' still counts; a firm appointed
        # as auditor, an ESOP committee note or a CEO's comment on the quarter does not)
        if not CHANGE_VERB.search(headline) or ROUTINE_PEOPLE.search(headline):
            return "routine"
        return "lead" if SENIOR_ROLE.search(headline) else "notable"
    def text(p):
        return f"{p.get('change') or ''} {p.get('role') or ''}"
    if any(SENIOR_ROLE.search(p.get("role") or "") and not re.search(r"re-?appoint|continu", p.get("change") or "", re.I)
           for p in real):
        return "lead"
    if all(ROUTINE_PEOPLE.search(text(p)) for p in real):
        return "routine"
    return "notable"


_NULLISH = re.compile(r"^\s*(null|none|n/?a|nil|-)?\s*$", re.I)


def scrub_event(ev: dict) -> dict:
    """Model output hygiene, applied at read time and again when cards are built (old reads too):
    no literal 'null' text, no empty people, qualifiers kept ('not exceeding', 'floor price'; E29)."""
    ev = dict(ev)
    for k in ("headline", "why", "counterparty", "quote"):
        v = ev.get(k)
        if isinstance(v, str):
            v = re.sub(r"[;,:]?\s*\b(null|none)\b\s*\.?\s*$", "", v.strip(), flags=re.I).strip()
            ev[k] = None if _NULLISH.match(v) else v
    people = []
    for p in ev.get("people") or []:
        p = {k: (None if isinstance(v, str) and _NULLISH.match(v) else v) for k, v in p.items()}
        if p.get("name") and (p.get("change") or p.get("role")):
            people.append(p)
    ev["people"] = people
    q, h = (ev.get("quote") or ""), (ev.get("headline") or "")
    if h and re.search(r"not exceeding|up to|upto|up-to", q, re.I) and not re.search(r"up to|not exceeding|upto", h, re.I):
        ev["headline"] = re.sub(r"(invests?|investment of|infuses?|to invest)\s+((?:Rs\.?|INR|₹)\s?[\d,.]+)",
                                r"\1 up to \2", h, count=1, flags=re.I)
    if h and re.search(r"floor price", q, re.I) and "floor" not in h.lower():
        ev["headline"] = re.sub(r"(at|for)\s+((?:Rs\.?|INR|₹)\s?[\d,.]+(?: per share)?)", r"\1 a floor price of \2",
                                ev["headline"], count=1, flags=re.I)
    return ev


LOW_SIGNAL_PEOPLE = re.compile(r"re-?appoint|tenure completion|change in auditors|company secretary|compliance officer", re.I)

ROUTINE_GROUPS = [
    ("Investor meet schedules", re.compile(r"investor meet|con\. ?call|analyst", re.I)),
    ("Newspaper notices", re.compile(r"newspaper", re.I)),
    ("Shareholder meetings & votes", re.compile(r"shareholders meeting|postal ballot|voting", re.I)),
    ("Trading window & record dates", re.compile(r"trading window|record date", re.I)),
    ("ESOP allotments", re.compile(r"esop|esos|esps|options to purchase", re.I)),
    ("Compliance certificates", re.compile(r"certificate|regulation 74|registrar", re.I)),
]


@dataclass
class Source:
    label: str          # "Filing PDF", "XBRL", "Bhavcopy"
    url: str | None
    page: int | None = None


@dataclass
class Card:
    id: str
    symbol: str
    company: str
    kind: str
    tier: str
    at: str                       # ISO time of the newest filing in the card
    nse_subject: str
    headline: str | None          # None until read
    headline_source: str          # 'rule' | 'model' | 'xbrl' | 'pending'
    why: str | None
    facts: dict = field(default_factory=dict)
    sources: list[Source] = field(default_factory=list)
    network: list[dict] = field(default_factory=list)   # filled by network.py
    score: float = 0.0
    needs_read: bool = False


_PREFIX = re.compile(
    r"^.*?\b(has (informed|intimated|submitted)( to)? the exchange( about| regarding| that)?|has informed regarding|has informed)\s*",
    re.I)


def rule_headline(summary: str, subject: str) -> str | None:
    """A headline from NSE's own summary when it carries the news; None when it's boilerplate."""
    s = _PREFIX.sub("", (summary or "").strip()).strip(" .'\"")
    m = re.search(r"titled\s+[\"“']([^\"”']{3,120})", summary or "")
    if m:
        title = m.group(1).strip().rstrip(".")
        # a release titled "Press Release" says nothing; leave it for the reader
        return None if title.lower() in ("press release", "press release.", "media release") else title
    if re.search(r"press release dated", summary or "", re.I):
        return None
    m = re.search(r"[\"“'‘]([^\"”'’]{15,140})[\"”'’]", s)
    if m:
        return m.group(1).strip()
    if not s or len(s) < 12:
        return None
    low = s.lower()
    generic = subject.lower().rstrip("s")
    if low in (subject.lower(), f"{generic}", "general updates", "updates", "change in management", "acquisition",
               "transcript", "issue of securities", "amalgamation/merger", "bagging/receiving of orders/contracts") \
            or len(s) <= len(subject) + 4:
        return None
    s = re.sub(r"^(the )?(company has )?", "", s, flags=re.I)
    return s[0].upper() + s[1:] if len(s) <= 140 else s[:137].rsplit(" ", 1)[0] + "…"


def build(filings: list[dict], moves: list[dict], weights: dict[str, float], names: dict[str, str],
          since: datetime, until: datetime, results: dict[str, dict] | None = None,
          events: dict[str, list[dict]] | None = None, calendar: list[str] | None = None) -> dict:
    """Return the Edition: leads, more, routine fold, counts. `filings` rows come from store."""
    in_window = [f for f in filings if since <= datetime.fromisoformat(f["published_at"]) <= until]
    cards: list[Card] = []
    routine: dict[str, int] = defaultdict(int)
    routine_items: list[dict] = []   # every folded filing, so the fold can be opened (UI plan: routine browser)

    folded_keys: set[tuple] = set()

    def fold(label: str, f: dict) -> None:
        # the same filing often arrives twice (live feed and daily backfill, different ids): count it once
        key = (f["symbol"], f.get("link") or "", (f.get("subject") or "").strip().lower(), f["published_at"][:16])
        if key in folded_keys or (f.get("link") and any(k[0] == key[0] and k[1] == key[1] for k in folded_keys)):
            return
        folded_keys.add(key)
        routine[label] += 1
        routine_items.append({"label": label, "symbol": f["symbol"], "subject": (f.get("subject") or "").strip(),
                              "at": f["published_at"], "link": f.get("link") if _real_link(f.get("link")) else None})

    # group same-company, same-kind filings on the same day into one card (results day = 4-6 filings)
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for f in in_window:
        if f["tier"] == "routine":
            label = next((g for g, rx in ROUTINE_GROUPS if rx.search(f["subject"] + " " + (f["summary"] or ""))), "Other housekeeping")
            fold(label, f)
            continue
        day = f["published_at"][:10]
        if f["category"] in ("results", "earnings_call", "press_release"):
            key = (f["symbol"], f["category"], day)
        else:
            # the same event often arrives twice (XBRL item + PDF item, or live feed + backfill):
            # same company and type within 10 minutes is one card with both sources
            t = datetime.fromisoformat(f["published_at"])
            key = next((k for k in groups if k[0] == f["symbol"] and k[1] == f["category"] and isinstance(k[2], datetime)
                        and abs((k[2] - t).total_seconds()) <= 600), (f["symbol"], f["category"], t))
        groups[key].append(f)

    for (sym, cat, _), fs in groups.items():
        fs.sort(key=lambda f: f["published_at"], reverse=True)
        lead = fs[0]
        tier = max((f["tier"] for f in fs), key=lambda t: TIER_WEIGHT[t])
        if cat == "management_change" and all(LOW_SIGNAL_PEOPLE.search(f["subject"] + " " + (f["summary"] or "")) for f in fs):
            tier = "notable"
        headline = None if cat == "results" else next(
            (h for f in fs if (h := rule_headline(f["summary"], f["subject"]))), None)
        needs_read = headline is None or any(f["needs_document"] for f in fs)
        why, facts, source = None, {}, "rule" if headline else "pending"
        read = [scrub_event(e) for f in fs for e in (events or {}).get(f["id"], [])]
        if read and all(e.get("kind") == "unreadable" for e in read) and cat != "results":
            # the document couldn't be read: the filing stays as material as its category says, with its
            # source, instead of folding into housekeeping (audit F04)
            again = any(e.get("retryable") and (e.get("attempts") or 1) < 3 for e in read)
            headline, source, needs_read = f"{lead['subject'].strip()} filed", "rule", False
            why = ("Material filing received; FINN couldn't read the document"
                   + (" yet and will try again" if again else "") + ". Open the filing below.")
            read = []
        if read:
            needs_read = False
            ok = [e for e in read if e.get("headline_ok") and e.get("headline")]
            # a filing filed under a weak NSE subject ("General Updates") can hold a material event:
            # the event read from the document decides the card's kind (E29: HDFC Bank's new MD & CEO)
            if cat in WEAK_CATEGORIES:
                material = [e for e in ok if e.get("kind") in MATERIAL_KINDS
                            and (e.get("kind") != "management_change" or real_changes(e.get("people") or []))]
                if material:
                    cat = min(material, key=lambda e: MATERIAL_KINDS.index(e["kind"]))["kind"]
            # same filing can carry several events: a deal card shows the deal, not the results
            same = [e for e in ok if e.get("kind") == cat]
            if cat == "management_change" and same:
                # one card per filing: the most senior change leads, everyone named is listed
                same.sort(key=lambda e: {"lead": 0, "notable": 1, "routine": 2}[people_tier(e.get("people") or [], e.get("headline") or "")])
            best = (same[0] if same else None) or next(
                (e for e in ok if e.get("kind") != "results" or cat == "results"), None)
            if best:
                headline, why, source = best["headline"], best.get("why"), "model"
                facts = {k: best[k] for k in ("people", "amount_inr_cr", "counterparty", "quote", "page") if best.get(k)}
                if cat == "management_change":
                    everyone = [p for e in same for p in e.get("people") or []]
                    facts["people"] = list({p["name"]: p for p in everyone}.values())
                    tier = people_tier(facts["people"], headline or "")
                    others = [e["headline"] for e in same[1:]]
                    if others and not why:
                        why = "Also in this filing: " + "; ".join(others) + "."
        if read and headline is None and cat != "results":
            # read, and nothing beyond what another card carries: results decks and shareholder letters
            # repeat the results card (ENAM's reference counts them as results); the rest is housekeeping
            only_results = all(e.get("kind") in ("results", "routine") for e in read) and any(e.get("kind") == "results" for e in read)
            fold("Results decks & letters" if only_results else "Other housekeeping", lead)
            continue
        if tier == "routine":
            fold("People: re-appointments & auditors" if cat == "management_change" else "Other housekeeping", lead)
            continue
        if headline is None:
            headline, why, needs_read = _fallback_copy(cat, fs, why, needs_read)
            source = "rule" if headline else source
        cid = hashlib.sha1(("|".join(f["id"] for f in fs)).encode()).hexdigest()[:12]
        cards.append(Card(
            id=cid, symbol=sym, company=names.get(sym, lead["company_name"]), kind=cat, tier=tier,
            at=lead["published_at"], nse_subject=lead["subject"], headline=headline,
            headline_source=source, why=why, facts=facts,
            # NSE writes "-" when a filing has no attachment: only a real address becomes a source
            sources=[Source(_source_label(f), f["link"]) for f in fs if _real_link(f.get("link"))],
            needs_read=needs_read,
        ))

    for c in cards:
        if c.kind == "results" and results and c.symbol in results:
            r = results[c.symbol]
            c.facts = {**c.facts, "results": r}
            v = r["values"]
            cmp_ = r.get("comparatives")
            if cmp_ and cmp_.get("yoy"):
                c.headline, c.why = results_copy(cmp_)
                c.headline_source = "rule"
                c.needs_read = False
            elif v.get("revenue") and v.get("pat") is not None:
                c.headline = (f"Q{_fy_quarter(r['period_end'])} revenue ₹{inr(v['revenue']/1e7)} cr, "
                              f"profit ₹{inr(v['pat']/1e7)} cr")
                c.headline_source = "xbrl"
        if c.kind == "results" and not c.headline:
            c.headline, c.headline_source, c.needs_read = "Results filed, numbers withheld", "rule", False
            c.tier = "notable"                 # nothing to read off it: not a lead
            c.why = c.why or ("FINN shows results only when the table passes its checks against the filing; "
                              "this one did not, so open the filing for the numbers.")

    # the stock's reaction is told on the filing card it follows ("the stock fell 6.8% the next session");
    # the move cards themselves are a separate registry (build_moves), filtered by the investor's rules
    told: set[str] = set()
    for m in sorted(moves, key=lambda m: m["day"]):
        if abs(m["change_pct"]) < 2 and m["volume_multiple"] < 1.5:
            continue                       # too small to be worth a sentence on a filing card
        hit = explaining_card(m, cards, calendar or sorted({x["day"] for x in moves}))
        if hit is None or hit.id in told:
            continue
        told.add(hit.id)
        line = (f"The stock {'rose' if m['change_pct'] >= 0 else 'fell'} {abs(m['change_pct']):.1f}% "
                f"{'the same session' if hit.at[:10] == m['day'] else 'the next session'} "
                f"on {m['volume_multiple']:.1f}× usual volume.")
        hit.why = f"{hit.why} {line}".strip() if hit.why else line

    cards = _merge_duplicate_people(cards)

    for c in cards:
        # a research-list company (no weight) is shown but never leads: the edition is about the holdings first
        if c.symbol not in weights and c.tier == "lead":
            c.tier = "notable"
    for c in cards:
        age_h = (until - datetime.fromisoformat(c.at)).total_seconds() / 3600
        c.score = (TIER_WEIGHT[c.tier] + KIND_WEIGHT.get(c.kind, 10) + 4 * weights.get(c.symbol, 0)
                   - min(age_h, 24 * 30) * 0.15)
    cards.sort(key=lambda c: -c.score)
    leads = [c for c in cards if c.tier == "lead"][:3]
    rest = [c for c in cards if c not in leads]
    return {
        "since": since.isoformat(), "until": until.isoformat(),
        "leads": [asdict(c) for c in leads],
        "more": [asdict(c) for c in rest],
        "routine": sorted(routine.items(), key=lambda kv: -kv[1]),
        "routine_total": sum(routine.values()),
        "routine_items": sorted(routine_items, key=lambda x: x["at"], reverse=True),
        "counts": {"filings": len(in_window), "cards": len(cards)},
    }


BHAV_URL = "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{d}_F_0000.csv.zip"


def build_moves(moves: list[dict], cards: list[dict], filings: list[dict], weights: dict[str, float],
                names: dict[str, str], until: datetime, calendar: list[str]) -> list[dict]:
    """Every session that crossed the lowest thresholds the settings allow, as its own card with a durable id
    (audit F01/F05). The app keeps the ones that meet the investor's rules -- a 4%/8x day is never erased by
    a bigger-price 6%/1.6x day -- and every alert row opens its own card.

    `cards` are the 30-day edition's filing cards: a move is placed after the filing published between the
    previous session's close and this one's, on the full exchange calendar (not just the sessions that moved)."""
    objs = [Card(**{**c, "sources": [Source(**x) for x in c["sources"]]}) for c in cards]
    out = []
    for m in moves:
        d = datetime.fromisoformat(m["day"] + "T15:30:00")
        why_filing = explaining_card(m, objs, calendar)
        earlier = None if why_filing else explaining_filing(m, filings, calendar)
        n = m.get("baseline_n") or 20
        base = f"the {n}-session average" if n >= 20 else f"the average of only {n} earlier sessions"
        tier = ("lead" if round(abs(m["change_pct"]), 1) >= 5 and why_filing is None and not earlier and m["symbol"] in weights
                else "notable")                  # a research-list move is listed, never a lead
        c = Card(
            id=f"move-{m['symbol']}-{m['day']}", symbol=m["symbol"], company=names.get(m["symbol"], m["symbol"]),
            kind="move", tier=tier, at=d.isoformat(), nse_subject="",
            headline=f"{'Up' if m['change_pct'] >= 0 else 'Down'} {abs(m['change_pct']):.1f}% on {m['volume_multiple']:.1f}× usual volume",
            headline_source="rule",
            # D-019: never guess a cause; say what was filed between the previous close and this close
            why=(f"Closed ₹{inr(m['close'], 2)}, {_signed_pct(m['change_pct'])}; volume {m['volume_multiple']:.1f}× {base}. "
                 + (f"Filed before this session: “{why_filing.headline}” ({_when(why_filing.at)})." if why_filing
                    else f"Filed before this session: its {earlier}." if earlier
                    else "No material filing between the previous close and this close.")),
            facts={**{k: m[k] for k in ("close", "change_pct", "volume", "volume_multiple")},
                   "baseline_n": n, "explained_by": why_filing.id if why_filing else ("earlier filing" if earlier else None)},
            sources=[Source(f"NSE bhavcopy {d:%d %b %Y}", BHAV_URL.format(d=f"{d:%Y%m%d}"))],
        )
        age_h = (until - d).total_seconds() / 3600
        c.score = TIER_WEIGHT[c.tier] + KIND_WEIGHT["move"] + 4 * weights.get(c.symbol, 0) - min(age_h, 24 * 30) * 0.15
        out.append(asdict(c))
    return sorted(out, key=lambda c: c["at"], reverse=True)


def _real_link(link: str | None) -> bool:
    return bool(link) and str(link).startswith(("http://", "https://"))


def _source_label(f: dict) -> str:
    link = (f.get("link") or "").lower()
    if link.endswith(".xml"):
        return "XBRL"
    if "transcript" in link:
        return "Transcript"
    if "press" in link:
        return "Press release"
    if "presentation" in link:
        return "Presentation"
    return "Filing"


def _fy_quarter(period_end: str) -> str:
    """'2026-09-30' -> '2FY27' (Indian FY: Apr-Mar)."""
    y, mth = int(period_end[:4]), int(period_end[5:7])
    q = {6: 1, 9: 2, 12: 3, 3: 4}.get(mth, 0)
    fy = y + 1 if mth >= 4 else y
    return f"{q}FY{fy % 100:02d}"


def _fallback_copy(cat: str, fs: list[dict], why, needs_read: bool):
    """Honest copy for filings the reader will not summarise, instead of a 'pending' that never resolves."""
    text = " ".join(f"{f['subject']} {f.get('summary') or ''} {f.get('link') or ''}" for f in fs).lower()
    links = [f.get("link") or "" for f in fs]
    if cat == "earnings_call":
        what = "transcript" if "transcript" in text else "recording" if re.search(r"recording|audio|video", text) else "update"
        return f"Earnings-call {what} filed", why, False
    if cat == "results":
        return None, why, needs_read                       # filled from the results table below, or withheld
    if links and not any(l.lower().endswith(".pdf") for l in links):
        # say what the attachment actually is (audit: every non-PDF was called a ZIP)
        real = [l.lower() for l in links if _real_link(l)]
        note = ("No document was attached to this filing." if not real
                else "Filed as XBRL data only (no PDF)." if all(l.endswith(".xml") for l in real)
                else "The filing is a ZIP attachment; open it below." if any(l.endswith(".zip") for l in real)
                else "Open the filing below.")
        return f"{fs[0]['subject'].strip()} filed", why or note, False
    if cat not in READ_CATEGORIES and not any(f.get("needs_document") for f in fs):
        return f"{fs[0]['subject'].strip()} filed", why, False
    return None, why, needs_read                           # the reader will summarise it on a coming run


def _merge_duplicate_people(cards: list) -> list:
    """The same change often arrives as two filings hours or days apart (XBRL item + PDF, or a correction):
    one card per person and change within three days, with both sources (Gautam Doshi twice; E29)."""
    out, seen = [], {}
    for c in sorted(cards, key=lambda c: c.at):
        if c.kind == "management_change" and c.facts.get("people"):
            key = (c.symbol, tuple(sorted((p.get("name") or "").lower() for p in c.facts["people"])))
            first = seen.get(key)
            if first is not None and abs((datetime.fromisoformat(c.at[:19]) - datetime.fromisoformat(first.at[:19])).days) <= 3:
                first.sources += [s for s in c.sources if s.url not in {x.url for x in first.sources}]
                continue
            seen[key] = c
        out.append(c)
    return out


def explaining_card(m: dict, cards: list, trading_days: list[str]):
    """The filing card a move follows: published after the previous session's 15:30 close and before
    this session's close. Results filed at 17:08 move the NEXT session's price (Kalyan, Reliance; E29).
    Prefers results, then the most material kind."""
    prev = [d for d in trading_days if d < m["day"]]
    prev_day = prev[-1] if prev else (datetime.fromisoformat(m["day"]) - timedelta(days=1)).date().isoformat()
    start, end = f"{prev_day}T15:30:00", f"{m['day']}T15:30:00"
    # a transcript or recording filed mid-session doesn't explain a price move; filed news does
    # only news that could plausibly move a stock: results, or a lead-tier filing (a compliance officer's
    # appointment the same afternoon is a coincidence, not context)
    hits = [c for c in cards if c.symbol == m["symbol"] and c.kind not in ("move", "earnings_call", "unclassified")
            and (c.kind == "results" or c.tier == "lead") and start < c.at[:19] <= end and c.headline]
    order = ["results", "m_and_a", "management_change", "litigation", "fund_raise", "capex", "credit_rating"]
    hits.sort(key=lambda c: (order.index(c.kind) if c.kind in order else len(order), c.at))
    return hits[0] if hits else None


_KIND_WORDS = {"results": "results", "m_and_a": "deal filing", "management_change": "management change filing",
               "litigation": "legal filing", "fund_raise": "fund-raise filing", "capex": "order/capex filing",
               "credit_rating": "credit-rating filing"}


def explaining_filing(m: dict, filings: list[dict], trading_days: list[str]) -> str | None:
    """Same window rule as explaining_card, over all filings: a material filing published after the previous
    close that sits just outside the edition window still explains the move."""
    prev = [d for d in trading_days if d < m["day"]]
    prev_day = prev[-1] if prev else (datetime.fromisoformat(m["day"]) - timedelta(days=1)).date().isoformat()
    start, end = f"{prev_day}T15:30:00", f"{m['day']}T15:30:00"
    hits = [f for f in filings if f["symbol"] == m["symbol"] and f["tier"] != "routine"
            and f.get("category") in _KIND_WORDS and start < f["published_at"][:19] <= end]
    if not hits:
        return None
    order = list(_KIND_WORDS)
    f = min(hits, key=lambda f: order.index(f["category"]))
    return f"{_KIND_WORDS[f['category']]} ({_when(f['published_at'])})"


def inr(x: float, decimals: int = 0) -> str:
    """Indian digit grouping: 240357 -> '2,40,357'; 1061.2 with 2 decimals -> '1,061.20' (plan §5)."""
    neg, x = x < 0, abs(x)
    whole, frac = f"{x:.{decimals}f}".split(".") if decimals else (f"{x:.0f}", "")
    head, tail = whole[:-3], whole[-3:]
    head = ",".join(re.findall(r"\d{1,2}(?=(?:\d{2})*$)", head)) if head else ""
    out = f"{head},{tail}" if head else tail
    return ("−" if neg else "") + out + (f".{frac}" if frac else "")


def _signed_pct(v: float) -> str:
    r = round(v, 1)
    return f"{'+' if r > 0 else '−' if r < 0 else ''}{abs(r):.1f}%"


def _when(at: str) -> str:
    d = datetime.fromisoformat(at[:19])
    return f"{d:%a %d %b}, {d:%H:%M}"


def _dir(x: float) -> str:
    return "up" if x >= 0 else "down"


def results_copy(n: dict) -> tuple[str, str | None]:
    """Results headline and 'why' written from computed numbers only (no model)."""
    y, cur = n.get("yoy", {}), n.get("current", {})
    if n.get("is_bank"):
        top, top_label = y.get("nii"), "NII"
    else:
        top, top_label = y.get("revenue"), "Revenue"
    pat = y.get("pat")
    cur_pat, prev_pat = cur.get("pat"), (n.get("prev_y") or {}).get("pat")
    # a one-off gain that is a large part of profit would make "profit up 114%" misleading (Titan; E29)
    one_off = (cur.get("non_operating_extra") or 0) + (cur.get("exceptional") or 0)
    lead_underlying = (cur_pat and one_off and abs(one_off) > 0.15 * abs(cur_pat)
                       and y.get("pbt_underlying") is not None)
    parts = []
    if top is not None:
        parts.append(f"{top_label} {_dir(top)} {abs(top):.1f}% YoY")
    if lead_underlying:
        parts.append(f"PBT before one-offs {_dir(y['pbt_underlying'])} {abs(y['pbt_underlying']):.1f}%")   # PBT, said as PBT
    elif cur_pat is not None and cur_pat < 0 and prev_pat is not None and prev_pat < 0:
        parts.append(f"loss {'widened' if cur_pat < prev_pat else 'narrowed'} to ₹{inr(abs(cur_pat))} cr")
    elif pat is not None:
        parts.append(f"PAT {_dir(pat)} {abs(pat):.1f}%")
    elif cur_pat is not None and prev_pat is not None and (cur_pat < 0) != (prev_pat < 0):
        parts.append(f"swung to a loss of ₹{inr(abs(cur_pat))} cr" if cur_pat < 0
                     else f"back to a ₹{inr(cur_pat)} cr profit from a loss")
    headline = ", ".join(parts) or "Results filed"
    why = []
    if cur.get("ebitda_margin_pct") is not None and y.get("ebitda_margin_bp") is not None:
        bp = y["ebitda_margin_bp"]
        why.append(f"EBITDA margin {cur['ebitda_margin_pct']:.2f}%, {'+' if bp >= 0 else '−'}{abs(bp)}bp YoY.")   # 2dp: the bp is from unrounded figures
    if lead_underlying and pat is not None:
        # like with like: reported PBT against PBT before the pre-tax one-offs; PAT said separately (its tax
        # effect isn't disclosed, so PAT is never "normalised" with a pre-tax item)
        pbt = y.get("pbt")
        why.append((f"Reported PBT {_dir(pbt)} {abs(pbt):.1f}% including ₹{inr(abs(one_off))} cr of pre-tax one-off items" if pbt is not None
                    else f"PBT includes ₹{inr(abs(one_off))} cr of pre-tax one-off items") + f"; PAT {_dir(pat)} {abs(pat):.1f}%.")
    elif cur.get("exceptional") and y.get("pbt_ex_exceptional") is not None:
        why.append(f"PBT includes a ₹{inr(abs(cur['exceptional']))} cr exceptional item; before it, PBT {_dir(y['pbt_ex_exceptional'])} "
                   f"{abs(y['pbt_ex_exceptional']):.1f}% YoY.")
    if cur.get("non_operating_extra") and not lead_underlying:
        why.append(f"Total income includes ₹{inr(cur['non_operating_extra'])} cr of non-operating gains, kept out of EBITDA.")
    if n.get("net_of_excise"):
        why.append("Revenue is net of excise duty.")
    if n.get("is_bank") and cur.get("gnpa_pct") is not None:
        why.append(f"Gross NPA {cur['gnpa_pct']:.2f}%.")
    return headline[0].upper() + headline[1:], " ".join(why) or None
