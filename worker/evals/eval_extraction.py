"""Eval: guidance extraction (model) vs the hand-labelled gold set (84 statements, 8 transcripts).

    uv run python -m evals.eval_extraction            # whichever model llm.py picks
    FINN_TIER=fast uv run python -m evals.eval_extraction

Match rule: same call, and the predicted quote overlaps a gold quote (partial ratio >= 85),
or same page with a similar metric (token-set >= 70). Reports recall, precision, quote
verification, analyst-number leakage, tokens and cost from the llm_calls log.
"""
import json
import time
from pathlib import Path

from rapidfuzz import fuzz

from finn_worker import pull, store

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
    tp = fp = fn = verified = predicted = analyst_leak = 0
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
            hit = next((g["id"] for g in golds if g["id"] not in matched_gold and (
                fuzz.partial_ratio(pull._norm(p["quote"]), pull._norm(g["quote"])) >= 85
                or (abs((p.get("page") or 0) - g["page"]) <= 1
                    and fuzz.token_set_ratio(p["metric"].lower(), g["metric"].lower()) >= 70))), None)
            if hit:
                matched_gold.add(hit)
                tp += 1
            else:
                fp += 1
        fn += len(golds) - len(matched_gold)
        print(f"{key[0]:10s} {key[1]}  gold {len(golds):2d}  predicted {len(preds):2d}  matched {len(matched_gold):2d}")

    rows = con.execute("select model, sum(input_tokens), sum(output_tokens), sum(cost_usd), count(*) "
                       "from llm_calls where rowid > ? group by model", (t0,)).fetchall()
    print(f"\nrecall {tp}/{tp + fn} = {tp / max(1, tp + fn):.0%}   precision {tp}/{tp + fp} = {tp / max(1, tp + fp):.0%}")
    print(f"quotes verified on their page: {verified}/{predicted} = {verified / max(1, predicted):.0%}")
    print(f"analyst statements correctly tagged (not counted as guidance): {analyst_leak}")
    for m, tin, tout, cost, n in rows:
        print(f"model {m}: {n} calls, {tin:,} in / {tout:,} out tokens, ${cost:.4f}")
    print(f"wall time {time.time() - start:.0f}s")


if __name__ == "__main__":
    main()
