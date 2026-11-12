# FINN interface design plan (12 Nov, evening)

A plan, not code. It covers who the screens are for, the look to aim at, the type, how every number is written, the colours, the spacing, each component and each screen, motion, and the order to build in. Measurements in this document were taken from the current build at 390×844 (iPhone size) and 320px; the font comparison was rendered in Chrome with the real Google Fonts files.

## 1. Who this is for, and what that decides

The brief describes one person: a lean public-markets investor in India (a family office or a small fund), holding 15–20 NSE names, who wants to be told what changed and who can help. Not a trader watching ticks, not a retail app user who needs persuading, not an analyst who wants every ratio. Someone who reads the FT or the Economist on a phone, keeps Zerodha Kite open on a second screen, and has two spare minutes at 7:30 am and ten at 6 pm after the close.

Four sessions, which the design has to serve in this order:

| Session | When | What they need in the first second |
|---|---|---|
| Morning glance | 7:30 am, phone, one thumb | Anything material since last night? If not, say so and let me go. |
| After the close | 4:00–6:00 pm | What moved, what was filed, which rule of mine fired. |
| One company, properly | Evening or weekend, 10 minutes | What changed, what management promised and whether it held, the numbers, who to ask. |
| Before a conversation | Any time, 30 seconds | Why this person, what to ask, a note I can send. |

What that decides:
- **Calm, not exciting.** The investor already has a trading app with flashing numbers. FINN's job is the opposite: a few sentences, set well, that end. The reference is a well-printed newspaper, not a dashboard.
- **Numbers are the content, not decoration.** They must be exact, consistent, and visibly sourced. A number set in a casual font or a vague unit costs trust immediately.
- **Finishability.** The edition starts, ranks, and ends. The Economist's Espresso is explicitly built to give readers "permission to do something else for the rest of the day"; that's the right feeling for the morning glance.
- **Trust over cleverness.** Zerodha's Kite is praised by its users precisely for not using "bold red or green boxes" and letting people concentrate on numbers. FINN should be at least that quiet.

## 2. The direction in one line

**A private morning paper for one investor:** paper and ink, one accent colour, a confident serif for what matters and a plain sans for everything else, numbers set in tabular figures that line up, hairlines instead of boxes, and nothing on the screen that doesn't earn its place.

This keeps the identity the current build has (which an independent reviewer called "a coherent editorial product") and fixes what makes it feel unfinished: an inconsistent type scale, numbers written five different ways, grey-on-grey labels, glyphs that are too small to read, and sections that explain themselves instead of showing the news.

## 3. What was borrowed, and from whom

| Source | What they do well | What FINN takes |
|---|---|---|
| Financial Times (Financier Display + Metric) | A bespoke serif for headlines over a plain sans for UI; the serif carries the authority, the sans carries the data. | The same two-family structure, with a serif that has optical sizes so it works at 20px and 30px. |
| The Economist Espresso | Five items a day, a finite edition, and a sense of being done. | The end-of-edition mark stays; the empty state says "nothing" with confidence. |
| Zerodha Kite | No coloured boxes, no neon; numbers in calm colours; whitespace. | Red and green only on the figure itself, never on a background; no badges. |
| Apple Human Interface Guidelines | 17pt default body, 11pt absolute minimum; Dynamic Type. | Body at 17px; nothing under 12px; the layout survives 120% text zoom. |
| Granola | Facts in black, machine additions in grey. | Three inks: filed facts, FINN's inference, the investor's own input. |
| Hebbia Matrix | A grid where every cell is a cited answer. | The promise matrix keeps its citations one tap away, but opens as a list first. |
| Robinhood | A dedicated mono-spaced figure face for every price and delta. | Tabular figures everywhere a number can sit above another number; not a monospace face, which reads like a typewriter in prose. |

## 4. Typography

### 4.1 The test

I rendered the same results card in five serifs and the same number blocks in four sans faces (`scratchpad/ui/fonts/fonts.png`). Findings:

- **Newsreader (current)** is correct but reticent: a small x-height, so at 19px it looks lighter and smaller than the 16px body under it. Hierarchy is weak.
- **Fraunces** has a larger x-height and an optical-size axis (small sizes get sturdier, large sizes get finer). At 19px it reads a size bigger than Newsreader at the same setting and has warmth and personality without being decorative. Best of the five for a phone.
- **Source Serif 4** is clean and neutral, close to Newsreader with a touch more weight. A safe second choice.
- **Instrument Serif** is condensed and thin; it looks elegant at 30px and disappears at 19px. No.
- **Literata** is bookish; good for long reading, heavy for headlines. No.
- **Numbers:** Geist, Inter and IBM Plex Sans all set tabular figures well. Geist's figures are the narrowest and cleanest; IBM Plex has the most character but its "₹" is heavier. Keeping Geist means no new font file and no change to the UI's feel.

### 4.2 Decision

- **Headlines and titles: Fraunces**, weight 500, optical size tied to font size (`font-optical-sizing: auto`), with the "soft" axis at 50 so it doesn't look like a wedding invitation. Google Fonts, variable, one file.
- **Everything else: Geist**, weights 400, 500, 600.
- **Numbers: Geist with `font-variant-numeric: tabular-nums`**, weight 500 where the number is the point (a figure in a table, an alert row), 400 inside prose.
- **No monospace anywhere.** The last traces (none in the app now) stay out.

### 4.3 The scale (phone; rem in brackets at 16px root)

| Token | Face | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|---|
| display | Fraunces | 30 / 34 (1.875) | 500 | −0.01em | Company name, person name, "What counts", the FINN wordmark |
| title | Fraunces | 24 / 30 (1.5) | 500 | −0.005em | Detail-page headline |
| headline | Fraunces | 20 / 26 (1.25) | 500 | 0 | Lead story headline on the edition |
| subhead | Fraunces | 18 / 24 (1.125) | 500 | 0 | "Worth a look" headlines, filings on the company page |
| body | Geist | 17 / 26 (1.0625) | 400 | 0 | Prose: the "why", quotes' surrounding text, settings copy |
| small | Geist | 15 / 22 (0.9375) | 400 | 0 | Network lines, table cells, alert rows, list items |
| caption | Geist | 13 / 18 (0.8125) | 400 | 0 | Captions under tables, provenance, footnotes |
| label | Geist | 12 / 16 (0.75) | 600 | +0.08em, uppercase | Kickers and section headings only |

Eight steps; today's build has seven and still 16 distinct combinations because weights and letter-spacing vary ad hoc. The rule is: these eight, and no `text-[...]` escapes.

Quotes (transcript excerpts) are set in Fraunces italic at the body size, as now, because a quotation should look like a quotation.

### 4.4 Behaviour

- `html { -webkit-text-size-adjust: 100% }` stays; the layout must not break at iOS "Larger Text" up to 120%. Test at 390px with Chrome's 125% zoom.
- Line length: the column is 480px max (560 on desktop). At 17px that is 55–62 characters, which is right for reading.
- Headlines are allowed to wrap to three lines; never truncate a headline.
- Network lines truncate to one line in the feed and show in full on detail pages, as now.

## 5. Numbers: one rule per kind of number

Every number on the screen falls into one of the kinds below. Each has one format, used everywhere, so the reader never has to re-learn how FINN writes a figure. The figure character is always the true minus "−" (U+2212), never a hyphen.

| Kind | Format | Examples | Colour | Notes |
|---|---|---|---|---|
| Change in % (YoY, QoQ, price) | sign, 1 decimal, "%" attached | `+31.4%` `−2.5%` `0.0%` | green / red / ink-2 | **No arrow.** The sign is the non-colour cue; the arrow was a third copy of the same fact. Zero reads "flat" in grey. |
| Margin change | sign, integer, "bp" attached | `−154bp` `+27bp` | green / red | Never "%" for a margin change. |
| Margin level | 1 decimal, "%" | `27.9%` | ink | |
| Money, ₹ crore | "₹", Indian grouping, " cr"; 1 decimal under 100, none above | `₹7,328 cr` `₹50.9 cr` `₹2,40,357 cr` | ink | Indian grouping (lakh/crore) everywhere; the audience reads 2,40,357 faster than 240,357. No "lakh cr" abbreviation: it introduces a second unit. Negative: `−₹122 cr`. |
| Money, other | as the source states it | `$60–65 mn` `USD 300 mn` | ink | Never converted. |
| Price | "₹", 2 decimals always | `₹1,061.20` | ink, 500 | |
| Volume multiple | 1 decimal, "×" attached | `2.0×` | ink-2 | "× vol" in alert rows; "2.0× usual volume" in prose. |
| Count | plain integer | `18 holdings` `44` | ink-2 in a count position | |
| Weight | integer, "%" | `6% of portfolio` | ink-3 | |
| Fiscal period | "Q2 FY27", "FY26", "H1 FY27" | | | A space between quarter and year; the matrix header uses `Nov '26` (the call month). |
| Date | `Wed 11 Nov`; add the year only if not this year | `Thu 05 Nov 2025` | ink-3 | |
| Time | 24-hour, IST, `15:30`; time alone when the date is today | | ink-3 | |
| Relative time | avoided; the one exception is "last spoke", written as a month: `last spoke Sep 2026` | | ink-3 | "8 wk ago" is vague and ages badly. |
| Ratio / score | not shown on the surface (tie strength lives under a disclosure) | `0.89` | ink-3 | |

Placement rules:
- A number that can sit above another number (any table, the alerts block, the figures row) is right-aligned, tabular, weight 500.
- A number inside a sentence is set in the sentence's font and weight; no colour unless it's a direction.
- A number always carries its unit and, where it isn't obvious from the column, its period: `₹7,328 cr` under a `Q2 FY27` header; `+26.5% YoY` in prose.
- One decimal place is the default for percentages, never two, never none (except bp and integers).

## 6. Colour

### 6.1 What the current tokens measure

Contrast against the page (WCAG: 4.5:1 for text, 3:1 for large text and glyphs):

| Token (light) | Ratio | Verdict | Token (dark) | Ratio | Verdict |
|---|---|---|---|---|---|
| ink #16150F | 16.8 | fine | ink #ECEAE3 | 15.7 | fine |
| ink-2 #57544B | 7.0 | fine | ink-2 #A8A49A | 7.6 | fine |
| ink-3 #736F64 | 4.6 | passes for 13px text, barely | ink-3 #8F8B82 | 5.6 | fine |
| accent #2448A5 | 7.6 | fine | accent #8AA6F0 | 7.9 | fine |
| up #0F7B3F | 4.9 | fine | up #45C07F | 8.2 | fine |
| down #B42318 | 6.0 | fine | down #F0716A | 6.6 | fine |
| partly #A86200 | 4.4 | **fails for text**; fine as a glyph | partly #E3A03A | 8.4 | fine |
| silent #7D796F | 4.0 | glyph only | silent | 5.6 | fine |
| early #8B877C | 3.3 | glyph only, and the glyph is a 1px dot | early #75726A | 3.9 | glyph only |

So the palette is sound; the problems are usage, not values: ink-3 is used for a lot of 12–13px text, and the "too early" dot is a 3.3:1 glyph two pixels wide.

### 6.2 Tokens to keep, adjust, add

- **Keep:** paper, raised, ink, ink-2, accent, up, down, rule, and all the dark equivalents.
- **Adjust:** `ink-3` light → `#6B675C` (5.2:1) so 13px captions clear 4.5:1 with room. `partly` light → `#8F5400` (5.6:1) so it can also be used as a word.
- **Add:**
  - `tint` = accent at 6% opacity (light) / 12% (dark): the background of the selected window tab's track, the alerts block, and the "no verified overlap" note. One tinted surface, never more.
  - `ink-on-tint` = ink.
  - Status words get the same colours as their glyphs, so a status can be written ("Revised") as well as drawn ("↻").
- **Colour-blind option** (a toggle in What counts): direction colours become blue `#2448A5` for up and orange `#B45309` for down. Investing.com ships the same precedent. Signs already make direction readable without colour; this toggle is for people who want the colour to help too.

### 6.3 Rules

1. Red and green appear only on a direction figure (a percentage change, a bp change, a price move). Never on a background, a border, a word or a status.
2. Status colours appear only on a status glyph or status word in the ledger.
3. The accent appears on links, the one selected control, and the one tinted surface. Not on headings, not on icons for decoration.
4. Dark mode is the same drawing with inverted inks: no new colours, no glow, no pure black (`#111110` stays).
5. Hairlines (`rule`) are 1px and never used as a box around content, except the alerts block and the search results panel, which are the two "raised" objects on the page.

## 7. Spacing and layout

- **Base unit 4px.** Allowed spacings: 4, 8, 12, 16, 24, 32, 48.
- **Page:** 16px side gutters (20px on screens ≥ 400px); column max 480px, 560px on desktop; top padding = safe-area + 12px; bottom padding = safe-area + dock height + 16px.
- **Vertical rhythm:**
  - kicker → headline: 4px
  - headline → body: 8px
  - body → figures row / network line: 12px
  - card padding: 20px top and bottom for a lead card, 14px for a compact card
  - between sections: 40px (a section is a heading plus its content)
  - section heading → first content: 12px
- **Hairline between list items;** no hairline above the first or below the last item in a list.
- **Tap targets:** 44px minimum height for anything tappable; inline links get an invisible 10px halo (the `.tap` class that exists). Chips and buttons are 44px.
- **The dock** is 52px plus the safe area, one row. It hides when scrolling down and returns when scrolling up, so a long page doesn't lose 13% of its height to a search box the reader isn't using.

## 8. Components

### 8.1 Page header (edition)

```
FINN                                   ▶ Listen
Thu 12 Nov · 18 holdings · since 11 Nov 12:07
Demo portfolio · real filings and prices · synthetic network
[ 24 hours ] 3 days   7 days   30 days
```
- Wordmark in Fraunces display, tracking −0.02em. Date line in small/ink-2 with the date in weight 500. The disclaimer in caption/ink-3, one line (it wraps to two today at 390px; shorten the copy to the line above).
- "18 holdings" is a link: it opens a sheet listing the holdings with sector and weight. The audit asked for the holdings to be discoverable; this is the lightest way.
- Window tabs: pills, 44px, the selected one filled with ink. On screens under 360px the labels shorten to 24h / 3d / 7d / 30d (done).

### 8.2 Alerts block

```
┌────────────────────────────────────────────┐
│ ALERTS · 3  at the close          ±5% · 2× ›│
│ SBIN         11 Nov        +1.8%   2.0× vol │
│ KALYANKJIL   11 Nov        +8.6%  10.8× vol │
│ COCHINSHIP   11 Nov        −6.8%  10.4× vol │
│ View all 17                                ›│
└────────────────────────────────────────────┘
```
- Tinted surface, hairline border, 8px radius. Rows are 48px links.
- Columns: ticker (small, 500), date (caption, ink-3), price change (small, 500, direction colour, right-aligned, always shown even when only the volume rule fired, in ink-2 if it didn't fire), volume (small, ink-2). Fixed column widths so rows line up.
- The rules link reads `±5% · 2× ›` (done). Tapping the header's count opens "View all".

### 8.3 Lead card

```
RESULTS · KALYANKJIL · Tue 10 Nov · 17:08
Revenue up 31.4% YoY, profit before
one-offs up 38.9%
EBITDA margin 6.2%, −9bp YoY. Reported profit up
63.9% including ₹73 cr of one-offs. The stock rose
8.6% the next session on 10.8× usual volume.
Revenue      EBITDA      PAT          YoY
+31.4%       +29.7%      +63.9%
◦ Farah Siddiqui works at Kalyan Jewellers now (Head IR) …
```
- Kicker: label style; the kind in ink when the card is a lead, the ticker a link, the time in caption weight 400 (not uppercase).
- Headline: headline token, Fraunces. The whole card is the link (done); the ticker and the person remain separate links.
- Why: body, ink-2, clamped to three lines.
- Figures row: three columns, label in caption/ink-3 over the figure in small/500/direction colour; "YoY" as a fourth, right-aligned caption. No arrows.
- Network line: one line, truncated, the name in accent.
- A people card shows, instead of the figures row, one line in small: `Noel N. Tata · Vice-Chairman · retiring 12 Nov`.
- A move card shows: `Closed ₹1,061.20 · +1.8% · 2.0× usual volume · no filing before it`.

### 8.4 Compact card (Worth a look, filings list)

Kicker, subhead headline, one network line. No why, no figures. 14px padding. Everything else as the lead card.

### 8.5 Section heading

Label token in ink, a 1px ink rule below, 8px padding. Optional right-aligned count in caption/ink-3 (`FILINGS · LAST 30 DAYS      14`). Used for every section on every page; nothing else looks like a heading.

### 8.6 Results table

```
Q2 FY27                         YoY      QoQ
Revenue        ₹7,328 cr     +26.5%   +32.1%
EBITDA         ₹2,041 cr     +19.9%   +47.0%
PBT            ₹2,054 cr     +18.9%   +47.1%
PAT            ₹1,540 cr     +19.6%   +46.1%
EBITDA margin      27.9%     −154bp   +282bp
Consolidated · results PDF p.8 ↗
✓ 4 checks passed                              ›
```
- Header row: label token in ink-3. Rows 40px, hairlines between. Labels small/ink-2, values small/500 tabular right-aligned, changes small/500 direction colour, no arrows.
- Banks: NII, Operating profit, Provisions, PAT, and GNPA as the fifth row. Lenders: no EBITDA row.
- Caption: one line; the verification line stays as a disclosure (done).
- On the edition the table is never shown; only the figures row (done). On the card and company pages the full table.

### 8.7 Promises ledger

The signature screen, and the one that most needs a rethink. Today it opens on a glyph matrix with 10px headers and 1-pixel dots; readers see a wall of symbols before they see a single promise.

**Default view: the attention list.**
```
PROMISED VS DELIVERED · LAST 4 CALLS
● 2 delivered   ↻ 5 revised   — 4 silent   ◌ 7 ended   · 56 open

NEEDS ATTENTION · 11                  [All 73] [History]

QRSAM order (~₹30,000 cr)                    ↻ Revised
by Q4 FY26 → June → September → "very soon"
Last said Nov '26, Manoj Jain · 4 calls

NGC order inflow                              ↻ Revised
~₹10,000 cr in H1 → ~₹20,000 cr for FY27
Last said Nov '26 · 2 calls

FY26 EBITDA margin                           ● Delivered
Promised 27% · stated 30% (May '26, Manoj Jain)
```
- Each row: title (small, 500, ink), the status as a word with its glyph and colour on the right, then one line in caption/ink-2 saying what changed (built from the cells' notes: `was → now`), then a caption/ink-3 line with the last call and speaker. The whole row opens the detail.
- Status words: Delivered, Partly, Missed, Revised, Went silent, Ended (period over, outcome not stated), Open. "Too early" becomes "Open"; it's a friendlier word for the same thing and most rows are in this state.
- **"All"** shows every promise in the same list form, grouped by status. **"History"** shows the matrix, which is where the current four-column grid lives: a 44px row height, 20px glyphs, 12px headers that read `Nov '26`, and a sticky header row.
- The row detail (expanded) keeps what it has: the promise quote with speaker and page, the per-call notes, the latest quote, the outcome quote when there is one, the filed-quarter comparison, the evidence source, and who can verify. It gains a "Compare" line under a settled row explaining the comparison in a sentence (exists in code; make it the second line, not the last).
- The hand-checked reference stays under Methodology (done).

### 8.8 Network line and person "why now"

```
◦ Rhea Kapoor was Head of Strategy, Jewellery at Titan, 2014–21
  Best placed: the closest to this leadership change · strong tie
```
- The name in accent, weight 500; the relation in ink-2; the second line (reason, tie) in caption/ink-3, only on the first person of a list.
- "Worked at the same company, same time" is the strongest claim ever made; the wording stays as the worker writes it.

### 8.9 Source chips

44px pills, hairline, label plus page: `Filing · p.12 ↗`, `Transcript · p.7 ↗`, `XBRL data (XML) ↗`, `Bhavcopy · ZIP ↗`. A chip never pretends to be a page it isn't (done).

### 8.10 Buttons and controls

- Primary: ink fill, paper text, 48px, radius 8, label in small/500. One per screen at most.
- Secondary: no fill, ink-2 text, 44px.
- Toggle pills (window, filter): 44px, filled when selected.
- Sliders and checkboxes: native, accent colour (as now). Checkbox rows 52px.
- Text input: 48px, hairline in ink-3, radius 8, 17px text (iOS needs ≥16px to avoid zoom).

### 8.11 Dock

```
┌──────────────────────────────────┬────┐
│ 🔍 Company, person or theme      │ ⚙ │
└──────────────────────────────────┴────┘
```
- One row (done). A 1px hairline above, paper at 90% with blur. Hides on scroll down, shows on scroll up and whenever the input is focused.
- The results panel above it: raised surface, hairline, groups "Your network · N" and "Companies · N" in label style, rows 48px, a "Searching…" row and a "No matches" row (done). When the keyboard opens on iOS the panel must stay visible above the keyboard: `max-height: 50dvh` and `position: fixed` are already there; test on a real phone.

### 8.12 States

- **Empty edition:** one body line, ink-2: "Quiet window. 11 routine filings, nothing material." plus "See 3 days ›". Never a 28px paragraph.
- **Loading:** the wordmark and "Preparing your edition…" in caption; no spinner.
- **Error / not found:** title in Fraunces, one body line, one primary button. (Exists.)
- **Network unavailable:** a tinted note under the tabs (exists); never "no one".
- **Uncovered company:** the request block becomes a short card: what FINN will do, the primary button, and the status line with its time (exists; restyle only).

## 9. Screen by screen

### 9.1 Edition

Observed now: the header takes 230px before the alerts; the kicker row is 12px grey on paper; lead headlines are 19px; "Worth a look · 9" and "Routine filings, folded · 44" are rows of plain text; the footer repeats the data time.

Proposed:
```
FINN                                   ▶ Listen
Thu 12 Nov · 18 holdings · since 11 Nov 12:07
Demo portfolio · real filings and prices · synthetic network
[ 24 hours ] 3 days   7 days   30 days

┌ ALERTS · 3 ─────────────────── ±5% · 2× › ┐
│ … three rows …                             │
└────────────────────────────────────────────┘

NO LEAD STORY
Quiet window. 9 updates worth a look below.  See 3 days ›

WORTH A LOOK                                 9
  (compact cards)

ROUTINE, FOLDED                             44
  Investor meet schedules        22  ›
  Other housekeeping              8  ›
  …

· end of edition ·
Filings to 12:07 IST · prices to the 11 Nov close
```
- "Worth a look" and "Routine, folded" become section headings with counts, not summary rows; the chevron rotates when open. Opening them animates (done).
- Inside the routine fold, each filing is one 44px row: ticker (500), subject (ink-2, single line, truncated), time (caption), and the PDF/XML link as a chip at the end. XBRL facts, when present, are a second caption line (done).
- "Since last visit" keeps its pill in the tab row.

### 9.2 Card detail

Observed now: good order; the "From the filing" person line reads as raw fields (`Noel N. Tata · retire · Non-Executive, Non-Independent Director and Vice-Chairman`); the ranking section is a bullet list.

Proposed:
- Header: BackLink; kicker; title (24px Fraunces); company in small/ink-3; why in body.
- Results: the full table.
- People: each person as a composed sentence in body: **Noel N. Tata**, Non-Executive Director and Vice-Chairman, retiring effective 12 Nov 2026. Employers and schools as a caption line. The overlap note on the tinted surface.
- Who can explain this: the network lines with the "best placed" reason under the first (done).
- Sources: chips.
- Why this is here: three short bullets (done) and the arithmetic behind a disclosure (done).

### 9.3 Company

Observed now: order is right (what they do, results, promises, people, filings); the section shortcuts are chips; the ledger matrix dominates; filings repeat the same compact card.

Proposed:
- Header: kicker `BEL · Defence PSU · 6% of portfolio`; name in display; price line `₹399 +1.1% · close Wed 11 Nov`.
- Section shortcuts: keep, as 40px hairline pills; they scroll the page (anchors) and the active one fills as you scroll (a small client component with IntersectionObserver).
- What they do: two sentences and "More, with segments" (done).
- Latest results: the table.
- Promises: the attention list (8.7).
- People who'd know: up to three lines.
- Filings and moves: compact cards, no people (done); moves in this list show only if they met the 2%/1.5× floor (done).
- Uncovered: name, "Not covered yet", the request card.

### 9.4 Person

Observed now: good order after today's change; the draft textarea is a plain box; career rows are fine.

Proposed:
- Header: kicker `YOUR NETWORK · PRIVATE TO YOU`; name in display; role line in body/ink-2; "How you know them" in small/ink-3 with the tie strength as a word.
- Why talk to them now: up to five rows, each a 48px link (done); the draft below with its label, a 5-row textarea in body size, and a primary Copy button.
- Connects you to; Career; the tie-strength disclosure; the synthetic-profile footnote.

### 9.5 Settings ("What counts")

Observed now: already the cleanest screen. Sliders show their value right-aligned; checkbox rows are 52px.

Proposed: restyle to the scale only; add the colour-blind toggle under a new "Display" group; the explanation under each slider in caption/ink-3 and at most two lines.

### 9.6 Search

Done today; restyle to the scale. Add two example chips under the input on focus when it's empty: `BEL`, `specialty chemicals`, `Rhea`, so the first-time visitor sees the three kinds of search.

### 9.7 Not found / error

Restyle to the scale. Nothing else.

## 10. Motion

- Page change: 160ms crossfade (done). Back navigation keeps scroll (done).
- Disclosures: 200ms height animation (done).
- Dock hide/show: 200ms translate.
- Nothing animates on idle; no skeleton shimmer; no number counting-up.
- All of it off under `prefers-reduced-motion` (done).

## 11. Accessibility and device checklist

- Every control 44px; every inline link with the halo.
- Body 17px, minimum 12px, captions 13px at ≥ 4.5:1.
- Direction is never colour alone: the sign is always there.
- Status is never colour alone: a glyph, and in lists a word.
- `aria-current` on the selected tab, `aria-pressed` on toggles, `aria-expanded` on rows (done).
- iOS: inputs ≥ 16px so Safari doesn't zoom (done); `viewport-fit=cover` and safe-area paddings (done); the dock above the keyboard (to test on a device); the standalone status bar colour matches paper in both modes (done).
- 120% text zoom: no overflow, no clipped tabs.

## 12. Build order, with what to measure

| Step | What | Done when |
|---|---|---|
| 1 | Fonts and scale: add Fraunces, remove Newsreader, set the eight tokens, sweep every `text-[...]` | 8 text styles in the audit script, 0 under 12px |
| 2 | Numbers: one `<Figure>` helper used everywhere; remove arrows; Indian grouping; true minus; "last spoke Sep 2026" | grep finds no `▲`/`▼` in components; every % has one decimal |
| 3 | Colour tokens: ink-3 and partly adjusted; `tint` added; colour-blind toggle in settings | contrast script shows every text token ≥ 4.5:1 |
| 4 | Edition: header, alerts block, section headings with counts, routine rows | 390px screenshot matches §9.1; height of the 7-day edition ≤ 1,400px closed |
| 5 | Ledger: attention list default, status words, History matrix with 20px glyphs and 44px rows | BEL page: no text under 12px; every status readable as a word |
| 6 | Card and company: composed people sentences, table restyle, shortcut highlighting | screenshots |
| 7 | Dock: hide on scroll, example chips | real-phone test with the keyboard open |
| 8 | Dark mode pass over every screen | screenshots in both modes, contrast re-run |
| 9 | Phone test by you; fix what you find | — |

Each step is one commit. Steps 1–3 change no page structure and can ship in one go; 4–7 are one screen each.

## 13. Considered and rejected

- **A dark default.** The audience reads in the morning and the evening; dark mode is right at night and wrong at a desk. Follow the system setting, as now.
- **A bottom tab bar** (Edition / Companies / People / Settings). FINN has one front door, the edition, and everything else is one tap from it. A tab bar would promise four equal places and invite a feed.
- **Sparklines in the results table.** The data holds three columns (this quarter, last quarter, a year ago), not five; a three-point sparkline misleads.
- **Icons for card kinds.** The kicker word does the job; icons would need a legend.
- **A composite credibility score** on the ledger. A single number invites false precision; the counts by status are the honest summary.
- **Floating cards with shadows, gradients, coloured left borders.** Every anti-slop catalogue lists them; the hairline list is the right form for an edition.
- **Changing the sans to Inter.** Nothing would improve, and the product research notes it as the "default generic" choice.

## Sources consulted for this plan

- FT's Financier typeface and 2014 redesign: [Eye on Design](https://eyeondesign.aiga.org/new-financier-font-gives-the-financial-times-a-smart-luxurious-update/), [Design Week](https://www.designweek.co.uk/issues/september-2014/how-the-ft-developed-its-new-look/), [Fonts In Use](https://www.fontsinuse.com/typefaces/42501/financier-text)
- The Economist Espresso as a finite edition: [Campaign Asia](https://www.campaignasia.com/article/with-espresso-economist-delivers-daily-dose-of-intelligence/391888), [Digiday on the 2022 relaunch](https://digiday.com/media/inside-the-relaunch-of-the-economists-subscription-mobile-app)
- Zerodha Kite's restraint: [TradingQnA](https://tradingqna.com/t/why-is-kite-built-with-such-a-minimal-interface/6373), [YourStory](https://yourstory.com/2020/11/app-kite-zerodha-speed-simplicity-first-time-stock-trader)
- Apple HIG typography (17pt default, 11pt minimum): [developer.apple.com](https://developer.apple.com/design/human-interface-guidelines/typography.md)
- Colour-blind-safe direction cues and tabular figures: [Datawrapper](https://www.datawrapper.de/blog/colorblindness-part2), [Tableau text-table tips](https://www.tableau.com/blog/if-you-must-use-text-table-follow-these-5-design-tips-53766), [data.europa.eu accessible colours](https://data.europa.eu/apps/data-visualisation-guide/accessible-colours)
- Indian digit grouping conventions: [engineered.at](https://engineered.at/articles/convert-number-to-indian-format-number-using-javascript), [django-indian-numbers](https://github.com/defcon-007/django-indian-numbers)
- Robinhood's figure typography (unofficial token export): [shadcn.io design reference](https://www.shadcn.io/design/robinhood/raw); Apple Stocks watchlist change toggles: [screensdesign](https://screensdesign.com/showcase/stocks)
- FINN's own product research, `docs/research/03-product-design.md` §4, §6, §7.

## Result (implemented 12 Nov; same measurement scripts)

| Check (390px unless noted) | Before this plan | After |
|---|---|---|
| Text under 12px | none, except decorative arrows | none (the arrows are gone) |
| Distinct text styles | 16 | 14 (the eight sizes; weight variants for figures and the wordmark) |
| Tap targets under 44px | ≈ 8 | 4, all section-shortcut pills at the planned 40px |
| Card links checked | 157 local / 145 live | 154 local / 142 live, 0 broken |
| Browser console errors | 0 | 0 |
| 125% text size | not tested | no sideways scroll or clipped controls on any screen |
| Colour-blind toggle | — | up green → blue, down → orange, persists across pages |

Deviations from the plan, decided by looking at the rendered result:
- **Fraunces weight 440, not 500.** At 500 it read heavy at 18–20px on a phone; the font comparison had been rendered at 400.
- **The tint is a warm deeper paper (#EFEBE2), not accent at 6%.** The blue mix read as cold grey against the warm paper.
- **The 7-day edition is 1,692px, not ≤ 1,400px.** Larger body text (17px) and the alerts block cost the height. Trimming further would mean cutting the "why" line on lead cards, which carries the explanation.
- **Alert rows put the date under the ticker** so long tickers survive larger text sizes.
- **Not done:** tapping the alerts count to open "View all" (the "View all" row does it).
