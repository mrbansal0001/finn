# FINN against the brief: an honest check, and the plan

Written 13 Nov 2026 (two days before the deadline) against the four pages of the brief, the live site, the code and the decision log. No code changed.

## 1. Line by line

"Met" means a reviewer can see it work on the live site. "Partial" means the foundation exists but the brief's words ask for more. "Missing" means it isn't there.

### Push

| The brief asks | FINN | Status |
|---|---|---|
| A windowed digest, default 24h, choose the period, every filing across the portfolio, prioritised, routine collapsed | Four windows plus "since last visit"; leads, worth a look, routine folded with every filing openable; research names included | **Met** |
| "Tell me *the moment* something crosses a threshold" | Alerts are computed at the close and shown when the app is opened. Nothing is sent: no notification, no email | **Partial.** The one place the brief's own word, *push*, isn't true |
| A material announcement of a type I care about, as a trigger | Categories can be switched on or off, and tiers decide what leads. There is no "alert me when results / a deal / a management change lands" that surfaces as an alert | **Partial.** The alerts strip is price and volume only |
| Volume >2× its average, price ±X%, configurable | Both, with a live preview of what the rules would have fired and a scatter of recorded sessions | **Met** |
| Management change: a short background of the incoming person, where they came from, whether anyone in my network worked with them, studied with them, or sits one connection away | Read from the filing's own bio annexure (not LinkedIn, by design); organisations, schools, a verified-overlap sentence, introducer paths | **Met** |
| Quarterly results: Revenue, EBITDA, PBT, PAT, QoQ and YoY | From the filed table, checked against exchange XBRL, with margins in bp | **Met** |
| A material event at a company I know people at: the best person, and why | A "best placed" reason, lenses by role, questions to ask | **Met** |
| Every other type: a one-line summary or the right priority | Rules and a model-written headline; 14 of 105 cards in 30 days are still "unclassified" | **Met, with a visible rough edge** |

### Pull (the brief: "treat them as a menu")

| Output | FINN | Status |
|---|---|---|
| Business snapshot | "What they do" from the annual report, segment bars where shares are disclosed | **Met** where a ledger exists |
| Financial snapshot | Results table, Growth/Margins chart | **Met**, but "key ratios" means only the EBITDA margin |
| Trajectory (multi-year) | Nothing. The store holds one quarter per company (max two). No multi-year series anywhere | **Missing** |
| Balance sheet | Nothing | **Missing** (declined, D-065) |
| Cash quality | Nothing | **Missing** (declined, D-065) |
| Narrative vs numbers | The promises ledger, replay, tracking against filed quarters | **Met**, and the strongest thing in the product |
| Guidance | The same ledger | **Met** |
| Bull vs bear | Nothing | **Missing** (avoided: a model's opinion) |
| Worked example: four quarters, promised vs delivered | 53 companies, 1,808 promises | **Met** |
| Primary sources only | Transcripts and annual reports from the exchange; Screener used only to find links | **Met** |

Four of eight menu items are missing. The brief allows that, but Trajectory and Cash quality are the two an investor expects first after the headline numbers.

### Network

| Scenario | FINN | Status |
|---|---|---|
| Who should I call: worked there, at a competitor, a supplier or a customer, and what would they know | Worked there: yes, with lenses and questions. Competitor, supplier, customer: no. The network has no relationships between companies | **Partial** |
| Second-degree reach: who knows the new MD, and how strong | Filing-named people matched to contacts by dates; introducer paths with context; tie strength | **Met**, on a graph of 29 people and 8 edges |
| Diligence on people before a meeting: career path, overlaps, what to ask | For people named in a filing, yes. There is no way to look up a company's management team on demand | **Partial** |
| Expertise map: go-to people for a theme | People page by theme; the dock's theme search | **Met** |
| Keeping the network warm: haven't spoken in a while, their former employer just filed | "Why talk to them now" exists on person pages. Nothing surfaces it unprompted. 14 of 29 contacts are six months cold | **Partial**, and cheap to finish |
| "Show us what it notices that the investor wouldn't" | The verified-overlap sentence on people cards; the verifier per promise | **Partly there** |

### The interaction model and the bar

The brief invites chat, voice, a copilot, a dashboard, a network map, "or something we haven't thought of", and asks for a point of view.

FINN's point of view is real: **an edition, not a feed; a question, not a chat.** Read what mattered, tap one thing, and the product carries the change, the company's own words, the person and a follow-up together. That is a stance, and it is defensible against "no AI slop" because almost every sentence is written by rules from checked numbers.

But the honest answer to "did we experiment enough" is **no**. The interaction has been read-a-ranked-list-then-tap since 11 Nov. The experiments that exist (editable question, lenses, the replay you tap through, the chart you drag, Listen) are good but small. The investor never *asks* FINN anything in their own words, never speaks to it, never gets anything sent to them, and never acts on a card beyond following a question.

## 2. The hard questions, answered

**Does it save an investor time?** Yes, in three measured ways: the morning edition replaces scanning ~250 filings a month for 22 companies; the promises ledger replaces reading four transcripts per company; the person-and-note flow replaces remembering who worked where. The catch is that it saves time only if the investor opens it. Nothing reaches out.

**Is it simple and elegant?** The visual system is: restrained type, one accent, drawn icons, rule-written copy, measured claims. But the edition has grown: 1,851px on 7 days, with captions on captions ("by fixed rules", "checked when you open FINN; this device only", "A question, not a finding"). Elegance is also what you leave out, and the last three days added more than they removed.

**Is it interactive enough?** It is tappable everywhere, but interaction mostly means *opening*. Only three things the investor does change the product over time: setting rules, muting categories and following questions. There is no way to say "seen", "not for me", "remind me", "compare these two", or to ask a question in plain words.

**Is it a common design?** The edition metaphor is uncommon in finance apps (most are feeds or terminals). The card and section layout underneath is conventional, deliberately, because the brief punishes novelty for its own sake. The risk is that a reviewer skims and sees "a nice list".

## 3. Tried and rejected, with reasons

| Idea | Rejected because | Where recorded |
|---|---|---|
| Chat as the main surface | Primary-source discipline and "no slop": a free-text model answer is the easiest way to leak outside knowledge | D-018 |
| A network graph (force-directed) | 29 people and 8 edges; a bounded path says more than a cloud | Creative review §3 |
| A portfolio heatmap or risk score | Coverage is not risk; green reads as "safe" | D-062 |
| A world map | No location data; a headquarters pin isn't exposure | Visual review §9 |
| Cash waterfall, working capital, debt ladder | Need data FINN doesn't extract | D-065 |
| Numeric chart for promised amounts | Targets aren't normalised for basis; a chart would imply comparability | D-063 |
| Chaptered audio with branching | Needs real-phone testing first | D-059 |
| Full-portfolio time travel | Clutter; the per-promise replay covers it | D-059 |

## 4. Not explored, and should be

1. **Push that pushes.** A web notification or an email at the close. The brief's word, unmet.
2. **Announcement-type alerts.** "Tell me when results land" as an alert, not just a ranking.
3. **Ask in plain words, answered only from the documents.** A question box on a company page whose answer is quotes with pages, drawn from the transcripts, results and annual report FINN already holds, and a refusal when they don't cover it. This is the copilot the brief invites, done within the primary-source rule.
4. **Voice in.** The phone's own speech recognition feeding the same search and ask. With Listen, that's a hands-free loop.
5. **Trajectory from the annual report's own multi-year summary.** Every Indian annual report carries a five- or ten-year table. One model call per report, cached, checked for arithmetic.
6. **Keeping the network warm, unprompted.** "You haven't spoken to Rhea since Sep; Titan filed results on Thursday."
7. **Acting on cards.** Swipe or tap to mark "seen" / "not for me", and have the ranking learn from it (a muted kind, a muted company).
8. **Compare two companies' promises** side by side from the Research page.
9. **Management on demand.** A company's directors and KMP with careers, from the exchange's own CIM filings and the annual report, so "diligence on people" works before a filing names them.

## 5. The plan for the two days left

Ranked by brief-fit per hour. Each item says what shipping it proves to a reviewer.

### Day 1 (Friday)

| # | Build | Hours | What it proves |
|---|---|---|---|
| 1 | **Push at the close.** Opt-in web notifications (Android, desktop, iPhone when added to the home screen), subscriptions in the visitor's own private rows, a Vercel cron at 16:00 IST that sends "N alerts at the close" with the top one. Fallback: the same text as an email to an address the visitor enters (one free provider, or skip if time is short) | 5 | "The app reaches out to you" becomes literally true |
| 2 | **Announcement alerts.** In What counts, three switches: alert me on results, deals, management changes. Matching filings join the alerts strip with their kind, and go into the same push | 2 | The brief's first trigger type, as a trigger |
| 3 | **Keeping the network warm.** On the People page and as a line in the edition: contacts cold for six months whose company filed this week, with the filing and a one-tap note draft | 2 | The fifth network scenario, unprompted |
| 4 | **Cut, don't add.** Remove repeated captions; one disclosure line per page; the edition's 7-day target under 1,700px | 1 | Elegance |

### Day 2 (Saturday)

| # | Build | Hours | What it proves |
|---|---|---|---|
| 5 | **Ask the documents.** A box on company pages and the dock: the question goes to a retrieval over that company's transcript quotes, results table and annual-report passages FINN already holds; the answer is up to three quoted passages with page links and one rule-written framing line; "The documents don't say" when nothing matches. No outside knowledge, by construction | 4 | A copilot that obeys the primary-source rule, and the interaction experiment the brief asks for |
| 6 | **Voice in.** A microphone on the dock using the phone's speech recognition, into the same search and ask; works offline on-device where supported | 1 | Hands-free: listen to the edition, then ask |
| 7 | **Trajectory.** The annual report's multi-year table read once per report (cached), checked that rows add up, shown as five-year bars for revenue and PAT under "What they do", with the page cited | 3 | The Pull item investors expect next |
| 8 | **Verify and write up.** Real phone: notification permission, voice, ask; the write-up names each pillar's gaps honestly (balance sheet, cash quality, bull-bear left out and why) | 2 | The bar: measured, not claimed |

Total: about 20 hours. If something slips, drop 7 first, then 6. Never drop 1, 4 or 8.

### Not before the deadline

Management on demand (needs a new extraction), card swipes with a learning ranker (needs a day to feel right), compare view, balance sheet and cash quality (new data), bull vs bear (a model's opinion dressed as analysis is exactly what the bar forbids).

## 6. The sentence for the write-up

FINN is an edition, not a feed: it reads the filings, keeps each company's promises against its own later words, and finds the person who can explain. It pushes at the close, answers questions only from the documents, and says plainly what it doesn't know.
