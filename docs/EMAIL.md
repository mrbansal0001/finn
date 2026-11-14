**To:** assessment@enam.com
**Subject:** IIT Kanpur – Founding AI Engineer - 2027
**Attach:** `docs/history/FINN-AI-build-history.md` (the AI build history as one file)

---

Dear ENAM team,

Here is my submission for the FINN build challenge.

- **Prototype (open on a phone):** https://finn-red.vercel.app
- **Repository:** https://github.com/mrbansal0001/finn
- **AI build history:** attached as one file, and in the repo at https://github.com/mrbansal0001/finn/tree/main/docs/history
- **Full write-up, with every measurement:** https://github.com/mrbansal0001/finn/blob/main/docs/WRITEUP.md

## What I built

FINN's point of view: an investor should be **briefed, not fed**. It writes a ranked edition of the portfolio that starts, ranks and ends, and every question leads to the company's own words and the person who can explain them.

- **Push.** An edition of the 18 holdings' NSE filings and price moves over 24 hours (or 3, 7, 30 days, or since the last visit): up to three leads, the rest worth a look, routine filings folded but openable. Alerts follow the investor's own rules (price ±X%, volume Y×, results, deals or management changes filed), and web notifications send them to the phone. Results cards give Revenue, EBITDA, PBT and PAT with QoQ and YoY from the filed table, checked against the exchange's XBRL. Management-change cards carry the incoming person's background from the filing itself and say whether anyone in the network overlapped with them, with dates.
- **Pull.** For any NSE ticker, a **promises ledger** built from the last four earnings-call transcripts: each promise quoted with its page, replayed call by call, and marked revised, silent, delivered or missed by fixed rules. It covers 54 companies and 1,894 promises, and any other ticker can be requested. Alongside: the business from the annual report, five years of revenue and profit read from the report's own table, and **Ask the documents**, which answers a question only with quoted passages and says "the documents don't say" when they don't.
- **Network.** Woven into both: each card names the best person to ask and why, introducer paths say how both links know each other, and "a reason to reconnect" surfaces contacts gone quiet whose company just filed. The network is searchable ("who knows Titan").

## Key decisions and tradeoffs

- **Rules first, model second.** Filing types, every number, every promise status and all network matching are code. On 80 held-out filings, rules alone surfaced all 36 material ones.
- **Delivered/missed is rare by design.** A promise is settled only by a comparable statement (same period, said by management, number in the quote, same units). That leaves 2 settled of 1,894; an earlier version settled 53, mostly wrongly.
- **Cite or drop.** Every quote is the page's own text; a number is kept only if it is printed where cited. Independent audits re-checked about 660 results figures against their PDFs and 1,575 quotes against their pages (all verbatim); the errors they found were traced to their causes and fixed, and the items deliberately deferred are listed in the decision log.
- **Left out on purpose:** a chat box as the front door, sentiment and credibility scores, model-written bull/bear cases, balance-sheet and cash-quality views (the data isn't extracted yet), and a network graph.

## Architecture

- **Data pipelines.** A Python worker reads NSE announcements and XBRL every 15 minutes, results PDFs on filing, the daily bhavcopy after the close, and transcripts and annual reports from the exchanges (Screener only to find links). Names in filings are matched to contacts deterministically: same person needs name and organisation; "worked together" needs overlapping dates.
- **Security and privacy.** Market data is public and read-only. The network sits in Postgres under forced row-level security: each visitor gets an anonymous session and a private copy of the demo network, deleted after 14 days. A live check (23 cases) proves visitors can't read each other's data. Contact data never goes to a model. For real: consented imports only (LinkedIn export, contacts, CRM), per-source switches, deletion and export on request.
- **Profiles.** The 29 contacts are **synthetic**, with careers that overlap the real filings; the app says so on the first screen. Incoming executives' backgrounds come from the exchange filings themselves. I did not scrape LinkedIn.
- **LLMs and agents.** No autonomous agent: Push and Pull are fixed pipelines. A model only reads text into fixed schemas (filings, results tables, transcripts, the five-year table), using Gemini Flash-Lite on the free tier; a stronger model was tested and wasn't better on my labelled set. Ask uses no model. Identical requests come from a disk cache, and transcripts are read in overlapping windows (recall 55% → 80%). Total paid spend for the whole build: **$2.87** (OpenAI fallback, hard-capped), nothing since 12 Nov.
- **Cloud.** Next.js PWA on Vercel (Mumbai), Supabase Postgres and Auth, the worker on a Mac. All free tier.

## How I worked with AI

I used **Fable 5.1** and **Astra 6** for research and the interface design plans, and **Claude Opus 5.5** in Claude Code for all the backend code, verification and testing. I treated every passing check as a claim to verify: the audits, the hand-labelled evaluation sets and the live link and security checks are in the repo, and the build history shows where I corrected the model and why.

## Next

A licensed announcements feed and a cloud worker, so Pull builds any company in about a minute and notifications don't depend on a laptop; balance sheet and cash quality with the same on-page checks; and a held-out evaluation refreshed every quarter.

Thank you for the challenge.

Tanish Bansal
IIT Kanpur
