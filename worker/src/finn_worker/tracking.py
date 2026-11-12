"""Promises tracked against filed numbers while their year is still running (review 1.5).

A full-year target can't be settled mid-year, so the ledger status stays 'too early'. But the latest
quarter filed with the exchange already says whether the company is on track: "EBITDA margin FY27
22-23% -> Q2 FY27 filed: 15.6%, below". Only company-level revenue growth, profit growth and EBITDA
margin are compared, on the same fiscal year, with figures from a results table that passed its checks.
"""
from __future__ import annotations

import re

from .pull import _period_fy, _scope_words

_KINDS = [
    ("ebitda_margin", re.compile(r"ebitda margin|operating margin|^margins?$|ebitda margins?", re.I), "EBITDA margin"),
    # named explicitly: a bare "growth" may be AUM or volume growth, "fee income" is not revenue
    ("revenue_growth", re.compile(r"^(consolidated |company |overall |total )?(revenue|sales|top[- ]?line) growth$", re.I), "revenue growth YoY"),
    ("profit_growth", re.compile(r"^(consolidated |company |overall |net )?(pat|profit|net profit|earnings) growth$", re.I), "profit growth YoY"),
]


def _fy_of(period_end: str) -> int:
    y, m = int(period_end[:4]), int(period_end[5:7])
    return (y + 1 if m >= 4 else y) % 100


def _quarter(period_end: str) -> int:
    return {6: 1, 9: 2, 12: 3, 3: 4}.get(int(period_end[5:7]), 0)


def track(row: dict, results: dict | None) -> dict | None:
    t = row.get("target") or {}
    cmp_ = (results or {}).get("comparatives")
    if not cmp_ or cmp_.get("is_bank") or "%" not in str(t.get("unit") or ""):
        return None
    if _scope_words(t.get("scope")):
        return None                                   # a segment's target is not the company's figure
    basis = f"{t.get('basis') or ''} {t.get('scope') or ''} {row.get('metric') or ''}".lower()
    nature = (results.get("nature") or "").lower()
    for b in ("standalone", "consolidated"):
        if b in basis and b != nature:
            return None                               # a standalone target vs consolidated results (audit F07)
    if re.search(r"constant currency|\bcc\b|organic|like[- ]for[- ]like|ex[- ]", basis):
        return None                                   # filed results are reported currency, all-in
    kind = next(((k, label) for k, rx, label in _KINDS if rx.search(row.get("metric") or "")), None)
    if not kind:
        return None
    pe = results["period_end"]
    fy = _period_fy(t.get("period"))
    if fy is None or fy != _fy_of(pe) or re.search(r"H[12]|Q[1-4]", str(t.get("period"))):
        return None                                   # only a full-year target for the year the quarter is in
    if kind[0] == "ebitda_margin":
        v = (cmp_.get("current") or {}).get("ebitda_margin_pct")
    elif kind[0] == "revenue_growth":
        v = (cmp_.get("yoy") or {}).get("revenue")
    else:
        v = (cmp_.get("yoy") or {}).get("pat")
    if v is None:
        return None
    lo, hi = t.get("low"), t.get("high")
    verdict = None
    if lo is not None and v < lo:
        verdict = "below"
    elif hi is not None and v > hi:
        verdict = "above"
    elif lo is not None or hi is not None:
        verdict = "on track"
    # a quarter below a full-year range is an observation, not "off track": years are seasonal
    return {"label": f"Q{_quarter(pe)} FY{_fy_of(pe)} filed ({results['nature'].lower()}), latest quarter", "metric": kind[1],
            "value": round(v, 1), "verdict": verdict, "source": results.get("source_url")}


def apply(ledger: dict, results: dict | None) -> int:
    n = 0
    for row in ledger.get("rows", []):
        tr = track(row, results)
        if tr:
            row["tracking"] = tr
            if row.get("evidence_source") == "not checkable":
                row["evidence_source"] = "filed"
            n += 1
        else:
            row.pop("tracking", None)
    return n
