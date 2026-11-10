# Promises ledger: hand-labelled gold set (BEL, DEEPAKNTR; 4 calls each)

Prepared 2026-11-10 as dev-time research for the FINN "Promises ledger". This is an answer key for grading an LLM extractor and status scorer. It is not application code.

- Gold items: **84** forward-looking, checkable management statements (BEL 55, DEEPAKNTR 29). They group into **44 distinct promise threads** (BEL 27, DEEPAKNTR 17).
- Every primary quote and every supporting or evidence quote (158 in total) was checked by `verify_quotes.py` against the PyMuPDF text of its cited page, after whitespace normalisation. **First pass: 154/158 (97.5%); primary quotes 83/84.** The failures were 3 evidence quotes that cited the printed page number instead of the PDF page index, and 1 primary quote broken by a hyphen at a line break ("high-\npressure"). All four were fixed. **Final: 158/158.** Every quote occurs on exactly one page, the cited one.
- Page numbers are **1-indexed PDF pages**. Each PDF has an exchange cover letter as page 1, so PDF page = printed "Page N of M" + 1.
- Actuals come from two places. Screener figures are from the saved standalone pages (`sc_BEL.html`, `sc_DEEPAKNTR.html`; quarterly table `id="quarters"`, annual P&L). Figures marked as transcript-reported come from a later call. **The screener pages are the STANDALONE view.** For BEL this matches the numbers management quotes (27,480; 5,533; 12,824). For DEEPAKNTR it does not: standalone is about ₹800 cr per quarter, while management speaks in consolidated terms (about ₹3,091 cr per quarter, including Deepak Phenolics and Deepak Chem Tech) and in segments.
- Files: `ledger_gold.json` (machine-readable), `quote_check.json` (per-quote verification), `items/*.py` (the labels: source of truth), `build.py`, `verify_quotes.py`, `extract.py`, `text/*.txt` and `text/*.pages.json` (per-page text), `pdf/*.pdf`, `download_log.txt`.

## 1. Source documents

| Company | Call | Date held | BSE PDF (AttachHis uuid) | Pages | Chars | Words | Text layer |
|---|---|---|---|---|---|---|---|
| BEL | Q3FY26 | 2026-01-28 | bb8b13a8-bf5d-410c-ac76-7a0f41a3cbdc | 24 | 64,125 | 11,128 | Every page is a full-page scan with an OCR layer. Body OCR is clean. The Hindi cover letter is garbled, and logo-OCR junk ("BATABArFLFCABOAT/CS") appears on every page. |
| BEL | Q4FY26 | 2026-05-20 | f32d2ed7-e599-42b4-ab37-d8e5e79ae0ca | 21 | 60,258 | 10,178 | Scan + OCR, as above (junk "37Rc7goJcrc/fG-fcf'^l"). "INR27,480" has no space. |
| BEL | Q1FY27 | 2026-07-27 | d2a747a3-664c-4c5d-9373-fcddc0d2a3ae | 21 | 60,414 | 10,281 | Scan + OCR, as above. |
| BEL | Q2FY27 | 2026-11-03 | ae1ae7ce-d870-47a4-900c-c087a6e84e65 | 33 | 62,396 | 10,660 | Cover page scanned. Body is born-digital in a narrow column, with some one-word-per-line runs (p3). |
| DEEPAKNTR | Q3FY26 | 2026-02-13 | 5fe2e422-45bb-44a8-a6e2-c9677c942a8d | 21 | 68,108 | 11,129 | Born-digital (MS Word). Clean. |
| DEEPAKNTR | Q4FY26 | 2026-05-18 | 589629dc-be30-42d5-8ed4-bb605071a9bc | 15 | 44,326 | 7,193 | Born-digital. Clean. |
| DEEPAKNTR | Q1FY27 | 2026-08-06 | 830edde9-d00b-4243-98bd-a0e7c77d716b | 21 | 67,526 | 10,938 | Born-digital. Clean. |
| DEEPAKNTR | Q2FY27 | 2026-10-30 | 5dfbdab4-d040-4a99-b694-bbe26f015f14 | 21 | 65,671 | 10,732 | Born-digital. Clean. |

**Downloads:** 8 of 8 returned HTTP 200 through one redirect to `bseindia.com/xml-data/corpfiling/AttachHis/<uuid>.pdf`. None were blocked or retried. Requests were spaced 6 s apart (`download_log.txt`). No page had less than 50 characters of text.

## 2. Ledger tables

Glyphs: ● delivered · ◐ partly · ○ missed · — went silent · ↻ revised · · too early / pending · ⚠ conflicting statements. Each cell gives the status of that thread **as assessed at that call**, followed by what was said. "new:" marks the call where the promise first appears in this 4-call window.

### BEL: 27 threads

| # | Promise thread (items) | Q3FY26 (28 Jan 26) | Q4FY26 (20 May 26) | Q1FY27 (27 Jul 26) | Q2FY27 (3 Nov 26) |
|---|---|---|---|---|---|
| T1 | FY26 revenue growth ≥15% (01) | · reiterated (9M +19%) | ● +16.2% (27,480 vs 23,658) | n/a (closed) | n/a |
| T2 | FY26 EBITDA margin ≥27% (02) | · reiterated, upgrade refused (9M 29.2%) | ● 29.2% screener OPM / 30% mgmt | n/a | n/a |
| T3 | FY26 order inflow ≥₹27,000 cr ex-QRSAM (03) | · (19,300 to date) | ● ₹30,045 cr (transcript only) | n/a | n/a |
| T4 | FY26 capex ₹1,000 cr (16) | · | ◐ "I think" ₹900 cr | n/a | n/a |
| T5 | R&D: FY26 ≥₹1,700 cr (raised from 1,600); FY27 >₹2,000 cr (15) | ↻ up | ↻ FY27 → ₹2,200 cr; FY26 actual never stated | · | · |
| T6 | FY27 revenue growth >15% (08,18,35,46) | · new: >15% p.a. "for years to come" | · new: FY27 >15% | · (Q1 +25.3%) | · (H1 +26.0%; H2 needs only +8.6%) |
| T7 | FY27 EBITDA margin >28% (19,34,36,47) | — FY27 guidance deferred to April | · new: >28% | · reiterated (Q1 25.1%) ⚠ closing remark says "21% to 23%" | · "around 28%" (H1 26.7%; H2 needs 28.9%) |
| T8 | FY27 order inflow >₹55,000 cr incl. QRSAM / ≥₹25,000 ex (07,20,33,48) | · new: >25,000 ex-QRSAM (pipeline) | · new: >55,000 incl. QRSAM | · (Q1 ₹3,754 cr) ⚠ closing remark says ">20,000" | · (H1 ₹7,334 cr = 13%) ⚠ closing remark says "50,000-plus" |
| T9 | FY27 R&D ~₹2,200 cr (21,45,55) | (see T5) | · new | · | · |
| T10 | FY27 capex >₹1,200 cr (22,45,55) | | · new | · | · softened to "around 1,200" |
| T11 | Non-defence share / 90:10 mix (13,23,28) | · new: >10% "near future"; 15%+ long term | ↻ now 8-10%; long-term target 15-20%; FY27 90:10 ±1 | · | · |
| T12 | Export share of revenue (12,29,43) | · new: 5% near term, 10% long term | ↻ >10% in 4-5 years; +1-2pp in 12-18 months | · 10% in 5 years | — |
| T13 | FY27 export order intake ~USD 300 mn (42) | | | · new ("internal guidance") | — |
| T14 | QRSAM order date (~₹30,000 cr) (06,24,37,50) | · new: by Q4FY26, ">90% confident" | ○ → ↻ by June-end | ○ → ↻ "maximum by September" | ○ → ↻ "very soon", ">99%" (undated) |
| T15 | QRSAM first production model ≤18 months after signing (25,54) | | · new | | · "delay will not translate into execution" |
| T16 | NGC orders (04,05,26,39,49) | · new: ₹2-3k cr by Mar-26; ₹10-12k cr in H1FY27 | ○ FY26 tranche → ↻ "≥50% of subsystems this year" | · ≥1 of NGC/P-75I "100% probability" | ○ H1 tranche → ↻ ~₹20,000 cr, all before Mar-27 |
| T17 | Shatrughat/Samaghat (+HAMMER, Shakti Ph-4) orders (10,38,51) | · new: Shatrughat by Q4FY26; both by H1FY27 | · "very, very soon" | ↻ in FY27 (₹9k+ / 2k / 2.5k) | ○ H1FY27 date missed → ↻ "before March" |
| T18 | LCA LRU order from HAL in Q4FY26 (11) | · new (~₹2,400 cr) | ● inferred (order book now shows LCA ₹3,200 cr) | n/a | n/a |
| T19 | P-75I submarine electronics order (27,52) | | · new: "some order" in FY27 | · | ↻ "may slip to next year" |
| T20 | Akash-NG order, Q4FY27 or FY28 (09) | · new | — | — | — |
| T21 | Kusha order, FY28-29 (32,40) | · new | — | · + size ₹40,000 cr+ | — |
| T22 | Virupaksha radar production order, FY28-29 (53) | | | | · new |
| T23 | Data-centre business ≥₹1,000 cr from FY27 (14) | · new | ↻ reframed ₹1-5k / ₹2-10k cr, undated | — | — |
| T24 | Employee cost as % of turnover (17,41) | · new: ~14% | | ⚠ CFO: ~12% ("12% last year") | — |
| T25 | Receivable days 140-150 (31) | | · new | ◐ 140 at Jun-26 (176 at Mar-26) | — |
| T26 | Indigenous content 80-85% over the next 2-3 years (30) | | · new | · (78-80% of turnover) | — |
| T27 | No imports of modules within 5 years (44) | | | · new | |

Thread-level final status, BEL (27): ● 4 · ◐ 2 · ○ 3 · ↻ 4 · — 3 · ⚠ 1 · · 10.
**Pattern:** every FY26 *financial* target was met. Revenue, margin and order inflow beat their floors, and capex came in at 90%. **Every dated large-order timing promise slipped** (QRSAM ×3, NGC ×2, Shatrughat ×2). The only dated order delivered is the LCA order, and that is inferred.

### DEEPAKNTR: 17 threads

| # | Promise thread (items) | Q3FY26 (13 Feb 26) | Q4FY26 (18 May 26) | Q1FY27 (6 Aug 26) | Q2FY27 (30 Oct 26) |
|---|---|---|---|---|---|
| D1 | Q4FY26 better than Q3FY26 (01) | · new | ● cons. EBITDA 219→383 (11%→18%); standalone OPM 6.5%→10.2% | n/a | n/a |
| D2 | Q1FY27 better than Q4FY26 (AI segment, then whole company) (02,09) | · new (AI) | · broadened to standalone + consolidated | ● cons. 2,127→2,592 rev, 383→554 EBITDA; AI EBIT 34→67; standalone OP 73→110 | n/a |
| D3 | MIBK/MIBC commissioning (03,10,16) | · new: this quarter (Q4FY26) | ○ → ↻ Q2FY27 | · "August itself" | ● commissioned, ~60% utilisation (Q4FY26 date missed by ~2 qtrs) |
| D4 | Nitric acid / nitration / hydrogenation at ~100% from Q4FY26 (04) | · new | ○ nitric acid ~45% | · stabilised | ◐ >100% only from Sep-26 |
| D5 | Photochlorination / fluorination ramp-up in Q1FY27 (05) | · new | — | — | ◐ chlorination commissioned end-Q2 |
| D6 | High-pressure alkylation plant, Jun-Jul 2026 (06,16) | · new | — | ↻ "within Q2" (was slated earlier) | — not named |
| D7 | Polycarbonate onstream (07,13,19,28) | · Dec-2027 ±2 months | ↻ "June 2028", framed as "in line" | ↻ H2 FY29 | · resin FY29 / ↻ integrated chain FY30; full utilisation FY31 |
| D8 | FY27 capex (08,21,29) | · new: ₹2,500 cr | — | ↻ "₹1,000-1,500" / "₹1,500-1,600" further (project) | ↻ ~₹700 cr H1 + ₹800-900 cr H2 |
| D9 | Project cost & 60:40 debt funding (15,20,29) | | · new: ₹11,000 cr, 60:40 | ● debt fully tied up; ↻ cost ₹11,500 cr | ↻ cost ₹11,700 cr |
| D10 | New products: regular commercial production (11,17) | | · new: from Q3FY27 | ↻ from January 2027 | · trial volumes shipping |
| D11 | FY27 margins better than FY26, incl. standalone (12) | | · new | · Q1 standalone OPM 13.6% | · H1 standalone 11.7% vs FY26 8.5% |
| D12 | Nitric acid EBITDA uplift ₹90-100 cr (number from analyst) (14) | | · new (management endorsed) | — | — not disclosed |
| D13 | Phenol 400 KTPA via ~₹70 cr debottleneck (18) | | | · new | ◐ "close enough", "not significantly less" |
| D14 | Peak debt ₹8,000-8,500 cr; D/E <1 (22) | | | · new | · net D/E 0.25x |
| D15 | AI EBIT path: Q3 margin between Q1 and Q2; FY27 ~₹240 cr; FY28 ₹400-420 cr / 14-15% (23,24,25) | | | | · new |
| D16 | Phenolics record annual EBIT in FY27 (>₹867 cr) (26) | | | | ● locked in (H1 ₹933 cr) |
| D17 | MIBK/MIBC at optimal utilisation in FY28 (27) | | | | · new |

Thread-level final status, DEEPAKNTR (17): ● 4 · ◐ 3 · ○ 1 · ↻ 4 · · 5.
**Pattern:** near-term *directional* P&L calls were delivered (Q4 > Q3, Q1 > Q4). **Commissioning dates slip 1-2 quarters each time.** The polycarbonate date slipped three times in three calls, always described as "in line" or "on track". FY27 capex was cut about 40% without being called a cut, and the project cost crept up 6%.

## 3. Item-level summary

| | Q3FY26 | Q4FY26 | Q1FY27 | Q2FY27 | Total | of which new | reiterated / restated |
|---|---|---|---|---|---|---|---|
| BEL items | 18 | 14 | 13 | 10 | 55 | 27 threads | 28 |
| DEEPAKNTR items | 8 | 7 | 7 | 7 | 29 | 17 threads | 12 |

Where the actual can be checked (item level, 84):
- **Filings** (screener results table or reported financials): BEL 9, DN 9, together **18 (21%)**.
- **Later transcript only** (management self-report: order inflow, order dates, commissioning, utilisation): BEL 21, DN 16, together **37 (44%)**.
- **Not checkable with the sources in hand** (R&D, capex, mix, exports, employee cost, undated items): BEL 24, DN 4, together **28 (33%)**.
- **Not guidance** (conflict flag): 1.

For BEL, the headline order-inflow guidance is **not in the results filing**. It can only be checked from the transcript, or from BSE order-win announcements, which were not fetched here.

Item-level status (84): ● 10 · ◐ 6 · ○ 7 · ↻ 12 · — 2 · ⚠ 2 · · 45. "Too early" dominates because about 40% of items restate an open FY27 promise.


## 4. Detailed per-item records

Each record includes the verbatim quote (verified on the cited PDF page), structured fields, relation, status, evidence and arithmetic. All values are also in `ledger_gold.json`.

### BEL — detailed records

#### BEL-01 · Q3FY26 (2026-01-28) · Revenue growth YoY
- **Quote** (p24, Manoj Jain (CMD)): "revenue growth more than 15%, EBITDA margin definitely more than 27%, order inflow INR 27,000 crores plus"
  - also p4: "whatever guidance we gave at the start of the year, we are maintaining that and we are confident that we will achieve or exceed this guidance"
  - also p8: "See, overall guidance for the current year has been given at 15%."
- scope: company (standalone) · period: FY26 · type: point (floor) · value: 15 – — % YoY
- conditionality: — · basis: standalone revenue from operations
- relation: reiterated (originally given at start of FY26, May 2025 call — before window)
- **status: ● delivered** · checkable from: filings
- evidence: FY26 revenue 27,480 vs FY25 23,658 (screener annual P&L; quarterly Jun25-Mar26 4,417+5,764+7,122+10,177=27,480). Q4FY26 call p3: 'growth of 16%'.
- arithmetic: 27,480/23,658-1 = +16.2% >= 15%

#### BEL-02 · Q3FY26 (2026-01-28) · EBITDA margin
- **Quote** (p5, Damodar Bhattad (Director Finance & CFO)): "we maintain the EBITDA margin of 27% only for the current financial year"
  - also p8: "I can assure you it will not go below 27%, which we started our year with"
- scope: company · period: FY26 · type: point (floor) · value: 27 – — % of revenue
- conditionality: — · basis: standalone
- relation: reiterated (start-of-year guidance; analyst asked for upgrade, declined)
- **status: ● delivered** · checkable from: filings
- evidence: Screener FY26 OPM 29% (op. profit 8,018 / sales 27,480). Mgmt Q4FY26 p3 says EBITDA 30%.
- arithmetic: 8,018/27,480 = 29.2% >= 27% floor. Mgmt EBITDA runs ~0.7-0.8pp above screener OPM every period (definition gap).

#### BEL-03 · Q3FY26 (2026-01-28) · Order inflow
- **Quote** (p12, Manoj Jain (CMD)): "we are confident we will cross INR 27,000 crores without QRSAM, definitely"
  - also p18: "So, we are going to cross INR 27,000 crore that much I can confidently tell you."
- scope: company · period: FY26 · type: point (floor) · value: 27000 – — INR cr
- conditionality: excludes QRSAM · basis: order acquired during FY
- relation: reiterated
- **status: ● delivered** · checkable from: later transcript only
- evidence: Q4FY26 p3: 'order acquired till 31st March 2026 ... INR30,045 crores'. Order inflow is NOT in the results table/screener.
- arithmetic: 30,045 >= 27,000 (+11%). Ex-QRSAM condition satisfied trivially (QRSAM not received).

#### BEL-04 · Q3FY26 (2026-01-28) · NGC (Next Generation Corvette) order — FY26 tranche
- **Quote** (p5, Manoj Jain (CMD)): "we are confident that before March, we will get INR 2,000 crores to INR 3,000 crores minimum this year"
  - also p4: "maybe around INR 3,000 to INR 5,000 crores deal we may get before March end"
- scope: order · period: Q4FY26 (by 31 Mar 2026) · type: range · value: 2000 – 3000 INR cr
- conditionality: — · basis: —
- relation: revised (Q2FY26 call flagged spill-over; earlier call said 3,000-5,000 in same call p4)
- **status: ○ missed** · checkable from: later transcript only
- evidence: No NGC order by Mar-26; Q4FY26 p9 still 'hoping'; Q2FY27 p6: shipyard contracts only just signed, BEL line-item POs 'may come even tomorrow'.
- arithmetic: 0 vs 2,000-3,000 by 31-Mar-26

#### BEL-05 · Q3FY26 (2026-01-28) · NGC order — remaining tranche
- **Quote** (p8, Manoj Jain (CMD)): "So, in H1 of next year we are hopeful to get remaining around INR 10,000 crores to INR 12,000 crore in next year."
- scope: order · period: H1FY27 · type: range · value: 10000 – 12000 INR cr
- conditionality: 'hopeful'; may spill to Q2 · basis: —
- relation: new
- **status: ○ missed** · checkable from: later transcript only
- evidence: H1FY27 total orders only 7,334 cr (Q2FY27 p4); NGC BEL orders not yet placed (Q2FY27 p6).
- arithmetic: NGC received in H1FY27 = 0 vs 10,000-12,000

#### BEL-06 · Q3FY26 (2026-01-28) · QRSAM order receipt
- **Quote** (p7, Manoj Jain (CMD)): "QRSAM itself we are hopeful that we may get by this year itself, by Q4 itself. Still we are more than 90% confident of getting that now itself."
  - also p7: "So, that will give me around INR 30,000 to INR"
- scope: order · period: Q4FY26 · type: milestone-date · value: 30000 – 32000 INR cr (order size)
- conditionality: 'few percent chance' of spill to Q1FY27 · basis: —
- relation: new (in window)
- **status: ○ missed** · checkable from: later transcript only
- evidence: QRSAM not received in Q4FY26 (Q4FY26 p6 re-dated to June-end). Still not received at 3-Nov-26.
- arithmetic: date missed; re-dated 3 times (Jun-26, Sep-26, 'very soon')

#### BEL-07 · Q3FY26 (2026-01-28) · Order inflow (pipeline ex-QRSAM)
- **Quote** (p7, Manoj Jain (CMD)): "definitely it will be more than INR 25,000 crores which we are seeing minimum other than QRSAM"
- scope: company · period: FY27 · type: point (floor) · value: 25000 – — INR cr
- conditionality: excludes QRSAM; framed as pipeline 'seeing' · basis: —
- relation: new
- **status: · too early** · checkable from: later transcript only
- evidence: Restated as FY27 ex-QRSAM floor 25,000 (Q2FY27 p9). H1FY27 orders 7,334 (all ex-QRSAM).
- arithmetic: 7,334/25,000 = 29% at 50% of year; NGC (~20,000) expected by Mar-27 would cover it

#### BEL-08 · Q3FY26 (2026-01-28) · Revenue growth YoY (multi-year)
- **Quote** (p7, Manoj Jain (CMD)): "So, we are confident that we will have steady growth of more than 15% in years to come."
- scope: company · period: next 3-4 years (FY27-FY29/30) · type: point (floor) · value: 15 – — % YoY
- conditionality: — · basis: —
- relation: reiterated (analyst: 'you have been highlighting at least 13%-15% growth')
- **status: · too early** · checkable from: filings
- evidence: FY26 +16.2% (screener); H1FY27 +26.0% (screener 12,824 vs 10,181).
- arithmetic: Year 1 of 3-4 met; FY27 on track

#### BEL-09 · Q3FY26 (2026-01-28) · Akash-NG order receipt
- **Quote** (p11, Manoj Jain (CMD)): "So, hoping may be Q4 of '26-'27, else it will be in '27-'28 only, we may get the order"
- scope: order · period: Q4FY27 or FY28 · type: milestone-date · value: 2500 – 3000 INR cr (order size)
- conditionality: AoN/RFP process · basis: —
- relation: new
- **status: — went silent** · checkable from: not checkable with sources in hand
- evidence: Not mentioned in Q4FY26, Q1FY27, Q2FY27 calls; target date Q4FY27/FY28 not yet reached.
- arithmetic: n/a

#### BEL-10 · Q3FY26 (2026-01-28) · Shatrughat & Samaghat EW orders
- **Quote** (p12, Manoj Jain (CMD)): "Shatrughat we may get order by Q4 of this year itself. Otherwise of course, both the programs definitely by H1 we are going to get"
- scope: order · period: Q4FY26 (Shatrughat) / H1FY27 (both) · type: milestone-date · value: 3000 – — INR cr (Shatrughat size, p12)
- conditionality: — · basis: —
- relation: new
- **status: ○ missed** · checkable from: later transcript only
- evidence: Neither order received by Q4FY26 nor H1FY27; Q1FY27 p11 '3 to 6 months', Q2FY27 p9 'before March'.
- arithmetic: both dates (Q4FY26, H1FY27) missed; size restated 3,000 -> 9,000+ for both

#### BEL-11 · Q3FY26 (2026-01-28) · LCA LRU order from HAL
- **Quote** (p12, Manoj Jain (CMD)): "Mainly LCA order from HAL we are expecting very soon, anytime because we have done conclusion of price also."
  - also p12: "LCA order also will be around INR 2,400 crores"
- scope: order · period: Q4FY26 · type: milestone-date · value: 2400 – — INR cr (size, p12)
- conditionality: — · basis: —
- relation: new
- **status: ● delivered (inferred)** · checkable from: later transcript only
- evidence: Not explicitly confirmed. Order-book list in Q3FY26 call (p17) has no LCA item; Q4FY26 list (p7) adds 'LCA around INR3,200 crores'. FY26 inflow beat guidance by ~3,000.
- arithmetic: Inference only — gold label should carry low confidence

#### BEL-12 · Q3FY26 (2026-01-28) · Export share of turnover
- **Quote** (p14, Manoj Jain (CMD)): "increase our export turnover from presently 3% to 4% to 5% in near future and overall 10% in a long-term"
- scope: segment (exports) · period: 'near future' / long term · type: point · value: 5 – 10 % of turnover
- conditionality: — · basis: —
- relation: new (aspirational)
- **status: ↻ revised** · checkable from: not checkable with sources in hand
- evidence: Q4FY26 p16: exports now '4% to 5%', >10% 'over a period of time ... 4 to 5 years'; +1-2pp in 12-18 months.
- arithmetic: 'near future' given a horizon only on revision; export share not in results table

#### BEL-13 · Q3FY26 (2026-01-28) · Non-defence share of turnover
- **Quote** (p15, Manoj Jain (CMD)): "we are confident that in near future we will try to cross 10% of our turnover through these non-defense leads"
  - also p15: "right now our non-defense is around 6%, 7% type of thing only"
- scope: segment (non-defence) · period: 'near future'; long-term 15%+ · type: point (floor) · value: 10 – — % of turnover
- conditionality: — · basis: —
- relation: reiterated (90:10 mix)
- **status: ↻ revised** · checkable from: not checkable with sources in hand
- evidence: Q4FY26 p16: non-defence now '8% to 10%'; long-term target raised to 15-20%. FY27 mix guided 90:10 +/-1.
- arithmetic: FY26 non-defence 8-10% vs >10% 'near future' (not yet met; segment split not in results table)

#### BEL-14 · Q3FY26 (2026-01-28) · Data-centre business revenue/orders
- **Quote** (p15, Manoj Jain (CMD)): "Our aim is minimum INR (+1,000) crore next year onwards from data center type of business."
- scope: segment (data centre) · period: FY27 onwards · type: point (floor) · value: 1000 – — INR cr
- conditionality: 'aim' · basis: unclear whether orders or revenue
- relation: new
- **status: ↻ revised then silent** · checkable from: not checkable with sources in hand
- evidence: Q4FY26 p10-11 reframed as 'INR2,000 crores to INR10,000 crores' / 'INR1,000 crores to INR5,000 crores' with no date; not mentioned in Q1/Q2FY27.
- arithmetic: orders vs revenue never specified

#### BEL-15 · Q3FY26 (2026-01-28) · R&D expenditure (revenue + capex)
- **Quote** (p21, Manoj Jain (CMD)): "This year, our target is crossing INR 1,700 plus crores and next year, it will be more than INR 2,000 crores."
  - also p24: "R&D investment although we told INR 1,600 crore, but I am confident we may cross INR 1,700"
- scope: company · period: FY26 / FY27 · type: point (floor) · value: 1700 – 2000 INR cr
- conditionality: — · basis: total R&D incl. capital
- relation: revised up (FY26 originally 1,600 per p24)
- **status: ↻ revised (FY27) / unverifiable (FY26)** · checkable from: not checkable with sources in hand
- evidence: FY27 raised to ~2,200 (Q4FY26 p21). FY26 R&D actual never stated in the 3 later calls; needs annual report.
- arithmetic: FY26 actual unknown

#### BEL-16 · Q3FY26 (2026-01-28) · Capex
- **Quote** (p24, Manoj Jain (CMD)): "CAPEX INR 1,000 crore and defense non-defense business of 90 to 10"
- scope: company · period: FY26 · type: point · value: 1000 – 1000 INR cr
- conditionality: — · basis: —
- relation: reiterated
- **status: ◐ partly** · checkable from: later transcript only
- evidence: Q4FY26 p11: 'last year, I think we had INR900 crores capital expenditure was booked' (hedged; same call claims all guidance met).
- arithmetic: 900/1,000 = 90%; ambiguous whether 'last year' = FY26 (context says yes)

#### BEL-17 · Q3FY26 (2026-01-28) · Employee cost as % of turnover
- **Quote** (p6, Manoj Jain (CMD)): "we are not anticipating much change in the manpower expenses, which is around 14% typically of our turnover"
  - also p6: "We will have more or less similar figures only."
- scope: company · period: FY26-FY27 · type: point (approx) · value: 14 – 14 % of turnover
- conditionality: — · basis: —
- relation: new
- **status: ⚠ conflict** · checkable from: not checkable with sources in hand
- evidence: Q1FY27 p12 CFO: employee cost/turnover ~12%, 'which is now also 12% last year' — contradicts CMD's ~14% (Q3FY26 p6). Employee cost not in saved screener HTML.
- arithmetic: 14% vs 12% for the same base year

#### BEL-32 · Q3FY26 (2026-01-28) · Kusha (indigenous long-range SAM) order receipt
- **Quote** (p19, Manoj Jain (CMD)): "so maybe around 2028 - 2029 or so, we may get that big order"
- scope: order · period: CY2028-29 / FY28-29 · type: milestone-date · value: — – — event
- conditionality: DRDO trials/RFP · basis: —
- relation: new
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Reiterated Q1FY27 with size 40,000+.
- arithmetic: —

#### BEL-18 · Q4FY26 (2026-05-20) · Revenue growth YoY
- **Quote** (p20, Manoj Jain (CMD)): "So definitely, we are going to have more than 15% as a revenue growth for '26-'27."
- scope: company (standalone) · period: FY27 · type: point (floor) · value: 15 – — % YoY
- conditionality: — · basis: standalone revenue from operations
- relation: new (FY27 annual guidance; continues BEL-08 multi-year >15%) (link BEL-08)
- **status: · too early (on track)** · checkable from: filings
- evidence: H1FY27 revenue 12,824 vs 10,181 (screener Jun+Sep quarters; mgmt Q2FY27 p3 '25.97%').
- arithmetic: +26.0% H1. FY27 >=15% needs FY27 >= 31,602 -> H2 >= 18,778 vs H2FY26 17,299 = +8.6% required

#### BEL-19 · Q4FY26 (2026-05-20) · EBITDA margin
- **Quote** (p20, Manoj Jain (CMD)): "EBITDA margins will be more than 28%."
- scope: company · period: FY27 · type: point (floor) · value: 28 – — % of revenue
- conditionality: — · basis: standalone
- relation: new (FY27; step-up from FY26's 27%) (link BEL-02)
- **status: · too early (at risk)** · checkable from: filings
- evidence: H1FY27 screener OPM 26.7% (3,428/12,824); mgmt 27.43% (Q2FY27 p3). Q2FY27 restates as 'around 28%'.
- arithmetic: 28% of 31,602 = 8,849 -> H2 EBITDA needed 5,421 on 18,778 = 28.9%; H2FY26 achieved 29.4% (5,080/17,299)

#### BEL-20 · Q4FY26 (2026-05-20) · Order inflow
- **Quote** (p20, Manoj Jain (CMD)): "The order inflow we are expecting this year more than INR55,000 crores. That includes, of course, QRSAM"
- scope: company · period: FY27 · type: point (floor) · value: 55000 – — INR cr
- conditionality: includes QRSAM · basis: —
- relation: new (supersedes BEL-07 '>25,000 ex-QRSAM' pipeline comment) (link BEL-07)
- **status: · too early (at risk)** · checkable from: later transcript only
- evidence: H1FY27 orders 7,334 (Q2FY27 p4) = 13% of 55,000; QRSAM (~30,000) still pending; Q2FY27 closing says '50,000-plus'.
- arithmetic: 7,334/55,000 = 13.3%

#### BEL-21 · Q4FY26 (2026-05-20) · R&D expenditure (revenue + capex)
- **Quote** (p21, Manoj Jain (CMD)): "So, this year, we have targeted a value of around INR2,200 crores investment in R&D."
- scope: company · period: FY27 · type: point · value: 2200 – 2200 INR cr
- conditionality: — · basis: total R&D
- relation: revised up (Q3FY26 said FY27 'more than INR 2,000 crores') (link BEL-15)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Reiterated Q1FY27, Q2FY27. Actual R&D not in results table.
- arithmetic: —

#### BEL-22 · Q4FY26 (2026-05-20) · Capex
- **Quote** (p21, Manoj Jain (CMD)): "So, we are targeting more than INR1,200 crores as a capital investment for this year."
- scope: company · period: FY27 · type: point (floor) · value: 1200 – — INR cr
- conditionality: — · basis: —
- relation: new (FY27) (link BEL-16)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Reiterated Q1FY27 ('INR1,200 plus'); Q2FY27 softened to 'around INR1,200'. Capex visible only in annual cash-flow statement.
- arithmetic: —

#### BEL-23 · Q4FY26 (2026-05-20) · Defence : non-defence revenue mix
- **Quote** (p21, Manoj Jain (CMD)): "And defense to non-defense ratio, more or less, it will be 90% to 10%, maybe plus/minus 1%."
- scope: segment mix · period: FY27 · type: range · value: 9 – 11 % non-defence share
- conditionality: — · basis: —
- relation: reiterated (link BEL-13)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Reiterated Q1/Q2FY27. Mix not in results table.
- arithmetic: —

#### BEL-24 · Q4FY26 (2026-05-20) · QRSAM order receipt
- **Quote** (p6, Manoj Jain (CMD)): "we are still fully optimistic that before June end, we may get this order. There is only 5% to 10% chance that it may slip to July."
- scope: order · period: by 30 Jun 2026 (Q1FY27) · type: milestone-date · value: — – — date
- conditionality: 5-10% chance of slip to July · basis: —
- relation: revised (date slipped from Q4FY26) (link BEL-06)
- **status: ○ missed** · checkable from: later transcript only
- evidence: Q1FY27 p4 re-dated to 'maximum by September'.
- arithmetic: —

#### BEL-25 · Q4FY26 (2026-05-20) · QRSAM first-of-production model delivery
- **Quote** (p6, Manoj Jain (CMD)): "We will definitely give our first of production model within 18 months of signing the contract."
- scope: project · period: contract signing + 18 months · type: milestone-date · value: 18 – 18 months after signing
- conditionality: relative to contract date · basis: —
- relation: new
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Contract not yet signed; Q2FY27 p26 says execution will not be delayed.
- arithmetic: relative milestone: needs contract date anchor

#### BEL-26 · Q4FY26 (2026-05-20) · NGC subsystem orders received
- **Quote** (p9, Manoj Jain (CMD)): "But at least 50% of the subsystems we are hoping to get this year only in NGC program."
- scope: order · period: FY27 · type: point (floor) · value: 50 – — % of NGC subsystems
- conditionality: 'hoping' · basis: count of subsystems, not value
- relation: revised down vs BEL-05 (Q3 said remaining 10-12k cr in H1FY27; now >=50% of subsystems in full FY27) (link BEL-05)
- **status: ↻ revised (up)** · checkable from: later transcript only
- evidence: Q2FY27 p6: all NGC line items (~20,000 cr) expected before Mar-27.
- arithmetic: —

#### BEL-27 · Q4FY26 (2026-05-20) · P-75I submarine electronics order
- **Quote** (p9, Manoj Jain (CMD)): "So, we are going to get some order for that this year."
- scope: order · period: FY27 · type: milestone-date · value: — – — event
- conditionality: — · basis: —
- relation: new
- **status: ↻ revised (down)** · checkable from: later transcript only
- evidence: Q2FY27 p9: 'So maybe P-75I may slip to next year.'
- arithmetic: —

#### BEL-28 · Q4FY26 (2026-05-20) · Non-defence share of turnover (long-term)
- **Quote** (p16, Manoj Jain (CMD)): "nondefense right now, it is 8% to 10%. We wanted to steadily increase it to 15% to 20%."
- scope: segment (non-defence) · period: unspecified ('steadily') · type: range · value: 15 – 20 % of turnover
- conditionality: — · basis: —
- relation: revised up (Q3FY26: 10% near-term, 15%+ long-term) (link BEL-13)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Long-term, undated.
- arithmetic: —

#### BEL-29 · Q4FY26 (2026-05-20) · Export share of turnover
- **Quote** (p16, Manoj Jain (CMD)): "We want to increase it to more than 10% of our turnover."
  - also p16: "But in near future of next 1, 1.5 years, the increase will be maybe 1% or 2%, not more."
- scope: segment (exports) · period: 4-5 years (~FY31); +1-2pp in next 12-18 months · type: point (floor) · value: 10 – — % of turnover
- conditionality: — · basis: —
- relation: reiterated (timeline now stated: 4-5 years) (link BEL-12)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Reiterated Q1FY27 p20 (5 years).
- arithmetic: —

#### BEL-30 · Q4FY26 (2026-05-20) · Indigenous content
- **Quote** (p16, Manoj Jain (CMD)): "But next 2 to 3 years, between 80% to 85% on an average indigenous content will be there for our products."
- scope: company · period: next 2-3 years · type: range · value: 80 – 85 % indigenous content
- conditionality: — · basis: —
- relation: new
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Q1FY27 p17: 'Overall, our turnover 78% to 80% comes from indigenous products' (different definition).
- arithmetic: —

#### BEL-31 · Q4FY26 (2026-05-20) · Receivable days
- **Quote** (p14, Management (unnamed; likely CFO)): "It has been in the constant around 140 to 150 days for the past 4, 5 years. I think it should be around that level only."
- scope: company · period: steady state (FY27+) · type: range · value: 140 – 150 days of sales
- conditionality: — · basis: —
- relation: new
- **status: ◐ partly** · checkable from: later transcript only
- evidence: Q1FY27 p5: 'around 140 days' at 30-Jun-26 but '176 days as on 31st March'.
- arithmetic: Mar-26 176 outside band; Jun-26 140 inside

#### BEL-33 · Q1FY27 (2026-07-27) · Order inflow
- **Quote** (p5, Manoj Jain (CMD)): "So, that is INR55,000 plus crores, including QRSAM. So, we are sticking to that"
  - also p12: "total INR55,000 crores, out of that INR30,000 crores roughly will be"
  - also p4: "We are definitely going to meet the guidance given about the order inflow for this year."
- scope: company · period: FY27 · type: point (floor) · value: 55000 – — INR cr
- conditionality: includes QRSAM (~30,000) · basis: —
- relation: reiterated (link BEL-20)
- **status: · too early (at risk)** · checkable from: later transcript only
- evidence: See BEL-20.
- arithmetic: —

#### BEL-34 · Q1FY27 (2026-07-27) · EBITDA margin
- **Quote** (p5, Damodar Bhattad (Director Finance & CFO)): "Overall on a yearly basis, we maintain the EBITDA margin of 28%, which we have given already."
  - also p16: "but at the year end, let me again assure you, we will cross 28%."
- scope: company · period: FY27 · type: point (floor) · value: 28 – — % of revenue
- conditionality: — · basis: standalone
- relation: reiterated (link BEL-19)
- **status: · too early (at risk)** · checkable from: filings
- evidence: See BEL-19.
- arithmetic: —

#### BEL-35 · Q1FY27 (2026-07-27) · Revenue growth YoY
- **Quote** (p19, Manoj Jain (CMD)): "our balanced plan is 15% and I am confident we will reach 15%"
- scope: company · period: FY27 · type: point (floor) · value: 15 – — % YoY
- conditionality: — · basis: standalone
- relation: reiterated (link BEL-18)
- **status: · too early (on track)** · checkable from: filings
- evidence: See BEL-18.
- arithmetic: —

#### BEL-36 · Q1FY27 (2026-07-27) · FY27 guidance restatement (closing remarks) — CONFLICTS with same-call statements
- **Quote** (p21, Manoj Jain (CMD)): "The revenue growth of 15%, EBITDA margin 21% to 23%, order inflow of more than INR20,000 crores including QRSAM"
- scope: company · period: FY27 · type: range · value: 21 – 23 % EBITDA margin; INR cr order inflow
- conditionality: — · basis: —
- relation: NOT a revision: transcript/misspeak conflict. Same call p5 & p16 reaffirm 28% and p5/p12 reaffirm 55,000; Q2FY27 again says ~28% and 55,000. Gold label: ignore as guidance; flag 'internal_conflict'. (link BEL-34)
- **status: ⚠ not guidance — conflict flag** · checkable from: n/a (conflict flag)
- evidence: Same call p5/p16 say 28% and p5/p12 say 55,000; next call (Q2FY27 p32) says ~28% and 50,000+/55,000. Treat as misspeak/transcription error, not a revision.
- arithmetic: 21-23% vs 28%; 20,000 vs 55,000

#### BEL-37 · Q1FY27 (2026-07-27) · QRSAM order receipt
- **Quote** (p4, Manoj Jain (CMD)): "maximum by September we will get and I am still sticking to that"
- scope: order · period: by 30 Sep 2026 (Q2FY27) · type: milestone-date · value: — – — date
- conditionality: awaiting CCS approval · basis: —
- relation: revised (slipped from 'before June end') (link BEL-24)
- **status: ○ missed** · checkable from: later transcript only
- evidence: Not received by 30-Sep-26; Q2FY27 p5 'very soon'.
- arithmetic: —

#### BEL-38 · Q1FY27 (2026-07-27) · Shatrughat+Samaghat (~9,000+ cr), Shakti Ph-4 (~2,000 cr), HAMMER (~2,500+ cr) orders
- **Quote** (p19, Manoj Jain (CMD)): "So, these three orders we are going to get in this financial year itself."
  - also p19: "So, for Shatrughat and Samaghat, I think I told you around INR9,000 plus"
  - also p11: "Shatrughat and Samaghat we may get in another 3 to 6 months"
- scope: order · period: FY27 · type: milestone-date · value: 13500 – — INR cr (sum of stated sizes)
- conditionality: — · basis: —
- relation: revised (Shatrughat/Samaghat slipped from Q4FY26/H1FY27 to FY27; size raised from ~3,000 for Shatrughat to 9,000+ for both) (link BEL-10)
- **status: · too early** · checkable from: later transcript only
- evidence: Q2FY27 p9: Shatrughat/Samaghat and HAMMER 'before March'; Shakti Ph-4 not mentioned again.
- arithmetic: —

#### BEL-39 · Q1FY27 (2026-07-27) · NGC / P-75I orders (at least one of the two)
- **Quote** (p11, Manoj Jain (CMD)): "at least 100% probability of having at least one of them and more than 50% probability of getting both of them"
- scope: order · period: FY27 · type: milestone-date · value: — – — event
- conditionality: CCS approval · basis: —
- relation: reiterated/reframed (link BEL-26)
- **status: · too early** · checkable from: later transcript only
- evidence: NGC cleared and signed by shipyards (Q2FY27 p6); BEL POs pending.
- arithmetic: —

#### BEL-40 · Q1FY27 (2026-07-27) · Kusha order receipt (size added)
- **Quote** (p4, Manoj Jain (CMD)): "of the order of INR40,000 plus crores we are expecting, but that will be minimum 28-29 which we had indicated last time also"
- scope: order · period: FY28-29 at earliest · type: milestone-date · value: 40000 – — INR cr (order size)
- conditionality: — · basis: —
- relation: reiterated (date) + new (size) (link BEL-32)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### BEL-41 · Q1FY27 (2026-07-27) · Employee cost as % of turnover
- **Quote** (p12, Damodar Bhattad (Director Finance & CFO)): "we expect the employee cost to turnover to be in the range of around 12% even in the coming years also"
- scope: company · period: FY27 and coming years (despite wage revision from 1 Jan 2027) · type: point (approx) · value: 12 – 12 % of turnover
- conditionality: wage revision due 1/1/2027; 3 months' provision in FY27 · basis: —
- relation: CONFLICT with BEL-17 (Q3FY26 CMD said ~14%); CFO says FY26 was 12%. Different definition or misstatement — flag. (link BEL-17)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Employee cost line not in saved screener HTML; check annual P&L.
- arithmetic: —

#### BEL-42 · Q1FY27 (2026-07-27) · Export order intake
- **Quote** (p20, Manoj Jain (CMD)): "definitely this year we have given our internal guidance of around USD300 million we should definitely fetch out of the leads"
- scope: segment (exports) · period: FY27 · type: point · value: 300 – 300 USD mn
- conditionality: 'internal guidance' · basis: —
- relation: new
- **status: — went silent** · checkable from: not checkable with sources in hand
- evidence: Not mentioned in Q2FY27; export order intake not in results.
- arithmetic: —

#### BEL-43 · Q1FY27 (2026-07-27) · Export share of turnover
- **Quote** (p20, Manoj Jain (CMD)): "we want to finally aim at 10% of our revenues through export. So, we are working systematically to see that we reach that goal in next five years."
- scope: segment (exports) · period: ~FY31 (next 5 years) · type: point · value: 10 – — % of revenue
- conditionality: — · basis: —
- relation: reiterated (link BEL-29)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### BEL-44 · Q1FY27 (2026-07-27) · Zero import of modules/sub-modules (ex-semiconductors)
- **Quote** (p13, Manoj Jain (CMD)): "So, these all modules we have set a target to complete all these indigenization in next 5 years"
- scope: company · period: ~FY31 (next 5 years) · type: milestone-date · value: — – — event
- conditionality: — · basis: —
- relation: new
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### BEL-45 · Q1FY27 (2026-07-27) · R&D expenditure / Capex / defence:non-defence (closing restatement)
- **Quote** (p21, Manoj Jain (CMD)): "the R&D investment more than INR2,200 crores, capex"
  - also p13: "INR1,200 plus crores we are investing under capex"
  - also p21: "more than INR1,200 crores with a typical defence non-defence business of 90:10"
- scope: company · period: FY27 · type: point (floor) · value: 2200 – — INR cr (R&D); capex >1,200; mix 90:10
- conditionality: — · basis: —
- relation: reiterated (link BEL-21)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### BEL-46 · Q2FY27 (2026-11-03) · Revenue growth YoY
- **Quote** (p32, Manoj Jain (CMD)): "But right now, we are confident we will have 15-plus."
  - also p7: "But overall, we are planning as of now between 15% to 20%, more than 15% growth."
- scope: company · period: FY27 · type: point (floor) · value: 15 – 20 % YoY
- conditionality: — · basis: standalone
- relation: reiterated (declined to upgrade despite H1 +26%) (link BEL-35)
- **status: · too early (on track)** · checkable from: filings
- evidence: See BEL-18.
- arithmetic: —

#### BEL-47 · Q2FY27 (2026-11-03) · EBITDA margin
- **Quote** (p32, Manoj Jain (CMD)): "EBITDA margins of around 28%, the order inflow of INR25,000"
- scope: company · period: FY27 · type: point · value: 28 – 28 % of revenue
- conditionality: — · basis: standalone
- relation: reiterated (wording softened from 'more than 28%' to 'around 28%') (link BEL-34)
- **status: · too early (at risk)** · checkable from: filings
- evidence: See BEL-19.
- arithmetic: —

#### BEL-48 · Q2FY27 (2026-11-03) · Order inflow
- **Quote** (p9, Manoj Jain (CMD)): "So total INR25,000 crores without QRSAM and with QRSAM INR55,000 crores, which was our guidance, we are sticking to that."
  - also p32: "crores minimum, excluding QRSAM and including QRSAM, INR50,000-plus crores"
- scope: company · period: FY27 · type: point (floor) · value: 55000 – — INR cr (25,000 ex-QRSAM)
- conditionality: includes QRSAM · basis: —
- relation: reiterated; closing remark p32 says 'INR50,000-plus crores' incl. QRSAM — internal inconsistency (link BEL-33)
- **status: · too early (at risk)** · checkable from: later transcript only
- evidence: See BEL-20.
- arithmetic: —

#### BEL-49 · Q2FY27 (2026-11-03) · NGC subsystem orders (all line items)
- **Quote** (p6, Manoj Jain (CMD)): "small value to big value, total, I'm expecting within next 6 months, before this financial year closure, all these orders from both the shipyards will be there with us"
  - also p6: "So tentatively, we had, I think, indicated around INR20,000 crores worth of orders. We are sticking to the same value only."
- scope: order · period: by 31 Mar 2027 (FY27) · type: range · value: 20000 – — INR cr
- conditionality: 1-2 line items may slip to April · basis: electronics incl. radar, excl. missiles
- relation: revised up (from 'at least 50% of subsystems this year' to ~100% in FY27; value ~20,000 cr vs 10-12k remaining in Q3FY26) (link BEL-26)
- **status: · too early** · checkable from: later transcript only
- evidence: —
- arithmetic: —

#### BEL-50 · Q2FY27 (2026-11-03) · QRSAM order receipt
- **Quote** (p5, Manoj Jain (CMD)): "So this program, as of now and more than 99%, I am confident it is coming to us very soon."
  - also p24: "But as of now, I'm expecting INR30,000"
- scope: order · period: 'very soon' / next CCS (undated) · type: milestone-date · value: 30000 – 30000 INR cr (order size, p24)
- conditionality: CCS approval · basis: —
- relation: revised (Sept date missed; now undated) (link BEL-37)
- **status: · too early (undated)** · checkable from: not checkable with sources in hand
- evidence: No date => cannot be scored as missed; only 'still not received'.
- arithmetic: —

#### BEL-51 · Q2FY27 (2026-11-03) · Shatrughat, Samaghat, HAMMER orders
- **Quote** (p9, Manoj Jain (CMD)): "Shatrughat and Samaghat files have moved considerably well, and we hope to get both the orders one by one before March. And HAMMER also, hopefully, we may get before March."
- scope: order · period: by 31 Mar 2027 · type: milestone-date · value: — – — event
- conditionality: 'hope' · basis: —
- relation: reiterated (Shakti Ph-4 no longer named) (link BEL-38)
- **status: · too early** · checkable from: later transcript only
- evidence: —
- arithmetic: —

#### BEL-52 · Q2FY27 (2026-11-03) · P-75I submarine electronics order
- **Quote** (p9, Manoj Jain (CMD)): "So maybe P-75I may slip to next year."
- scope: order · period: FY28 (slip from FY27) · type: milestone-date · value: — – — event
- conditionality: — · basis: —
- relation: revised down (date pushed out) (link BEL-27)
- **status: · too early** · checkable from: later transcript only
- evidence: —
- arithmetic: —

#### BEL-53 · Q2FY27 (2026-11-03) · Virupaksha radar production order
- **Quote** (p27, Manoj Jain (CMD)): "we are confident maybe around '28, '29, we may get production orders for this radar"
- scope: order · period: FY28-29 · type: milestone-date · value: — – — event
- conditionality: LRDE integration/qualification · basis: —
- relation: new
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### BEL-54 · Q2FY27 (2026-11-03) · QRSAM FOPM timeline (execution not delayed)
- **Quote** (p26, Manoj Jain (CMD)): "this few months delay in acquiring order will not translate into execution"
- scope: project · period: contract + <18 months · type: milestone-date · value: — – 18 months after signing
- conditionality: — · basis: —
- relation: reiterated (link BEL-25)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### BEL-55 · Q2FY27 (2026-11-03) · R&D / Capex / defence:non-defence mix
- **Quote** (p32, Manoj Jain (CMD)): "R&D investment of INR2,200-plus crores, capex of around INR1,200 crores. And defense to nondefense business, typically 90:10."
- scope: company · period: FY27 · type: point · value: 2200 – — INR cr (R&D); capex ~1,200; 90:10
- conditionality: — · basis: —
- relation: reiterated (capex wording 'more than' -> 'around') (link BEL-45)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —


### DEEPAKNTR — detailed records

#### DN-01 · Q3FY26 (2026-02-13) · Quarterly performance (revenue/margins) QoQ
- **Quote** (p10, Maulik Mehta (ED & CEO)): "So, I definitely expect Q4 FY26 to be better than Q3 FY26."
  - also p5: "the Group expects a favourable performance in Q4"
  - also p17: "we are cautiously optimistic, Q4 FY26 would be better than Q3 FY26."
- scope: company (group; AI segment context) · period: Q4FY26 vs Q3FY26 · type: directional · value: — – — direction
- conditionality: 'cautiously optimistic' · basis: consolidated (call discusses group numbers)
- relation: new
- **status: ● delivered** · checkable from: filings
- evidence: Consolidated (Q4FY26 call p4): revenue 1,983 -> 2,127, EBITDA 219 -> 383, margin 11% -> 18%. Screener standalone: sales 694 -> 718, OP 45 -> 73.
- arithmetic: cons EBITDA +74% QoQ; standalone OPM 6.5% -> 10.2%

#### DN-02 · Q3FY26 (2026-02-13) · Quarterly performance QoQ (Advanced Intermediates)
- **Quote** (p17, Maulik Mehta (ED & CEO)): "Q4 FY26 will be better, but Q1 FY27 will be better still."
- scope: segment (Advanced Intermediates) · period: Q1FY27 vs Q4FY26 · type: directional · value: — – — direction
- conditionality: — · basis: segment
- relation: new
- **status: ● delivered** · checkable from: filings
- evidence: AI segment (Q1FY27 call p4): revenue 708 -> 804, EBIT 34 -> 67. Segment data is in results filing (not in screener).
- arithmetic: AI EBIT +97% QoQ; EBIT margin 4.8% -> 8.3%

#### DN-03 · Q3FY26 (2026-02-13) · MIBK/MIBC plant commissioning
- **Quote** (p4, Maulik Mehta (ED & CEO)): "The MIBK/ MIBC project is progressing well and is targeted for commissioning within this quarter."
  - also p12: "When we talk about MIBK, it will have a ramp-up in Q1 FY27 in a phased manner"
- scope: project · period: Q4FY26 (by 31 Mar 2026); ramp-up Q1FY27 · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: revised (already delayed vs original schedule; analyst p20 says ~2-year delay)
- **status: ○ missed** · checkable from: later transcript only
- evidence: Q4FY26 p4 re-dated to Q2FY27; commissioned Aug-Sep 2026 (Q2FY27 p9/p12).
- arithmetic: ~2 quarters late

#### DN-04 · Q3FY26 (2026-02-13) · Utilisation — nitric acid, nitration, hydrogenation assets
- **Quote** (p12, Maulik Mehta (ED & CEO)): "we are expecting to run at 100% or close enough to 100% utilization from this quarter onwards"
- scope: assets · period: Q4FY26 onwards · type: range · value: 95 – 105 % utilisation
- conditionality: — · basis: —
- relation: new
- **status: ◐ partly (late)** · checkable from: later transcript only
- evidence: Q4FY26 p7: nitric acid only ~45% utilisation in Q4 (technical issues). Q2FY27 p8: '>100%' from September 2026.
- arithmetic: target from Q4FY26 met only from Sep-26 (~2 quarters late)

#### DN-05 · Q3FY26 (2026-02-13) · Photochlorination / fluorination (BTC->BTF) start & utilisation ramp
- **Quote** (p12, Maulik Mehta (ED & CEO)): "When we are referring to photochemical, chlorination and fluorination, that we expect those utilizations to pick up in Q1 FY27."
  - also p21: "this will come online in Q1 FY27"
- scope: assets · period: Q1FY27 · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: new
- **status: ◐ partly (late)** · checkable from: later transcript only
- evidence: Q2FY27 p5: chlorination (+ specialty chemicals plant, ~INR300 cr) commissioned 'towards the end of the quarter' (Q2FY27); p11 lists fluorination/photochlorination commissioned. No utilisation figure.
- arithmetic: 1 quarter late; utilisation unknown

#### DN-06 · Q3FY26 (2026-02-13) · High-pressure alkylation asset commissioning (completes Phase 1)
- **Quote** (p13, Maulik Mehta (ED & CEO)): "pressure alkylation asset, which will come in around between June and July 2026"
- scope: project · period: Jun-Jul 2026 (Q1/Q2FY27) · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: new
- **status: ↻ revised then silent** · checkable from: later transcript only
- evidence: Q1FY27 p9: alkylation & multipurpose plants 'slated for commissioning a couple of months earlier' -> 'within Q2'. Q2FY27 call does not name the alkylation plant.
- arithmetic: completion unconfirmed

#### DN-07 · Q3FY26 (2026-02-13) · Polycarbonate plant onstream
- **Quote** (p18, Maulik Mehta (ED & CEO)): "December 2027 is the timeline we had discussed for being onstream. So we are roughly on track."
- scope: project (Deepak Chem Tech) · period: Dec 2027 (+/- a couple of months) · type: milestone-date · value: — – — date
- conditionality: 'Plus/ minus a couple of months' · basis: —
- relation: reiterated (timeline given in earlier calls)
- **status: ↻ revised** · checkable from: later transcript only
- evidence: Q4FY26 p14: 'June 2028'; Q1FY27 p12: H2 FY29; Q2FY27 p10/p15: resin FY29, integrated chain FY30.
- arithmetic: slip: Dec-27 -> Jun-28 -> H2FY29 (Oct-28..Mar-29) -> FY30 integrated

#### DN-08 · Q3FY26 (2026-02-13) · Capex
- **Quote** (p19, Sanjay Upadhyay (Director Finance & Group CFO)): "INR 2,500 crore is for FY27, not FY26."
  - also p19: "bringing the total to approximately INR 1,200–1,300 crore"
- scope: company (group) · period: FY27 · type: point · value: 2500 – 2500 INR cr
- conditionality: — · basis: group (consolidated) presumably
- relation: new
- **status: ↻ revised (down)** · checkable from: later transcript only
- evidence: Q1FY27 p15-16: 'another INR 1,000 crore to INR 1,500 crore' / 'INR 1,500 crore to INR 1,600 crore' this year; Q2FY27 p15: H1 ~700 (analyst) + 800-900 H2.
- arithmetic: FY27 ~1,500-1,600 vs 2,500 guided (-36% to -40%); basis (cash vs capitalisation, project vs group) never fixed

#### DN-09 · Q4FY26 (2026-05-18) · Quarterly performance QoQ (standalone and consolidated)
- **Quote** (p9, Maulik Mehta (Deputy MD; titled ED & CEO in Feb-26 transcript)): "So we anticipate Q1 to be better than Q4, which was, of course, better than Q3."
  - also p9: "I can say that our Q1 looks on track for numbers, which are better than Q4, whether it is on standalone or on a consolidated basis."
  - also p10: "we anticipate Q1 will be somewhat better than Q4, and also be better than last year's Q1"
- scope: company (standalone + consolidated) · period: Q1FY27 vs Q4FY26 (and vs Q1FY26) · type: directional · value: — – — direction
- conditionality: — · basis: standalone and consolidated (explicit)
- relation: reiterated & broadened (DN-02 was AI-segment only) (link DN-02)
- **status: ● delivered** · checkable from: filings
- evidence: Consolidated Q1FY27 (call p4): revenue 2,592 vs 2,127; EBITDA 554 vs 383. Screener standalone Jun-26: sales 807 vs 718 (Mar-26) and 612 (Jun-25); OP 110 vs 73 and 60.
- arithmetic: cons rev +22% QoQ, EBITDA +45%; standalone OP +51% QoQ, +83% YoY

#### DN-10 · Q4FY26 (2026-05-18) · MIBK/MIBC (+ multipurpose agrochemical intermediates) commissioning
- **Quote** (p4, Maulik Mehta (Deputy MD; titled ED & CEO in Feb-26 transcript)): "MIBK, MIBC projects, which are scheduled for commissioning in Q2 FY27"
  - also p8: "maybe perhaps at the tail end of Q1 or the early part of Q2 is when we will be looking at commissioning of the asset"
- scope: project · period: Q2FY27 (Jul-Sep 2026) · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: revised (slipped from Q4FY26) (link DN-03)
- **status: ● delivered** · checkable from: later transcript only
- evidence: Q2FY27 p9 'now we've also commissioned our MIBK and MIBC assets'; p12 running ~60%.
- arithmetic: commissioned within Q2FY27

#### DN-11 · Q4FY26 (2026-05-18) · New products (6-7 new + INR220 cr fluorinated molecule) — regular commercial production
- **Quote** (p8, Maulik Mehta (Deputy MD; titled ED & CEO in Feb-26 transcript)): "we anticipate commercial production on a regularized basis from Q3 onwards"
- scope: products · period: Q3FY27 onwards · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: new (fluorinated-molecule plant was originally due Jan-2026 per analyst)
- **status: ↻ revised** · checkable from: later transcript only
- evidence: Q1FY27 p9: regular commercial volumes 'begins from January' (CY27 allocations).
- arithmetic: Q3FY27 -> Jan-27

#### DN-12 · Q4FY26 (2026-05-18) · EBITDA margin (standalone and group)
- **Quote** (p12, Maulik Mehta (Deputy MD; titled ED & CEO in Feb-26 transcript)): "Therefore, in FY27, we expect a stronger margin profile, even for the standalone business, compared with FY26."
- scope: company (standalone explicitly) · period: FY27 vs FY26 · type: directional · value: — – — direction
- conditionality: — · basis: standalone
- relation: new
- **status: · too early (on track)** · checkable from: filings
- evidence: Screener standalone FY26 OPM 8.5% (225/2,639); H1FY27 11.7% (190/1,619). Consolidated FY26 13.1% (1,041/7,947); H1FY27 21.1% (1,197/5,682).
- arithmetic: standalone +3.2pp, consolidated +8pp vs FY26 so far

#### DN-13 · Q4FY26 (2026-05-18) · Polycarbonate plant commissioning
- **Quote** (p14, Maulik Mehta (Deputy MD; titled ED & CEO in Feb-26 transcript)): "we are expecting it to be commissioned by June 2028"
- scope: project (Deepak Chem Tech) · period: Jun 2028 · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: revised down (Feb-26: Dec 2027 +/- a couple of months; management frames it as 'in line' — silent slip of ~6 months) (link DN-07)
- **status: ↻ revised (down)** · checkable from: later transcript only
- evidence: Q1FY27 p12: H2 FY29.
- arithmetic: Jun-28 -> Oct-28..Mar-29

#### DN-14 · Q4FY26 (2026-05-18) · Nitric acid integration EBITDA uplift (INR 90-100 cr per analyst question)
- **Quote** (p7, Maulik Mehta (Deputy MD; titled ED & CEO in Feb-26 transcript)): "So once the plant is under stable operations, we do anticipate the kind of target that we're looking at."
  - also p7: "we were roughly at about 45% of"
  - also p7: "are we on track to get that INR90 crore, INR100 crore of EBITDA addition for the nitric acid"
- scope: project · period: once stable (undated) · type: point · value: 90 – 100 INR cr EBITDA p.a.
- conditionality: 'once the plant is under stable operations' · basis: —
- relation: reiterated (number stated by analyst, endorsed by management)
- **status: · unverifiable** · checkable from: not checkable with sources in hand
- evidence: Nitric acid EBITDA contribution never disclosed; asset >100% only from Sep-26.
- arithmetic: —

#### DN-15 · Q4FY26 (2026-05-18) · Polycarbonate & related projects funding (debt:equity)
- **Quote** (p15, Sanjay Upadhyay (Director Finance & Group CFO)): "We have tied up with the banks for debt. It will be in the ratio of 60-40."
  - also p15: "So, the total project, what we have announced is around INR11,000 crore."
- scope: project · period: project life · type: point · value: 60 – 60 % debt (60:40 D:E) on ~INR11,000 cr
- conditionality: equity first (25%) before debt drawdown · basis: —
- relation: new
- **status: ● delivered (funding) / revised (cost)** · checkable from: later transcript only
- evidence: Q1FY27 p7: 'The entire debt has been tied up'; project cost 11,500 (Q1) -> 11,700 (Q2FY27 p16).
- arithmetic: cost +6% vs 11,000

#### DN-16 · Q1FY27 (2026-08-06) · MIBK/MIBC + acetophenone (Aug-26); multipurpose agro-intermediates & alkylation plants (within Q2FY27)
- **Quote** (p5, Maulik Mehta (Deputy MD)): "MIBK as well as MIBC will be commissioned along with acetophenone in August itself, and the rest of them will be commissioned within Q2."
  - also p9: "the alkylation plant as well as the multipurpose plant was slated for"
  - also p21: "We're going to commission it this month."
- scope: projects · period: Aug 2026 / by 30 Sep 2026 · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: reiterated (MIBK in Q2FY27) + revised (alkylation/multipurpose were 'slated a couple of months earlier' — DN-06 Jun-Jul slipped) (link DN-10)
- **status: ◐ partly** · checkable from: later transcript only
- evidence: MIBK/MIBC and acetophenone commissioned (Q2FY27 p9, p12); 'all of these plants have also been commissioned' (p11) but alkylation not named.
- arithmetic: 3 of 4 named assets confirmed

#### DN-17 · Q1FY27 (2026-08-06) · Regular commercial volumes from new plants (CY2027 customer allocations)
- **Quote** (p9, Maulik Mehta (Deputy MD)): "So that begins from January, and that is something where we are working hard to see that we remain on track with giving the commercial volumes."
- scope: products · period: from Jan 2027 (Q4FY27) · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: revised (DN-11 said regular commercial production from Q3FY27; now from January 2027) (link DN-11)
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: Q2FY27: trial volumes being supplied (p11).
- arithmetic: —

#### DN-18 · Q1FY27 (2026-08-06) · Phenol capacity (Deepak Phenolics) debottleneck
- **Quote** (p10, Maulik Mehta (Deputy MD)): "we are going to make, I think, about some INR 70-odd crore investment further in debottlenecking the assets to be able to touch about 4 lakh tonnes"
  - also p8: "we should in the short to medium term, be able to achieve the big 4 number"
- scope: segment (Phenolics) · period: 'short to medium term' (undated) · type: point · value: 400 – 400 KTPA phenol (capex ~INR70 cr)
- conditionality: — · basis: —
- relation: new
- **status: ◐ partly** · checkable from: not checkable with sources in hand
- evidence: Q2FY27 p8: 'come close enough to the 4 lakh tonnes'; Q2 run-rate 'less than that, but not significantly less'. Production volumes not disclosed.
- arithmetic: —

#### DN-19 · Q1FY27 (2026-08-06) · Polycarbonate plant commissioning (BPA a couple of months later)
- **Quote** (p12, Maulik Mehta (Deputy MD)): "I would anticipate that we would target H2 for our polycarbonate commissioning."
  - also p12: "Yes, FY28-29."
- scope: project (Deepak Chem Tech) · period: H2 FY29 (Oct 2028-Mar 2029), per CFO clarification '2028-2029' · type: milestone-date · value: — – — date
- conditionality: — · basis: —
- relation: revised down (Jun 2028 -> H2FY29; second slip in 2 quarters) (link DN-13)
- **status: · too early (reiterated)** · checkable from: later transcript only
- evidence: Q2FY27 p10 resin FY29 maintained.
- arithmetic: —

#### DN-20 · Q1FY27 (2026-08-06) · Propylene-to-polycarbonate project cost & funding
- **Quote** (p7, Sanjay Upadhyay (Director Finance & Group CFO)): "INR 11,500 crore being funded by debt and equity ratio of 60:40. The entire debt has been tied up"
- scope: project · period: project life · type: point · value: 11500 – 11500 INR cr project cost (60:40 D:E)
- conditionality: — · basis: —
- relation: revised up (project cost 11,000 -> 11,500 cr); debt tie-up delivered (link DN-15)
- **status: ↻ revised (up)** · checkable from: later transcript only
- evidence: Q2FY27 p16 total 11,700.
- arithmetic: +200 cr

#### DN-21 · Q1FY27 (2026-08-06) · Capex on polycarbonate/propylene project (remaining FY27 spend)
- **Quote** (p15, Sanjay Upadhyay (Director Finance & Group CFO)): "Further this year, we'll spend around another INR 1,000 crore to INR 1,500 crore this year further."
  - also p16: "Further, this year, it will be around INR 1,500 crore to INR 1,600 crore."
  - also p16: "whatever we are going to spend in 2027, 2028 will be another INR 3,000 crore"
- scope: project · period: FY27 (remainder) · type: range · value: 1000 – 1600 INR cr
- conditionality: — · basis: project-level, not company capex
- relation: revised/ambiguous vs DN-08 (FY27 capex ~2,500); same call gives 1,000-1,500 and 1,500-1,600 (link DN-08)
- **status: · too early** · checkable from: later transcript only
- evidence: Q2FY27: H2 800-900 further.
- arithmetic: —

#### DN-22 · Q1FY27 (2026-08-06) · Peak debt / debt-to-equity
- **Quote** (p19, Sanjay Upadhyay (Director Finance & Group CFO)): "But debt-to-equity ratio will be very, very comfortable. It will not cross even 1."
  - also p19: "So that would be somewhere around INR 8,000 crore to INR 8,500 crore."
- scope: company (consolidated) · period: peak (through project commissioning ~FY29) · type: point (ceiling) · value: — – 1.0 x D/E (peak debt INR 8,000-8,500 cr)
- conditionality: — · basis: consolidated
- relation: new
- **status: · too early** · checkable from: filings
- evidence: Q2FY27 p6: net debt 1,657, net D/E 0.25x (balance sheet in filings).
- arithmetic: —

#### DN-23 · Q2FY27 (2026-10-30) · Advanced Intermediates EBIT margin
- **Quote** (p8, Maulik Mehta (Deputy MD)): "So we expect Q3, in terms of EBIT percentage, somewhere between Q1 and Q2, I think closer to Q1 in terms of percentage."
  - also p8: "So I would assume that in Q4 EBIT percentage should be better than Q3."
- scope: segment (Advanced Intermediates) · period: Q3FY27 (and Q4FY27 > Q3FY27) · type: range · value: 6.0 – 8.3 % EBIT margin (Q2=6.0%, Q1=8.3%)
- conditionality: — · basis: segment EBIT
- relation: new
- **status: · too early** · checkable from: filings
- evidence: Q3FY27 not reported yet; check segment EBIT margin in [6.0%, 8.3%] and closer to 8.3%.
- arithmetic: —

#### DN-24 · Q2FY27 (2026-10-30) · Advanced Intermediates EBIT (absolute)
- **Quote** (p11, Maulik Mehta (Deputy MD)): "And if I was to look at next year, it would be roughly in the range of about INR 400 crore, INR 420 crore."
  - also p11: "I would expect about another INR"
  - also p11: "we can assume that INR 250 crore plus another INR 250 crore is the kind of visibility that we have on"
- scope: segment (Advanced Intermediates) · period: FY27 ~240; FY28 400-420; steady state ~500 · type: range · value: 400 – 420 INR cr EBIT (FY28)
- conditionality: 'There is an upside available'; contractual new-asset volumes · basis: segment EBIT
- relation: new (ambiguous phrasing 'another INR 240 crore ... this year' — read as FY27 AI EBIT ~240, matching analyst's 230-240)
- **status: · too early** · checkable from: filings
- evidence: H1FY27 AI EBIT 116 (Q2FY27 p6) -> needs ~124 in H2 for ~240.
- arithmetic: —

#### DN-25 · Q2FY27 (2026-10-30) · Advanced Intermediates EBIT margin
- **Quote** (p11, Maulik Mehta (Deputy MD)): "we should be targeting something along the lines of about 14% to 15% EBIT."
- scope: segment (Advanced Intermediates) · period: FY28 (all assets at steady state) · type: range · value: 14 – 15 % EBIT margin
- conditionality: all commissioned assets running at steady state · basis: segment EBIT
- relation: new
- **status: · too early** · checkable from: filings
- evidence: FY28.
- arithmetic: —

#### DN-26 · Q2FY27 (2026-10-30) · Phenolics annual EBIT record (> INR 867 cr, FY22)
- **Quote** (p6, Sanjay Upadhyay (Director Finance & Group CFO)): "we'll be setting a new benchmark in annual performance for this segment by the end of the financial year"
  - also p6: "our EBIT of INR 933 crore has surpassed previous highest annual EBIT of INR 867 crore"
- scope: segment (Phenolics) · period: FY27 · type: point (floor) · value: 867 – — INR cr EBIT
- conditionality: — · basis: segment EBIT
- relation: new (effectively already achieved: H1FY27 EBIT 933 > 867)
- **status: ● delivered (locked in)** · checkable from: filings
- evidence: H1FY27 Phenolics EBIT 933 > 867 (Q2FY27 p6); only an H2 loss could undo it.
- arithmetic: 933 > 867 already

#### DN-27 · Q2FY27 (2026-10-30) · MIBK/MIBC optimal (full) utilisation
- **Quote** (p17, Maulik Mehta (Deputy MD)): "That is what we are looking at."
  - also p17: "And MIBK, MIBC FY28, we'll be able to operate at optimal utilization?"
  - also p12: "I think right now, we're at about 60%."
- scope: asset · period: FY28 · type: milestone-date · value: — – — utilisation
- conditionality: — · basis: —
- relation: new (answer to analyst's 'MIBK, MIBC FY28, we'll be able to operate at optimal utilization?')
- **status: · too early** · checkable from: not checkable with sources in hand
- evidence: —
- arithmetic: —

#### DN-28 · Q2FY27 (2026-10-30) · Polycarbonate resin plant commissioning (integrated propylene-to-PC chain FY30; optimal PC utilisation FY31)
- **Quote** (p10, Maulik Mehta (Deputy MD)): "So we continue to remain in line with our FY29 number."
  - also p15: "So the integrated asset, as you highlighted, will get commissioned in FY30."
  - also p15: "by and large, I would say that in FY31, you already have seen a fully"
- scope: project · period: FY29 (resin) / FY30 (integrated) · type: milestone-date · value: — – — date
- conditionality: resin initially on bought-out BPA · basis: —
- relation: reiterated (resin) + revised (integrated chain now FY30 per investor deck) (link DN-19)
- **status: · too early** · checkable from: later transcript only
- evidence: —
- arithmetic: —

#### DN-29 · Q2FY27 (2026-10-30) · Capex schedule (cash) for growth projects
- **Quote** (p16, Sanjay Upadhyay (Director Finance & Group CFO)): "INR 2,200 crore-INR 2,400 crore next year, INR 2,500 crore in the second year"
  - also p15: "So around INR 800 crore to INR 900 crore further in the second half."
  - also p16: "INR 11,700 crore."
- scope: company (group) · period: FY27 H2: 800-900; FY28: 2,200-2,400; FY29: 2,500; FY30: 2,500-3,000; total 11,700 · type: range · value: 2200 – 2400 INR cr (FY28)
- conditionality: — · basis: cash-flow capex (CFO clarified cash vs capitalisation)
- relation: revised (FY27 now ~1,500-1,600 incl. H1 ~700; project total 11,500 -> 11,700) (link DN-21)
- **status: · too early** · checkable from: later transcript only
- evidence: —
- arithmetic: —


## 5. Hard cases

1. **A call that contradicts itself (BEL-36).** The Q1FY27 closing remark (p21) says "EBITDA margin 21% to 23%, order inflow of more than INR20,000 crores including QRSAM". Earlier in the same call the CFO said 28% (p5), the CMD said "we will cross 28%" (p16), and both confirmed ₹55,000 cr (p5, p12). An analyst even quoted "21% to 23%" back at the CMD (p16), and the CMD answered 28%. The Q2FY27 closing remark says "INR50,000-plus crores" while p9 of the same call says 55,000. **Gold rule:** a guidance value changes only if management states it explicitly and at least once more, or in a later call. Lone outliers in closing remarks get the label `internal_conflict` and are not treated as revisions.
2. **Two speakers, two numbers (BEL-17 vs BEL-41).** For employee cost as a share of turnover, the CMD said ~14% (Q3FY26 p6). The CFO said ~12%, "which is now also 12% last year" (Q1FY27 p12). It is unresolved without the annual report. Label both and flag the conflict.
3. **Resolving relative time.** Examples that need care:
   - Q1FY27 BEL p4: "last year ... could not meet our actually previous year target" refers to FY25. In the same answer, "we finally landed in around INR30,000 plus" refers to FY26.
   - BEL Q1FY27 p16: "financial year '25" was misspoken for FY27.
   - DN Q3FY26 p10: "February 2025" was meant as 2026.
   - DN Q1FY27 p12: "H2" needed a clarification from the CFO ("2028-2029"), giving H2 FY29.
   - Some promises use calendar dates or calendar-year customer contracts: "December 2027", "June 2028", "CY 2026 requirements", "begins from January".
   - "Next year" in a January call means FY27. "This year" in a May call means FY27.

   Every period has to be resolved against the call date under the Indian April-March financial year, and stored as an explicit start and end date.
4. **Full-year targets assessed mid-year.** BEL is heavily back-ended: Q4FY26 alone was 37% of FY26 revenue, and H1 is about 37%. Pro-rating H1 order inflow (13% of 55,000) or H1 margin (26.7% vs 28%) linearly would wrongly say "off track". **Gold practice:** keep the status as "too early" and attach the computed required second-half run-rate and last year's second half as context. For example: revenue needs H2 +8.6% YoY against H2FY26, and margin needs 28.9% against H2FY26's 29.4%. Add a risk flag where the gap is large. For lumpy order inflow, the required H2 is ₹47,666 cr, almost all of it from two named orders, so the label is "binary on QRSAM + NGC".
5. **Order inflow and order timing are not in the filings.** BEL's most important guidance (₹27k / ₹55k cr inflow, plus the QRSAM, NGC, Shatrughat dates) can only be checked from management's own later statements (order book and "orders acquired" in the opening remarks). That makes the check self-reported. Independent corroboration would need BSE Reg-30 order-win announcements, which were not fetched.
6. **Undated or relative milestones.** Examples: QRSAM "very soon"; first production model "within 18 months of signing"; Kusha "minimum 28-29"; nitric-acid EBITDA "once the plant is under stable operations"; phenol 400 KTPA "short to medium term". These cannot be scored as missed, only as "still pending". The schema needs an anchor event and a due date that can be null.
7. **Definition gap: management EBITDA vs screener OPM (BEL).** Management EBITDA runs ~0.7pp above screener operating margin in every period:

   | Period | Management EBITDA | Screener OPM |
   |---|---|---|
   | FY26 | 30% | 29.2% |
   | Q1FY27 | 25.83% | 25.1% |
   | H1FY27 | 27.43% | 26.7% |
   | 9M FY26 | 30% | 29.2% |

   This does not matter for "≥27%". It does matter for "around 28%". A scorer needs a declared metric definition and a tolerance (for example ±0.5pp for "around").
8. **Standalone vs consolidated vs segment (DEEPAKNTR).** The saved screener page is standalone, covering Deepak Nitrite Ltd only. Management guides on the group and on its two segments. The Advanced Intermediates segment includes Deepak Chem Tech's AI business (CFO, Q3FY26 p15), so the segment does not equal standalone. In Q2FY27, AI revenue was 811 against standalone sales of 812, a coincidence of scale. Segment guidance (DN-23 to DN-26) needs the segment table in the results PDF, or screener's `/consolidated/` page plus segment data. Only DN-01, DN-09 and DN-12 could also be checked on the standalone basis, because management said "standalone" explicitly.
9. **Silent revisions.**
   - Polycarbonate: Dec-27 became "June 2028", introduced with "we are, by and large, remaining kind of in line with that" (Q4FY26 p14). It then became H2 FY29, then FY30 for the integrated chain.
   - FY27 capex: ₹2,500 cr became ~₹1,500-1,600 cr, never described as a cut.
   - Project cost: ₹11,000 cr became ₹11,500 cr, then ₹11,700 cr.
   - BEL "NGC ₹10-12k cr remaining in H1" became "≥50% of subsystems this year", then "~₹20,000 cr all before March".

   Revisions have to be **detected by diffing value and date against the previous statement in the same thread**, not from management's framing.
10. **Softer wording.** BEL's "EBITDA margins will be more than 28%" (May) became "around 28%" (Nov). Capex "more than INR1,200" became "around INR1,200". The schema must keep the bound type (floor, ceiling, approximate, range) or this drift is invisible.
11. **Numbers that came from analysts.**
    - DN-14: ₹90-100 cr of nitric-acid EBITDA was the analyst's number. Management replied "we do anticipate the kind of target that we're looking at".
    - DN-27: FY28 full MIBK utilisation was the analyst's phrasing. Management said "That is what we are looking at".
    - BEL Q1FY27 p16: "R&D to 8%" came from the analyst.
    - DN Q2FY27 p20: an analyst proposed "12% to 15% growth ... 18% to 20% EBITDA margin". Management did **not** endorse it, and it is excluded.

    **Gold rule:** include only when management affirms the number, and record `attribution = analyst_proposed_mgmt_endorsed`. Analyst turns also misquote actuals. In BEL Q1FY27, analysts said "13%" (p10) and "20%" (p19) for Q1 growth, but management reported 25.27%. Never take actuals from analyst turns.
12. **Already-satisfied guidance.** DN-26 (Phenolics record annual EBIT) was effectively delivered when it was stated: H1 EBIT of ₹933 cr already exceeded the ₹867 cr record. Label it, but do not give management credit as if it were a forecast.
13. **Delivery inferred, not stated.** BEL-11 (LCA order in Q4FY26) is never confirmed explicitly. It is inferred because "LCA around INR3,200 crores" appears in the May order-book list (p7) but not in the January list (p17). It carries low confidence.
14. **Restated or reclassified numbers.**
    - Deepak calls Q3FY26 revenue of 1,983 "consolidated total revenue" in one call and "consolidated revenues" in the next.
    - FY26 revenue and PBT exclude ₹91 cr of dividend income (Q4FY26 p5-6).
    - BEL Q3FY26 margins include ₹256 cr of provision write-backs (p13).

    No restatement of prior-quarter actuals was found between the transcripts and screener for BEL. 9M FY26 revenue was 17,302 in the transcript and 17,303 on screener, a rounding difference.
15. **Speaker metadata changes.** Maulik Mehta is "ED & CEO" in February and "Deputy Managing Director" from May onwards. BEL's Q4FY26 call has an unnamed "Management:" speaker answering CFO-type questions (p14-17). A speaker key has to normalise names across title changes.

## 6. Statements deliberately excluded (with reasons)

| Call | Page | Statement (paraphrase) | Why excluded |
|---|---|---|---|
| BEL Q3FY26 | 6 | "this year ... around 95% of our items, we will deliver on time ... next year 100%" | Internal operating target. Never reported later, so it cannot be checked. |
| BEL Q3FY26 | 11 | Akash Prime ">90% of that order before this financial year" | Execution of one project. Not disclosed in filings. |
| BEL Q3FY26 | 18 | AMCA RFP "around mid of February" | A forecast of what the counterparty (MoD/ADA) will do, not a company deliverable. The same applies to the RFP timing at Q4FY26 p12, the bid deadline at Q1FY27 p15, and the outcome "before March" at Q2FY27 p18. |
| BEL Q3FY26 | 19 | "8 to 10 big programs" of ₹3-4k cr "next year and next to next year" | No total and no measurable target. |
| BEL Q4FY26 | 12 | "not seeing any choking ... next few years, maybe 3 to 5 years" (capacity) | Not measurable. |
| BEL Q1FY27 | 16, 19 | LRSAM ~₹2,100-2,300 cr, Akash Army ~₹1,200 cr, D-29/MPR/BMP-2/LCA ₹500-1,000 cr revenue each in FY27 | Revenue for individual projects is not disclosed. **Optional:** an extractor that emits these should not be heavily penalised. |
| BEL Q1FY27 | 16-17 | R&D rising from 6.5-6.8% to 8% of revenue | The framing came from the analyst, and there is no date. |
| BEL Q2FY27 | 14 | Drones: "at least 1 or 2 big orders" next year | "Big" is not quantified. |
| BEL Q2FY27 | 15 | LRLACM / Pralay "we expect some orders in future" | Undated. |
| BEL Q2FY27 | 32 | Civil cybersecurity "thousands of crores in the pipeline" | Undated pipeline. |
| DN Q3FY26 | 7 | 15-product pipeline, "many of these will come over in the next several months" | Not quantified. |
| DN Q3FY26 | 11 | Dahej agro asset "will play out in full ... for calendar year 2027 onwards" | Asset and product not named. Partly covered by DN-11 and DN-17. |
| DN Q3FY26 | 4 | Renewables to be "60% to 70% of our energy mix" | Present tense with no date. Not a financial metric. |
| DN Q3FY26 | 15-16 | Explosives/TNT "outcome ... over the next three months, six months" | No metric. |
| DN Q3FY26 | 16-17 | Keep phenol share of India at "55% to 60%" | Market share cannot be checked from filings. Borderline: a stricter set could include it. |
| DN Q4FY26 | 9 | Low-cost feedstock inventory lasting "maybe halfway through Q2" | A comment on inputs, not a deliverable. |
| DN Q1FY27 | 18 | Flow-chemistry products "coming into play in the next financial year" | Unquantified. |
| DN Q2FY27 | 18 | 80-100 KTPA of merchant phenol from the new capacity | A long-dated design parameter. |
| DN Q2FY27 | 19-20 | "12% to 15%" growth, "18% to 20%" EBITDA margin | The analyst proposed it and management did not endorse it. **Must not be extracted.** |
| DN Q2FY27 | 12 | AHF / ultra-pure DHF plant | It sits in a separate entity that is not a subsidiary. |

## 7. Lessons for the extractor and scorer

**What a schema must capture**

1. `thread_id`: a stable key that links restatements across calls. 84 items collapse to 44 threads, and most of the value of the ledger is in the links (reiterated, revised, dropped).
2. A canonical metric name **plus its definition** (management EBITDA vs OPM; orders vs revenue; cash capex vs capitalisation), and `scope` (standalone / consolidated / segment / project / single order).
3. `period` resolved to explicit start and end dates under the Indian financial year, with the raw phrase kept. A due date that can be null for undated items, and `anchor_event` for relative milestones ("18 months after signing").
4. `bound_type`: floor / ceiling / approximate / range / directional / milestone. Also `value_low`, `value_high`, and a unit from a fixed vocabulary (₹ cr, %, pp, USD mn, KTPA, days, x).
5. `conditionality` (incl./excl. QRSAM, "once stable", "subject to CCS") and a confidence phrase ("hopeful", ">90% confident", ">99%").
6. Speaker (normalised) and role, `attribution` (management / analyst_proposed_mgmt_endorsed), verbatim quote, and PDF page index.
7. `relation` (new / reiterated / revised up / revised down / dropped) with a link, and an `internal_conflict` flag.
8. Status **history per call**, not only the latest status, plus `checkable_from` (filings / transcript / none) and evidence pointers.

**What must be computed in code, not by the LLM**

1. Period resolution from the call date and fiscal calendar.
2. Growth rates, margins and run rates from actuals.
3. The required second-half value and seasonality-aware "on track" bands.
4. Tolerance checks (±0.5pp for "around").
5. Direction checks for directional guidance.
6. Revision detection: diff the new value or date against the thread's previous one.
7. Silence detection: a thread not mentioned in a later call. Mark it "went silent" only after N calls, or when the due date has passed.
8. Quote verification against page text.
9. Basis reconciliation (standalone vs consolidated). Pick the actuals source by scope, and never compare a consolidated promise with standalone screener rows.

**What an LLM will likely get wrong (these are the traps in this set)**

1. Citing printed page numbers instead of PDF pages (off by one everywhere).
2. Treating the "21-23%" misspeak as a margin cut, or the "50,000-plus" closing remark as an inflow cut.
3. Extracting analyst numbers as guidance.
4. Missing silent revisions that management calls "in line".
5. Turning "more than 28%" and "around 28%" into the same thing.
6. Resolving "this year", "next year", "H2" or "last year" wrongly, especially "last year" in a Q1 call.
7. Scoring consolidated guidance against standalone screener numbers.
8. Over-extracting aspirations (data centre, drones, 15-product pipeline) and project-level revenue.
9. Merging distinct tranches (NGC FY26 ₹2-3k vs H1FY27 ₹10-12k), or splitting one promise into duplicates.
10. Paraphrasing quotes. Hyphenation and line breaks ("high-\npressure") broke 1 of 84 even for a careful human, and the BEL OCR body has no space in "INR27,480".
11. Marking undated items ("very soon") as missed.
12. Giving credit for trivially satisfied guidance (DN-26).

**Volume and size**

- Items per transcript: BEL 10-18 (mean 13.8); DEEPAKNTR 7-8 (mean 7.3).
- BEL concentrates its numeric guidance in the CMD's closing remarks. That block alone holds about 5-6 metrics, and the closing remarks are also where the conflicts are. DEEPAKNTR's guidance is scattered across Q&A, and is mostly directional or about project milestones.
- Transcript size: 44-68k characters, or 7.2-11.1k words. That is about 11-17k tokens each at roughly 4 characters per token. One company's 4-call history is about 55-65k tokens, so it fits in a single context, which makes cross-call thread linking with the full history feasible. Guidance-bearing text is under 10% of each transcript, so a two-pass design (candidate spans, then structured extraction) cuts cost.
- Text quality: 3 of 4 BEL PDFs are scans with OCR. The text is usable, but there are junk header/footer lines and Hindi garbage on page 1. DEEPAKNTR is clean Word output. Strip page 1 (the cover letter) and the repeated header/footer lines before extraction, but keep the PDF page index.

**Checkability verdict**

- Only about 21% of gold items can be checked against filings using the screener results table. BEL's numeric revenue and margin guidance is fully checkable. Its order-inflow and order-date promises, which are central to BEL, can be checked only against later transcripts or Reg-30 announcements.
- A credible ledger therefore needs, beyond screener: results PDFs (segments, consolidated), BSE Reg-30 order and commissioning announcements, and annual reports (R&D, capex, employee cost, mix).
- Without those, about half of the statuses rest on management's own later statements, and the UI should label them as such.
