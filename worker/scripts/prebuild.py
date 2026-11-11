"""Pre-build Promises ledgers for an index so "any NSE ticker" works before anyone asks (PLAN §5 layer 1).

    OPENAI_BUDGET_USD=2.5 uv run python scripts/prebuild.py nifty50 [nifty100]

Skips tickers that already have a ledger, stops cleanly when the model is unavailable (free-tier
quota), and is resumable: model responses are cached, so a rerun only pays for what is new.
A lower OPENAI_BUDGET_USD for this process caps the paid fallback (only used when Gemini is overloaded),
keeping the rest of the budget for filings that name people.
"""
import csv
import io
import json
import sys
import time
from datetime import datetime
from pathlib import Path

from finn_worker import fetch, llm, pull

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "ledgers"
LOG = ROOT / "data" / "logs" / "prebuild.log"
PATIENCE, PAUSE = 6, 60       # up to 6 min of waiting per ticker before giving up
INDEX = {"nifty50": "ind_nifty50list.csv", "nifty100": "ind_nifty100list.csv"}


def members(name: str) -> list[str]:
    b = fetch.get(f"https://nsearchives.nseindia.com/content/indices/{INDEX[name]}")
    return [r["Symbol"] for r in csv.DictReader(io.StringIO(b.decode("utf-8-sig")))]


def log(msg: str) -> None:
    line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
    print(line, flush=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def build_one(s: str) -> dict | None:
    """Ledger for one ticker, waiting out model overload. None = skip this ticker; raises StopBatch to stop."""
    for attempt in range(PATIENCE):
        try:
            if not pull.discover(s):
                log(f"{s}: no transcripts found, skipped")
                return None
            return pull.build(s)
        except llm.LLMUnavailable as e:
            # overload passes in minutes; a daily quota doesn't. Cached calls aren't repaid on retry.
            log(f"{s}: model unavailable (attempt {attempt + 1}/{PATIENCE}): {str(e)[:100]}")
            time.sleep(PAUSE)
        except fetch.Refused as e:
            # exchanges and screener refusing means stop and respect it; one company's own site refusing
            # one transcript only means skip that company
            if any(h in str(e) for h in ("nseindia", "bseindia", "screener.in")):
                raise StopBatch(f"source refused ({e})") from e
            log(f"{s}: skipped, a source refused ({str(e)[:120]})")
            return None
        except Exception as e:  # one bad ticker must not stop the batch
            log(f"{s}: failed {type(e).__name__}: {str(e)[:160]}")
            return None
    raise StopBatch("model still unavailable")


class StopBatch(RuntimeError):
    pass


def main(indices: list[str]) -> None:
    syms = list(dict.fromkeys(s for ix in indices for s in members(ix)))
    OUT.mkdir(parents=True, exist_ok=True)
    for s in syms:
        if (OUT / f"{s}.json").exists():
            continue
        t = time.time()
        try:
            ledger = build_one(s)
        except StopBatch as e:
            log(f"{s}: stopping: {e}")
            return
        if ledger is None:
            continue
        (OUT / f"{s}.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=1))
        log(f"{s}: {len(ledger['rows'])} rows in {time.time() - t:.0f}s")


if __name__ == "__main__":
    main(sys.argv[1:] or ["nifty50"])
