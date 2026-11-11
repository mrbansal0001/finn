# FINN: writeup

**Prototype:** https://finn-red.vercel.app (built for a phone; each visitor gets a private copy of the demo network) · **Repo:** https://github.com/mrbansal0001/finn · **AI build history:** [ADD LINK BEFORE SENDING]

## What I built

FINN has one point of view: **an investor should be briefed, not fed.** Every Indian tool I studied (Tijori, Trendlyne, Screener, broker apps; about 45 products, `docs/research/01-competitors.md`) sends one ping per filing. FINN writes an *edition*. It ranks, shows up to three leads, counts the rest, folds the routine into one line, and ends.

- **Push, "The Edition".** A digest of your 18 holdings' NSE filings and price/volume moves over the last 24 hours, or a window you pick (3d, 7d, 30d, since your last visit).
  - **Alerts** sit above the digest: each threshold crossing, with the rule that fired (±5% price, 2× the 20-session volume by default). "What counts" lets you change the thresholds, mute announcement types, and set how many leads.
  - **Results cards:** Revenue, EBITDA, PBT and PAT with QoQ and YoY (margins in bp; banks get NII, operating profit and provisions; lenders get no EBITDA). The headline is written from the computed numbers. When one-offs are a big part of profit, it leads with profit before one-offs (Titan: +114% reported, +53% before a ₹671 cr fair-value gain).
  - **People cards:** the person's background from the filing, ranked by seniority (a new MD & CEO leads; a compliance officer's appointment doesn't).
  - **Move cards** name the filing that preceded the move ("Follows its results, Tue 10 Nov 17:08"). If nothing explains it, the card says so instead of guessing.
  - "Brief me · 60s" reads the edition aloud using the phone's own speech engine.
- **Pull, the Promises ledger.** For any NSE company, every promise management made on its last four earnings calls, one row per promise:
  - a glyph per call: ● delivered, ◐ partly, ○ missed, ↻ revised, — went silent, ◌ period ended with no outcome stated;
  - the verbatim quote with its transcript page, and where the evidence comes from;
  - for a company-level, full-year revenue, profit or margin target still running, the latest filed quarter beside it, judged against the target (one quarter is not the year, so the status stays open);
  - the latest results table, the annual report's own description of the business, and the people who'd know.
  - Example, BEL: every FY26 financial target was met, but the QRSAM order date was reset three times and is now "very soon, >99%", with no date.
  - Ledgers for Nifty 50 companies are pre-built by a batch on the worker (20 companies covered when this was written); any other company is built on request.
- **Network, inside both, and askable.** A card carries one line, e.g. *"Lakshmi Raghavan is also an alumnus of PSG College of Technology"* on the card for HDFC Bank's new Chief Compliance Officer.
  - It answers the brief's question directly: has anyone in my network worked with this person, studied with them, or sits one connection away? Overlaps are dated from the filing's own words ("was at HDFC Bank 2009–22, while Kaizad Bharucha was there"). When there is none, it says "no one" rather than padding.
  - **Best placed, and why:** the first suggestion is the person whose role there or expertise fits the event ("as Head, Legal & Secretarial there (2013–20), the closest to this legal matter; reach them through Imran"). Relevance beats warmth.
  - The search box also searches your own network: a name, a theme ("specialty chemicals"), an employer, a school.
  - It knows when *not* to suggest someone: current employees are marked insiders and never offered for an unexplained price move.

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
  - That loop is the clearest example of how I worked with the AI tools: treat a passing check as a claim to verify, measure, then fix the cause, not the instance.
- **Cite or drop, for words and numbers.** Every quote shown is the page's own text, and unverifiable statements are dropped (84/84 hand-labelled quotes found, off-by-one pages corrected). A figure in a ledger row must be printed in its quote: the model once turned "grow almost to 2x" into "200%".
- **Wording follows evidence.** "Worked together" only when dates overlap. Many real bios give employers without years, so FINN says "also worked at X (dates not disclosed)".
- **What I left out on purpose:**
  - a chat box as the front door;
  - sentiment scores;
  - a composite "credibility score", because a single number invites false precision;
  - model-written bull/bear cases;
  - a network graph view, which reads badly at phone width and answers a vanity question.

## Architecture

```
 residential worker (Mac, scheduled)                     cloud
 ─────────────────────────────────────                  ─────────────────────────────────
 NSE RSS + Reg 30 XBRL ─► rules classifier ─┐
 results PDF + XBRL ─► table read + checks ──┼─► cards ─► export ─► Supabase (public: market data)
 NSE bhavcopy ─► moves vs 20-session avg ────┘            │        Supabase (private: your network,
 transcripts ─► extract, verify, link, status ─► ledgers ─┘          row-level security per visitor)
 your network (local) ─► deterministic matching ─► private lines ─┘          │
                                                                    Next.js PWA on Vercel (Mumbai)
                                                                    ◄── coverage requests (any NSE ticker)
```

## Data pipelines

| Need | Source | Cadence |
|---|---|---|
| Announcements | NSE RSS (whole market, ~1 day window) + linked Reg 30 XBRL; per-company backfill | every 15 min; daily backfill |
| Results | the filing's PDF table (current, previous and year-ago columns), checked against the Integrated Filing XBRL when it exists | on filing |
| People | the appointment filing's own bio (XBRL `BriefProfile` or the annexure) | on filing |
| Prices | NSE UDiFF bhavcopy (one public file, all stocks) | after close |
| Transcripts and annual reports | exchange PDFs (screener.in only to discover the links) | pre-built for the Nifty 50; on request otherwise |

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
- **Models.** Contact data never goes to a model: matching is deterministic and outreach notes come from templates. Filings that name people go only to a paid API that doesn't train on inputs, never to a free tier.
- **Secrets.** The service key lives only on the worker; secrets live only in `.env`.
- **DPDP.** The Rules were notified in Nov 2025, with their main obligations from about May 2027. The design already follows the essentials: purpose-limited consented sources, deletion by owner, and minimal processor exposure.

## LLMs and agents

FINN is deliberately **not** an autonomous agent. Push and Pull are fixed pipelines, which makes them cheaper, testable and explainable. The model does three narrow jobs, each against a JSON schema:

1. read a filing into typed events (with the people named in it);
2. transcribe a results table, as text or as an image of a scanned page;
3. transcribe a transcript's forward-looking statements and stated actuals.

Copy rules are enforced in code: a headline needs a verb and a fact, a "why" line without a number is dropped, and qualifiers like "up to" are kept.

- **Models.** Gemini's light model (free tier) handles public documents. A stronger model was tested and was not better on my labelled set. OpenAI (paid, with a hard cap in code) is the fallback and handles anything naming people. Model names are discovered at runtime; identical requests are answered from a disk cache, so rebuilds are free and reproducible.
- **Extraction, measured** against 84 statements I hand-labelled from 8 transcripts:
  - a single pass found 55%;
  - overlapping 6-page windows find 80%, at 61% strict precision;
  - half of the "false positives" were genuine commitments my labels had missed, so effective precision is near 80%.
- **Linking.** Deterministic, with pairwise precision 0.88 / recall 0.70 on BEL and 0.75 / 0.67 on Deepak Nitrite. Model-assisted linking was noisier run to run, so it stays off. BEL's ledger shows the machine-built version by default, with the hand-checked reference one tap away.
- **Cost.** $1.18 of paid model spend for the entire build so far, across 1,041 model calls; most of that is the paid fallback when Gemini's free tier was overloaded during the Nifty 50 pre-build. A ledger on the free tier costs $0; reading a filing that names people costs about $0.005, so a day of Push for 18 holdings costs cents.

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
2. Web push for installed PWAs, so an alert reaches the phone the moment a threshold is crossed.
3. Annual-report promises as ledger rows (capex and capacity targets live there), and segment-level tracking against filed segment results.
4. A sector-specific fourth metric (volumes for autos, order book for capital goods, NIM/GNPA for banks).
5. A held-out evaluation refreshed every quarter, with a re-audit of every displayed number against its source.
