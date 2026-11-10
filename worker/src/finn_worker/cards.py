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
          events: dict[str, list[dict]] | None = None) -> dict:
    """Return the Edition: leads, more, routine fold, counts. `filings` rows come from store."""
    in_window = [f for f in filings if since <= datetime.fromisoformat(f["published_at"]) <= until]
    cards: list[Card] = []
    routine: dict[str, int] = defaultdict(int)

    # group same-company, same-kind filings on the same day into one card (results day = 4-6 filings)
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for f in in_window:
        if f["tier"] == "routine":
            label = next((g for g, rx in ROUTINE_GROUPS if rx.search(f["subject"] + " " + (f["summary"] or ""))), "Other housekeeping")
            routine[label] += 1
            continue
        day = f["published_at"][:10]
        key = (f["symbol"], f["category"], day if f["category"] in ("results", "earnings_call", "press_release") else f["id"])
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
        read = [e for f in fs for e in (events or {}).get(f["id"], [])]
        if read:
            needs_read = False
            best = next((e for e in read if e.get("headline_ok")), None)
            if best:
                headline, why, source = best["headline"], best.get("why"), "model"
                facts = {k: best[k] for k in ("people", "amount_inr_cr", "counterparty", "quote", "page") if best.get(k)}
        cid = hashlib.sha1(("|".join(f["id"] for f in fs)).encode()).hexdigest()[:12]
        cards.append(Card(
            id=cid, symbol=sym, company=names.get(sym, lead["company_name"]), kind=cat, tier=tier,
            at=lead["published_at"], nse_subject=lead["subject"], headline=headline,
            headline_source=source, why=why, facts=facts,
            sources=[Source(_source_label(f), f["link"]) for f in fs if f["link"]],
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
                c.headline = (f"Q{_fy_quarter(r['period_end'])} revenue ₹{v['revenue']/1e7:,.0f} cr, "
                              f"profit ₹{v['pat']/1e7:,.0f} cr")
                c.headline_source = "xbrl"

    for m in moves:
        d = datetime.fromisoformat(m["day"] + "T15:30:00")
        if not (since <= d <= until) or not (m["price_alert"] or m["volume_alert"]):
            continue
        explained = any(c.symbol == m["symbol"] and c.at[:10] == m["day"] for c in cards)
        arrow = "▲" if m["change_pct"] >= 0 else "▼"
        cards.append(Card(
            id=f"move-{m['symbol']}-{m['day']}", symbol=m["symbol"], company=names.get(m["symbol"], m["symbol"]),
            # default tier at the default thresholds (5%, 2x); the app re-tiers with the user's own
            kind="move", tier="lead" if abs(m["change_pct"]) >= 5 else "notable", at=d.isoformat(), nse_subject="",
            headline=f"{'Up' if m['change_pct'] >= 0 else 'Down'} {abs(m['change_pct']):.1f}% on {m['volume_multiple']:.1f}× usual volume",
            headline_source="rule",
            # D-019: never guess a cause
            why=(f"Closed ₹{m['close']:,.2f} {arrow}{abs(m['change_pct']):.1f}%; volume {m['volume_multiple']:.1f}× the 20-session average. "
                 + ("A filing the same day is in this edition." if explained else "No filing explains this move.")),
            facts={k: m[k] for k in ("close", "change_pct", "volume", "volume_multiple", "price_alert", "volume_alert")},
            sources=[Source("NSE bhavcopy", None)],
        ))

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
        "counts": {"filings": len(in_window), "cards": len(cards)},
    }


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
    parts = []
    if top is not None:
        parts.append(f"{top_label} {_dir(top)} {abs(top):.1f}% YoY")
    if pat is not None:
        parts.append(f"profit {_dir(pat)} {abs(pat):.1f}%")
    headline = ", ".join(parts) or "Results filed"
    why = []
    if cur.get("ebitda_margin_pct") is not None and y.get("ebitda_margin_bp") is not None:
        bp = y["ebitda_margin_bp"]
        why.append(f"EBITDA margin {cur['ebitda_margin_pct']:.1f}%, {'+' if bp >= 0 else '−'}{abs(bp)}bp YoY.")
    if cur.get("exceptional") and y.get("pbt_ex_exceptional") is not None:
        why.append(f"PBT includes a ₹{abs(cur['exceptional']):,.0f} cr exceptional item; before it, PBT {_dir(y['pbt_ex_exceptional'])} "
                   f"{abs(y['pbt_ex_exceptional']):.1f}% YoY.")
    if n.get("is_bank") and cur.get("gnpa_pct") is not None:
        why.append(f"Gross NPA {cur['gnpa_pct']:.2f}%.")
    return headline[0].upper() + headline[1:], " ".join(why) or None
