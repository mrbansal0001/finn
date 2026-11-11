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
    ("excise", r"^excise duty"),
    ("revenue_total", r"^total revenue from operations|^revenue from operations \(net\)|^total income from operations"),
    ("revenue", r"^(i\.?\s*)?(revenue|income) from operations|^net sales|^sales"),
    ("rev_part", r"^-?\s*sale of (products|services|goods)|^-?\s*other operating revenue"),
    ("other_income", r"^(ii\.?\s*)?other income"),
    ("total_income", r"^total income"),
    ("interest_earned", r"interest earned"),
    ("interest_expended", r"interest expended"),
    # not the finance cost of a financial-services arm (L&T prints both; E29)
    ("finance_costs", r"^finance costs?(?!.*(financial services|financing business|services business))"),
    ("depreciation", r"depreciation"),
    ("total_expenses", r"^total expense"),
    ("operating_profit", r"operating profit.*before provisions|^operating profit"),
    ("provisions", r"^provisions \(other than tax|^provisions and contingencies|^provisions\b(?!.*tax)"),
    ("exceptional", r"^((add|less)\s*(/\s*\(?(add|less)\)?)?\s*:?\s*)?exceptional (items?|gains?|income|expenses?|charges?)"),
    ("jv_share", r"^share of (net )?(profit|loss|\(loss\)|results?).*(associate|joint venture)"),
    # a 'before tax' line that is also before the associates' share is not PBT (BSE; E30)
    ("pbt", r"^(?!.*share of).*(profit.{0,30}before\s*tax|^profit\s*/\s*\(loss\) before\s*tax|from ordinary activities before\s*tax)"),
    # no plain PBT line: 'Profit before share of net profit of associates ... & tax' (BEL consolidated; E29)
    ("pbt_pre_assoc", r"^profit before (exceptional items,? )?(share of .*(associate|joint venture).*(&|and)\s*tax|tax.*share of .*(associate|joint venture))"),
    # tax printed only as components (current / prior years / deferred) is summed; a total line wins
    ("tax_total", r"^total tax|^total income tax|^tax expense \(net\)|^income tax expenses?\b|^total provision for tax"),
    ("tax_part", r"current tax|deferred tax|tax (of|for|relating to|in respect of) (prior|earlier|previous) (years?|periods?)|"
                 r"(earlier|prior|previous) years?'? tax|^mat credit"),
    ("tax", r"^(total )?tax expense|^tax expense|^total tax"),
    # profit attributable to owners / equity shareholders / the group; never an equity or reserves line
    ("pat_owners", r"^(?!.*\b(other equity|equity share capital|reserves|paid[- ]up)\b).*(attributable to:?\s*(\(?[a-z]\)\s*)?(the )?(owners|equity holders|"
                   r"equity shareholders|shareholders|the group)|^(owners|equity holders|equity shareholders|shareholders) of (the )?"
                   r"(company|parent|holding)|after minority interests?|^group net profit|net profit for the group|"
                   r"profit for the (period|quarter|year) attributable to the group)"),
    ("nci", r"^non[- ]?controlling interests?|^minority interests?"),
    ("pat", r"^(net )?(profit|loss).{0,25}for the (period|quarter|year)|^(profit|loss) after tax|^net (profit|loss)|from ordinary activities after tax"),
    ("gnpa_pct", r"%\s*of gross npa|gross npa.*%|% of gross non"),
    ("nnpa_pct", r"%\s*of net npa|net npa.*%|% of net non"),
]


def _norm_label(s: str) -> str:
    """'1 Income a) Revenue from operations' -> 'revenue from operations';
    '(Loss) / profit for the period (7-8)' -> 'profit for the period (7-8)'."""
    s = re.sub(r"\s+", " ", s).strip().lower()
    # doubled text layers print every word twice ('owners owners of the the company company'; Dixon; E30)
    s = re.sub(r"\b(\w+)( \1\b)+", r"\1", s)
    # text-layer misprints of letters as digits ('Revenue from 6perations', 'Pr0fit'): only inside words
    s = re.sub(r"\b[06](?=[a-z]{4,})|(?<=[a-z])0(?=[a-z])", "o", s)
    s = re.sub(r"(?<=[a-z])1(?=[a-z])", "l", s)
    s = re.sub(r"\(\s*loss\s*\)\s*/?\s*|/\s*\(\s*loss\s*\)|\bloss\s*/\s*", "", s)       # (loss) variants
    for _ in range(3):  # numbering, sub-lettering and section words, possibly stacked
        s = re.sub(r"^(\d{1,2}|[ivxlcm]{1,5})[.)]?\s+|^\(?[a-z0-9]{1,3}\)\s*|^[a-z][.)]\s+|^(income|expenses?)\s*:?\s+(?=[a-z]\))", "", s)
    return s.strip(" :-")


def map_rows(table: dict) -> dict:
    """Row-transcribed table -> {nature, unit, is_bank, columns:[{label, period_end, months, field: value}]}."""
    cols = [dict(c) for c in table.get("columns", [])]
    seen: set[str] = set()
    tax_rows: list[list] = []
    owners_rows: list[tuple[str, list, list | None]] = []   # (line printed just above, values, partner NCI values)
    prev_label = ""
    last_field = None
    for row in table.get("rows", []):
        label = _norm_label(row.get("label", ""))
        context, prev_label = prev_label, label     # the line printed just above this one
        field = next((f for f, rx in _FIELDS if re.search(rx, label)), None)
        if field in ("rev_part", "tax_part"):   # printed only as sub-lines: sum them
            key = "rev_parts" if field == "rev_part" else "tax_parts"
            for c, v in zip(cols, row.get("values", [])):
                if v is not None:
                    c[key] = c.get(key, 0.0) + v
            seen.add(field)
            continue
        vals = list(row.get("values", []))
        if field == "nci" and owners_rows and owners_rows[-1][2] is None and last_field == "pat_owners":
            owners_rows[-1] = (owners_rows[-1][0], owners_rows[-1][1], vals)     # the owners line's partner
        if field == "pat" and re.search(r"minority interest|non-controlling", context) and "before minority" not in label \
                and not all(v is None for v in vals):
            owners_rows.append(("after minority", vals, None))   # 'Less: Minority interest' then the owners' profit (HDFC Bank)
        if field == "pat_owners" and not all(v is None for v in vals):
            owners_rows.append((context, vals, None))
            last_field = field
            continue
        last_field = field
        if field in ("tax_total", "tax") and not all(v is None for v in row.get("values", [])):
            tax_rows.append(list(row.get("values", [])))   # every tax-like row is a candidate; resolved below
            seen.add(field)
            continue
        if not field or field in seen:
            continue                      # keep the first occurrence (statements repeat e.g. 'profit' lines)
        if all(v is None for v in row.get("values", [])):
            continue                      # a heading row ('Tax expense' over 'Current tax'): don't claim the field
        seen.add(field)
        for c, v in zip(cols, row.get("values", [])):
            c[field] = v
    # profit attributable to owners: statements print an owners line for profit, for OCI and for total
    # comprehensive income, in varying order (Bharat Forge prints the TCI one first; E29). Prefer the
    # line under a profit heading, else the one closest to total profit; one line for every column.
    if owners_rows and cols:
        pat0 = cols[0].get("pat")
        def plausible(vals, lo=0.5, hi=1.05):
            v = vals[0] if vals else None
            return v is not None and pat0 not in (None, 0) and lo <= v / pat0 <= hi
        # under a profit heading a large minority share (Bajaj Finserv: owners 46% of group profit) or a loss
        # with profitable minorities (Tata Chemicals: owners' loss 122 on a group loss of 50) is still the line
        # strongest evidence: owners + its minority partner = total profit (Bajaj Finserv prints three such pairs)
        paired = [v for _, v, n in owners_rows if n and v and None not in (v[0], n[0], pat0)
                  and _near(v[0] + n[0], pat0, rel=0.01, absolute=1.0)]
        under_profit = [v for ctx, v, _ in owners_rows if re.search(r"profit|net income|minority", ctx)
                        and not re.search(r"comprehensive income(?!.*profit)", ctx) and plausible(v, 0.2, 3.0)]
        by_closeness = sorted((v for _, v, _ in owners_rows if plausible(v)), key=lambda v: abs(v[0] - pat0))
        pick = (paired or under_profit or by_closeness or [None])[0]
        if pick is not None:
            for c, v in zip(cols, pick):
                c["pat_owners"] = v
    for c in cols:   # PBT printed only as 'before share of associates & tax': the associates' share is added at PAT
        pre = c.pop("pbt_pre_assoc", None)
        if c.get("pbt") is None and pre is not None:
            c["pbt"] = pre
    # tax: statements print several tax-like lines (a JV's own tax inside a breakdown, a heading, the
    # total, the components). Candidates in print order plus the summed components; the one that makes
    # PBT - tax = PAT in the current column wins, and the same line is used for every column (E29)
    parts = [c.pop("tax_parts", None) for c in cols]
    cands = [[r[i] if i < len(r) else None for i in range(len(cols))] for r in tax_rows]
    if any(p is not None for p in parts):
        cands.append(parts)
    if cands:
        c0 = cols[0]
        def fits(cand):
            t, pbt, pat = cand[0], c0.get("pbt"), c0.get("pat")
            if None in (t, pbt, pat):
                return False
            jv = c0.get("jv_share") or 0.0
            return abs(pbt - t - pat) <= 1.0 or abs(pbt - t + jv - pat) <= 1.0
        pick = next((cd for cd in cands if fits(cd)), None) or next((cd for cd in cands if cd[0] is not None), cands[0])
        for c, v in zip(cols, pick):
            c["tax"] = v
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
    _standard_layout_fix(cols)
    # a lender (NBFC) pays interest as its main cost: EBITDA would add back the business itself
    c0 = cols[0] if cols else {}
    is_lender = (not is_bank and c0.get("finance_costs") is not None and bool(c0.get("revenue"))
                 and c0["finance_costs"] > 0.25 * c0["revenue"])
    return {"found": table.get("found", True), "nature": table.get("nature", "Consolidated"),
            "unit": table.get("unit", "crores"), "is_bank": is_bank, "is_lender": is_lender, "columns": cols}


_UNIT_RX = re.compile(r"(?:₹|rs\.?|inr|rupees)\s*(?:in\s*)?(crores?|lakhs?|lacs?|millions?|thousands?)|"
                      r"(?:in|amount in|amounts in|figures in)\s*(?:₹|rs\.?|inr|rupees)?\s*(crores?|lakhs?|lacs?|millions?|thousands?)", re.I)


def unit_from_text(text: str) -> str | None:
    """The unit the statement itself prints ('(In ₹ Million)', 'Rs. in Lakhs'), if exactly one kind appears.
    The model misread Persistent's millions as lakhs: every figure 10x too small (E30)."""
    found = set()
    for m in _UNIT_RX.finditer(text or ""):
        w = (m.group(1) or m.group(2)).lower()
        found.add("crores" if w.startswith("crore") else "lakhs" if w.startswith(("lakh", "lac"))
                  else "millions" if w.startswith("million") else "thousands")
    return found.pop() if len(found) == 1 else None


_AMOUNT_RX = re.compile(r"(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d+)?\s*(crores?|lakhs?|lacs?|millions?)\b", re.I)


def unit_from_amounts(text: str) -> str | None:
    """Last resort: the scale a document writes its rupee amounts in ('Rs. 3,830 million' in the notes),
    if one scale appears at least twice and no other does (EUR/USD amounts don't count)."""
    kinds = [("crores" if w.lower().startswith("crore") else "lakhs" if w.lower().startswith(("lakh", "lac")) else "millions")
             for w in _AMOUNT_RX.findall(text or "")]
    return kinds[0] if len(kinds) >= 2 and len(set(kinds)) == 1 else None


def extract(url: str, xbrl_for=None) -> tuple[dict, int] | None:
    """Model transcription of the best P&L page; returns (table, page_number).

    Consolidated is preferred: a passing standalone table is kept only as a fallback while the
    remaining candidate pages are tried (Deepak prints standalone on p2, consolidated on p3; E29).
    xbrl_for(period_end, nature) -> QuarterResult | None lets the check use the XBRL when it exists."""
    fallback = first_seen = None
    # a statement page may not print its unit (Persistent p19); the document then says it once (p5, 'In ₹ Million')
    doc_text = " ".join(p.text for p in docs.pages(url))
    doc_unit = unit_from_text(doc_text) or unit_from_amounts(doc_text)
    for page in docs.pnl_candidates(url, k=4):
        parts = ([llm.Part(text=page.text)] if page.clean
                 else [llm.Part(png=docs.page_png(url, page.number))])
        # The light model varies run to run; calls are free, so try text then the rendered image,
        # and keep the first transcription that passes every check (E25). Never show one that fails.
        attempts = ([parts] if page.clean else []) + [[llm.Part(png=docs.page_png(url, page.number))]] * 2
        for att in attempts:
            out = llm.structured("results_table", SYSTEM, att, RESULTS_SCHEMA, tier="fast")
            if not (out.get("found") and out.get("columns") and out.get("rows")):
                continue
            table = map_rows(out)
            printed = unit_from_text(page.text) or doc_unit
            if printed and printed != table["unit"]:
                table["unit"], table["unit_from_page"] = printed, True
            first_seen = first_seen or (table, page.number)
            xq = xbrl_for(table["columns"][0].get("period_end"), table["nature"]) if xbrl_for else None
            if check(table, xq).ok:
                if table["nature"] == "Consolidated":
                    return table, page.number
                fallback = fallback or (table, page.number)
                break                      # this page is standalone; look for a consolidated page
    return fallback or first_seen


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
    bank = table.get("is_bank")
    core = ("interest_earned", "interest_expended", "pbt", "pat") if bank else ("revenue", "pbt", "pat")
    missing = [k for k in core if cols[0].get(k) is None]
    if missing:
        return Check(False, f"failed: missing {', '.join(missing)}", [])   # a table without its core lines is not shown
    # column identity, not just arithmetic: a table whose columns are mislabelled or shifted can still
    # add up within each column (Ather: last year's column read as this quarter; SBI: rows shifted; E29)
    notes += _structure_notes(table)
    tol = 0.02 * 2  # rounding: two printed decimals on each side
    for c in _shown_columns(table):     # every column a figure is shown from (a misread full-year column
                                        # that no card uses must not withhold the quarter; Infosys, E30)
        if bank:
            notes += _bank_notes(c)
            continue
        if None not in (c.get("revenue"), c.get("other_income"), c.get("total_income")):
            if not _close(c["revenue"] + c["other_income"], c["total_income"], tol + 0.011 * abs(c["total_income"]) / 1000):
                notes.append(f"{c['label']}: revenue+other income != total income")
        ti, te, pbt = c.get("total_income"), c.get("total_expenses"), c.get("pbt")
        if None not in (ti, te, pbt):
            exc, jv = c.get("exceptional") or 0.0, c.get("jv_share") or 0.0
            options = [ti - te + se * exc + sj * jv for se in (1, -1, 0) for sj in (1, 0)]
            if not any(_near(o, pbt, rel=0.002, absolute=1.0) for o in options):
                notes.append(f"{c['label']}: income - expenses ± exceptional != PBT")   # an exceptional line missed (E30)
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


def _near(a, b, rel=0.005, absolute=1.0) -> bool:
    return abs(a - b) <= max(absolute, rel * max(abs(a), abs(b)))


def _date(c: dict):
    from datetime import date
    try:
        return date.fromisoformat(str(c.get("period_end")))
    except ValueError:
        return None


def _shown_columns(table: dict) -> list[dict]:
    """The current quarter, the previous quarter, the year-ago quarter and the half year used by the identity."""
    cols = table["columns"]
    if not cols or _date(cols[0]) is None:
        return cols
    cur = cols[0]
    m = cur.get("months") or 3
    out = [cur, _pick(cols, m, m) if m == 3 else None, _pick(cols, m, 12),
           next((c for c in cols[1:] if c.get("months") == 6 and _date(c) == _date(cur)), None)]
    return [c for c in out if c is not None]


def _structure_notes(table: dict) -> list[str]:
    cols = table["columns"]
    cur, d0 = cols[0], _date(cols[0])
    if d0 is None:
        return ["current column has no readable period"]
    out = []
    if any((d := _date(c)) and d > d0 for c in cols[1:]):
        out.append("current column is not the latest period")
    # half year (or nine months) = this quarter + the earlier cumulative/quarter columns of the same year
    if cur.get("months") == 3:
        prev_q = _pick(cols, 3, 3)
        h1 = next((c for c in cols[1:] if c.get("months") == 6 and _date(c) == d0), None)
        keys = ("interest_earned", "pat") if table.get("is_bank") else ("revenue", "pat")
        if prev_q and h1:
            for k in keys:
                if None not in (cur.get(k), prev_q.get(k), h1.get(k)) and not _near(cur[k] + prev_q[k], h1[k]):
                    out.append(f"half year {k} {h1[k]} != quarter {cur[k]} + previous quarter {prev_q[k]}")
    # the same profit in this quarter and a year ago, to the paisa, means a column was copied or shifted
    prev_y = _pick(cols, cur.get("months") or 3, 12)
    if prev_y and cur.get("pat") not in (None, 0) and cur.get("pat") == prev_y.get("pat"):
        out.append("current and year-ago profit identical")
    return out


def _bank_notes(c: dict) -> list[str]:
    """Bank statements have their own identities; check them instead of skipping (SBI shifted rows; E29)."""
    out = []
    ie, ix, oi, ti = (c.get(k) for k in ("interest_earned", "interest_expended", "other_income", "total_income"))
    if None not in (ie, oi, ti) and not _near(ie + oi, ti):
        out.append(f"{c.get('label')}: interest earned + other income != total income")
    if None not in (ie, ix) and ix >= ie:
        out.append(f"{c.get('label')}: interest expended >= interest earned")
    op, pr, pbt = c.get("operating_profit"), c.get("provisions"), c.get("pbt")
    if ti is not None and op is not None and op >= ti:
        out.append(f"{c.get('label')}: operating profit >= total income")
    if None not in (op, pr, pbt) and not _near(op - pr - (c.get("exceptional") or 0), pbt, rel=0.01):
        out.append(f"{c.get('label')}: operating profit - provisions != PBT")
    g = c.get("gnpa_pct")
    if g is not None and not 0 <= g <= 20:
        out.append(f"{c.get('label')}: gross NPA {g}% is not a plausible ratio")
    return out


# ------------------------------------------------------------------ numbers for the card

def _standard_layout_fix(cols: list[dict]) -> None:
    """Indian results print six columns in a fixed order: Q, Q-1, Q-4, H1, H1-1, FY (or 9M for Q3).
    When the other columns confirm that layout, a mislabelled third column is the year-ago quarter
    (Reliance: 'Half Year Ended 30th Seo'25' printed over the Sep-25 quarter; E29)."""
    from datetime import date
    if len(cols) != 6 or cols[0].get("months") != 3:
        return
    d = [_date(c) for c in cols]
    if None in (d[0], d[1], d[3]):
        return
    back = lambda a, b: (a.year - b.year) * 12 + (a.month - b.month)
    if (cols[1].get("months") == 3 and back(d[0], d[1]) == 3 and cols[3].get("months") in (6, 9) and d[3] == d[0]
            and not (cols[2].get("months") == 3 and d[2] and back(d[0], d[2]) == 12)):
        cols[2]["months"] = 3
        cols[2]["period_end"] = date(d[0].year - 1, d[0].month, d[0].day).isoformat()
        cols[2]["layout_inferred"] = True


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


def _owners_pat(c: dict, g) -> float | None:
    """Profit attributable to owners when map_rows chose an owners line (one line for every column, so
    QoQ/YoY never mix bases); else total profit."""
    po = g("pat_owners")
    return po if po is not None else g("pat")


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
                    "pat": _owners_pat(c, g), "gnpa_pct": c.get("gnpa_pct"), "nnpa_pct": c.get("nnpa_pct")}
        rev, pbt = g("revenue"), g("pbt")
        if rev is not None and g("excise"):
            rev -= g("excise")            # revenue net of excise duty (ITC, Reliance print it gross; E29)
        exc = g("exceptional") or 0.0
        extra = g("non_operating_extra") or 0.0
        ebitda = None
        if not table.get("is_lender") and None not in (pbt, g("finance_costs"), g("depreciation"), g("other_income")):
            ebitda = (pbt - exc) + g("finance_costs") + g("depreciation") - g("other_income")
        return {"revenue": rev, "ebitda": ebitda, "pbt": pbt, "pbt_ex_exceptional": None if pbt is None else pbt - exc,
                # profit before one-offs: exceptional items and named non-operating gains (Titan's put-option gain)
                "pbt_underlying": None if pbt is None else pbt - exc - extra,
                "pat": _owners_pat(c, g), "exceptional": exc or None, "non_operating_extra": extra or None,
                "ebitda_margin_pct": round(ebitda / rev * 100, 2) if ebitda is not None and rev else None}

    m_cur, m_q, m_y = metrics(cur), metrics(prev_q), metrics(prev_y)
    out = {"period_end": cur["period_end"], "months": months, "nature": table["nature"],
           "is_bank": table.get("is_bank", False), "is_lender": table.get("is_lender", False),
           "net_of_excise": cur.get("excise") is not None, "current": m_cur, "qoq": {}, "yoy": {},
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
