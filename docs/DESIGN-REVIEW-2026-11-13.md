# FINN design review: every feature, where it should sit, and how it should look

Written 13 Nov 2026 against `docs/FEATURES-2026-11-13.md` (the inventory) and the build at commit `c24acec`. Method: every screen was rendered at iPhone 13 size (390×844, 2×) in light and dark with the folds opened (`scratchpad/ui/review/*.png`), and each feature was checked against its code, its tokens in `globals.css`, and the rules set on 12 Nov (`UI-DESIGN-PLAN-2026-11-12.md`). No code changed.

Verdicts use five words. **Keep**: right place, right look. **Adjust**: same place, a visual or copy change. **Move**: a different place. **Merge**: fold into another feature. **Remove**: drop it.

A thing to say first: the foundation is sound. One serif, one sans, one accent, hairlines, tabular numbers, status by shape and word. An independent reviewer on 12 Nov called it coherent, and it still is after three more days of features. Nothing here changes the system. The work is in the places where the last three days added faster than they edited: the company page's section bar, the ledger's list rows, the settings page's three kinds of switch, headlines that still carry the exchange's raw subject, and a dozen small inconsistencies listed per feature below.

---

## Part A. The system: decisions that apply everywhere

### A1. Type

**Keep Fraunces + Geist.** The 12 Nov comparison (five serifs, four sans) stands, and the screenshots confirm the choice on a phone: Fraunces at 20–30px carries the headline without shouting; Geist's tabular figures line up in every table. No new font.

Refinements (each is one CSS line):

| # | Rule | Why | Where it bites today |
|---|---|---|---|
| T1 | **Tickers are always Geist 500, 0.02em tracking, never the serif and never bold.** | A ticker is an identifier, not a word; it should look the same in a chip, a row and a kicker | Alert rows (500, ok), research rows (accent 500, ok), the Reconnect line (ticker is inside prose, fine). Consistent already; make it a class (`.ticker`) so it stays so |
| T2 | **Headlines wrap to three lines maximum; a fourth is prevented by copy, not clamp.** | "Change in Directors/KMP/SMP/Auditor/RTA filed" takes three lines of 24px serif on the card page and breaks mid-slash | Fixed by rule C1 (humanised subjects), not by CSS |
| T3 | **The label step (12px uppercase) is used for kickers and section headings only, never for a value.** | It is at the floor of legibility | Chart axis labels at 9px (`fontSize="9"` in PriceVolumeChart and the settings scatter) break the "nothing under 12px" rule. Raise to 11px (`--text-label` minus 1) and shorten the labels ("Close ₹", "Volume") |
| T4 | **Serif italic only for a quotation.** | A quotation should look like one | "End of edition" is serif italic and is not a quote. Make it serif roman at body size, ink-3. Keep the rules either side |
| T5 | **Weight 500 only where the number is the point.** | Bold everywhere is bold nowhere | Alert % is 500 only when the price rule fired (right); results table values 500 (right); portfolio weights "11%" 400 (right). Keep |
| T6 | **Fraunces optical size at 30px: test `font-variation-settings "opsz" 30` explicitly** | At display size the auto optical size thins the strokes; "What counts" and "Titan Company" read a touch lighter than "FINN" at the same size because the wordmark is 600 | A test, not a fact: render both and keep whichever matches the wordmark's colour on the page |

### A2. Colour

**Keep the palette** (paper/ink/accent/tint/up/down and the six status colours; contrast measured 12 Nov, all pass). Three usage corrections and one addition:

| # | Rule | Where it bites today |
|---|---|---|
| K1 | **The accent fills nothing except the selected segment (ink does that) and the alert-day bar.** No filled blue buttons. | The **Ask** button (`bg-accent`) is the only filled-blue control in the app; "Follow this question" and "Save and return" are ink. Make Ask ink-filled too |
| K2 | **Native form controls take the accent, but only one kind of on/off control exists per page.** | Settings mixes blue native checkboxes (Alert kinds, Announcement types, Colour-blind) with a custom grey/blue switch (Notify). See S4: switches everywhere |
| K3 | **Grey rings at 3:1 are a glyph, not a row's main content.** | The ledger's *All* view puts a strip of four faint rings on every row (see L5); they read as noise. Keep the strip in History only |
| K4 | **Add one token: `--mark` = ink-3 at 60% for chart furniture** (gridlines, the dashed average, axis text) so charts stop choosing between `rule` (too faint) and `ink-3` (too strong) | PriceVolumeChart uses `fill-ink-3` for axis text and `stroke-rule` for the baseline; the sparkline uses ink-3 bars at 60% opacity inline. One token, used by all four charts |

Direction colour stays only on direction figures (checked on every screenshot: no red/green background, border or word anywhere). Status colour stays only on the status glyph and word. The colour-blind toggle stays as it is.

**Dark mode** was checked on every screen: the same drawing with inverted inks, no new colours. One flaw: the question card (`bg-tint` #26241f) and the raised search panel are hard to tell apart from the page at #111110 in a dim room. Raise dark `--tint` to `#2a2822` (still no glow; one step). Test, then keep if the alerts box reads as a box.

### A3. Controls and the tap language

The four-way tap language (blue opens a page, ↗ opens outside, grey turning › expands, seg/pill switches) holds on every screen. Three gaps:

| # | Gap | Fix |
|---|---|---|
| C-a | A `.seg` with a count inside overflows at 390px: "**eeds attention 2**" is cut on BEL's ledger | Counts never go inside a segment label. Three segments max per track; counts go in the section heading or beside the track |
| C-b | The company page section bar has six segments; "Overview" touches its own edge | Five segments: drop *Overview* (the company name at the top is where the page starts; "Back" is one tap). Or make the bar a scrollable pill row. Recommend dropping Overview |
| C-c | Chips wrap badly when the label is long: in the Agenda, "↗" lands alone on a line after a long event name | Agenda rows: ticker as a 12px kicker *above* the event name (like the filing rows), not a chip beside it |

### A4. Copy rules that are really design rules

| # | Rule | Why it is in a design review |
|---|---|---|
| C1 | **No raw exchange subject ever reaches a headline, an alert row, a notification or the Reconnect line.** A rule table in the worker maps NSE subjects to plain phrases: "Change in Directors/KMP/SMP/Auditor/RTA" → "Director, KMP or auditor change"; "Alteration Of Capital and Fund Raising-XBRL" → "Capital change or fund raising"; "Newspaper notices" stays | Today's lead on the 24h edition is "Change in Directors/KMP/SMP/Auditor/RTA filed" in 20px serif, with slashes. It is the first thing a reviewer sees. It is also why the filed-alert row truncates to "Change in Directors/KMP/SM…" |
| C2 | **A "why" line is a reason or nothing.** | "Filed as XBRL data only (no PDF)" sits where the reason goes on two of four cards on the 24h edition. That is a source note: move it to the card's meta line as a tag ("XBRL only") and leave the why empty |
| C3 | **"Best placed" says the fit, never the tie.** | "Best placed: A strong tie." on the Kalyan results card says nothing about the results. Rule: when the only reason is tie strength, omit the Best-placed line |
| C4 | **One sentence of chrome per section.** Every section may have one caption; a second becomes an About entry | Mostly held since part 4; the remaining doubles are listed per feature |

---

## Part B. Feature by feature

Numbers match `FEATURES-2026-11-13.md`.

### 0. App-wide

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 0.1 | Search dock | Fixed bottom, 44px field, placeholder "Company, person or theme", results drop up in a raised panel | **Adjust** | Placeholder: "Company, person, theme, or ask…" (the dock now takes questions). Field border `ink-3` is the darkest hairline in the app; use `rule` at rest and `accent` on focus (as the Ask box does), so the dock sits quieter under the page |
| 0.2 | Try chips | Appear when focused and empty | **Keep** | |
| 0.3 | "Who knows X" answer line | Top of results, small text | **Keep** | |
| 0.4 | "Ask {SYM}'s documents" row | Top of results on company/card pages | **Keep** | Good placement: the most likely intent first. Its two-line form (title + grey subline) is right |
| 0.5 | Microphone | Inside the field, right | **Keep** | ink-3 at rest, accent while listening: right |
| 0.6 | Rules button | Right of the dock, sliders icon, "Rules" word ≥400px | **Keep** | |
| 0.7 | Dock hides on scroll down | | **Keep** | |
| 0.8 | Loading bar | 3px accent at top | **Keep** | |
| 0.9 | Skeletons | Page shape, "Opening…" | **Keep** | |
| 0.10 | ‹ Back | Top-left, accent | **Keep** | |
| 0.11 | About fold | Foot of each page, "About this …" + grey › | **Keep** | |
| 0.12 | Tap language | | **Keep** | See A3 for the three gaps |
| 0.13 | Ticker chips | Outlined, accent text, 28px | **Keep** | Apply T1 |
| 0.14 | Status icons | Drawn family, 20px | **Keep** | Apply K3 (where the strip appears) |
| 0.15 | Theme | Masthead toggle + settings | **Keep** | See A2 dark tint |
| 0.16 | Colour-blind mode | Settings | **Keep** | |
| 0.17 | PWA | | **Keep** | |
| 0.18 | Number style | | **Keep** | |

### 1. Edition (home)

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 1.1 | Wordmark | Fraunces 30/600 | **Keep** | |
| 1.2 | Listen | "▶ Listen, 1 min" accent, top-right | **Keep** | Place: right. The duration in ink-2 after the word is the right amount of information |
| 1.3 | Theme switch | Moon/sun icon, right of Listen | **Keep** | |
| 1.4 | First-visit line | Tinted box, caption, "Got it" | **Keep** | |
| 1.5 | Date | "Friday 13 November", small/500 | **Keep** | |
| 1.6 | Three door tiles | Outlined tiles, icon + name + count + › | **Keep** | The 13 Nov tile redesign reads as three doors. One detail: the counts ("18 holdings", "53 read", "29 people") are ink-3 caption; make them ink-2, they are the tiles' content |
| 1.7 | Since-last-visit chip | Above the window control | **Keep** | |
| 1.8 | Window control | Four-segment, ink active | **Keep** | |
| 1.9 | Summary sentence | Dotted-underlined jump links, caption | **Adjust** | The dotted underline on four phrases in a row is busy. Jump links in accent with no underline (the colour is the tap cue, as everywhere else); the sentence in ink-2 |
| 1.10 | Stale note | Conditional | **Keep** | |
| 1.11 | Network-down note | Conditional | **Keep** | |
| 1.12 | Alerts box | Tinted box, header + count badge + "Your rules ›", caption, rows | **Adjust** | (a) When no price alert fired, "None at the latest close." takes a 44px row: fold it into the caption, "Price ±5% or volume 2×: none at the 13 Nov close". (b) The count badge (ink circle, white number) reads as an unread badge; it is a count. Use the `.count` style (tint pill, ink number) the headings elsewhere use. (c) Box border `rule` + `bg-tint`: keep; it is one of the two "raised" objects allowed |
| 1.12a | Price rows | ticker/date, sparkline, %, "2.3× usual", › | **Keep** | The best row in the app. The sparkline column hidden under 360px is right |
| 1.12b | Filed group | "Filed: results, deals and management changes" caption, rows with kind kicker + truncated headline | **Adjust** | Caption → "Filed today" (the kinds are in Your rules; the caption shouldn't recite them). Headline truncation stops being ugly once C1 lands |
| 1.12c | "N more" fold | Accent summary, key line for sparklines inside | **Keep** | |
| 1.13 | Lead cards | Meta line, serif 20 headline, why, fact line, network line | **Adjust** | (a) C1 and C2 fix the two ugly leads on the 24h edition. (b) The results growth bars (three bars from one zero line, figure right) are right. (c) The promise line (↻ icon + "Promised… below the target ›") is the best single addition of the week: keep, and make the icon the status colour it already is. (d) Network line: avatar + name + "Investigate ›": keep |
| 1.14 | Quiet-window message | Body text + "See 3 days ›" | **Keep** | |
| 1.15 | A reason to reconnect | Kicker heading, one ReconnectLine | **Keep** | Place: after the leads is right; it is the day's one network item. Apply C1 to its filing text |
| 1.16 | Questions you follow | List after reconnect | **Keep** | |
| 1.17 | Worth a look | Fold, compact cards | **Adjust** | The compact card's person line ("Deepa Krishnan **was Head**") truncates the role to two words and reads as a non-sentence. Rule: the person line shows the name and the lens tag only ("Deepa Krishnan · Money" without the dot: name, then a tag). The relation lives on the card page |
| 1.18 | Routine, folded | Fold, groups, inner folds, PDF ↗ | **Keep** | |
| 1.19 | End of edition | Serif italic between rules; two caption lines | **Adjust** | T4: roman, not italic. The two caption lines are right |

### 2. Portfolio sheet

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 2.1 | View control | List / Coverage / Agenda seg + "Lack context 5" pill on one row | **Keep** | |
| 2.2 | Lack-context pill | Outlined pill with count | **Keep** | |
| 2.3 | List | ticker + sector tag, name, "1 this week", weight, › | **Keep** | Weight at 17px/400 at the right is quiet and right |
| 2.4 | Coverage | Matrix with weight bar; four cells with ring/dot + word + › | **Adjust** | The four column headers wrap to two lines each and take 60px. Shorten: "Updates", "Research", "People", "Questions"; the period ("7 days") moves to the sort row's caption. The filled/outlined dot per cell is a good device; keep |
| 2.5 | Agenda | Timeline, ticker chip + event + ↗ + "Announced by the company" | **Adjust** | C-c: ticker as a kicker above the event, not a chip beside it; the ↗ stays on the event's line. "Announced by the company" repeats under every row: say it once in the caption at the foot (already there) and drop the per-row line; keep "Your revisit date" per row because it is the exception |
| 2.6 | Questions you follow link | Foot of sheet | **Keep** | |

### 3. Filing card

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 3.1 | ‹ Edition | | **Keep** | |
| 3.2 | Meta line | Kind kicker, ticker chip, time | **Adjust** | Add the "XBRL only" tag here when the filing has no PDF (C2) |
| 3.3 | Headline + company | Serif 24 + ink-3 small | **Keep** | C1 for the text |
| 3.4 | Why | Body, ink-2 | **Keep** | C2 |
| 3.5 | Results chart | Growth/Margins + YoY/QoQ segs; two bars per metric; legend; caption | **Adjust** | Two seg controls on one row (left and right) is the only place two controls share a line. It works, but the right pair's labels (YoY/QoQ) are the comparison, which belongs *with* the legend below the bars, not above. Move YoY/QoQ to the legend row: "● Q2 FY26 ● Q2 FY27 · [YoY | QoQ]" with the legend naming the periods the choice produces. One control above (what), one below (against what) |
| 3.6 | Price/volume chart | Readout + two panels + table | **Adjust** | T3: axis text 9px → 11px. Everything else is right; the fixed readout above the chart is the correct pattern for a thumb |
| 3.7 | Question card | Tinted box, kicker, serif question, "Investigate ›" inline | **Keep** | |
| 3.8 | From the filing (people) | Composed sentence, orgs, schools, overlap sentence in tint | **Keep** | |
| 3.9 | Who can explain this | Name (accent) + relation + Best placed + Last spoke | **Adjust** | C3. And the "Insider" tag inside the sentence plus the Insider key line below is two mentions; keep the tag, keep the key once per page (already) |
| 3.10 | Exact figures | Fold on phones | **Keep** | |
| 3.11 | About this item | Sources, why here, order arithmetic | **Keep** | |

### 4. Investigate

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 4.1 | Kicker + company | "INVESTIGATE" + chip + "Results" tag | **Keep** | |
| 4.2 | Editable question | Serif 24, "Edit" accent inline, caption under | **Keep** | The caption "Written by FINN from the figures below, by fixed rules. A question, not a finding." is the one place that sentence belongs |
| 4.3 | Section jump chips | Four outlined pills | **Adjust** | They look like filters (the pill is the filter control). Use the SectionNav bar the company page uses (segmented, sticky): one component for "jump within this page" |
| 4.4 | 1 What changed | Chart + "Still unclear:" | **Keep** | The numbered section heading ("1 WHAT CHANGED") is good; keep the numerals ink-3 |
| 4.5 | 2 What to check next | Promise rows with italic quotes, page links | **Adjust** | Two near-identical quotes shown back to back under "PBT margin (FY27)" (the first truncated, the second full) is a data artefact the UI should hide: show one quote per promise, the fuller one |
| 4.6 | 3 Who could help | Lens pills, path, questions, draft | **Keep** | The vertical path (○ You / ● Farah / ■ KALYANKJIL) is the right drawing. Lens explanation paragraph ("Matched for money: costs, margins…") is four lines; cut to one: "Matched on money: costs, margins, funding." |
| 4.7 | 4 Keep following | Seg + text field + ink button + caption | **Keep** | |
| 4.8 | About | | **Keep** | |

### 5. Company page

The page with the most to decide. Measured: Titan 4,450px tall with the folds open; BEL 3,775px. Order today: header → What they do → Worth your attention → Results → Promises → **Ask** → People → Filings.

**Recommended order:** header → section bar → What they do (+ trajectory) → **Worth your attention** → **Ask the documents** → Results → Promises → People → Filings.

Why: Worth your attention is three questions FINN wrote; Ask is the one the investor writes. Together they form one zone, "questions", directly under what the company is. Today Ask sits five screens down, after a ledger that can be 27 rows, which hides the brief's copilot behind the brief's menu. The section bar keeps *Ask* reachable either way, but the first-visit eye should meet it in the first two screens.

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 5.1 | Ticker + tags | Kicker + two tags | **Keep** | |
| 5.2 | Name | Serif 30 | **Keep** | |
| 5.3 | Price | Value + % (direction colour), "Close on Fri 13 Nov" | **Keep** | |
| 5.4 | Sparkline + filing marks | 150×44 + caption | **Keep** | |
| 5.5 | Fact tags | Three tags when no description | **Keep** | |
| 5.6 | Section bar | Six segments, sticky | **Adjust** | C-b: five segments (drop Overview). Sticky with `bg-paper/95` is right |
| 5.7 | What they do | Two sentences, AR p.N links, fold with segment bars | **Keep** | |
| 5.8 | Trajectory | Two bar groups, latest value, multiple sentence, page link | **Keep** | Place: inside What they do, before the fold, is right: it is the company at a glance. The dashed gap for a failed year is the honest mark; keep |
| 5.9 | Questions you follow | | **Keep** | |
| 5.10 | Worth your attention | Three QuestionRows with tags | **Keep** | |
| 5.13 | Ask the documents | Section after Promises; input + mic + blue Ask; three chips; answer list | **Move + Adjust** | Move to directly after 5.10 (see above). K1: Ask button ink. Chips are `.pill` (filter style) but they *fill the box*: use `.chip`-like outlined accent so they read as "tap to ask". The answer's left border: accent for an answer, `rule` for near-misses: keep (it is the one coloured border in the app and it means "this answers you") |
| 5.11 | Latest results | Chart, question card, exact figures fold | **Keep** | 3.5 applies |
| 5.12 | Promised vs delivered | Counts line; views seg with counts; rows; replay; provenance fold; reference seg | **Adjust** | (a) C-a: segment labels without counts: "Attention · All · History" with the count in the section heading ("27 promises"). (b) K3/L5: in *All* and *Needs attention*, a row shows icon + word for the latest status only; the four-call strip lives in History. (c) The counts line ("● 4 delivered ◐ 1 partly ↻ 4 revised…") is right and is the summary; keep. (d) Row title serif? No: titles are facts, keep sans. (e) "Show all 15" link: keep |
| 5.12a | Not covered yet | Tinted box, Build this ledger | **Keep** | |
| 5.14 | People who'd know | Rows with lens tags, Insider key | **Keep** | |
| 5.15 | Filings | Rows + moves line | **Keep** | |
| 5.16 | Not an NSE equity | | **Keep** | |
| 5.17 | About | | **Keep** | |

### 6. Research

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 6.1 | Title | "What FINN has read" + count line | **Keep** | |
| 6.2 | Search | Field above segs | **Keep** | |
| 6.3 | Which companies | Portfolio 22 / Nifty 50 46 / All read 53 | **Adjust** | C-a: three labels with counts fit at 390 but not at 360. Counts in the subtitle ("53 companies…") already; drop them from the segments |
| 6.4 | Sort | Most changed / Newest call / Name | **Keep** | |
| 6.5 | Company rows | Line 1: ticker (accent) + sector tag + weight tag; line 2: name; right: call date + status counts; line 3–4: question, › | **Adjust** | Three lines of chrome before the content. New row: line 1 **ticker** (ink 500) + name (ink-2) on one line, right: "Oct 2026 call"; line 2: status counts (icons) left, tags right (sector, weight); line 3: the question, two lines, ›. The whole row is the link, so the ticker needn't be accent (the › says it opens) |
| 6.6 | About | | **Keep** | |

### 7. People

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 7.1 | Kicker + Private tag | | **Keep** | |
| 7.2 | Count line | | **Keep** | |
| 7.3 | Reconnect | Up to 5 rows before the group control | **Adjust** | Five rows push the page's own controls 600px down. Show 3, "2 more ›" fold. Heading caption "quiet 6+ months, their company filed this week" wraps to two lines beside the heading: put it under the heading as a caption line |
| 7.4 | Group by | Three-segment | **Keep** | |
| 7.5 | Filters | Insiders 12 / Can introduce 2 pills | **Keep** | Pills with counts are the pill's job; right |
| 7.6 | Insider key | | **Keep** | |
| 7.7 | People rows | Avatar, name, tag, note, tie line | **Keep** | |
| 7.8 | Where you lack context | Chips | **Keep** | |
| 7.9 | About | | **Keep** | |

### 8. Person

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 8.1–8.4 | Header block | Name serif 30; role; "How you know them"; "Strong tie, last spoke"; "Also linked to TITAN: Farah, Tanvi" | **Keep** | The best header in the app: four lines, each a different fact |
| 8.5 | How you reach them | Vertical path | **Keep** | |
| 8.6 | Company bridge | | **Keep** | |
| 8.7 | Why talk to them now | Rows with ticker kicker + headline + ›; "See 1 more"; Draft a note | **Keep** | This row form (kicker ticker above/left, headline, ›) is the model for Agenda rows (C-c) |
| 8.8 | Connects you to | Chip + role | **Keep** | |
| 8.9 | Career | Bars on one axis | **Adjust** | The axis labels "2014 … 2027" sit under the last bar only; put the axis once under all bars (it is one axis). Bars are ink-3 at 60%: use `--mark` (K4) |
| 8.10 | About: tie strength | Four parts with weights | **Keep** | |

### 9. Questions you follow

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 9.1–9.4 | Trails, marks, status, empty state | | **Keep** | The empty state's sentence tells the investor exactly where the feature starts; right |

### 10. What counts (settings)

Measured: 5,282px tall. Order today: Price & volume → Alert me when filed → Notify → Announcement types → Edition length → Display.

**Recommended order:** Price and volume → **Notifications** (Notify this device first, then the three filed kinds under it, indented) → Announcement types → Edition length → Display.

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 10.1–10.2 | Sliders | Native range, accent | **Keep** | |
| 10.3 | Live preview | Tinted box: counts, three sessions, scatter | **Adjust** | T3: scatter labels 9px → 11px. The scatter's dots are accent (hits) and outlined ink-3 (misses): right |
| 10.4 | Alert me when filed | Three native checkboxes | **Merge** | Into the Notifications section, as switches (S4) |
| 10.5 | Notify this device | Tinted block with a custom switch | **Move** | First in the Notifications section; the filed kinds sit under it. Its two caption sentences stay |
| 10.6 | Announcement types | Twelve native checkboxes with hints, All on / All off | **Adjust** | S4: switches. Keep the hint under each |
| 10.7 | Lead items slider | | **Keep** | |
| 10.8 | Theme | Three-segment | **Keep** | |
| 10.9 | Colour-blind | Checkbox with a live "+2.1% −1.4%" sample | **Adjust** | S4: switch. The live sample is a good touch; keep |
| 10.10 | Save / Reset | Ink button + text link | **Keep** | |

**S4, one control for on/off:** every yes/no in Settings becomes the same 52×32 switch the Notify block already uses (track `ink-3/40` off, `accent` on, paper knob). Native checkboxes go. One control per job (12 Nov rule), and the accent fill on a switch is the "selected control" the colour rule allows.

### 11. Notifications

| # | Feature | Now | Verdict | Change |
|---|---|---|---|---|
| 11.1–11.4 | The four notifications | Title + body by rule | **Adjust** | C1 applies to the body ("Change in Directors/KMP…" must not be the first FINN notification anyone reads). Titles: "KALYANKJIL: Results filed" is right; the close digest "3 alerts at the 12 Nov close" is right |

### 12. Loading, errors, sharing

| # | Feature | Verdict |
|---|---|---|
| 12.1–12.5 | Skeletons, error page, not-found, link previews, titles | **Keep** |

---

## Part C. The ledger list row (L5), drawn

The one component that needs a drawing, because the current *All* view repeats a four-ring strip on every row and the strip carries almost nothing (most rings are "open, not mentioned").

```
Now (All view)                               Proposed (Attention and All views)
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ Watch margins: 16–17%  ›   ○ ○ ○ ○   │     │ Watch margins: 16–17%            ○ Open │
│ Not revisited since it was stated    │     │ Not revisited since it was stated     › │
├──────────────────────────────────────┤     ├──────────────────────────────────────┤
│ QRSAM order date  ›    ○ ↻ ↻ ↻       │     │ QRSAM order date (~₹30,000 cr) ↻ Revised│
│ by Q4FY26 → June-end → "very soon"   │     │ by Q4FY26 → June-end → "very soon"    › │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
                                             History view: the four-ring strip, as now.
```

Status word colour = status colour (already in tokens). Title sans 15/500 ink; change line caption ink-2; the › at the row's end on the second line (as the Reconnect row does), not after the title.

---

## Part D. Order of work, with what to measure

| Step | Items | Measure after |
|---|---|---|
| 1 | C1 (humanised subjects, worker) + C2 (XBRL tag) | Count headlines over 3 lines on the 7d edition: today 1, target 0. Filed-alert rows that truncate: today 1 of 1, target 0 of 1 |
| 2 | Company page order (Ask after Worth your attention), section bar to five | Pixels from the top to the Ask field on Titan with the folds open: today about 2,900, target under 1,500 |
| 3 | Ledger rows (L5), seg labels without counts (C-a) | Height of BEL's *All* view, measured before and after: target a third shorter for the same 27 rows. No clipped segment label at 360px |
| 4 | Settings: Notifications section, switches everywhere (S4) | One on/off control type on the page (today three: checkbox, switch, native) |
| 5 | Research rows, People reconnect cap, Agenda rows (C-c), Coverage headers | Research page height: today 5,388px; target under 4,500 for the same 22 rows |
| 6 | Small type and colour: T3 (11px chart text), T4, K1 (Ask button), K4 (`--mark`), summary-sentence links, alert count style, door-tile counts, End of edition | Visual check in light and dark; no text under 11px anywhere (grep for `fontSize="9"`, `text-[1`) |
| 7 | Dark tint test (A2) | Side-by-side of the alerts box and question card at #26241f vs #2a2822 in a dark room; keep whichever reads as a surface without reading as a card |

Each step is independently shippable. Steps 1–3 are the ones a reviewer would notice; 4–7 are polish.

## Part E. Considered and not recommended

- **A bottom tab bar.** Still no: one front door, and the three tiles already are the map.
- **Cards with shadows, coloured left borders, or kind icons.** Still no; the hairline list is the edition's form. The one coloured border that stays is the Ask answer's accent rule, because it carries meaning ("this answers you").
- **Changing either typeface.** Nothing measured on 12 Nov has changed; both faces are doing their job in every screenshot.
- **Moving Ask into the dock as the only entry.** The dock row is the shortcut; the section is where the answer lives. Both stay.
- **Collapsing the ledger into the Research page.** A company's promises belong on its page; Research is the index.
- **Reducing dark mode to "follow phone" only.** The explicit choice costs nothing and some readers want it.
