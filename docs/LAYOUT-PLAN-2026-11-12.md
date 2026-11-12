# FINN layout plan: where every element goes, and why

Written 12 Nov 2026 from the live site at 390×844 (iPhone 13), one browser session, every screen captured full-page and measured. Heights below are CSS pixels at that width; "screens" means 844px viewports. This is a plan, not a change log: no code was touched.

## 1. What the measurements say

| Screen | Height | Screens | What takes the space |
|---|---|---|---|
| Home, 24 hours | 1,090 | 1.3 | Fine. Two alerts, one lead |
| Home, 7 days | 2,154 | 2.6 | Alerts box 424px (12 rows, 5 shown); three lead cards at ~390px each |
| Home, 30 days | 2,080 | 2.5 | Same shape |
| Card, results | 1,736 | 2.1 | Chart + table 700px before the question; four small sections after |
| Card, move | 1,557 | 1.8 | Chart, then question at 873 |
| Card, people | 1,517 | 1.8 | Question at 316: good |
| Company, BEL | 3,808 | 4.5 | Questions 650px, Results 830px, Promises 930px, Filings 650px |
| Company, Kalyan | 3,540 | 4.2 | Filings list has 11 price-move rows |
| Company, ITC (no ledger) | 2,733 | 3.2 | |
| Investigate, results | 2,869 | 3.4 | Step 1 600px (figures grid + chart repeat each other); step 4 700px |
| Investigate, promise | 3,133 | 3.7 | Step 1 780px (strip, three lanes, calendar, compare) |
| Person | 2,180 | 2.6 | Note textarea open by default; two sections list the same companies |
| Questions | 664 | 0.8 | Fine |
| Settings | 2,080 | 2.5 | A form; fine |

The elements are good. The problems are the kind that come from adding elements one at a time:

1. **The same number is shown two or three times.** A results lead on the home page states "+31.4%" in the headline, in the "why" sentence, and in the growth bar. A move card page states the close, the change and the volume multiple in the "why" sentence and again in the chart's readout. An investigation's "What changed" shows a figures grid and then a chart of the same figures.
2. **The heaviest visual sits where the eye lands first.** On the 7- and 30-day editions, the alerts table (12 sparklines) is the first thing under the masthead, so the page reads as a data table with headlines underneath. The brief's main object, the ranked edition, starts 673px down.
3. **Preamble before content.** Home: 249px of wordmark, date, holdings chip, disclaimer sentence, window tabs and "showing since" line before the first alert. Company: 310px before "What they do". Investigate: 364px before step 1. Each is reasonable on its own; together they mean the user starts every page by scrolling.
4. **Every section wears the same heading.** "Sources" (one chip) and "Promised vs delivered" (900px) both get the rule-and-kicker heading. Minor sections look as important as major ones, so nothing stands out.
5. **Two sections on the person page list the same two companies** ("Has seen both" and "Connects you to"), and the path section repeats the header's tie line for direct contacts.
6. **Controls differ for the same job.** View switches use black pills (home windows, promises views, lenses), a segmented tint bar (holdings sheet), small text toggles (YoY/QoQ) and bordered pills (revisit). The investigation's section navigator says Change · Evidence · People · Follow, but the steps below are numbered 1 to 5 with "What remains unclear" as 2.
7. **Disclaimers repeat.** "A demo portfolio…" on home, "People are synthetic profiles…" on investigations, "Synthetic profile for this prototype…" on person pages. Each is right; together they read as nervousness.

## 2. Rules the plan follows

- **One number, one place.** A figure appears once per screen. If a chart carries it, no sentence restates it; if a sentence carries it, no grid repeats it.
- **The ranked edition is the home page.** Alerts stay at the top because they are time-critical, but they are a strip, never a table taller than the first lead.
- **Three heading levels, not one.** Major (rule + kicker, as now), minor (a plain small heading, no rule), and meta (a single collapsed "About this item" block at the foot of a page: sources, why it's here, methodology, provenance, disclaimers).
- **Preamble under 200px on every page**, measured from the top of the viewport to the first content element.
- **Fold what is reference, show what is judgement.** Exact tables, full quotes, draft notes and methodology are one tap away. Headlines, charts, questions and people are visible.
- **One control style per job:** segmented control (black fill) for mutually exclusive views; bordered pill with a count for filters; text link with › for navigation; black button only for the page's single primary action.
- **Say the synthetic-network disclaimer once per page**, in the meta block, in the same words everywhere.

## 3. Home (the edition)

### Today (7 days, 2,154px)
```
FINN                    ▶ Listen  ☾        17
Thursday 12 November     [18 holdings ›]
A demo portfolio. Filings and prices are real; the network is synthetic.
[24 hours] [3 days] (7 days) [30 days]
Showing filings since 5 Nov, 20:23
┌ ALERTS 12            Rules: ±5% price, 2× volume › ┐   249
│ Line: the last 20 closes. Bars: each day's volume…  │
│ KALYANKJIL  ~~~/  +7.1%  5.7× vol                    │
│ … 4 more rows …                                      │
│ View all 12                                        › │
└──────────────────────────────────────────────────────┘
THREE THINGS MATTER                                      673
RESULTS [KALYANKJIL]              Tue 10 Nov, 17:08
Revenue up 31.4% YoY, PBT before one-offs up 38.9%
EBITDA margin 6.24%, −9bp YoY. Reported PBT up 59.9% including
₹73 cr of pre-tax one-off items; PAT up 63.9%. The stock rose…
Revenue  ████████      +31.4%
EBITDA   ███████       +29.7%
PAT      ████████████▌ +63.9%
         Change from a year ago, one scale; bars capped at ±60%
◦ Farah Siddiqui [Insider] works at Kalyan Jewelle…
Investigate ›                                             (390px per lead)
```

### Proposed
```
FINN                              ▶ Listen  ☾
Thursday 12 November               [18 holdings ›]
(24 hours) [3 days] [7 days] [30 days]          since 5 Nov, 20:23
3 things matter · 12 alerts · 26 worth a look · 42 routine      ← new: the edition in one line

ALERTS AT THE CLOSE  2                   Rules ±5%, 2× ›
KALYANKJIL   ~~~/   +7.1%   5.7× vol
SBIN         ~~~/   +2.4%   2.0× vol
10 more this week ›                                   (collapsed)

THREE THINGS MATTER
RESULTS [KALYANKJIL]                 Tue 10 Nov, 17:08
Revenue up 31.4% YoY, PBT before one-offs up 38.9%
Revenue  ████████      +31.4%
EBITDA   ███████       +29.7%
PAT      ████████████▌ +63.9%   YoY
EBITDA margin 6.24%, −9bp YoY.                         ← first sentence of "why" only
◦ Farah Siddiqui [Insider]                 Investigate ›
```

Placement, element by element:

| Element | Today | Proposed | Why |
|---|---|---|---|
| Wordmark, Listen, theme | Row 1 | Row 1, unchanged | |
| Date + holdings chip | Row 2 | Row 2, unchanged | |
| Demo disclaimer sentence | Row 3 | Moves to the page footer under "End of edition" | Legal copy, not reading matter; costs 2 lines on every visit |
| Window tabs | Row 4 | Row 3; the "since" time becomes a caption on the same row's right end (wraps under on narrow phones) | |
| **Edition summary line** (new) | — | Row 4: "3 things matter · 12 alerts · 26 worth a look · 42 routine", each part a jump link | Tells the reader in one glance whether today needs five minutes or thirty. Numbers already exist |
| Alerts box | 12 rows, 5 shown, key sentence, 424px | **Only the latest close's sessions are rows** (today: 2); earlier sessions in the window collapse into "10 more this week ›". Heading becomes "Alerts at the close". Key sentence moves to a `title` on the chart and one caption line inside the collapsed part. Cap: 3 rows + the link | The brief's alert is an end-of-day trigger. Box drops from 424px to ~170px on 7d; stays ≤ the first lead card in every window |
| Alert row | ticker/date, spark, %, vol | Unchanged | Already the best row in the app |
| "Three things matter" | Kicker | Unchanged | |
| Lead card: meta row | Kind, ticker, time | Unchanged | |
| Lead card: headline | 2 lines serif | Unchanged | |
| Lead card: "why" paragraph | Up to 3 lines | **First sentence only** when a chart is present (results: the margin sentence; move: the "no material filing" sentence); full text on the card page | The bars carry the headline figures; the rest was repetition |
| Lead card: growth bars | 3 rows + 2-line caption | 3 rows; caption shrinks to "YoY" at the row end, "capped" note only when a bar is capped | Saves a line per card |
| Lead card: person line | Name, tag, relation (truncated) | **Name and tag only**, left; **Investigate ›** right, same row | The relation never fits on a phone; it lives on the card page. Saves a line and the ugly ellipsis |
| Lead move card | Sentence + wide sparkline + caption | Wide sparkline keeps its caption; the sentence keeps only "No material filing since the previous close" | The readout numbers are in the headline |
| "Worth a look" | Collapsed row, count | Unchanged | |
| "Routine, folded" | Collapsed row, count | Unchanged | |
| Questions you follow | One line between masthead and alerts | Moves to just above "Worth a look" | It is the reader's own list, not today's news; the new summary line already says "2 questions, 1 with new evidence" |
| Footer | End of edition + freshness | Adds the demo disclaimer | |

Expected: 7-day home from 2,154px to about 1,500px, with the first lead headline on the first screen (today it is at 754px).

## 4. Card page (one filing or move)

### Today (results, 1,736px)
Order: back · meta · headline · company · why · Growth/Margins chart · table · **question box at 955px** · Who can explain · Sources (one chip) · Why this is here (3 bullets + details).

### Proposed
```
‹ Edition
RESULTS [COCHINSHIP]                         Tue 10 Nov, 14:27
Revenue up 11.7% YoY, PAT down 50.0%
Cochin Shipyard
EBITDA margin 4.08%, −251bp YoY. The stock fell 6.8% the next session…

(Growth) [Margins]              (vs a year ago) [vs last quarter]
Revenue ▬▬▬ +11.7%   EBITDA ▬▬▬ −30.9%
PBT     ▬▬▬ −49.9%   PAT    ▬▬▬ −50.0%

┌ THE QUESTION IT RAISES ─────────────────────────────┐
│ Revenue grew 11.7% but the EBITDA margin fell 251bp. │
│ Which costs grew faster than sales?   [Investigate ›]│
└──────────────────────────────────────────────────────┘

WHO CAN EXPLAIN THIS
◦ Thomas Varghese  was Deputy GM, Ship Repair at Cochin Shipyard, 2003–19
  Last spoke Nov 2025.

Exact figures, Q2 FY27 ›                               (collapsed table)
About this item ›                                      (sources, why here, order)
```

| Element | Today | Proposed | Why |
|---|---|---|---|
| Header (meta, headline, company, why) | | Unchanged. The full "why" belongs here | |
| Chart | Above the table | Stays, directly under the why | The picture is the first thing to read |
| Question box | After the table, big black button | **Directly under the chart**, one-line kicker, question, "Investigate ›" as a text link at the row end | The question is the page's one action; today it arrives after 1.1 screens. A text link suffices: the box itself is the call-out |
| Who can explain | After the question | After the question, unchanged | Change → question → person is the brief's sequence |
| Exact table | Open, 330px | **Collapsed** behind "Exact figures, Q2 FY27 ›" with the checks line and the PDF link inside | Reference, not judgement. Open by default on desktop |
| Sources | Own section, one chip | Into the meta block; for results the PDF link is already in the table's caption | A section heading for one chip |
| Why this is here | Own section, bullets + details | Into the meta block as one sentence: "A lead-tier results filing, 2% of the portfolio, filed 2 days ago." with "How the order is computed ›" inside | |
| Move card | Why sentence + chart readout | Why keeps only the filing sentence; the chart readout carries close, change and volume | One number, one place |
| People card | Question at 316px | Unchanged in order; "From the filing" stays above people | Already right |

Expected: results card from 1,736px to about 1,150px; the question on the first screen.

## 5. Company page

### Today (BEL, 3,808px)
Order: header (tags, name, price, sparkline) · section nav · What they do · Questions worth your attention (650px) · Latest results (830px) · Promised vs delivered (930px) · People · Filings and moves (650px).

### Proposed
```
‹ Back
BEL [Defence PSU] [6% of portfolio]
Bharat Electronics
₹404.80 +1.5%  Close on Thu 12 Nov
~~~~~/▼~~~~                      Last 20 sessions; ▼ a filing    ← filing marks added to the header sparkline
▁▁▂▁▁▂▁▁▁▃▁▂▁▁▂▁▃▂▁█
[Overview] [Results] [Promises] [People] [Filings]              ← sticky when scrolled

WHAT THEY DO                           FY26 annual report
The company operates in the defence sector… AR p.73   More, with segments ›

WORTH YOUR ATTENTION
[Promise revised]  CAPEX: stated as ₹1,000 cr in Jan 2026, now ~₹1,200 cr… ›
[Went quiet]       Shatrughat/Samaghat order: stated on earlier calls, then… ›
[On course?]       EBITDA margin (FY27) ~28%: 27.9% in Q2. Is the full year… ›

LATEST RESULTS                                   Q2 FY27
(Growth) [Margins]
…bars…
Question card (as on the card page)
Exact figures ›

PROMISED VS DELIVERED                      last 4 calls
● 1 delivered  ↻ 5 revised  — 4 silent  ◌ 7 ended  ◦ 54 open     ← one row, smaller
(Needs attention 17) [All 71] [History]
CAPEX (FY27): ~₹1,200 cr                     ↻ Revised  ◦ ↻ ↻ ↻
₹1,000 cr → >₹1,200 cr → ~₹1,200 cr
…
Show all 17 ›
Methodology and provenance ›                                     (collapsed)

PEOPLE WHO'D KNOW
…unchanged…

FILINGS, LAST 30 DAYS
ORDERS & CAPEX  Fri 06 Nov  BEL receives orders worth Rs. 909 Crores
CALL            Fri 06 Nov  Earnings-call transcript filed
RESULTS         Fri 30 Oct  Revenue up 26.5% YoY, PAT up 19.6%
Price moves: 2 sessions over 2% this month ›                     ← one line, not 11 rows
About this company ›
```

| Element | Today | Proposed | Why |
|---|---|---|---|
| Header | Tags, name, price, sparkline | Unchanged, plus **filing marks (▼) on the header sparkline** on the days the company filed | Joins price and filings in the first glance; the data and the marker code already exist |
| Section nav | Four chips, scrolls away | Five chips (adds Overview), **sticky** under the top edge once scrolled, 40px, paper background with a hairline | A 4-screen page needs a way back to its sections. Sits at the top, so it never stacks on the search dock |
| What they do | 2 sentences + More | Unchanged | Good as is |
| Questions worth your attention | Three serif subheads with tags, 650px | **Three single rows**: tag at left, question in body text clamped to two lines, › at the right; whole row is the link; heading shortened to "Worth your attention" | Same content at ~250px. The investigation page is where the question gets its serif headline |
| Latest results | Chart, question card, table | Chart, question card, **table collapsed** | As on the card page |
| Promises: status counts | Two rows of counts | One row at caption size | |
| Promises: rows | Title/status, strip, change line, "Last said…" line | Drop the "Last said" line from the collapsed row (it is inside the detail) | Four lines to three per row; ~100px over five rows |
| Promises: methodology + provenance | Details + paragraph, always visible | Both inside one collapsed "Methodology and provenance ›" | |
| People who'd know | | Unchanged | |
| Filings and moves | Every filing and every session over 2%/1.5× as cards (Kalyan: 11 move rows) | **Filings only as rows**; price moves become one line, "N sessions over 2% this month ›", opening the newest move card (which has the full chart) | Eleven near-identical move rows are noise; the chart shows them better |
| Research-list company with no ledger (ITC) | "Not covered yet" tint card in the Promises slot | Unchanged, but move the request button into the "Worth your attention" slot too: "No promises ledger yet. Build one ›" | The gap is the attention item |

Expected: BEL from 3,808px to about 2,600px.

## 6. Investigate

### Today (results, 2,869px; promise, 3,133px)
Five numbered steps; the navigator has four names; step 1 shows a figures grid and then a chart of the same figures; step 4 shows four lens pills (three empty) and repeats the person's role twice.

### Proposed: four steps, matching the navigator
```
‹ Back
INVESTIGATE [COCHINSHIP] [Results]
Revenue up 11.7% YoY, PAT down 50.0% ›
Revenue grew 11.7% but the EBITDA margin fell 251bp.
Which costs grew faster than sales, and is that temporary?   Edit
Written by FINN from the figures, by fixed rules. A question, not a finding.
[Change] [Evidence] [People] [Follow]

1 WHAT CHANGED
(Growth) [Margins]  …chart…                       ← no figures grid above it
The table shows what changed, not why; the notes and the next call explain it.   ← "unclear" folded in as the closing line
[Filing ↗]

2 WHAT TO CHECK NEXT
…three passages, long quotes folded…

3 WHO COULD HELP
What are you trying to understand?  (Execution 1)  [Demand] [Money] [Rules]
No one linked to Cochin Shipyard has a recorded demand, finance or legal role.   ← one caption instead of three dashed pills
○ You · weak tie, last spoke Nov 2025
● Thomas Varghese · was Deputy GM, Ship Repair at Cochin Shipyard, 2003–19
■ COCHINSHIP
Questions to ask Thomas  1. … 2. … 3. …
Draft a note to Thomas ›

4 KEEP FOLLOWING
(Next results) [Next earnings call] [Any new filing] [On a date]
What evidence would resolve this? ________________
[Follow this question]   All questions ›
Brings it back when the next results are filed; checked when you open FINN; this device only.
About this page ›                                        ← synthetic-people line lives here
```

| Element | Today | Proposed | Why |
|---|---|---|---|
| Steps | 5 (Changed, Unclear, Check next, Who, Follow) | **4**: Changed, Check next, Who, Follow. "What remains unclear" becomes the last sentence of step 1 | The navigator already names four; the "unclear" text is one or two lines |
| Step 1, results | Figures grid + chart | Chart only (the grid's numbers are the chart's) | |
| Step 1, promise | Strip, three lanes, calendar, compare | Unchanged in content; the calendar lane only when two or more dated deadlines exist (already so) | This is the page's reason to exist |
| Step 1, move | Chart | Unchanged | |
| Lens pills | Four, empty ones dashed | Only lenses with someone; one caption names the empty ones | Three dead controls in a row invite taps that do nothing |
| "Why them for this" | Repeats the path's edge text | Shown only when it adds to the edge text (an introducer's context, or a different role) | |
| Draft note | Folded | Unchanged | |
| Follow captions | Two | One | |
| Synthetic disclaimer | Visible line at the foot | In the "About this page" meta block | |

Expected: results investigation from 2,869px to about 2,200px; promise from 3,133px to about 2,700px.

## 7. Person page

### Today (2,180px)
Header · How you reach them · Why talk to them now (five items, **note textarea open**) · Has seen both · Connects you to · Career · tie strength · disclaimer.

### Proposed
```
‹ Back
YOUR NETWORK [Private to you]
Farah Siddiqui
Head, Investor Relations at Kalyan Jewellers India, Thrissur
Company IR contact · strong tie · last spoke Oct 2026          ← tie line stays in the header

HAS SEEN BOTH                                   (when two covered companies)
[KALYANKJIL] ── F ── [TITAN]  …roles, years, two questions…

WHY TALK TO THEM NOW
KALYANKJIL  Revenue up 31.4% YoY, PBT before one-offs up 38.9%
TITAN       Earnings-call transcript filed
TITAN       Revenue up 10.1% YoY, PBT before one-offs up 53.0%
Draft a note ›                                                   (folded)

CAREER
…bars, education…
About this profile ›           ← tie-strength arithmetic + synthetic disclaimer
```

| Element | Today | Proposed | Why |
|---|---|---|---|
| How you reach them | Always shown | **Only when there is an introducer** (a via). For direct contacts the header's tie line already says it | A three-node path You → Farah → TITAN adds nothing to "Company IR contact, strong tie" |
| Why talk to them now | Up to five items, draft open | Three items, "See 2 more" if there are more; draft **folded** as on the investigation page | Consistency; the textarea is 250px of empty form on arrival |
| Has seen both | After the list | **Before** the list, when present | It is the most distinctive thing on the page |
| Connects you to | Always | **Only when "Has seen both" is not shown** (one covered company) | Same facts twice |
| Career | Bars + education | Unchanged | |
| Tie strength details + disclaimer | Two blocks at the foot | One meta block | |

Expected: Farah's page from 2,180px to about 1,450px.

## 8. Holdings sheet, questions, settings

**Holdings sheet.** Drop the two-line explanation ("A demo investor's 18 NSE holdings…"); say "Weights add up to 100%; research names carry none" as a caption under the list. Keep List / Coverage / Agenda as a segmented control. Move "Where I lack context" to the right end of the same row as a bordered pill with its count. The first holding should be visible without scrolling the sheet (today it is 300px down inside the sheet).

**Questions page.** Fine. Add the company chip's count ("KALYANKJIL · 2 questions") when more than one.

**Settings.** Fine as a form. Two small things: add the theme choice next to the colour-blind toggle so both display settings live together, and a "Switch all on / off" text link above the announcement-type list.

## 9. Shared system changes

1. **Meta block.** One collapsed `details` at the foot of card, company, investigation and person pages, summary "About this item ›" (or "…this company", "…this page", "…this profile"). Inside, in order: sources · why it is here (one sentence + the order arithmetic) · methodology/provenance · the synthetic-network line. This removes three to four rule-headed sections from every detail page.
2. **Controls.** Segmented control (black fill, equal widths) for views: windows, Growth/Margins, YoY/QoQ, Needs attention/All/History, List/Coverage/Agenda. Bordered pill with count for filters: lenses, "Where I lack context". Text link with › for navigation. Black button only for Follow, Save and Copy. Revisit choices become a segmented control too.
3. **Question card.** One component wherever a question is offered (card page, company results, "Worth your attention" rows use its compact form): tint background, kicker, question in serif subhead, "Investigate ›" link at the end. The black Investigate button goes.
4. **Section rhythm.** 48px above a major section, 32px above a minor one, 24px between items inside a section. Today everything is 40px, so the page has no beat.
5. **Captions.** A chart gets one caption line at most. The sparkline key moves to the chart's `title` and the alerts' collapsed part.
6. **Disclaimer wording**, used everywhere: "Filings and prices are real. The people are synthetic profiles for this prototype."

## 10. New elements worth adding

| Element | Where | Why it earns a place | Cost |
|---|---|---|---|
| Edition summary line | Home, under the window tabs | Lets the reader size the day in one glance; every number already exists | Small |
| Filing marks on the header sparkline | Company header | Price and filings in one picture at the top of the page; marker code exists | Small |
| Sticky section nav | Company page | Four screens with no way back; the only fixed element is the search dock, at the bottom | Small |
| Price moves as one line | Company filings | Replaces up to 11 rows with one line and a link to the chart | Small |
| Collapsed exact tables | Card and company results | The chart leads, the figures remain one tap away | Small |
| "Alerts at the close" | Home | Matches the brief's end-of-day trigger; keeps the box short | Small |

Not recommended now: a bottom tab bar (the search dock is the one fixed element and the brief's review warned against stacking), a portfolio chart on the home page (the edition is the home page), and any further chart type (the current set answers the questions the brief asks; more would compete).

## 11. Order of work and checks

1. Shared: meta block, question card, control styles, section rhythm (half a day). Everything after this gets shorter for free.
2. Home: alerts strip, summary line, lead-card trims, disclaimer to the footer (half a day).
3. Card page: question under the chart, table folded, move "why" trimmed (two hours).
4. Company: attention rows, sticky nav, header marks, promise row trims, moves as one line (half a day).
5. Investigate: four steps, grid removed, lens caption (two hours).
6. Person: conditional path, bridge first, folded draft (two hours).
7. Holdings sheet, settings, questions (one hour).

Checks before calling any step done, on the live site in one normal-browser session: first lead headline on the first screen of every window; question card on the first screen of every card page; no number stated twice on one screen; page heights at or under the targets above; 320px and 390px with no sideways scroll; dark mode; keyboard reach of every control; the "Last said" and source links still reachable inside their folds.

Targets: home 7d ≤ 1,500px · results card ≤ 1,200px · BEL ≤ 2,700px · results investigation ≤ 2,300px · person ≤ 1,500px.

## 12. Result (implemented 12 Nov 2026)

Measured locally at 390×844 with the same data as the live site, every screen full-page.

| Screen | Before | After | Target |
|---|---|---|---|
| Home, 24 hours | 1,090 | 1,042 | |
| Home, 7 days | 2,154 | 1,725 | 1,500 (not met) |
| Home, 30 days | 2,080 | 1,673 | |
| Card, results | 1,736 | 1,149 | 1,200 (met) |
| Card, move | 1,557 | 1,128 | |
| Card, people | 1,517 | 1,206 | |
| Company, BEL | 3,808 | 2,764 | 2,700 (64 over) |
| Company, Kalyan | 3,540 | 2,212 | |
| Company, ITC | 2,733 | 2,273 | |
| Investigate, results | 2,869 | 2,375 | 2,300 (75 over) |
| Investigate, promise | 3,133 | 2,905 | |
| Person (Farah) | 2,180 | 1,444 | 1,500 (met) |

Checks: first lead headline on the first screen of every window (7 days: 754px before, ~540px after); the question card on the first screen of every card page (results 574px, move 769px, people 292px); no sideways scroll at 320px or 390px on any screen; no console errors; dark mode; keyboard reaches every control in reading order, folds included; sources reachable inside "About this item".

Where the build differs from the plan, and why:
- **Home 7 days stays over target.** Its three lead cards are 310, 293 and 267px and hold only what §3 keeps (meta, headline, bars, one sentence, person and action). Meeting 1,500px would mean cutting one of those.
- **Summary line uses commas, not "·".** Dot separators were removed from the app on 11 Nov; the parts are separated by punctuation, as the separator rules require.
- **Revisit choices are short segments** ("Results", "Call", "Any filing", "A date", with full names for screen readers) so a segmented control fits one row; the caption spells out what each does.
- **YoY / QoQ labels** replace "vs a year ago / vs last quarter" so both chart controls fit one row; screen readers hear the full wording.
- **The "Lack context" pill** is shortened from "Where I lack context" so it fits beside the view control; the full wording is its accessible name and the explanation appears when it is on.
- **A single lens is stated, not offered.** When only one lens fits anyone, the investigation says "Matched for execution…" instead of showing one pill with nothing to switch to.
- **The investigation's relationship path is inline** (each link's evidence on its node's line), as the §6 wireframe draws it; the person page keeps the two-line form, shown only with an introducer.
- **Filings on the company page are dense rows** (kind and time over the headline), as the §5 wireframe draws them.
