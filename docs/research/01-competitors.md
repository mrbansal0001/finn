# FINN: Competitive Landscape (Push / Pull / Network)

Research date: 2026-11-10. Sources were checked live with web search and fetch. Claims I could not confirm against a live source are tagged **[unverified]**. Claims that come from a vendor about itself are tagged **(vendor claim)**. Many Indian price and feature comparison pages are published by competitors (Tapetide, Multibagg, Strike.money, AllMind), so I note that where it matters.

---

## 0. TL;DR

1. **Push in India is crowded and the category is commoditised.** At least eight products now send AI-summarised exchange filings to WhatsApp within seconds to minutes: Tijori Alerts, Stox AI (BSE feed tie-up), EquiSense, myAlerts.in, Moneycontrol Super Pro, Groww, Multibagg and Trendlyne. Nearly all of them follow the same pattern: **one filing, one ping, one summary**. None does what the brief asks for: a **windowed, ranked digest across the portfolio, with routine items collapsed and the user's own relationships attached**. The thing to beat is the ping, not the summary.
2. **Pull with "promised vs delivered" now exists in India, but only in rough form.** The closest products are Tijori's *Management Credibility Report* and Concall Monitor "consistency check", ConCallIQ ("tracks whether management delivers on its promises"), and ArthaLens (guidance extraction). None I could verify shows a **clean, auditable, quarter-by-quarter ledger** (guided figure, date, basis, actual, verdict, citation to page). Globally, Daloopa's guidance-tracker logic (pair each guidance item with the next period's actual, compute deltas and beat rate, label management conservative or aggressive) is the reference design.
3. **Network intelligence exists only for private-markets and sales teams** (Affinity, 4Degrees, Introhive, LinkedIn TeamLink) and for individuals (Happenstance, Mesh/ex-Clay, Dex, Folk). **No product links a personal graph to listed-company events, and none does so for Indian markets.** This is the open space.
4. **India has data that makes the network layer cheap and grounded:** (a) SEBI LODR Reg 30 KMP and director appointment filings must carry a *brief profile* of the appointee, so the "incoming MD bio" can be quoted from the filing itself; (b) MCA DIN-keyed directorship data (mirrored by Tofler and Zauba) gives a free second-degree graph through shared boards; (c) IIT/IIM and Big-4/MNC alumni overlap is dense among Indian management.
5. **Mobile-first depth is still missing.** Screener.in, the research standard for Indian retail, **still has no native app** (its support page says so). Depth tools are desktop-first. Mobile tools are shallow (broker apps, WhatsApp pings).
6. **LLM cost is a visible constraint for competitors.** Screener charges per token (Premium includes ₹500 of credits, roughly ₹10–30 per answer per a competitor's estimate). Trendlyne meters "MarketMind AI credits" (7 to 20 a month on mid tiers). Multibagg users complain that the free tier allows too few prompts. FINN can win the efficiency bonus by **precomputing deterministically** (financial deltas from XBRL, filing classification by category code) and spending LLM tokens only on guidance extraction (once per transcript, cached) and on the short "why it matters" lines.

---

## 1. Landscape map

| Product | Market | Push | Pull (primary-source research) | Network | Interaction model | Mobile-first? | Price (latest seen) |
|---|---|---|---|---|---|---|---|
| **Screener.in** | India retail/pro | Watchlist feed of announcements; 10 (free) / 800 (premium) stock alerts | Best free fundamentals; AR + concall links; AI summaries of transcripts and ARs; Screener AI chat over filings | – | Web tables + feed + chat | **No native app** | Premium ₹4,999/yr |
| **Trendlyne** | India | **Alpha Alerts** (one alert for a group of stocks: price, volume shocker, results with rising/falling rev/profit YoY/QoQ, insider/SAST >1%); hourly/daily email digests; WhatsApp | AI concall summaries; MarketMind AI (credits); Portfolio AI | – | Dense dashboards, many tabs | App exists; dense | GuruQ ₹2,990/yr … PRO PLUS ₹11,900/yr |
| **Tijori Finance** | India | **Tijori Alerts** (WhatsApp AI summary in "20–60 s"); powers **Zerodha Console Timeline**; **Radar** (user-defined risk monitors) | **Concall Monitor** (summary + "consistency check"); **Management Credibility Report**; Risk Probe; Atlas Q&A grounded in filings | – | Feed + reports-on-demand + chat | Mostly web/WhatsApp | ₹330/mo or ₹3,500/yr |
| **Zerodha Console Timeline** (Tijori inside) | India broker | Holdings-only timeline with AI result summaries (revenue, profit, drivers, QoQ change) | Stock Insights widget | – | Feed inside the broker | Yes (Kite) | Free to Zerodha clients |
| **Groww (GR-1)** | India broker | WhatsApp alerts (results, concall, orders, capex, bulk deals); GR-1 Insights cards (750 stocks) | GR-1 chat over holdings + news | – | Ranked insight cards + chat | Yes | Free (beta, launched 23 Oct 2026) |
| **Moneycontrol Super Pro** | India media | AI WhatsApp alerts on announcements | Editorial research | – | News site + alerts | App | Super PRO ₹2,499/yr |
| **EquiSense** | India AI-native | WhatsApp alerts "minutes after filing"; "Glance" result cards tagged Positive/Neutral/Negative | Plain-English filing summaries; Kavach governance score; concall summaries; MCP server | – | Card feed + WhatsApp | Web (no native app) | "Free forever" + paid tiers |
| **Stox AI** | India | WhatsApp AI summary + official BSE PDF "within seconds" (BSE feed tie-up) | – | – | WhatsApp only | WhatsApp | 15-day trial; paid [price unverified] |
| **myAlerts.in** | India | Free WhatsApp/email alerts; concall summary PDFs; BSE only | – | – | WhatsApp/email | No app | Free |
| **Multibagg AI** | India AI-native | WhatsApp price/event alerts; "bite-sized" sentiment-tagged timeline | Ask Iris (filings-grounded Q&A); Concall Monitor; Earnings tracker | – | Chat + timeline | Web + apps (listed) | Freemium |
| **ConCallIQ / ArthaLens / Sharenox / Dhanarthi / Reports Radar** | India long tail | Minimal | Concall summaries; ConCallIQ and ArthaLens claim promise/guidance tracking | – | Web pages | No | Mostly free |
| **Tickertape** | India | Basic/Pro alerts | Scorecards, red flags, Portfolio AI; MCP | – | Mobile-friendly | Yes | Pro ₹2,999/yr |
| **StockEdge** | India | Announcements feed, Edge Insights | Edge Reports (sentiment −1..+1) | – | App-first | Yes | ₹1,499–11,994/yr |
| **MarketsMojo** | India | Smart Alerts (price, score changes) | Mojo Score (100-pt, rule-based) | – | App | Yes | ₹9,999 / 14 mo |
| **Finology Ticker / Value Research / Equitymaster** | India | Little or none | Editorial and fundamentals; no notable AI product found | – | Web | Weak | ₹299/mo; VR Stock Advisor ₹9,990/yr |
| **NSE/BSE official** | India | NSE RSS (announcements); BSE app watchlist; no official announcement push found | Raw filings (version of record) | – | Lists | BSE app | Free |
| **AceEquity / Capitaline / CMIE Prowess** | India institutional | – | Deep historical databases, Excel add-ins | – | Desktop/Excel | No | ~₹1.7 lakh/yr for Ace+Capitaline [forum claim, unverified] |
| **Perplexity Finance** | Global incl. India | – | NSE/BSE quotes, live Indian concall transcripts, earnings calendar (Aug 2025) | – | Answer engine | Yes | Free / Pro |
| **AlphaSense (+Tegus)** | Global institutional | Real-time/daily/weekly alerts, watchlists, Sentiment Indices (Jun 2026) | Smart Summaries with exact-location citations; sentiment colour-coding; Generative Grid; Deep Research; 300k+ expert transcripts | Expert calls (Tegus), AI-led expert calls | Search + dashboards + agent | App (iOS/Android) | Enterprise ($10k+ per seat) [unverified] |
| **Bloomberg** | Global institutional | ALRT/news alerts [unverified as named]; AI 3-bullet news summaries (Jan 2025) | AI earnings-call summaries (Jan 2024), Document Insights (Apr 2025), ASKB [secondary source] | – | Terminal | Bloomberg Anywhere | ~$30k/yr [unverified] |
| **Quartr** | Global | Live-call alerts, keyword alerts, watchlist feed | First-party IR only: live audio + real-time transcript, slides, AI chat with source tracing | – | Mobile-first IR library | **Yes (free mobile)** | Free mobile; Pro paid |
| **Fiscal.ai (ex-FinChat)** | Global retail/pro | – | KPIs/segments for 100k+ cos, Copilot, click-through to filings (Enterprise, US) | – | Terminal-lite + chat | Web | From ~$24–49/mo |
| **Daloopa** | Global institutional | – | Actuals/KPIs/guidance into Excel with source links; open guidance-tracker skill | – | Excel/API/MCP | No | Enterprise |
| **Hebbia** | Global institutional | – | **Matrix**: documents × questions grid, cited cells | – | Spreadsheet-grid agent | No | Enterprise |
| **Rogo (Felix)** | Banks/funds | Scheduled monitoring by email (May 2026) | Agent producing decks, models, sourced research | Rogo Intelligence (institutional memory) | **Email-native agent** | – | Enterprise; $160M Series D (Apr 2026) |
| **Aiera** | Institutional | Watchlist/topic real-time alerts | Event summaries moments after calls, topic + sentiment, citations | – | Event dashboard | – | Enterprise |
| **Brightwave, Samaya, LinqAlpha, Boosted.ai, Fintool, Captide** | Institutional | Boosted signal monitoring | Research agents with citations | Samaya + Third Bridge partnership (Jan 2026) | Agent/chat | – | Enterprise; Fintool reportedly acquired by Microsoft (Apr 2026, competitor-sourced); Captide acquired by Model ML (Feb 2026) |
| **Benzinga Pro** | US traders | Filtered newsfeed + squawk; AI summaries in Essential tier | – | – | Terminal feed | Partial | $37–197/mo |
| **Particle** | Consumer news | – | – | – | Story clusters; "Opposite Sides"; ELI5 / 5Ws modes | Yes | Free |
| **Affinity** | PE/VC | Strength-drop triggers | – | **Relationship strength from email/calendar metadata; ranked "who knows them"** | CRM + browser sidebar | App | Enterprise |
| **4Degrees / Introhive** | Deal teams / pro services | – | – | Network strength, warm paths | CRM layer | – | $50k–150k/yr for Introhive [buyer-guide estimate] |
| **LinkedIn Sales Navigator** | Sales | Job-change alerts | – | **TeamLink, Best Path In, Relationship Explorer** | Search filters | App | Advanced tiers |
| **Happenstance** | Individuals/teams | – | – | **Natural-language search over your Gmail/LinkedIn/X/calendar network**; mutual connections | Search box + iPhone app + Slack bot + MCP | Yes | Pro $24–30/mo |
| **Mesh (ex-Clay.earth)** | Individuals | Home feed: job changes, news mentions, birthdays | – | Auto-merged contacts (email, LinkedIn, WhatsApp, iMessage), Nexus AI, Reconnect | Feed + search | Yes | Free / Pro $10/mo |
| **Dex / Folk** | Individuals/SMB | Job-change alerts / follow-up assistant | – | Keep-in-touch reminders | CRM | Yes | $12/mo / $24/seat |
| **BoardEx** | Institutional | – | – | Executive connection graph via shared boards and education; Chennai research centre | Visual relationship map | No | Enterprise |
| **The Org** | Public | Weekly "Executive Moves" editorial | – | Public org charts | Web | – | Free |
| **Tofler / Zauba / Qorpiq** | India | – | – | **DIN-keyed directorships, "people associations", shared boards** | Profile pages | Web | Freemium |
| **GLG / Third Bridge / AlphaSights / Xpressviews** | Institutional | – | Expert transcripts | Paid access to strangers | Concierge | – | ~$400 per call (AlphaSense comparison page) to $1k+ [unverified] |

---

## 2. Product-by-product analysis

### 2.1 Indian equity tools (retail and pro)

**Screener.in.** The default fundamentals tool for Indian investors.
- *Push:* a free account gets a watchlist feed of announcements and filings. Alert limits: 10 stock and 2 screen alerts on free, 800 and 75 on Premium (Tapetide price page, checked 24 Oct 2026: https://tapetide.com/compare/stock-research-subscription-prices-india). The "Company Announcements" tool says "search, filter and set alerts for the newest disclosures" (https://www.screener.in/docs/changelog/Concall-Summaries).
- *Pull:* the strongest free financial snapshot in India (10+ years of P&L, BS and CF, ratios, peer tables) with direct links to annual reports and concall transcripts. Since Oct 2025, transcript "notes" (AI summaries) can be skimmed from the Concalls page. Screener AI is a chat window per company with "direct access to company filings like annual reports and earnings calls", paid per token, with ₹500 of credits bundled in Premium (https://screener.in/ai). A competitor estimates ₹10–30 per answer (https://tapetide.com/compare/screener-in-review).
- *Mobile:* **no native app.** The support page says "working on developing a mobile application" (https://support.screener.in/article/31-do-we-have-a-screener-app-for-mobile-device). Reddit users call this out: "Sucks that there is no mobile app version" (r/IndiaInvestments snapshot: https://reddit.sentinel-team.org/posts/1q1ux95/snapshots/2026-01-02T20%3A21%3A11.792684Z).
- *Praise:* free, fast, trusted; custom screens in a query language. *Complaints:* some computed figures (total debt, FCF) seen as inaccurate (same Reddit thread); free tier caps transcript notes at about 10 a month (ValuePickr, via search summary).
- *Lesson for FINN:* dense numeric tables in a consistent layout earn trust. Screener's credibility comes from showing numbers, not prose.

**Trendlyne.** The broadest alerting engine in India.
- *Push:* **Alpha Alerts** is a single alert that covers a group of stocks (up to five universes: portfolio, watchlists, indices). Triggers include daily price thresholds (±5/10%) over 15-minute to daily windows; volume shocker; high delivery; **results declared filtered by rising or falling revenue/profit YoY or QoQ**; insider/SAST deals above 1%; corporate actions; DVM score changes. Delivery is real-time, WhatsApp, and **hourly or daily email digests of corporate announcements** (https://trendlyne.com/alerts/portfolio-real-time-alerts).
- *Pull:* AI concall summaries (https://trendlyne.com/ai-conference-calls/); MarketMind AI with "Portfolio AI", metered in credits; "cannot rank, filter, or screen" (https://help.trendlyne.com/support/solutions/articles/84000398736-what-marketmind-ais-are-available-). An MCP connector is sold separately (₹299–499/mo).
- *Pricing:* GuruQ ₹2,990/yr, StratQ ₹9,900/yr, PRO ₹8,900/yr, PRO PLUS ₹11,900/yr (Tapetide, Oct 2026). "The most powerful alerts are locked behind a premium charge" (https://www.strike.money/reviews/trendlyne).
- *UX critique (my judgement):* very powerful but visually noisy. Dozens of proprietary scores (DVM, momentum), many tabs, and the alert setup is a configuration panel rather than a judgement. It is a **trader's toolbox**, not a long-term investor's advisor.
- *Lesson:* the alert *taxonomy* is excellent (especially "results declared and revenue rising YoY"). FINN should copy the taxonomy and drop the configuration burden by shipping sensible defaults.

**Tijori Finance.** The most thoughtful Indian AI research stack, and the closest competitor to FINN's Pull layer.
- *Push:* **Tijori Alerts** syncs a broker account or a manual list and sends a WhatsApp AI summary plus a link to the filing within "20 to 60 seconds". Filing types are user-selectable (results, board outcomes, insider/promoter trades, corporate actions, shareholding, credit ratings, M&A). There is a 30-day trial for 10 companies (https://zerodha.com/z-connect/general/tijori-alerts-stock-exchange-filings-on-whatsapp). Tijori also powers the **Zerodha Console Timeline**, a holdings-only feed where "an AI-generated summary appears automatically" when a holding reports results, covering revenue, profit, drivers and QoQ change (https://support.zerodha.com/category/console/portfolio/console-holdings/articles/timeline-feature). The changelog added AI summaries for exchange filings in the Timeline in Jan 2025 so users "can skip opening most of them" (https://www.tijorifinance.com/whats-new). **Radar** lets you define a metric or risk per company (client concentration, pledging, receivables) and get alerted when disclosures mention it. A power user called it "their favourite part of the stack" (https://tradingqna.com/t/tijori-s-ai-stack-for-company-research/194604).
- *Pull:* **Concall Monitor** gives the transcript plus an AI summary (pricing, margins, growth, demand, guidance, capex, risks) shortly after the call, plus a **"management consistency check"** comparing current statements with past ones. On-demand **Management Credibility Report** ("what management said vs what they did"), Risk Probe, a 5-year revenue/EBITDA estimate, and **Atlas** Q&A grounded in filings rather than the web (same TradingQnA post). Zerodha invested $5M in Nov 2025 to expand the AI suite (https://www.newsbytesapp.com/news/business/zerodha-invests-5-million-in-tijori-to-boost-ai-research-tools/tldr).
- *Pricing:* ₹330/mo or ₹3,500/yr. Free tier: 1 portfolio, 1 watchlist, 5 alerts (via search summary of comparison sites).
- *Complaints (Zerodha blog comments):* users expected it to be free; NRIs can't use international numbers; OTP issues; "summaries short or late"; users want it *inside* Kite rather than in a separate app; some want holdings-only filters (same z-connect URL).
- *Critical read:* Tijori has most of FINN's Pull ingredients. Its weaknesses: (1) push is per-filing WhatsApp, which adds to noise; (2) the "credibility" output is a report, not a persistent, glanceable ledger; (3) no network layer; (4) no unified portfolio-level "what changed since you last looked" view.

**Groww (GR-1).** Launched 23 Oct 2026 as an opt-in beta.
- *GR-1 Insights* are **ranked insight cards** on stock pages (price moves, unusual volume, news, results). Tapping one opens "significance, potential impact, and what to watch next". Coverage is 750 stocks. *Ask GR-1* is a chat that uses holdings, watchlists and positions. It never places orders without confirmation (https://groww.in/updates/gr-1-ai-investing-assistant-groww).
- WhatsApp alerts cover quarterly results, concall announcements, big orders, capex and bulk deals (via search summary).
- *Lesson:* the "significance / impact / what to watch" triad is a good card structure. But "impact" sourced from news drifts into speculation, which FINN must avoid because it is restricted to primary sources.

**Moneycontrol Super Pro.** "Real-time, AI-generated alerts for key corporate announcements of their favourite stocks, delivered directly on WhatsApp", sold with an analyst-panel product (https://www.afaqs.com/companies/moneycontrol-launches-super-pro-an-intelligence-led-markets-product-9460070). Super PRO ₹2,499/yr. Base Pro portfolio is "static… no AI-driven interpretation" (competitor-written, biased: Multibagg).

**StockEdge.** App-first; filtered news, NSE/BSE announcements, result calendar, bulk/block/insider deals (App Store listing https://apps.apple.com/in/app/id1066284206). Edge Reports carry a "Sentiment Score −1 to +1". v11.3 (Apr 2026) added Edge Insights. Club tier has "Stock AI". Mobile-native, but its research is shallow and its scores are proprietary.

**MarketsMojo.** Mojo Score (100-pt, rule-based); Smart Alerts on price and score changes; Portfolio Analyzer health check. Criticised because alerts "do not keep users updated about the news and announcements" (competitor source). This is a clear example of a **proprietary score** standing in for judgement.

**Tickertape.** Mobile-friendly screening (Reddit: "works better on a phone"). Pro ₹2,999/yr adds red flags, Pro alerts, export. Portfolio AI; free MCP (single source). Not a filings product.

**Finology Ticker, Value Research, Equitymaster.** Editorial and recommendation services. I found no notable AI, alert or filings product in 2026 searches. Value Research publishes skeptical pieces on relying on AI for stock picking (https://www.valueresearchonline.com/stories/227655/the-problem-with-relying-on-ai-for-stockpicking/). Low relevance for Push and Network.

**NSE/BSE official.** NSE offers an announcements RSS feed (https://www.nseindia.com/rss-feed). Users report delays. The BSE app has a watchlist and announcements (https://apps.apple.com/us/app/id808101185). I found no official announcement push service. A forum commenter says BSE has no alerting service (anecdotal). The exchanges are the **version of record**, and every serious tool links back to the exchange PDF.

**AceEquity / Capitaline / CMIE Prowess.** Institutional, desktop/Excel databases (Prowess: about 5,800 listed companies, built from annual reports; https://library.iimcal.ac.in/cmie-prowessiq/). Deep history; no modern alerting or AI UX found. Price is about ₹1.7 lakh/yr for Ace plus Capitaline (forum, **[unverified]**). Relevant as the data bar an ENAM analyst is used to, not as UX.

### 2.2 Indian AI-native filings and concall startups (long tail)

| Product | What it does | Notes |
|---|---|---|
| **EquiSense** (https://equisense.ai/) | Plain-English filing summaries; WhatsApp alerts "minutes after"; **Glance** cards tagging each result Positive/Neutral/Negative with key numbers and a one-liner; Kavach governance score (e.g. TCS 92/100); MCP server for Claude | Card format is good (label, company and period, summary, "2 min ago"). Sentiment labels are reductive. |
| **Stox AI** (https://cxotoday.com/sponsored/stox-ai-launches-indias-first-real-time-market-announcement-platform-through-a-key-tie-up-with-bse/) | Official BSE live-feed integration; WhatsApp AI summary plus the BSE PDF "within seconds"; "we are the messengers, not the message" | Sponsored article (vendor claim). Jun 2025. |
| **myAlerts.in** (https://forum.valuepickr.com/t/myalerts-in-instant-whatsapp-email-notifications-ai-powered/201905) | Free WhatsApp/email; 500-stock watchlists; concall summary PDFs in 7 fixed sections (2–3 pages); BSE only | Users praise "no fluff" but ask for category filters, which is evidence that even "clean" per-filing alerts become noise. |
| **Multibagg AI** (https://www.multibagg.ai/) | Ask Iris (answers "only from official company documents"); Concall Monitor; Earnings tracker; WhatsApp alerts; "bite-sized" sentiment-tagged timeline | ValuePickr users: free tier allows too few prompts ("a person would need 5–6 prompts"); data gaps (Castrol ROE blank); reluctance to connect a broker for security reasons (https://forum.valuepickr.com/t/what-happens-when-ai-meets-millions-of-concalls-presentations-reports-and-announcements/200871). |
| **ConCallIQ** (https://concalliq.in/) | Short concall summaries; **"tracks whether management delivers on its promises across quarters"** | Site returned HTTP 402 when fetched. Feature claim is from the search snippet **[partly unverified]**. |
| **ArthaLens** (https://forum.valuepickr.com/t/arthalens-free-quarterly-earnings-call-transcript-summaries-guidance-q-a-for-indian-listed-companies/195023) | Free; summaries, Q&A extraction, **forward-looking guidance extraction**, page citations, custom prompts (50/day); transcripts from Jan 2024 | Users asked directly about hallucinations; the founder answered "citations to page". Reliability complaint: new calls not appearing. |
| **Sharenox, Dhanarthi, Reports Radar, Arthneeti, concall-alpha** | Free concall/AR summarisers, some with a "guidance tracker" | Many hobby or SEO-grade projects. Evidence that **summary alone is a commodity**. |

**Important framing from Multibagg's own guide** (https://www.multibagg.ai/feeds/management-guidance-earnings-calls-cmudzbqxv000404l5f2fyu9fg): the right guidance-vs-actual method is to record each guided range **with its date and basis** (constant currency, organic, one-offs), note whether each revision was retained, raised, narrowed or cut, match it to the same period's result, and read the Q&A for the reason behind any gap. Its HCLTech FY26 example has three columns: guided 4.0–4.5% CC growth on 12 Jan 2026; reported 3.9% on 21 Apr 2026; company's own description "10 bps below guidance". **That table is the shape FINN's "promised vs delivered" should take.** The same source notes that summaries "flatten repetition: a theme management returns to four times reads the same as one mentioned once, unless the tool preserves the count or quotes the passages" (https://www.multibagg.ai/feeds/earnings-call-summary-tools-cmum7o9lx000404judmu18xkn, via search summary).

### 2.3 Global AI research platforms

**AlphaSense (incl. Tegus, Sentieo).** The institutional benchmark for Pull and for alerting on documents.
- **Smart Summaries** cover earnings highlights, outlook, bull/bear from broker research and SWOT from expert calls, and "all summaries provide links to the exact location in the text" (https://www.alpha-sense.com/resources/product-articles/what-is-alphasense).
- **Sentiment analysis** "uses color coding to help users identify instances of positive, negative, and neutral sentiment" inline in the document (same URL). **Sentiment Indices** launched Jun 2026 (via third-party timeline).
- **Generative Grid** runs many prompts across many documents and shows a table. **Deep Research** is an autonomous multi-search agent with sentence-level citations. **Snippet Explorer** shows a topic's historical mentions in one view.
- **Alerts:** real-time, daily or weekly on watchlists and saved searches.
- **Expert network:** Tegus library of 250k–300k+ transcripts; live 1:1 calls (~$400/call per AlphaSense's own comparison page: https://www.alpha-sense.com/compare/alphasense-vs-tegus/); AI-led expert calls (2025).
- Has a mobile app. *Relevance:* best-in-class grounding UX (citation to exact sentence) and the "Snippet Explorer" idea, which FINN can borrow for "how has management talked about X over 8 quarters". India coverage of concalls exists, but this is not a personal-portfolio product.

**Bloomberg.** AI earnings-call summaries (Jan 2024; https://fintechnews.sg/84034/ai/bloomberg-introduces-ai-powered-earnings-call-summaries-for-enhanced-financial-analysis/). **Three-bullet AI summaries at the top of news stories** (Jan 2025; https://www.bloomberg.com/company/press/bloomberg-launches-gen-ai-summarization-for-news-content, 403 on fetch, confirmed via search). AI Document Insights for Q&A over filings and transcripts (Apr 2025). ASKB consolidation (Feb 2026, secondary source **[unverified]**). Bloomberg alert functions (ALRT/NI/news alerts) are long-standing **[unverified in this session]**. *Lesson:* a fixed shape (exactly 3 bullets) beats free-form summaries for scanning.

**Quartr.** The best **mobile** primary-source experience. One-tap live earnings calls, real-time transcription with speaker attribution, global calendar synced to Outlook/Gmail, watchlist feed, **keyword alerts**, "instant alerts when earnings calls go live", and AI chat over first-party IR material with each output traceable to source. Free on mobile (https://quartr.com/mobile-app). Quartr-in-Claude via MCP (Mar 2026) and an $18M raise (Jul 2026) come from a third-party profile **[unverified]**. Indian companies appear (e.g. Wise Travel India) but depth of India coverage is unconfirmed. *Lesson:* restricting to **first-party sources** is a feature, which matches the ENAM brief.

**Perplexity Finance.** Added NSE/BSE data, **live Indian earnings-call transcripts** and an earnings-call calendar in Aug 2025, free (https://techcrunch.com/2025/08/18/perplexity-now-supports-live-earnings-call-transcripts-for-indian-stocks/). Its India dashboard is default for Indian users. Weakness for FINN's brief: it is an answer engine that blends web and news, the opposite of "primary sources only".

**Fiscal.ai (ex-FinChat).** KPIs and segments for 100k+ companies, Copilot (earnings summaries, Q&A, custom reports), click-through auditability to filings on Enterprise for US stocks. ~$24–49/mo. $10M Series A Jun 2025 (https://www.toolcenter.ai/en/articles/finchat-review-2026). I found no explicit guidance tracker.

**Daloopa.** Extracts actuals, KPIs, segments and **guidance** into Excel with links to sources. Its open-source **guidance-tracker** Claude skill "pairs quarterly guidance with the following quarter's actual, computes deltas, beat rates, and whether management looks conservative or aggressive" (https://openskillindex.com/skills/daloopa-investing-guidance-tracker). **This is the reference algorithm for FINN's promised-vs-delivered.**

**Hebbia (Matrix).** "Ingest multiple files of unlimited length and answer questions in a tabular, spreadsheet-like format" (https://fintechspecs.com/blog/rogo-vs-hebbia-ai-research-platform-finance/). ~$160M raised. *Lesson:* a grid (rows = quarters, columns = metrics or promises, cells = cited answers) is the right visual for "promised vs delivered".

**Rogo (Felix).** $160M Series D at ~$2B (Apr 2026). Felix is an **email-native agent**: email it a task. Since May 2026 it can run **scheduled monitoring by email** (https://rogo.ai/news/may-product-update). "Rogo Intelligence" turns institutional memory into a queryable asset. *Lesson:* the interaction model of an agent you message, which messages you back on a schedule, is mainstream at the high end. For an Indian investor the equivalent channel is WhatsApp.

**Aiera.** Event summaries "moments after it ends" with topic extraction and sentiment, summaries with citations of each datapoint, watchlist/topic real-time alerts, 60k+ events a year (https://www.aiera.com/dashboard).

**Others.**
- Brightwave: research-report agent, $6M seed 2024 (https://techcrunch.com/2024/10/29/brightwaves-ai-agent-helps-asset-managers-find-signal-and-its-fundraising-fast).
- Samaya: expert agents, Third Bridge partnership Jan 2026 (https://www.thirdbridge.com/en-us/about-us/media/news/third-bridge-partners-with-samaya).
- LinqAlpha: $22M Series A Jul 2026 (https://news.bloombergtax.com/private-equity/former-goldman-analysts-ai-startup-is-said-to-raise-22-million).
- Boosted.ai Alfa / Alfa Prime: "multi-model AI investment committee", Aug 2026 (https://cfotech.news/story/boosted-ai-launches-alfa-prime-for-institutional-partners).
- Fintool: reportedly acquired by Microsoft in Apr 2026 (competitor source AllMind, **[unverified]**: https://allmind.ai/research/fintool-alternatives).
- Captide: acquired by Model ML, Feb 2026 (https://www.businesswire.com/news/home/20260212093795/en/Model-ML-Buys-Captide-to-Give-Financial-AI-Agents-Citable-Corporate-Disclosure-Data).
- Koyfin / TIKR: estimates, beats and misses, transcript search; India filter exists in TIKR; no guidance-vs-actual ledger (https://www.tikr.com/blog/5-of-the-best-free-tools-to-track-guidance-changes-over-time).

*Takeaway:* the global category is consolidating (acquisitions) and converging on the same pattern: **citations to the exact passage, agentic deep research, MCP connectors**. None of them is a personal, portfolio-plus-relationship product for India.

### 2.4 Filing-alert and news-filtering UX

- **Benzinga Pro:** a fast newsfeed with filters and squawk; AI summaries and "market-mover" flags on the Essential tier; $37–197/mo; mixed Trustpilot (https://daytradingtoolkit.com/reviews/benzinga-pro-review). It is a firehose for traders, the anti-model for a long-term investor.
- **Particle:** clusters many articles into one **story**; "Opposite Sides" view; summary modes (ELI5, 5Ws); sources listed under the summary; follow-up questions (https://techcrunch.com/2024/02/29/former-twitter-engineers-are-building-particle-an-ai-powered-news-reader/, https://www.techradar.com/computing/artificial-intelligence/a-news-app-is-using-ai-to-curate-clarity-over-clickbait). **Directly relevant:** a company often files 3–6 documents for one event (outcome of board meeting, results PDF, press release, investor presentation, Reg 30 intimation, newspaper ad). FINN should **cluster them into one "event"**, as Particle clusters articles.
- **Sentieo:** acquired by AlphaSense in 2022 **[unverified date, from memory]**; its doc-search UX lives on in AlphaSense.
- **Boardroom Alpha:** real-time alerts on executive appointments and terminations (US) (https://cms.boardroomalpha.com/?p=19696).

### 2.5 Network and relationship intelligence

**Affinity.** The reference for relationship strength.
- Scores come from email and calendar metadata (recency, frequency, consistency), never content. The browser-extension sidebar lists colleagues who know a person or company, **ranked by strength with last-interaction date**. Clicking through shows a timeline: first interaction, frequency, upcoming meetings (https://www.affinity.co/blog/crm-network-mapping). Triggers alert you when strength for key contacts falls below a threshold (https://www.affinity.co/blog/relationship-intelligence).
- Honest limitations from Affinity itself: calls, WhatsApp and in-person meetings are invisible; the score measures volume, not warmth; "use a score to identify the right colleague, then ask them". **In India, where WhatsApp and calls dominate, an email-metadata score would badly under-measure.** FINN should capture strength explicitly (lightweight tags) plus context (how you know them), not infer it from email.
- Affinity's PE benchmark: the median firm converts only 34% of tracked relationships into intros (vendor claim) (https://www.affinity.co/blog/crm-network-mapping).

**4Degrees / Introhive.** Deal-team CRMs with network strength and warm paths. Introhive is an enterprise CRM layer at $50k–150k/yr (buyer-guide estimate). 4Degrees has an MCP beta in 2026 (https://happenstance.ai/compare/4degrees-vs-introhive).

**LinkedIn Sales Navigator.** TeamLink widens your graph to your team's connections. "Best Path In" and Relationship Explorer surface warm paths and allies with job-change context (https://www.linkedin.com/help/linkedin/answer/a108023). Limitations: only the sales team's graph, manual intro requests, no tracking (https://blog.waalaxy.com/en/teamlink-sales-navigator/). Also LinkedIn's terms block scraping, so FINN cannot rely on LinkedIn data at runtime **[policy, from memory]**.

**Happenstance.** The closest UX analogue for "who should I call". Natural-language search over *your own* Gmail, LinkedIn, X and calendar network ("VP Eng at a Series B fintech in NYC"), with ranked results and context on experience and mutual connections. Falls back to web search when nobody fits. iPhone app, Slack bot over a team's combined network, MCP, CLI. Pro $24–30/mo (https://happenstance.ai/about, https://happenstance.ai/guides/best-ai-networking-tools). *Lesson:* the query is the interface, and results must explain *why* each person is relevant.

**Mesh (ex-Clay.earth, acquired by Automattic Jun 2025).** Auto-merges contacts from email, calendar, address book, LinkedIn, X, WhatsApp and iMessage. **Home feed of updates about people in your network: job changes, news mentions, birthdays.** "Reconnect" suggestions for people you have gone quiet on. Nexus AI ("who has been to X / works at Y") (https://me.sh/stories/mesh, https://getdex.com/blog/mesh-review/). *Lesson:* this is the pattern for "keep the network warm", but Mesh triggers on *people* news, not on *company* news in your portfolio.

**Dex.** Syncs up to 9,000 LinkedIn connections, sends job-change alerts and keep-in-touch reminders, $12/mo (https://getdex.com/blog/dex-vs-cloze/). Dex's own blog concedes that for 40 contacts "Google Contacts is the right answer". In other words, small networks don't need a CRM; they need **moments**.

**Folk.** Follow-up assistant reads email and WhatsApp threads to flag stalled conversations and drafts follow-ups; research assistant powered by Perplexity; $24/seat (https://getdex.com/blog/folk-crm-review/).

**BoardEx.** About 1.7M executives; identifies common connections across executives (shared boards, education, employers) and shows a visual relationship map; research centre in Chennai; India coverage depth unconfirmed (https://boardex.com/products/web-platform, https://wikipedia.com/wiki/BoardEx). This is the institutional version of "second-degree to the new MD".

**The Org.** Public org charts plus a weekly "Executive Moves" editorial. I found no confirmed alert product (https://theorg.com/iterate/executive-moves-you-should-know-about-january-14-2026).

**Expert networks (GLG, Third Bridge, AlphaSights, Tegus; India: The Xpressviews, Astute Connect).** Paid access to *strangers* who used to work at a company (https://cleverx.com/blog/glg-alternatives, https://expertnetworkcalls.com/expert-networks/the-xpressviews). FINN's thesis is the inverse: **your own former colleagues and classmates are a free, higher-trust expert network you already own.** Note that SEBI insider-trading rules (PIT Regulations) restrict access to UPSI. FINN's "who to call" should frame calls as understanding industry context, never as a channel for non-public information **[compliance point; regulation exists, the specific framing is my recommendation]**.

**India-specific people data (underused by every competitor).**
- **SEBI LODR Reg 30 / Schedule III:** a KMP or director change disclosure must include the reason, the effective date and, **for appointments, a brief profile**, plus disclosure of inter-se relationships between directors (NSE KMP change format: https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Changes%20of%20KMP_v2.pdf; practitioner summary: https://legalmantra.net/blog-detail/What-are-the-disclosures-applicable-for-Change-in-Directors-Key-Managerial-Personnel-of-Director-in-a-Listed-Entity). Some companies omit the successor's details (https://mmjc.in/sebi-compliance-unveiled-non-standard-disclosures-of-kmp-resignation-amid-sebis-regulatory-framework/). **So FINN's "bio of incoming person" can be grounded in the filing itself, fully within the primary-sources rule.**
- **MCA DIN directorships** (mirrored by Tofler, Zauba, Qorpiq) list a person's other boards, past boards and "people associations", keyed by DIN (https://tofler.in/sunil-duggal/director/07291685, https://qorpiq.com/director/sanjay-toshniwal/00217541). This gives a deterministic **second-degree path through shared boards**, for example "your contact X sits with the new MD on the board of Y Ltd."

---

## 3. Who is best at each layer, and why

### PUSH: best overall is Tijori (India), with Trendlyne's alert taxonomy and AlphaSense/Bloomberg's discipline as references

- **Tijori** wins in India because it (a) sits where the investor already is (Zerodha Console Timeline is holdings-only by default, so there is no setup); (b) summarises *every* filing so most never need opening; and (c) offers **Radar**, alerts on a *user-defined thesis risk* (pledging, client concentration) rather than on a price. Radar is the most investor-minded push feature in the Indian market. Its weaknesses: per-filing WhatsApp pings, no ranking across the portfolio, no "since you last looked" digest, no people layer.
- **Trendlyne** has the best **threshold taxonomy** (results filtered by direction of revenue/profit YoY/QoQ; volume shocker; insider >1%; a single alert across a whole universe) and the only **hourly/daily digest** option. It loses on noise and configuration burden.
- **Groww GR-1 Insights** has the best **card anatomy** (ranked; significance, impact, what to watch) but is news-driven and limited to 750 stocks.
- **Globally:** Bloomberg's **fixed 3-bullet summary** and AlphaSense's **saved-search alerts with exact-sentence citations** are the discipline benchmarks. Quartr's **"call is live now"** alert and keyword alerts are the best mobile push.
- **Nobody** does the brief's three "loved" presentations together: management change with bio and network overlap; results with a QoQ/YoY first cut; material event with the best person to call. Zerodha's Timeline result summary (revenue, profit, drivers, QoQ) gets closest on the second, but in prose, not a numeric table, and QoQ only.

### PULL: best for India is Tijori; best design globally is AlphaSense for grounding and Daloopa for guidance-vs-actual logic

- **Tijori** is the only Indian product I verified with both a *consistency check across quarters* and a *Management Credibility Report*, grounded in filings and concalls and explicitly not the web. ConCallIQ and ArthaLens make similar claims but are smaller and less verifiable.
- **AlphaSense** sets the bar on trust: every summary sentence links to the exact location; colour-coded sentiment inline; Snippet Explorer for a topic over time; Generative Grid for many questions × many docs.
- **Daloopa** sets the bar on **guidance accounting**: guidance pinned to the next actual, deltas, beat rate, conservative or aggressive. **Hebbia Matrix** shows the right *visual* (a cited grid).
- **Screener** remains the best *numbers* page (dense, consistent, trusted, free). Any FINN financial snapshot should feel Screener-grade on numbers before adding prose.
- **Quartr** is the best *mobile* primary-source reader (audio + transcript + slides).
- Missing everywhere: a **mobile, one-screen "promised vs delivered" ledger** for any NSE ticker, with a citation (document, page) per row, the guided figure *with its basis and date*, the actual, and a plain verdict (Delivered / Missed / Moved goalposts / Quietly dropped). "Quietly dropped" (guidance that stops being mentioned) is the most valuable signal and I saw no one surface it.

### NETWORK: best is Affinity for strength and warm paths; Happenstance for query UX; Mesh for "keep warm"; BoardEx for executive overlap

- **Affinity:** relationship strength from interaction recency, frequency and consistency; ranked "who knows them" with last-touch date; strength-decay triggers; honest about what it can't see.
- **Happenstance:** the best *interaction* (ask in plain English, get ranked people with reasons and mutual connections), mobile app, MCP.
- **Mesh:** the best *maintenance* loop (home feed of job changes and news about people; Reconnect).
- **BoardEx:** the best *executive overlap* graph (shared boards, education, employers): the "is anyone one connection away from the new MD" capability, at institutional price, with unverified India depth.
- **None** of them reads exchange filings or knows your portfolio. None is designed around Indian realities: WhatsApp and phone relationships, IIT/IIM and batch-year cohorts, DIN board graphs, Reg 30 bios.

---

## 4. The gap no product fills

1. **Event × Relationship join.** No product, global or Indian, takes a listed-company event (new MD appointed, acquisition, capex, litigation, results miss) and resolves it to **a specific person you know, with the reason** ("worked under the incoming CFO at HUL 2012–16"; "IIM-A '04 batchmate of the new MD"; "sits with him on the board of X Ltd per MCA"). Affinity and Happenstance do people without filings; Tijori, Trendlyne and AlphaSense do filings without people.
2. **A digest, not a drip.** Every Indian product optimises for *speed per filing* (20–60 s WhatsApp). For a 15–20 stock long-term portfolio, the valuable artefact is a **windowed, ranked, de-duplicated brief**: "In the last 24h: 23 filings across 17 holdings; 2 need you; 4 worth a read; 17 routine (collapsed)." No one ships this as the primary surface. Trendlyne's email digest is the closest and is unranked.
3. **Event clustering.** Indian companies file several documents per event. No Indian tool clusters them into one item the way Particle clusters articles.
4. **Promise ledger as a living object.** Guidance tracking exists as reports (Tijori) or analyst workflows (Daloopa, Multibagg's manual method). No product keeps a persistent per-company ledger that **pushes when a new result settles an open promise** ("Q2 settled 3 of Titan's open promises: 2 delivered, 1 missed").
5. **Network maintenance triggered by portfolio and filings news.** Mesh and Dex trigger on a *person's* job change. Nobody triggers on "your former colleague's ex-employer just announced an acquisition, so here's a reason to reconnect", which is exactly the brief's ask.
6. **Mobile-first depth for Indian equities.** Screener has no app. Tijori and EquiSense are web plus WhatsApp. Broker apps are shallow. A mobile-native, research-grade, primary-source tool is unclaimed.
7. **Grounding plus brevity plus low cost together.** Competitors meter AI because each answer is a fresh LLM call. A precompute-first architecture (deterministic numbers, cached per-document extractions, LLM only for short "why it matters" lines) makes depth cheap. That is both a product and an efficiency advantage.

---

## 5. UX patterns worth borrowing (concrete)

| Pattern | Seen in | How FINN should use it |
|---|---|---|
| **Exact-sentence citation on every claim** | AlphaSense ("links to the exact location in the text"), Quartr ("each output traceable"), Daloopa (source link per figure), ArthaLens (page citations) | Every number and quote in FINN carries a tappable source chip `[Q2FY26 concall p.7]`, opening the PDF at the page. Replaces "AI may be wrong" disclaimers. |
| **Inline sentiment colour-coding inside the source text** | AlphaSense | Use sparingly, only in the transcript viewer, and only for *hedging vs commitment* language ("we expect", "we are confident" vs "subject to", "challenging"), not as a company-level label. |
| **Snippet Explorer (topic over time)** | AlphaSense | "How has management talked about *margins* over 8 quarters": a vertical timeline of verbatim quotes. It powers "narrative vs numbers" and shows repetition counts (addresses the flattening problem). |
| **Cited grid** | Hebbia Matrix, AlphaSense Generative Grid | Promised vs Delivered as a grid: rows are promises, columns are quarters, cells are verdict chips. |
| **Guidance accounting** | Daloopa guidance-tracker; Multibagg HCLTech example | Each promise stores metric, range, basis, date said, period it applies to, actual, delta and verdict. Roll up a per-company "delivery rate" plus a "conservative vs aggressive" tilt. |
| **Fixed-shape summaries** | Bloomberg 3 bullets; myAlerts 7 fixed sections; Groww significance/impact/watch | Every pushed card has the same skeleton: *What happened (1 line) · Numbers (table) · Why it matters to you (1 line) · Who to call (0–1 person) · Source*. Fixed shape lets the eye learn the layout. |
| **One alert for a universe; results filtered by direction** | Trendlyne Alpha Alerts | Defaults: "results declared AND (PAT YoY < −10% OR revenue QoQ < 0)"; volume > 2× 20-day average at EOD; price beyond ±X%. Configurable, but shipped pre-tuned. |
| **Thesis monitors (user-defined risk watch)** | Tijori Radar | "Tell me if Company X mentions pledging / a client-concentration change / receivable days." Turns Push into the investor's own thesis guardrails. |
| **Holdings-only by default, zero setup** | Zerodha Console Timeline | Import a portfolio once (CSV/CAS); everything scopes to holdings automatically. |
| **Story clustering + multiple angles** | Particle | Cluster multi-document filings into one event. For bull vs bear, an "Opposite Sides" toggle sourced only from the company's own documents (what management says vs what the numbers show). |
| **Ranked people with reasons + last touch** | Affinity sidebar, Happenstance results | "Best person to call" card: name, *how you know them*, *why they're relevant to this event*, last spoke (if logged), one-tap WhatsApp or call. Never a bare list. |
| **Strength-decay and reconnect prompts** | Affinity triggers; Mesh Reconnect | "You haven't spoken to Priya in 9 months; her former employer (Titan) just announced a jewellery capex. Good reason to reconnect." |
| **Shared-board graph** | BoardEx, Tofler/Zauba DIN | Second-degree via MCA directorships: "Your contact R. Mehta sits on the board of ABC Ltd with the incoming MD." Deterministic and citable. |
| **Live-call alert + synced transcript** | Quartr | "Concall starting now" with listen and read; after the call, the ledger auto-updates with new promises. |
| **Natural-language query over own network** | Happenstance, Mesh Nexus | "Who do I know in specialty chemicals?" returns an expertise map by theme. |
| **Email/WhatsApp-native agent with schedules** | Rogo Felix (email), Tijori/Stox (WhatsApp) | Deliver the daily brief as one WhatsApp message (or push) at a chosen time, deep-linking into the app. One message a day, not 23. |

---

## 6. Anti-patterns to avoid (what reads as "AI slop" or clutter)

1. **One filing = one ping.** Tijori Alerts, Stox, myAlerts, EquiSense and Moneycontrol all push each filing in seconds. For 15–20 stocks in results season that is dozens of WhatsApps a day, and myAlerts users already ask for category filters. Speed isn't the value for a long-term investor; *triage* is.
2. **Blanket sentiment labels.** EquiSense tags every result Positive/Neutral/Negative; StockEdge gives −1..+1; Multibagg uses "AI-tagged sentiment". These compress judgement into a guess and invite mistrust ("negative according to whom?"). Show the numbers and the delta versus the company's own guidance instead.
3. **Opaque proprietary scores.** Mojo Score, DVM, governance "92/100". Users can't audit them, and they feel like a substitute for thinking. FINN should show *components*, never a magic number. The exception is a delivery rate (e.g. 7/10 promises kept), which is fully auditable.
4. **Long generic summaries.** 2–3 page, 7-section concall PDFs (myAlerts) and "key highlights" that restate the press release. Summaries that flatten repetition. Hallucination-prone small-cap coverage (https://lumichats.com/blog/ai-for-stock-market-investing-india-2026). If a sentence could apply to any company ("the company remains focused on growth"), delete it.
5. **Chat-first blank box metered by credits.** Screener AI, Trendlyne MarketMind and Multibagg Iris all ask users to know what to ask, then charge per question. Users complain they need "5–6 prompts" to get somewhere. FINN should **precompute** the 8 research sections and keep chat as a secondary "ask about this" affordance bound to the current company and context.
6. **Disclaimers instead of citations.** "AI-generated, may be wrong, check the filing" (Zerodha/Tijori). Necessary legally, but the product answer is a source chip on every claim.
7. **Feature sprawl and tab soup.** Trendlyne's dozens of modules, StockEdge's many sections. FINN should have three surfaces, not thirty.
8. **Contact-list UI for the network.** Alphabetical lists of names, or a strength bar with no context, feel like a CRM. The brief explicitly says "quiet advantage, not a contact list." People should appear *only in context* (attached to an event or a question) and always with the *reason*.
9. **Email-metadata relationship scores in India.** Affinity admits that WhatsApp, calls and in-person meetings don't register, and those dominate Indian relationships. Don't fake precision. Use explicit, user-confirmed ties ("worked together at HUL, 2012–16") and recency only when logged.
10. **Speculative "impact" and price prediction.** Groww's "potential impact" built on news, and Boosted's "AI investment committee" backtests. For a primary-source product, any forward-looking statement must be *management's* (quoted), never FINN's.
11. **Web/news blending.** Perplexity and Groww mix news. ENAM explicitly wants AR plus concalls only. Make the constraint visible as a feature ("Sources: 4 annual reports, 8 concalls. No news, no broker notes").

---

## 7. Three product concepts for FINN

All three share the same data spine: exchange filings, AR/concall PDFs, XBRL financials, the user's portfolio, and the user's network graph (contacts with typed edges: worked-with, studied-with, board-overlap via DIN, plus the companies they're tied to).

### Concept A: "The Brief" (one daily note; everything else is depth behind it)
- **Interaction model:** one screen, one moment per day (or per user-chosen window: 24h / since last open / 7d). Written like a sell-side morning note but only about *your* holdings. Three tiers: **Needs you** (0–3 items), **Worth a read** (a few), **Routine** (collapsed: "17 routine filings: 9 trading-window closures, 5 newspaper ads, 3 investor-meet intimations").
- Each card follows the fixed shape. *Results:* Revenue/EBITDA/PBT/PAT QoQ and YoY table computed deterministically, plus "vs management's guidance" if a promise exists. *Management change:* bio quoted from the Reg 30 filing, plus "2 people you know overlap" (worked at Asian Paints 2010–14; IIM-B '98). *Material event:* the best person to call and why.
- Threshold alerts (volume > 2× average at EOD, price beyond ±X%, material categories) appear as interrupts only when they cross user thresholds. Otherwise they fold into the next Brief.
- **Strength:** the most opinionated. It directly embodies "proactively tells you what changed" and "routine collapsed". Cheapest to run (one batch job per window; LLM only for 1-line "why it matters" on 3–7 items).
- **Risk:** Pull and Network could feel secondary unless they're reachable from every card.

### Concept B: "The Ledger" (company dossiers built around promised vs delivered)
- **Interaction model:** the primary object is a **company file**. The top of every file is the **Promise Ledger**: a grid of the last 4 quarters of guidance (what was said, when, on what basis, actual, verdict chip: Delivered / Missed / Moved / Dropped), with citations. Below it are the 8 research sections, each 3–5 lines plus a numeric table, each line source-chipped. A **People** panel shows who you know at the company, its competitors, suppliers and customers.
- Push is reframed as **ledger updates**: "Q2 results settled 3 open promises at Titan: 2 delivered, 1 missed (jewellery margin guided 12–13%, actual 11.4%) [concall p.6, results p.2]." A management change updates the ledger's "who made these promises" column, which is powerful: a new CFO resets credibility.
- **Strength:** deepest. The signature feature is exactly what ENAM said it values most. It works on any NSE ticker (Pull) and turns guidance into an accountability tool. It earns trust with investors who think in terms of management quality.
- **Risk:** guidance extraction is the hard NLP problem (vague guidance, basis changes). Needs careful verdict rules and a "couldn't verify" state. Less obviously "push".

### Concept C: "Who to Call" (network-first; every event resolves to a human)
- **Interaction model:** the primary surface is a short **call sheet**: "3 conversations worth having this week", each tied to an event in your portfolio or watchlist, with the person, the reason, a suggested opening question grounded in the filing, and "last spoke". Secondary surfaces: diligence on a person before a meeting (filings mentions, boards via DIN, overlap with your graph), an expertise map by theme, and reconnect prompts triggered by company news at contacts' former employers.
- **Strength:** the most differentiated. It is the one thing no competitor does, and it matches "quiet advantage". It makes the Network layer the hero.
- **Risk:** in a take-home prototype the network data is synthetic, so the reviewer must trust the mock graph. It also depends on the user curating their graph. If the graph is thin, the product is empty.

### Recommendation: build A as the shell, B as the depth, C's intelligence inside every card (not as a separate tab)

- **Point of view to state in the submission:** *A long-term investor with 15–20 stocks doesn't need faster information. They need fewer, better-sourced decisions about what to read, what to doubt, and whom to call. FINN speaks once a day, shows its sources on every line, keeps score on management, and turns events into conversations.*
- **Why this combination beats competitors on simplicity plus depth:**
  - *Simplicity:* three surfaces only. (1) **Brief** (Push digest plus interrupts). (2) **Company** (Ledger plus 8 sections plus People panel, for any NSE ticker). (3) **Ask** (people and company questions, context-bound). No contact-list tab: people appear only attached to events, companies or questions, which is how the "quiet advantage" feeling is achieved.
  - *Depth:* the Ledger is the signature artefact no Indian product presents cleanly, and it links Push to Pull ("this result settled 2 promises").
  - *Network as a lens:* every Brief card gets a one-line "Who you know" row only when there's a real, explainable tie (Reg 30 bio × your graph × DIN boards × alumni). Silence when there's no tie is part of the design.
- **Efficiency:**
  - Numbers (QoQ/YoY, volume ratios, price moves) are deterministic from exchange data and XBRL, with no LLM.
  - Filing triage uses exchange category codes plus rules first, with a small model only for ambiguous "Others" filings.
  - Guidance extraction runs once per transcript, as structured JSON cached forever; ledger verdicts are computed by rules.
  - The LLM writes only the 1-line "why it matters" for the 3–7 items that make the Brief. Network matching is a graph query, not an LLM call.
  - This contrasts directly with competitors that meter every answer (Screener ~₹10–30/answer; Trendlyne credits).
- **Must-have details that show judgement:**
  - "Quietly dropped" guidance detection.
  - Clustering multi-document events.
  - A visible source policy ("primary sources only").
  - A "couldn't verify" state rather than guessing.
  - Compliance framing on calls (context, not UPSI).
  - Holdings-only scope by default.
  - One daily WhatsApp or push at a user-chosen time, with interrupts only for user-set thresholds.

---

## 8. Source index (primary URLs used)

**India tools**
- Screener: https://www.screener.in/docs/changelog/Concall-Summaries · https://screener.in/ai · https://support.screener.in/article/31-do-we-have-a-screener-app-for-mobile-device
- Trendlyne: https://trendlyne.com/alerts/portfolio-real-time-alerts · https://trendlyne.com/ai-conference-calls/ · https://help.trendlyne.com/support/solutions/articles/84000398736-what-marketmind-ais-are-available-
- Tijori: https://tradingqna.com/t/tijori-s-ai-stack-for-company-research/194604 · https://www.tijorifinance.com/whats-new · https://zerodha.com/z-connect/general/tijori-alerts-stock-exchange-filings-on-whatsapp · https://zerodha.com/z-connect/?p=423579 · https://www.newsbytesapp.com/news/business/zerodha-invests-5-million-in-tijori-to-boost-ai-research-tools/tldr
- Zerodha Console Timeline: https://support.zerodha.com/category/console/portfolio/console-holdings/articles/timeline-feature · https://zerodha.com/z-connect/featured/introducing-timeline-and-insights-on-console-powered-by-tijori-finance
- Groww GR-1: https://groww.in/updates/gr-1-ai-investing-assistant-groww
- Moneycontrol Super Pro: https://www.afaqs.com/companies/moneycontrol-launches-super-pro-an-intelligence-led-markets-product-9460070
- StockEdge: https://apps.apple.com/in/app/id1066284206
- MarketsMojo: https://tapetide.com/compare/marketsmojo-review (competitor-authored)
- Prices (competitor-authored, checked 24 Oct 2026): https://tapetide.com/compare/stock-research-subscription-prices-india
- Trendlyne review: https://www.strike.money/reviews/trendlyne
- EquiSense: https://equisense.ai/
- Stox AI: https://cxotoday.com/sponsored/stox-ai-launches-indias-first-real-time-market-announcement-platform-through-a-key-tie-up-with-bse/
- myAlerts: https://forum.valuepickr.com/t/myalerts-in-instant-whatsapp-email-notifications-ai-powered/201905
- ArthaLens: https://forum.valuepickr.com/t/arthalens-free-quarterly-earnings-call-transcript-summaries-guidance-q-a-for-indian-listed-companies/195023
- Multibagg: https://www.multibagg.ai/ · https://forum.valuepickr.com/t/what-happens-when-ai-meets-millions-of-concalls-presentations-reports-and-announcements/200871 · https://www.multibagg.ai/feeds/management-guidance-earnings-calls-cmudzbqxv000404l5f2fyu9fg
- ConCallIQ: https://concalliq.in/
- Reddit snapshot: https://reddit.sentinel-team.org/posts/1q1ux95/snapshots/2026-01-02T20%3A21%3A11.792684Z
- NSE RSS: https://www.nseindia.com/rss-feed
- BSE app: https://apps.apple.com/us/app/id808101185
- Prowess: https://library.iimcal.ac.in/cmie-prowessiq/
- Value Research on AI: https://www.valueresearchonline.com/stories/227655/the-problem-with-relying-on-ai-for-stockpicking/

**Global research**
- AlphaSense: https://www.alpha-sense.com/resources/product-articles/what-is-alphasense · https://www.alpha-sense.com/compare/alphasense-vs-tegus/
- Bloomberg: https://fintechnews.sg/84034/ai/bloomberg-introduces-ai-powered-earnings-call-summaries-for-enhanced-financial-analysis/ · https://www.bloomberg.com/company/press/bloomberg-launches-gen-ai-summarization-for-news-content
- Quartr: https://quartr.com/mobile-app · https://quartr.com/features/live-earnings-call-transcripts
- Perplexity: https://techcrunch.com/2025/08/18/perplexity-now-supports-live-earnings-call-transcripts-for-indian-stocks/
- Fiscal.ai: https://www.toolcenter.ai/en/articles/finchat-review-2026
- Daloopa: https://openskillindex.com/skills/daloopa-investing-guidance-tracker · https://daloopa.com/blog/analyst-best-practices/eps-guidance-vs-analyst-consensus
- Hebbia vs Rogo: https://fintechspecs.com/blog/rogo-vs-hebbia-ai-research-platform-finance/
- Rogo: https://rogo.ai/news/may-product-update · https://rogo.ai/felix
- Aiera: https://www.aiera.com/dashboard
- Samaya / Third Bridge: https://www.thirdbridge.com/en-us/about-us/media/news/third-bridge-partners-with-samaya
- LinqAlpha: https://news.bloombergtax.com/private-equity/former-goldman-analysts-ai-startup-is-said-to-raise-22-million
- Boosted.ai: https://cfotech.news/story/boosted-ai-launches-alfa-prime-for-institutional-partners
- Captide: https://www.businesswire.com/news/home/20260212093795/en/Model-ML-Buys-Captide-to-Give-Financial-AI-Agents-Citable-Corporate-Disclosure-Data
- Fintool (competitor-sourced): https://allmind.ai/research/fintool-alternatives
- TIKR: https://www.tikr.com/blog/5-of-the-best-free-tools-to-track-guidance-changes-over-time

**News UX**
- Benzinga: https://daytradingtoolkit.com/reviews/benzinga-pro-review
- Particle: https://techcrunch.com/2024/02/29/former-twitter-engineers-are-building-particle-an-ai-powered-news-reader/ · https://www.techradar.com/computing/artificial-intelligence/a-news-app-is-using-ai-to-curate-clarity-over-clickbait

**Network**
- Affinity: https://www.affinity.co/blog/crm-network-mapping · https://www.affinity.co/blog/relationship-intelligence
- 4Degrees / Introhive: https://happenstance.ai/compare/4degrees-vs-introhive
- LinkedIn: https://www.linkedin.com/help/linkedin/answer/a108023 · https://blog.waalaxy.com/en/teamlink-sales-navigator/
- Happenstance: https://happenstance.ai/about · https://happenstance.ai/guides/best-ai-networking-tools
- Mesh: https://me.sh/stories/mesh · https://getdex.com/blog/mesh-review/
- Dex: https://getdex.com/blog/dex-vs-cloze/
- Folk: https://getdex.com/blog/folk-crm-review/
- BoardEx: https://boardex.com/products/web-platform
- The Org: https://theorg.com/iterate/executive-moves-you-should-know-about-january-14-2026
- Tofler / Qorpiq: https://tofler.in/sunil-duggal/director/07291685 · https://qorpiq.com/director/sanjay-toshniwal/00217541
- Expert networks: https://cleverx.com/blog/glg-alternatives · https://expertnetworkcalls.com/expert-networks/the-xpressviews

**Regulation**
- NSE KMP change format: https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Changes%20of%20KMP_v2.pdf
- Practitioner summaries: https://legalmantra.net/blog-detail/What-are-the-disclosures-applicable-for-Change-in-Directors-Key-Managerial-Personnel-of-Director-in-a-Listed-Entity · https://mmjc.in/sebi-compliance-unveiled-non-standard-disclosures-of-kmp-resignation-amid-sebis-regulatory-framework/

**Items I could not verify this session:**
- Bloomberg ALRT function specifics
- Sentieo acquisition date
- AlphaSense and Bloomberg seat prices
- ConCallIQ feature depth (site returned 402)
- The SEBI rule on transcript and audio timelines (transcript within 5 working days is cited by Multibagg but not confirmed against the SEBI text)
- Fintool–Microsoft acquisition (competitor-sourced)
- Quartr's 2026 MCP and funding
- AceEquity/Capitaline price
