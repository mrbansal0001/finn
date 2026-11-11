# FINN: writeup

**Prototype:** https://finn-red.vercel.app (built for a phone; each visitor gets a private copy of the demo network) · **Repo:** https://github.com/mrbansal0001/finn · **AI build history:** [ADD LINK BEFORE SENDING]

## What I built

FINN has one point of view: **an investor should be briefed, not fed.** Every Indian tool I studied (Tijori, Trendlyne, Screener, broker apps; about 45 products, `docs/research/01-competitors.md`) sends one ping per filing. FINN writes an *edition*. It ranks, shows three leads, counts the rest, folds the routine into one line, and ends.

- **Push, "The Edition".** A digest over a window you pick (24h, 3d, 7d, 30d) of your 18 holdings' NSE filings and price/volume moves.
  - "What counts" lets you set what is unusual: price move %, volume multiple, which announcement types matter, and how many leads.
  - Results cards show Revenue, EBITDA, PBT and PAT with QoQ and YoY (margins in bp, banks get NII/PPOP/provisions). The headline is written from the computed numbers.
  - People cards carry the incoming person's background from the filing.
  - Move cards state the threshold that fired. If no filing explains the move, the card says so rather than guessing a cause.
  - "Brief me · 60s" reads the edition aloud using the phone's own speech engine.
- **Pull, the Promises ledger.** For any NSE ticker, every promise management made on the last four earnings calls, one row per promise:
  - a glyph per call: ● delivered, ◐ partly, ○ missed, — went silent, ↻ revised;
  - the verbatim quote with its transcript page;
  - where the evidence comes from: filed numbers, management's own later statements, or not checkable.
  - Example, BEL: every FY26 financial target was met, but the QRSAM order date was reset three times and is now "very soon, >99%", with no date.
- **Network, inside both.** Never a tab. A card carries one line, e.g. *"Rhea Kapoor was Head of Strategy at Titan, 2014–21 · last spoke 8 wk ago."* Ledger rows name who can verify a promise. A person page explains tie strength term by term and drafts a note.
  - What it notices that you wouldn't: alumni and board overlaps with dates, second-degree paths through strong ties, and domain experts for specific events (an ex-IRDAI official for an insurance-licence action).
  - It also knows when *not* to suggest someone. Current employees are marked insiders and never offered for an unexplained price move.

## Decisions and tradeoffs (full log: `docs/DECISIONS.md`, 36 entries)

- **Rules first, model second.**
  - NSE's own category field plus XBRL types classify filings. On 80 later filings held out from tuning, rules alone catch 37/37 material ones (100%), with 92% category accuracy. The errors all go the cheap way: 6 routine items surfaced, none missed.
  - The model reads only what rules can't settle, so a day of Push costs cents.
- **The model never does arithmetic or judges hit/miss.**
  - It transcribes tables and statements. Code computes QoQ/YoY, margins, and every promise status.
  - Revisions are detected by comparing values and dates across calls. Management's "on track" is never taken at face value (Deepak Nitrite called its polycarbonate date "in line" while it moved three times).
- **Exact numbers, checked.**
  - Current-quarter results come from NSE's Integrated Filing XBRL.
  - QoQ/YoY come from the same filing's PDF table, accepted only if its current column equals the XBRL. That check caught a quirk: XBRL PBT excludes the JV share, so PBT is reconciled separately.
  - Scanned PDFs are read as images.
  - An exceptional item is shown separately. Kalyan's PBT was +60% YoY headline but +39% underlying.
- **Cite or drop.** Every quote is verified against the text of its cited page; unverifiable statements are dropped. On the hand-labelled set: 84/84 found, and 84/84 off-by-one pages corrected.
  - The same rule applies to numbers: a figure shown in the ledger must be printed in its quote. The model once turned "grow almost to 2x" into "200%". Such figures are removed and the promise shows as "no figure".
  - Amounts more than 2x apart are never linked as a "revision" unless they share a programme name. Rs 3,000 cr and Rs 800 cr capex are different plans; an NGC order re-sized from 2-3k to 10-12k cr is the same one.
- **Wording follows evidence.** "Worked together" only when dates overlap. Many real bios give employers without years, so FINN says "both ex-McKinsey (dates not disclosed)".
- **What I left out on purpose:**
  - a chat box as the front door;
  - sentiment scores;
  - a composite "credibility score", because a single number invites false precision;
  - a network graph view, which reads badly at phone width and answers a vanity question.

## Data pipelines

| Need | Source | Cadence |
|---|---|---|
| Announcements | NSE RSS (whole market, ~1 day window) + linked Reg 30 XBRL; per-company backfill for the portfolio | every 15 min; daily backfill |
| Results | Integrated Filing (Financials) XBRL feed; the filing's PDF table for comparatives | on filing |
| People | Change-in-management XBRL (`BriefProfile`), or the filing PDF/annexure | on filing |
| Prices | NSE UDiFF bhavcopy (one public file, all stocks) | after close |
| Transcripts / ARs | exchange PDFs (screener.in used only to discover the links) | weekly + on request |

- **Where it runs.** NSE and BSE refuse or time out datacenter IPs (measured three times). So ingest runs as a scheduled worker on a residential machine and the cloud app serves its output.
- **Etiquette.** It uses only files NSE publishes for download, with an honest User-Agent, per-host spacing, a disk cache, and no retries after a refusal.
- **Production.** A licensed feed replaces this: NSE Corporate Data (₹10.6 lakh/yr realtime) or a vendor such as TrueData or Accord.

## Security and privacy

- **Two kinds of data, two policies.**
  - Public market data: readable by anyone, writable only by the worker.
  - The investor's network, notes, portfolio and preferences: Postgres row-level security, forced, owner-only.
  - Each reviewer gets an anonymous session with a private copy of the demo network, so isolation is real, not described.
- **Contact data never goes to a model.** Matching is deterministic and local. Outreach notes come from templates.
- **Filings about named people** go only to a paid API that doesn't train on inputs, never to a free tier.
- **Secrets.** The service key lives only on the worker. Secrets live only in `.env`. A test asserts that no contact name can appear in the public payload.
- **DPDP.** The Rules were notified in Nov 2025, and their main obligations apply from about May 2027. The design already follows the essentials: purpose-limited consented imports, deletion by owner (cascade), and minimal processor exposure.

## LLMs and agents

FINN is deliberately **not** an autonomous agent. Push and Pull are fixed pipelines, which makes them cheaper, testable, and explainable. The model does three narrow jobs:

1. read a filing into typed events;
2. transcribe a results table, as text or as an image of a scanned page;
3. transcribe a transcript's forward-looking statements and stated actuals.

Each runs against a JSON schema. Copy rules are enforced in code: the headline needs a verb and a fact, and a "why" line without a number is dropped.

- **Models:** Gemini (free tier) for impersonal public documents; OpenAI (paid, $5 cap enforced in code) as fallback and for anything naming people. Model names are discovered at runtime.
- **Extraction, measured** against 84 statements I hand-labelled from 8 transcripts:
  - a single pass found 55%;
  - overlapping 6-page windows raise recall to 80%, at 61% strict precision;
  - a hand check of the "false positives" found half were genuine commitments my labels had missed, so effective precision is near 80%;
  - the stronger model was not better, so the light one is used.
- **Linking:** deterministic, with pairwise precision 0.88 / recall 0.70 on BEL and 0.75 / 0.67 on Deepak Nitrite. Model-assisted linking was tried and was noisier run to run (BEL precision 0.67-0.79), so it stays off by default.
- **Cost:** $0.65 for the entire build, 546 model calls.
  - Public documents run on Gemini's free tier, so a ledger costs $0.
  - Reading a filing that names people costs about $0.005 on the paid API, so a day of Push for 18 holdings costs cents.
  - Identical requests are answered from a disk cache, so rebuilds are free and reproducible.

## Cloud

- **App:** Next.js 16 PWA on Vercel (free). One link opens on any phone and installs to the home screen.
- **Database and auth:** Supabase Postgres + Auth (free).
- **Worker:** Python, scheduled on a residential Mac (a launchd job is provided).
- **Cost:** about $0 at prototype scale plus model usage.

## Profiles: what I used and how I'd do it for real

- **What I used.** The network is **synthetic**: 28 fictional people whose dated careers overlap the real companies and filings in the demo. Incoming executives' backgrounds come from the **exchange filings themselves** (the `BriefProfile` field and annexures), which are primary and public.
- **No scraping.** I did not scrape LinkedIn. The hiQ litigation ended with a judgment and injunction against scraping, and Proxycurl shut down in July 2025.
- **For real:**
  - the investor's own consented imports: LinkedIn's `Connections.csv` export, Google Contacts, CRM;
  - later, opt-in email/calendar *metadata* (counts and dates, never content) for recency;
  - licensed MCA director data (Probe42/Surepass) for board interlocks.

## What I'd do next

1. A licensed announcements feed, and a cloud worker in Mumbai.
2. Real-time push for filings: web push for installed PWAs.
3. Annual-report promises as ledger rows. Today the MD&A is located and summarised with citations beside the ledger; capex and capacity targets stated there should be tracked call by call like the rest.
4. Sector-specific fourth metric (volumes for autos, order book for capital goods, NIM/GNPA for banks).
5. A held-out evaluation set refreshed every quarter, with drift alerts on the classifier.
