"""Plain-words facts from an XBRL-only exchange filing (no PDF exists), so the app can show what it says
instead of a link that renders raw XML. Generic over NSE's Reg 30 XBRL forms (analyst meets, trading
window, ESOP allotments...). Contact names, phone numbers and email addresses are never kept."""
from __future__ import annotations

import re
from datetime import date

from . import fetch

_LEAF = re.compile(r"<(?:[a-zA-Z\-]+:)?([A-Za-z][A-Za-z0-9]*)\b[^>/]*>([^<]{1,300})</", re.S)
_SKIP = re.compile(r"^(instant|startDate|endDate|identifier|measure|explicitMember)$|Domain$|ISIN|ScripCode|Symbol$|"
                   r"NameOfTheCompany|Contact|Email|EMail|Phone|Mobile|DialIn|Weblink|WebLink|Fax|Address|Signatory|"
                   r"Designation|NameOfThePerson|AuthorisedPerson|DateOfReport|TypeOfAnnouncement|LevelOfRounding|"
                   r"ReportingCurrency|Taxonomy|Whether", re.I)
_EMPTY = {"na", "n.a.", "nil", "none", "-", "not applicable", "notlisted", "false", "true"}


_SHORT = {
    "type of meeting": "Meeting", "date of meeting": "Date", "start time of meeting": "Time", "end time of meeting": "Ends",
    "place of meeting": "Place", "name of meeting": "Event", "mode of meeting": "Mode", "agenda for meeting": "Agenda",
    "name of fund of analyst investor": "Investor", "name of analyst investor": "Analyst", "name of host of meeting": "Host",
    "details of other type of meeting": "Format", "type of audio recording": "Recording", "date of call for audio recording": "Call date",
    "end time of call for audio recording": "Call ended", "date of audio recording posted online": "Posted",
    "time of audio recording posted online": "Posted at",
}


def _label(tag: str) -> str:
    t = re.sub(r"(Or[A-Z][a-z]+)+", "", tag)                       # MeetingOrCallOrConference -> Meeting
    t = re.sub(r"(For(Which)?Intimation(IsGiven)?|IsScheduled.*|WithWhom.*)$", "", t)
    words = re.sub(r"(?<!^)(?=[A-Z])", " ", t).lower().split()
    words = [w for i, w in enumerate(words) if w != "the" and (i == 0 or w != words[i - 1])]   # "recording recording"
    out = " ".join(words).strip()
    for long, short in (("time of commencement of", "start time of"), ("time of conclusion of", "end time of"),
                        ("date of disclosure of prior intimation of", "notice date for"), ("uploaded on website of company", "posted online")):
        out = out.replace(long, short)
    # the forms' long field names, as a person would say them
    out = _SHORT.get(out, out)
    if out.startswith("notice date for"):
        out = "Notice given"
    if len(out) > 44:                                   # cut at a word, never mid-word
        out = out[:44].rsplit(" ", 1)[0] + "…"
    return out[:1].upper() + out[1:] if out else tag


def _value(v: str) -> str:
    v = re.sub(r"\s+", " ", v).strip()
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return date(int(m[1]), int(m[2]), int(m[3])).strftime("%-d %b %Y")
    m = re.fullmatch(r"(\d{2}):(\d{2}):\d{2}", v)
    return f"{m[1]}:{m[2]}" if m else v


def facts(xml: str, limit: int = 12) -> list[list[str]]:
    out: list[list[str]] = []
    for tag, raw in _LEAF.findall(xml):
        v = _value(raw)
        if _SKIP.search(tag) or not v or v.lower() in _EMPTY or "@" in v or re.fullmatch(r"[\d\s+()-]{7,}", v):
            continue
        pair = [_label(tag), v]
        if pair not in out:
            out.append(pair)
        if len(out) >= limit:
            break
    return out


def for_link(url: str) -> list[list[str]]:
    """Facts for one XBRL file (fetched once, cached forever like every filing); [] if it can't be read."""
    try:
        return facts(fetch.get(url).decode("utf-8", "replace"))
    except fetch.Refused:
        raise
    except Exception:
        return []
