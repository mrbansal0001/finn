# FINN: writeup

**Prototype:** https://finn-red.vercel.app (built for a phone; each visitor gets a private copy of the demo network) · **Repo:** https://github.com/mrbansal0001/finn · **AI build history:** https://github.com/mrbansal0001/finn/tree/main/docs/history

## What I built

FINN has one point of view: **an investor should be briefed, not fed.** The Indian tools I studied (Tijori, Trendlyne, Screener, broker apps; about 45 products, `docs/research/01-competitors.md`) mostly alert per filing or per event; some send daily summaries of specific feeds. FINN writes a ranked *edition* of your portfolio. It ranks, shows up to three leads, counts the rest, folds the routine into one line, and ends.

- **Push, "The Edition".** A digest of your 18 holdings' NSE filings and price/volume moves over the last 24 hours, or a window you pick (3d, 7d, 30d, since your last visit).
  - **Rule matches** sit above the digest: every session in the window that met your price or volume rule (±5%, 2× the 20-session volume by default), each opening its own card. "What counts" lets you change the thresholds (down to 1% and 1.2×), mute announcement types, and set how many leads. You can also be alerted when a results filing, a deal or a management change lands for a holding.
  - **It pushes.** Switch on "Notify this device" in What counts, and FINN sends web notifications: a chosen filing within one 15-minute worker cycle of reaching the exchange feed, and once per session the moves that meet *your* rules ("3 alerts at the 12 Nov close: KALYANKJIL +7.1% on 5.7× volume; …"). The subscription and your rules sit in your own private row; nothing from before you subscribed is sent. On iPhone it works once FINN is added to the Home Screen.
  - **Results cards:** Revenue, EBITDA, PBT and PAT with QoQ and YoY (margins in bp; banks get NII, operating profit and provisions; lenders get no EBITDA). The headline is written from the computed numbers. When one-offs are a big part of profit, it leads with profit before one-offs (Titan: +114% reported, +53% before a ₹671 cr fair-value gain).
  - **People cards:** the person's background from the filing, ranked by seniority (a new MD & CEO leads; a compliance officer's appointment doesn't).
  - **Move cards** name the filing published between the previous close and this close, on the exchange's full trading calendar ("Filed before this session: results, Tue 10 Nov 17:08"). If there is none, the card says so instead of guessing a cause.
  - A material filing FINN couldn't read stays in the edition as material, with its link, and is retried; it never drops into housekeeping.
  - "Listen to brief" reads the edition aloud using the phone's own speech engine.
- **Pull, the Promises ledger.** For any NSE company, every promise management made on its last four earnings calls, one row per promise:
  - a glyph per call: ● delivered, ◐ partly, ○ missed, ↻ revised, — went silent, ◌ period ended with no outcome stated;
  - the verbatim quote with its transcript page; for a settled row, the outcome quote too, with who said it and on which call;
  - for a company-level, full-year revenue, profit or margin target still running, the latest filed quarter beside it, judged against the target (one quarter is not the year, so the status stays open);
  - the latest results table, the annual report's own description of the business, and the people who'd know;
  - **Trajectory:** five years of revenue and profit read from the annual report's own multi-year table, each figure kept only if it is printed on the cited page (24 of 54 companies pass every check; the rest show nothing rather than a guess).
- **Ask the documents.** A question box on every covered company ("what did they say about gold prices and demand?") answered only with the company's own words: up to three matching passages from its last four call transcripts and its annual report, with speaker, role and page link. If the best passage is an analyst's question, the company's reply comes with it. If no passage covers enough of the question, the answer is "The documents don't say", and any document FINN couldn't read is named. It is full-text search in Postgres over 32,175 passages, not a model, so outside knowledge can't leak in and nothing is paraphrased. The search box offers it for any sentence typed on a company page, and both boxes take voice.
  - Example, BEL (machine-built): FY26 EBITDA margin guided at 27%, and management stated 30% on the May call (delivered); the NGC order target moved from ₹10–12k cr "in H1" to about ₹20k cr for the year, after the first date had passed (revised, not missed). The hand-checked reference also shows the QRSAM order date reset three times.
  - **Delivered/missed is rare by design.** A later statement settles a promise only when it is comparable: same period as the current target, said by management, the number printed in the quote, comparable units, the programme or segment named, and from a later call that reviewed the period. Across 54 ledgers that leaves 2 settled rows out of 1,894; the rest are open, revised, silent, or ended without a comparable outcome, and say so. An earlier version settled 53, most of them wrongly (E31).
  - Ledgers exist for 54 companies when this was written: 45 of the Nifty 50 (the other five have nothing readable: ITC and Trent list no transcripts, and the sources for Apollo Hospitals, JSW Steel and ONGC refused or were missing) plus holdings, research names and companies visitors requested. Any other company is built on request.
- **Network, inside both, and askable.** A card carries one line, e.g. *"Lakshmi Raghavan is also an alumnus of PSG College of Technology"* on the card for HDFC Bank's new Chief Compliance Officer.
  - It answers the brief's question directly: has anyone in my network worked with this person, studied with them, or sits one connection away? Overlaps are dated from the filing's own words ("was at HDFC Bank 2009–22, while Kaizad Bharucha was there"). Same employer at the same time is said as exactly that, not as "knows them". When there is none, it says "no verified overlap"; if the network failed to load, it says that instead.
  - Introductions weigh both links (you to the introducer, the introducer to them) and say how the two know each other.
  - **Best placed, and why:** the first suggestion is the person whose role there or expertise fits the event ("as Head, Legal & Secretarial there (2013–20), the closest to this legal matter; reach them through Imran"). Relevance beats warmth.
  - The search box also searches your own network: a name, a theme ("specialty chemicals"), an employer, a school.
  - It knows when *not* to suggest someone: current employees are marked insiders and never offered for an unexplained price move.
  - **Keeping the network warm, unprompted:** the edition and the People page surface a contact you haven't spoken to in six months whose company, or former employer, just filed something material ("Neha Joshi: HDFC Bank, Fri: management change. Last spoke Feb 2026, 9 months ago").

## Decisions and tradeoffs (full log: `docs/DECISIONS.md`)

- **Rules first, model second.** NSE's category field plus XBRL types classify filings. On 80 later filings held out from tuning, rules alone surface all 36 material ones (100%), with 92% category accuracy. Every error goes the cheap way: 7 routine items surfaced, none missed. The model reads only what rules can't settle. When it finds a material event under a vague subject ("General Updates" carrying HDFC Bank's new MD & CEO), the event decides the card.
- **The model transcribes; code computes and judges.** QoQ/YoY, margins and every promise status are computed in code. Revisions come from comparing values, dates and target periods across calls, never from management's "on track" (Deepak Nitrite called its polycarbonate date "in line" while it moved three times).
- **Checks that catch wrong columns, not just wrong sums.** An independent audit of every card against its source PDF found tables that passed per-column arithmetic but were wrong:
  - Ather's "revenue down 26%": last year's column had been read as this quarter; it was actually +63% and Ather's first profit;
  - SBI with rows shifted;
  - standalone shown where consolidated existed;
  - ITC's revenue gross of excise.
  Now a table must satisfy the statement's own identities: half-year = the two quarters; income − expenses ± exceptional = PBT; owners' profit + minority interest = total profit; the bank income and provisions identities. The unit must be the one the document prints, consolidated is preferred, and tables that still fail are withheld, never shown.
  - A second independent audit then checked about 660 results figures, 136 move figures and 717 quotes. Moves, people cards and quotes were clean. It still found about 55 wrong results figures (a unit misread as lakhs instead of millions; owners' profit missed in six layouts), and every one was traced to its cause and fixed.
  - 16 of 18 portfolio results are shown and 2 withheld.
  - The results badge names only the checks that ran on that table, and a table needs two independent identities (or two lines equal to the exchange XBRL) to be shown.
  - A third independent audit (E31) found that the ledger turned genuine quotes into wrong verdicts and that a visible alert opened a missing card. Quotes were 1,575/1,575 verbatim, which was the point: **quote fidelity is not verdict correctness**, so they are now measured separately.
  - That loop is the clearest example of how I worked with the AI tools: treat a passing check as a claim to verify, measure, then fix the cause, not the instance.
- **Cite or drop, for words and numbers.** Every quote from a transcript or annual report is the page's own text, and unverifiable statements are dropped; a filing's summary is checked against the filing's text too (since 14 Nov: 141 of 156 stored events verified, 7 from scanned pages labelled "quote not checked", 8 withheld and shown under their plain subject) (84/84 hand-labelled quotes found, off-by-one pages corrected). A figure in a ledger row must be printed in its quote: the model once turned "grow almost to 2x" into "200%".
- **Wording follows evidence.** "Worked together" only when dates overlap. Many real bios give employers without years, so FINN says "also worked at X (dates not disclosed)".
- **What I left out on purpose:**
  - a chat box as the front door;
  - sentiment scores;
  - a composite "credibility score", because a single number invites false precision;
  - model-written bull/bear cases;
  - a network graph view, which reads badly at phone width and answers a vanity question.
  - **balance sheet and cash quality** (the Pull menu's items): FINN extracts no cash-flow statement or balance sheet, and a ratio built from a results table alone would be wrong. They are the next extraction, not a chart over missing data;
  - **bull vs bear:** a model's opinion dressed as analysis is exactly what "no AI slop" forbids. The ledger and Ask give the company's own words; the investor makes the case.

## Architecture

```
 residential worker (Mac, scheduled)                     cloud
 ─────────────────────────────────────                  ─────────────────────────────────
 NSE RSS + Reg 30 XBRL ─► rules classifier ─┐
 results PDF + XBRL ─► table read + checks ──┼─► cards ─► export ─► Supabase (public: market data)
 NSE bhavcopy ─► moves vs 20-session avg ────┘            │        Supabase (private: your network,
 transcripts ─► extract, verify, link, status ─► ledgers ─┘          row-level security per visitor)
 transcripts + MD&A ─► speaker passages ──────────────────► Supabase (public: passages, full-text index)
 annual report ─► multi-year table, on-page check ─► trajectory (in the snapshot)
 your rules + push endpoint (private row) ◄── worker reads at each cycle ─► web push to your device
 your network (local) ─► deterministic matching ─► private lines ─┘          │
                                                                    Next.js PWA on Vercel (Mumbai)
                                                                    ◄── coverage requests (any NSE ticker)
```

## Data pipelines

| Need | Source | Cadence |
|---|---|---|
| Announcements | NSE RSS (whole market, ~1 day window) + linked Reg 30 XBRL; per-company backfill | every 15 min; daily backfill |
| Results | the filing's PDF table (current, previous and year-ago columns), checked against the statement's own arithmetic identities, and against the Integrated Filing XBRL when that has been filed (3 of the 41 tables shown on 14 Nov; the other 38 pass the identities only) | on filing |
| People | the appointment filing's own bio (XBRL `BriefProfile` or the annexure) | on filing |
| Prices | NSE UDiFF bhavcopy (one public file, all stocks) | after close |
| Transcripts and annual reports | exchange PDFs (screener.in only to discover the links) | pre-built for the Nifty 50; on request otherwise |
| Ask passages | the same transcripts and the annual report's MD&A, split by speaker turn | rebuilt when a ledger changes (5 per cycle) |
| Trajectory | the annual report's five- or ten-year summary page | once per report, cached |

- **Matching a name in a filing to a person in the network.**
  - The filing gives a name, a role, employers, schools and sometimes years.
  - "Same person" needs the exact name and the organisation; in production, the director's DIN.
  - "Worked together" needs overlapping dates at the same organisation. Dates come from the bio, or from the filing's own words for someone leaving ("served the Bank for nearly 27 years" filed in 2026 means about 1999–2026).
  - Same employer or school without dates is said as such.
  - Company names are normalised, but a subsidiary is not its parent (HDFC Ltd is not HDFC Bank).
  - Everything runs locally; no contact data goes to any model.
- **Where it runs.** NSE and BSE refuse or time out datacenter IPs (measured three times), so ingest runs on a residential machine and the cloud serves its output. It uses only files NSE publishes for download, with an honest User-Agent, per-host spacing, a disk cache, and no retries after a refusal. In production a licensed feed replaces this: NSE Corporate Data or a vendor such as TrueData or Accord.

## Security and privacy

- **Two kinds of data, two policies.**
  - Public market data is readable by anyone and writable only by the worker.
  - The investor's network is in Postgres with forced row-level security. A visitor can *read* only their own rows; nothing in the app can write them.
  - Each reviewer gets an anonymous session with a private copy of the demo network, so isolation is real, not described.
  - A live check runs against the real database: two visitors can't see each other's network, public data is read-only, and no contact name appears in the public payload.
- **What is stored, and for how long.**
  - For each contact: name, employers and roles with dates, schools, expertise tags, and interaction counts and dates (never message content).
  - Demo visitors and their copies are deleted after 14 days by a nightly database job.
  - For a real investor: kept while the account is active, purged within 30 days of deletion or of withdrawing consent for a source, and an export on request.
- **Consent and access control, for real.**
  - Contacts come only from the investor's own consented imports (a LinkedIn `Connections.csv`, Google Contacts, a CRM), each source with its own scope and on/off switch.
  - Email and calendar would give metadata only, opt-in.
  - Access would be per user, with a team role only if the investor shares, and an audit log of every network view behind a share.
- **Models.** Contact data never goes to a model: matching is deterministic and outreach notes come from templates. Filings are public documents and go to Gemini's free tier first, including those that name people (a deliberate choice for this demo; one setting, `FINN_PEOPLE_PAID_ONLY=1`, keeps them on the paid no-training API instead).
- **Secrets.** The service key lives only on the worker; secrets live only in `.env`.
- **DPDP.** The Rules were notified in Nov 2025, with their main obligations from about May 2027. The design already follows the essentials: purpose-limited consented sources, deletion by owner, and minimal processor exposure.

## LLMs and agents

FINN is deliberately **not** an autonomous agent. Push and Pull are fixed pipelines, which makes them cheaper, testable and explainable. The model does three narrow jobs, each against a JSON schema:

1. read a filing into typed events (with the people named in it);
2. transcribe a results table, as text or as an image of a scanned page;
3. transcribe a transcript's forward-looking statements and stated actuals;
4. read the annual report's five-year table, one page at a time (a figure is kept only if it is printed on that page).

Ask the documents uses no model: it is full-text search in Postgres over the company's own passages, so an answer can only be the company's words.

Copy rules are enforced in code: a headline needs a verb and a fact, a "why" line without a number is dropped, and qualifiers like "up to" are kept.

- **Models.** Gemini's light model (free tier) handles public documents. A stronger model was tested and was not better on my labelled set. OpenAI (paid, behind a spending guard in code: the logged cost estimate is checked before each call, so it is a budget guard, not a billing cap) is used only when Gemini fails. Model names are discovered at runtime; identical requests are answered from a disk cache, so rebuilds are free and reproducible.
- **Extraction, measured** against 84 statements I hand-labelled from 8 transcripts:
  - a single pass found 55%;
  - overlapping 6-page windows find 80%, at 61% strict precision;
  - half of the "false positives" were genuine commitments my labels had missed, so effective precision is near 80%.
- **Linking.** Deterministic, with pairwise precision 0.88 / recall 0.70 on BEL and 0.75 / 0.67 on Deepak Nitrite. Model-assisted linking was noisier run to run, so it stays off. BEL's ledger shows the machine-built version by default, with the hand-checked reference one tap away.
- **Cost.** $2.87 of paid model spend for the entire build, across 1,985 logged model calls (1,106 on Gemini's free tier, 879 paid), and nothing paid since 12 Nov: most of it the paid fallback while Gemini's free tier was overloaded during the pre-build, plus filings that named people, which went to the paid API until 12 Nov (now free tier first). Rebuilding every ledger after a logic change costs nothing: identical requests come from the cache (37 ledgers rebuilt, 0 model calls). A ledger on the free tier costs $0; reading a filing is free unless Gemini fails, when the fallback costs about $0.005, so a day of Push for 18 holdings costs at most cents.

## Cloud

- **App:** Next.js 16 PWA on Vercel (free), functions in Mumbai next to the database. One link opens on any phone and installs to the home screen.
- **Database and auth:** Supabase Postgres + anonymous Auth (free). A daily cron keeps the free project from pausing.
- **Worker:** Python on a residential Mac (a launchd job is provided).
- **Cost:** $0 at prototype scale, plus model usage.

## Profiles: what I used and how I'd do it for real

- **What I used.** The network is **synthetic**: 29 fictional people whose dated careers overlap the real companies, and some of the real people, in the demo filings. The app says so on the first screen. Incoming executives' backgrounds come from the **exchange filings themselves**, which are primary and public.
- **No scraping.** I did not scrape LinkedIn. The hiQ litigation ended with a judgment and injunction against scraping, and Proxycurl shut down in July 2025.
- **For real:**
  - the investor's own consented imports (LinkedIn export, contacts, CRM);
  - opt-in email/calendar metadata for recency;
  - licensed MCA director data for board interlocks and DIN-based identity.

## What I'd do next

1. A licensed announcements feed and a cloud worker in Mumbai, so Pull builds any company in about a minute without a queue.
2. Push from the cloud rather than the Mac worker, so a notification never waits for the laptop to be awake; and email as a fallback for browsers without web push.
3. Balance sheet and cash quality from the annual report's statements (operating cash flow against profit, net debt), with the same "on the page as printed" check the trajectory uses.
4. The rest of the third audit's plan, deliberately left for after submission: a typed evidence store (target versions, outcome observations, comparisons), versioned snapshots switched atomically, a Postgres job queue with leases for on-demand research, refresh when a source changes rather than when a file is missing, reading every event in a results filing, and structured people filings.
5. Annual-report promises as ledger rows (capex and capacity targets live there), and segment-level tracking against filed segment results.
6. A sector-specific fourth metric (volumes for autos, order book for capital goods, NIM/GNPA for banks).
7. A held-out evaluation refreshed every quarter, with a re-audit of every displayed number against its source.
