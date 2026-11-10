"""Export what the app shows: Editions per window, results, moves.

Writes data/snapshot.json (local development) -- the same payload sync.py
pushes to Supabase for the deployed app.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from . import cards, prices, store, universe

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

    sessions = prices.history(until.date())
    mv = [{**m.__dict__, "day": m.day.isoformat()} for m in prices.moves(sessions, syms)]

    editions = {k: cards.build(filings, mv, weights, names, until - w, until, res) for k, w in WINDOWS.items()}
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "data_until": until.isoformat(),
        "portfolio": p["holdings"], "research_set": p.get("research_set", []), "names": names,
        "editions": editions, "results": res,
        "prices": {m["symbol"]: m for m in mv},
    }


def main() -> None:
    out = ROOT / "data" / "snapshot.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot(), ensure_ascii=False, indent=1, default=str))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
