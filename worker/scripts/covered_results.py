"""Latest checked results table for every company with a ledger (Pull's financial snapshot; review 1.5).

    OPENAI_BUDGET_USD=2.5 uv run python scripts/covered_results.py

For each covered company without a stored results table: a 60-day per-company backfill of its NSE
filings (the residential worker), then the newest results filing is read with the same checks as the
portfolio (column identity, consolidated first, XBRL when present). Failed tables are stored as failed
and never shown. Resumable; model calls are cached.
"""
import json
from datetime import datetime
from pathlib import Path

from finn_worker import fetch, ingest, llm, reader, store

ROOT = Path(__file__).resolve().parents[2]
LOG = ROOT / "data" / "logs" / "covered_results.log"


def log(msg: str) -> None:
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def main() -> None:
    con = store.connect()
    have = {r[0] for r in con.execute("select distinct symbol from results where source='pdf'")}
    syms = [f.stem for f in sorted((ROOT / "data" / "ledgers").glob("*.json")) if f.stem not in have]
    for s in syms:
        try:
            ingest.backfill([s], 60)
        except fetch.Refused as e:
            log(f"{s}: exchange refused, stopping ({e})")
            return
        f = con.execute("select * from filings where symbol=? and category='results' and link like '%.pdf' "
                        "order by published_at desc limit 1", (s,)).fetchone()
        # a results outcome filed with a bare summary ('Outcome of the Board Meeting') isn't tagged by the
        # rules; try the newest board outcome -- the read finds no P&L and stores nothing if it isn't one
        f = f or con.execute("select * from filings where symbol=? and subject like 'Outcome of Board Meeting%' "
                             "and link like '%.pdf' order by published_at desc limit 1", (s,)).fetchone()
        if not f:
            log(f"{s}: no results filing in 60 days")
            continue
        try:
            st = reader.read_results(con, dict(f))
        except llm.LLMUnavailable as e:
            log(f"{s}: model unavailable, stopping ({str(e)[:80]})")
            return
        except Exception as e:
            st = f"error {type(e).__name__}: {str(e)[:100]}"
        log(f"{s}: {st}")


if __name__ == "__main__":
    main()
