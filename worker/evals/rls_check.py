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
        lines = http.get(f"{URL}/rest/v1/network_lines?select=card_id&limit=5", headers=as_user(ta)).json()
        check("A can read their own network lines", len(lines) > 0, f"{len(lines)} shown")
        steal = http.post(f"{URL}/rest/v1/contacts", headers=as_user(ta),
                          json={"owner_id": idb, "id": "x", "name": "planted", "profile": {}})
        check("A cannot write rows owned by B", steal.status_code in (401, 403), f"HTTP {steal.status_code}")
        snap = http.get(f"{URL}/rest/v1/snapshot?select=id", headers=as_user(ta))
        check("public snapshot is readable", snap.status_code == 200 and len(snap.json()) == 1)
        vandal = http.patch(f"{URL}/rest/v1/snapshot?id=eq.current", headers=as_user(ta), json={"payload": {}})
        still = http.get(f"{URL}/rest/v1/snapshot?select=payload->>generated_at", headers={"apikey": SVC, "Authorization": f"Bearer {SVC}"}).json()
        check("visitors cannot modify public data", bool(still and still[0].get("generated_at")), f"PATCH HTTP {vandal.status_code}")
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
    finally:
        svc = {"apikey": SVC, "Authorization": f"Bearer {SVC}"}
        http.delete(f"{URL}/rest/v1/coverage_requests?symbol=eq.DIXON&requested_by=eq.{ida}", headers=svc)
        for uid in (ida, idb):
            http.delete(f"{URL}/auth/v1/admin/users/{uid}", headers=svc)
        print("test users deleted")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
