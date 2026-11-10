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
    ledgers = [{"symbol": p.stem, "provenance": "reference (hand-labelled)", "payload": json.loads(p.read_text())}
               for p in (ROOT / "data" / "ledgers").glob("*.json")]
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
    return f"snapshot + {len(ledgers)} ledgers + {len(lines)} private network rows"
