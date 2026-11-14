"""Live row-level-security check against the real Supabase project.

Creates two anonymous visitors (A, B) with the public key, then verifies:
  1. each gets their own seeded copy of the network (trigger works)
  2. A cannot read B's contacts or network lines, even when asking for B's owner_id
  3. public market data is readable but not writable by visitors
  4. coverage requests reject non-NSE symbols
Deletes both test users at the end (service key, server side only).

    uv run python -m evals.rls_check
"""
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
URL = os.environ["SUPABASE_URL"].rstrip("/")
PUB = os.environ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
http = httpx.Client(timeout=30)


def anon_user() -> tuple[str, str]:
    r = http.post(f"{URL}/auth/v1/signup", headers={"apikey": PUB, "Content-Type": "application/json"}, json={})
    r.raise_for_status()
    d = r.json()
    return d["access_token"], d["user"]["id"]


def as_user(token: str) -> dict:
    return {"apikey": PUB, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main() -> int:
    ok = True

    def check(name: str, cond: bool, detail: str = "") -> None:
        nonlocal ok
        ok &= cond
        print(f"{'PASS' if cond else 'FAIL'}  {name}{('  (' + detail + ')') if detail else ''}")

    (ta, ida), (tb, idb) = anon_user(), anon_user()
    try:
        a = http.get(f"{URL}/rest/v1/contacts?select=id,owner_id", headers=as_user(ta)).json()
        b = http.get(f"{URL}/rest/v1/contacts?select=id,owner_id", headers=as_user(tb)).json()
        check("A gets a seeded private network", len(a) > 0 and all(r["owner_id"] == ida for r in a), f"{len(a)} contacts")
        check("B gets a separate seeded copy", len(b) > 0 and all(r["owner_id"] == idb for r in b), f"{len(b)} contacts")
        peek = http.get(f"{URL}/rest/v1/contacts?select=id&owner_id=eq.{idb}", headers=as_user(ta)).json()
        check("A cannot read B's contacts, even by owner_id", peek == [], f"{len(peek)} rows")
        peek2 = http.get(f"{URL}/rest/v1/network_lines?select=card_id&owner_id=eq.{idb}", headers=as_user(ta)).json()
        check("A cannot read B's network lines", peek2 == [], f"{len(peek2)} rows")
        # migration 004: a visitor's lines come through my_network_lines (own rows, else the demo template)
        rpc = http.post(f"{URL}/rest/v1/rpc/my_network_lines", headers=as_user(ta), json={})
        if rpc.status_code == 404:      # before 004: per-visitor copies
            lines = http.get(f"{URL}/rest/v1/network_lines?select=card_id&limit=5", headers=as_user(ta)).json()
        else:
            lines = rpc.json() if rpc.status_code == 200 else []
        check("A can read their own network lines", len(lines) > 0, f"{len(lines)} shown")
        anon_rpc = http.post(f"{URL}/rest/v1/rpc/my_network_lines", headers={"apikey": PUB, "Content-Type": "application/json"}, json={})
        check("a caller without a session gets no network lines", anon_rpc.status_code in (401, 403, 404) or anon_rpc.json() == [],
              f"HTTP {anon_rpc.status_code}")
        own = http.post(f"{URL}/rest/v1/contacts", headers=as_user(ta),
                        json={"owner_id": ida, "id": "spam", "name": "x" * 1000, "profile": {}})
        check("visitors cannot write even their own private rows (003)", own.status_code in (401, 403), f"HTTP {own.status_code}")
        who = http.get(f"{URL}/rest/v1/coverage_requests?select=requested_by&limit=1", headers=as_user(ta))
        check("nobody can read who requested coverage (003)", who.status_code in (401, 403), f"HTTP {who.status_code}")
        steal = http.post(f"{URL}/rest/v1/contacts", headers=as_user(ta),
                          json={"owner_id": idb, "id": "x", "name": "planted", "profile": {}})
        check("A cannot write rows owned by B", steal.status_code in (401, 403), f"HTTP {steal.status_code}")
        snap = http.get(f"{URL}/rest/v1/snapshot?select=id", headers=as_user(ta))
        check("public snapshot is readable", snap.status_code == 200 and len(snap.json()) == 1)
        # a no-op write (id set to itself): if a policy ever regressed, nothing on the live demo changes,
        # and the returned rows still show whether the write was allowed (audit F12)
        vandal = http.patch(f"{URL}/rest/v1/snapshot?id=eq.current", headers={**as_user(ta), "Prefer": "return=representation"},
                            json={"id": "current"})
        changed = vandal.json() if vandal.status_code == 200 else []
        check("visitors cannot modify public data", vandal.status_code != 200 or changed == [],
              f"PATCH HTTP {vandal.status_code}, {len(changed) if isinstance(changed, list) else '?'} rows")
        bad = http.post(f"{URL}/rest/v1/coverage_requests", headers=as_user(ta), json={"symbol": "../../ETC", "status": "queued"})
        check("coverage requests reject non-NSE symbols", bad.status_code in (401, 403), f"HTTP {bad.status_code}")
        good = http.post(f"{URL}/rest/v1/coverage_requests", headers={**as_user(ta), "Prefer": "return=minimal"},
                         json={"symbol": "DIXON", "status": "queued"})
        check("coverage requests accept a real NSE symbol", good.status_code in (201, 204, 409), f"HTTP {good.status_code}")
        public_blob = http.get(f"{URL}/rest/v1/snapshot?select=payload", headers=as_user(ta)).text
        names = [r["name"] for r in http.get(f"{URL}/rest/v1/demo_contacts?select=name",
                                             headers={"apikey": SVC, "Authorization": f"Bearer {SVC}"}).json()]
        check("no contact name appears in the public snapshot", not any(n in public_blob for n in names), f"{len(names)} names checked")
        demo = http.get(f"{URL}/rest/v1/demo_contacts?select=id", headers=as_user(ta)).json()
        check("visitors cannot read the demo template table directly", demo == [], f"{len(demo)} rows")

        # migration 005: passages are public company documents (read, never write); push subscriptions are private
        anon = {"apikey": PUB, "Content-Type": "application/json"}
        ps = http.get(f"{URL}/rest/v1/passages?select=symbol&symbol=eq.TITAN&limit=1", headers=anon)
        check("passages are publicly readable (005)", ps.status_code == 200 and len(ps.json()) == 1, f"HTTP {ps.status_code}")
        pw = http.post(f"{URL}/rest/v1/passages", headers=as_user(ta), json={"symbol": "ZZZ", "i": 0, "s": 0, "page": 1, "role": "m", "body": "planted"})
        check("visitors cannot write passages (005)", pw.status_code in (401, 403), f"HTTP {pw.status_code}")
        ask = http.post(f"{URL}/rest/v1/rpc/ask_passages", headers=anon, json={"sym": "TITAN", "q": "gold demand", "k": 3})
        check("ask_passages answers without a session (005)", ask.status_code == 200 and len(ask.json()) > 0, f"HTTP {ask.status_code}")
        sub = lambda n: {"endpoint": f"https://fcm.googleapis.com/fcm/send/rlscheck-{ida}-{n}", "p256dh": "k" * 87, "auth": "a" * 22, "prefs": {"price_pct": 5}}
        mine = [http.post(f"{URL}/rest/v1/push_subscriptions", headers={**as_user(ta), "Prefer": "return=minimal"}, json=sub(n)).status_code for n in range(4)]
        check("a visitor can save up to three push subscriptions, not a fourth (005)", mine[:3] == [201] * 3 and mine[3] in (401, 403), str(mine))
        seen_b = http.get(f"{URL}/rest/v1/push_subscriptions?select=endpoint", headers=as_user(tb)).json()
        check("B cannot read A's push subscriptions (005)", seen_b == [], f"{len(seen_b)} rows")
        seen_anon = http.get(f"{URL}/rest/v1/push_subscriptions?select=endpoint", headers=anon)
        check("no session reads no push subscriptions (005)", seen_anon.status_code in (401, 403) or seen_anon.json() == [], f"HTTP {seen_anon.status_code}")
        forged = http.post(f"{URL}/rest/v1/push_subscriptions", headers=as_user(tb), json={**sub(9), "user_id": ida})
        check("B cannot subscribe in A's name (005)", forged.status_code in (401, 403), f"HTTP {forged.status_code}")
        # migration 006: endpoints limited to browser push services; visitors can change their rules only
        svc_h = {"apikey": SVC, "Authorization": f"Bearer {SVC}", "Content-Type": "application/json"}
        cur = http.post(f"{URL}/rest/v1/rpc/replace_company_passages", headers=svc_h, json={"sym": "ZZRLSCHECK", "srcs": [], "rows": []})
        if cur.status_code == 404:
            print("NOTE  migration 006 not applied yet: its two checks are skipped")
        else:
            evil = http.post(f"{URL}/rest/v1/push_subscriptions", headers=as_user(tb), json={**sub(8), "endpoint": f"https://evil.example/{idb}"})
            check("only browser push services can be saved (006)", evil.status_code in (400, 401, 403), f"HTTP {evil.status_code}")
            cursor = http.patch(f"{URL}/rest/v1/push_subscriptions?endpoint=eq.{sub(0)['endpoint']}",
                                headers={**as_user(ta), "Prefer": "return=representation"}, json={"last_session": "2099-01-01"})
            check("visitors cannot edit delivery cursors (006)", cursor.status_code in (401, 403), f"HTTP {cursor.status_code}")
    finally:
        svc = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}
        http.delete(f"{URL}/rest/v1/coverage_requests?symbol=eq.DIXON&requested_by=eq.{ida}", headers=svc)
        for uid in (ida, idb):
            http.delete(f"{URL}/auth/v1/admin/users/{uid}", headers=svc)
        # the cascade should have removed A's test subscriptions with the user; say so if it didn't
        left = http.get(f"{URL}/rest/v1/push_subscriptions?select=endpoint&endpoint=like.*rlscheck*", headers=svc).json()
        check("deleting a visitor deletes their push subscriptions (005 cascade)", left == [], f"{len(left)} left")
        print("test users deleted")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
