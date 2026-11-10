"""Check every quote (primary, also_quotes, evidence) appears whitespace-normalised on its cited PDF page."""
import json, re, sys, os, runpy
BASE = os.path.dirname(os.path.abspath(__file__))
def norm(s): return re.sub(r'\s+', ' ', s).strip()
def load_items():
    out = []
    for f in ["bel_q3fy26","bel_q4fy26","bel_q1fy27","bel_q2fy27","dn_q3fy26","dn_q4fy26","dn_q1fy27","dn_q2fy27"]:
        ns = runpy.run_path(os.path.join(BASE, "items", f + ".py"))
        out.append((f, ns))
    return out
def main():
    pages_cache = {}
    res = []
    for f, ns in load_items():
        C = ns["C"]; fn = C["file"]
        if fn not in pages_cache:
            pages_cache[fn] = [norm(p) for p in json.load(open(os.path.join(BASE, "text", fn + ".pages.json")))]
        pages = pages_cache[fn]
        checks = []
        for it in ns["ITEMS"]:
            checks.append((it["id"], "primary", it["page"], it["quote"]))
            for i, (pg, q) in enumerate(it.get("also_quotes", [])):
                checks.append((it["id"], f"also{i}", pg, q))
        for k, ev in {**ns.get("EVIDENCE", {}), **ns.get("EVIDENCE_Q4FY26", {}), **ns.get("EVIDENCE_Q2FY27", {})}.items():
            checks.append((f"{fn}:{k}", "evidence", ev[0], ev[1]))
        for cid, kind, pg, q in checks:
            ok = norm(q) in pages[pg - 1] if 1 <= pg <= len(pages) else False
            found = [i + 1 for i, p in enumerate(pages) if norm(q) in p]
            res.append(dict(id=cid, kind=kind, file=fn, page=pg, ok=ok, found_on=found, quote=q))
    n = len(res); p = sum(r["ok"] for r in res)
    prim = [r for r in res if r["kind"] == "primary"]
    print(f"ALL quotes: {p}/{n} pass; primary: {sum(r['ok'] for r in prim)}/{len(prim)}")
    for r in res:
        if not r["ok"]:
            print("FAIL", r["id"], r["kind"], r["file"], "p", r["page"], "found_on", r["found_on"], "|", r["quote"][:90])
    json.dump(res, open(os.path.join(BASE, "quote_check.json"), "w"), indent=1)
main()
