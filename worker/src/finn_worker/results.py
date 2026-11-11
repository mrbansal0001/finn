"""Quarterly results: model reads the table, code checks and computes everything.

Flow (D-010, D-021, D-022):
1. docs.pnl_candidates() finds the P&L page (text or image).
2. The model transcribes the 6-column table into RESULTS_SCHEMA -- numbers as
   printed, in the statement's own unit. It does no arithmetic.
3. check() validates: internal arithmetic always; exact match against the
   Integrated Filing XBRL on the 1:1 lines when the XBRL is available.
4. card_numbers() computes QoQ/YoY, margins in basis points, exceptional-adjusted
   PBT, EBITDA -- all in code.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from . import docs, llm
from .xbrl import QuarterResult

UNIT_TO_RUPEES = {"rupees": 1, "thousands": 1e3, "lakhs": 1e5, "millions": 1e6, "crores": 1e7}

# The model copies the table as printed (row label + one number per column); code maps labels to
# fields. A wide named-field schema made the light model fill only 2-3 fields (E25).
RESULTS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "found": {"type": "BOOLEAN", "description": "false if this page holds no P&L statement"},
        "nature": {"type": "STRING", "enum": ["Consolidated", "Standalone"]},
        "unit": {"type": "STRING", "enum": list(UNIT_TO_RUPEES)},
        "columns": {"type": "ARRAY", "description": "column headers left to right", "items": {
            "type": "OBJECT",
            "properties": {
                "label": {"type": "STRING", "description": "header as printed, e.g. '30.09.2026 Unaudited'"},
                "period_end": {"type": "STRING", "description": "YYYY-MM-DD"},
                "months": {"type": "INTEGER", "description": "3 quarter, 6 half year, 9, 12 year"}},
            "required": ["label", "period_end", "months"]}},
        "rows": {"type": "ARRAY", "description": "every line of the statement, top to bottom", "items": {
            "type": "OBJECT",
            "properties": {
                "label": {"type": "STRING", "description": "line item exactly as printed"},
                "values": {"type": "ARRAY", "items": {"type": "NUMBER", "nullable": True},
                           "description": "one per column, in column order; null where blank"}},
            "required": ["label", "values"]}},
    },
    "required": ["found", "nature", "unit", "columns", "rows"],
}

SYSTEM = (
    "You copy an Indian listed company's quarterly results statement into JSON, exactly as printed. "
    "List the column headers left to right, then every line item top to bottom with its numbers, one per "
    "column in the same order. Read the unit line (e.g. 'Rs in Lakhs', '₹ in crore'). Indian digit grouping: "
    "'1,03,226.16' is 103226.16. Brackets mean negative. Never compute, never skip a line, never estimate: "
    "blank cells are null. If the page shows standalone and consolidated side by side, copy only the "
    "consolidated block."
)

# line-item label -> field (first match wins; order matters: 'total income' before 'income')
_FIELDS: list[tuple[str, str]] = [
    ("revenue_total", r"^total revenue from operations|^revenue from operations \(net\)|^total income from operations"),
    ("revenue", r"^(i\.?\s*)?(revenue|income) from operations|^net sales|^sales"),
    ("rev_part", r"^-?\s*sale of (products|services|goods)|^-?\s*other operating revenue"),
    ("other_income", r"^(ii\.?\s*)?other income"),
    ("total_income", r"^total income"),
    ("interest_earned", r"interest earned"),
    ("interest_expended", r"interest expended"),
    ("finance_costs", r"finance cost"),
    ("depreciation", r"depreciation"),
    ("total_expenses", r"^total expense"),
    ("operating_profit", r"operating profit.*before provisions|^operating profit"),
    ("provisions", r"^provisions \(other than tax|^provisions and contingencies|^provisions\b(?!.*tax)"),
    ("exceptional", r"^exceptional item"),
    ("jv_share", r"share of (net )?(profit|loss|\(loss\)).*(associate|joint venture)"),
    ("pbt", r"profit.{0,30}before tax|^profit\s*/\s*\(loss\) before tax|from ordinary activities before tax"),
    ("tax", r"^(total )?tax expense|^tax expense|^total tax"),
    ("pat", r"^(net )?profit.{0,25}for the (period|quarter|year)|^profit after tax|^net profit|from ordinary activities after tax"),
    ("gnpa_pct", r"%\s*of gross npa|gross npa.*%|% of gross non"),
    ("nnpa_pct", r"%\s*of net npa|net npa.*%|% of net non"),
]


def _norm_label(s: str) -> str:
    """'1 Income a) Revenue from operations' -> 'revenue from operations';
    '(Loss) / profit for the period (7-8)' -> 'profit for the period (7-8)'."""
    s = re.sub(r"\s+", " ", s).strip().lower()
    s = re.sub(r"\(\s*loss\s*\)\s*/?\s*|/\s*\(\s*loss\s*\)|\bloss\s*/\s*", "", s)       # (loss) variants
    for _ in range(3):  # numbering, sub-lettering and section words, possibly stacked
        s = re.sub(r"^(\d{1,2}|[ivxlcm]{1,5})[.)]?\s+|^\(?[a-z0-9]{1,3}\)\s*|^[a-z][.)]\s+|^(income|expenses?)\s*:?\s+(?=[a-z]\))", "", s)
    return s.strip(" :-")


def map_rows(table: dict) -> dict:
    """Row-transcribed table -> {nature, unit, is_bank, columns:[{label, period_end, months, field: value}]}."""
    cols = [dict(c) for c in table.get("columns", [])]
    seen: set[str] = set()
    for row in table.get("rows", []):
        label = _norm_label(row.get("label", ""))
        field = next((f for f, rx in _FIELDS if re.search(rx, label)), None)
        if field == "rev_part":           # revenue printed only as sub-lines: sum them
            for c, v in zip(cols, row.get("values", [])):
                if v is not None:
                    c["rev_parts"] = c.get("rev_parts", 0.0) + v
            seen.add("rev_part")
            continue
        if not field or field in seen:
            continue                      # keep the first occurrence (statements repeat e.g. 'profit' lines)
        seen.add(field)
        for c, v in zip(cols, row.get("values", [])):
            c[field] = v
    for c in cols:   # a printed 'total revenue from operations' beats its sub-line
        if c.get("revenue_total") is not None:
            c["revenue"] = c.pop("revenue_total")
        else:
            c.pop("revenue_total", None)
    if "revenue_total" in seen:
        seen.add("revenue")
    is_bank = "interest_earned" in seen and "revenue" not in seen
    for c in cols:
        parts = c.pop("rev_parts", None)
        if c.get("revenue") is None and parts is not None:
            c["revenue"] = parts          # e.g. Titan: sale of products + other operating revenue
        # any other income line inside total income (e.g. a fair-value gain on a put-option liability)
        # is non-operating: fold it into other income so it stays out of revenue and EBITDA (E25)
        if None not in (c.get("revenue"), c.get("total_income")):
            extra = c["total_income"] - c["revenue"] - (c.get("other_income") or 0)
            if extra > max(1.0, 0.002 * abs(c["total_income"])):
                c["other_income"] = (c.get("other_income") or 0) + extra
                c["non_operating_extra"] = extra
    return {"found": table.get("found", True), "nature": table.get("nature", "Consolidated"),
            "unit": table.get("unit", "crores"), "is_bank": is_bank, "columns": cols}


def extract(url: str) -> tuple[dict, int] | None:
    """Model transcription of the best P&L page; returns (table, page_number)."""
    for page in docs.pnl_candidates(url):
        parts = ([llm.Part(text=page.text)] if page.clean
                 else [llm.Part(png=docs.page_png(url, page.number))])
        # The light model varies run to run; calls are free, so try text then the rendered image,
        # and keep the first transcription that passes every check (E25). Never show one that fails.
        attempts = ([parts] if page.clean else []) + [[llm.Part(png=docs.page_png(url, page.number))]] * 2
        best = None
        for att in attempts:
            out = llm.structured("results_table", SYSTEM, att, RESULTS_SCHEMA, tier="fast")
            if not (out.get("found") and out.get("columns") and out.get("rows")):
                continue
            table = map_rows(out)
            if check(table).ok:
                return table, page.number
            best = best or table
        if best is not None:
            return best, page.number
    return None


# ------------------------------------------------------------------ checks

@dataclass
class Check:
    ok: bool
    status: str           # 'xbrl_match' | 'arithmetic_ok' | 'failed: ...'
    notes: list[str]


def _close(a, b, tol):
    return a is not None and b is not None and abs(a - b) <= tol


def check(table: dict, xbrl: QuarterResult | None = None) -> Check:
    cols = table["columns"]
    if not cols:
        return Check(False, "failed: no columns", [])
    notes: list[str] = []
    core = ("interest_earned", "interest_expended", "pat") if table.get("is_bank") else ("revenue", "pbt", "pat")
    missing = [k for k in core if cols[0].get(k) is None]
    if missing:
        return Check(False, f"failed: missing {', '.join(missing)}", [])   # a table without its core lines is not shown
    tol = 0.02 * 2  # rounding: two printed decimals on each side
    for c in cols:
        if table.get("is_bank"):
            continue
        if None not in (c.get("revenue"), c.get("other_income"), c.get("total_income")):
            if not _close(c["revenue"] + c["other_income"], c["total_income"], tol + 0.011 * abs(c["total_income"]) / 1000):
                notes.append(f"{c['label']}: revenue+other income != total income")
        if None not in (c.get("pbt"), c.get("tax"), c.get("pat")):
            # PAT may also include JV share after tax (XBRL ordering, E13)
            jv = c.get("jv_share") or 0.0
            if not (_close(c["pbt"] - c["tax"], c["pat"], 1.0) or _close(c["pbt"] - c["tax"] + jv, c["pat"], 1.0)):
                notes.append(f"{c['label']}: PBT - tax != PAT")
    if notes:
        return Check(False, "failed: " + "; ".join(notes), notes)
    if xbrl and xbrl.values:
        scale = UNIT_TO_RUPEES[table["unit"]]
        cur = cols[0]
        for key in ("revenue", "other_income", "finance_costs", "depreciation", "pat"):
            x, t = xbrl.values.get(key), cur.get(key)
            if x is None or t is None:
                continue
            if abs(t * scale - x) > scale * 0.011:  # one printed paisa-digit of slack
                return Check(False, f"failed: {key} {t * scale:.0f} vs XBRL {x:.0f}", [])
        return Check(True, "xbrl_match", ["current column equals Integrated Filing XBRL on 1:1 lines"])
    return Check(True, "arithmetic_ok", ["internal totals reconcile; no XBRL available to cross-check"])


# ------------------------------------------------------------------ numbers for the card

def _pick(cols: list[dict], months: int, offset_months: int) -> dict | None:
    """Column ending `offset_months` before the current column, with the given length."""
    from datetime import date
    cur = date.fromisoformat(cols[0]["period_end"])
    for c in cols[1:]:
        try:
            d = date.fromisoformat(c["period_end"])
        except (ValueError, TypeError):
            continue
        months_back = (cur.year - d.year) * 12 + (cur.month - d.month)
        if c.get("months") == months and months_back == offset_months:
            return c
    return None


def _growth(cur, prev):
    if cur is None or prev in (None, 0):
        return None
    if (cur < 0) != (prev < 0):
        return None   # a swing between profit and loss isn't a percentage; the copy says it in words
    return round((cur / prev - 1) * 100 * (1 if prev > 0 else -1), 1)


def card_numbers(table: dict) -> dict:
    """Everything the results card shows, computed in code (rupee crore + % + bp)."""
    cols = table["columns"]
    scale = UNIT_TO_RUPEES[table["unit"]] / 1e7  # -> crore
    cur = cols[0]
    months = cur.get("months") or 3
    prev_q = _pick(cols, months, months) if months == 3 else None
    prev_y = _pick(cols, months, 12)

    def metrics(c: dict | None) -> dict | None:
        if c is None:
            return None
        g = lambda k: (c.get(k) * scale) if c.get(k) is not None else None
        if table.get("is_bank"):
            nii = (c["interest_earned"] - c["interest_expended"]) * scale \
                if c.get("interest_earned") is not None and c.get("interest_expended") is not None else None
            return {"nii": nii, "ppop": g("operating_profit"), "provisions": g("provisions"),
                    "pat": g("pat"), "gnpa_pct": c.get("gnpa_pct"), "nnpa_pct": c.get("nnpa_pct")}
        rev, pbt = g("revenue"), g("pbt")
        exc = g("exceptional") or 0.0
        ebitda = None
        if None not in (pbt, g("finance_costs"), g("depreciation"), g("other_income")):
            ebitda = (pbt - exc) + g("finance_costs") + g("depreciation") - g("other_income")
        return {"revenue": rev, "ebitda": ebitda, "pbt": pbt, "pbt_ex_exceptional": None if pbt is None else pbt - exc,
                "pat": g("pat"), "exceptional": exc or None, "non_operating_extra": g("non_operating_extra"),
                "ebitda_margin_pct": round(ebitda / rev * 100, 2) if ebitda is not None and rev else None}

    m_cur, m_q, m_y = metrics(cur), metrics(prev_q), metrics(prev_y)
    out = {"period_end": cur["period_end"], "months": months, "nature": table["nature"],
           "is_bank": table.get("is_bank", False), "current": m_cur, "qoq": {}, "yoy": {},
           "prev_y": m_y, "prev_q": m_q}
    for label, base in (("qoq", m_q), ("yoy", m_y)):
        if not base:
            continue
        for k, v in m_cur.items():
            if k.endswith("_pct"):
                if v is not None and base.get(k) is not None:
                    out[label][k.replace("_pct", "_bp")] = round((v - base[k]) * 100)
            elif k not in ("exceptional", "non_operating_extra"):
                out[label][k] = _growth(v, base.get(k))
    return out
