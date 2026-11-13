"""Push at the close, and the moment a filing lands (brief-check plan, part 1).

The brief's word is *push*: "tell me the moment something crosses a threshold". Visitors who switch on
notifications in Settings leave a browser push endpoint and their own alert rules in a private row
(migration 005). Each worker cycle (every 15 minutes) this sends, per subscriber:

  * filed alerts: a new filing of a kind they chose (results, deals, management changes) for a holding,
    within one cycle of it reaching the exchange feed;
  * the close digest: once per session, when that session's prices arrive, the moves that meet their
    price and volume rules ("3 alerts at the 13 Nov close: TITAN +5.2%, ...").

A new subscriber gets nothing from before they subscribed. Endpoints the push service says are gone (404,
410) are deleted. Notification text is written by rule from the same numbers the app shows.

    uv run python -m finn_worker.push        # one pass (what the cycle runs)
    uv run python -m finn_worker.push test   # send a test notification to every subscriber
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")

IST = ZoneInfo("Asia/Kolkata")
KIND_WORD = {"results": "Results", "m_and_a": "Deal", "management_change": "Management change"}
DEFAULT = {"price_pct": 5, "volume_x": 2, "alert_kinds": list(KIND_WORD)}


def _client() -> tuple[httpx.Client, str] | None:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key and os.getenv("VAPID_PRIVATE_KEY")):
        return None
    return httpx.Client(timeout=30, headers={"apikey": key, "Authorization": f"Bearer {key}",
                                             "Content-Type": "application/json"}), url.rstrip("/") + "/rest/v1"


def _pct(v: float) -> str:
    return f"{'+' if v > 0 else '−' if v < 0 else ''}{abs(v):.1f}%"


def _day(iso: str) -> str:
    d = datetime.fromisoformat(iso[:10])
    return f"{d.day} {d.strftime('%b')}"


def close_digest(snap: dict, prefs: dict, session: str) -> dict | None:
    """The moves at this session's close that meet the subscriber's rules; None if none do."""
    p, v = float(prefs.get("price_pct", 5)), float(prefs.get("volume_x", 2))
    hits = []
    for c in snap.get("move_cards", []):
        if c["at"][:10] != session:
            continue
        f = c.get("facts") or {}
        pct, vol = f.get("change_pct") or 0, f.get("volume_multiple") or 0
        if abs(pct) >= p or vol >= v:
            hits.append((abs(pct) >= p, abs(pct), c["symbol"], pct, vol, c["id"]))
    if not hits:
        return None
    hits.sort(reverse=True)
    parts = [f"{s} {_pct(pct)}" + (f" on {vol:.1f}× volume" if vol >= v else "") for _, _, s, pct, vol, _ in hits[:3]]
    more = f", and {len(hits) - 3} more" if len(hits) > 3 else ""
    n = len(hits)
    return {"title": f"{n} alert{'s' if n > 1 else ''} at the {_day(session)} close",
            "body": "; ".join(parts) + more,
            "url": f"/card/{hits[0][5]}" if n == 1 else "/?w=24h#alerts-24h",
            "tag": f"close-{session}"}


def filed(snap: dict, prefs: dict, after: str) -> list[dict]:
    """New filings of the chosen kinds for the holdings, after `after` (IST, as exported)."""
    kinds = set(prefs.get("alert_kinds") or DEFAULT["alert_kinds"])
    held = {h["symbol"] for h in snap.get("portfolio", [])}
    ed = snap["editions"]["24h"]
    out = []
    for c in ed["leads"] + ed["more"]:
        if c["kind"] in kinds and c["symbol"] in held and c["at"] > after:
            out.append(c)
    out.sort(key=lambda c: c["at"])
    return out


def _note(c: dict) -> dict:
    return {"title": f"{c['symbol']}: {KIND_WORD.get(c['kind'], 'Filing')} filed",
            "body": (c.get("headline") or c.get("nse_subject") or "")[:180],
            "url": f"/card/{c['id']}", "tag": f"filing-{c['id']}"}


def _send(sub: dict, payload: dict) -> int:
    from pywebpush import WebPushException, webpush
    try:
        webpush(subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                data=json.dumps(payload), vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
                vapid_claims={"sub": os.getenv("VAPID_SUBJECT") or "https://finn-red.vercel.app"},
                ttl=6 * 3600)
        return 201
    except WebPushException as e:
        return e.response.status_code if e.response is not None else 0


def run(test: bool = False) -> str:
    c = _client()
    if c is None:
        return "skipped (no Supabase or VAPID keys in .env)"
    http, base = c
    r = http.get(f"{base}/push_subscriptions", params={"select": "*"})
    if r.status_code == 404:
        return "skipped (apply migration 005 to create push_subscriptions)"
    r.raise_for_status()
    subs = r.json()
    if not subs:
        return "no subscribers"
    snap = json.loads((ROOT / "data" / "snapshot.json").read_text())
    session = max((p["day"] for p in snap.get("prices", {}).values()), default=None)
    ed = snap["editions"]["24h"]
    newest = max((c["at"] for c in ed["leads"] + ed["more"] if c["kind"] != "move"), default=snap["data_until"])
    sent = gone = 0
    for sub in subs:
        prefs = {**DEFAULT, **(sub.get("prefs") or {})}
        out: list[dict] = []
        patch: dict = {}
        if test:
            out.append({"title": "FINN notifications work", "body": "You'll hear about filings you chose and your alerts at the close.",
                        "url": "/settings#notify", "tag": "test"})
        elif sub.get("last_filing_at") is None or sub.get("last_session") is None:
            # first pass after subscribing: start from what FINN already holds, never a backlog
            patch = {"last_filing_at": f"{newest}+05:30", "last_session": session}
        else:
            # the cursor is the newest filing already considered (IST, as exported), not the clock: a filing
            # that reaches the feed a cycle late is still newer than the cursor
            after = datetime.fromisoformat(sub["last_filing_at"]).astimezone(IST).strftime("%Y-%m-%dT%H:%M:%S")
            new = filed(snap, prefs, after)
            out += [_note(x) for x in new[-3:]]       # a burst of filings: the latest three, never a flood
            if new:
                patch["last_filing_at"] = f"{new[-1]['at']}+05:30"
            if session and session != sub["last_session"]:
                d = close_digest(snap, prefs, session)
                if d:
                    out.append(d)
                patch["last_session"] = session
        for payload in out:
            code = _send(sub, payload)
            if code in (404, 410):
                http.delete(f"{base}/push_subscriptions", params={"endpoint": f"eq.{sub['endpoint']}"}).raise_for_status()
                gone += 1
                patch = {}
                break
            sent += code == 201
        if patch:
            http.patch(f"{base}/push_subscriptions", params={"endpoint": f"eq.{sub['endpoint']}"},
                       content=json.dumps(patch)).raise_for_status()
    return f"{len(subs)} subscribers, {sent} sent" + (f", {gone} expired removed" if gone else "")


if __name__ == "__main__":
    print(run(test=sys.argv[1:] == ["test"]))
