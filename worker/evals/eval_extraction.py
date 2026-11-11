"""Eval: guidance extraction (model) vs the hand-labelled gold set (84 statements, 8 transcripts).

    uv run python -m evals.eval_extraction            # whichever model llm.py picks
    FINN_TIER=fast uv run python -m evals.eval_extraction

Match rule: same call, and the predicted quote overlaps a gold quote (partial ratio >= 85),
or same page with a similar metric (token-set >= 70). Reports recall, precision, quote
verification, analyst-number leakage, tokens and cost from the llm_calls log.
"""
import json
import os
import re
import time
from pathlib import Path

from rapidfuzz import fuzz

from finn_worker import pull, store

STRICT = os.getenv("FINN_EVAL_STRICT") == "1"
_NUM = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _key_tokens(s: str) -> set[str]:
    """Programme names / acronyms and numbers >= 10: the facts that identify a promise."""
    nums = {n.replace(",", "") for n in _NUM.findall(s) if float(n.replace(",", "")) >= 10}
    return nums | pull._names(s)


def _same(p: dict, g: dict, strict: bool) -> bool:
    if fuzz.partial_ratio(pull._norm(p["quote"]), pull._norm(g["quote"])) >= 85:
        return True
    near = abs((p.get("page") or 0) - g["page"]) <= 1
    if near and fuzz.token_set_ratio(p["metric"].lower(), g["metric"].lower()) >= 70:
        return True
    if strict:
        return False
    # same page, and the statement names the same programme or the same figure
    return near and bool(_key_tokens(p["metric"] + " " + p["quote"]) & _key_tokens(g["metric"] + " " + g["quote"]))


def _restates(p: dict, g: dict) -> bool:
    """Same call, same commitment said again elsewhere (closing remarks, Q&A): same metric or programme."""
    return (fuzz.token_set_ratio(pull._metric_key(p["metric"]), pull._metric_key(g["metric"])) >= 80
            or bool(pull._names(p["metric"]) & pull._names(g["metric"])))


GOLD = Path(__file__).resolve().parents[2] / "docs" / "research" / "05-promises-ledger-gold" / "ledger_gold.json"


def main():
    gold = json.loads(GOLD.read_text())
    by_call: dict[tuple[str, str], list[dict]] = {}
    urls: dict[tuple[str, str], str] = {}
    for g in gold:
        key = (g["company"], g["call"])
        by_call.setdefault(key, []).append(g)
        urls[key] = g["source_url"]

    con = store.connect()
    t0 = con.execute("select coalesce(max(rowid),0) from llm_calls").fetchone()[0]
    start = time.time()
    tp = fp = fn = verified = predicted = analyst_leak = dup = 0
    dump = []
    for key, golds in sorted(by_call.items()):
        _, pages = pull.paged_text(urls[key])
        out = pull.extract(urls[key])
        preds = [p for p in out.get("guidance", []) if p.get("speaker_role") == "management"]
        analyst_leak += sum(1 for p in out.get("guidance", []) if p.get("speaker_role") == "analyst")
        predicted += len(preds)
        matched_gold = set()
        for p in preds:
            if pull.verify(p, pages) is not None:
                verified += 1
            hit = next((g["id"] for g in golds if g["id"] not in matched_gold and _same(p, g, strict=STRICT)), None)
            if hit:
                matched_gold.add(hit)
                tp += 1
            elif not STRICT and any(_same(p, g, strict=False) or _restates(p, g) for g in golds if g["id"] in matched_gold):
                dup += 1          # a restatement of a promise already matched in this call: neutral
            else:
                fp += 1
        fn += len(golds) - len(matched_gold)
        dump.append({"call": key, "gold": [{"id": g["id"], "metric": g["metric"], "page": g["page"], "quote": g["quote"]} for g in golds],
                     "matched": sorted(matched_gold),
                     "pred": [{"metric": p["metric"], "page": p.get("page"), "quote": p["quote"], "kind": p.get("kind")} for p in preds]})
        print(f"{key[0]:10s} {key[1]}  gold {len(golds):2d}  predicted {len(preds):2d}  matched {len(matched_gold):2d}")

    rows = con.execute("select model, sum(input_tokens), sum(output_tokens), sum(cost_usd), count(*) "
                       "from llm_calls where rowid > ? group by model", (t0,)).fetchall()
    mode = "strict" if STRICT else "fair (restatements neutral, programme/figure match)"
    print(f"\n[{mode}] recall {tp}/{tp + fn} = {tp / max(1, tp + fn):.0%}   precision {tp}/{tp + fp} = {tp / max(1, tp + fp):.0%}"
          f"   restatements {dup}")
    print(f"quotes verified on their page: {verified}/{predicted} = {verified / max(1, predicted):.0%}")
    print(f"analyst statements correctly tagged (not counted as guidance): {analyst_leak}")
    for m, tin, tout, cost, n in rows:
        print(f"model {m}: {n} calls, {tin:,} in / {tout:,} out tokens, ${cost:.4f}")
    print(f"wall time {time.time() - start:.0f}s")
    out = Path(__file__).resolve().parents[2] / "data" / "logs" / f"extraction_{os.getenv('FINN_PULL_TIER', 'fast')}_{int(start)}.json"
    out.write_text(json.dumps(dump, ensure_ascii=False, indent=1))
    print("predictions saved to", out)


if __name__ == "__main__":
    main()
