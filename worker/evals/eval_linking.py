"""Eval: does deterministic promise linking (pull.link) reproduce the hand-built threads?

Feeds the gold statements (docs/research/05-promises-ledger-gold) through pull.link as if
the model had extracted them perfectly, then scores pairwise "same promise" decisions
against the hand-assigned threads. Isolates linking quality from extraction quality.
"""
import itertools
import json
import re
import sys
from pathlib import Path

from finn_worker import pull

ROOT = Path(__file__).resolve().parents[2]
GOLD = ROOT / "docs" / "research" / "05-promises-ledger-gold"
KIND = {"point (floor)": "floor", "point (approx)": "approximate", "point (ceiling)": "ceiling",
        "milestone-date": "milestone", "range": "range", "point": "point", "directional": "directional"}
PREFIX = {"BEL": "BEL", "DEEPAKNTR": "DN"}
ORDER = ["Q3FY26", "Q4FY26", "Q1FY27", "Q2FY27"]


def gold_threads(sym: str) -> dict[str, str]:
    md = (GOLD / "LEDGER-GOLD.md").read_text().split(f"### {sym}:")[1].split("\n### ")[0]
    out = {}
    for line in md.splitlines():
        m = re.match(r"\| ([TD]\d+) \| (.*?) \|", line)
        if m and (refs := re.search(r"\(([\d, ]+)\)\s*$", m.group(2))):
            for r in re.findall(r"\d{2}", refs.group(1)):
                out.setdefault(f"{PREFIX[sym]}-{r}", m.group(1))
    return out


def as_extracted(x: dict) -> dict:
    kind = KIND.get(x["type"], "point")
    return {"id": x["id"], "quote": x["quote"], "page": x["page"], "metric": x["metric"],
            "speaker_role": "analyst" if "analyst" in (x.get("speaker") or "").lower() else "management",
            "kind": kind, "value_low": x["value_low"], "value_high": x["value_high"], "unit": x["unit"],
            "period": None if kind == "milestone" else x["period"], "due": x["period"] if kind == "milestone" else None}


def main():
    items = json.loads((GOLD / "ledger_gold.json").read_text())
    for sym in ("BEL", "DEEPAKNTR"):
        gt = gold_threads(sym)
        its = [x for x in items if x["company"] == sym and x["id"] in gt]
        calls = [(c, [as_extracted(x) for x in its if x["call"] == c]) for c in ORDER]
        threads = pull.link_with_model(calls) if "--model" in sys.argv else pull.link(calls)
        pred = {m.item["id"]: t.id for t in threads for m in t.mentions}
        ids = [i for i in gt if i in pred]
        tp = fp = fn = 0
        for a, b in itertools.combinations(ids, 2):
            same_g, same_p = gt[a] == gt[b], pred[a] == pred[b]
            tp += same_g and same_p
            fp += same_p and not same_g
            fn += same_g and not same_p
        p = tp / (tp + fp) if tp + fp else 1.0
        r = tp / (tp + fn) if tp + fn else 1.0
        print(f"{sym}: {len(ids)} statements · gold threads {len(set(gt[i] for i in ids))} · "
              f"predicted {len(set(pred[i] for i in ids))} · pairwise precision {p:.2f} recall {r:.2f}")


if __name__ == "__main__":
    main()
