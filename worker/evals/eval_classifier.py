"""Eval: rules classifier vs hand labels (120 random filings). No model involved.

Reports category accuracy, and -- the number that matters -- material recall: of the filings
that should surface, how many did the rules keep out of the routine fold (lead/notable, or
flagged to read)? Missing a material filing is the costly error; a few extra notable items
are cheap.
"""
import json
from pathlib import Path

from finn_worker.classify import classify
from evals.data.classifier_labels import LABELS

rows = json.loads((Path(__file__).parent / "data" / "classifier_sample.json").read_text())
cat_ok = mat_tp = mat_fn = mat_fp = mat_tn = 0
misses, false_alarms = [], []
for r in rows:
    gold_cat, gold_mat = LABELS[r["i"]]
    lab = classify(r["subject"], r["summary"], r["link"])
    cat_ok += lab.category in gold_cat.split("|")
    surfaced = lab.tier != "routine"
    if gold_mat is None:
        continue
    if gold_mat and surfaced:
        mat_tp += 1
    elif gold_mat and not surfaced:
        mat_fn += 1
        misses.append((r["i"], r["subject"], r["summary"][:80]))
    elif not gold_mat and surfaced:
        mat_fp += 1
        false_alarms.append((r["i"], r["subject"], lab.category))
    else:
        mat_tn += 1
n = len(rows)
judged = mat_tp + mat_fn + mat_fp + mat_tn
print(f"category accuracy        {cat_ok}/{n} = {cat_ok / n:.0%}")
print(f"material recall          {mat_tp}/{mat_tp + mat_fn} = {mat_tp / (mat_tp + mat_fn):.0%}   (should surface, did)")
print(f"routine correctly folded {mat_tn}/{mat_tn + mat_fp} = {mat_tn / (mat_tn + mat_fp):.0%}")
print(f"judged {judged}, unknowable without the PDF {n - judged}")
print("missed material:", misses)
print("surfaced but routine:", false_alarms)
