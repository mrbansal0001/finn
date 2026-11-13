"""Scheduled worker entry point (runs on a residential machine, D-017/D-026).

    uv run python -m finn_worker.run once     # one cycle (launchd calls this every 15 min)
    uv run python -m finn_worker.run backfill # per-company history for the portfolio

A cycle: poll the announcements feed, poll the results feed (XBRL), read any
filings that need reading (when a model key is configured), rebuild the
snapshot, and sync to Supabase (when configured). Every step is independent:
one failing source never blocks the others.
"""
from __future__ import annotations

import json
import logging
import sys
import time
import traceback
from datetime import date, datetime, timedelta
from pathlib import Path

from . import export, ingest, store

ROOT = Path(__file__).resolve().parents[3]
LOG_DIR = ROOT / "data" / "logs"
STATE = ROOT / "data" / "worker_state.json"

log = logging.getLogger("finn")


def _state() -> dict:
    try:
        return json.loads(STATE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_state(s: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(s, indent=1))


LAST_OK: dict[str, str] = {}   # step -> when it last succeeded (an attempt is not freshness; audit F09)


def step(name: str, fn, *args, **kwargs):
    t0 = time.monotonic()
    try:
        out = fn(*args, **kwargs)
        log.info("%-16s ok   %6.1fs  %s", name, time.monotonic() - t0, out)
        LAST_OK[name] = datetime.now().isoformat(timespec="seconds")
        return out
    except Exception as e:  # keep the cycle going
        log.error("%-16s FAIL %6.1fs  %s: %s", name, time.monotonic() - t0, type(e).__name__, e)
        log.debug(traceback.format_exc())
        return None


def once() -> None:
    state = _state()
    step("announcements", ingest.poll)
    step("results_xbrl", ingest.poll_results)

    # daily per-company backfill catches anything the 1-day RSS window missed
    today = date.today().isoformat()
    if state.get("backfill_day") != today:
        pf = export.portfolio()
        syms = [h["symbol"] for h in pf["holdings"]] + pf.get("research_set", [])
        if step("backfill", ingest.backfill, syms, 30) is not None:
            state["backfill_day"] = today

    # model-dependent steps run only when a key is configured
    try:
        from . import reader  # noqa: WPS433 (optional until the model key exists)
        step("read_filings", reader.read_pending)
    except ImportError:
        pass

    from . import pull, sync as _sync
    step("requests_in", _sync.exchange_requests)
    step("coverage_queue", pull.drain_requests)
    step("requests_out", _sync.exchange_requests)      # a finished build's status goes out now, not next cycle
    # five-year trajectory for any newly covered company (one model call per report, cached)
    from . import trajectory
    step("trajectory", trajectory.run)
    # success times are saved before the export so the snapshot can say what is fresh and what isn't
    state["last_ok"] = {**state.get("last_ok", {}), **LAST_OK}
    _save_state(state)
    step("export", export.main)
    try:
        from . import sync
        step("sync", sync.push)
        # "Ask the documents": rebuild companies whose ledger changed (five a cycle), upload what changed
        from . import passages
        step("passages", passages.run, None, 5)
        step("passages_sync", sync.passages)
        # push at the close and on chosen filings, to visitors who switched notifications on
        from . import push
        step("push", push.run)
    except ImportError:
        pass
    state["last_cycle"] = datetime.now().isoformat(timespec="seconds")      # attempted
    state["last_ok"] = {**state.get("last_ok", {}), **LAST_OK}
    _save_state(state)


def main(argv: list[str]) -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(LOG_DIR / "worker.log"), logging.StreamHandler()],
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    cmd = argv[1] if len(argv) > 1 else "once"
    if cmd == "once":
        once()
    elif cmd == "backfill":
        syms = [h["symbol"] for h in export.portfolio()["holdings"]] + export.portfolio().get("research_set", [])
        step("backfill", ingest.backfill, syms, int(argv[2]) if len(argv) > 2 else 30)
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
