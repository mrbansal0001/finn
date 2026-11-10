"""Filing PDFs: download (cached), per-page text, scan detection, page images.

E14 showed some results PDFs are scans whose OCR text layer is garbage
("t,086.88" for 1,086.88). Those pages are sent to the model as images.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

import pymupdf
from rapidfuzz import fuzz

from . import fetch


@dataclass
class Page:
    number: int        # 1-indexed PDF page
    text: str
    clean: bool        # text layer trustworthy enough to send as text


@lru_cache(maxsize=64)
def pages(url: str) -> tuple[Page, ...]:
    doc = pymupdf.open(stream=fetch.get(url), filetype="pdf")
    return tuple(Page(i + 1, p.get_text(), _is_clean(p.get_text())) for i, p in enumerate(doc))


def page_png(url: str, number: int, dpi: int = 130) -> bytes:
    doc = pymupdf.open(stream=fetch.get(url), filetype="pdf")
    return doc[number - 1].get_pixmap(dpi=dpi).tobytes("png")


_WORDS = {"revenue", "operations", "income", "expenses", "profit", "tax", "total", "finance",
          "depreciation", "quarter", "ended", "the", "and", "for", "company", "limited", "board"}


def _is_clean(text: str) -> bool:
    """Heuristic: a clean layer has real words, and numbers that look like numbers."""
    tokens = re.findall(r"[A-Za-z]{3,}", text)
    if len(tokens) < 30:
        return False
    known = sum(1 for t in tokens if t.lower() in _WORDS)
    garbled_nums = len(re.findall(r"\b[tlI|][,.]?\d{2,}", text))  # 't,086.88' style OCR damage
    clean_nums = len(re.findall(r"\d{1,3}(?:,\d{2,3})+\.\d{2}", text))
    return known >= 8 and garbled_nums <= max(3, clean_nums // 5)


# Labels of a P&L statement. Matched fuzzily so OCR damage ("Frnance costs") still scores.
_PNL_LABELS = ["revenue from operations", "other income", "total income", "finance costs",
               "depreciation and amortisation", "profit before tax", "tax expense", "total expenses",
               "interest earned", "interest expended", "operating profit", "provisions"]


def _pnl_score(p: Page, prefer: str) -> float:
    low = re.sub(r"\s+", " ", p.text.lower())
    score = float(sum(1 for lab in _PNL_LABELS if fuzz.partial_ratio(lab, low) >= 85))
    if re.search(r"qu[a-z]{1,3}[nr]?ter (and (half|nine months?) year )?ended|three months", low):
        score += 2
    if re.search(r"financial results", low[:400]):
        score += 2
    if prefer in low[:600]:
        score += 3
    if re.search(r"cash\s*flow|balance sheet|assets and liabilities", low[:400]):
        score -= 4
    if re.search(r"^\W*(notes?|independent auditor|limited review)", low[:200]) or "notes on" in low[:200]:
        score -= 4
    # a P&L table is mostly numbers
    score += min(4.0, len(re.findall(r"\d[\d,]*\.\d{2}", low)) / 30)
    return score


def pnl_candidates(url: str, prefer: str = "consolidated", k: int = 3) -> list[Page]:
    """Ranked pages likely to hold the quarterly P&L (consolidated preferred, D-021).

    Text pages are scored on statement labels (fuzzy, so OCR damage still counts)
    and number density. Pages with no text layer at all are pure images (E18:
    DEEPAKNTR, SHAILY); they are offered as candidates for the vision model, whose
    output is then accepted only if the table's arithmetic checks out."""
    ps = pages(url)
    scored = sorted(((_pnl_score(p, prefer), p) for p in ps if p.text.strip()), key=lambda x: -x[0])
    good = [p for s, p in scored if s >= 6][:k]
    if good:
        return good
    image_only = [p for p in ps if not p.text.strip()]
    return image_only[: k + 2]


def find_pnl_page(url: str, prefer: str = "consolidated") -> Page | None:
    c = pnl_candidates(url, prefer, k=1)
    return c[0] if c else None
