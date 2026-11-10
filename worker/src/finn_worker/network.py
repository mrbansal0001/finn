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
    "litigation": ["litigation", "legal", "disputes", "regulation", "compliance", "forensic"],
    "m_and_a": ["m&a", "corporate development", "demergers", "schemes of arrangement", "investment banking", "corporate finance"],
    "credit_rating": ["corporate credit", "credit risk"],
    "fund_raise": ["corporate finance", "investment banking"],
    "capex": ["projects", "plant commissioning", "epc", "order inflow"],
}
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
            if spans:
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
                out.append(_line(c, today, f"was {h['role']} at {h['org']}, {_span(h)}", "certain", 0.9))
        if any(h.get("symbol") == symbol for h in c.history):
            continue
        role = c.history[-1]["role"] + ", " + c.history[-1]["org"] if c.history else c.current.get("role", "")
        top = sorted(d for d in doms if any(_same_topic(d, w) for w in topical))
        gen = sorted(d for d in doms if any(_same_topic(d, w) for w in generic))
        if top:
            out.append(_line(c, today, f"knows {top[0]} ({role})", "same organisation", 0.7))
        elif gen:
            out.append(_line(c, today, f"knows {gen[0]} ({role})", "same organisation", 0.45))
    return _best(out)


def _words(s: str) -> set[str]:
    return {w for w in re.findall(r"[a-z&]+", s.lower()) if len(w) >= 4 or w in {"m&a", "epc", "irdai"}}


def _same_topic(domain: str, wanted: str) -> bool:
    """Whole-word overlap ('insurance regulation' ~ 'regulation'), never substrings ('pli' !~ 'compliance')."""
    return domain == wanted or bool(_words(domain) & _words(wanted))


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
    return sorted(best.values(), key=lambda x: -x["_score"])[:k]


def annotate(cards: list[dict], today: date, contacts: list[Contact] | None = None, edges: list[dict] | None = None) -> None:
    """Attach the best network line(s) to each Edition card, in place."""
    if contacts is None:
        contacts, edges = load()
    for card in cards:
        text = " ".join(filter(None, [card.get("headline"), card.get("nse_subject"), card.get("company")]))
        lines = for_company(card["symbol"], contacts, today, kind=card["kind"], text=text)
        card["network"] = second_degree(lines, contacts, edges or [], today)
