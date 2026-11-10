"""NSE RSS feeds (published downloads on nsearchives).

Online_announcements.xml holds about one calendar day (~600 items) and has a
5-minute TTL, so the worker polls it every ~15 minutes and keeps everything.
"""
from __future__ import annotations

import hashlib
import html
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime

from . import fetch, universe

ANNOUNCEMENTS_URL = "https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml"
RESULTS_URL = "https://nsearchives.nseindia.com/content/RSS/Integrated_Filing_Financials.xml"


@dataclass
class FeedItem:
    id: str                 # stable hash of (title, link, pubDate)
    company_name: str
    symbol: str | None      # None when the issuer isn't an NSE equity (debt, MF, SME)
    subject: str            # NSE's category, e.g. "Change in Directors/KMP/SMP/Auditor/RTA"
    summary: str            # the description text before "|SUBJECT:"
    link: str | None        # PDF or XBRL; some items have none
    published_at: datetime  # IST, naive
    is_xbrl: bool


def _parse_date(s: str) -> datetime:
    return datetime.strptime(s.strip(), "%d-%b-%Y %H:%M:%S")


def parse_announcements(xml_bytes: bytes) -> list[FeedItem]:
    root = ET.fromstring(xml_bytes)
    items: list[FeedItem] = []
    for it in root.iter("item"):
        title = html.unescape((it.findtext("title") or "").strip())
        link = (it.findtext("link") or "").strip() or None
        desc = html.unescape((it.findtext("description") or "").strip())
        pub = it.findtext("pubDate") or ""
        summary, _, subject = desc.partition("|SUBJECT:")
        if link and "/content/debt/" in link:
            continue  # debt-segment issuers are out of scope
        try:
            published = _parse_date(pub)
        except ValueError:
            continue
        key = f"{title}|{link}|{pub}".encode()
        items.append(FeedItem(
            id=hashlib.sha1(key).hexdigest()[:16],
            company_name=title,
            symbol=universe.symbol_for_name(title),
            subject=subject.strip(),
            summary=summary.strip(),
            link=link,
            published_at=published,
            is_xbrl=bool(link and link.lower().endswith(".xml")),
        ))
    return items


@dataclass
class ResultsItem:
    company_name: str
    symbol: str | None
    xbrl_url: str
    published_at: datetime
    is_revision: bool


def parse_results(xml_bytes: bytes) -> list[ResultsItem]:
    """Integrated Filing (Financials) feed. Standalone and consolidated arrive as
    two separate items that look identical; which is which is inside the XBRL."""
    root = ET.fromstring(xml_bytes)
    out: list[ResultsItem] = []
    for it in root.iter("item"):
        title = html.unescape((it.findtext("title") or "").strip())
        link = (it.findtext("link") or "").strip()
        desc = it.findtext("description") or ""
        if not link:
            continue
        try:
            published = _parse_date(it.findtext("pubDate") or "")
        except ValueError:
            continue
        out.append(ResultsItem(title, universe.symbol_for_name(title), link, published,
                               is_revision="Revised" in desc))
    return out


def poll_announcements() -> list[FeedItem]:
    return parse_announcements(fetch.get(ANNOUNCEMENTS_URL, max_age=10 * 60))


def poll_results() -> list[ResultsItem]:
    return parse_results(fetch.get(RESULTS_URL, max_age=10 * 60))
