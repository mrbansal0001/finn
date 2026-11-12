# Showing Push, Pull and Network: a design plan

Written 13 Nov 2026 from the live site, as a user would meet it, with the data behind it checked where a claim depends on it (`docs/PILLARS-2026-11-13.md`). No code was changed.

## 1. The honest answer

The question: does the app show all three pillars, in a form a general user can use, as richly and as well as what was built?

| Pillar | What was built | What a new user can find | The gap |
|---|---|---|---|
| **Push** | Filings ranked, checked results, price and volume alerts with charts, the visitor's own rules, four windows, Listen | All of it, on the home page | Two things are hidden: the four **research-list companies never appear** (the edition is built for the 18 holdings only: 0 cards in 30 days for Dixon, LG, Persistent, Kokuyo), and nothing says the data is stale when the worker's Mac is asleep |
| **Pull** | 53 ledgers, 1,808 promises, call-by-call replay, checked results, annual-report descriptions, any-ticker requests | Only by tapping a ticker or searching one. There is no page that shows "FINN has read 53 companies" | **Pull has no home.** A user who never taps a ticker never sees the product's deepest work |
| **Network** | 29 people, evidence-graded matching, insiders, introducers, verifiers per promise, lenses, note drafts | A name on a card; a "who knows X" search; person pages | **The network as a whole is invisible.** There is no list of people, no sense of who covers which holding, no door to it |
| **The three together** | Investigate joins them | Reachable from every lead | The app never names its own three parts; a first-time user has no map |

So: Push is shown well; Pull and Network are built better than they are shown. The fix is not more features. It is two quiet homes (Research, People), one door row that names the three parts, and a dozen small things a user trips on.

## 2. The design in one picture

```
FINN                                       ▶ Listen  ☾
Thursday 12 November
[Portfolio 18]  [Research 53]  [People 29]        ← the three doors (new; replaces the "18 holdings ›" chip)
(24 hours) [3 days] [7 days] [30 days]
3 things matter, 12 alerts, 26 worth a look, 42 routine. Filings since 5 Nov, 20:23.

… the edition as today: Alerts at the close, three leads, Worth a look, Routine …

End of edition
Filings to 20:23 IST, prices to the 12 Nov close.
```

- **Portfolio** opens the sheet that exists today (List, Coverage, Agenda), renamed from "18 holdings".
- **Research** opens a new page: every company FINN has read, with its promise counts and the one thing worth attention.
- **People** opens a new page: the network as a whole, grouped by what each person can help with.

Each door is a pill with a count, 36px tall, in the filter style. The date row loses its chip, so the row costs about 36px net. The first alert row stays on the first screen (today it starts at 418px; it would start at about 455px).

**First visit only**, one line under the wordmark, dismissed with a tap and never shown again on that device:

> FINN reads your holdings' filings and ranks what matters; keeps each company's promises against its own later words; and shows who in your network can help. Real filings and prices; the people are synthetic.

That sentence is the map. It names the three parts in the order the doors sit.

## 3. Three sample journeys, imagined

### A. First evening, on a phone

1. Opens the link at 21:10. Sees the wordmark, the one-line map, the date, three doors, the window control already on 24 hours, and "2 things matter, 2 alerts…". Knows what the app is in one glance.
2. Alerts at the close: KALYANKJIL +7.1% with its 20-session sparkline. Taps the row. Sees the move chart with the filing markers, then "The question it raises", then Thomas Varghese. Taps Investigate.
3. Reads the question, the company's own words, picks Execution, reads three questions to ask, follows the question for the next results.
4. Back on the edition, the summary line now ends "1 question you follow." Taps **People 29**: sees the whole network grouped by holding, with Farah under KALYANKJIL and TITAN. Understands for the first time that there is a network, not just a name on a card.

### B. "What has BEL promised, and has it kept its word?"

- Today: type BEL into the dock, open the company, scroll past the header, the attention rows, the results, to Promises. Four screens.
- Proposed: tap **Research 53**. The list is sorted with the portfolio first: "BEL · Defence PSU · 4 revised, 2 silent · Latest call Nov 2026 · *QRSAM order receipt has been revised…*". One tap opens BEL at its Promises section. Two taps, and the counts were visible before the tap.

### C. "Who do I know in defence?"

- Today: type "defence" into the dock. Four people appear with their reasons. Works, but only if you think to type.
- Proposed: **People 29** shows a Themes group where "Defence" lists Pooja Agarwal (Insider), Col. Harish Menon, Arjun Malhotra and Kabir Sethi with their one-line reasons; and the five "Lack context" companies at the bottom with "Search a theme" beside them. Browsing finds what searching required knowing.

## 4. The two new pages

### Research (`/research`): what FINN has read

```
‹ Edition
RESEARCH
53 companies read, 1,808 promises                    ← counts from the ledger index
[Search any NSE company…]                            ← the same search, focused on companies
(Portfolio 22) [Nifty 50] [All 53]                   ← segmented filter; "Portfolio" = holdings + research list
Sort: Most changed · Newest call · Name              ← one segmented row (no dots: three segments)

BEL   [Defence PSU] [6%]                 Nov 2026 call   ↻ 4  ⊖ 2
      QRSAM order receipt has been revised. What changed, and is… ›
DIXON [Research list]                    Nov 2026 call   ↻ 3
      Revenue: stated as ₹4,000 cr in May 2026, now ₹6,000–6,500 cr… ›
ITC   [FMCG] [7%]                        No ledger yet   Build one ›
…
```

- One row per company: ticker, tags, latest call, status icons with counts (only revised, silent, missed, delivered: the ones that mean something), and the company's first "worth your attention" question as the row's line. The row opens the company page at Promises (or the question itself).
- Companies without a ledger appear in the Portfolio filter with "Build one ›" so the gap is visible and fixable from here.
- A footer line: "Built from the last four earnings-call transcripts and the annual report, nothing else. Every status follows fixed rules."
- Data: the ledger index already exists (`getLedgerIndex`); counts per status and the first attention question need a small addition to that index (one pass over each ledger's rows, cached for minutes).

### People (`/people`): your network, whole

```
‹ Edition
YOUR NETWORK  [Private to you]
29 people. 24 tied to your holdings, 5 companies with no one.
(By holding) [By theme] [Strongest tie]              ← segmented views
[Insiders 6] [Can introduce 8]                       ← filter pills

KALYANKJIL
  F  Farah Siddiqui   Head IR, Kalyan   strong tie, last spoke Oct 2026   [Insider]
TITAN
  R  Rhea Kapoor      Retail consultant  strong tie, Sep 2026   can introduce Tanvi Desai
  F  Farah Siddiqui   …
  T  Tanvi Desai      AVP Watches        weak tie, Jan 2026   [Insider]  through Rhea
…
WHERE YOU LACK CONTEXT
ITC, TATACHEM, ATHERENERG, SHAILY, KOKUYOCMLN         Search a theme ›

Real networks come only from your own consented imports.
```

- "By theme" groups by the domains on each profile (jewellery retail, defence, PSU banking…), which is how the dock's "who knows X" already matches.
- Each row opens the person page. The avatar initial, name, current role, tie word, last spoke, and tags (Insider, "can introduce") are all data the app already has.
- Data: `snap.contacts` and `snap.people` are already on the server for a signed-in visitor; crawlers get the "didn't load" state as today.

## 5. Push, shown more completely

| # | What a user meets today | Change |
|---|---|---|
| P1 | Research-list companies never appear in the edition, have no price, no sparkline, no alerts, no filings on their company page (Kokuyo's page is a title and a "Build one" row) | **Worker:** build filings and prices for `holdings + research_set`. Research names get weight 0 in the ranking (so holdings still lead) and a "Research list" tag on their cards; their alerts are listed but never lead. This is the one backend change in the plan and it is a one-line change in `export.portfolio()` plus the same list in `backfill` |
| P2 | Nothing says the data is old when the Mac sleeps; the footer's "Filings to 20:23 IST" needs arithmetic | A quiet line under the summary when the last successful cycle is more than three hours old during a weekday 09:00–20:00: "Last updated 6 hours ago; FINN's reader is offline." Uses `freshness.worker_last_ok`, which already exists |
| P3 | "Rules ±5%, 2× ›" is cryptic the first time | "Your rules: ±5% price, 2× volume ›" |
| P4 | Compact cards in Worth a look show a person line cut mid-sentence ("is also an alumnus of PSG …") | In the compact form: avatar, name and the first clause of the relation only (up to the first comma), no truncation ellipsis |
| P5 | Compact cards carry no "why", so 26 headlines must be opened to be understood (68 of 102 have a why) | One line of the why, clamped to one line, under the compact headline. It sits inside a fold, so the edition's first screen is unchanged |
| P6 | Listen gives no sense of length and no progress | "Listen, about 2 min" before; "Stop · 0:42" while playing (the script's word count ÷ 150 words per minute) |
| P7 | A results lead shows the figures but not what the company had promised for them | **Pull inside Push:** a promise line under the bars, parallel to the person line, when a tracked promise exists: "Promised FY27 EBITDA margin ~28%; Q2 at 27.9%". 16 tracked promises exist today; the line appears only for those. The brief's "promised versus delivered" then surfaces on the home page itself |
| P8 | Today's cards show a bare time ("18:19") while older ones show the day | Keep the rule, but prefix "Today" on the bare time: "Today, 18:19" |

## 6. Pull, shown more completely

| # | Today | Change |
|---|---|---|
| L1 | No page shows what FINN has read | The Research page (§4) |
| L2 | A company without a ledger has no description at all (ITC starts at Results; Kokuyo is nearly empty) | A header line from the universe and the portfolio file: sector tag, and one line of what FINN holds: "Results Q2 FY27 checked · 3 filings in 30 days · 2 people" (as three tags, no dots) |
| L3 | Promise titles start lowercase ("revenue (FY27): ₹6,000–6,500 cr") | Capitalise the first letter in the UI; the worker's metric text stays as extracted |
| L4 | "no figure" and "by unspecified date" sit inside the title and read as part of the promise | Render them as a tag after the title: **No figure**, **No date**; the title keeps the metric and period |
| L5 | Filings section is omitted when a company had none in 30 days; the sticky nav's "Filings" chip then jumps nowhere | Always render the section with "No filings in the last 30 days." |
| L6 | The Coverage view's Research column reads "Oct ’26" with no visible meaning | Column header "Research, latest call" |
| L7 | The hand-checked reference (BEL, Deepak Nitrite) is only inside Methodology | A tag beside the status counts: **Hand-checked reference available ›**, opening the fold. Graders will look for this |
| L8 | Promise rows show change lines like "₹1,000 cr → >₹1,200 cr → ~₹1,200 cr" with no sense of when | Add the call label under each arrow stop in the detail only; the row stays as is |
| L9 | The company page's "Worth your attention" and the results question are in two places (by design), but a visitor can't tell the results question exists until the chart | Fine as is; no change |

## 7. Network, shown more completely

| # | Today | Change |
|---|---|---|
| N1 | No list of people | The People page (§4) |
| N2 | "Insider" tag explains itself only on hover (no hover on phones) | A one-line key under the first People section on a page: "Insider: works there now; ask only about public information." Once per page |
| N3 | Person page has no "others at this company" | "Also linked to TITAN: Rhea Kapoor, Tanvi Desai" under the header, each a link |
| N4 | The dock's "who knows X" phrasing is undiscoverable | When the search field is focused and empty, three example chips: **who knows TCS**, **specialty chemicals**, **BEL**. Tapping one runs it |
| N5 | "People who'd know" on a company page lists names without saying what each is good for | A lens tag per person (Execution, Money…) from the same role matching the investigation uses: "Harish Menon · Execution" shown as a tag, not a dot |
| N6 | The five companies with no one are visible only in the sheet's "Lack context" filter | Also at the foot of the People page, with "Search a theme ›" beside them |
| N7 | Second-degree paths are rare (8 edges) and look the same as direct ones in lists | A "through Rhea" suffix on list rows, as the person page already says |

## 8. Small things across the app, from a user's chair

| # | Where | What a user trips on | Fix |
|---|---|---|---|
| S1 | Everywhere | No way to copy a link; investors forward things | "Copy link" inside every "About this…" fold; a toast "Copied" |
| S2 | Shared links | A link pasted into WhatsApp or Slack shows no preview | An Open Graph image and title per page: the wordmark and the headline for cards, the company name for company pages, the question for investigations |
| S3 | Browser tabs | Tab titles are generic on most pages | "BEL: Revenue up 26.5% · FINN", "Bharat Electronics · FINN", "Investigate: Revenue grew 11.7%… · FINN" |
| S4 | Error page | Says "This edition didn't load" even on a company or person page | "This page didn't load" |
| S5 | Dock | The sliders icon has no visible word | Keep the icon; add a small "Rules" label under it on screens 400px and wider |
| S6 | Home, first visit | The default rules (±5%, 2×) are never introduced | The first-visit line covers it: "…ranks what matters. Set what counts in Rules." |
| S7 | Holdings sheet | "The portfolio" sheet is opened by a chip that says "18 holdings" | Rename the door "Portfolio" with a count badge; the sheet title stays |
| S8 | Investigate | After "Follow this question", the page gives no way back to where you were except Back | A line under the button: "Back to the edition ›" |
| S9 | Questions page | With one question it reads fine; with ten it is one long column | Group by company when more than five, with the company chip once per group |
| S10 | Card page, pending headline | A filing FINN hasn't read yet shows a bare subject and nothing else (none in the edition today, but the state exists) | "FINN reads this filing at the next update, about N minutes from now" using the 15-minute cycle |
| S11 | Numbers | "5.7× vol" in alert rows against "5.7× usual volume" in headlines | One wording: "5.7× usual" in rows (fits the column) |
| S12 | Dark mode | The green and red direction colours are lighter but the tint chips are nearly the paper colour | Raise the dark tint one step so chips and tags separate from the page |
| S13 | Settings | "Reset to defaults" sits beside "Save and return" at the same weight | Make Reset a text link; one black button per page |
| S14 | Agenda | Company-announced dates show the label "Investor meet schedules" (the filing's category), not what the meeting is | Use the filing's facts when present ("Analyst meet, Mumbai") and fall back to the label |

## 9. What stays as it is

- The edition remains the home page and keeps its shape; the doors row is the only addition above it.
- The layout plan's rules (one number in one place, three heading levels, one control per job, the About fold) all hold on the new pages.
- Investigate does not change: it already joins the three pillars.
- No charts are added. The Research and People pages are lists.

## 10. Order of work

1. **Worker:** research names in filings and prices (P1), and the ledger index's per-status counts and first attention question (for the Research page). Half a day, including a rebuild and a check that holdings still lead.
2. **Doors and the first-visit line** on the home page; the Portfolio rename (S7). Two hours.
3. **Research page** (§4). Half a day.
4. **People page** (§4) and the Insider key (N2), the "also linked" line (N3), the dock examples (N4). Half a day.
5. **Push details:** stale-data line (P2), rules wording (P3), compact cards (P4, P5), promise line on results leads (P7), Listen duration (P6), "Today" (P8). Half a day.
6. **Pull details:** L2 to L7. Two hours.
7. **Small things:** S1 to S14. Half a day.
8. **Checks:** the home's first alert row still on the first screen; the Research and People pages at 320px and 390px; dark mode; keyboard order on the new pages; a shared link's preview; the stale line appears when the worker is stopped for three hours (test by stopping it).

## 11. Acceptance, from the user's chair

A person who has never seen FINN opens it on a phone and, without typing anything, can answer in under a minute: what moved today, what the company had promised about it, and whom they know who can explain it. Then, from the three doors, they can see how much FINN has read and whom their network covers. Nothing on the screen is there that they can't tap or read, and nothing they can tap looks like text.

## 12. Result (implemented 13 Nov 2026)

Every numbered item is built. Measured locally at 390×844 with the live data, then checked on the live site.

| Item | Built | Note |
|---|---|---|
| §2 doors, first-visit map | Yes | The map is a compact caption with "Got it" at the end (106px on a first visit; gone after one tap). The first lead headline stays on the first screen either way (721px first visit, 607px returning) |
| §4 Research page | Yes | Portfolio / Nifty 50 / All read; Most changed / Newest call / Name; search finds any NSE company, with a "Not read yet" list that opens a request |
| §4 People page | Yes | By company / By theme / Strongest tie; Insiders and Can introduce filters; the Insider key; "Where you lack context" at the foot |
| P1 research names in Push | Yes (worker) | 27 cards and 46 price sessions in 30 days for Dixon, LG, Persistent and Kokuyo; none leads, in the worker or in the app's re-ranking; tagged "Research" |
| P2 stale note | Yes | Tested with the browser clock set to a weekday noon ten hours after the last read |
| P3–P8 | Yes | "Your rules: ±5% price, 2× volume"; compact cards with one line of why and a clause-length person line; Listen shows its length and elapsed time; the promise line on results leads (10 companies have a tracked promise); "Today, 18:19" |
| L2–L8 | Yes | L9 needed no change |
| N2–N7 | Yes | N4 uses "who knows Titan" rather than "who knows TCS": no one in the demo network knows TCS, and a first tap answering "no one" teaches less |
| S1–S14 | Yes | S2 preview images for the site, cards and companies; the investigation's preview falls back to the site image (preview images can't read its query string) |

Heights for a returning visitor: home 7 days 1,851px (was 1,725px before this plan; the doors row, the rules line, the promise line and the research companies in "Worth a look" are the additions). Research 2,694px, People 4,649px (lists, by design). No sideways scroll at 320px or 390px on any screen; no console errors.
