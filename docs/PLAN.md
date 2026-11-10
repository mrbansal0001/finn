# FINN: final research summary and build plan (v2)

*ENAM Holdings, Founding AI Engineer Build Challenge. Written 10 Nov 2026. Status: **waiting for approval; no implementation code written yet.***

This replaces `archive/PLAN-v1.md`. The v1 Phase 1 material (hard gates, rules R1–R18, ambiguities A1–A9) still holds, and this document links to it rather than repeating it. Evidence lives in `research/`:

| File | What it holds |
|---|---|
| `00-hands-on-experiments.md` | Nine experiments on real NSE, BSE and screener data (E1–E9) |
| `01-competitors.md` | About 45 products: Indian retail tools, institutional platforms, relationship-intelligence tools |
| `02-data-sources.md` | Every data source, probed, plus terms of use and licensing costs. The agent was stopped before finishing; I reviewed it and closed the gaps in its §9 addendum. |
| `03-product-design.md` | Interaction concepts, wireframes, design system, anti-slop rules |
| `04-architecture.md` | Extraction and grounding research, models, privacy (DPDP), hosting, cost |
| `05-promises-ledger-gold/` | Hand-labelled answer key: 84 guidance statements / 44 promises across BEL + Deepak Nitrite, 4 calls each |

Labels: **[measured]** = I ran it and recorded the result. **[est]** = an estimate that a logged number will replace. **[decision]** = my recommendation, which you approve or reject.

---

## 0. The recommendation in one page

**What we build:** FINN as **"The Edition"**. It is a mobile web app (PWA) that speaks first, says little, and stops.

| Layer | What the investor sees | Why this and not the obvious thing |
|---|---|---|
| **Push** | A digest that **ends**. It shows 3 lead cards, then "N more worth a look", then one folded row "41 routine filings", then *End of edition*. A window chip (24h ▾ / since last visit / 7d / custom) sets the period. There is a 60-second "Brief me" audio read-out. Alerts (announcement types, volume above N× the 20-day average, price beyond ±X%) are user-set and appear as cards in the same edition. | Every Indian tool sends one ping per filing (Trendlyne, Tijori, Screener, broker apps). The ENAM brief asks for prioritisation and folding of routine filings. Nobody does a finite, ranked digest. |
| **Pull** | Type any NSE ticker to get a company page. Its centre is the **Promises ledger**: every piece of guidance management gave over 4 quarters. Each row has a status per quarter (● delivered, ◐ partly, ○ missed, — went silent, ↻ revised), a verbatim quote, and a page citation you can tap. A snapshot and the delivered numbers sit around it. | This is what the brief says it values most. The closest products are Tijori's "Management Credibility" and Multibagg's guidance table. Neither shows *went silent* or *revised*, which are the most telling signals. |
| **Network** | Never a tab. It appears as **one quiet line on a card**, e.g. "◦ Priya Menon reported to him at Bosch, 2014–16 · last spoke 7 mo ago". On a company page it appears as "people who'd know". Tapping it opens a sheet explaining the link and how strong it is. | The brief says "quiet advantage, not a contact list". Relationship tools (Affinity, Happenstance, BoardEx) never join *this filing* with *this person you know*. That join is the gap. |

**How it is built:**
- A **Python ingest worker**, scheduled, pulling official NSE downloadable files (RSS, XBRL, PDFs, bhavcopy).
- **Supabase Postgres** with row-level security, so each investor's network is private by construction.
- A **Next.js PWA on Vercel**.
- **Rules first, LLM second.** Roughly 80% of classification and all numbers are deterministic code. Haiku 5.5 handles the residue and the bulk extraction. Sonnet 5.5 handles the promise reasoning.
- **Every claim carries a page citation that code has verified exists.**

**Expected cost [est]:**
- About **$0.05 per day** to run Push for a 20-stock portfolio.
- About **$0.12–0.35 per new Pull company**, depending on the model chosen after the eval (§6).
- Hosting is free tier.

**The biggest risk, and the answer to it.** The deployed app probably can't fetch NSE or BSE documents itself. NSE timed out from datacenter IPs twice (E5, E8), and BSE returned 403 to a datacenter request today [measured]. A grader will type a ticker we didn't pick. So:
1. Pre-build Pull coverage for about **110 tickers** (Nifty 100 plus the demo set) from a residential machine.
2. Test GitHub Actions on Day 1. If it can reach NSE, live on-demand fetching works anyway.
3. For anything else, offer an honest "not covered yet" path: queue it for the worker, or drop the transcript PDF in. The PDF then gets the full pipeline in the cloud.
Details are in §5.

---

## 1. Which existing product does each part best, and what we take from it

From `01-competitors.md` (about 45 products):

| Need | Best today | Why it is best | Its weakness | What FINN takes / does differently |
|---|---|---|---|---|
| Filings alerts (India) | **Tijori** (alerts plus "Radar" thesis monitors; powers the Zerodha Console timeline). Trendlyne has the best alert taxonomy and email digests. | Covers every filing, has good categories, links to the PDF | One notification per filing. No ranking across the portfolio, no idea of "routine", no reason why a filing matters to *you* | A ranked, finite edition. Routine filings folded. A one-line "why it matters" that contains a number. |
| Guidance tracking | **Tijori Management Credibility**; globally **Daloopa** (guidance linked to reported actuals) and **AlphaSense** (sentence-level citations) | Ties a statement to an outcome | Tijori: a score without the trail. Daloopa/AlphaSense: institutional prices, US-centric, not mobile. | A ledger with **statuses over time** (silent / revised), a verbatim quote, and a tappable page for each cell. Arithmetic done in code. |
| Relationship intelligence | **Affinity** (strength scoring), **Happenstance** (natural-language "who knows…"), **BoardEx** (executive overlap) | Infers strength, finds paths | Separate apps. Strength comes from email metadata, which Indian investors largely don't route through. They never join with market events. | The network as an annotation on events. Strength from recency, frequency and a user rating. Evidence ("overlapped at Bosch 2014–16") instead of a score. |
| Mobile research | Nobody does it well. Screener has no app. Broker apps are trading-first. | — | — | Mobile-first density: tabular numbers, serif headlines, sheets you swipe down to close, cards you can act on with one thumb |

**Anti-patterns we deliberately avoid:**
- One ping per filing
- Sentiment labels ("Positive 😊")
- Opaque scores
- A chat box as the home screen
- A contact list or network graph as the Network UI
- Generated prose without sources

---

## 2. The product in detail

### 2.1 Screens (390 px wide; wireframes in `research/03-product-design.md` §6)

1. **Edition (home = Push).**
   - **Header:** the date, a window chip, and "Brief me · 60s".
   - **Up to 3 lead cards.** Ranking (in code, explainable on tap): tier weight → surprise → holding weight → recency.
   - **"N more worth a look"** as compact rows.
   - **"41 routine filings: trading-window closures, newspaper ads, …"**, folded and expandable.
   - **"End of edition."**
   - **Empty window (e.g. Sunday):** it says so and offers "since last market day".
2. **Card types.** Each follows the same copy schema: *kicker, headline, why, sources, network line, actions*.
   - **Management change:** the person, the role, director/KMP/senior-management, effective date, the reason if they resigned. A 3-line bio comes from the filing's `BriefProfile`. Then the network overlap.
   - **Results:** Revenue, EBITDA, PBT, PAT. Each has QoQ and YoY (margins in basis points) and a sparkline. A sector-specific 4th line: NII/GNPA for banks. Exceptional items are flagged. Any guidance from the ledger that this result settles appears too.
   - **Material event** (M&A, fund raise, litigation, credit rating, pledge, forensic audit…): what happened, with its size relative to the company. "Best placed to explain: X, because …"
   - **Move** (price/volume alert): the fact and the threshold the user set. If no filing explains it, the card says "**no filing explains this move**". FINN never guesses a cause. (I deliberately disagree here with the design agent, which suggested speculative causes.)
3. **Company page (Pull).** Search any NSE ticker.
   - **Snapshot:** what they do and the segments. Every sentence is cited to the annual report.
   - **Promises ledger:** 4 quarters.
   - **Delivered numbers:** 4–8 quarters.
   - **"People who'd know".**
   - **Coverage badge:** "Built from 4 transcripts + FY26 AR · updated 8 Nov".
   - **States:** ready / building (with progress) / partly available (e.g. "no concalls held, ledger unavailable") / not covered (queue it, or upload the PDF).
4. **Alerts settings.** Category toggles across the 17 ENAM categories (with sensible defaults), the volume multiple, price ±%, and "max 3 leads".
5. **Person sheet** (opened from any network line). How you know them, evidence of the overlap, last contact, a strength explanation, and "draft a note".

**Cut first if we fall behind:** the audio brief, an "Ask" box, Web Push notifications, the expertise map.
**Never cut:** a working link, all three layers, the management-change card, the results card, the Promises ledger, the network lines.

### 2.2 Copy rules (anti-slop, enforced by tests on the generated JSON)

- The headline has a verb and a fact: "Titan's Vice Chairman Noel Tata retires". Never "Leadership update at Titan".
- "Why" contains a number. Every number has a unit and a period.
- No emoji, sparkles, gradients, "delve", or hedging stacks.
- Each claim has a source chip. A sentence without a source is dropped, not shown.
- Margins are in basis points, growth in %, money in ₹ crore, consistently.

### 2.3 What makes it feel like a "quiet advantage"

What FINN notices that the investor wouldn't:
- **Second-degree paths.** "Your contact Rahul sat on the board of Kalyan with the new CFO's former boss."
- **Tenure overlap.** It requires overlapping *dates*, not just the same employer. Real bios often omit years (E16), so every network claim is **worded to its evidence**:
  - "worked together at Bosch, 2014–16" only when the dates overlap;
  - "both ex-McKinsey (dates not disclosed)" when they don't;
  - "same person (DIN match)" when the filing gives a DIN.
- **Decay nudges.** "You haven't spoken to Anita in 9 months; she ran treasury at the company that just announced a ₹2,905M investment."
- **Reasons, not scores.** Strength is computed (formula in `04-architecture.md` §4), but the UI shows the evidence.

---

## 3. Data: what comes from where (all probed)

| Need | Source (prototype) | Evidence | Notes |
|---|---|---|---|
| Announcement feed | NSE RSS `Online_announcements.xml` (≈600 items/day, `SUBJECT` category), plus linked **Reg 30 XBRL** for typed events | E7, E9, `02` §1.2 [measured] | 24% of items link to structured XBRL. Fallback/backfill: `api/corporate-announcements` (residential only, used sparingly) |
| Management change | **CIM XBRL**: type, category, name, designation, effective date, reason, **`BriefProfile`** | E9, `02` §1.5 [measured] | Deterministic. The LLM parses the bio into employers/schools/years. PDF fallback; 10/10 sampled PDFs contain bios (E6). |
| Results, current quarter | **Integrated Filing (Financials) XBRL** via `Integrated_Filing_Financials.xml` RSS | `02` §1.4 [measured] | Exact values. **Contains only the current quarter and YTD, no comparatives** [measured today]. |
| Results, QoQ/YoY | The **results PDF in the same filing** has 6 columns (Q, Q-1, Q-4, H1, H1-1, FY-1) (E4). The P&L page is found by keyword score, then sent to the model **as page text if the text layer is clean, or as a page image if it is scanned**. The current-quarter column must equal the XBRL **on the 1:1 lines** (Revenue, Other income, Finance costs, D&A, PAT). PBT reconciles through the JV/associate-share line, because the XBRL puts that share after tax (E13). The unit comes from XBRL `LevelOfRounding`. | **Tested on 2 real filings, both passed**: COCHINSHIP (digital), KALYANKJIL (scanned) (E13, E14) | Avoids the `www.nseindia.com/api` endpoints, which NSE's terms most clearly forbid. Also stored per quarter going forward. |
| EOD price/volume | **NSE UDiFF bhavcopy**: one daily file for all stocks. 20-day history for the volume average. | `02` §1.1 [measured] | Fallbacks: the official NSE MCP server, then yfinance (personal-use terms; 429s in cloud) |
| Concall transcripts | screener company page → BSE PDF links (follow the 302). Parallel path: NSE "Analysts/Institutional Investor Meet/Con. Call Updates" RSS items | E1, E5, today [measured] | Coverage across 7 tickers spanning bank, PSU, 2025 IPOs, small cap and micro-cap: **5 of 6 call-holders have all of the last 4 quarters**; the newest is sometimes pending (≈5-day lag); the micro-cap holds no calls → honest state. |
| Annual report | NSE `annual_reports` / BSE `AttachHis` PDFs. Locate the MD&A from TOC page numbers and send only that section (10–30 pages). | `02` §6 [measured] | ARs run 130–460 pages; never send the whole thing |
| Network profiles | **Synthetic network** of about 80 people, hand-built to overlap real incoming executives' employers, schools and boards in the demo window. Plus an import path for the user's own LinkedIn `Connections.csv` export, to show "how for real". | `04` §4 | No LinkedIn scraping (hiQ judgment; Proxycurl shut down Jul 2025). Disclosed in the writeup (gate 10). |

**Terms of use stance:** non-commercial evaluation prototype.
- Prefer files NSE publishes for download (NSE's terms make an exception for downloadable content).
- Send an honest User-Agent. Poll gently (RSS every 15 min, bhavcopy daily). Cache everything.
- No impersonation, proxies or retries after a 403.
- Screener is used only to *discover* exchange PDF links, never to display its tables.
- The writeup names the licensed path for production: NSE Corporate Data ₹10.6 lakh/yr, or a vendor such as TrueData or Accord.

**Pitfalls the code must handle**, all seen in real data:
- Standalone and consolidated filings both arrive (Avanti twice in one feed), so prefer consolidated.
- `ProfitLossForPeriod` appears twice (total vs. attributable to owners).
- ₹ crore vs. ₹ million vs. absolute rupees.
- Exceptional items (BHARATFORG PBT 444 → 4,179).
- Bank taxonomy has no EBITDA.
- One board-outcome letter can hold several events (TITAN: results + Vice Chairman retirement), so extraction is **multi-label**.
- Constant-currency IT guidance vs. INR actuals.
- Name honorifics; blank names in some filings.
- XBRL PBT ≠ PDF PBT when a JV/associate share exists (E13).
- Scanned results PDFs whose text layer is garbage, so they need the vision path (E14).
- Indian digit grouping (1,03,226.16).
- Lakh is a third unit, alongside crore and million.
- Non-Ind AS XBRL uses different tag names, so a tag-alias map is needed.
- SME companies report half-yearly, so there is no QoQ (E15).
- Banks: NII is computed (interest earned − expended), plus PPOP, provisions and GNPA/NNPA. Standalone and consolidated share one page (E15).
- Show PBT/PAT both reported and before exceptional items (KALYANKJIL: +60% vs +39% YoY).
- Bios: years often missing; annexure "enclosed separately"; several people per XBRL file; DIN sometimes present (E16).

---

## 4. Architecture

```
  RESIDENTIAL / GH-ACTIONS WORKER (Python, scheduled)                        CLOUD (free tier)
  ─────────────────────────────────────────────────                         ─────────────────
  NSE RSS + Reg30 XBRL ──► rules classifier ──► Haiku (residue, ~20%) ──┐
  Integrated-filing XBRL ─► parse ─► results PDF table (Haiku) ─► check ─┤    Supabase Postgres
  Bhavcopy (daily) ───────► volume/price alert eval ─────────────────────┼──► events, numbers, docs,
  Transcripts / AR PDFs ──► page text ─► guidance extraction (per doc) ──┤    guidance, people (RLS)
                                         └► quote verified on page (rapidfuzz)  ▲          │
  Job queue (poll) ◄────────── "build ticker X" requests ─────────────────────────┘          ▼
                                                                         Next.js PWA on Vercel
  Synthetic network ─► entity resolution (normalise → block → rapidfuzz     Edition · Company · Alerts
                       → date-overlap corroboration) ─► edges w/ evidence   Person sheet · PDF upload
                                                                            (upload → cloud pipeline)
```

**Key design choices [decision], each with evidence:**

1. **Deterministic DAGs, not an autonomous agent.** Push and Pull have fixed steps, so a pipeline is cheaper, testable and explainable. LLMs are used only where language must be understood: residual classification, bio parsing, table reading, guidance extraction, promise matching. (`04` §5)
2. **Extract per document, then reason over the structured JSON.** Quality drops when several transcripts share one prompt (Hudson Labs). FinanceBench shows naive retrieval fails or refuses in 81% of cases. A transcript is about 26K tokens and fits whole in one call, so **v1 has no vector database** (this overrides `04`'s pgvector suggestion: less machinery, same quality).
3. **Guidance JSON schema** (`04` §2): metric, scope, type, low/high, unit, period, conditionality, quote, page, speaker, whether it reiterates or revises earlier guidance. **Hit/miss is computed in code** from the numbers, never judged by the LLM (FinVerBench: LLMs over-flag numeric inconsistency).
   **Additions from the hand-built gold set** (E17: 84 statements, 44 promises, BEL + DEEPAKNTR):
   - A stable `promise_id` links restatements across calls. Revisions are detected **in code** by comparing each value or date with the previous statement, never from management's "on track". DEEPAKNTR's commissioning date moved 3 times while management called it "in line".
   - A bound type: floor / approximate / range. This makes ">28%" → "~28%" visible as a softening.
   - `speaker_role` separates management from analyst numbers, since analysts' numbers look like guidance.
   - A `conflict` flag where one call contradicts itself (BEL Q1FY27). Shown as "conflicting statements, p.4 vs p.21", never silently read as a revision.
   - **Evidence source on every status cell.** Only 21% of promises can be checked against filed numbers; 44% only against management's own later statements; 33% not at all. The UI marks each cell **"filed"** (results/XBRL), **"per management"** (later call, quote + page), or **"not checkable from filings"**. Being honest about this is a feature: no competitor shows it.
   - Cite the PDF page and translate it to the printed page (PDF = printed + 1 because of the exchange cover letter). Quote matching must handle hyphenation at line breaks.
   - Actuals must match the guidance basis: consolidated vs standalone, segment.
4. **Citations verified in code.** Every quote must fuzzy-match (≥90) the text of its cited page, or it is dropped. We do not use the Citations API, because it can't be combined with structured outputs.
5. **Classification:** RSS `SUBJECT` / XBRL type → about 20 ordered rules (80.5% coverage on 5,756 filings, E2) → Haiku for the rest and for uninformative "General Updates" (reading the PDF's first 2 pages). This overrides `04`'s `desc`-based rules, because `desc` is noisy (E2).
6. **EBITDA = PBT + finance costs + D&A − other income** (operating EBITDA, the screener convention). It is labelled and the formula is shown on tap. Banks get NII / PPOP / GNPA instead.
7. **Privacy:**
   - RLS on every user table (`owner_id = auth.uid()`), plus CI tests proving one user can't read another's data.
   - Network PII never leaves Postgres except as pseudonyms (`P-17`) in LLM prompts.
   - Anthropic API only: no training on API data. Never a free tier that trains on inputs.
   - The service key lives server-side only, and the key only in `.env`.
   - The writeup covers DPDP: Rules notified Nov 2025, main obligations around May 2027.
8. **Hosting:**
   - Vercel Hobby for the app.
   - Supabase Free for the DB and Auth. It pauses after 7 days idle, so a keep-alive cron runs through the review period.
   - GitHub Actions for scheduled jobs, if it can reach NSE.
   - Otherwise a launchd job on your Mac. That is honest and documented; a licensed feed is the real fix.
   - PDFs are cached in Supabase Storage (R2 only if we outgrow it; one fewer account).

---

## 5. The hidden test: "point it at a company you didn't pick"

| Layer of defence | What it covers | Status |
|---|---|---|
| 1. Pre-built coverage | Nifty 100 + demo + research set (~110 tickers). Promises ledger + snapshot built in advance from the residential worker, via the Batch API (−50%). | Planned. Cost depends on model (§6). |
| 2. Live on-demand | If GitHub Actions or Vercel can reach screener + BSE/NSE PDFs, any ticker builds in ~60–90 s. | **Unknown.** Screener works from a datacenter (E5); BSE 403 and NSE timeouts from WebFetch's datacenter (E5, E8, today). Test from GitHub Actions on Day 1. |
| 3. Worker queue | Request stored. The residential worker builds it within minutes when online. UI shows "queued". | Planned |
| 4. Bring the document | "Drop the transcript or AR PDF." The upload runs the same pipeline in the cloud with no exchange fetch. | Planned. Also demonstrates the pipeline is generic. |
| 5. Honest partial states | No concalls (micro-caps), transcript pending (≈5-day lag), bank taxonomy | Planned |

**Hold-out evaluation:** 10 tickers we never tune on, including a bank, PSU, micro-cap, 2025 IPO and a demerged name. We report the success rate, latency and cost per ticker.

---

## 6. Models and cost

Prices are from the Claude API reference, per MTok in/out:
- Haiku 5.5: $0.10 / $0.50
- Sonnet 5.5: $2 / $10
- Opus 5.5: $4 / $20
- Batch: −50%

| Job | Model | Per unit [est] |
|---|---|---|
| Residual classification (~20% of ~40 portfolio filings/day) | Haiku | ≈ $0.005/day |
| Bio parsing, results-table reading | Haiku | ≈ $0.003 per filing |
| Guidance extraction, 4 transcripts × 11–26K tokens (BEL/DEEPAKNTR 11–17K, INFY 26K) | **Haiku vs. Sonnet, decided by eval** | Haiku ≈ $0.015 / Sonnet ≈ $0.30 per ticker |
| Promise matching + snapshot | Sonnet | ≈ $0.08 per ticker |
| **Push, daily** | | **≈ $0.05/day** |
| **Pull, new ticker** | | **≈ $0.10 (Haiku extract) – $0.38 (Sonnet extract)** |
| Pre-building 110 tickers (Batch) | | **≈ $6 – $21** |
| Evals + development | | ≈ $8 |

**Model choice:** run the guidance-extraction eval on Haiku first. Upgrade to Sonnet only if recall on a hand-labelled set of ~40 guidance statements falls below about 90%. That makes a good efficiency story in the writeup, because the cost difference is 20×. Every cost figure in the writeup will come from logged `usage`.

---

## 7. Evaluation (each number in the writeup comes from here)

| What | Method | Metric |
|---|---|---|
| Classification | ~150 real filings hand-labelled (category + material yes/no); 50 held out. Rules vs. rules+Haiku. | Accuracy, **material recall**, $/1k filings |
| Results numbers | 20 filings: XBRL vs. PDF-table extraction vs. screener | Exact-match %, unit errors caught by the XBRL check |
| Guidance extraction | **Gold set built (E17):** 84 statements / 44 promises, BEL + DEEPAKNTR × 4 calls, quotes verified 158/158 | Recall, precision, status agreement, quote-verification pass rate; Haiku vs Sonnet |
| Grounding | Every displayed claim has a verified page quote | Citation validity % (target 100%; failures dropped) |
| Entity resolution | 20 real appointment bios + seeded matches + **decoys** (same name, different person) | Precision/recall of "you know them" |
| Hold-out Pull | 10 untouched tickers | Success rate, latency, $ per ticker |
| Alerts | Fixture price/volume series | Unit tests pass |
| Privacy | Two test users | RLS isolation test passes in CI |
| Mobile | Real iPhone Safari + Android Chrome; Lighthouse mobile | Checklist + score |

---

## 8. Milestones (assumes ~8 h/day; adjust to your hours)

| Day | Work | Exit criterion |
|---|---|---|
| **Wed 11 Nov** | Repo (`~/finn`), Supabase, Vercel skeleton deployed. **GitHub Actions reachability probe (NSE RSS, nsearchives PDF, BSE PDF, screener).** Pick portfolio (15–20) + research set (3–5). Ingest RSS/XBRL/bhavcopy → DB. Label filings. | Link opens on a phone. Probe result logged in DECISIONS. Events flowing. |
| **Thu 12** | Classifier + eval. Results pipeline (XBRL + PDF columns + check). Edition screen with the window chip, folding and ranking. Management-change and results cards. Synthetic network + entity resolution. | **Gate-passing build:** Push + Network-in-Push live |
| **Fri 13** | Pull: transcript/AR fetch, guidance extraction + eval, Promises ledger UI, citations, coverage states, PDF upload. Start pre-building coverage. | Ledger works on demo + 3 hold-out tickers |
| **Sat 14** | Material-event + move cards, alerts settings, person sheet, hold-out eval, design polish, real-device testing. **Feature freeze 18:00 IST.** | Every eval number filled in |
| **Sun 15** | Writeup + diagram, README, AI-history export, final phone check, **submit by midday IST** | Email sent |

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cloud can't reach NSE/BSE | **High** (3 datacenter failures measured) | High | §5 layers 1, 3, 4. Residential worker. Document honestly. |
| Grader picks an uncovered ticker while the laptop is off | Medium | High | Pre-built coverage of ~110 tickers + PDF upload path |
| Quiet news window when graders open the app | High | Medium | "Since last market day" default; curated `?asof=` replay of a busy day |
| Wrong numbers on a results card | Medium | **Very high** (credibility) | XBRL is the truth; PDF columns must match it; source link on every number |
| Invented facts in Pull | Medium | Very high | Cite-or-drop + quote verification in code |
| Supabase pause / free-tier expiry during review | Medium | High | Keep-alive cron until 30 Nov |
| Scope creep | High | Medium | Cut list (§2.1), freeze Sat 18:00 |
| Secrets or ENAM PDFs in the public repo | Low | High | `.gitignore` from commit 1, secret scan, PDFs never committed |

---

## 10. Submission checklist

See v1 §4.6 (all 12 hard gates). Additions:
- Pull is tested live on a fresh ticker on the day of submission.
- The writeup discloses: synthetic network + filing bios + the "how for real" (consented imports, licensed MCA data); the data licensing path; the residential-worker limitation.
- Every cost and accuracy number links to an eval log in the repo.

---

## 11. Decisions I need from you before writing code

1. **Approve the product direction:** The Edition + Promises ledger + network lines on cards. Yes / change?
2. **Hours** per day, 11–15 Nov.
3. **Anthropic API key** (goes only in `.env`) and **spend cap**. I suggest **$30**, which covers pre-building 110 tickers even with Sonnet. With Haiku extraction the total is ≈ $15.
4. **Accounts:** OK to use your GitHub (public repo), Vercel and Supabase? Repo at `~/finn`?
5. **Your Mac as the fallback worker** (a scheduled job while it's on)? This is the plan if GitHub Actions can't reach NSE.
6. **Portfolio:** any sectors/companies you know well? You will present it in an interview.
7. **Deadline time:** should I draft a one-line email to assessment@enam.com asking for the cut-off time and timezone?
