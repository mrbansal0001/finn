"""One-shot reachability probe: can this machine reach each data source?

Makes exactly one GET per source with an honest User-Agent, records status,
latency and bytes, and never retries or works around a refusal. Used to decide
whether ingest can run on GitHub Actions or must run on a residential machine
(see docs/DECISIONS.md D-017).
"""
import json
import sys
import time
import urllib.request

UA = "FINN-research-prototype/0.1 (non-commercial evaluation)"
TARGETS = {
    "nse_rss_announcements": "https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml",
    "nse_rss_results": "https://nsearchives.nseindia.com/content/RSS/Integrated_Filing_Financials.xml",
    "nse_archive_xbrl": "https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1755884_10112026065521_WEB.xml",
    "nse_archive_pdf": "https://nsearchives.nseindia.com/corporate/Aswi4739_10112026142305_SE_Intimation_Sgd.pdf",
    "nse_bhavcopy": "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_20261109_F_0000.csv.zip",
    "nse_equity_list": "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
    "bse_transcript_pdf": "https://www.bseindia.com/xml-data/corpfiling/AttachHis/ae1ae7ce-d870-47a4-900c-c087a6e84e65.pdf",
    "screener_company": "https://www.screener.in/company/BEL/",
}


def probe(url: str, timeout: float = 30.0) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return {"status": resp.status, "bytes": len(body), "seconds": round(time.monotonic() - start, 2)}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "error": "http", "seconds": round(time.monotonic() - start, 2)}
    except Exception as e:  # timeouts, resets, DNS
        return {"status": None, "error": type(e).__name__ + ": " + str(e)[:120], "seconds": round(time.monotonic() - start, 2)}


def main() -> None:
    results = {}
    for name, url in TARGETS.items():
        results[name] = probe(url)
        print(f"{name:24s} {results[name]}", flush=True)
        time.sleep(3)  # be polite: requests spaced out
    json.dump(results, sys.stdout if len(sys.argv) < 2 else open(sys.argv[1], "w"), indent=2)


if __name__ == "__main__":
    main()
