**To:** assessment@enam.com
**Subject:** IIT Kanpur – Founding AI Engineer - 2027
**Attach:** `docs/history/FINN-AI-build-history.md` (the AI build history as one file)

---

Dear ENAM team,

Here is my submission for the FINN build challenge.

- **Prototype (best on a phone):** https://finn-red.vercel.app
- **Repository:** https://github.com/mrbansal0001/finn
- **AI build history:** attached, and at https://github.com/mrbansal0001/finn/tree/main/docs/history
- **Full write-up and measurements:** https://github.com/mrbansal0001/finn/blob/main/docs/WRITEUP.md

**What I built.** FINN briefs an investor rather than feeding them: a ranked edition of the portfolio that ends.
- **Push:** the holdings' NSE filings and price moves for a chosen window, routine folded, alerts on the investor's own rules, and opt-in web notifications. Results cards give Revenue, EBITDA, PBT and PAT with QoQ and YoY from the filed table.
- **Pull:** for any NSE ticker, a promises ledger from the last four call transcripts, each promise quoted with its page and replayed call by call. Alongside it: five years of revenue and profit, and *Ask the documents*, which returns quoted passages or says nothing matched.
- **Network:** woven into both. Each card names the best person to ask and why, introducer paths show how both links know each other, and contacts gone quiet resurface when their company files.

**Key decisions.**
- **Rules first.** Filing types, every number, every promise status and all network matching are code.
- **Quote, don't summarise.** A promise is settled only by a comparable later statement, so most rows stay open, revised or silent, and say so.
- **Ask is search, not a model.** An answer can only be the company's words, and a question about a period the passages don't mention (say FY30) is told so.

**Architecture.**
- **Pipelines:** a Python worker reads exchange feeds, PDFs and the bhavcopy every 15 minutes, on a Mac, because NSE refuses datacenter requests. Supabase holds public data and each visitor's private rows; the app is Next.js on Vercel. All free tier.
- **Privacy:** the network sits under forced row-level security, with a private demo copy per visitor that is deleted after 14 days. Contact data never goes to a model.
- **Profiles:** the 29 contacts are **synthetic**, and the app says so. Executives' backgrounds come from the exchange filings, not LinkedIn.
- **Models:** no autonomous agents. Gemini Flash-Lite (free tier) reads documents into fixed schemas, results are cached, and a paid fallback sits behind a budget guard.

**Measured on 14 Nov:**
- 54 companies; 1,902 promises (2 settled, 64 revised, 47 gone silent);
- 32,263 searchable passages; 24 five-year tables;
- 41 results tables: all pass the statement's arithmetic identities, and 3 are also matched to exchange XBRL;
- held-out filing classification: 36/36 material filings surfaced;
- 25/25 live privacy checks; every page and promise link opens;
- $2.87 paid spend in total, across 1,985 model calls.

**Left out:** balance sheet, cash quality and bull/bear cases. I chose reliable scope over a model's opinion.

**Next:** a licensed feed and a cloud worker, so research and notifications don't depend on a laptop.

**How I built it:** Fable 5.1 and Astra 6 for research and the interface plans; Claude Opus 5.5 (Claude Code) for the code, verification and testing. I treated every passing check as a claim to verify; the history shows where I corrected the model.

Thank you for the challenge.

Tanish Bansal
IIT Kanpur
