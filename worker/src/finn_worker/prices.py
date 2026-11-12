"""End-of-day prices from NSE's daily UDiFF bhavcopy (one zip, all stocks).

The volume alert compares a day's volume with the average of the previous 20
trading days, so we keep ~25 days of files. Each file is cached forever.
Holidays return 404 and are skipped.
"""
from __future__ import annotations

import csv
import io
import zipfile
from dataclasses import dataclass
from datetime import date, timedelta

import httpx

from . import fetch

URL = "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{d:%Y%m%d}_F_0000.csv.zip"


@dataclass(frozen=True)
class Bar:
    symbol: str
    day: date
    open: float
    high: float
    low: float
    close: float
    prev_close: float
    volume: int
    turnover: float


def _closed_marker(d: date):
    return fetch.DATA_DIR / "closed_days" / f"{d:%Y%m%d}"


def bhavcopy(d: date) -> dict[str, Bar] | None:
    """All EQ/BE-series bars for one day, or None if the market was shut."""
    if _closed_marker(d).exists():
        return None
    try:
        raw = fetch.get(URL.format(d=d))
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            # a weekday with no file days later = holiday; remember, don't re-ask (a file published late
            # on the day itself must not be remembered as a closure)
            if d < date.today() - timedelta(days=3):
                _closed_marker(d).parent.mkdir(parents=True, exist_ok=True)
                _closed_marker(d).touch()
            return None
        raise
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        text = z.read(z.namelist()[0]).decode("utf-8", errors="replace")
    bars: dict[str, Bar] = {}
    for r in csv.DictReader(io.StringIO(text)):
        if r.get("SctySrs") not in ("EQ", "BE", "BZ"):
            continue
        try:
            bars[r["TckrSymb"]] = Bar(
                symbol=r["TckrSymb"], day=d,
                open=float(r["OpnPric"]), high=float(r["HghPric"]), low=float(r["LwPric"]),
                close=float(r["ClsPric"]), prev_close=float(r["PrvsClsgPric"]),
                volume=int(float(r["TtlTradgVol"])), turnover=float(r["TtlTrfVal"]),
            )
        except (KeyError, ValueError):
            continue
    return bars


def history(end: date, trading_days: int = 21, max_calendar_days: int = 45) -> list[dict[str, Bar]]:
    """The last `trading_days` sessions up to and including `end`, oldest first."""
    days: list[dict[str, Bar]] = []
    d = end
    while len(days) < trading_days and (end - d).days <= max_calendar_days:
        if d.weekday() < 5:  # NSE's occasional Sunday sessions (Muhurat) are ignored
            try:
                bars = bhavcopy(d)
            except fetch.Refused:
                raise              # refused: stop asking (never retry around a refusal)
            except Exception:
                bars = None        # timeout / 5xx on one day: skip it, don't mark it a holiday
            if bars:
                days.append(bars)
        d -= timedelta(days=1)
    return list(reversed(days))


@dataclass(frozen=True)
class Move:
    symbol: str
    day: date
    close: float
    change_pct: float          # vs previous close
    volume: int
    volume_multiple: float     # vs average of the previous 20 sessions
    price_alert: bool
    volume_alert: bool
    baseline_n: int = 20       # sessions behind the volume average (a recent listing has fewer)


def moves(sessions: list[dict[str, Bar]], symbols: list[str], *,
          price_pct: float = 5.0, volume_x: float = 2.0) -> list[Move]:
    """Evaluate the user's thresholds on the latest session (defaults: +/-5%, 2x volume)."""
    if not sessions:
        return []
    today, past = sessions[-1], sessions[:-1][-20:]
    out = []
    for s in symbols:
        bar = today.get(s)
        if not bar or not bar.prev_close:
            continue
        vols = [day[s].volume for day in past if s in day]
        avg = sum(vols) / len(vols) if vols else 0.0
        chg = (bar.close / bar.prev_close - 1) * 100
        mult = bar.volume / avg if avg else 0.0
        out.append(Move(s, bar.day, bar.close, round(chg, 2), bar.volume, round(mult, 2),
                        price_alert=abs(chg) >= price_pct, volume_alert=mult >= volume_x, baseline_n=len(vols)))
    return out


def moves_series(sessions: list[dict[str, Bar]], symbols: list[str], *, days: int = 22,
                 floor_pct: float = 1.0, floor_x: float = 1.2) -> list[Move]:
    """Moves for each of the last `days` sessions, each judged against its own previous 20.

    Exported at the lowest thresholds the settings allow (1%, 1.2x; lib/prefs.ts); the app applies the
    investor's own (D-027), so 'unusual' is theirs to define and nothing they could ask for is cut here."""
    out: list[Move] = []
    for i in range(max(1, len(sessions) - days), len(sessions)):
        window = sessions[max(0, i - 20): i + 1]
        for m in moves(window, symbols, price_pct=floor_pct, volume_x=floor_x):
            if m.price_alert or m.volume_alert:
                out.append(m)
    return out


def calendar(sessions: list[dict[str, Bar]]) -> list[str]:
    """Every session the exchange traded, quiet ones included (ISO dates, oldest first)."""
    return [next(iter(day.values())).day.isoformat() for day in sessions if day]
