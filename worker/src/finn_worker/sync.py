"""Push the worker's output to Supabase (runs only when SUPABASE_* env vars are set).

Privacy split (D-020): the public snapshot carries market data only. Every
network line is stripped out of it and stored in private per-user rows
(seeded for demo users from demo_network_lines), readable only by the owner
under row-level security.
"""
from __future__ import annotations

import copy
from datetime import datetime, timezone
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
        machine = ROOT / "data" / "ledgers_model" / p.name
        if kind.startswith("reference") and machine.exists():
            # show what the pipeline builds by default; the hand-checked ledger rides along to compare against
            ref = payload
            payload = json.loads(machine.read_text())
            payload["reference"] = {"rows": ref["rows"], "calls": ref["calls"], "provenance": ref["provenance"]}
            kind = "model-built (with hand-checked reference)"
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
    # demo visitors read these template rows directly (migration 004); rows for cards that no longer
    # exist are pruned by their refresh time (before 004 the column doesn't exist: plain upsert)
    run_at = datetime.now(timezone.utc).isoformat()
    rows = [{"card_id": k, "lines": v, "refreshed_at": run_at} for k, v in lines.items()]
    try:
        _upsert(http, base, "demo_network_lines", rows)
        if rows:
            http.delete(f"{base}/demo_network_lines", params={"refreshed_at": f"lt.{run_at}"}).raise_for_status()
    except httpx.HTTPStatusError:
        _upsert(http, base, "demo_network_lines", [{"card_id": r["card_id"], "lines": r["lines"]} for r in rows])
    uni = json.loads((ROOT / "data" / "universe.json").read_text())
    _upsert(http, base, "universe", [{"symbol": s, "name": n} for s, n in uni])
    # no per-visitor copies to refresh since migration 004 (they timed out at 346 visitors)
    return f"snapshot + {len(ledgers)} ledgers + {len(lines)} demo network rows"


def passages() -> str:
    """Upload companies whose passages changed since the last upload (migration 005). A company's rows are
    replaced whole, so a rebuilt company never mixes old and new passage numbers."""
    c = _client()
    if c is None:
        return "skipped (no Supabase credentials in .env)"
    http, base = c
    mark_p = ROOT / "data" / "passages_synced.json"
    marks = json.loads(mark_p.read_text()) if mark_p.exists() else {}
    done = []
    for f in sorted((ROOT / "data" / "passages").glob("*.json")):
        d = json.loads(f.read_text())
        if marks.get(d["symbol"]) == d["built"]:
            continue
        sym = d["symbol"]
        # one transaction per company when migration 006 is applied (full review F13): readers see the old set or
        # the new one, never a company half deleted
        rpc = http.post(f"{base}/rpc/replace_company_passages", content=json.dumps({
            "sym": sym, "srcs": [{"i": i, **src} for i, src in enumerate(d["sources"])],
            "rows": [{"i": i, "s": p["s"], "page": p["p"], "who": p["who"] or "", "role": p["r"], "body": p["t"]}
                     for i, p in enumerate(d["passages"])]}))
        if rpc.status_code < 300:
            marks[sym] = d["built"]
            mark_p.write_text(json.dumps(marks, indent=1))
            done.append(sym)
            continue
        if rpc.status_code != 404:
            rpc.raise_for_status()
        r = http.delete(f"{base}/passages", params={"symbol": f"eq.{sym}"})
        if r.status_code == 404:          # PGRST205: the table doesn't exist until migration 005 is applied
            return "skipped (apply migration 005 to create the passages table)"
        r.raise_for_status()
        http.delete(f"{base}/passage_sources", params={"symbol": f"eq.{sym}"}).raise_for_status()
        _upsert(http, base, "passage_sources", [{"symbol": sym, "i": i, **src} for i, src in enumerate(d["sources"])])
        _upsert(http, base, "passages", [{"symbol": sym, "i": i, "s": p["s"], "page": p["p"], "who": p["who"],
                                          "role": p["r"], "body": p["t"]} for i, p in enumerate(d["passages"])])
        marks[sym] = d["built"]
        mark_p.write_text(json.dumps(marks, indent=1))
        done.append(sym)
    return f"{len(done)} companies uploaded" if done else "nothing changed"


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
    valid = {s for s, _ in json.loads((ROOT / "data" / "universe.json").read_text())}
    by = {r["symbol"]: r for r in local}
    for r in remote:
        if r["symbol"] not in valid:      # defence in depth: the SQL policy already checks this
            continue
        if r["symbol"] not in by:
            by[r["symbol"]] = {"symbol": r["symbol"], "status": r["status"], "requested_at": r["requested_at"], "detail": r.get("detail")}
    qp.write_text(json.dumps(list(by.values()), indent=1))
    # a finished build carries no leftover "waiting for model…" note from an earlier attempt
    changed = [{"symbol": r["symbol"], "status": r["status"], "detail": None if r["status"] == "ready" else r.get("detail"),
                "requested_at": r["requested_at"]} for r in by.values()]
    if changed:
        _upsert(http, base, "coverage_requests", changed)
    return f"{len(remote)} remote / {len(by)} total requests"
