"""Passages for "Ask the documents" (brief-check plan, part 5).

The paragraphs of a covered company's last four earnings-call transcripts and its annual report's MD&A,
page by page, with who said them. The app searches these deterministically and answers only with them:
quotes with their page links, or "the documents don't say". Nothing here goes to a model, and nothing
outside the company's own documents is included, so an answer can't lean on outside knowledge.

    uv run python -m finn_worker.passages            # build any missing or stale (after its ledger changed)
    uv run python -m finn_worker.passages BEL TITAN  # rebuild these

Each company is one JSON file in data/passages/ (gitignored; public company documents), synced to the
public `passages` table (migration 005).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from types import SimpleNamespace
from pathlib import Path

from . import docs, pull

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "data" / "passages"

SPEAKER = re.compile(r"^\s*([A-Z][A-Za-z.'’()&\- ]{1,60}?)\s*:\s*$|^\s*(Moderator)\s*$")
NOT_SPEAKERS = {"date", "time", "page", "note", "notes", "venue", "place", "participants", "management", "disclaimer", "source", "sub", "subject", "ref", "to", "dear", "encl", "cc", "website", "symbol", "scrip code", "scrip", "isin", "series", "kind attn", "attn"}
INLINE_SPEAKER = re.compile(r"^\s*([A-Z][A-Za-z.'’&\- ]{1,40}?):\s+(\S.*)$")
BARE = re.compile(r"^\s*((?:Moderator)|(?:[A-Z][a-z]+\.?|[A-Z]\.)(?: (?:[A-Z][a-zA-Z'’\-]+|[A-Z]\.)){1,3})\s*$")
ZW = re.compile("[\u200b\u200c\u200d\u2060\ufeff]")
NOISE = re.compile(r"^\s*(page \d+ of \d+|\d{1,3})\s*$", re.I)
ANALYST_INTRO = re.compile(r"(?:line of|from the line of|question (?:is )?from)\s+([A-Z][A-Za-z.'’\- ]{2,40}?)\s+(?:with|from|of)\b")
MIN, MAX = 220, 1100


def _ledger(symbol: str) -> dict | None:
    for d in ("ledgers_model", "ledgers"):
        p = ROOT / "data" / d / f"{symbol}.json"
        if p.exists():
            led = json.loads(p.read_text())
            # the hand-checked reference has the same calls; prefer the model-built file only for its calls list
            return led
    return None


def _chunks(text: str) -> list[str]:
    """Paragraphs merged to a readable size, split at sentence ends when too long."""
    paras = [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    out, buf = [], ""
    for p in paras:
        buf = f"{buf} {p}".strip() if buf else p
        if len(buf) >= MIN:
            while len(buf) > MAX:
                cut = buf.rfind(". ", 0, MAX)
                cut = cut + 1 if cut > MIN else MAX
                out.append(buf[:cut].strip())
                buf = buf[cut:].strip()
            out.append(buf)
            buf = ""
    if buf:
        if out and len(buf) < MIN:
            out[-1] = f"{out[-1]} {buf}"
        else:
            out.append(buf)
    return out


def _speakers(led: dict) -> set[str]:
    """Everyone the ledger quotes: they made a company promise, so they speak for the company (lowercase names)."""
    out = set()
    for r in led.get("rows", []):
        for c in (r.get("calls") or {}).values():
            sp = ((c or {}).get("quote") or {}).get("speaker")
            if sp:
                out.add(sp.lower())
    return out


def transcript(url: str, source: int, mgmt: set[str] | None = None) -> list[dict]:
    """Speaker turns of one transcript, as passages with page, speaker and role (m = management, a = analyst)."""
    # zero-width spaces and BOMs (Eicher writes "Moderator:\u200b") hide the speaker lines
    pages = [SimpleNamespace(number=p.number, clean=p.clean, text=ZW.sub("", p.text)) for p in docs.pages(url)]
    # lines repeated on most pages are running headers (company name, date)
    counts: dict[str, int] = {}
    for p in pages:
        for ln in {ln.strip() for ln in p.text.splitlines() if ln.strip()}:
            counts[ln] = counts.get(ln, 0) + 1
    header = {ln for ln, n in counts.items() if n >= max(3, len(pages) // 2) and len(ln) < 80
              and not SPEAKER.match(ln) and not ln.endswith(":")}  # "Moderator:" recurs on most pages too
    analysts: set[str] = set()
    out: list[dict] = []
    # Some calls (Infosys, Tata Motors) print the speaker's name alone on a line, with no colon. A bare
    # 2-4 word capitalised line counts as a turn when it recurs in the call or the ledger quotes that person.
    bare_counts: dict[str, int] = {}
    for p in pages:
        for ln in p.text.splitlines():
            m = BARE.match(ln)
            if m and m.group(1).strip() not in header:
                bare_counts[m.group(1).strip()] = bare_counts.get(m.group(1).strip(), 0) + 1
    bare = {n for n, k in bare_counts.items() if n.lower() not in NOT_SPEAKERS and n.isascii()
            and (k >= 2 or n.split()[-1].lower() in (mgmt or set())) and n.upper() != n}
    # the covering letter before the call (CIN, Registered Office, Email...) is not the call: start at the moderator
    started = not any(re.match(r"^\s*Moderator\b", ln) for p in pages for ln in p.text.splitlines())
    speaker, buf, start_page = None, [], None

    def flush():
        nonlocal buf
        if speaker and not speaker.lower().startswith("moderator") and buf:
            text = "\n".join(t for _, t in buf)
            for ch in _chunks(text):
                # the page where the passage's words are, not where the turn began
                pg = next((n for n, t in buf if ch[:40] in re.sub(r"\s+", " ", t)), start_page)
                out.append({"s": source, "p": pg, "who": speaker, "r": "", "t": ch})
        buf = []

    for p in pages:
        if not p.clean:
            continue
        lines = [ln for ln in p.text.splitlines() if ln.strip() not in header and not NOISE.match(ln)]
        for ln in lines:
            if not started:
                started = bool(re.match(r"^\s*Moderator\b", ln))
                if not started:
                    continue
            # anyone introducing the next questioner names an analyst (some calls write "Moderator" without a colon)
            for a in ANALYST_INTRO.findall(ln):
                # "the line of Mr. Umesh Raut from Nomura": the speaker line says "Umesh Raut" (full review F01)
                analysts.add(re.sub(r"^(?:mr|ms|mrs|dr|shri|smt|miss)\.?\s+", "", a.strip(), flags=re.I))
            m = SPEAKER.match(ln) or INLINE_SPEAKER.match(ln)
            name = (m.group(1) or (m.group(2) if m.re is SPEAKER else None)) if m else None
            if not name and (b := BARE.match(ln)) and (b.group(1).strip() in bare or b.group(1).strip() in analysts):
                name = b.group(1).strip()
            if name and len(name.split()) <= 6 and name.strip().lower() not in NOT_SPEAKERS:
                flush()
                speaker, start_page = name.strip(), p.number
                rest = m.group(2) if m and m.re is INLINE_SPEAKER else ""
                if rest:
                    buf.append((p.number, rest))
                continue
            buf.append((p.number, ln))
        buf.append((p.number, ""))  # a page break is a paragraph break
    flush()
    # roles after the whole call is read: an analyst is anyone the moderator introduced, unless the call's
    # participant list names them with a company title (an IR head introduced "from the company")
    titled = " ".join(pull.management_lines({p.number: p.text for p in pages}))
    mgmt = mgmt or set()
    for o in out:
        full = o["who"].lower()
        # m = quoted by the ledger, or on the company's participant list; a = introduced by the moderator;
        # "" = not known (never a guess). The full name decides first: Umesh Raut (analyst) is not Mahesh Raut (CFO).
        # the moderator's introduction outranks a title match ("from Nomura" beats a stray title word); only the
        # ledger's own quoted speakers (who made a company promise) outrank it
        if full in mgmt:
            o["r"] = "m"
        elif o["who"] in analysts:
            o["r"] = "a"
        elif full in titled:
            o["r"] = "m"
    return out


def annual_report(snap: dict, source: int) -> list[dict]:
    """The MD&A pages FINN already located for the business snapshot."""
    lo, hi = snap.get("pages") or [0, 0]
    out = []
    for p in docs.pages(snap["url"]):
        if lo <= p.number <= hi and p.clean:
            for ch in _chunks(p.text):
                out.append({"s": source, "p": p.number, "who": None, "r": "r", "t": ch})
    return out


def build(symbol: str) -> dict | None:
    led = _ledger(symbol)
    if not led or not led.get("calls"):
        return None
    sources, passages = [], []
    for c in led["calls"]:
        try:
            got = transcript(c["url"], len(sources), _speakers(led))
        except Exception:      # an unreadable transcript is skipped, and its absence is visible in `sources`
            continue
        # n = passages read from it: 0 says no text could be read (a scan, or a link that serves a page, not the document), so the app can say so
        sources.append({"label": f"{c['label']} call", "url": c["url"], "n": len(got)})
        passages += got
    snap = led.get("snapshot")
    if snap and snap.get("url"):
        try:
            got = annual_report(snap, len(sources))
            sources.append({"label": f"FY{str(snap['year'])[2:]} annual report", "url": snap["url"], "n": len(got)})
            passages += got
        except Exception:
            pass
    return {"symbol": symbol, "built": datetime.now().isoformat(timespec="seconds"), "sources": sources, "passages": passages}


def stale(limit: int | None = None) -> list[str]:
    """Companies whose ledger is newer than their passages (or that have none)."""
    out = []
    for lp in sorted((ROOT / "data" / "ledgers").glob("*.json")):
        pp = OUT / lp.name
        if not pp.exists() or pp.stat().st_mtime < lp.stat().st_mtime:
            out.append(lp.stem)
    return out[:limit] if limit else out


def run(symbols: list[str] | None = None, limit: int = 5) -> str:
    OUT.mkdir(parents=True, exist_ok=True)
    todo = symbols or stale(limit)
    done = []
    for s in todo:
        p = build(s)
        if p and p["passages"]:
            (OUT / f"{s}.json").write_text(json.dumps(p, ensure_ascii=False))
            done.append(f"{s}:{len(p['passages'])}")
    return f"built {len(done)} ({', '.join(done)})" if done else "nothing to build"


if __name__ == "__main__":
    print(run(sys.argv[1:] or None, limit=100))
