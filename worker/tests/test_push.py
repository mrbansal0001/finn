"""Push delivery boundaries (full review F08-F10): acknowledge only what was delivered, isolate subscribers,
send only to browser push services, and read rules strictly."""
import json

from finn_worker import push

SNAP = {
    "portfolio": [{"symbol": "ABC"}],
    "editions": {"24h": {"leads": [], "more": [
        {"id": "c1", "kind": "results", "symbol": "ABC", "at": "2026-11-14T10:00:00", "headline": "Results filed"},
        {"id": "c2", "kind": "m_and_a", "symbol": "ABC", "at": "2026-11-14T11:00:00", "headline": "Deal filed"},
    ]}},
    "move_cards": [],
}


class FakeHTTP:
    def __init__(self):
        self.patches, self.deletes = [], []

    def patch(self, url, params=None, content=None):
        self.patches.append((params, json.loads(content)))
        return self

    def delete(self, url, params=None):
        self.deletes.append(params)
        return self

    def raise_for_status(self):
        return None


def sub(**kw):
    base = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "p256dh": "k", "auth": "a",
            "prefs": {"price_pct": 5, "volume_x": 2, "alert_kinds": ["results", "m_and_a"]},
            "created_at": "2026-11-14T00:00:00+05:30", "last_filing_at": "2026-11-14T09:00:00+05:30", "last_session": "2026-11-13"}
    base.update(kw)
    return base


def test_a_failed_send_keeps_the_cursor_so_it_is_retried(monkeypatch):
    monkeypatch.setattr(push, "_send", lambda s, p: 503)
    http = FakeHTTP()
    r = push._one(http, "", sub(), SNAP, "2026-11-13", False)
    assert r["failed"] == 1 and r["sent"] == 0
    assert all("last_filing_at" not in body for _, body in http.patches)


def test_the_cursor_stops_at_the_last_delivered_filing(monkeypatch):
    codes = iter([201, 503])
    monkeypatch.setattr(push, "_send", lambda s, p: next(codes))
    http = FakeHTTP()
    push._one(http, "", sub(), SNAP, "2026-11-13", False)
    assert http.patches[-1][1]["last_filing_at"] == "2026-11-14T10:00:00+05:30"


def test_an_expired_endpoint_is_removed(monkeypatch):
    monkeypatch.setattr(push, "_send", lambda s, p: 410)
    http = FakeHTTP()
    r = push._one(http, "", sub(), SNAP, "2026-11-13", False)
    assert r["gone"] == 1 and http.deletes and not http.patches


def test_empty_filing_kinds_means_none_and_bad_numbers_fall_back():
    rules = push.rules({"price_pct": "not-a-number", "alert_kinds": []})
    assert rules["alert_kinds"] == [] and rules["price_pct"] == 5.0
    assert push.filed(SNAP, rules, "2026-11-14T00:00:00") == []
    assert push.rules({})["alert_kinds"] == push.DEFAULT["alert_kinds"]       # missing is not empty


def test_a_new_subscriber_gets_only_what_came_after_subscribing(monkeypatch):
    seen = []
    monkeypatch.setattr(push, "_send", lambda s, p: seen.append(p["tag"]) or 201)
    push._one(FakeHTTP(), "", sub(last_filing_at=None, last_session=None, created_at="2026-11-14T10:30:00+05:30"), SNAP, "2026-11-13", False)
    assert seen == ["filing-c2"]


def test_only_browser_push_services_are_sent_to():
    assert push.allowed_endpoint("https://fcm.googleapis.com/fcm/send/x")
    assert push.allowed_endpoint("https://web.push.apple.com/abc")
    for bad in ("https://evil.example/x", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x",
                "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.example/x"):
        assert not push.allowed_endpoint(bad)
