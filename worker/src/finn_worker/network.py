"""The Network: who in the investor's own contacts can explain this event, and why.

Deterministic and local -- contact data never goes to any model (D-025).

Evidence levels decide the wording (D-023):
  certain          same person (DIN / exact name + organisation)
  dates overlap    worked at the same organisation at the same time -> "worked together"
  same organisation  shared employer/school, dates unknown or not overlapping -> "both ex-X"
  second degree    reachable through a strong contact -> "via Kabir"

Strength (docs/research/04-architecture.md §4):
  0.35*recency + 0.25*frequency + 0.15*reciprocity + 0.15*rating + 0.10*shared context
"""
from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from rapidfuzz import fuzz

ROOT = Path(__file__).resolve().parents[3]

# Event kind -> the expertise that helps explain it (matched against contact domains/functions)
KIND_DOMAINS = {
    # generic expertise only; regulator-specific matches come from TOPIC_HINTS ("nbfc regulation" is not
    # expertise on a commercial tribunal claim; E29)
    "litigation": ["litigation", "legal", "disputes", "arbitration", "forensic"],
    "m_and_a": ["m&a", "corporate development", "demergers", "schemes of arrangement", "investment banking", "corporate finance"],
    "credit_rating": ["corporate credit", "credit risk"],
    "fund_raise": ["corporate finance", "investment banking"],
    "capex": ["projects", "plant commissioning", "epc", "order inflow"],
}
# The roles at a company closest to each kind of event: an ex-Legal head for a claim, ex-Finance for a raise
KIND_FUNCTIONS = {
    "litigation": {"legal", "secretarial", "compliance"},
    "m_and_a": {"strategy", "corporate development", "corporate finance", "finance"},
    "results": {"finance", "investor relations", "strategy"},
    "fund_raise": {"finance", "treasury", "corporate finance"},
    "capex": {"operations", "projects", "plant", "manufacturing", "business development"},
    "credit_rating": {"finance", "treasury"},
    "management_change": {"strategy", "hr", "leadership", "board"},
}
KIND_WORDS = {"litigation": "legal matter", "m_and_a": "deal", "results": "results", "fund_raise": "fund raise",
              "capex": "order or capex", "credit_rating": "rating", "management_change": "leadership change",
              "move": "price move"}

# Topic words in a card that point to a specific domain
TOPIC_HINTS = {
    r"irdai|insurance": "insurance regulation",
    r"auditor": "forensic audit",
    r"qrsam|akash|missile|air defence": "air defence",
    r"order|contract": "order inflow",
    r"amalgamation|merger|demerger|scheme": "schemes of arrangement",
    r"acquisition|acquire|stake": "m&a",
    r"polycarbonate|phenol": "polycarbonate",
    r"usfda|fda": "usfda",
}


@dataclass
class Contact:
    id: str
    name: str
    current: dict
    history: list[dict]
    education: list[dict]
    domains: list[str]
    interactions_12m: int
    last_contact: str | None
    reciprocity: float
    rating: int


def load(path: Path | None = None) -> tuple[list[Contact], list[dict]]:
    data = json.loads((path or ROOT / "config" / "network.json").read_text())
    keys = Contact.__dataclass_fields__.keys()
    return [Contact(**{k: c.get(k) for k in keys}) for c in data["contacts"]], data.get("edges", [])


def strength(c: Contact, today: date) -> float:
    days = (today - date.fromisoformat(c.last_contact)).days if c.last_contact else 3650
    recency = math.exp(-max(days, 0) / 180)
    freq = min(1.0, math.log1p(c.interactions_12m or 0) / math.log1p(24))
    shared = 1.0 if c.education else 0.0
    return round(0.35 * recency + 0.25 * freq + 0.15 * (c.reciprocity or 0) + 0.15 * (c.rating or 0) / 5 + 0.10 * shared, 3)


def strength_label(s: float) -> str:
    return "strong" if s >= 0.6 else "medium" if s >= 0.4 else "weak"


def _year(s: str | None) -> int | None:
    return int(s[:4]) if s else None


def _span(h: dict) -> str:
    a, b = _year(h.get("start")), _year(h.get("end"))
    return f"{a}–{str(b)[2:] if b and a and str(a)[:2] == str(b)[:2] else b or 'now'}" if a else ""


def _org_match(a: str, b: str) -> bool:
    norm = lambda s: re.sub(r"\b(limited|ltd|india|of|the|company|industries)\b|[^a-z0-9 ]", "", s.lower()).strip()
    return fuzz.token_set_ratio(norm(a), norm(b)) >= 90


def _overlap(h1: dict, h2: dict) -> tuple[int, int] | None:
    s1, e1 = _year(h1.get("start")), _year(h1.get("end")) or date.today().year
    s2, e2 = _year(h2.get("start")), _year(h2.get("end")) or date.today().year
    if None in (s1, s2):
        return None
    lo, hi = max(s1, s2), min(e1, e2)
    return (lo, hi) if lo <= hi else None


# ------------------------------------------------------------------ matching

def for_person(person: dict, contacts: list[Contact], today: date) -> list[dict]:
    """person = {'name', 'orgs': [{'org','start','end'}], 'schools': ['...']} (structured from a filing bio)."""
    out = []
    for c in contacts:
        if fuzz.token_sort_ratio(person.get("name", ""), c.name) >= 95:
            out.append(_line(c, today, "is the same person", "certain", 1.0))
            continue
        for po in person.get("orgs", []):
            stints = [h for h in c.history if _org_match(po["org"], h["org"])]
            if not stints:
                continue
            spans = [ov for h in stints if (ov := _overlap(po, h))]
            org = stints[0]["org"]
            if spans and po.get("inferred"):
                # tenure derived from the filing's own words ("served the Bank for nearly 27 years")
                lo, hi = min(s[0] for s in spans), max(s[1] for s in spans)
                h = stints[0]
                who = person.get("name", "them").split()[-1] if person.get("name") else "them"
                out.append(_line(c, today, f"was at {org} {_span(h)}, while {person.get('name', 'they')} was there "
                                           f"(about {po['start']}–{str(po['end'])[2:]}, per the filing)", "dates overlap", 0.97))
            elif spans:
                lo, hi = min(s[0] for s in spans), max(s[1] for s in spans)
                out.append(_line(c, today, f"worked at {org} at the same time, {lo}–{hi}", "dates overlap", 0.95))
            else:
                note = "dates not disclosed" if not po.get("start") else "at different times"
                out.append(_line(c, today, f"also worked at {org} ({note})", "same organisation", 0.6))
        for school in person.get("schools", []):
            for e in c.education:
                if _org_match(school, e["school"]):
                    out.append(_line(c, today, f"is also an alumnus of {e['school']}", "same organisation", 0.4))
    return _best(out)


def for_company(symbol: str, contacts: list[Contact], today: date, *, kind: str = "", text: str = "") -> list[dict]:
    """Who can give context on an event at `symbol` -- insiders, alumni, board members, domain experts."""
    out = []
    generic = set(KIND_DOMAINS.get(kind, []))
    topical = {dom for rx, dom in TOPIC_HINTS.items() if re.search(rx, text, re.I)}
    for c in contacts:
        doms = {d.lower() for d in c.domains} | {h.get("function", "").lower() for h in c.history}
        for h in c.history:
            if h.get("symbol") != symbol:
                continue
            if h.get("end") is None:
                if kind == "move":
                    continue  # never point an investor at an insider to ask why the stock moved
                rel = f"works at {h['org']} now ({h['role']})"
                out.append(_line(c, today, rel, "certain", 0.55, insider=True))
            elif h.get("function") == "board":
                out.append(_line(c, today, f"sat on {h['org']}'s board, {_span(h)}", "certain", 0.85))
            else:
                ln = _line(c, today, f"was {h['role']} at {h['org']}, {_span(h)}", "certain", 0.9)
                if _fits(h, kind):
                    ln["_score"] = round(ln["_score"] + 0.12, 4)
                    ln["fit"] = f"as {h['role']} there ({_span(h)}), the closest to this {KIND_WORDS.get(kind, 'event')}"
                out.append(ln)
        if any(h.get("symbol") == symbol for h in c.history):
            continue
        role = c.history[-1]["role"] + ", " + c.history[-1]["org"] if c.history else c.current.get("role", "")
        top = sorted(d for d in doms if any(_same_topic(d, w) for w in topical))
        gen = sorted(d for d in doms if any(_same_topic(d, w) for w in generic))
        if top:
            ln = _line(c, today, f"knows {top[0]} ({role})", "same organisation", 0.7)
            ln["topical"] = True
            ln["fit"] = f"knows {top[0]}, the subject of this filing"
            out.append(ln)
        elif gen:
            out.append(_line(c, today, f"knows {gen[0]} ({role})", "same organisation", 0.45))
    # a specialist in the filing's own subject (an IRDAI licence -> insurance regulation) outranks an alumnus
    # whose role there has nothing to do with it
    if any(ln.get("topical") for ln in out) and not any(ln.get("fit") and not ln.get("topical") for ln in out):
        for ln in out:
            if ln.get("topical"):
                ln["_score"] = round(ln["_score"] / 0.7 * 0.95, 4)
    # fewer, better: a generic expert only when nobody has a direct link to the company
    direct = [ln for ln in out if ln["confidence"] == "certain" or ln.get("topical")]
    if direct:
        out = direct + [ln for ln in out if ln["confidence"] != "certain" and ln["_score"] >= 0.7 * 0.5]
    return _best(out)


def _fits(h: dict, kind: str) -> bool:
    wanted = KIND_FUNCTIONS.get(kind, set())
    text = f"{h.get('function', '')} {h.get('role', '')}".lower()
    return any(w in text for w in wanted)


def best_reason(ln: dict) -> str:
    """Why the first person is the one to call, in plain words, from the evidence on the line."""
    parts = [ln.get("fit") or ln["relation"]]
    if ln.get("via"):
        parts.append(f"reach them through {ln['via']}")
    elif ln["strength"] == "strong":
        parts.append("a strong tie")
    if ln.get("insider"):
        parts.append("still works there, so public information only")
    return "; ".join(parts)


_TENURE = re.compile(r"(?:served|been with|been associated with|associated with|career (?:spanning|of)|worked (?:with|at))"
                     r"[^.]{0,40}?(?:nearly|over|about|around|approximately|more than|close to)?\s*(\d{1,2})\s*years", re.I)
_LEAVING = re.compile(r"resign|retir|superannuat|cessation|ceas|vacat|step|demise|relinquish|exit|leav", re.I)


_DECADES = re.compile(r"(?:nearly|over|about|around|more than|close to)?\s*(two|three|four)\s+decades", re.I)


def tenure_from_text(person: dict, texts: list[str], year: int) -> dict | None:
    """A leaving person's stint at the filing company, from the filing's own words:
    'served the Bank for nearly 27 years' filed in 2026 -> about 1999-2026; 'over three decades of
    service' -> about 1996-2026."""
    if not _LEAVING.search(person.get("change") or ""):
        return None
    for t in texts:
        m = _TENURE.search(t or "")
        n = int(m.group(1)) if m else None
        if n is None and (d := _DECADES.search(t or "")) and re.search(r"servic|career|with the", t, re.I):
            n = {"two": 20, "three": 30, "four": 40}[d.group(1).lower()]
        if n and 1 <= n <= 50:
            return {"start": str(year - n), "end": str(year), "inferred": True}
    return None


def _words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z&]+", s.lower()) if len(w) >= 4 or w in {"m&a", "epc", "irdai"}}


_GENERIC_WORDS = {"regulation", "regulatory", "management", "business", "services", "markets", "banking", "finance",
                  "corporate", "industry", "sector", "policy"}


def _same_topic(domain: str, wanted: str) -> bool:
    """Whole-word overlap on a distinctive word ('insurance regulation' ~ 'irdai insurance'), never substrings
    ('pli' !~ 'compliance') and never only a generic word ('nbfc regulation' !~ 'insurance regulation'; E29)."""
    if domain == wanted:
        return True
    shared = _words(domain) & _words(wanted)
    return bool(shared - _GENERIC_WORDS)


def second_degree(lines: list[dict], contacts: list[Contact], edges: list[dict], today: date) -> list[dict]:
    """Add 'via' for weak direct links that a strong contact can introduce."""
    by_id = {c.id: c for c in contacts}
    for ln in lines:
        if ln["strength"] != "weak":
            continue
        for e in edges:
            other = e["b"] if e["a"] == ln["contact_id"] else e["a"] if e["b"] == ln["contact_id"] else None
            if other and strength(by_id[other], today) >= 0.6:
                ln["via"] = by_id[other].name
                break
    return lines


def _line(c: Contact, today: date, relation: str, confidence: str, relevance: float, insider: bool = False) -> dict:
    s = strength(c, today)
    return {"contact_id": c.id, "name": c.name, "relation": relation, "strength": strength_label(s),
            "last_contact": c.last_contact, "confidence": confidence, "via": None, "insider": insider,
            "_score": round(relevance * (0.5 + 0.5 * s), 4)}


def _best(lines: list[dict], k: int = 3) -> list[dict]:
    """Highest score per contact, then top k."""
    best: dict[str, dict] = {}
    for ln in lines:
        if ln["contact_id"] not in best or ln["_score"] > best[ln["contact_id"]]["_score"]:
            best[ln["contact_id"]] = ln
    # relevance before warmth: someone whose role there or expertise fits this event comes first
    return sorted(best.values(), key=lambda x: (0 if x.get("fit") else 1, -x["_score"]))[:k]


def annotate(cards: list[dict], today: date, contacts: list[Contact] | None = None, edges: list[dict] | None = None) -> None:
    """Attach the best network line(s) to each Edition card, in place."""
    if contacts is None:
        contacts, edges = load()
    for card in cards:
        text = " ".join(filter(None, [card.get("headline"), card.get("nse_subject"), card.get("company")]))
        lines = for_company(card["symbol"], contacts, today, kind=card["kind"], text=text)
        card["network"] = second_degree(lines, contacts, edges or [], today)
