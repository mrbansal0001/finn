"""Rules-first classification of NSE filings into ENAM's 17 categories.

Input is NSE's own SUBJECT string (clean in the RSS feed) plus the one-line
summary. Rules are written against the 89 subject values seen in 5,756 real
filings (docs/research/nse-desc-categories-3-7nov2026.txt). Anything a rule
can't settle is marked `needs_document=True` and goes to the LLM, which reads
the filing's first pages (docs/DECISIONS.md D-009, D-014).

Tier is FINN's materiality prior used for ranking the Edition:
  lead     - can headline the edition (results, mgmt change, M&A, legal...)
  notable  - "N more worth a look"
  routine  - folded into the single routine row
"""
from __future__ import annotations

import re
from dataclasses import dataclass

CATEGORIES = (
    "results", "m_and_a", "fund_raise", "management_change", "litigation",
    "insider_trading", "earnings_call", "investor_meetings", "credit_rating",
    "dividend", "bonus_split", "capex", "press_release", "postal_ballot",
    "agm_egm", "pledging", "unclassified",
)


@dataclass(frozen=True)
class Label:
    category: str
    tier: str
    needs_document: bool = False
    rule: str = ""


# Ordered: first match wins. (subject regex, summary regex or None, category, tier, needs_document)
_RULES: list[tuple[str, str | None, str, str, bool]] = [
    # --- results
    (r"^integrated filing- ?financial", None, "results", "lead", False),
    (r"^outcome of board meeting", r"financial results?", "results", "lead", False),
    (r"financial results|reply to clarification- ?financial|clarification - financial", None, "results", "notable", False),
    (r"^outcome of board meeting", None, "unclassified", "notable", True),  # decisions unknown until read
    # --- people
    (r"change in directors/kmp|change in director|change in management|^appointment|resignation|cessation|retirement|demise|change in company secretary|change in auditors|statutory auditor", None, "management_change", "lead", False),
    # --- legal / regulatory / distress (deemed material under Reg 30 Para A/B)
    (r"litigation|dispute|action\(s\) (taken|initiated)|orders passed|forensic audit|fraud|default|insolvency|key licenses|regulatory approvals|strikes|lockouts|closure of operations", None, "litigation", "lead", False),
    # --- corporate structure
    (r"acquisition|amalgamation|merger|demerger|scheme of arrangement|sale or disposal|open offer|takeover|other restructuring|offer for sale", None, "m_and_a", "lead", False),
    # --- money in (equity matters; debt-paper housekeeping doesn't)
    (r"committee meeting", r"\bPI\b|preferential|qip|rights|allot|fund", "fund_raise", "notable", False),
    (r"allotment of securities|issue of securities", r"non[- ]convertible|NCD|commercial paper|debenture", "fund_raise", "routine", False),
    (r"monitoring agency|statement of deviation", None, "fund_raise", "routine", False),
    (r"fund ?raising|alteration of capital|issue of securities|rights issue|preferential|qip|allotment of securities|increase in authori[sz]ed capital|conversion|buyback|utili[sz]ation of funds|statement of deviation|monitoring agency", None, "fund_raise", "notable", False),
    # --- ratings
    (r"credit rating", None, "credit_rating", "notable", False),
    # --- shareholder returns
    (r"bonus|stock split|sub-?division", None, "bonus_split", "notable", False),
    (r"dividend", None, "dividend", "notable", False),
    # --- growth / orders / capacity
    (r"bagging|receiving of orders|awarding of order|capacity addition|commencement of commercial production|new line|product launch|strategic, technical|tie up|agreements|memorandum of understanding", None, "capex", "notable", False),
    # --- ownership
    (r"insider trading|reg(ulation)? 7 ?\(2\)|sebi \(prohibition of insider", None, "insider_trading", "notable", False),
    (r"encumbrance|pledge", None, "pledging", "notable", False),
    # --- earnings calls: transcripts feed the Promises ledger; meet schedules are routine
    (r"analysts?/institutional investor meet|con\. ?call|analyst/investor meet", r"transcript", "earnings_call", "notable", False),
    (r"analysts?/institutional investor meet|con\. ?call|analyst/investor meet|investor presentation", None, "investor_meetings", "routine", False),
    # --- meetings / votes
    (r"postal ballot", None, "postal_ballot", "routine", False),
    (r"shareholders meeting|agm|egm|voting results", None, "agm_egm", "routine", False),
    # --- market-driven clarifications: material when they happen
    (r"spurt in volume|price movement|news verification|rumour verification", None, "unclassified", "notable", True),
    # --- press releases: content decides
    (r"press release|disclosure of material issue|monthly business updates", None, "press_release", "notable", True),
    # --- pure housekeeping
    (r"newspaper publication|trading window|record date|esop|esos|esps|options to purchase|loss of share certificates|address change|registrar|depositories and participants|committee meeting|amendment to aoa|board meeting intimation|prior intimation|related party|giving guarantees|certificate under", None, "unclassified", "routine", False),
    # --- 'Updates' whose summary names the content
    (r"general updates|^updates$", r"transcript", "earnings_call", "notable", False),
    (r"general updates|^updates$", r"media statement|press statement", "press_release", "notable", True),
    # --- 'Updates' whose one-line summary already shows they're housekeeping
    (r"general updates|^updates$", r"newspaper|clipping|investor conference|commercial paper|esg rating|report of auditors|"
     r"registrar|share transfer agent|tax deduction at source|\bTDS\b|certificate|audio recording|link of recording|"
     r"(investor|analyst|results) presentation|to announce .* results|postal ballot", "unclassified", "routine", False),
    # --- unknown: read the document
    (r"general updates|^updates$|others|alteration/revision|rescission|delayed", None, "unclassified", "notable", True),
]
_COMPILED = [(re.compile(s, re.I), re.compile(m, re.I) if m else None, c, t, n) for s, m, c, t, n in _RULES]


def classify(subject: str, summary: str = "", link: str | None = None) -> Label:
    subj = re.sub(r"-XBRL$", "", subject.strip(), flags=re.I)
    text = f"{summary} {link or ''}"
    for i, (s_re, m_re, cat, tier, needs) in enumerate(_COMPILED):
        if s_re.search(subj) and (m_re is None or m_re.search(text)):
            return Label(cat, tier, needs, rule=f"r{i}")
    return Label("unclassified", "notable", True, rule="none")
