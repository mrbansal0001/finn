"""Export what the app shows: Editions per window, results, moves.

Writes data/snapshot.json (local development) -- the same payload sync.py
pushes to Supabase for the deployed app.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from . import cards, network, prices, store, universe

ROOT = Path(__file__).resolve().parents[3]
WINDOWS = {"24h": timedelta(hours=24), "3d": timedelta(days=3), "7d": timedelta(days=7), "30d": timedelta(days=30)}


def portfolio() -> dict:
    return json.loads((ROOT / "config" / "portfolio.json").read_text())


def snapshot(until: datetime | None = None) -> dict:
    p = portfolio()
    syms = [h["symbol"] for h in p["holdings"]]
    weights = {h["symbol"]: h["weight"] for h in p["holdings"]}
    u = universe.load()
    names = {s: u[s].name for s in syms + p.get("research_set", []) if s in u}
    con = store.connect()
    q = ",".join("?" * len(syms))
    filings = [dict(r) for r in con.execute(f"select * from filings where symbol in ({q})", syms)]
    until = until or max(datetime.fromisoformat(f["published_at"]) for f in filings)

    res = {}
    for r in con.execute(f"select * from results where symbol in ({q}) order by period_end", syms):
        # consolidated preferred (D-021); later rows (newer periods) overwrite older
        if r["symbol"] in res and r["nature"] != "Consolidated" and res[r["symbol"]]["nature"] == "Consolidated":
            continue
        res[r["symbol"]] = {"period_end": r["period_end"], "nature": r["nature"], "reporting": r["reporting"],
                            "source": r["source"], "source_url": r["source_url"], "check": r["check_status"],
                            "values": json.loads(r["values_json"]),
                            "comparatives": json.loads(r["comparatives_json"]) if r["comparatives_json"] else None}

    sessions = prices.history(until.date(), trading_days=42, max_calendar_days=70)
    latest = [{**m.__dict__, "day": m.day.isoformat()} for m in prices.moves(sessions, syms)]
    mv = [{**m.__dict__, "day": m.day.isoformat()} for m in prices.moves_series(sessions, syms)]

    editions = {k: cards.build(filings, mv, weights, names, until - w, until, res) for k, w in WINDOWS.items()}

    # The Network, inside Push and Pull (D-023). Local and deterministic.
    contacts, edges = network.load()
    today = until.date()
    for ed in editions.values():
        network.annotate(ed["leads"] + ed["more"], today, contacts, edges)
    people = {s: network.second_degree(network.for_company(s, contacts, today), contacts, edges, today)
              for s in names}
    verifiers = {}
    for lp in (ROOT / "data" / "ledgers").glob("*.json"):
        led = json.loads(lp.read_text())
        for row in led["rows"]:
            text = f"{row['title']} {row.get('metric', '')}"
            cands = [l for l in network.for_company(led["symbol"], contacts, today, kind="", text=text) if not l["insider"]]
            if cands:
                verifiers[f"{led['symbol']}:{row['id']}"] = cands[0]
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "data_until": until.isoformat(),
        "portfolio": p["holdings"], "research_set": p.get("research_set", []), "names": names,
        "editions": editions, "results": res, "people": people, "verifiers": verifiers,
        # private to the owner; in production this lives behind Supabase row-level security
        "contacts": json.loads((ROOT / "config" / "network.json").read_text())["contacts"],
        "prices": {m["symbol"]: m for m in latest},
    }


def main() -> None:
    out = ROOT / "data" / "snapshot.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot(), ensure_ascii=False, indent=1, default=str))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
