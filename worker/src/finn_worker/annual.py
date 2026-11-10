"""Annual reports: find the latest AR and locate its MD&A (research 02 §6).

ARs run 130-460 pages; only the Management Discussion & Analysis section goes to the
model (10-30 pages). The heading also appears in the table of contents and in running
headers, so a page counts as the section start only if the heading sits at the top of
a text-heavy page that isn't a contents page.
"""
from __future__ import annotations

import html
import re

from . import docs, fetch

SCREENER = "https://www.screener.in/company/{symbol}/"

_MDNA = re.compile(r"management(['’]s)?\s+discussion\s+(and|&)\s+analysis", re.I)
_NEXT = re.compile(r"(board['’]?s|directors['’]?)\s+report|report\s+on\s+corporate\s+governance|corporate\s+governance\s+report|"
                   r"business\s+responsibility|independent\s+auditor|standalone\s+financial\s+statements|"
                   r"notice\s+of\s+(the\s+)?annual\s+general", re.I)


def latest(symbol: str) -> tuple[int, str] | None:
    page = fetch.get(SCREENER.format(symbol=symbol.upper()), max_age=7 * 24 * 3600).decode("utf-8", "replace")
    i = page.find("documents annual-reports")
    seg = page[i: page.find("</ul>", i)] if i > 0 else ""
    found = re.findall(r'href="([^"]+)"[^>]*>\s*(?:Annual Report|Financial Year)\s+(\d{4})', seg, flags=re.S)
    if not found:
        return None
    url, year = max(found, key=lambda x: int(x[1]))
    return int(year), html.unescape(url)


def _is_contents(text: str) -> bool:
    # contents pages: many short lines ending in page numbers
    lines = [l for l in text.splitlines() if l.strip()]
    numbered = sum(1 for l in lines if re.search(r"\b\d{1,3}\s*$", l))
    return len(lines) > 8 and numbered / len(lines) > 0.35


def _toc_candidates(ps) -> list[int]:
    """Printed page numbers next to the MD&A entry on a contents page. Layouts differ:
    'Name 150' (Titan, SBI) and '130 Name' (Deepak Nitrite) -- so return both neighbours."""
    for p in ps[:60]:
        flat = re.sub(r"\s+", " ", p.text)
        m = _MDNA.search(flat)
        if not m or not ("content" in flat.lower() or _is_contents(p.text) or len(re.findall(r"\b\d{2,3}\b", flat)) > 15):
            continue
        after = re.match(r"\D{0,15}(\d{1,3})\b", flat[m.end():])
        before = re.search(r"\b(\d{1,3})\D{0,15}$", flat[max(0, m.start() - 20):m.start()])
        return [int(x.group(1)) for x in (after, before) if x]
    return []


def _heading_line(text: str) -> bool:
    """The MD&A title as a heading of its own (possibly wrapped over two lines), not inside a sentence."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for i, l in enumerate(lines):
        for cand in (l, f"{l} {lines[i + 1]}" if i + 1 < len(lines) else l):
            if _MDNA.search(cand) and len(cand) <= 75:
                return True
    return False


def mdna_pages(url: str, max_pages: int = 40) -> list[docs.Page]:
    ps = docs.pages(url)
    start = None
    # 1. heading at the top of a text page (most reports)
    for p in ps:
        if _MDNA.search(p.text[:400]) and len(p.text) > 1200 and not _is_contents(p.text):
            start = p.number
            break
    # 2. contents-guided: printed page + small offset, title as a heading line (side titles, mid-page titles)
    end_page = None
    cands = [] if start else _toc_candidates(ps)
    for idx, printed in enumerate(cands):
        for k in range(0, 9):
            n = printed + k
            if n <= len(ps) and len(ps[n - 1].text) > 1200 and _heading_line(ps[n - 1].text):
                start = n
                # '130 Name 165' layout: matched the number before the title, so the one after it
                # is where the next section starts (same printed-to-PDF offset)
                if idx == 1 and cands[0] > printed:
                    end_page = cands[0] + k - 1
                break
        if start:
            break
    if start is None:
        return []
    out = []
    for p in ps[start - 1:]:
        if end_page and p.number > end_page:
            break
        # running headers often list every section; only trust a section heading after a few pages
        if len(out) >= 3 and _NEXT.search(p.text[:300]) and not _MDNA.search(p.text):
            break
        out.append(p)
        if len(out) >= max_pages:
            break
    return out


# ------------------------------------------------------------------ business snapshot (model; needs a key)

SNAPSHOT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "what_they_do": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "text": {"type": "STRING", "description": "one plain sentence, <= 30 words, facts only"},
            "quote": {"type": "STRING", "description": "verbatim source sentence"},
            "page": {"type": "INTEGER"}}, "required": ["text", "quote", "page"]}},
        "segments": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "name": {"type": "STRING"},
            "share_of_revenue_pct": {"type": "NUMBER", "nullable": True},
            "quote": {"type": "STRING"}, "page": {"type": "INTEGER"}}, "required": ["name", "quote", "page"]}},
    },
    "required": ["what_they_do", "segments"],
}
SNAPSHOT_SYSTEM = ("From this annual report's Management Discussion & Analysis, state what the company does and its "
                   "business segments. 3-5 sentences, facts only, no praise or adjectives, no outside knowledge. "
                   "Every sentence needs a verbatim supporting quote and the [[page N]] it sits under.")


def snapshot(symbol: str, max_chars: int = 60_000) -> dict | None:
    """Cited business snapshot from the latest AR's MD&A. Unverifiable sentences are dropped (D-016)."""
    from . import llm, pull
    ar = latest(symbol)
    if not ar:
        return None
    year, url = ar
    pages = mdna_pages(url)
    if not pages:
        return None
    body, used = "", {}
    for p in pages:
        if len(body) > max_chars:
            break
        body += f"[[page {p.number}]]\n{p.text}\n"
        used[p.number] = p.text
    out = llm.structured("ar_snapshot", SNAPSHOT_SYSTEM, [llm.Part(text=body)], SNAPSHOT_SCHEMA, tier="fast")
    keep = lambda xs: [dict(x, page=pg) for x in xs if (pg := pull.verify(x, used)) is not None]
    return {"year": year, "url": url, "pages": [pages[0].number, pages[-1].number],
            "what_they_do": keep(out.get("what_they_do", [])), "segments": keep(out.get("segments", []))}
