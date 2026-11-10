"""Collect filings into the local store.

- poll():     the live RSS feed (whole market, ~1 day window); run every ~15 min
- backfill(): per-company history for the portfolio via NSE's announcements
              endpoint -- used sparingly, one request per company (D-009)
"""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta

from . import classify, feeds, fetch, store

ANN_API = ("https://www.nseindia.com/api/corporate-announcements?index=equities"
           "&symbol={symbol}&from_date={start:%d-%m-%Y}&to_date={end:%d-%m-%Y}")


def _row(fid, symbol, company, subject, summary, link, published: datetime, source, is_xbrl):
    label = classify.classify(subject, summary, link)
    return {
        "id": fid, "symbol": symbol, "company_name": company, "subject": subject,
        "summary": summary, "link": link, "published_at": published.isoformat(),
        "source": source, "category": label.category, "tier": label.tier,
        "needs_document": int(label.needs_document), "rule": label.rule, "is_xbrl": int(is_xbrl),
    }


def poll() -> int:
    items = feeds.poll_announcements()
    rows = [_row(i.id, i.symbol, i.company_name, i.subject, i.summary, i.link,
                 i.published_at, "rss", i.is_xbrl) for i in items]
    with store.connect() as con:
        return store.upsert(con, "filings", rows)


def backfill(symbols: list[str], days: int = 30, end: date | None = None) -> int:
    end = end or date.today()
    start = end - timedelta(days=days)
    rows = []
    for sym in symbols:
        raw = fetch.get(ANN_API.format(symbol=sym, start=start, end=end), max_age=6 * 3600)
        data = json.loads(raw)
        data = data if isinstance(data, list) else data.get("data", [])
        for x in data:
            link = x.get("attchmntFile") or None
            fid = hashlib.sha1(f"{x.get('seq_id')}|{link}".encode()).hexdigest()[:16]
            published = datetime.strptime(x["an_dt"], "%d-%b-%Y %H:%M:%S")
            rows.append(_row(fid, x.get("symbol") or sym, x.get("sm_name") or sym,
                             x.get("desc") or "", x.get("attchmntText") or "", link,
                             published, "backfill", False))
    with store.connect() as con:
        return store.upsert(con, "filings", rows)


def poll_results() -> int:
    """Integrated Filing (Financials) XBRL from the live feed (last ~20 filings)."""
    return ingest_results_xbrl([i.xbrl_url for i in feeds.poll_results()])


def ingest_results_xbrl(urls: list[str]) -> int:
    """Exact current-quarter numbers from Integrated Filing XBRL files (D-010)."""
    from . import xbrl
    rows = []
    for url in urls:
        try:
            r = xbrl.parse_results(fetch.get(url).decode("utf-8", errors="replace"))
        except Exception:  # one bad file must not stop the poll
            continue
        if not (r.symbol and r.period_end and r.values):
            continue
        rows.append({
            "symbol": r.symbol, "period_end": r.period_end, "nature": r.nature or "Unknown",
            "reporting": r.reporting, "source": "xbrl", "source_url": url,
            "values_json": {**r.values, "_rounding": r.rounding, "_ebitda": r.ebitda()},
            "comparatives_json": None, "check_status": "xbrl_exact",
        })
    with store.connect() as con:
        return store.upsert(con, "results", rows)
