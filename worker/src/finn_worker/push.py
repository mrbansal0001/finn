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
import re
import sys
from urllib.parse import urlparse
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

import httpx
from dotenv import load_dotenv

from .cards import plain_subject

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")

IST = ZoneInfo("Asia/Kolkata")
KIND_WORD = {"results": "Results", "m_and_a": "Deal", "management_change": "Management change"}
DEFAULT = {"price_pct": 5, "volume_x": 2, "alert_kinds": list(KIND_WORD)}


# Browser push services only (full review F08): a visitor-supplied endpoint is an outbound request from the worker,
# so it must be a known push service over HTTPS, checked here at send time as well as when it is saved.
PUSH_HOSTS = re.compile(r"^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|"
                        r"[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)$")


def allowed_endpoint(url: str) -> bool:
    try:
        u = urlparse(url)
    except ValueError:
        return False
    return u.scheme == "https" and bool(u.hostname) and bool(PUSH_HOSTS.match(u.hostname)) and u.port in (None, 443)


def rules(raw: dict | None) -> dict:
    """The subscriber's rules, typed and bounded (full review F10): a bad value falls back to the default for that
    field only, and an empty list of filing kinds means none, not all."""
    raw = raw if isinstance(raw, dict) else {}

    def num(key: str, lo: float, hi: float) -> float:
        try:
            v = float(raw.get(key, DEFAULT[key]))
        except (TypeError, ValueError):
            v = float(DEFAULT[key])
        return min(hi, max(lo, v))
    kinds = raw.get("alert_kinds", DEFAULT["alert_kinds"])
    kinds = [k for k in kinds if k in KIND_WORD] if isinstance(kinds, list) else list(DEFAULT["alert_kinds"])
    return {"price_pct": num("price_pct", 1, 15), "volume_x": num("volume_x", 1.2, 6), "alert_kinds": kinds}


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
    p, v = float(prefs["price_pct"]), float(prefs["volume_x"])
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
    kinds = set(prefs.get("alert_kinds", []))          # [] means no filing alerts (F10)
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
            "body": (c.get("headline") or plain_subject(c.get("nse_subject") or ""))[:180],
            "url": f"/card/{c['id']}", "tag": f"filing-{c['id']}"}


def _send(sub: dict, payload: dict) -> int:
    from pywebpush import WebPushException, webpush
    try:
        webpush(subscription_info={"endpoint": sub["endpoint"], "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
                data=json.dumps(payload), vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
                vapid_claims={"sub": os.getenv("VAPID_SUBJECT") or "https://finn-red.vercel.app"},
                ttl=6 * 3600, timeout=10)
        return 201
    except WebPushException as e:
        return e.response.status_code if e.response is not None else 0
    except Exception:          # a network error or timeout: retry next cycle
        return 0


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
    sent = gone = failed = skipped = 0
    for sub in subs:
        # one subscriber's bad record or failed send never stops the others (full review F10)
        try:
            if not allowed_endpoint(sub.get("endpoint") or ""):
                skipped += 1                       # not a browser push service: never sent to (F08)
                continue
            r = _one(http, base, sub, snap, session, test)
            sent += r["sent"]; gone += r["gone"]; failed += r["failed"]
        except Exception:
            failed += 1
    return (f"{len(subs)} subscribers, {sent} sent" + (f", {gone} expired removed" if gone else "")
            + (f", {failed} to retry" if failed else "") + (f", {skipped} not a push service" if skipped else ""))


def _ist(ts: str) -> str:
    return datetime.fromisoformat(ts).astimezone(IST).strftime("%Y-%m-%dT%H:%M:%S")


def _one(http, base: str, sub: dict, snap: dict, session: str | None, test: bool) -> dict:
    """Send what is due to one subscriber and acknowledge only what was delivered (full review F09): the filing cursor
    moves to the last filing actually sent, a failed send is retried next cycle, an expired endpoint is removed."""
    prefs = rules(sub.get("prefs"))
    res = {"sent": 0, "gone": 0, "failed": 0}
    where = {"endpoint": f"eq.{sub['endpoint']}"}

    def deliver(payload: dict) -> bool | None:
        code = _send(sub, payload)
        if code in (404, 410):
            http.delete(f"{base}/push_subscriptions", params=where).raise_for_status()
            res["gone"] += 1
            return None                            # endpoint gone: stop
        if code in (200, 201, 202):
            res["sent"] += 1
            return True
        res["failed"] += 1
        return False

    if test:
        deliver({"title": "FINN notifications work", "body": "You'll hear about filings you chose and your alerts at the close.",
                 "url": "/settings#notify", "tag": "test"})
        return res
    patch: dict = {}
    # a new subscriber gets what arrived after they subscribed, nothing older (F09: not "after the first pass")
    after = _ist(sub["last_filing_at"]) if sub.get("last_filing_at") else _ist(sub["created_at"])
    new = filed(snap, prefs, after)
    shown, rest = new[-3:], new[:-3]
    if rest:                                       # a burst: say how many more, rather than imply all were sent
        ok = deliver({"title": f"{len(new)} filings for your holdings", "body": f"The latest three follow; {len(rest)} more are in FINN.",
                      "url": "/?w=24h", "tag": f"burst-{new[-1]['id']}"})
        if ok is None:
            return res
        if ok:
            patch["last_filing_at"] = f"{rest[-1]['at']}+05:30"
    for c in shown:
        ok = deliver(_note(c))
        if ok is None:
            return res
        if not ok:
            break                                  # keep the cursor at the last one delivered; retry the rest
        patch["last_filing_at"] = f"{c['at']}+05:30"
    if not new and not sub.get("last_filing_at"):
        patch["last_filing_at"] = sub["created_at"]
    if session and session != sub.get("last_session"):
        # a subscriber who joined after this session's close isn't sent its digest (it predates them)
        joined_after = _ist(sub["created_at"]) > f"{session}T15:30:00"
        d = None if joined_after else close_digest(snap, prefs, session)
        ok = deliver(d) if d else True
        if ok is None:
            return res
        if ok:
            patch["last_session"] = session
    if patch:
        http.patch(f"{base}/push_subscriptions", params=where, content=json.dumps(patch)).raise_for_status()
    return res


if __name__ == "__main__":
    print(run(test=sys.argv[1:] == ["test"]))
