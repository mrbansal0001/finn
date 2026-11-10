"""Convert the hand-labelled Promises-ledger gold set (docs/research/05-...) into the
app's ledger format (data/ledgers/<SYMBOL>.json).

These two ledgers are the *reference* ledgers: built and checked by hand, used to
grade the automated extractor. The app labels them as such.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GOLD = ROOT / "docs" / "research" / "05-promises-ledger-gold"
OUT = ROOT / "data" / "ledgers"

GLYPH = {"●": "delivered", "◐": "partly", "○": "missed", "—": "silent", "↻": "revised", "·": "early", "⚠": "conflict"}
CALLS = {"BEL": ["Q3FY26", "Q4FY26", "Q1FY27", "Q2FY27"], "DEEPAKNTR": ["Q3FY26", "Q4FY26", "Q1FY27", "Q2FY27"]}
PREFIX = {"BEL": "BEL", "DEEPAKNTR": "DN"}


def cell_status(text: str):
    t = text.strip()
    if not t or t.lower().startswith("n/a"):
        return None
    if "↻" in t:
        return "revised"
    for g, s in GLYPH.items():
        if t.startswith(g):
            return s
    if "⚠" in t:
        return "conflict"
    return "early"


def main():
    items = {x["id"]: x for x in json.loads((GOLD / "ledger_gold.json").read_text())}
    md = (GOLD / "LEDGER-GOLD.md").read_text()
    urls = {}
    for line in (GOLD / "download_log.txt").read_text().splitlines():
        parts = line.split()
        if len(parts) >= 4:
            urls[parts[0]] = parts[3]
    OUT.mkdir(parents=True, exist_ok=True)
    for sym, calls in CALLS.items():
        section = md.split(f"### {sym}:")[1].split("\n### ")[0]
        header = next(l for l in section.splitlines() if l.startswith("| # |"))
        call_hdrs = [h.strip() for h in header.strip("|").split("|")[2:]]
        call_meta = []
        for i, h in enumerate(call_hdrs):
            m = re.match(r"(Q\dFY\d\d)\s*\(([^)]*)\)", h)
            label = m.group(1) if m else calls[i]
            key = next((k for k in urls if k.startswith(sym + "_")), None)
            call_meta.append({"label": label, "date": m.group(2) if m else "", "url": ""})
        # map call label -> transcript URL via item source_url
        by_call_url = {}
        for it in items.values():
            if it["company"] == sym:
                by_call_url[it["call"]] = it.get("source_url")
        for c in call_meta:
            c["url"] = by_call_url.get(c["label"], "")
        rows = []
        for line in section.splitlines():
            if not re.match(r"\| [TD]\d+ \|", line):
                continue
            cols = [c.strip() for c in line.strip().strip("|").split("|")]
            tid, title_raw, cells = cols[0], cols[1], cols[2:]
            refs = re.findall(r"\d{2}", (re.search(r"\(([\d, ]+)\)\s*$", title_raw) or re.search(r"$^", "")).group(1)) \
                if re.search(r"\(([\d, ]+)\)\s*$", title_raw) else []
            title = re.sub(r"\s*\([\d, ]+\)\s*$", "", title_raw)
            ids = [f"{PREFIX[sym]}-{r}" for r in refs if f"{PREFIX[sym]}-{r}" in items]
            linked = [items[i] for i in ids]
            first = min(linked, key=lambda x: calls.index(x["call"])) if linked else None
            last = max(linked, key=lambda x: calls.index(x["call"])) if linked else None
            cell_map = {}
            for c, txt in zip(call_meta, cells):
                st = cell_status(txt)
                note = txt.strip()
                missed_then_reset = bool(re.match(r"^○\s*→\s*↻", note))
                note = re.sub(r"^○\s*→\s*↻\s*", "", note)
                note = re.sub(r"^[●◐○—↻·⚠]\s*", "", note).replace("⚠", "conflicting:").strip()
                cell_map[c["label"]] = ({"status": st, "note": note, "missed_then_reset": missed_then_reset}
                                        if st else {"status": None})
            statuses = [cell_map[c["label"]]["status"] for c in call_meta if cell_map[c["label"]]["status"]]
            latest = statuses[-1] if statuses else "early"
            checkable = {x["checkable_from"] for x in linked}
            source = ("filed" if any("filing" in c for c in checkable) else
                      "per management" if any("transcript" in c for c in checkable) else "not checkable")
            row = {
                "id": tid, "title": title, "metric": first["metric"] if first else title,
                "calls": cell_map, "latest": latest, "evidence_source": source,
                "first_quote": {"text": first["quote"], "call": first["call"], "page": first["page"],
                                "speaker": first.get("speaker"), "url": first.get("source_url")} if first else None,
                "latest_quote": {"text": last["quote"], "call": last["call"], "page": last["page"],
                                 "url": last.get("source_url")} if last and last is not first else None,
                "verdict": (last or {}).get("evidence") or "",
            }
            rows.append(row)
        ledger = {"symbol": sym, "calls": call_meta, "rows": rows,
                  "provenance": "Reference ledger: every statement labelled and checked by hand against the transcript pages "
                                "(84 statements, quotes verified 158/158). Used to grade the automated extractor."}
        (OUT / f"{sym}.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=1))
        print(sym, len(rows), "rows", {s: sum(r["latest"] == s for r in rows) for s in GLYPH.values()})


if __name__ == "__main__":
    sys.exit(main())
