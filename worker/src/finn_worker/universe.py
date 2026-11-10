"""The NSE equity universe: symbol <-> company name <-> ISIN.

RSS items carry the company *name*, not the symbol, so names are normalised
and looked up here. Source: NSE's published EQUITY_L.csv (a download file).
"""
from __future__ import annotations

import csv
import html
import io
import re
from dataclasses import dataclass
from functools import lru_cache

from . import fetch

EQUITY_LIST_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv"

_SUFFIXES = re.compile(r"\b(limited|ltd|the|company|co|corporation|corp|india|of)\b")


def normalise_name(name: str) -> str:
    """'Mahindra &amp; Mahindra Financial Services Limited' -> 'mahindramahindrafinancialservices'."""
    s = html.unescape(name).lower().replace("&", " and ")
    s = _SUFFIXES.sub(" ", s)
    return re.sub(r"[^a-z0-9]", "", s.replace(" and ", " "))


@dataclass(frozen=True)
class Company:
    symbol: str
    name: str
    isin: str
    series: str


@lru_cache(maxsize=1)
def load() -> dict[str, Company]:
    """Symbol -> Company. Refreshed at most daily."""
    raw = fetch.get(EQUITY_LIST_URL, max_age=24 * 3600).decode("utf-8", errors="replace")
    rows = csv.reader(io.StringIO(raw))
    next(rows)  # header
    out: dict[str, Company] = {}
    for r in rows:
        if len(r) < 7:
            continue
        sym, name, series, isin = r[0].strip(), r[1].strip(), r[2].strip(), r[6].strip()
        out[sym] = Company(sym, name, isin, series)
    return out


@lru_cache(maxsize=1)
def _by_name() -> dict[str, str]:
    return {normalise_name(c.name): c.symbol for c in load().values()}


def symbol_for_name(name: str) -> str | None:
    """Exact match on the normalised name; None if the company isn't an NSE equity."""
    return _by_name().get(normalise_name(name))


def by_isin() -> dict[str, str]:
    return {c.isin: c.symbol for c in load().values()}
