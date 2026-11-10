# FINN — Data-acquisition research (02)

> **Status note (10 Nov, later):** the research agent was stopped before it finished, so this report is the agent's own unfinished draft. It never sent back a final summary or checked its own work. I did that review myself and closed the open items. See **§9 Completion addendum** at the end. Sections 0–8 are the agent's text, unchanged.

Date: 2026-11-10 (Tuesday, an NSE trading holiday for Diwali Balipratipada). Researcher: Claude (desk research plus light probing).
Downloads are in `.../scratchpad/research/data-probe/`. Library clones (read only, never executed) are in `data-probe/repos/`.

Conventions: **[measured]** means I fetched it today and the status and fields are recorded. **[doc]** means it comes from source code or docs, with a URL. **[unverified]** means it is from memory or a single weak secondary source.

Access etiquette I followed: about 45 requests to NSE, screener and BSE hosts, spaced 3–7 s apart. Every request sent an honest User-Agent `FINN-research-prototype/0.1 (non-commercial evaluation)`. I did no browser impersonation and no proxies, and I did not retry after a 403. The BSE web pages returned 403 to WebFetch. I recorded that and did not retry.

---

## 0. TL;DR — recommendation matrix

| # | Need | Prototype primary | Fallback | Refresh | Real-deployment licence |
|---|---|---|---|---|---|
| 1 | EOD price/volume (15–20 NSE stocks) | **NSE UDiFF CM bhavcopy**: one zip per day covering all stocks, from `nsearchives` | **NSE official MCP server** `get_stock_history` (5-year window, no key), then yfinance | Daily, after about 18:00 IST; skip holidays | NSE Data "EOD Capital Market" ₹1,00,000/yr per site per medium, or a licensed vendor (TrueData, Accord, GDFL) |
| 2 | Announcements to classify | **NSE RSS `Online_announcements.xml`**: whole day, ~600 items, clean `SUBJECT` category. Plus specialised RSS feeds (InsiderTrading, Board_Meetings, Sast encumbrance, Corporate_action, Integrated_Filing_Financials) | NSE `api/corporate-announcements` (symbol + date range; already measured) for backfill | Poll every 5–15 min (feed `ttl`=5) | NSE Data **Corporate Data** ₹10,60,000/yr (realtime) or **EOD Corporate Data** ₹5,00,000/yr. Vendors: Ticker Plant, TrueData, Accord, CMOTS |
| 3 | Annual reports and concall transcripts | **screener.in company page** (one request per ticker per week) to collect links, then BSE `AttachHis` PDFs | NSE `api/annual-reports` / `Annual_Reports.xml` RSS; announcements RSS with SUBJECT "Analysts/Institutional Investor Meet/Con. Call Updates" (transcript PDFs appear there); company IR sites | Weekly, plus event-driven when a "Con. Call Updates" item arrives | Licensed transcript and fundamentals vendor (Trendlyne / Tijori / Capitaline / CMIE Prowess: contact sales) |
| 4 | Latest quarterly results (Revenue, EBITDA, PBT, PAT) | **NSE Integrated Filing (Financials) XBRL**: parse `RevenueFromOperations`, `ProfitBeforeTax`, `ProfitLossForPeriod`, `FinanceCosts`, D&A, `OtherIncome` | screener quarterly table (current to Sep-2026), then yfinance | Daily during results season (≤45 days after quarter end) | NSE Corporate Data (includes "Company Results" and segment results) or a vendor |
| 5 | People / incoming executives | **"Change in Directors/KMP/SMP" XBRL** linked from the announcements RSS. It has a structured **`BriefProfile`** field | The announcement PDF's text; annual-report board section | Event-driven | MCA data through licensed aggregators (Probe42, Surepass, Tofler). MCA21 has no public API |

The two biggest findings:

1. **NSE publishes 23 public RSS feeds and they work** [measured]. The corporate-announcement feed covers the entire day with a clean category field. Its links point to machine-readable XBRL for many event types: change in management (with a "Brief profile"), insider trading, board-meeting intimation, and integrated-filing financials. This is cleaner than the noisy `desc` field of `api/corporate-announcements`.
2. **The legacy `corporates-financial-results` endpoint is stale because the data moved.** SEBI's circular of 31-Dec-2024 (SEBI/HO/CFD/CFD-PoD-2/CIR/P/2024/185) introduced "Integrated Filing (Financials)" from the quarter ended Dec-2024. NSE now serves results under `integrated-filing-results` and the `Integrated_Filing_Financials.xml` RSS. Today's Q2 FY27 XBRL parsed cleanly [measured].

A third finding: **NSE runs an official, no-auth MCP server** (`https://mcp.nseindia.in/bhavcopy/cm/mcp`) with 21 tools over five years of bhavcopy-derived history plus corporate actions [measured]. It is a sanctioned path that avoids scraping `www.nseindia.com/api`.

---

## 1. Per-need detail

### 1.1 EOD price and volume

**Primary: NSE UDiFF CM bhavcopy** [measured]
- URL format (current, UDiFF, in use since mid-2024 [unverified exact switch date, believed 8-Jul-2024]):
  `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{YYYYMMDD}_F_0000.csv.zip`
- Legacy format (before the switch): `https://nsearchives.nseindia.com/content/historical/EQUITIES/{YYYY}/{MON}/cm{DD}{MON}{YYYY}bhav.csv.zip`. NseIndiaApi switches on `UDIFF_SWITCH_DATE` ([NSE.py](https://github.com/BennyThadikaran/NseIndiaApi/blob/main/src/nse/NSE.py)).
- Probe for 2026-11-09: **HTTP 200, 206,935-byte zip, a 636,877-byte CSV, 3,704 rows** (2,743 `EQ`, 376 `SM`, 203 `BE`, 72 `ST`, 52 `GS`). The file's mtime inside the zip is 16:42, so the file is ready by late afternoon.
- 34 columns: `TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol,TtlTrfVal,TtlNbOfTxsExctd,SsnId,NewBrdLotQty,Rmks,Rsvd1..4`
- Sample row: `2026-11-09,...,1333,INE040A01034,HDFCBANK,EQ,...,HDFC BANK LTD,797.00,801.90,785.95,798.15,798.15,784.10,,798.14,,,64826814,51509837400.55,454214,...`
- 2026-11-10 returned **404**, which is expected because today is a trading holiday.
- **Delivery data**: `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_{DDMMYYYY}.csv` returned **200, 400,839 B**. Columns include `DELIV_QTY, DELIV_PER` (HDFCBANK 09-Nov: 40,649,197 shares, 62.70%).
- **Etiquette finding:** a request with curl's default UA got an HTTP/2 stream reset (`INTERNAL_ERROR`) from Akamai. The same request with an honest, descriptive non-browser UA returned 200. Always send a descriptive UA. Never spoof a browser.

**Fallback A: NSE official MCP server** [measured]
- `POST https://mcp.nseindia.in/bhavcopy/cm/mcp` (streamable-HTTP MCP, JSON-RPC 2.0). `initialize` returned **200** with an `Mcp-Session-Id` header. serverInfo is `nse-bhavcopy-redis-mcp 1.0.0`. The server instructions say: "Serves historical OHLCV data for ~5000 NSE-listed equities… 5-year window… Data source: official NSE Bhavcopy files. SEBI Disclaimer: … for educational and research purposes only."
- `tools/list` returned **21 tools**: get_stock_history, get_ltp_by_date, get_bulk_quote, get_corporate_actions, get_52_week_high_low, moving_average, get_volume_analysis, compare_stocks, get_stock_vs_index, get_index_history, get_index_snapshot, get_index_valuation, get_market_breadth, get_market_mood, get_top_movers, get_top_by_volume, get_index_movers, compare_indices, get_index_performance, nse_lookup_symbol, search_symbols.
- `get_stock_history {symbol: HDFCBANK, months: 1}` returned 20 trading days, 2026-10-12 to **2026-11-09**, with close 798.15. That matches the bhavcopy exactly. Fields: `open, high, low, close, prevClose, volume, totalTradedValue, deliveryQty (0, not populated), date`. The tool caps each call at 3 months.
- `get_corporate_actions {symbol: HDFCBANK}` returned 7 events with `exDate, actionType, purpose, adjustmentFactor`. Example: the 1:1 bonus on 2025-08-26 has factor 0.5. This is useful for building adjusted series.
- `get_bulk_quote` with a comma-separated string failed with an `ArrayList` deserialisation error. Pass a JSON array.
- A second server, `https://mcp.nseindia.in/cmmkt/mcp` (live cash-market data, 15 tools), is documented in [nsepython rahu.py](https://github.com/aeron7/nsepython/blob/master/nsepython/rahu.py). I did not test it. A secondary write-up: [marketcalls.in](https://www.marketcalls.in/?p=64927).
- Caveat: I found no published ToS or rate limits. The NSE page `https://www.nseindia.com/nse-mcp` timed out for WebFetch.

**Fallback B: yfinance (`HDFCBANK.NS`)**. It was measured working on 10-Nov in an earlier step. Caveats:
- yfinance 1.8.0 builds its session with `curl_cffi` **`impersonate="chrome"`** (`yfinance/_http.py:61`). That is browser TLS impersonation.
- The README says "the Yahoo! finance API is intended for personal use only" ([README](https://github.com/ranaroussi/yfinance)).
- Rate-limit reports from cloud hosts in 2025: [#2297](https://github.com/ranaroussi/yfinance/issues/2297), [#2422](https://github.com/ranaroussi/yfinance/issues/2422), [#2480](https://github.com/ranaroussi/yfinance/issues/2480), [Streamlit thread](https://discuss.streamlit.io/t/yfratelimiterror-too-many-requests-rate-limited-try-after-a-while/111207).
- Prices are split-adjusted by default.
- My cross-check today failed on sandbox DNS, not on Yahoo, so I have no fresh yfinance-vs-bhavcopy diff.

**Comparison (G)**

| Source | Coverage | Adjusted? | Freshness | Effort | Legal posture |
|---|---|---|---|---|---|
| UDiFF bhavcopy | All ~3,700 NSE CM instruments in one file per day; includes ISIN, trades, turnover | Raw (unadjusted) | Same evening | One GET per day; zip+CSV | Public download link (the ToS carve-out "unless … available for download"); redistribution still needs permission |
| sec_bhavdata_full | Same, plus delivery % | Raw | Same evening | One GET per day | Same |
| NSE MCP | ~5,000 equities, 5 years, 3 months per call | Raw, with corporate-action factors | T+0 evening (9-Nov present on 10-Nov) | MCP client | Official NSE service, "educational/research"; terms not found |
| `api/historicalOR/...` via libraries | Per symbol | Raw | Live | Needs Akamai cookies; libraries use impersonation | ToS forbids automated collection |
| yfinance | Global; `.NS` / `.BO` | Adjusted by default | Usually same day | Easy | Yahoo personal-use only; browser impersonation |
| Licensed (NSE Data EOD CM, vendors) | Full | Per contract | SFTP after ~20:00 IST | Contract | Clean |

**Recommendation.** Use the bhavcopy as the canonical source. Store raw OHLCV and build adjusted series from `get_corporate_actions` factors. Backfill history once from the MCP server (3-month chunks) or from historical bhavcopies. Use yfinance only as an emergency fallback, and never as the displayed number of record.

**Pitfalls**
- Holiday calendar: 404 on holidays. The 2026 list includes 10-Nov and 24-Nov.
- Muhurat sessions fall on Sundays (8-Nov-2026).
- `SctySrs` changes (EQ↔BE) when a stock moves to trade-for-trade.
- Symbol renames, e.g. ZOMATO→ETERNAL, seen in NseIndiaApi tests.
- T+0 file timing varies.

### 1.2 Corporate announcements

**Primary: NSE RSS** [measured]
- The feed list is scraped from `https://www.nseindia.com/static/rss-feed` (200, 322 KB). There are 23 feeds, all `https://nsearchives.nseindia.com/content/RSS/<name>.xml`:
  Annual_Reports, Board_Meetings, Circulars, Corporate_Governance, Corporate_action, Daily_Buyback, Financial_Results, InsiderTrading, **Integrated_Filing_Financials**, Investor_Complaints, Offer_Documents, **Online_announcements**, Related_Party_Trans, **Sast_ReasonForEncumbrance**, Sast_Regulation29, Sast_Regulation31, Secretarial_Compliance, Share_Transfers, Shareholding_Pattern, Statement_Of_Deviation, Unitholding_Patterns, Voting_Results, brsr.
- **`Online_announcements.xml`**: 200, 238 KB, `ttl` 5 min, `lastBuildDate` 10-Nov-2026 19:00 IST. It held **612 items spanning 00:06–18:58 today**, so the feed holds about one calendar day.
  - Item shape: `title` = company name, `link` = PDF or XBRL XML, `pubDate` = `10-Nov-2026 18:58:21`, `description` = "`<CO> has informed the Exchange about … |SUBJECT: <category>`".
  - Top SUBJECT counts today: Declaration of NAV 179 · Analysts/Institutional Investor Meet/Con. Call Updates 115 · Analyst/Investor Meet Para A-XBRL 66 · Board Meeting Intimation 55 · Outcome of Board Meeting 20 · General Updates 20 · Press Release 13 · Change in Directors/KMP/SMP/Auditor/RTA 11 · Copy of Newspaper Publication 10 · Record Date Updates 9 · Investor Presentation 7 · Monitoring Agency Report 5 · Resignation of Director/KMP/SMP 4 · Cessation 4 · Bagging/Receiving of orders/contracts 4 · Change in Management 3 · Increase in Authorised Capital 3 · **Credit Rating 3** · Disclosure of material issue 2 · Shareholders meeting 2.
  - Some items have no `link`, which crashed my naive parser. Handle `None`.
- **`InsiderTrading.xml`**: 16 items. The description is pipe-delimited: `SYMBOL|Company|Original|Regulation 7 (2)|IT_..._WebXMLFile_...xml|..._WEB.html|...`. The linked PIT XBRL (`<!--PIT V2.0 (30-04-2026)-->`) has `CategoryOfPerson, NameOfThePerson, SecuritiesHeldPrior…, SecuritiesAcquiredOrDisposedNumberOfSecurity, …ValueOfSecurity, …TransactionType (Buy), ModeOfAcquisitionOrDisposal (Market Purchase), dates, ExchangeOnWhichTheTradeWasExecuted`. This is fully structured.
- **`Sast_ReasonForEncumbrance.xml`** (pledging): 20 items with title, e.g. "Vedanta Limited", and description "NAME OF THE PROMOTER(S)/PACS WHOSE SHARES HAVE BEEN ENCUMBERED: …". There is **no link and no date**, so use it only as a trigger.
- **`Board_Meetings.xml`**: 105 items, with the meeting date and purpose in the description.
- **`Corporate_action.xml`**: 59 items, e.g. "SERIES:EQ |PURPOSE:INTERIM DIVIDEND - RS 5 PER SHARE |RECORD DATE:13-Nov-2026".
- **`Financial_Results.xml`**: only 3 items, and they are legacy and stale (Gammon India FY24). Do not use it; use Integrated_Filing_Financials.
- **`Corporate_Governance.xml`**: empty (0 items).

Suggested SUBJECT → FINN-class mapping. This is a starting point; finish with an LLM on the PDF text.

| FINN class | NSE SUBJECT strings / feed |
|---|---|
| results | Outcome of Board Meeting (with "financial results"), Integrated_Filing_Financials feed, "Financial Result Updates" |
| earnings_call | Analysts/Institutional Investor Meet/Con. Call Updates; Analyst/Investor Meet Para A-XBRL; Investor Presentation |
| management_change | Change in Directors/KMP/SMP/Auditor/RTA; Change in Management; Resignation of Director/KMP/SMP; Cessation; Appointment |
| credit_rating | Credit Rating |
| dividend | Record Date Updates, Corporate_action feed (DIVIDEND) |
| insider_trading | InsiderTrading feed (Reg 7(2)), SAST Reg 29 feed |
| pledging | Sast_ReasonForEncumbrance feed; SAST Reg 31 |
| fund_raise | Increase in Authorised Capital; QIP/preferential/rights; Monitoring Agency Report; Statement_Of_Deviation feed |
| capex / orders | Bagging/Receiving of orders/contracts; Disclosure of material issue; Press Release (needs NLP) |
| M&A | Acquisition / Amalgamation / Scheme of Arrangement (and Press Release, with NLP) |
| litigation | "Litigation/Dispute/Regulatory action" style subjects [unverified exact string]; General Updates (NLP) |
| noise | Declaration of NAV (MF), Copy of Newspaper Publication, Updates |

**Fallback:** NSE `api/corporate-announcements` (symbol and date range), already measured, for backfill beyond one day. It needs the `www.nseindia.com` cookie dance.

**Pitfalls**
- The feed window is about one day. Poll at least every 15 min and persist everything, or items will be lost.
- `title` is the company name, not the symbol. Map it with `EQUITY_L.csv` (`https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv`) or read `NSESymbol` from the XBRL.
- Duplicate items, and pairs where one event produces both an XBRL item and a PDF item.
- Companies listed only on BSE are not covered. The BSE API is unavailable (Access Denied).
- PDFs vary in quality, and some are scanned.

**Licensed:** NSE Data "Corporate Data" is a realtime multicast feed of announcements and quick results. The EOD version is delivered by SFTP and includes Announcements, Quick Results, Company Results (financials plus segments) and Shareholding pattern ([tech spec v2.4, 19-Dec-2024](https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Download_Technical_Specification_Corporate_Data.pdf)). Price: **₹10,60,000/yr (realtime) and ₹5,00,000/yr per site (EOD)**, excluding taxes, domestic, effective FY27 ([NSE pricing PDF, Mar-2026](https://nsearchives.nseindia.com//web/mediaattachment/2026-03/NSE_Pricing_file_-_Domestic_clients_20260309171343.pdf), downloaded and parsed). International: USD 17,500/yr ([PDF](https://nsearchives.nseindia.com//web/mediaattachment/2026-03/NSE_Pricing_file_-_International_clients_20260309171502.pdf)).

### 1.3 Annual reports and concall transcripts

**Primary: screener.in company page.** Use one GET per ticker, cache for a week, and read only the link lists.

**E. Coverage probe** [measured; 7 requests 7 s apart; all 200, about 0.3–0.5 s each]

| Ticker (type) | Concall rows | Rows with raw transcript | Last 4 quarters present? | Oldest transcript | AR links |
|---|---|---|---|---|---|
| HDFCBANK (large-cap bank) | 28 | 21 | Yes (Oct-26, Jul-26, Apr-26, Jan-26) | Apr-2022 | 15 |
| BEL (PSU) | 29 | 18 | Yes (Nov-26, Jul-26, May-26, Jan-26) | Jul-2022 | 15 |
| DEEPAKNTR (mid-cap chemical) | 41 | 24 | Yes (Nov-26, Aug-26, May-26, Feb-26) | Feb-2021 | 15 |
| SHAILY (small-cap) | 32 | 28 | Yes (Nov-26, Aug-26, May-26, Feb-26) | Mar-2018 | 15 |
| LGEINDIA (Oct-2025 IPO) | 5 | 4 | 3 of 4 now: the Nov-26 transcript is not yet posted (grey "Transcript" chip, PPT and audio present) | Nov-2025 | 1 |
| ATHERENERG (May-2025 IPO) | 7 | 7 | Yes (Oct-26, Aug-26, May-26, Feb-26) | May-2025 | 2 |
| KOKUYOCMLN (micro-cap) | **0** | 0 | No concalls at all | – | 15 |

- Each concall row has chips for `Transcript` (raw), `AI Summary` (screener's own), `PPT` and `REC`.
- Raw transcript links are `https://www.bseindia.com/stockinfo/AnnPdfOpen.aspx?Pname=<uuid>.pdf`. These issue one redirect to `https://www.bseindia.com/xml-data/corpfiling/AttachHis/<uuid>.pdf`. I tested HDFCBANK Q2 FY27: 200, 480 KB, **17 pages, 54k characters of clean text**.
- PPT links are often on company IR domains.
- AR links all point to `bseindia.com/xml-data/corpfiling/AttachHis/*.pdf`, labelled "from bse", with one "from web".
- Parsing hooks: `div.documents.concalls li` has the date in `div[style*="width: 74px"]` and the transcript in `a[title="Raw Transcript"]`. `div.documents.annual-reports li a` holds the annual reports.
- **Quarterly table** (`#quarters`): the last 4 columns are Dec-2025…**Sep-2026** (current). Rows are Sales, Expenses, Operating Profit, OPM %, Other Income, Interest, Depreciation, Profit before tax, Tax %, Net Profit, EPS. Banks have Revenue / Financing Profit / Gross and Net NPA % instead.

**Fallbacks**
- NSE `api/annual-reports?index=equities&symbol=X` ([NseIndiaApi `annual_reports`](https://github.com/BennyThadikaran/NseIndiaApi/blob/main/src/nse/NSE.py); nsepython `nse_annual_reports`). Files are `https://nsearchives.nseindia.com/annual_reports/AR_<id>_<SYM>_<FY>_...pdf`; older ones are `.zip`.
- `Annual_Reports.xml` RSS, which lists the last 20 filed. I downloaded one: VINEETLAB AR, 200, 1.58 MB.
- Transcripts also arrive in the announcements RSS under "Analysts/Institutional Investor Meet/Con. Call Updates", for example `…/corporate/PROJECTSEWA_10112026185513_Final_Transcript_EC_041126_signed.pdf`. Filtering on that SUBJECT plus "transcript" in the filename gives a screener-independent path.

**Pitfalls**
- Screener ToS restricts use to "personal, non-commercial transitory viewing". Use it only for link discovery in the prototype.
- Micro-caps often hold no calls.
- Recent IPOs have short history.
- Transcripts lag the call. LODR requires upload within 5 working days [unverified: from memory, June-2023 LODR amendment], and LGEINDIA shows the gap.
- Some transcripts are scanned.
- `robots.txt` disallows `/company/source/quarter/*`; do not hit that path.

### 1.4 Latest quarterly results

**Why the old endpoints are stale.** Since the SEBI integrated-filing circular (31-Dec-2024; [Business Standard](https://business-standard.com/markets/news/sebi-mandates-compliance-for-listed-entities-with-integrated-filing-125010100386_1.html), [India Briefing](https://www.india-briefing.com/news/sebi-introduces-integrated-filing-framework-for-listed-entities-35652.html/)), quarterly financials are filed as "Integrated Filing – Financials". The governance filing is due within 30 days; financials within 45 days (60 for Q4). This matches the earlier finding that `corporates-financial-results` stops around Jan-2025.

**Primary (official): Integrated Filing XBRL** [measured]
- New filings: `Integrated_Filing_Financials.xml` returned 20 items, the newest 18:58 today, e.g. Cochin Shipyard → `https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1755884_10112026065521_WEB.xml` (200, 80 KB).
- Per-symbol lookup: `GET https://www.nseindia.com/api/integrated-filing-results?type=Integrated%20Filing-%20Financials&symbol=X&period_ended=30-Sep-2026&page=1&size=20`. Record keys include `symbol, cmName, qe_Date, audited, consolidated, broadcast_Date, xbrl, ixbrl` ([jugaad-data live.py v0.37.0](https://github.com/jugaad-py/jugaad-data/blob/master/jugaad_data/nse/live.py)). I did not call it myself; it sits behind the www.nseindia.com cookie wall.
- Parsed values (COCHINSHIP, Consolidated, Unaudited, context `OneD` = 2026-07-01..09-30):

  | Tag | Value |
  |---|---|
  | RevenueFromOperations | ₹12,491,909,000 |
  | OtherIncome | ₹826,208,000 |
  | Expenses | ₹12,567,158,000 |
  | FinanceCosts | ₹265,159,000 |
  | DepreciationDepletionAndAmortisationExpense | ₹319,507,000 |
  | ProfitBeforeTax | ₹750,959,000 |
  | TaxExpense | ₹213,092,000 |
  | ProfitLossForPeriod | ₹537,708,000 |

  Also present: `ReportingQuarter`, `NatureOfReportStandaloneConsolidated`, YTD context `FourD`, balance-sheet instant contexts, and segment tags (`SegmentRevenue`, `SegmentProfitBeforeTax`, …).
- **EBITDA** = PBT + FinanceCosts + D&A − OtherIncome (screener-style "Operating Profit"). Here that is ≈ ₹51.0 cr.
- **The file has only current-quarter and YTD contexts, with no prior-year comparatives.** For YoY and QoQ, store each quarter's filing or fetch the earlier one.

**Fallback:** screener `#quarters` table (current), then yfinance `quarterly_income_stmt`.

**Pitfalls**
- Companies file both standalone and consolidated versions, so pick consistently.
- Banks, NBFCs and insurers use different taxonomies (no EBITDA; NII, provisions).
- Values are in absolute rupees.
- Revised filings exist (`revised_Date`).
- `INDAS` vs `NONINDAS` file variants.

**Licensed:** NSE Corporate Data ("Company Financial Result" and "Segment Wise Result" structures); Accord ACE Equity, Capitaline, CMIE Prowess [unverified pricing; contact sales].

### 1.5 People data

**Primary: the CIM XBRL** [measured]. RSS item "Huhtamaki India … Change in Directors/KMP/SMP/Auditor/RTA" links to `https://nsearchives.nseindia.com/corporate/xbrl/CIM_867_WebXMLFile_20261110_185820544.xml` (200, 5.3 KB). Fields:
- `NSESymbol, ISIN, TypeOfChange (Appointment), CategoryForChange (Senior Management Personnel), DesignationOfDesignatedPerson, NameOfDesignatedPerson (Leyton Bright), EffectiveDateOfReasonOfChange`
- **`BriefProfile`** (multi-paragraph bio: "joined Huhtamaki UAE & Egypt… worked with Amcor for 19 years…").
- This removes the need for PDF parsing for most appointments.

**Fallback:** the announcement PDF text for older or non-XBRL filings.

**Board interlocks**
- MCA21 V3 has no public API. Director master data is behind a captcha ([surepass FAQ](https://surepass.io/faq/how-to-check-the-director-master-data-in-mca/)), so do not automate it.
- Prototype option: the annual-report Corporate Governance section lists each director's other listed-entity directorships (a LODR requirement [unverified wording]). Extract it with an LLM from the AR PDF.
- The Integrated Filing (Governance) XBRL may carry board composition with DIN [unverified]. jugaad-data `integrated_filing_governance()` exposes it.
- Licensed: Probe42 (usage-based, no public price; [fintegrationfs](https://www.fintegrationfs.com/fintechapis/probe42-api)), Surepass MCA API, Tofler.

---

## 2. A — Open-source library survey

Metadata comes from the GitHub API, measured 2026-11-10.

| Library | Last push | Stars / open issues | Status | Transport | Corporate endpoints of note |
|---|---|---|---|---|---|
| [aeron7/nsepython](https://github.com/aeron7/nsepython) | 2026-10-07 | 373 / 5 | Active. Recent "fix regressions", added `nse_annual_reports`, NSE MCP wrappers. Open: #75 (Apr-2026, several functions broken), #79, #80 | **curl_cffi Chrome TLS impersonation** to get past "Akamai Bot Manager" (comment in rahu.py) | `api/annual-reports`, `corporates-financial-results`, `results-comparision`, `event-calendar`, `top-corp-info`, `quote-equity`, `historicalOR/*`, archives `sec_bhavdata_full_`, `bulk.csv`/`block.csv`; MCP servers `mcp.nseindia.in/{bhavcopy/cm,cmmkt}/mcp` |
| [jugaad-py/jugaad-data](https://github.com/jugaad-py/jugaad-data) | 2026-10-22 (v0.37.0) | 592 / 27 | Active. #142 integrated filing financials and governance (v0.36), #143 corporate actions; #136 open (F&O bhavcopy) | requests session plus cookies. **BSELive hard-codes spoofed Chrome headers** ("BSE returns 403 unless…"). Do not use against BSE | `corporate-announcements`, `corporates-corporateActions`, **`integrated-filing-results`**, `historicalOR/generateSecurityWiseHistoricalData`, `api/reports` (daily reports), BSE `AnnSubCategoryGetData` |
| [vsjha18/nsetools](https://github.com/vsjha18/nsetools) | 2025-03-18 | 910 / 3 | **Stale.** #155 (May-2026) `get_stocks_in_index` broken, a fix PR #156 is open; quotes only | requests | `quote-equity`, EQUITY_L.csv; no corporate data |
| [BennyThadikaran/NseIndiaApi](https://github.com/BennyThadikaran/NseIndiaApi) | 2026-10-30 (v5.1.1) | 162 / 0 | **Most actively maintained.** Issues answered within days (#33 actions empty, closed 1-Nov; #30 financial_results added Jul-2026; #9 server timeouts fixed) | httpx with throttling (pyrate-limiter), retries; documents server deployment | `corporate-announcements`, `corporate-board-meetings`, `corporates-corporateActions`, `annual-reports`, `corporates-financial-results`, `results-comparision`, `corporate-share-holdings-master`, `historicalOR/bulk-block-short-deals`; archives: UDiFF/legacy bhavcopy, `sec_bhavdata_full_`, `ind_close_all_`, `sec_list_`, `PR{ddmmyy}.zip`, `NSE_CM_security_*.csv.gz` |
| [RuchiTanmay/nselib](https://github.com/RuchiTanmay/nselib) | 2026-07-18 | 181 / 7 | Moderately active. #126 SME bhavcopy filename bug | requests | `bhav_copy_equities` (`content/cm/BhavCopy_NSE_CM_0_0_0_`), `bhav_copy_with_delivery`, `financial_results_for_equity`, `corporate_actions_for_equity`, `event_calendar_for_equity`, index constituents CSVs |
| OpenBB | 2026-11-10 (GitHub API redirect resolved to `openbq-org/OpenBB`, 75k stars) | – | **No India provider.** `openbb_platform/providers` = bls, cboe, cftc, deribit, ecb, eia, famafrench, federal_reserve, finra, fred, government_us, imf, jodi, nasdaq, oecd, sec, tmx. Indian tickers only through the yfinance extension (`.NS`) ([docs](https://docs.openbb.co/platform/faqs/data_providers)) | – | none |
| Extra: [Prasad1612/NseKit](https://github.com/Prasad1612/NseKit) | 2026-10-29 (PyPI 0.0.48) | 3 stars | Small project | – | **`corporates-pit`** (insider trading), `corporates-pit-gg`, `corporate-voting-results`, `corporate-further-issues-{qip,pref,ri}`, `corporate-bussiness-sustainabilitiy`, `eqsurvactions` |
| Extra: [hi-imcodeman/stock-nse-india](https://github.com/hi-imcodeman/stock-nse-india) (npm 1.4.0, May-2026) | – | – | Node, has MCP server | – | equity/index data |

**Coverage gaps.** None of the six requested libraries covers **insider trading (PIT), pledge/encumbrance or credit ratings**. I grepped all the clones and found zero hits. Use the RSS feeds (InsiderTrading, Sast_*) instead, or NseKit's `api/corporates-pit?index=equities&symbol=X|from_date&to_date`. Credit ratings appear only as an announcement SUBJECT and on screener's "Credit ratings" panel. NSE pledge API names such as `corporate-pledgedata` are [unverified].

**Library-choice advice:** read NseIndiaApi for endpoint shapes and use its archive (bhavcopy) functions. Copy jugaad's `integrated-filing-results` parameters. Avoid nsepython's curl_cffi impersonation path and jugaad's BSELive in anything you would show a regulated firm.

---

## 3. B — Official sources

- **RSS:** exists and works (section 1.2). This is the best free announcement source.
- **Bhavcopy:** publicly downloadable (section 1.1). The `www.nseindia.com/all-reports` page lists the daily reports. `api/daily-reports` exposes file metadata (jugaad / NseIndiaApi `fetch_daily_reports_file_metadata`).
- **NSE MCP servers:** official, no auth, 5-year EOD plus live snapshot (section 1.1).
- **Licensed NSE products** (NSE Data & Analytics, formerly DotEx): Corporate Data (realtime multicast; EOD by SFTP after about 20:00 IST), EOD CM data, historical data. Prices are in section 4.
- **NSE Market Lens:** a new beta NSE screener for more than 2,000 stocks ([FPJ](https://www.freepressjournal.in/business/nse-market-lens-explained-how-can-investors-screen-over-2000-stocks)). One public repo states it obtained NSE permission for educational use ([nextrade PR #9](https://github.com/pallavidhadda/nextrade/pull/9)). That is a reminder that NSE does grant permissions on request.
- **BSE:** `bseindia.com/market_data_products.html` and the Terms/Disclaimer pages returned **403** to WebFetch. Not reviewed. The BSE announcements API is unavailable (earlier measurement). BSE PDF attachments (`xml-data/corpfiling/AttachHis`) do download (200 today). Search snippets say BSE sells EOD corporate data (announcements, shareholding, results, actions, board meetings) and lists C-MOTS and Accord as vendors [unverified, snippet only].

---

## 4. C — Terms of use and licensing

**NSE Terms of Use** ([static/nse-terms-of-use](https://www.nseindia.com/static/nse-terms-of-use), fetched, 200). Key clauses, verbatim:
- "User is prohibited to conduct any systematic or automated data collection activities (including scraping, data mining, data extraction and data harvesting) on or in relation to our Website / Mobile Application."
- Content "shall not be copied, modified, … reproduced, … stored …, disseminated, distributed, displayed … published, hyperlinked, sold … without prior written permission of NSE. **Unless the information or Content is available for download**, not to aggregate, copy or duplicate in any manner…"
- Data may not be used "for any gaming, virtual trading or simulation activities". That matters if FINN ever adds paper trading.

**NSE robots.txt:** `User-agent: * Allow: / Disallow: /market-data-test`. `nsearchives` has no robots.txt (404).

**NSE Data Policy** ([nse-data-policy](https://www.nseindia.com/static/market-data/nse-data-policy), fetched):
- Subscribers may not redistribute except under the Relevant Agreement.
- Commercial access is priced by the Board.
- "The Board of NSE Data may also consider introducing **reduced fee arrangements or waivers for Non-Commercial Users**" (academia, not-for-profit, researchers, students).

**screener.in**
- [robots.txt](https://www.screener.in/robots.txt) allows company pages. It disallows `/user/*`, query-param variants (`?q=`, `?sort=`, `?limit=`, `?page=`), `/screens/*?order=`, and `/company/source/quarter/*`.
- [Terms](https://www.screener.in/guides/terms/): "Permission is granted to use the materials … for **personal, non-commercial transitory viewing only** … you may not: modify or copy the materials; use the materials for any commercial purpose, or for any public display … or 'mirror' the materials."

**yfinance / Yahoo:** "intended for personal use only" (README).

**What is prudent for this non-commercial prototype**
1. Prefer files NSE publishes for download (bhavcopy, RSS, XBRL and PDF attachments on `nsearchives`) and the official MCP server. These fit the ToS "available for download" carve-out better than `www.nseindia.com/api/*` JSON, which the anti-scraping clause targets and which sits behind Akamai Bot Manager.
2. Send an honest UA with contact details. Use low frequency (RSS every 5–15 min, bhavcopy once a day) and cache everything. Never impersonate a browser and never rotate IPs.
3. Use screener only to discover links to exchange PDFs (one request per ticker per week). Do not display screener's tables or AI summaries in a shared app. Compute the numbers from exchange XBRL instead.
4. Do not redistribute raw data publicly. Keep the demo private and label it "for evaluation".

**What a real deployment would license**

| Vendor | What | Public price |
|---|---|---|
| NSE Data & Analytics | Corporate Data (realtime announcements + quick results; EOD adds company results, segment results, shareholding) | **₹10,60,000/yr** realtime; **₹5,00,000/yr/site** EOD Corporate; EOD CM prices ₹1,00,000/yr per site per medium; Historical trade data ₹1,10,000/yr (domestic, excluding taxes) — [pricing PDF](https://nsearchives.nseindia.com//web/mediaattachment/2026-03/NSE_Pricing_file_-_Domestic_clients_20260309171343.pdf). International Corporate Data USD 17,500/yr |
| BSE | Corporate announcement API / EOD corporate data | ~₹9 lakh + GST/yr (forum report, Jan-2025, [tradingqna](https://tradingqna.com/t/corporate-announcement-data-api/178154)) [unverified] |
| Ticker Plant | Realtime BSE/NSE announcement API | ₹2.5 lakh + GST quoted Jan-2025; ">₹3 lakh" Jun-2025 (same forum) [unverified] |
| TrueData | Market data plus "Corporate Data API" (financials, shareholding), live announcements in its workspace | On request ([truedata.in/market-data-apis](https://truedata.in/market-data-apis)) |
| Accord Fintech | Authorised NSE/BSE vendor; ACE Equity fundamentals; FTP/API feeds including announcements | On request ([fintegrationfs summary](https://www.fintegrationfs.com/fintechapis/accord-fintech)) |
| C-MOTS Infotech | BSE-listed data provider (fundamentals, announcements) | On request [unverified] |
| Global Datafeeds | Authorised realtime/EOD market-data vendor | On request; nothing found on fundamentals [unverified] |
| Trendlyne | Consumer plans; separate MCP-server subscription ([help](https://help.trendlyne.com/support/solutions/articles/84000399413)) | Not published |
| Tijori | Fundamentals, concall search | Nothing found |
| Tapetide / IndianAPI.in / EODHD | Low-cost APIs: ₹499/mo; ₹399–3,999/mo; USD 59.99/mo fundamentals ([comparison](https://tapetide.com/compare/best-api-indian-stock-market-data), written by Tapetide itself, so biased) | as listed |
| Probe42 / Surepass | MCA company and director data API | Usage-based, not published |

---

## 5. D — Hosting implications (evidence only; no evasion tested)

- **NSE `www.nseindia.com` is fronted by Akamai Bot Manager with TLS fingerprinting.** nsepython says "a plain `requests.Session()` … gets blocked outright (HTTP 403 on the homepage itself) … not geography" and that plain urllib "hangs/times out against nsearchives" ([rahu.py](https://github.com/aeron7/nsepython/blob/master/nsepython/rahu.py)). My own probe matches: curl's default UA was reset on `nsearchives`, and an honest UA got 200.
- **Cloud hosts:**
  - [NseIndiaApi #9](https://github.com/BennyThadikaran/NseIndiaApi/issues/9) (Mar-2025): read timeouts from AWS EC2, Azure and GCP. curl worked from EC2 while Python requests failed, which points at the client or HTTP fingerprint rather than an IP ban. Closed by PR #10, "support connections from server environments".
  - Older reports: [nsetools #83](https://github.com/vsjha18/nsetools/issues/83) (AWS, 2020), [#118](https://github.com/vsjha18/nsetools/issues/118) (AWS Linux, 2021), [nsepy #220](https://github.com/swapniljariwala/nsepy/issues/220) (cloud, 2022), [stock-market-india #15](https://github.com/maanavshah/stock-market-india/issues/15) (Vercel/DigitalOcean/AWS), [unofficed forum](https://forum.unofficed.com/t/update-nsepython-not-working-in-aws-google-cloud-and-webservers/670) (Lambda/GCF timeouts).
  - nsepython maintains a separate "server edition" for AWS/Colab/DigitalOcean, which implies the default path fails there.
- **Screener:** I found no reports of IP blocking. The one 2026 "can't reach Screener in cloud" issue ([portfolio-copilot #15](https://github.com/arunendapally/portfolio-copilot/issues/15)) was an agent-permission problem, not a block.
- **Yahoo:** frequent 429s on shared cloud IPs in 2025 (links in 1.1).
- **Not tested:** I made no requests from cloud, GitHub Actions or Vercel IPs. Static `nsearchives` files and the MCP server use the same Akamai edge. Whether they are lenient from datacenter IPs is **unknown**.

**Implications**
1. Run ingestion as a scheduled job, not in request handlers. Cache in your own DB and serve the UI from the cache.
2. Use only `nsearchives` files, RSS and the MCP server, which need no cookie dance. Avoid `www.nseindia.com/api` in production.
3. If cloud fetches fail, run the ingestion job from a laptop or office machine for the demo and push the results to the hosted DB. A licensed feed is the real fix. Rotating proxies or impersonation is not acceptable.
4. Prefer an India region (ap-south-1) [unverified benefit].

---

## 6. F — Annual reports: location, size, MD&A extraction

- **Location:** screener AR links go to BSE `xml-data/corpfiling/AttachHis/<uuid>.pdf`. NSE equivalents are `nsearchives.nseindia.com/annual_reports/AR_<id>_<SYM>_<FY>_<...>.pdf`, with `.zip` for older years.
- **Size:**
  - DEEPAKNTR FY26 Integrated Report: **16.7 MB, 462 pages**. pypdf extracts 1.38 M characters with only 2 near-empty pages, in 8.8 s.
  - VINEETLAB FY26 (micro-cap): 1.6 MB, 131 pages.
  - Large-cap ARs are often 300–500 pages and 10–30 MB [unverified generalisation from 2 samples].
- **MD&A:**
  - Deepak's table of contents is on PDF p.3 and lists "Statutory Reports 129 / Financial Statements 327". The MD&A text ("Global economic scenario…") starts at **PDF p.133**.
  - A regex for "Management Discussion and Analysis" also hits the TOC and running headers. Locate the section from TOC page numbers plus the PDF page offset (+3 here), then end it at the next statutory heading ("Board's Report", "Corporate Governance Report", "Business Responsibility").
  - The PDF outline is almost empty in the large AR (2 entries) but useful in the small one (29 entries).
- **Feasibility:** good for text-layer PDFs. Plan for an OCR fallback for scanned micro-cap ARs.
  - MD&A is typically 10–30 pages, about 40–120k characters. Send that to the LLM rather than the whole AR.
  - Cache the extracted section per (symbol, FY). ARs change once a year.

---

## 7. Risk list

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | NSE ToS forbids automated collection; the `api/*` JSON endpoints are the clearest violation | High (if used) | Legal/reputational with an investment-firm client | Use downloadable files, RSS and the official MCP server; license NSE Corporate Data for production |
| 2 | Akamai blocks or resets requests, especially from datacenter IPs | Medium–High | Ingestion outage | Honest UA, low rate, scheduled job, cache; offline ingestion fallback for the demo; licensed feed |
| 3 | RSS window is about 1 day (announcements) or the last 20 items (some feeds), so items are missed if the poller is down | Medium | Gaps in the event timeline | Poll every 5–15 min; backfill via `api/corporate-announcements` or a licensed EOD Corporate Data file |
| 4 | Endpoint and format drift: UDiFF switch, financial-results → integrated filing, `PIT V2.0` schema dated 30-04-2026, nsetools breakage | High (historically) | Silent nulls | Schema validation, alerting, contract tests on daily samples |
| 5 | Screener ToS ("personal, non-commercial"); HTML changes | Medium | Loss of transcript/AR discovery | Link discovery only; parallel path via the NSE "Con. Call Updates" RSS and NSE `annual-reports` |
| 6 | Transcript lag (≈5 working days) and missing calls for micro-caps | Certain | Incomplete coverage | Show "transcript pending"; fall back to PPT and press release |
| 7 | XBRL ambiguity: standalone vs consolidated, bank taxonomy, revisions, no comparatives in a file | High | Wrong numbers shown | Prefer consolidated; per-sector extractor; keep a quarter history; reconcile against screener during development |
| 8 | Unadjusted bhavcopy prices around splits and bonuses | Medium | Bad charts and returns | Apply MCP `adjustmentFactor` or self-maintained action tables |
| 9 | Company name vs symbol mapping in RSS titles | Medium | Mis-attributed events | Map with EQUITY_L.csv plus the XBRL `NSESymbol`/ISIN |
| 10 | BSE unavailable (API Access Denied, ToS pages 403) | Certain | BSE-only filers missing | Accept for the prototype; license for production |
| 11 | yfinance: personal-use terms, Chrome impersonation, cloud 429s | Medium | Fallback fails or legal concern | Emergency fallback only |
| 12 | MCA director data has no public API and a captcha | Certain | No board-interlock graph | Use AR corporate-governance sections; license Probe42/Surepass |
| 13 | NSE MCP terms unpublished; service is new | Medium | Could change or be withdrawn | Treat as fallback; keep bhavcopy as the source of record |
| 14 | Holiday and special-session handling (10-Nov, 24-Nov, Sunday Muhurat) | Certain | False "missing data" alerts | Use the holiday calendar (`api/holiday-master` or a static list) |

---

## 8. Probe log (requests made today)

| Target | Result |
|---|---|
| GitHub API (repo metadata, commits, issues, search) | OK |
| `mcp.nseindia.in/bhavcopy/cm/mcp`: initialize, notifications/initialized, tools/list, 3 tool calls | All 200/202 |
| `nsearchives` bhavcopy 20261109 | First attempt (curl default UA) reset; second attempt (honest UA) 200 |
| `nsearchives` bhavcopy 20261110 | 404 (holiday) |
| `nsearchives` `sec_bhavdata_full_09112026.csv` | 200 |
| `nsearchives` RSS: Online_announcements, Integrated_Filing_Financials, InsiderTrading, Sast_ReasonForEncumbrance, Board_Meetings, Financial_Results, Annual_Reports, Corporate_action, Corporate_Governance | All 200 |
| `nsearchives` XBRL: CIM, Integrated Filing, PIT | 200 |
| `nsearchives` NSE pricing PDF, Corporate Data spec PDF, one NSE AR PDF | 200 |
| `www.nseindia.com`: rss-feed page, robots.txt, terms-of-use (404), static/nse-terms-of-use, data-policy | 200 except as noted. WebFetch to www.nseindia.com timed out twice (nse-mcp, rss-feed) |
| `screener.in`: robots.txt, terms, 7 company pages | All 200 |
| `bseindia.com`: AR PDF 200; transcript PDF 200 after 1 redirect | OK |
| `bseindia.com` disclaimer and terms pages (WebFetch) | **403**, not retried |
| Yahoo (yfinance) | DNS failure inside the sandbox, not retried |

Local files: `data-probe/bhav/`, `data-probe/rss/` (feeds plus XBRL samples), `data-probe/nsemcp/`, `data-probe/screener/` (pages, robots, terms), `data-probe/ar/` (2 ARs and 1 transcript), `data-probe/pricing/`, `data-probe/repos/`. The screener parser is `research/parse_screener.py` and the AR probe is `research/ar_probe.py`.


---

## 9. Completion addendum (written by the main session after the agent was stopped)

Each question in the agent's brief, checked against this report:

| Brief Q | Covered in | Status |
|---|---|---|
| A. Open-source libraries | §2 | Done. **Item the agent was stopped on:** jugaad-data `integrated_filing_financials()` (live.py L290) accepts `period_ended='all'`/date and `from_date/to_date`, so *all past quarters* of results XBRL are listable. But it calls `www.nseindia.com/api/integrated-filing-results` with hard-coded spoofed Chrome headers (live.py L35–49: fake `User-Agent`, `Sec-CH-UA`). That is excluded by our ground rules and NSE ToS. `corporate_actions()` (L473) hits `corporates-corporateActions`; same transport, same exclusion. Corporate actions come from the RSS `Corporate_action.xml` and NSE MCP `get_corporate_actions` instead. → D-010 stands: QoQ/YoY from the filing's own PDF table, checked against XBRL. |
| B. Official sources | §3, §1.2 | Done |
| C. Terms of use / licensing | §4 | Done, except BSE terms pages (403, not retried). That is acceptable because we use BSE only for PDF attachments linked from screener. |
| D. Cloud-IP evidence | §5 | Done. Plus a live test: BSE `AnnPdfOpen` PDF → **403 from datacenter** (WebFetch, 10 Nov), see E12. |
| E. Transcript coverage | §1.3 | Done (7 tickers). Independently re-parsed from the saved HTML with the same result (E10). |
| F. Annual reports | §6 | Done |
| G. EOD comparison | §1.1 | Done |

**[unverified] items closed:**
- *Litigation / regulatory SUBJECT strings* (§1.2 mapping) are now **verified** from 5,756 real filings (3–7 Nov). The exact values are: "Pendency of Litigation(s)/dispute(s) or the outcome impacting the Company" (10), "Action(s) taken or orders passed" (16), "Action(s) initiated or orders passed" (9), "Corporate Insolvency Resolution Process" (18), "Fraud/Default/Arrest" (1), "Defaults on Payment of Interest/Principal" (1), "Initiation of Forensic Audit" (1), "Granting/withdrawal/surrender/cancellation/suspension of key licenses/ regulatory approvals" (2), "Rumour Verification - Regulation 30(11)" (1). Also M&A: "Acquisition" (41), "Amalgamation/Merger" (9), "Scheme of Arrangement" (4), "Demerger" (1). Credit ratings are split into "Credit Rating" / "- Revision" / "- New" / "- Others". The full list of 89 values is in `nse-desc-categories-3-7nov2026.txt`.
- *Transcript deadline* (§1.3 pitfall): transcripts must be on the company website and filed with exchanges **within 5 working days** of the call. The audio recording is due within 24 h or before the next trading day, whichever is earlier (LODR Reg 46(2)(oa)). Consistent across secondary sources: [vinodkothari.com](https://vinodkothari.com/2021/07/step-by-step-guide-for-disclosure-for-analysts-investors-meet/), [money9](https://www.money9.com/news/equities/sebi-asks-listed-cos-to-make-analyst-call-recording-public-in-24-hours-19397.html), [NSE guidance note](https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Guidance%20note%20on%20disclosures%20pertaining%20to%20analysts%2C%20institutional%20investors%20meet%20and%20best%20practices.pdf). The primary SEBI text has not been read.

**Still unverified, and why it doesn't block the build:**
- UDiFF switch date: irrelevant, since we only need current files.
- NSE pledge API name: pledges come from `Sast_ReasonForEncumbrance.xml` + "Disclosure under SEBI Takeover Regulations".
- Whether Integrated Filing (Governance) XBRL carries director DINs: not needed, because the prototype network is synthetic.
- NSE MCP terms: used only as a fallback.
