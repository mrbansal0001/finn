"""Trajectory: five years of revenue and profit from the annual report's own multi-year table (brief-check
plan, part 7; the brief's Pull menu: "Trajectory").

Most Indian annual reports print a five- or ten-year summary ("Financial highlights", "Ten-year
performance"). FINN finds that page by rule, has a model read the table on that one page, and keeps a
number only if it appears on the page exactly as printed. A year whose numbers fail that check is
dropped; a company with fewer than four checked years gets no trajectory. Nothing is computed from
quarterly data, and nothing is filled in.

    uv run python -m finn_worker.trajectory            # every company with an annual report, if not built
    uv run python -m finn_worker.trajectory TITAN BEL  # rebuild these
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

from . import docs

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "trajectory"

HEAD = re.compile(r"(five|ten|5|10)[\s-]*years?|financial highlights|at a glance|key (financial )?(indicators|highlights|metrics)"
                  r"|decade|performance (trend|overview)|financial performance", re.I)
YEAR = re.compile(r"\b(?:FY\s?'?\d{2}(?:-\d{2})?|20\d{2}\s?-\s?\d{2}|FY\s?20\d{2})\b")
REV = re.compile(r"revenue|total income|turnover|net sales|gross sales|income from operations", re.I)
PAT = re.compile(r"profit after tax|\bPAT\b|net profit|profit for the (year|period)", re.I)

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "found": {"type": "BOOLEAN", "description": "true only if this page has a table of several years"},
        "unit": {"type": "STRING", "description": "the unit as printed, e.g. '₹ crore', '₹ million', '₹ lakh'"},
        "basis": {"type": "STRING", "enum": ["consolidated", "standalone", "not stated"]},
        "revenue_label": {"type": "STRING", "description": "the row label used for revenue, as printed"},
        "profit_label": {"type": "STRING", "description": "the row label used for profit after tax, as printed"},
        "years": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
            "fy_end": {"type": "INTEGER", "description": "calendar year the fiscal year ends, e.g. 2026 for FY 2025-26"},
            "revenue": {"type": "STRING", "description": "exactly as printed, or empty"},
            "profit": {"type": "STRING", "description": "exactly as printed, or empty"}},
            "required": ["fy_end", "revenue", "profit"]}},
    },
    "required": ["found", "unit", "basis", "revenue_label", "profit_label", "years"],
}
SYSTEM = ("This is one page of an Indian company's annual report. If it has a multi-year summary table, read the "
          "revenue row (revenue from operations, or total income / net sales if that is the row) and the profit "
          "after tax row for every year shown. Copy each number exactly as printed, with its commas and decimals; "
          "leave it empty if the row or year isn't there. Never compute, convert or estimate. If there is no "
          "multi-year table on this page, return found=false and no years.")


def candidates(pages: list, n: int = 2) -> list:
    """Pages that look like a multi-year summary: a heading, four or more fiscal-year labels, both rows."""
    scored = []
    for p in pages[:120]:
        t = p.text
        ys = set(YEAR.findall(t))
        if len(ys) >= 4 and REV.search(t) and PAT.search(t) and HEAD.search(t):
            scored.append((len(ys), len(re.findall(r"\d[\d,]{3,}(?:\.\d+)?", t)), p))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [p for *_, p in scored[:n]]


def _num(s: str) -> float | None:
    s = re.sub(r"[*#^†‡@]+$", "", (s or "").strip()).replace(",", "")   # "41,859*": a footnote mark, not a digit
    neg = s.startswith("(") and s.endswith(")")
    s = s.strip("()")
    try:
        v = float(s)
    except ValueError:
        return None
    return -v if neg else v


def _on_page(raw: str, text: str) -> bool:
    """The number as printed is on the page (commas or not): the check that keeps a model from inventing one."""
    raw = re.sub(r"[*#^†‡@]+$", "", (raw or "").strip()).strip("()")
    if not raw or not re.search(r"\d", raw):
        return False
    # a whole number token, never part of a longer one ("123" is not in "91234"; full review F12)
    tokens = set(re.findall(r"\d[\d.]*", re.sub(r"(\d),(?=\d)", r"\1", text)))
    return raw.replace(",", "") in tokens


def to_crore(unit: str) -> float | None:
    """The factor from the printed unit to ₹ crore; None if the unit can't be read (then no trajectory).
    PDFs often mangle the rupee sign ("v crore", "H in Crores", "` Mn"), so only the word decides."""
    u = unit.lower()
    # only rupee amounts convert: a dollar or euro table is not rupees at another scale (full review F12)
    if re.search(r"usd|us\$|\$|dollar|eur|€|gbp|£|jpy|¥", u):
        return None
    if re.search(r"crore|\bcr\b", u):
        return 1.0
    if re.search(r"lakh|lac", u):
        return 0.01
    if re.search(r"million|\bmn\b", u):
        return 0.1
    if re.search(r"billion|\bbn\b", u):
        return 100.0
    return None


def _outliers(vals: list[float | None]) -> list[float | None]:
    """A value over four times the median of the rest of its own series is a number read from the wrong row
    (it passed the on-page check because it is on the page). Shown as a gap, never corrected."""
    out = []
    for i, v in enumerate(vals):
        rest = sorted(abs(x) for j, x in enumerate(vals) if j != i and x is not None)
        med = rest[len(rest) // 2] if rest else None
        out.append(None if v is not None and med and abs(v) > 4 * med else v)
    return out


def build(symbol: str) -> dict | None:
    from . import llm
    p = ROOT / "data" / "ledgers" / f"{symbol}.json"
    if not p.exists():
        return None
    snap = (json.loads(p.read_text()).get("snapshot") or {})
    if not snap.get("url"):
        return None
    pages = docs.pages(snap["url"])
    for page in candidates(pages, 4):
        out = llm.structured("ar_trajectory", SYSTEM, [llm.Part(text=f"[[page {page.number}]]\n{page.text}")], SCHEMA, tier="fast")
        if not out.get("found"):
            continue
        years = []
        for y in out.get("years", []):
            rev_ok, pat_ok = _on_page(y.get("revenue"), page.text), _on_page(y.get("profit"), page.text)
            rev, pat = _num(y.get("revenue")) if rev_ok else None, _num(y.get("profit")) if pat_ok else None
            if rev is not None and rev > 0 and 2000 < int(y["fy_end"]) <= snap.get("year", 2100):
                years.append({"fy": int(y["fy_end"]), "revenue": rev, "pat": pat})
        years = sorted({y["fy"]: y for y in years}.values(), key=lambda y: y["fy"])[-5:]
        # a run of consecutive years, newest = the report's own year, at least four of them
        factor = to_crore(out.get("unit", ""))
        if factor is None:
            continue
        for key in ("revenue", "pat"):
            for y, v in zip(years, _outliers([y[key] for y in years])):
                y[key] = v
        years = [y for y in years if y["revenue"] is not None]
        if len(years) >= 4 and years[-1]["fy"] == snap.get("year") and all(b["fy"] - a["fy"] == 1 for a, b in zip(years, years[1:])):
            label = lambda x, d: re.sub(r"\s*\(.*?\)\s*", " ", x or d).strip() or d
            return {"symbol": symbol, "url": snap["url"], "page": page.number, "report_year": snap.get("year"),
                    "unit_printed": out.get("unit", "").strip(), "to_crore": factor, "basis": out.get("basis"),
                    "revenue_label": label(out.get("revenue_label"), "Revenue"),
                    "profit_label": label(out.get("profit_label"), "Profit after tax"),
                    # as printed, and in ₹ crore for display
                    "years": [{**y, "revenue_cr": round(y["revenue"] * factor, 1),
                               "pat_cr": None if y["pat"] is None else round(y["pat"] * factor, 1)} for y in years],
                    "built": datetime.now().isoformat(timespec="seconds")}
    return None


def run(symbols: list[str] | None = None) -> str:
    OUT.mkdir(parents=True, exist_ok=True)
    todo = symbols or [p.stem for p in sorted((ROOT / "data" / "ledgers").glob("*.json")) if not (OUT / p.name).exists()]
    got, none = [], []
    for s in todo:
        try:
            t = build(s)
        except Exception as e:      # one unreadable report never stops the rest
            none.append(f"{s}({type(e).__name__})")
            continue
        if t:
            (OUT / f"{s}.json").write_text(json.dumps(t, ensure_ascii=False, indent=1))
            got.append(s)
        else:
            none.append(s)
            (OUT / f"{s}.json").write_text(json.dumps({"symbol": s, "none": True, "built": datetime.now().isoformat(timespec="seconds")}))
    return f"trajectory for {len(got)}: {' '.join(got)}; none for {len(none)}: {' '.join(none)}"


if __name__ == "__main__":
    print(run(sys.argv[1:] or None))
