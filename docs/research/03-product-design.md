# 03 — FINN: Interaction Model & Visual Design Research

*Product-design research for the ENAM Holdings FINN take-home. Compiled 2026-11-10.*
*Every claim backed by a live source has its URL next to it. Claims from memory are marked **[unverified]**. Vendor marketing is flagged where it matters.*

---

## 0. TL;DR

1. **The product should be an edition, not a feed and not a chat.** The brief's key line, "surfacing the few things that actually matter and burying everything else, beautifully", describes a *finite* brief with an end. The precedents that fit are ChatGPT Pulse (5–10 cards per brief that expire), Things 3's Today list, Linear/Superhuman "inbox to zero", Bloomberg's original 3–5-story personalised top, and Inshorts' "you decide in two sentences". Infinite feeds (Robinhood news, Koyfin watchlist news) and blank chat boxes don't fit.
2. **Chat is the right model for Pull follow-ups and the wrong one for the home screen.** Investors monitoring 15–20 *known* holdings don't know what to ask, and a blank text box gives "unclear affordances" (Wattenberger). Use structured, cited "dossier" cards (generative UI) for Pull, and keep a single Ask bar as the escape hatch.
3. **The Network belongs on the cards as a single "via" line, never as a graph.** Force-directed graphs become hairballs, need panning and are expensive to compute on phones. Affinity, 4Degrees and Happenstance all show people as *ranked lists with a reason*. FINN's quiet advantage is **cross-referencing filings with the investor's contacts**: a director appointment, a customer named in a concall, or a management claim that one of the investor's contacts can verify.
4. **"Promised vs delivered" is the signature screen.** Show it as a promise × quarter grid with glyph+colour status (kept / partly / missed / **went silent**). Make "went silent" a first-class state; Inve's Promise Tracker treats it the same way. Every cell opens the verbatim management quote with page citations.
5. **Build a PWA, not Expo.** A URL works on any phone instantly. iOS 26 opens every home-screen site as a web app by default. Web push works on iOS 16.4+ once the app is installed, and Declarative Web Push works on 18.4+. Expo Go is a poor way to share a prototype in late 2026: the App Store build lags the SDK, and `eas go` needs an Apple Developer account plus TestFlight.
6. **Recommendation: Concept A, "The Edition"**, with Concept B's promise ledger as the Pull hero and a 60-second spoken brief as a single optional button. Details in §8–9.

---

## 1. Interaction models for information triage on mobile

### 1.1 Product teardown

| Product | Concrete model (screens, gestures, hierarchy) | What to steal for FINN | Source |
|---|---|---|---|
| **Superhuman** | **Split Inbox** tabs (VIP / Team / News, plus custom splits) sit above the list. **Auto Labels** are coloured tags on each row. **Auto Summarize** adds a one-line summary above each thread that refreshes when new mail arrives. 2025 auto-triage labels mail by priority/category. On mobile, swipe right = done, swipe left = remind me, and the "Inbox Zero" reward screen closes the session **[gestures unverified]**. | Pre-sorted lanes (Material / Results / Moves / Routine). A one-line summary written as an *implication*, not a title. A reward state when you reach zero. | https://blog.superhuman.com/how-ceos-can-organize-their-inbox/ , https://blog.superhuman.com/using-ai-to-manage-emails/ |
| **Linear Inbox** | A single inbox; you can't choose which notifications arrive. J/K to move, U for read/unread, **H to snooze**. Snoozed items come back as unread, and **new activity cancels the snooze**. Reminders differ from snooze because they don't hide the item. Triage is a separate shared queue with Accept / Merge / Decline / Snooze. | **Snooze until a trigger event** ("until Q2 results", "until price moves ±5%"), not only until a time. That maps directly onto an investor's mental model. | https://linear.app/docs/inbox , https://linear.app/docs/snooze , https://linear.app/docs/triage |
| **Things 3** | **Today** shows calendar events at the top, then to-dos, then a **"This Evening"** section. **Upcoming** is the agenda. **Someday** is the deliberate burial ground. The **Magic Plus** button can be tapped, or dragged to drop a to-do at an exact spot. | A *Today* with a sub-section for later ("After market close"), and a **Someday = Routine** pile that stays honest. Signature interaction: one well-crafted control instead of many. | https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/ , https://culturedcode.com/things/features/ |
| **Apple Intelligence: Prioritize Notifications & Summaries** | An opt-in **Priority** section at the top of the Lock Screen holds a handful of ML-ranked notifications (a vendor says 4–6). Summaries condense stacks into one line. After the false-headline incident, news summaries returned in iOS 26 with a **"Summarized by Apple Intelligence" footer** and in-UI warnings that errors may occur. | (a) A small ranked "priority" block above a collapsed stack is now a familiar mental model. (b) **Label AI-written text.** Apple learned this publicly, and FINN should never put a model's paraphrase where the filing title should be without saying so. | https://www.courier.com/blog/developer-guide-to-ios-26-priority-notifications (vendor), https://9to5mac.com/2025/10/27/ios-26-brought-back-a-controversial-ai-feature-heres-whats-new/ , https://www.macrumors.com/2025/07/22/ios-26-beta-4-notification-summaries/ |
| **ChatGPT Pulse** | Researches overnight and shows a morning brief of **5–10 scannable cards**. Tap a card to expand it, and **cards expire after 24h unless saved**. Thumbs up/down and "curate" steer tomorrow's brief. Launched mobile-first for Pro. | The closest precedent for Push: a **finite, expiring, steerable** brief. Steal "expire unless saved" and "curate" (→ FINN's threshold settings, framed as "tell FINN what matters"). | https://www.tomsguide.com/ai/chatgpt-pulse-is-here-now-ai-starts-the-chat-and-curates-your-feed , https://www.eweek.com/news/openai-chatgpt-pulse/ |
| **Particle** | The unit is the **story, not the article**: many outlets are clustered into one story. Summary modes include "5Ws" and "ELI5". A **spectrum** shows where coverage sits politically. | **Cluster multiple filings into one event.** For example, a board-meeting intimation, the outcome, an investor presentation and a press release become one "Q2 results" card. The 5Ws (who/what/when/where/why) work well for management-change cards. | https://techcrunch.com/2024/11/12/particle-launches-an-ai-news-app-to-help-publishers-instead-of-just-stealing-their-work , https://www.techradar.com/computing/artificial-intelligence/a-news-app-is-using-ai-to-curate-clarity-over-clickbait |
| **Artifact (shut down Jan 2024)** | Praised for its design. Its AI **rewrote clickbait headlines**, summarised, and ranked by personalisation. It died because the market was too small and it drifted from "simple reader" into competing with social apps. | Rewriting headlines works: the filing subject "Intimation under Reg 30" should become "CFO resigns 9 days before results". The lesson from its death: **stay narrow**. FINN is a tool for 1 fund, not a feed. | https://www.engadget.com/instagrams-founders-are-shutting-down-artifact-their-year-old-news-app-233431390.html , https://newsletter.failory.com/p/why-artifact-failed |
| **Arc Search "Browse for Me"** | One query → a *generated page*: highlights at the top, then expandable sub-sections, with a "Dive deeper" source list. Critics say the link between claims and sources is too weak. Later updates added tappable follow-ups that append "Learn more" sections. | This is the template for **Pull**: an *instantly generated document* (dossier) rather than a chat reply. Fix Arc's weakness with **claim-level citations**. | https://www.inverse.com/tech/arc-search-ios-app-interview-lead-designer-engineer , https://ia.acs.org.au/article/2024/is-arc-search-the-future-of-web-browsing-.html , https://resources.arc.net/hc/en-us/articles/23528454620311 |
| **Perplexity** | **Layered citations**: a marker in the text (numbers or domain chips, depending on the version), then a hover/tap preview card, then a full source browser. Hover cards **fail on touch devices**, so tap fallbacks are required. | Use three citation layers: inline chip → bottom-sheet preview (with filing page number and highlighted quote) → full PDF. Build for tap, not hover. | https://aiuxplayground.com/teardowns/perplexity/citations , https://www.925studios.co/blog/perplexity-design-breakdown , https://www.shadcn.io/ai/inline-citation |
| **Bloomberg mobile** | The 2016 rebuild moved to bottom tabs and a personalised top of **3–5 stories that change with time of day and region**. In 2026 it added a Stream (video) tab and an **ASKB** AI tab in Bloomberg Professional mobile. | "3–5 stories, time-aware" is the professional-grade precedent for the "few things" cap. ASKB as a *tab* shows the pro world bolting chat on beside the feed. FINN should integrate it instead. | https://digiday.com/media/apps-new-magazines-bloombergs-doubling-apps/ , https://fintech.global/?p=252857 |
| **Robinhood (Cortex Digests)** | AI "why is this stock moving" summaries on each stock's detail page. They draw on news, analyst reports, technical signals and Robinhood's own data. 95% satisfaction is a company claim. | The **"Move" card** pattern: price move → most likely cause → confidence. Keep it to one sentence. | https://robinhood.com/us/en/newsroom/digests-by-robinhood-cortex-uk , https://tech.eu/2025/08/19/robinhood-launches-stock-picking-ai-summaries/ |
| **Public.com (Alpha)** | Swipe down on any stock page to open Alpha (AI), and hover any chart on the web. "Why is it moving" cards reportedly surface automatically on sharp moves **[secondary source]**. Heavy disclaimers about accuracy. | A gesture-to-explain shortcut. Surface the explanation *only* when a threshold is crossed, which is exactly FINN's alert model. | https://help.public.com/en/articles/9354354-what-is-alpha , https://public.com/alpha |
| **Koyfin mobile** | A compact version of the web app. One screen shows gainers/losers and all watchlists. Detail view for watchlists, price and press-release alerts, watchlist news, iOS home-screen widgets. | Good density benchmark for tables. As a triage model it is a **dashboard**: it shows everything and prioritises nothing. That is what FINN must *not* be. | https://www.koyfin.com/help/mobile-app-feautres , https://www.koyfin.com/help/release-notes/v3-86-home-screen-widgets-ios/ |
| **Quartr** | Live calls with real-time transcripts, alerts when followed companies go live, keyword search across *all* transcripts, podcast-style playback at variable speed. Pro tier adds AI chat, highlighting and keyword alerts. | Transcript search as a primitive. Each "promise" in FINN should deep-link to a **timestamp/page** in the concall, the way Quartr anchors to transcript lines. | https://quartr.com/features/live-earnings-calls , https://quartr.com/products/mobile-app |
| **Granola** | **Your notes in black, AI additions in grey**. Editing a grey line turns it black. Notes link to the transcript for fact-checking. | A visual grammar for **provenance**: filed facts in full-contrast ink, FINN's inference in secondary ink, the investor's own notes in accent. This is a real differentiator and cheap to build. | https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes , https://granola.ai/blog/announcement , https://techcrunch.com/2024/05/22/granola-debuts-an-ai-notepad-for-meetings |
| **Readwise Reader** | **Feed** (automatic, Unseen/Seen) vs **Library** (Inbox/Later/Archive): items move to Library only when kept. Feed swipe UI: up = next, down = back; scrolling past marks an item seen, which clears the feed fast. Aug 2026 update: Ghostreader chat can triage the inbox. | **Separating Feed from Library** is the right model for Push vs saved research: Push items expire, and saved dossiers persist. "Scroll past = seen" is a cheap, satisfying triage. | https://docs.readwise.io/reader/llms.txt , https://blog.readwise.io/the-next-chapter-of-reader-public-beta/ , https://readwise.io/reader/update-aug2026 |
| **Inshorts (India)** | Full-screen 60-word cards with a headline and image, swiped vertically. A link at the end goes to the full story. Founder's rationale: "a person decides within two sentences whether the story is interesting." | An **Indian user's familiar grammar** for short news. Steal the word budget (headline ≤ 8 words, body ≤ 40 words), not the full-screen one-card-at-a-time layout, because an investor needs to *compare* items. | https://startuptalky.com/inshorts-startup-story/ , https://www.theweek.in/webworld/features/startersbloc/inshorts-startup.html |
| **Tinder/Stories card stacks** | One card per screen. Swipe to dismiss or keep. Progress bars across the top (Stories). | **Great for a 60-second "catch-up" mode** with 3–5 cards and a progress bar. **Bad as the home screen**: you can't see what's next, there's no comparison, gestures aren't discoverable, and accidental swipes destroy items. Use it as an optional "Play brief" mode only. **[unverified, design judgement]** | — |

### 1.2 Which models fit "few things that matter, rest buried"?

| Model | Fit | Why |
|---|---|---|
| **Finite edition / brief** (Pulse, Bloomberg top 3–5, Things Today) | **Best** | It has an end. It caps attention and ranks explicitly. Routine items fold into one line. |
| **Triage inbox** (Superhuman, Linear, Reader Feed) | **Strong for the action layer** | Snooze-until-event and mark-as-noted give the investor control. The risk is that it feels like work, so the brief should be read, not processed. |
| **Story clustering** (Particle) | **Essential underneath** | It turns 6 filings into 1 event and makes the count of items honest. |
| **Generated page** (Arc, Perplexity) | **Best for Pull** | One query produces a document, which is better than a conversation for research. |
| **Card stack / Stories** (Inshorts, Tinder) | **Secondary mode** | Good for "brief me in 60s", bad for scanning and comparing. |
| **Dashboard / watchlist** (Koyfin, Robinhood home) | **Poor** | It shows everything and buries nothing. It's the obvious answer, and the brief explicitly asks for more. |
| **Pure chat** | **Poor for Push, OK for follow-ups** | See §2.4. |

**Design principle derived from these:** *rank → cap → fold → end*. Rank by materiality, cap the lead set at 3 (soft max 5), fold everything else into counted, grouped lines, and draw a visible end ("· end of edition ·"). The end is the product's promise: once you reach it, you've seen everything that matters.

---

## 2. Conversational and agentic UI patterns, 2025–26

### 2.1 Generative UI (structured cards inside chat)
- **MCP Apps** became the first official MCP extension in Jan 2026. It standardises the interactive-UI-in-conversation patterns pioneered by MCP-UI and OpenAI's Apps SDK, and ChatGPT reportedly implements it. https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ , https://mcp.directory/blog/mcp-apps-standard-vs-openai-apps-sdk-2026
- **Vercel AI SDK** maps a tool call's result to a React component (the "generative UI" pattern). The older `streamUI` RSC approach is experimental with development paused. The supported path is tool-result → component, plus an `experimental_MCPAppRenderer`. https://vercel.com/kb/guide/ai-sdk-mcp-apps , https://ai-sdk-patterns.vercel.app/patterns/generative-ui
- **Implication for FINN:** don't let the model generate layout. Let it fill **typed components**: `ResultsCard{metrics[4]}`, `PromiseLedger{promises[], quarters[4]}`, `PersonPath{hops[]}`, `BullBear{bull[3], bear[3]}`. The LLM returns JSON and the UI is hand-designed. This is the single biggest lever against slop: the model writes content, a designer owns form.

### 2.2 Citations UX
- **Perplexity:** inline marker → preview card → source browser. Build tap fallbacks because hover fails on touch (links in §1.1).
- **NotebookLM:** answers are grounded only in the user's uploaded sources, with numbered citations that jump to the source passage **[citation behaviour from memory, unverified]**. Audio Overviews come in **Deep Dive / Brief / Critique / Debate** formats. **Interactive mode** lets you press Join and ask the hosts questions aloud; they answer from the sources and then resume. https://www.techradar.com/ai-platforms-assistants/gemini/google-notebooklms-ai-podcast-hosts-can-now-get-into-an-argument-over-your-notes , https://www.androidauthority.com/notebooklm-new-audio-overview-formats-3593717
- **Hebbia Matrix:** documents are rows, questions are columns, and agents fill each cell with a cited answer linked to the exact page/paragraph of the source PDF. 2026 added a Workflow view and source columns. https://dynamicbusiness.com/ai-tools/hebbia-revolutionizes-ai-interface-meet-the-matrix.html , https://www.hebbia.com/blog/the-disclosure-march-2026
  - **FINN translation:** the "promised vs delivered" view *is* a Hebbia matrix turned sideways: rows are promises, columns are the 4 quarters' transcripts/results, and each cell is a cited verdict. That framing makes the hardest screen feel principled rather than invented.
- **FINN citation rule:** every number and every quote carries a **source chip**, e.g. `Q2FY27 call · p.7` or `AR FY26 · p.142`. Tapping it opens a bottom sheet with the highlighted excerpt and an "Open PDF at page" link. The brief restricts Pull to annual reports and concall transcripts, so the citation system is also the proof that the product respected the constraint.

### 2.3 "Ask anything" box, suggested prompts, voice
- **Ask box:** keep it, but at the bottom in the thumb zone, as the *secondary* entry point. Suggested prompts must be **contextual and specific**, e.g. "Why did margin fall while volume rose?" rather than "Summarise this company". Context-free suggestion chips are a slop tell.
- **Voice briefings:** the NotebookLM team's **Huxe** turns email, calendar and interests into a daily audio briefing you can interrupt with questions. Apple licensed Huxe's technology in Oct 2026, a signal that "interruptible personal audio brief" is going mainstream. https://techcrunch.com/2025/09/23/former-notebooklm-devs-new-app-huxe-taps-audio-to-help-you-with-news-and-research , https://www.iclarified.com/102723/apple-strikes-ai-audio-deal-with-huxe-founded-by-former-notebooklm-developers
- **FINN translation:** a **"Brief me · 60s"** button that reads the edition aloud with the browser's `speechSynthesis`, or pre-rendered TTS. That's cheap and demoable, and fits an investor on a commute. Interrupt-to-ask is a stretch goal.

### 2.4 When chat is the WRONG primary model for investors
Wattenberger's argument: a bare text box has unclear affordances, and interfaces should show what they can do. https://wattenberger.com/thoughts/boo-chatbots (see also https://allenpike.com/2025/post-chat-llm-ui). For FINN specifically, chat is wrong when:
1. **Monitoring a known set.** The 15–20 holdings are a fixed list, so the system should *tell* the investor what changed. Making them ask "anything new on X?" eighteen times is backwards.
2. **Comparing across time.** QoQ/YoY and promise-vs-delivery are tables. Paragraphs bury the comparison.
3. **Repeat daily use.** A blank box costs effort every morning. A brief costs none.
4. **Verification-heavy work.** Fund managers must check claims. Chat answers mix fact and inference in one undifferentiated voice, while structured cards can separate filed fact (ink) from inference (grey), as Granola does.
5. **Low-attention moments** (between meetings, in a car). Glance or listen beats type.

**Chat is right for:** a new company in Pull ("Do a quick dossier on X"), follow-ups on a card ("Why?"), and **network questions** ("Who do I know who has run a cement plant?"), as Happenstance does in natural language (§3).

---

## 3. Network visualisation UX

### 3.1 How the incumbents show relationships
- **Affinity:** relationship strength is a **10–100 score** from the **recency and frequency** of email/meeting interactions. It uses metadata, not message content. Below 40 is weak, above 70 strong. A contact's *Connections* tab ranks colleagues by strength as intro paths. https://support.affinity.co/s/article/Relationship-intelligence , https://support.affinity.co/features/ri/leveraging-your-connections-and-relationship-strengths , https://www.affinity.co/blog/which-relationships-drive-warm-introductions
- **4Degrees:** relationship strength scoring to find "your best intro to a company, investor, or industry expert"; work-history capture; recurring keep-in-touch cadences; alerts on job changes/news (vendor-described). https://4degrees.ai/relationship-intelligence , https://www.4degrees.ai/blog/8-ways-deal-driven-teams-benefit-from-a-relationship-intelligence-platform
- **Happenstance:** natural-language search over *your own* network (Gmail, Calendar, LinkedIn and others), e.g. "Who can introduce me to someone at Stripe?". Results come back as a **ranked list of people, each with a reason for the match**, ordered by how well you know them. https://happenstance.ai/about , https://happenstance.ai/guides/ai-people-search
- **Clay / Dex (personal CRM):** Clay's **Reconnect** surfaces a contact's card on Home after a period of silence, with per-contact or automatic cadence driven by synced interactions. Reviewers call it the best feature. Dex has a keep-in-touch kanban board. https://geekflare.com/software/clay-review/ , https://getdex.com/blog/top-10-best-personal-crm-apps-in-2026-to-up-your-networking-game
- **LinkedIn:** 1st/2nd/3rd-degree badges next to names, "N mutual connections" with stacked avatars, and "Ask for a referral" **[from memory, unverified]**.

**The common pattern:** **ranked list + reason + strength as words/recency, with a path shown as a breadcrumb.** None of the serious tools lead with a graph.

### 3.2 Why force-directed maps fail on mobile
- Dense networks become **hairballs**. Even backbone layouts turn one large hairball into several smaller ones. https://cambridge-intelligence.com/layouts , https://erdogant.substack.com/p/radialgraph
- Research on multivariate networks on mobiles needs bounded layouts to avoid panning, plus separate filter and detail views, and notes that force-directed layout is **computationally expensive**, especially when the user changes things. https://mt.inf.tu-dresden.de/cnt/uploads/Horak2020MultivariateNetworksOnMobiles.pdf
- **[design judgement, unverified]**: on a 390 px screen, labels collide, tap targets fall below 44 pt, the graph answers "what does my network look like?" (a vanity question) instead of "whom do I call about *this*?" (the investor's question), and it reads as a demo, not a tool. It's the network version of a gradient blob.

### 3.3 Better alternatives for FINN
| Pattern | Use | Example |
|---|---|---|
| **"Via" breadcrumb / path chips** | Second-degree reach | `You → Rohan Shah (strong · met 3w ago) → Sanjay Rao (CFO)` |
| **Single "network line" on a Push card** | Network inside Push | `◦ Rohan worked under the outgoing CFO for 4 yrs at Polycab — call him` |
| **People card** | Diligence on a person | Role history, where they overlap with your contacts, mentions in filings, last interaction |
| **Expertise map as grouped list** | "Who knows cement?" | Topic headers with counts: `Cement · 4`, `Cables & wires · 2`, then ranked rows |
| **Radial ego view (only if a visual is needed)** | Pull: "reach into Company X" | Up to 2 rings, ≤ 8 nodes, fixed layout, no physics. Ring 1 = your contacts, ring 2 = people at X they know (RadialGraph's local mode, see above) |
| **Reconnect nudge tied to an event** | Reconnect | `You haven't spoken to Anil in 7 months. His old employer just reported Q2: a natural reason to call.` |

### 3.4 What the Network should *notice* (the "quiet advantage")
These are the moments that answer "show us what it notices that the investor wouldn't". Each is a cross-reference between a filing and the contact graph:
1. **People in filings ∩ your contacts' work histories.** A KMP/director appointment or resignation where the person overlaps with a contact (same employer, same years) produces "You know someone who worked with the new CFO."
2. **Claim → verifier.** Management says in a concall, "Gujarat plant utilisation will hit 85% by Q4". A contact who ran operations at a Gujarat plant until 2023 gets surfaced in the guidance row as "Meera can sanity-check this".
3. **Counterparties named in filings.** An order win from a named customer where a contact is a senior employee there.
4. **Reach on a Pull target.** "You have 3 second-degree paths into Company X; the strongest is via Rohan."
5. **Decay with a reason.** Reconnect nudges only when there's a *reason* (an event at their company or sector). Calendar-based nudges alone are what a contact list does.

Strength should be shown as **words plus recency** ("strong · met 3 wks ago · 14 meetings"), not a bare number. An Affinity-style score can drive ranking under the hood.

---

## 4. Financial data on small screens

### 4.1 QoQ / YoY for 4 metrics, compactly
Recommended pattern: a **4-row micro-table**, tabular figures, right-aligned, with a 5-quarter sparkline per row.

```
               Q2FY27     YoY     QoQ   5Q
Revenue      1,642 cr    +11%     +4%   ▂▃▄▅▇
EBITDA m.       14.1%  −190bp   −60bp   ▇▆▅▄▃
PAT            118 cr     −8%     −3%   ▅▆▆▄▄
Volume          92 kt    +17%     +6%   ▂▃▅▆▇
```
Rules:
- **Margins move in basis points (bp), not %.** "−190bp" is how Indian sell-side writes it, and using % here is a credibility tell **[convention from memory, unverified]**.
- **Indian units:** ₹ crore ("cr") and lakh, Indian digit grouping (1,23,456) where showing raw numbers, and **FY = April–March** with **Q2FY27 = Jul–Sep 2026** **[unverified]**. Today (10 Nov 2026) falls inside Q2FY27 results season. SEBI LODR requires quarterly results within 45 days of quarter-end, i.e. by ~14 Nov. So demo data and the default "last 24h" window will naturally be full of results filings. https://www.multibagg.ai/feeds/management-guidance-earnings-calls-cmudzbqxv000404l5f2fyu9fg
- **The 4th metric is sector-specific:** volume for manufacturers, NIM/GNPA for banks, ARR/attrition for IT, order book for capital goods. A fixed "Revenue, EBITDA, PAT, EPS" set is the template answer.
- **Sparklines:** 5 points, no axes, last point emphasised (dot). 48×16 px. A hand-rolled SVG path is enough, with no chart library.
- **Columns:** `font-variant-numeric: tabular-nums` so digits align. Right-align numbers, left-align labels.
- **Deltas:** sign + arrow/glyph + colour, never colour alone (see 4.4).

### 4.2 "Promised vs delivered" scorecards: precedents
- **Inve Promise Tracker** (India): a per-company "commitment ledger" of what was **guided, delivered, missed, and what went silent**, each with the management quote attached. It flags "a target quietly goes silent" as a red flag, with Eternal as the example. https://speakerdeck.com/invemoney/7-red-flags-to-catch-on-a-concall-management-quality-warning-signs (the tracker URL inve.money/promise-tracker/concalls returned HTTP 429 when fetched, so it couldn't be inspected directly)
- **Multibagg** recommends a guidance table: **metric | guided range (date) | reported (date) | company's own variance explanation**, with **revision tags: retained / raised / narrowed / cut**, and basis notes (currency, one-offs, organic). https://www.multibagg.ai/feeds/management-guidance-earnings-calls-cmudzbqxv000404l5f2fyu9fg
- **Zerodha's The Chatter** quotes management on their own say/do track record. Marico's "first do and then say" is a useful example of tone. https://thechatter.zerodha.com/p/the-chatter-bets-and-blueprints
- **Hebbia Matrix** gives the grid-with-citations interaction (§2.2).

**FINN's scorecard design** (wireframe in §9.4):
- Rows = promises (max ~6 visible), columns = last 4 quarters, cells = status glyph.
- **Five statuses:** `●` delivered/on track · `◐` partly · `○` missed · `—` **went silent** (not mentioned) · `↻` revised (goalposts moved). Silent and Revised are the insight. Most tools only do hit/miss.
- A header summary like "Delivered 4 · Partly 2 · Missed 2 · Went silent 1" with **no composite credibility score** (a single number invites false precision). Or show it greyed with an explanation.
- Tapping a row expands it: the original quote (speaker, quarter, page), the delivered numbers per quarter, and the latest management language, plus a one-line verdict such as "Goalposts moved: band reframed as 'medium-term' in Q2FY27".
- **Network hook** in the expanded row: "Who can verify this?" → a person card.

### 4.3 Materiality badges
- Ground the badges in **SEBI LODR Reg 30**. **Schedule III Para A** events are *deemed material*, with no materiality test: e.g. acquisitions/mergers, changes in directors/KMP/auditors, credit rating changes, fraud/defaults, and cybersecurity incidents since 2023. **Para B** events are disclosed only if they pass the Reg 30(4) materiality test, including the 2%-turnover / 2%-net-worth / 5%-PAT quantitative threshold **[percentages from memory, unverified against current consolidated text]**. https://taxguru.in/sebi/sebi-lodr-regulation-2015-regulation-30-30a-explained.html , https://assets.kpmg.com/content/dam/kpmg/in/pdf/2023/08/firstnotes-sebi-amends-disclosure-requirements-of-material-events-or-information.pdf
- **FINN tiers** (text badges, small caps, no icons):
  - `MATERIAL`: Para A categories plus FINN's own rules (CFO/CEO/auditor exit, rating downgrade, pledge increase).
  - `RESULTS`: its own lane during results season.
  - `MOVE`: price/volume threshold breaches (EOD volume > 2× 20-day average, |price| > X%).
  - `NOTABLE`: Para B items above threshold, order wins, capex.
  - `ROUTINE`: folded. Typical members are trading-window closures, Reg 74(5) certificates, newspaper publications, analyst/investor meet intimations, and duplicate-copy share certificates **[category list from memory, unverified]**.
- **Explainability:** a long-press, or a "why this ranked" link, shows the rule that fired: "Material: KMP change (Reg 30, Para A) + within 10 days of results + 2nd CFO exit in 26 months".

### 4.4 Colour semantics and accessibility
- **India uses green = up, red = down** (like the US, unlike China/Japan/Korea where red = up) **[from memory, unverified, but consistent with Zerodha Kite/Groww UIs]**. The Futubull case study confirms the red/green convention varies by market and is a barrier for colour-blind users. https://developer.android.com/stories/apps/futu
- **Never colour alone.** Pair it with sign, arrow or glyph ("+2.3% ▲"). A red/green colour-blind user described colour-only leaderboards as "really hard to distinguish". https://visualisingdata.com/?p=17308 , https://forum.numer.ai/t/can-we-get-up-down-arrows-back-in-the-leaderboard/6548 , https://dev.to/alvaromontoro/don-t-use-color-to-convey-content-2ai1
- Investing.com ships an orange/green colour-blind palette, a precedent for a settings toggle. https://www.investing.com/studios/article-383265
- **Contrast:** WCAG AA requires 4.5:1 for body text and 3:1 for large text and UI glyphs **[WCAG thresholds well established; not re-fetched]**. Saturated green on white often fails, so use darker green (#0F7B3F-ish) in light mode and lighter (#3FBF7F-ish) in dark mode **[hex values illustrative]**.
- **Dark mode** is default-worthy for a pre-market and late-evening tool, but ship both via `prefers-color-scheme`. In dark mode, desaturate the red/green and raise their lightness.
- **Tabular figures:** `font-feature-settings: "tnum"` / `font-variant-numeric: tabular-nums`. Inter, Geist and IBM Plex all support it **[unverified per-font, widely known]**.
- **Touch targets** ≥ 44×44 pt. Gestures always need a visible tap alternative.
- **Reduced motion:** honour `prefers-reduced-motion` for card transitions.

---

## 5. Stack for building fast and beautifully (late 2026)

| Layer | Recommendation | Evidence / caveat |
|---|---|---|
| **Framework** | Next.js (App Router) or Vite + React, deployed on Vercel as a **PWA** | — |
| **Styling** | **Tailwind CSS v4.x.** v4.2 shipped ~Feb 2026; v4.3 (scrollbar utilities, new colours) is the latest seen | https://tailwindcss.com/blog/tailwindcss-v4-3 , https://laravel-news.com/tailwindcss-4-2-0 |
| **Components** | **shadcn/ui.** **Base UI became the default primitive library in July 2026.** Radix is still supported, and existing projects keep their base. AI Elements components still assume Radix APIs, so stay on Radix if you use them | https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default , https://ui.shadcn.com/docs/changelog/2026-01-base-ui , https://skills.sh/vercel-labs/vercel-plugin/shadcn |
| **Bottom sheets** | **Vaul's README says the repo is unmaintained.** It still works and shadcn's Drawer historically wraps it **[current shadcn Drawer internals unverified]**. Pin the version, or use the `base-vaul` port, or a Motion-driven sheet. For a prototype, pinned Vaul is fine | https://github.com/emilkowalski/vaul |
| **Motion** | **Motion** (formerly Framer Motion, independent since Nov 2024; import from `motion/react`). Use it for layout animations (expand card → sheet), drag-to-dismiss and swipe actions. Latest version unclear (12.x–13.x) | https://motion.dev/blog/introducing-motion , https://motion.dev/docs/react-migration |
| **Charts** | **Hand-rolled SVG** for sparklines and glyph grids (the only charts the design needs). If you need a real chart (price with event markers), use **visx** (composable, small) or **uPlot** (very fast, tiny). **Recharts** is easiest but heavy and looks templated by default **[size/perf characterisations from memory, unverified]** | — |
| **Type** | UI: **Geist** or **Inter**, with tabular numbers. Note that slop catalogues list Inter as a default "generic" font. To feel editorial, pair it with a **serif for headlines** (e.g. Newsreader or Source Serif 4 on Google Fonts) and **Geist Mono / JetBrains Mono** for tickers and figures | https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026 |
| **Icons** | One set (Lucide or Phosphor), used sparingly. **No emoji** | https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list |
| **AI → UI** | Model returns typed JSON (zod schemas), rendered by hand-built components. Vercel AI SDK tool-result → component pattern | https://vercel.com/kb/guide/ai-sdk-mcp-apps |

### 5.1 PWA install and iOS web push (verified for 2026)
- **iOS 26 / iPadOS 26:** every site added to the Home Screen **opens as a web app by default**, with an "Open as Web App" toggle that's on by default. No manifest `display` value is needed for standalone. https://heise.de/-10749652 , https://webkit.org/?p=16993 , https://www.macrumors.com/2025/06/18/safari-changes-on-ios-26/
- **Web push on iOS** needs **iOS/iPadOS 16.4+** and the web app **must be installed to the Home Screen first**. A Safari tab can't subscribe. HTTPS, a manifest and a service worker are needed (except with Declarative Web Push). The permission prompt must come from a user gesture inside the installed app. The Simulator doesn't support it, so test on a device. Other iOS browsers can't do web push. https://documentation.onesignal.com/docs/web-push-for-ios , https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide , https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications
- **Declarative Web Push** (iOS 18.4+, installed web apps only): push without a service worker, via `window.pushManager`. Mac needs Safari 18.5. Now a W3C Working Draft. https://webkit.org/?p=16535 , https://pushpad.xyz/blog/declarative-web-push , https://aimtell.com/blog/state-of-declarative-web-push-2026
- **Users complain** that adding to the Home Screen takes more taps in iOS 26. Ship a one-screen illustrated "Add to Home Screen" coach mark. https://mjtsai.com/blog/?p=49472
- **Prototype implication:** most evaluators won't install the app. So **simulate push in-app**: a "Lock screen preview" toggle that shows how the CFO-exit alert would look as an iOS notification, deep-linking into the card. Offer real web push as a bonus for anyone who installs. Android Chrome push works without install **[well-known, not re-verified]**.

### 5.2 Expo vs PWA for "easy to try on a phone"
- **Expo Go, Oct–Nov 2026:** the SDK 58 Expo Go "comes to the App Store and Google Play in the next few weeks" and **supports only SDK 58** (post dated 21 Oct 2026). https://expo.dev/blog/how-to-upgrade-to-sdk-58
- Earlier in 2026, SDK 55's Expo Go sat awaiting Apple approval for months. Expo pointed developers to **`eas go`**, which builds your own Expo Go and delivers it via **TestFlight**, **requiring an Apple Developer Program membership**. The public TestFlight group was at capacity. Expo calls Expo Go "first and foremost an educational tool". https://expo.dev/changelog/expo-go-and-app-store-may-2026
- On physical iOS devices, only the latest Expo Go version can be installed. https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough.md
- **Verdict: PWA.** An evaluator taps one URL and FINN is running. Expo adds a store-version-matching problem, a QR-code dance, and possibly a TestFlight invite, all of which are friction an evaluator won't push through. Native gestures matter less than reach here. Thin-but-working beats broad-but-broken.

---

## 6. "AI slop": what makes AI products feel templated, and rules to avoid it

### 6.1 Observed tells
From slop catalogues and designer critiques (https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026 , https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list , https://www.superdesign.dev/blog/why-ai-design-looks-generic , https://builtin.com/articles/ai-design-slop-era , https://pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated):
- **Visual:** purple/indigo gradients, glassmorphism, 3D blobs, the centred hero plus three cards, **thick coloured left border on rounded cards** ("the single most recognizable signature"), emoji as icons, default Inter/Roboto, everything rounded-2xl with drop shadows, decoration stacked on decoration (glow + shadow + motion).
- **Content [design judgement, partly unverified]:** emoji bullet walls ("🚀 Key Highlights"), "Key takeaways:" headers, generic summaries that restate the title, hedging ("It's important to note…", "may potentially"), symmetrical bull/bear lists of 5 vague points each, sentences that could apply to any company ("strong fundamentals, robust growth"), relative dates ("recently"), and numbers without units or periods.
- **Interaction:** a chat box as the whole product, "✨ AI" sparkle buttons, loading spinners with "Thinking…", the same suggested prompts everywhere.

### 6.2 Concrete rules for FINN (adopt as a lint checklist)
1. **Every headline carries a verb and a fact.** "CFO resigns 9 days before results", not "Management Update". ≤ 8 words.
2. **"Why it matters" is ≤ 2 lines and must contain a number or a comparison** (vs history, vs guidance, vs peers). If there isn't one, cut the line.
3. **No emoji. No sparkles. No gradients.** One accent colour. Red/green reserved for direction only, and status glyphs reserved for status only.
4. **Every number has a unit and a period:** "₹1,642 cr · Q2FY27", "−190bp YoY".
5. **Absolute times and dates:** "07:41", "19 Nov", never "recently".
6. **Every claim has a source chip** with page/timestamp. No chip, no claim.
7. **Provenance ink (Granola):** filed facts in primary ink, FINN's inference in secondary ink with an "inferred" marker, the investor's notes in accent.
8. **Say "nothing material" with confidence.** An empty edition reads: "Quiet night. 14 routine filings, nothing material. Next scheduled: SHREEJI results, 19 Nov." Never pad.
9. **Bull/bear is asymmetric and specific:** max 3 each, each tied to a number or a quote. If the bear case is stronger, show more bear.
10. **No hedging language.** State confidence once, structurally (e.g. "Low confidence: no transcript for Q1FY27"), not in every sentence.
11. **Sector-aware metrics** (§4.1). A uniform template across sectors is what a model filling a template looks like.
12. **Flat cards with hairline dividers**, not floating rounded shadow boxes. The look is closer to the FT/Bloomberg print grid than to SaaS cards.
13. **Typography does the hierarchy:** size/weight/ink, not boxes, borders and badges.
14. **Motion only explains state change** (expand → sheet, dismiss → fold count increments). Nothing animates on idle.

---

## 7. Design principles (the POV)

1. **An edition, not a feed.** It starts, it ends, and the end means you're done.
2. **Rank, cap, fold.** Three leads, a counted "more" row, and a folded routine row. The brief literally asks to "bury everything else, beautifully", and the fold row *is* the beautiful burial.
3. **Write implications, not titles.** The filing subject is metadata, and the headline is what changed.
4. **Every claim one tap from its source.**
5. **People appear where they're useful.** The network is a line on the card, never a destination.
6. **Track the say/do gap.** Management credibility is the investor's edge, and FINN does the bookkeeping.
7. **Chat is the escape hatch, not the front door.**

---

## 8. Three interaction concepts

### Concept A: "The Edition" *(recommended)*
- **POV:** *An investor shouldn't browse their portfolio. They should be briefed on it, like a chief of staff handing over one page, and then be allowed to stop.*
- **Home screen:** a dated edition ("Tue 10 Nov · since 6:00 pm yesterday ▾") showing **3 lead items** ranked by materiality: Material / Results / Move cards. Below them, "N more worth a glance" (collapsed), then "N routine filings folded" (one line with grouped counts), then "· end of edition ·". A bottom dock holds the Ask bar plus "Brief me · 60s".
- **Push:** the edition *is* Push. The window chip switches 24h / since last open / 7d. Thresholds are set in "What counts as material?", a plain-language settings sheet with toggles per announcement type, a volume multiple slider (2×) and a price ± slider. Swipe a card right for Noted (it folds into "Seen") or left for Snooze until… (next results / ±5% move / tomorrow). Both have tap equivalents. A lock-screen preview shows how alerts arrive.
- **Pull:** the Ask bar, or tapping any ticker, opens a **Dossier**, a generated page (Arc-style) with section tabs: Snapshot · Trajectory · Balance sheet · Cash · Narrative vs numbers · **Promises** · Bull/Bear. Every figure has a source chip. Follow-up questions append sections rather than starting a chat thread.
- **Network:** (1) a single "◦" network line on Push cards when a contact is relevant; (2) a "Who can verify this?" line inside Promises rows; (3) a "Your reach" section at the bottom of a dossier with via-breadcrumbs; (4) reconnect nudges appear in the edition *only with an event reason*, max 1 per day.
- **What's surprising:** it *ends*. There's a visible "end of edition", plus routine items buried with a counted fold. The network notices cross-references (the new CFO's ex-colleague is your contact). The 60-second audio brief.
- **Build complexity:** **3/5.** It's mostly static layout over typed JSON. The hard part is the ranking rules and extracting data from filings, which other workstreams own.
- **Risk:** it can look "just like a nice list" if the copy is weak. The writing quality of headlines and "why it matters" carries the concept. Mitigation: hand-tune 6–8 hero cards for the demo, and use a strict copy schema.

### Concept B: "The Ledger" (say–do first)
- **POV:** *The only thing that compounds in public markets is trust in management, so every filing should be read against what management promised.*
- **Home screen:** the portfolio as a **credibility grid**. Each holding is a row showing its last-4-quarter promise glyphs (●◐○—) and a one-line "what changed today", sorted by *change in credibility*, not by price. Tapping a holding opens its ledger.
- **Push:** each new filing is classified as **confirms / contradicts / unrelated** to an open promise. "Odisha plant commissioned" ticks the promise row, while "Capex deferred" flips a row to ○ and goes to the top. Unrelated routine items are invisible by default.
- **Pull:** for a new company, FINN builds the ledger from 4 transcripts plus the annual report, then the rest of the dossier.
- **Network:** "verifiers" are attached to promises: contacts with domain or company exposure who can test the claim.
- **What's surprising:** it inverts the dashboard, so the home screen shows management behaviour, not prices. Very much a "point of view".
- **Build complexity:** **4/5.** Extracting promises and judging them reliably across 4 quarters × 18 companies is a heavy LLM + evaluation lift. Push classification against promises adds a second model step.
- **Risk:** *broad-but-broken*. If extraction is noisy the whole home screen is wrong. It also under-serves plain Push needs (volume spikes, price moves, routine news).

### Concept C: "Earpiece" (voice-first desk)
- **POV:** *Fund managers consume information walking between meetings. FINN should talk to them like a junior analyst on the phone.*
- **Home screen:** one large **Play today's brief (1:48)** control with a live transcript that highlights cards as they're spoken (karaoke-style), chapter chips per company, and a hold-to-interrupt mic ("Why did margin fall?"). Cards stack below as the visual record.
- **Push:** the brief is generated per window, and threshold alerts arrive as short audio push.
- **Pull:** spoken questions return a spoken answer plus a dossier card. Promises render as a visual grid because audio can't show a table.
- **Network:** spoken suggestions like "Rohan worked with the outgoing CFO. Want me to draft a WhatsApp?"
- **What's surprising:** no-hands use. Follows the NotebookLM → Huxe → Apple trajectory.
- **Build complexity:** **4–5/5.** Mobile Safari speech recognition/TTS is uneven, and demo fragility is high (permissions, noise, latency) **[iOS Web Speech reliability unverified]**.
- **Risk:** evaluators review in a quiet office on a laptop, so voice may not even get tried. Hard to show density, and tables don't read aloud.

### Comparison

| | A · Edition | B · Ledger | C · Earpiece |
|---|---|---|---|
| Fits "few things, rest buried" | ●●● | ●●○ | ●●○ |
| Shows a POV | ●●○ | ●●● | ●●● |
| Network inside Push/Pull | ●●● | ●●○ | ●●○ |
| Density + design | ●●● | ●●● | ●○○ |
| Thin-but-working feasibility | ●●● | ●○○ | ●○○ |
| Build complexity | 3 | 4 | 4–5 |

### Recommendation
**Build A, and borrow B's ledger and C's 60-second audio.**
- A is the most direct answer to the brief's central sentence ("surface the few, bury the rest, beautifully"). It's also the safest way to be *thin-but-working*, because each card is independently demoable.
- B's **Promises ledger** becomes the hero tab of every Pull dossier and the most-valued feature in the brief, so the POV ("track the say/do gap") still shows without staking the home screen on extraction quality. A light version of B's "confirms/contradicts promise" tag can appear on Results cards ("Margin guided 16–18%: 2nd consecutive miss").
- C's voice becomes **one button**, "Brief me · 60s", using TTS over the same edition JSON. That's a surprise for near-zero cost, and if it fails nothing else breaks.
- The **Network's quiet advantage** is delivered by 2–3 high-quality cross-references in the demo data (CFO ex-colleague, claim verifier, reach into a Pull target), not by a network screen.

---

## 9. ASCII wireframes (~390 px wide; illustrative, fictional companies and figures)

Legend: `●` delivered · `◐` partly · `○` missed · `—` went silent · `↻` revised · `◦` network line · `[p.4]` source chip · `›` drill-in.
Fictional tickers: NOVACAB (Nova Cables), SHREEJI (Shreeji Pipes), ORBITEL (Orbit Electronics).

### 9.1 Home: "The Edition"
```
┌──────────────────────────────────────────────┐
│ FINN                         Tue 10 Nov 09:12 │
│ Since 6:00 pm yesterday ▾          18 holdings│
│                                              │
│ 3 things matter                              │
│──────────────────────────────────────────────│
│ MATERIAL · NOVACAB · 07:41                   │
│ CFO resigns 9 days before Q2 results         │
│ 2nd CFO exit in 26 months. Interim is the    │
│ financial controller; no reason given.  [p.1]│
│ ◦ Rohan Shah worked under him for 4 yrs      │
│──────────────────────────────────────────────│
│ RESULTS · SHREEJI · Q2FY27 · yesterday 18:02 │
│ Volumes beat; margin misses guidance again   │
│ Rev   1,642 cr   +11% YoY            ▂▃▄▅▇   │
│ EBITDA  14.1%   −190bp               ▇▆▅▄▃   │
│ Guided 16–18% for FY27 · 2nd miss in a row   │
│──────────────────────────────────────────────│
│ MOVE · ORBITEL · close 14,880                │
│ −6.2% ▼ on 3.4× avg volume. No filing.       │
│ Likeliest cause: peer PLI disbursal delay    │
│──────────────────────────────────────────────│
│ 4 more worth a glance                      › │
│ 23 routine filings folded                  › │
│   Trading window 6 · Reg 74(5) 5 · Press 4 … │
│                                              │
│              · end of edition ·              │
│                                              │
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────┐ ◉  │
│ │ Ask about any NSE company…           │ mic│
│ └──────────────────────────────────────┘    │
│  ▶ Brief me · 60s      ⚙ What counts         │
└──────────────────────────────────────────────┘
```
Notes: no boxes around cards, only hairline rules; ink hierarchy does the work. "4 more" expands inline (NOTABLE tier). The routine fold expands into grouped rows, each with a count, never individual noise. Swipe right on a card = Noted, left = Snooze until…, and a long-press shows "why ranked".

### 9.2 Pushed management-change card (expanded into bottom sheet)
```
┌──────────────────────────────────────────────┐
│                    ─────                     │
│ MATERIAL · KMP change · Reg 30 Para A        │
│ NOVACAB  612.40  −2.1% ▼ today               │
│                                              │
│ CFO Sanjay Rao resigns,                      │
│ effective 30 Nov                             │
│                                              │
│ Out    Sanjay Rao · CFO since Mar 2024       │
│ In     Meera Iyer (interim) · Fin. Controller│
│ Filed  07:41 today · Q2 board mtg 19 Nov     │
│                                        [p.1] │
│ Why it matters                               │
│ 2nd CFO exit in 26 months (last: Sep 2024).  │
│ Lands 9 days before results. Auditor         │
│ unchanged. Reason given: "personal".         │
│ inferred ▸ Watch for a results-date shift.   │
│                                              │
│ KMP exits · last 3 yrs                       │
│  Sep'24 CFO ●   Jun'25 CS ●   Nov'26 CFO ●   │
│                                              │
│ ◦ Your network                               │
│ Rohan Shah → worked under Sanjay at          │
│ Polycab 2017–21 · strong · met 3 wks ago     │
│ [ Call Rohan ]  [ Draft a note ]             │
│                                              │
│ [Open filing]   [Ask why ›]   [ ✓ Noted ]    │
└──────────────────────────────────────────────┘
```
Notes: the "inferred ▸" line uses secondary ink (Granola rule). The person line is the Network quietly inside Push. The KMP timeline is a tiny pattern visual that turns one event into a trend.

### 9.3 Results card (expanded)
```
┌──────────────────────────────────────────────┐
│ RESULTS · SHREEJI PIPES · Q2FY27             │
│ Filed yesterday 18:02 · consolidated   [p.2] │
│                                              │
│ Volumes beat; margin misses guidance again   │
│                                              │
│               Q2FY27     YoY     QoQ    5Q   │
│ Revenue     1,642 cr    +11%▲    +4%▲ ▂▃▄▅▇  │
│ EBITDA m.      14.1%  −190bp▼  −60bp▼ ▇▆▅▄▃  │
│ PAT           118 cr     −8%▼    −3%▼ ▅▆▆▄▄  │
│ Volume         92 kt    +17%▲    +6%▲ ▂▃▅▆▇  │
│                                              │
│ Against what they said                       │
│ ○ EBITDA 16–18% FY27    14.1% · 2nd miss     │
│ ● Volume growth 15%+    +17% · on track      │
│                                   Promises › │
│ What moved it                                │
│ PVC resin cost +9% QoQ not passed through;   │
│ mgmt cites "channel destocking". [PR p.3]    │
│                                              │
│ ◦ Anil Desai (ex-Supreme Inds., channel)     │
│   last spoke 7 mo ago · good reason to call  │
│                                              │
│ Ask: Why are volumes up but margin down?   › │
└──────────────────────────────────────────────┘
```
Notes: the 4th metric is sector-specific (volume, for pipes). Margins in bp. "Against what they said" is the light Ledger integration. The reconnect nudge has an *event reason*.

### 9.4 Pull: "Promised vs delivered"
```
┌──────────────────────────────────────────────┐
│ ‹  SHREEJI PIPES               Dossier  ⋯    │
│ Snapshot  Trajectory  B/S  Cash  Promises ▸  │
│──────────────────────────────────────────────│
│ Promised vs delivered · last 4 quarters      │
│ Kept 4 · Partly 2 · Missed 2 · Went silent 1 │
│                                              │
│                        Q3   Q4   Q1   Q2     │
│                        FY26 FY26 FY27 FY27   │
│ EBITDA 16–18% FY27      ○    ◐    ○    ○  ↻  │
│ Odisha plant by Q4FY26  ◐    ●    ●    ●     │
│ Net-debt-free by FY27   ●    ●    ●    ●     │
│ Exports to 10% of rev   ●    ◐    —    —     │
│ Dealer count 4,000+     ●    ●    ●    ◐     │
│ No equity dilution      ●    ●    ○    ○     │
│──────────────────────────────────────────────│
│ ▾ EBITDA 16–18% for FY27                     │
│ Promised  Q3FY26 call, CEO:                  │
│ "We are confident of 16 to 18 percent        │
│  EBITDA for FY27."               [call p.4]  │
│ Delivered 14.8% · 15.6% · 14.7% · 14.1%      │
│ Now       Q2FY27: "maintain the band over    │
│ the medium term."                [call p.6]  │
│ ↻ Goalposts moved: FY27 → "medium term"      │
│                                              │
│ ◦ Who can verify: Anil Desai — ran channel   │
│   pricing at Supreme Inds. till 2024    ›    │
│──────────────────────────────────────────────│
│ ▸ Exports to 10% of revenue — went silent    │
│   Last mentioned Q4FY26. Not in Q1 or Q2.    │
└──────────────────────────────────────────────┘
```
Notes: glyphs are paired with colour (green ●, amber ◐, red ○, grey —) so the grid survives greyscale and colour-blindness. "Went silent" gets its own row callout because it's the insight competitors miss. Rows are tappable and expand one at a time. Every quote has a page chip. No composite credibility score.

---

## 10. Build notes for the design workstream (not code)
- **Copy schema per card:** `kicker(tier · ticker · time)`, `headline(≤8 words, verb+fact)`, `why(≤2 lines, must include number/comparison)`, `inferred?(1 line, secondary ink)`, `sources[]`, `network?(person, relation, strength, recency)`, `actions[]`.
- **Ranking rules (demo-tunable):** tier weight (Material > Results > Move > Notable > Routine), then recency, then a "surprise" multiplier (deviation vs history or guidance), then holding weight. Cap at 3 leads.
- **Demo-data strategy:** results season (Q2FY27, mid-Nov 2026) is the real context. Hand-pick 6–8 hero events that exercise every card type and every network-notice type. Keep the rest real or plausible routine filings so the fold count looks honest (20+).
- **Empty and edge states:** quiet night; a company with no concall transcript ("Promises unavailable: no transcripts filed for Q1FY27"); network with no match (say nothing, rather than "No contacts found").
- **One signature motion:** the card dismiss animates into the fold row, and its counter ticks +1. That makes "burying" visible and satisfying, in the spirit of Things' Magic Plus as the single crafted interaction.

---

## Sources (consolidated)
Triage and news: blog.superhuman.com/how-ceos-can-organize-their-inbox/ · linear.app/docs/inbox · linear.app/docs/snooze · linear.app/docs/triage · macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/ · courier.com/blog/developer-guide-to-ios-26-priority-notifications · 9to5mac.com/2025/10/27/ios-26-brought-back-a-controversial-ai-feature-heres-whats-new/ · macrumors.com/2025/07/22/ios-26-beta-4-notification-summaries/ · tomsguide.com/ai/chatgpt-pulse-is-here-now-ai-starts-the-chat-and-curates-your-feed · techcrunch.com/2024/11/12/particle-launches-an-ai-news-app-to-help-publishers-instead-of-just-stealing-their-work · techradar.com/computing/artificial-intelligence/a-news-app-is-using-ai-to-curate-clarity-over-clickbait · engadget.com/instagrams-founders-are-shutting-down-artifact-their-year-old-news-app-233431390.html · newsletter.failory.com/p/why-artifact-failed · inverse.com/tech/arc-search-ios-app-interview-lead-designer-engineer · ia.acs.org.au/article/2024/is-arc-search-the-future-of-web-browsing-.html · aiuxplayground.com/teardowns/perplexity/citations · shadcn.io/ai/inline-citation · digiday.com/media/apps-new-magazines-bloombergs-doubling-apps/ · fintech.global/?p=252857 · robinhood.com/us/en/newsroom/digests-by-robinhood-cortex-uk · help.public.com/en/articles/9354354-what-is-alpha · koyfin.com/help/mobile-app-feautres · quartr.com/features/live-earnings-calls · docs.granola.ai/help-center/taking-notes/ai-enhanced-notes · granola.ai/blog/announcement · docs.readwise.io/reader/llms.txt · readwise.io/reader/update-aug2026 · startuptalky.com/inshorts-startup-story/

Agentic UI: blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/ · vercel.com/kb/guide/ai-sdk-mcp-apps · dynamicbusiness.com/ai-tools/hebbia-revolutionizes-ai-interface-meet-the-matrix.html · hebbia.com/blog/the-disclosure-march-2026 · techradar.com/ai-platforms-assistants/gemini/google-notebooklms-ai-podcast-hosts-can-now-get-into-an-argument-over-your-notes · techcrunch.com/2025/09/23/former-notebooklm-devs-new-app-huxe-taps-audio-to-help-you-with-news-and-research · iclarified.com/102723/apple-strikes-ai-audio-deal-with-huxe-founded-by-former-notebooklm-developers · wattenberger.com/thoughts/boo-chatbots · allenpike.com/2025/post-chat-llm-ui

Network: support.affinity.co/s/article/Relationship-intelligence · affinity.co/blog/which-relationships-drive-warm-introductions · 4degrees.ai/relationship-intelligence · happenstance.ai/about · happenstance.ai/guides/ai-people-search · geekflare.com/software/clay-review/ · mt.inf.tu-dresden.de/cnt/uploads/Horak2020MultivariateNetworksOnMobiles.pdf · cambridge-intelligence.com/layouts · erdogant.substack.com/p/radialgraph

Financial presentation and India: multibagg.ai/feeds/management-guidance-earnings-calls-cmudzbqxv000404l5f2fyu9fg · speakerdeck.com/invemoney/7-red-flags-to-catch-on-a-concall-management-quality-warning-signs · thechatter.zerodha.com/p/the-chatter-bets-and-blueprints · taxguru.in/sebi/sebi-lodr-regulation-2015-regulation-30-30a-explained.html · assets.kpmg.com/content/dam/kpmg/in/pdf/2023/08/firstnotes-sebi-amends-disclosure-requirements-of-material-events-or-information.pdf · developer.android.com/stories/apps/futu · visualisingdata.com/?p=17308 · investing.com/studios/article-383265

Stack: tailwindcss.com/blog/tailwindcss-v4-3 · ui.shadcn.com/docs/changelog/2026-07-base-ui-default · ui.shadcn.com/docs/changelog/2026-01-base-ui · github.com/emilkowalski/vaul · motion.dev/blog/introducing-motion · webkit.org/?p=16993 · heise.de/-10749652 · webkit.org/?p=16535 · documentation.onesignal.com/docs/web-push-for-ios · magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide · mjtsai.com/blog/?p=49472 · expo.dev/blog/how-to-upgrade-to-sdk-58 · expo.dev/changelog/expo-go-and-app-store-may-2026

Slop: noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026 · github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list · superdesign.dev/blog/why-ai-design-looks-generic · builtin.com/articles/ai-design-slop-era · pages.thefountaininstitute.com/posts/7-tells-that-a-ui-is-ai-generated
