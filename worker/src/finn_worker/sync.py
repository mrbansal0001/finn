"""Push the worker's output to Supabase (runs only when SUPABASE_* env vars are set).

Privacy split (D-020): the public snapshot carries market data only. Every
network line is stripped out of it and stored in private per-user rows
(seeded for demo users from demo_network_lines), readable only by the owner
under row-level security.
"""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[3]
load_dotenv(ROOT / ".env")

PRIVATE_KEYS = ("contacts", "people", "verifiers")


def split(snapshot: dict) -> tuple[dict, dict[str, list]]:
    """(public payload, {card_id: network lines}). Pure; unit-tested."""
    public = copy.deepcopy(snapshot)
    lines: dict[str, list] = {}
    for ed in public["editions"].values():
        for card in ed["leads"] + ed["more"]:
            if card.get("network"):
                lines[card["id"]] = card["network"]
            card["network"] = []
    for sym, ls in snapshot.get("people", {}).items():
        if ls:
            lines[f"company:{sym}"] = ls
    for key, ln in snapshot.get("verifiers", {}).items():
        lines[f"verify:{key}"] = [ln]
    for k in PRIVATE_KEYS:
        public.pop(k, None)
    return public, lines


def _client() -> tuple[httpx.Client, str] | None:
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and key):
        return None
    return httpx.Client(timeout=60, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }), url.rstrip("/") + "/rest/v1"


def _upsert(http: httpx.Client, base: str, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), 500):
        r = http.post(f"{base}/{table}", content=json.dumps(rows[i:i + 500], default=str))
        r.raise_for_status()


def push() -> str:
    c = _client()
    if c is None:
        return "skipped (no Supabase credentials in .env)"
    http, base = c
    snap = json.loads((ROOT / "data" / "snapshot.json").read_text())
    public, lines = split(snap)
    _upsert(http, base, "snapshot", [{"id": "current", "generated_at": snap["generated_at"],
                                      "data_until": snap["data_until"], "payload": public}])
    ledgers = []
    for p in (ROOT / "data" / "ledgers").glob("*.json"):
        payload = json.loads(p.read_text())
        kind = "reference (hand-labelled)" if payload.get("provenance", "").startswith("Reference") else "model-built"
        ledgers.append({"symbol": p.stem, "provenance": kind, "payload": payload})
    if ledgers:
        _upsert(http, base, "ledgers", ledgers)
    net = json.loads((ROOT / "config" / "network.json").read_text())
    _upsert(http, base, "demo_contacts", [{
        "id": c["id"], "name": c["name"],
        "profile": {k: c[k] for k in ("current", "history", "education", "domains", "city", "how_met")},
        "interactions_12m": c["interactions_12m"], "last_contact": c["last_contact"],
        "reciprocity": c["reciprocity"], "rating": c["rating"]} for c in net["contacts"]])
    _upsert(http, base, "demo_edges", net["edges"])
    _upsert(http, base, "demo_network_lines", [{"card_id": k, "lines": v} for k, v in lines.items()])
    uni = json.loads((ROOT / "data" / "universe.json").read_text())
    _upsert(http, base, "universe", [{"symbol": s, "name": n} for s, n in uni])
    return f"snapshot + {len(ledgers)} ledgers + {len(lines)} private network rows"


def exchange_requests() -> str:
    """Bring visitors' coverage requests down to the worker queue; send statuses back."""
    c = _client()
    qp = ROOT / "data" / "requests.json"
    try:
        local = json.loads(qp.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        local = []
    if c is None:
        return f"{len(local)} local requests (no Supabase)"
    http, base = c
    remote = http.get(f"{base}/coverage_requests?select=symbol,status,requested_at,detail").json()
    by = {r["symbol"]: r for r in local}
    for r in remote:
        if r["symbol"] not in by:
            by[r["symbol"]] = {"symbol": r["symbol"], "status": r["status"], "requested_at": r["requested_at"], "detail": r.get("detail")}
    qp.write_text(json.dumps(list(by.values()), indent=1))
    changed = [{"symbol": r["symbol"], "status": r["status"], "detail": r.get("detail"), "requested_at": r["requested_at"]}
               for r in by.values()]
    if changed:
        _upsert(http, base, "coverage_requests", changed)
    return f"{len(remote)} remote / {len(by)} total requests"
