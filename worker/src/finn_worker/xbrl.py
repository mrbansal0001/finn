"""Parsers for NSE's XBRL files (published downloads on nsearchives).

Two kinds matter:
- Integrated Filing (Financials): the quarter's P&L, exact to the rupee.
  It contains only the current quarter (context "OneD") and year-to-date
  ("FourD") -- no comparatives (E11). Tag names differ between the INDAS and
  NONINDAS taxonomies (E15), hence the alias table.
- CIM (Change in Directors/KMP/SMP): who, what, when, and a free-text bio (E9).
"""
from __future__ import annotations

import html
import re
from dataclasses import dataclass, field

_FACT = re.compile(r'<(?:[\w-]+):(\w+)\b([^>]*?)(?:/>|>([^<]*)</(?:[\w-]+):\1>)', re.S)
_CTX_REF = re.compile(r'contextRef="([^"]+)"')


def facts(xml: str) -> list[tuple[str, str, str]]:
    """All (tag, contextRef, text) triples, in document order."""
    out = []
    for m in _FACT.finditer(xml):
        tag, attrs, text = m.group(1), m.group(2), m.group(3)
        ctx = _CTX_REF.search(attrs or "")
        if ctx and text is not None:
            out.append((tag, ctx.group(1), html.unescape(text.strip())))
    return out


def first(fs, tag: str, ctx: str | None = None) -> str | None:
    for t, c, v in fs:
        if t == tag and (ctx is None or c == ctx):
            return v
    return None


# ---------------------------------------------------------------- results

# canonical field -> tags in priority order (INDAS first, then NONINDAS spellings)
RESULT_TAGS: dict[str, tuple[str, ...]] = {
    "revenue": ("RevenueFromOperations",),
    "other_income": ("OtherIncome",),
    "total_income": ("Income",),
    "finance_costs": ("FinanceCosts",),
    "depreciation": ("DepreciationDepletionAndAmortisationExpense", "DepreciationAndAmortisationExpense"),
    "exceptional": ("ExceptionalItemsBeforeTax", "ExceptionalItems"),
    "pbt": ("ProfitBeforeTax",),
    "tax": ("TaxExpense",),
    "jv_share": ("ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod",),
    "pat": ("ProfitLossForPeriod", "ProfitLossForThePeriod"),
    "pat_owners": ("ProfitOrLossAttributableToOwnersOfParent",),
    "eps_basic": ("BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations",
                  "BasicEarningsLossPerShareFromContinuingOperations"),
}


@dataclass
class QuarterResult:
    symbol: str | None
    isin: str | None
    period_start: str
    period_end: str
    reporting: str                 # "Quarterly" | "Half Yearly"
    nature: str                    # "Consolidated" | "Standalone"
    audited: str | None
    rounding: str | None           # unit the company used in its PDF: Lakhs / Millions / Crores
    values: dict[str, float] = field(default_factory=dict)   # absolute rupees

    def ebitda(self) -> float | None:
        """Operating EBITDA = PBT + finance costs + D&A - other income (D-011).
        Uses PBT before exceptional items so a one-off doesn't masquerade as operations."""
        v = self.values
        if not all(k in v for k in ("pbt", "finance_costs", "depreciation", "other_income")):
            return None
        pbt_pre_exceptional = v["pbt"] - v.get("exceptional", 0.0)
        return pbt_pre_exceptional + v["finance_costs"] + v["depreciation"] - v["other_income"]


def _num(s: str | None) -> float | None:
    try:
        return float(s) if s not in (None, "") else None
    except ValueError:
        return None


def parse_results(xml: str) -> QuarterResult:
    fs = facts(xml)
    # The current period is the context whose DateOfStartOfReportingPeriod is latest
    # among duration contexts; NSE names it "OneD" in practice.
    ctx = "OneD" if any(c == "OneD" for _, c, _ in fs) else (fs[0][1] if fs else "")
    vals: dict[str, float] = {}
    for key, tags in RESULT_TAGS.items():
        for tag in tags:
            n = _num(first(fs, tag, ctx))
            if n is not None:
                vals[key] = n
                break
    return QuarterResult(
        symbol=first(fs, "Symbol") or first(fs, "NSESymbol"),
        isin=first(fs, "ISIN"),
        period_start=first(fs, "DateOfStartOfReportingPeriod", ctx) or "",
        period_end=first(fs, "DateOfEndOfReportingPeriod", ctx) or "",
        reporting=first(fs, "TypeOfReportingPeriod") or "",
        nature=first(fs, "NatureOfReportStandaloneConsolidated", ctx) or "",
        audited=first(fs, "WhetherResultsAreAuditedOrUnaudited", ctx),
        rounding=first(fs, "LevelOfRounding"),
        values=vals,
    )


# ---------------------------------------------------------------- management change

@dataclass
class PersonChange:
    name: str
    salutation: str | None
    change: str            # Appointment / Cessation / Resignation / Tenure completion / Re-appointment ...
    category: str          # Director / Key Managerial Personnel / Senior Management Personnel
    designation: str | None
    effective: str | None
    reason: str | None
    bio: str | None


_CIM_FIELDS = {
    "name": ("NameOfDesignatedPerson",),
    "salutation": ("SalutationOfDesignatedPerson",),
    "change": ("TypeOfChange",),
    "category": ("CategoryForChange",),
    "designation": ("DesignationOfDesignatedPerson", "Designation"),
    "effective": ("EffectiveDateOfReasonOfChange", "EffectiveDate"),
    "reason": ("ReasonOfResignationInBrief", "ReasonOfChange", "ReasonForChange"),
    "bio": ("BriefProfile",),
}


def parse_cim(xml: str) -> tuple[str | None, list[PersonChange]]:
    """Returns (symbol, people). One file can list several people (E16: Repco had 2).
    Each person's facts are split across a duration context (D_ChangeInManagementN)
    and an instant context (I_ChangeInManagementN), so we group by the shared suffix."""
    fs = facts(xml)
    symbol = first(fs, "NSESymbol") or first(fs, "Symbol")
    by_ctx: dict[str, dict[str, str]] = {}
    order: list[str] = []
    for tag, raw_ctx, val in fs:
        ctx = re.sub(r"^[DI]_", "", raw_ctx)
        for key, tags in _CIM_FIELDS.items():
            if tag in tags:
                if ctx not in by_ctx:
                    by_ctx[ctx] = {}
                    order.append(ctx)
                by_ctx[ctx].setdefault(key, val)
    people = []
    for ctx in order:
        d = by_ctx[ctx]
        if not d.get("name"):
            continue
        people.append(PersonChange(
            name=re.sub(r"\s+", " ", d["name"]).strip(),
            salutation=d.get("salutation"),
            change=d.get("change", ""),
            category=d.get("category", ""),
            designation=d.get("designation"),
            effective=d.get("effective"),
            reason=d.get("reason"),
            bio=d.get("bio"),
        ))
    return symbol, people
