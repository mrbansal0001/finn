# FINN — Research pass & build plan

*ENAM Holdings · Founding AI Engineer Build Challenge · prepared 10 Nov 2026 · status: awaiting approval, no implementation code written*

Sources read in full: `1. ENAM_Founding AI Engineer Build Challenge_Main.pdf` (5 pp, "the brief") and `2. ENAM_Build_Challenge_Reference.pdf` (3 pp, "the reference"). No sample data, validator, API keys or emails were provided. Every "measured" statement below comes from probes run on 10 Nov 2026 (see §2). Anything from memory is marked **[memory — verify]**.

---

## Phase 1 — What the assignment is

### 1.1 The task in one paragraph

Build **FINN**, a mobile-first AI agent for a public-markets investor. It works in two modes. **Push** proactively tells the investor what changed across a 15–20 stock NSE/BSE portfolio: a prioritised filings digest over a window they choose, plus alerts on thresholds they set for announcement types, volume spikes and price moves. **Pull** produces on-demand research on *any* NSE ticker, grounded only in annual reports and concall transcripts. The centrepiece is "promised vs. delivered" against management guidance. Under both sits the **Network**, a private intelligence layer over the investor's own contacts that answers "who do I know who can help me understand this?" It must appear *inside* Push and Pull, not as a separate tab. The backend is plumbing. They grade the product, interaction model, design, judgment and architecture. The deliverable is a working prototype you can try on a phone, plus a public repo, the AI build history and a covering-email writeup.

### 1.2 How it is scored

**No weights are given.** The brief states the criteria in several places:

| Criterion | Exact wording | What full marks probably looks like |
|---|---|---|
| Overall | "How you build, what you choose to build, and the creativity and judgment behind it — not completeness or polish." | Few workflows, chosen deliberately, with a stated rationale |
| Grading list | "We grade creativity, product sense, judgment, and architecture — not completeness." | Four equal pillars (assumed, since no weights are given) |
| Frontend | "This is the heart of the challenge … That's where we most want to see how you think." | A clear **point of view** on interaction, beyond a dashboard of data |
| Interaction | "The best submissions will show a point of view about how an investor should interact with this, not just what data to show." | An opinionated interaction model they haven't seen before |
| Quality bar | "core, concise, beautifully presented, and interactive … Density and design both count … Surprise us with simplicity and elegance, backed by real technical depth." | No AI slop. Dense, calm UI with real data behind it |
| Network | "should feel like a quiet advantage, not a contact list. Show us what it notices that the investor wouldn't." | Inferred, non-obvious links: 2nd-degree paths, overlapping tenures, reasons to reconnect |
| Pull | "promised vs. what was actually delivered … the kind of thing we value most." | A working, cited guidance-vs-actuals table over 4 quarters |
| Bonus | "Efficiency earns bonus points. The less you spend to achieve the same result, the better." | Measured cost per digest and per research run, model routing, caching |
| Process | "We want to understand how you work with the tools: how you break down problems, prompt, course-correct…" | Clean, readable AI session history and git history |

### 1.3 Hard gates (each one is checkable)

1. ☐ **Prototype runs** from a link on a phone. "A demo that doesn't run is the worst outcome."
2. ☐ **Mobile-first.** "Everything mobile-first."
3. ☐ **Push, Pull and Network each have ≥1 working workflow.** "All three layers should be present."
4. ☐ **Network woven into Push or Pull.** "the Network should be woven into Push or Pull, not bolted on beside them."
5. ☐ **Pull generalises to any NSE ticker.** "must not be hard-wired to your demo set … We may point it at a company you didn't pick."
6. ☐ **Pull uses primary sources only.** "No broker notes, no news, no research reports, and don't lean on the model's own outside knowledge of the company."
7. ☐ **Public GitHub repository.**
8. ☐ **AI build history** included as exports or share links.
9. ☐ **Writeup** covers: what you built, decisions and tradeoffs, data pipelines, security & privacy, LLMs/agents, cloud, what you left out, and next steps.
10. ☐ **Profile source disclosed.** "say clearly in your writeup which you used and how you'd do it for real."
11. ☐ **Email** to `assessment@enam.com` with subject **exactly** `IIT Kanpur – Founding AI Engineer - 2027` (en dash after "Kanpur", hyphen before "2027").
12. ☐ **Before the deadline**, 15 Nov 2026 (time not stated, see 1.5).

### 1.4 Every rule and constraint

| # | Rule | Source quote |
|---|---|---|
| R1 | Portfolio of 15–20 NSE/BSE companies, mixed sectors and sizes | "choose your own mock portfolio of 15–20 NSE/BSE-listed companies … different sectors and sizes" |
| R2 | 3–5 ad-hoc research companies, can be outside the portfolio | "pick a handful of companies (say 3–5), which can be outside your portfolio" |
| R3 | Research generalises | "build it so it works on any NSE ticker where the data is available" |
| R4 | Mock network that overlaps the portfolio and research set | "Make sure your mock network overlaps with your portfolio and research companies" |
| R5 | Four data sources: EOD price/volume, NSE/BSE announcements, fundamentals (AR + concalls), network profiles | "Four sources. Get them working; don't over-engineer them" |
| R6 | Respect platform ToS for profiles | "Respect each platform's terms of use: you may use profiles you can legitimately access, a public dataset, or realistic synthetic profiles" |
| R7 | Digest window is selectable, default 24h | "by default the last 24 hours, but let me pick the period" |
| R8 | Configurable thresholds | "Make the threshold configurable: the point is that I decide what 'unusual' means" |
| R9 | Management change: incoming person's bio plus network overlap | "Pull a short background/bio of the incoming person … whether anyone in my network has worked with them, studied with them, or sits one connection away" |
| R10 | Results: Revenue, EBITDA, PBT, PAT, QoQ and YoY | "a first cut of the headline numbers — Revenue, EBITDA, PBT and PAT — this quarter vs. last quarter (QoQ) and vs. the same quarter a year ago (YoY)" |
| R11 | Material event: best-placed contact and why | "point me to the person in my network best placed to give me context, and why" |
| R12 | Pull grounded in primary sources only | see Gate 6 |
| R13 | Push enrichment and network insights may use outside info | "Push-side enrichment like a person's professional background, and Network insights about people, are a different thing and completely fine." |
| R14 | Any model or provider | "No restriction on models. Use anything" |
| R15 | Free tiers are enough | "comfortably doable on free tiers — you do not need to spend to compete" |
| R16 | Writeup must cover the four architecture topics; a diagram is welcome | "Data pipelines … Data security & privacy … Use of LLMs and AI agents … Cloud services … A simple diagram is welcome." |
| R17 | Delivery format | "a deployed link, Expo/TestFlight, or responsive web; however you ship it, make it easy for us to try on a phone" |
| R18 | Writeup lives in the covering email | "A short writeup (in your covering email)" |

**Not stated:** resubmission rules, length limits, a forbidden-files list, or whether git history is read. They *do* read AI session history, so assume git history gets read too.

### 1.5 Ambiguities and contradictions

| # | Issue | My pick | Email them? |
|---|---|---|---|
| A1 | Deadline has no time or timezone | Treat it as **15 Nov 18:00 IST** and target **14 Nov night** | **Yes**, a one-line question. It also gets your name in front of them early. |
| A2 | "Tell me the moment something crosses a threshold" vs. **EOD** price data | Announcement alerts poll about every 15 min. Price/volume alerts fire once a day after close. State that plainly in the UI ("checked at 16:00 IST close"). | No |
| A3 | "NSE/BSE-listed" vs. "any **NSE** ticker" | Key on NSE symbol. BSE scrip code appears only where screener links to BSE PDFs. BSE's API blocks us (§2). | No |
| A4 | "Pull a bio (e.g. from LinkedIn)" vs. "Respect each platform's terms" | **Use the bio printed in the exchange filing** (verified, §2.3). It's primary, legal and structured. Synthetic profiles for the investor's own network. | No |
| A5 | "Don't lean on the model's own knowledge" also covers the *business snapshot* | Every Pull claim must cite a document and page. Uncited sentences get dropped. Test with an automated citation checker (§4.2). | No |
| A6 | "Push" on mobile web: real notifications or an in-app feed? | In-app inbox plus optional Web Push. iOS needs the PWA added to the home screen **[memory — verify]**. Don't make the demo depend on it. | No |
| A7 | Reviewers may open the app days later, or on a weekend when the 24h window is empty | Keep the scheduled ingest running through the review period. The window picker defaults to "since last market day" when 24h is empty. | No |
| A8 | Public repo vs. the company's PDFs | Don't commit the brief PDFs. Reference them only. | No |
| A9 | "Release date 8 Nov" but we started 9 Nov | No action | No |

### 1.6 What the "hidden test" probably is

There's no automated grader. The reviewers are people, and they will most likely:

| Likely check | How we prepare |
|---|---|
| Open the link on a phone, possibly iOS Safari, possibly days later | Test on a real iPhone and Android device. Avoid cold starts on the critical path. Keep ingest alive until at least 30 Nov. |
| **Type a ticker we didn't pick** into Pull, maybe a small cap, a bank, or a recent IPO with few transcripts | Hold-out set of 10 tickers we never tune on, including a bank, a small cap, a fresh IPO and a demerged name. Graceful "not enough data" states. Measure success rate. |
| Look at a management-change card and a results card | Have ≥1 real example of each in the demo window, with a replay fallback (`?asof=` date) if the live window is quiet |
| Read the AI build history | Keep sessions focused and exportable. Show course-corrections, not just accepted output. |
| Read the repo: structure, README, secrets, tests | `.env` stays gitignored, `.env.example` is committed, the eval scripts are runnable, and the decision log becomes the design doc |
| Probe privacy | Network data stays isolated per user (row-level security), no network PII is sent to providers that train on it, and a retention and consent story is in place |
| Judge cost claims | Every cost number in the writeup comes from logged `usage` |

---

## Phase 2 — The data and tools

No sample inputs, expected outputs or validator were supplied, so I probed the live sources instead. All probes ran 10 Nov 2026 from a residential IP.

### 2.1 Probe results

| Source | Endpoint tried | Result | Implication |
|---|---|---|---|
| EOD prices | `yfinance 1.8.0` → `INFY.NS`, `RELIANCE.NS` | ✅ 21 days of OHLCV | Works. Raw `query1.finance.yahoo.com` returned **429** to curl, so use the library, not raw HTTP. |
| EOD prices | `TATAMOTORS.NS` | ❌ failed (`database is locked`, a yfinance cache issue). The ticker may also be gone after the Tata Motors demerger **[memory — verify]** | Validate every portfolio ticker. Disable yfinance's sqlite cache or download serially. |
| NSE announcements | `nseindia.com/api/corporate-announcements?symbol=…&from_date=&to_date=` | ✅ JSON. **No cookie needed** even though the home page returned 403. | Main Push feed |
| NSE announcements, market-wide | same endpoint, no symbol | ✅ 426 filings in one day, **5,756 in one week** | Volume is big enough that filtering matters |
| NSE `desc` field | INFY, 30 days | **11 of 16 were just "Updates"**. The market-wide top labels are vague ("Outcome of Board Meeting" ×889, "General Updates" ×475). | `desc` can't serve as the category. Classify from `attchmntText` plus a rules prior, with a cheap LLM only where rules are unsure. |
| NSE results API | `corporates-financial-results` | ⚠️ 144 records, but the newest is **Dec 2024**. Date filters return 0. | Stale. Don't rely on it. |
| NSE results XBRL | an `xbrl` link from that API | ✅ parses: `RevenueFromOperations`, `ProfitBeforeTax`, `ProfitLossForPeriod`, `FinanceCosts`, `DepreciationDepletionAndAmortisationExpense` | EBITDA ≈ PBT + finance costs + D&A, computed in code with no LLM. Needs a fresh XBRL source; announcement records carry `hasXbrl: true`, so the link still has to be found. |
| NSE results-comparison | `results-comparision?symbol=` | ⚠️ newest record Jan 2025 | Stale too |
| screener.in | `/company/INFY/consolidated/` | ✅ 200, 274 KB HTML. Quarterly table **current to Sep 2026** (Sales, Operating Profit, Interest, Depreciation, PBT, Net Profit). Concall section has **Transcript / PPT / REC** links per quarter. Annual-report links are present. | Primary source for Pull and the QoQ/YoY baseline. Fetch once and cache. Rate-limit politely. |
| Transcript PDFs | `bseindia.com/stockinfo/AnnPdfOpen.aspx?Pname=…` | ✅ after following a **302** (`curl -L`), 3.2 MB PDF | Must follow redirects |
| BSE API | `api.bseindia.com/…AnnSubCategoryGetData` | ❌ Akamai "Access Denied" | Skip BSE as a feed |
| NSE attachment PDFs | `nsearchives.nseindia.com/corporate/…pdf` | ✅ 200 | Full filing text is available |
| **Mgmt-change filing** | Suprajit "Appointment" PDF | ✅ includes a **"Brief profile"**: education (TU Darmstadt, RWTH Aachen), 30 yrs at Bosch, MD of Bosch Ltd 2013–16 | The bio comes straight from the primary filing: structured employers, schools and years to match against the network. One sample filing had a **blank name** ("Appointment of   as Chairman…"), an edge case. |
| Claude API key | `env` | Not set. `ant auth status` not checked yet. | Need a key or decision (§Questions) |

### 2.2 The hard parts this reveals

1. **Classification is the real Push problem.** Exchange labels are coarse and noisy, so prioritisation quality depends on our classifier. That makes it measurable and makes a good writeup story.
2. **Fresh results numbers.** For a results card on the day of filing, the screener table may lag by hours or days, and NSE's results APIs are stale. Options: (a) find the XBRL link on the fresh filing, (b) LLM-extract from the results PDF and cross-check against screener once it updates. Plan: (b) with (a) if found, and the cross-check doubles as an accuracy eval.
3. **Results PDFs vary a lot**: scanned pages, standalone vs. consolidated, ₹ lakh vs. crore. Unit normalisation is a known trap.
4. **Name matching**: honorifics ("Mr", "Dr."), initials, missing names.

### 2.3 Models, prices, limits (from the Claude API skill, cached 2026-10-06)

| Model | ID | $/MTok in / out | Notes |
|---|---|---|---|
| Haiku 5.5 | `claude-haiku-5-5` | **0.10 / 0.50** (≤100K prompt; 0.50/2.50 above) | Classification, extraction, bio parsing |
| Sonnet 5.5 | `claude-sonnet-5-5` | 2.00 / 10.00, cache read 0.20 | Narrative-vs-numbers reasoning, bull/bear |
| Opus 5.5 | `claude-opus-5-5` | 4.00 / 20.00 | Probably unnecessary. Use only if evals show Sonnet falling short. |

All three have 1M context. Batch API gives **50% off** for nightly backfills. No test call yet because there's no key; I'll make one when you provide it and report the cost.

---

## Phase 3 — Approach options

| Part | Options | Recommendation | What would change my mind |
|---|---|---|---|
| **Client** | (a) Next.js responsive PWA, (b) Expo/React Native, (c) SvelteKit | **(a) Next.js PWA.** One link works on any phone with no TestFlight review. Web Push is possible. Largest ecosystem for the UI. | If you want native gestures or haptics as the "point of view", (b) via Expo Go link |
| **Backend lang** | (a) Python for ingest and analysis, TS UI, (b) all-TS | **(a)**: yfinance, PyMuPDF and rapidfuzz are Python. Raw Yahoo HTTP 429s (§2.1). | — |
| **Hosting** | (a) Vercel (Next + Python functions) + Supabase + GitHub Actions cron, (b) Fly.io/Render FastAPI, (c) everything on one VM | **(a)**, all free tier. Render's free tier has cold starts **[memory — verify]**. | **If NSE or screener block cloud IPs** (a known NSE behaviour **[memory — verify]**, the top risk): run ingest from the laptop on a schedule and write to Supabase, then say so honestly in the writeup |
| **Database** | (a) Supabase Postgres, (b) SQLite in the repo, (c) Neon | **(a)**: Postgres + **row-level security** gives the "network stays private to the investor" story for real, plus auth. | — |
| **Classification** | (a) rules only, (b) LLM for every filing, (c) rules prior + Haiku when unsure | **(c)**. Decide with the eval in §4.2 comparing all three on accuracy, material-recall and cost. | Rules ≥95% material-recall would mean no LLM at all, which is a great efficiency story |
| **Pull retrieval** | (a) RAG with embeddings + vector DB, (b) map-reduce: Haiku extracts structured JSON per document (guidance statements, KPIs, quotes with page numbers), cached; Sonnet reasons over the JSON, (c) stuff all PDFs into Sonnet's 1M context | **(b)**: cheap, cacheable, and gives page-level citations. About $0.03–0.06 per company (estimate, to be measured). | (c) if (b) misses context in the eval. It costs about 10× more but is simpler. |
| **Results numbers** | (a) XBRL parse, (b) LLM from PDF, (c) screener table | (a) when available, otherwise (b), validated against (c) | — |
| **Network store** | (a) Postgres tables (people, affiliations with dates, edges with strength and last-contact) + SQL for 2-hop, (b) Neo4j | **(a)**: a demo-scale graph is a few hundred nodes, and it's one fewer service | — |
| **Matching** | (a) LLM judges match, (b) deterministic normalise + rapidfuzz + employer/school/tenure overlap scoring | **(b)** with a confidence score shown to the user. The LLM only extracts structured bios from filings. | — |
| **Profiles** | real LinkedIn, public dataset, synthetic | **Synthetic network** (about 60–100 people), hand-built to overlap the portfolio. **Incoming executives come from real filing bios.** | — |

### Interaction model (a proposal; your product call)

Proposed point of view: **"FINN speaks first, and only when it should."**
- **Brief**: the home screen is a short stack of 3–7 cards ranked by materiality, with "N routine filings folded" at the bottom. Each card's verdict fits in one line.
- **Every card ends with a person.** A "who to call" chip names the contact, how strong the link is, and *why* ("worked under the new CFO at Bosch, 2014–16"). This puts the Network inside Push.
- **Ask**: Pull is a ticker or question box that returns a research view built from sections, each claim tappable to its source page. The Network appears as "people who'd know" on the company.
- **Network questions** ("who knows rural lending?") go through the same Ask box, with no separate app.

Alternatives worth a look: a voice-first morning brief, or a network-map-first home screen. I'd keep both out of scope.

### Riskiest assumptions and cheap tests (do these on Day 1)

1. **NSE and screener reachable from Vercel/GitHub Actions IPs.** Deploy a 10-line function that fetches both, and run it once.
2. **Rules + Haiku classify material filings well.** Hand-label 100 filings and measure. About 1 hour.
3. **Results PDF → four numbers is reliable.** Try 5 recent results PDFs and compare against screener.
4. **Screener has ≥4 transcripts for typical tickers.** Count them across the 10 hold-out tickers.
5. **Free-tier hosting survives the review period.** Check Supabase's free-tier inactivity pause policy **[memory — verify: projects pause after ~1 week idle]**.

---

## Phase 4 — The plan

### 4.1 Architecture

```
                 ┌──────────── scheduled ingest (GH Actions cron / laptop fallback) ───────────┐
 NSE announcements ─┐                                                                          │
 yfinance EOD ──────┼─► Python workers ─► classify (rules → Haiku if unsure) ─► Supabase Postgres
 screener + BSE PDFs┘        │            extract (Haiku: results nos., bios, guidance)     │  RLS per user
                             └─ PDF cache (storage)                                          │
                                                                                             ▼
 Synthetic network (per-user, RLS) ──► matcher (rapidfuzz + overlap scoring) ──► "who to call" edges
                                                                                             │
 Next.js PWA (Vercel) ◄── API routes ◄──────────────────────────────────────────────────────┘
   Brief (Push) · Ask (Pull + Network) · Alerts settings          Pull on unseen ticker → async job:
                                                                   fetch → Haiku map → Sonnet reduce → cache
```

| Scoring pillar | Where it shows up |
|---|---|
| Product sense, creativity | Interaction model, the person on every card, routine filings folded |
| Judgment | Materiality ranking, what gets a one-liner vs. just a link, what we left out |
| Architecture | RLS privacy, deterministic numbers, model routing, caching, async jobs |
| Efficiency bonus | Logged cost per brief and per research run |

### 4.2 Evaluation first

Every claim in the writeup comes from one of these.

| What | Method | Metric |
|---|---|---|
| Classifier | Hand-label ~150 real filings from the portfolio (Oct–Nov 2026) with category and material yes/no. **Hold out 50 from companies we don't tune on.** Compare rules vs. rules+Haiku vs. Sonnet. | Accuracy, **material recall** (missing a material filing is the costly error), cost per 1k filings |
| Results numbers | 20 company-quarters: extracted values vs. the screener table | % within ±1%, unit errors caught |
| Bio extraction + matching | 20 real appointment filings + seeded synthetic overlaps (including decoys: same name, different person) | Precision and recall of "knows them" |
| Pull grounding | Automated check that every cited quote exists on the cited page | Citation validity %; uncited claims = 0 |
| Generalisation | 10 hold-out tickers, never used during tuning | End-to-end success rate, latency, $ per run |
| Alerts | Unit tests with fixture EOD series | Pass/fail |
| Mobile | Lighthouse mobile + a real iPhone and Android device | Score, a checklist |
| Cost | Log `usage` on every call | $/day of operation, $/research |

### 4.3 Milestones

Estimates assume about 8 focused hours a day. Tell me your real hours.

| Day | Work | Exit criterion |
|---|---|---|
| **Tue 10 Nov** | Approve plan. Repo + Supabase + Vercel skeleton deployed. **Cloud-IP probe (risk #1).** Choose portfolio + research set. Draft synthetic network schema. | Hello-world link opens on a phone. Probe result logged. |
| **Wed 11** | Ingest: EOD, announcements, screener docs → DB. Label 150 filings. Classifier + eval. | Classifier eval numbers in the decision log |
| **Thu 12** | Push: Brief with window picker, routine folding, alerts settings. Mgmt-change card (filing bio + network match) and results card. Synthetic network loaded. | **Gate-passing build exists**: Push + Network in Push + a minimal Pull (financial snapshot for any ticker) |
| **Fri 13** | Pull: promised vs. delivered with citations, async jobs for unseen tickers, hold-out eval | Hold-out success-rate measured |
| **Sat 14** | Network depth (2nd degree, expertise map, reconnect nudges) and design polish. **FEATURE FREEZE 18:00 IST.** | Nothing new after this |
| **Sun 15** | Writeup + diagram, README, AI history export, phone testing, submit **by midday IST** | Email sent |

**Cut first if behind:** the expertise map, Web Push, and bull/bear. **Never cut:** a working link, all three layers, the mgmt-change and results cards, and promised vs. delivered.

### 4.4 Budget (Claude API)

All figures are estimates to be replaced by logged numbers.

| Bucket | Estimate | Cap |
|---|---|---|
| Development (iterating prompts) | ~$3 | $8 |
| Evaluation runs (classifier ×3 variants, 10 hold-out tickers, results) | ~$2 | $5 |
| Live operation through review (~20 days of ingest + reviewer research runs) | ~$1 | $3 |
| Reserve | — | $4 |
| **Total** | **~$6** | **$20** |

Hosting stays on free tiers at $0.

### 4.5 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| NSE/screener block cloud IPs | Medium–High | High | Test Day 1. Fallback: laptop-scheduled ingest + cached DB; Pull for unseen tickers via a queued job processed by the laptop worker, documented honestly |
| Screener rate-limits or changes HTML | Medium | High | Cache every fetch. Polite delays. Parser tests on saved HTML. |
| Demo window empty when reviewers open it | High | Medium | Keep ingest running. "Since last market day" default. Replay `?asof=` for curated examples. |
| Results PDF unit or consolidation errors | Medium | Medium | Prefer XBRL. Cross-check against screener. Show the source link on every number. |
| Scope creep on Network features | High | Medium | Freeze Saturday 18:00. Cut list in 4.3. |
| Free-tier pause or expiry during review | Medium | High | Check policies Day 1. Keep-alive cron. |
| Leaking secrets or the PDFs to the public repo | Low | High | `.gitignore` from the first commit. Pre-commit secret scan. |
| LLM invents company facts in Pull | Medium | High | Cite-or-drop rule plus the automated citation check |

### 4.6 Submission checklist

- [ ] Deployed link opens and works on iPhone Safari **and** Android Chrome (Gates 1–2)
- [ ] Push: digest with window picker, configurable alerts (R7, R8)
- [ ] Mgmt-change card with bio + network overlap (R9); results card with 4 numbers QoQ/YoY (R10); material event → best contact + why (R11)
- [ ] Pull works on a ticker outside the demo set, checked live the day of submission (Gate 5)
- [ ] Every Pull claim cited to AR/transcript; no outside sources (Gate 6)
- [ ] Network appears inside Push **and** Pull (Gate 4)
- [ ] Repo public; no secrets; no company PDFs; `.env.example` present; README with run steps (Gate 7)
- [ ] AI build history exported or linked (Gate 8)
- [ ] Writeup covers all of R16 + what was left out + next steps + profile source disclosure (Gates 9–10)
- [ ] Every number in the writeup traced to an eval or log
- [ ] Ingest still running; keep-alive set until at least 30 Nov
- [ ] Email to `assessment@enam.com`, subject `IIT Kanpur – Founding AI Engineer - 2027`, before the deadline (Gates 11–12)

---

## Questions to answer before building

1. **Hours:** how many can you put in each day, Nov 10–15?
2. **LLM access:** do you have an Anthropic API key (or `ant auth login`), and what's the spend limit? Any other provider you'd rather use?
3. **Accounts:** OK to use your GitHub, Vercel and Supabase (free tier)? Where should the repo live? I'd suggest a clean folder like `~/finn`, because this folder name ends in a space, which breaks some tools.
4. **Interaction model:** does "FINN speaks first, every card ends with a person" match your taste, or do you want to explore voice, a map, or something else?
5. **Portfolio:** any sectors or companies you know well? You'll be explaining the demo in an interview, so knowing the companies helps.
6. **Email A1:** should I draft the one-line deadline-clarification email for you to send?
