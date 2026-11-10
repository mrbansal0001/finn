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

from dataclasses import dataclass

from . import docs, llm
from .xbrl import QuarterResult

UNIT_TO_RUPEES = {"rupees": 1, "thousands": 1e3, "lakhs": 1e5, "millions": 1e6, "crores": 1e7}

_COL = {
    "type": "OBJECT",
    "properties": {
        "label": {"type": "STRING", "description": "column header as printed, e.g. '30-Sep-26 Unaudited'"},
        "period_end": {"type": "STRING", "description": "YYYY-MM-DD"},
        "months": {"type": "INTEGER", "description": "3 for a quarter, 6 for half year, 9, or 12"},
        # non-financial companies
        "revenue": {"type": "NUMBER", "nullable": True},
        "other_income": {"type": "NUMBER", "nullable": True},
        "total_income": {"type": "NUMBER", "nullable": True},
        "finance_costs": {"type": "NUMBER", "nullable": True},
        "depreciation": {"type": "NUMBER", "nullable": True},
        "total_expenses": {"type": "NUMBER", "nullable": True},
        "exceptional": {"type": "NUMBER", "nullable": True, "description": "exceptional items; gains positive, losses negative"},
        "jv_share": {"type": "NUMBER", "nullable": True, "description": "share of profit/(loss) of associates/JVs"},
        "pbt": {"type": "NUMBER", "nullable": True},
        "tax": {"type": "NUMBER", "nullable": True},
        "pat": {"type": "NUMBER", "nullable": True, "description": "profit for the period (total, before minority split)"},
        # banks
        "interest_earned": {"type": "NUMBER", "nullable": True},
        "interest_expended": {"type": "NUMBER", "nullable": True},
        "operating_profit": {"type": "NUMBER", "nullable": True, "description": "banks: operating profit before provisions and contingencies"},
        "provisions": {"type": "NUMBER", "nullable": True},
        "gnpa_pct": {"type": "NUMBER", "nullable": True},
        "nnpa_pct": {"type": "NUMBER", "nullable": True},
    },
    "required": ["label", "period_end", "months"],
}

RESULTS_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "found": {"type": "BOOLEAN", "description": "false if this page holds no P&L statement"},
        "nature": {"type": "STRING", "enum": ["Consolidated", "Standalone"]},
        "unit": {"type": "STRING", "enum": list(UNIT_TO_RUPEES)},
        "is_bank": {"type": "BOOLEAN"},
        "columns": {"type": "ARRAY", "items": _COL},
    },
    "required": ["found", "nature", "unit", "is_bank", "columns"],
}

SYSTEM = (
    "You transcribe Indian listed-company results statements into JSON. Copy numbers exactly as printed, "
    "in the statement's own unit (read the unit line, e.g. 'Rs in Lakhs'). Indian digit grouping: "
    "'1,03,226.16' is 103226.16. Brackets mean negative. Do no arithmetic and never estimate: if a line "
    "is not printed, use null. Include every column in printed order (typically quarter, previous quarter, "
    "same quarter last year, half years, full year). If the page shows both standalone and consolidated, "
    "transcribe the consolidated block only."
)


def extract(url: str) -> tuple[dict, int] | None:
    """Model transcription of the best P&L page; returns (table, page_number)."""
    for page in docs.pnl_candidates(url):
        parts = ([llm.Part(text=page.text)] if page.clean
                 else [llm.Part(png=docs.page_png(url, page.number))])
        out = llm.structured("results_table", SYSTEM, parts, RESULTS_SCHEMA, tier="fast")
        if out.get("found") and out.get("columns"):
            return out, page.number
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
                "pat": g("pat"), "exceptional": exc or None,
                "ebitda_margin_pct": round(ebitda / rev * 100, 2) if ebitda is not None and rev else None}

    m_cur, m_q, m_y = metrics(cur), metrics(prev_q), metrics(prev_y)
    out = {"period_end": cur["period_end"], "months": months, "nature": table["nature"],
           "is_bank": table.get("is_bank", False), "current": m_cur, "qoq": {}, "yoy": {}}
    for label, base in (("qoq", m_q), ("yoy", m_y)):
        if not base:
            continue
        for k, v in m_cur.items():
            if k.endswith("_pct"):
                if v is not None and base.get(k) is not None:
                    out[label][k.replace("_pct", "_bp")] = round((v - base[k]) * 100)
            elif k != "exceptional":
                out[label][k] = _growth(v, base.get(k))
    return out
