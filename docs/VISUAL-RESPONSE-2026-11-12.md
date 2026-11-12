# Response to the visual plan (12 Nov 2026)

Input: `FINN-VISUAL-PLAN-AND-IMPLEMENTATION-CHECK.md`. Every item, with what shipped or why not. All of the "Built" items are live and were checked on the live site at phone width in one browser session.

## Data feasibility (asked for first)

| Needed | Exists? |
|---|---|
| Daily close and volume history | Yes. The worker already loads 42 sessions of exchange files for the volume baseline; now exported as 30 sessions per holding, with the alert's own baseline |
| Prior-quarter and prior-year results | Yes, for all 39 results |
| Per-call statements with quotes | Yes, after the earlier change (D-055) |
| Normalised target period per call | Partly. Readable from cell notes (month, quarter, half, FY); not normalised for basis or scope |
| Announced event dates | Yes. Investor-meet and call dates are structured facts in exchange XBRL filings |
| Segment revenue shares | Yes, for 10 companies' annual reports |
| Cash-flow statements, debt maturities, geographies | No. Would need a new extraction pipeline |

## Section by section

| Plan item | Status | Notes |
|---|---|---|
| §3.1 Contact vs fit | Built | Move investigations name the insiders they exclude, and say why. "No contact matched to this question" is distinct from "no one". |
| §3.2 Question fits evidence | Built | Capex amounts get spending questions (amount vs date topics). Leadership changes list open promises only, and say none were stated by that person. Matching passages come first; others are labelled "context, not about this directly". The move question asks for disclosures. |
| §3.3 Same basis | Built | PBT vs PBT before the item. PAT is never adjusted. Headlines say PBT/PAT. No waterfall. |
| §3.4 Shorter path | Built | Section navigator, folded draft note, folded long quotes. No extra fixed bar. |
| §5 Price and volume | Built | Two panels; tap, drag or arrow keys; filing markers (hollow after close); table; back to alert. Baseline is the alert's own. Breaks are labelled (the Sun Pharma Muhurat session). |
| §6 Coverage | Built | Matrix with four labelled cells per company, each linking to its evidence; weight bars; sort; gaps filter; research names unweighted. "Last update" is shown as the ledger's latest call. |
| §7 Replay | Built, numeric chart declined | One tap target per call; three lanes; calendar lane for dates; highlighting limited to target figures. Numeric bullet chart declined (D-063). |
| §8 Results | Built | Growth/Margins, YoY/QoQ never mixed, tap for filed figures, one question link. 2dp margins, bp from unrounded figures. |
| §9 Bridge | Built | "Has seen both", with roles, years and two questions. Two-person overlap view not built: optional, and the relationship lines already distinguish "dates overlap". |
| §9 Business mix | Built (bars) | Bars from disclosed shares only; gaps stated. Geographic map declined: no location data. |
| §10 Question trail | Built | Resolution test, marks, Answered/Still open, compact edition line; persistence fixed and verified after reload. "Compare with when I asked" is partial: shows the origin event and date, not stored excerpts. |
| §11 Calendar | Built (agenda) | Company-announced dates and the visitor's revisit dates, labelled apart. Results dates aren't guessed. Promise deadlines aren't added to the agenda. |
| §11 Threshold scatter | Built | Recorded sessions only (≥1% or ≥1.2×), and the chart says so. |
| §11 Cash, working capital, debt, bank panel, valuation | Declined (D-065) | New data and validation needed. |
| §12 Desktop pane | Built (evidence pane) | Check-next evidence beside the question at ≥1100px. Selecting a chart point doesn't yet load its quote into the pane. |
| §12 Mobile | Checked | 320px and 390px with no horizontal scroll; focused fields stay clear of the dock; dark mode unchanged. |
| Chaptered audio | Not built | Needs real-phone testing first. |
| Promise links | Fixed (found during the work) | Ids are positional, so links carry the title; a rebuilt ledger can't reopen a different promise. |
