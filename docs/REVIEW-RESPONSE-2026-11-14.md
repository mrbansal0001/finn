# Response to the 14 Nov reviews

Covers `FINN-FULL-SUBMISSION-REVIEW-2026-11-14.md` (F01–F18), `FINN-UX-REVIEW-2026-11-13.md` and `FINN-UI-BUILD-BRIEF-2026-11-13.md`. Each finding was reproduced (or checked against the current UI) before anything changed. **Fixed** means changed, tested and visible on the live site; **verified** means the claim was checked and the behaviour is already correct; **deferred** means a known limitation with the reason.

## Full submission review

| # | Finding | Reproduced? | Outcome |
|---|---|---|---|
| F01 | Ask labels an analyst "for the company" | Yes: Umesh Raut (Nomura) as management on 4 BEL passages; `head\b` matched "go ahead" | **Fixed.** Moderator lines never establish management; introductions outrank title words; honorifics stripped. 68 passages across 54 companies moved from management to analyst; Umesh Raut analyst on all 11. Regression test |
| F02 | Keyword match presented as an answer (FY30) | Yes | **Fixed.** Numbers and periods in a question are required; "FY30" is named as missing; framing says "match", never "answer"; a miss says only indexed sections were searched; replies stay in the same document |
| F03 | Filing events not checked against the page | Yes, in code | **Fixed.** Quote (piece by piece), named people and amounts checked against the pages read. Stored events: 141 of 156 verified, 7 from scanned pages labelled "quote not checked", 8 withheld and shown under their plain subject |
| F04 | Settlement column and mixed target dimensions | Yes: BEL P3 settled in Nov for a May statement; P62 lost its amount | **Fixed.** Settlement written at the evidence call and carried forward; a target shows amount and deadline together. **Deferred:** conditions ("if orders arrive") are not yet a separate field |
| F05 | Research not refreshed when a new transcript is filed | Yes: Titan read through Aug while its Nov transcript was filed 11 Nov | **Fixed.** The export flags a newer call; the app says so on the company page and in Research; the worker rebuilds one stale ledger a cycle. Titan, Hindalco, LG Electronics, Bharti Airtel and Tata Steel now read their Nov calls; 7 others show "newer call filed" until the transcript list links it |
| F06 | Uncovered ticker shows "0 filings" | Yes (AARTIDRUGS, and every covered non-holding) | **Fixed.** "Filings not followed", with a link to the company's NSE page |
| F07 | Catch-all change category treated as a leadership event | Yes | **Fixed at the cause.** XBRL-only change filings are now parsed: HDFC Bank's was V S Rangan's re-appointment, now folded as routine. The category no longer drives an "audit expert" match |
| F08 | Push endpoint is an outbound-request risk | Yes, in code | **Fixed.** Browser push services only (server action, worker at send time, and a database constraint in migration 006); 10 s send timeout; visitors can update only their rules (006). Tests |
| F09 | A failed push is skipped forever | Yes | **Fixed.** Cursor moves only past delivered filings; failures retry; 410 removes the endpoint; new subscribers get what arrived after subscribing; bursts say how many more. Tests |
| F10 | One bad subscriber stops the batch; empty kinds = all; reset not synced | Yes | **Fixed.** Per-subscriber isolation, typed rules (empty = none), Reset updates the phone's rules too. Tests |
| F11 | Temporary read failures never retried | Yes, in code | **Fixed.** The twin check excludes the filing's own failed attempt and requires a successful read of a same-subject filing |
| F12 | Substring number match; USD treated as rupees | Yes | **Fixed.** Whole-number tokens; non-rupee units rejected. All 24 trajectories rebuilt with identical values. Tests |
| F13 | Publication not atomic | Code-level | **Fixed for passages** (one-transaction replace, migration 006, applied and in use; source list no longer cached). **Deferred:** snapshot and ledgers are still published in sequence |
| F14 | Coverage jobs can stick; empty builds "ready" | Code-level | **Fixed.** Interrupted builds reclaimed after 2 h (3 attempts); a build with no readable transcript is "unavailable". **Deferred:** separating fast ingestion from slow enrichment |
| F15 | "Hard-capped" spend overclaims | Yes | **Fixed in docs:** a budget guard on logged estimates, not a billing cap |
| F16 | Deployment guide lists 2 of 5 migrations | Yes | **Fixed.** All six migrations, every setting, push, worker, no-paid-call checks; real READMEs |
| F17 | New features lack tests | Yes | **Partly fixed.** Tests for F01, F09, F10, F12 and the date/amount rule (150 total). **Deferred:** a browser test in CI; the live feature walk and link check are scripts (`evals/link_check.py`) |
| F18 | Email overstates; long | Yes: 38 of 41 results tables are checked by arithmetic identities only, 3 also matched to XBRL | **Fixed.** The email is ~500 words with a dated metrics block and exact qualifiers |

## UX review and build brief

| Finding | Outcome |
|---|---|
| P0-1 Unparsed category as the top story | **Fixed** (F07) |
| P0-2 Date becomes amount (ADANIENT) | **Fixed.** A deadline-only and an amount-only statement are never one promise; ADANIENT's tariff order now ends as "period ended", not revised into ₹6,000–6,800 cr. Regression test |
| P0-3 Stale research beside a new transcript | **Fixed** (F05); "Nothing changed" now reads "No change in the calls read" |
| P0-4 Evening filings "during market hours" | **Fixed.** Cause: 10 Nov was an NSE holiday, so its filings sat on the 11 Nov session. Timing now comes from each filing's own timestamp (before the open, after the close, market closed) |
| P1-2 320 px overflow | **Verified** none on 10 routes at 320 px (the plain headline removed the long subject) |
| P1-3 Blank result for combined People filters | **Fixed.** Explained, with Clear filters / Show everyone who can introduce |
| P1-4 12,867 px theme directory | **Fixed.** Themes are a selectable index |
| P1-5, P1-6 Ambiguous counts and icon-only statuses | **Fixed.** "54 companies", "My companies", "All covered", worded status counts |
| P1-8 Former role read as current | **Fixed.** Expertise lines use the current role, "formerly" otherwise |
| P1-9 Target period vs exact date | **Fixed.** "Target period FY27; no exact date stated" |
| P1-10 Portfolio sheet and Escape | **Verified.** Escape closes it and focus returns to the Portfolio button |
| P1-11 Unknown search dead end | **Fixed.** The page keeps the search box and links to the covered companies |
| P1-1 Back loses place | **Deferred.** In-app Back already returns via history with scroll restored; labelled destinations ("Back to Research") are not built |
| P1-7 Repeated question templates | **Deferred** |
| P2 polish items, creative extensions (Since my last review, preparation sheet) | **Deferred:** correctness first, as both documents advise |

## How it was checked

Worker tests (150), typecheck and lint, production build; the live feature walk (22 steps, every failure checked by hand: all were test timing or data assumptions); the live link check (936 pages, 1,902 promise links, 0 problems); 25/25 live privacy checks; migration 006 tested in PGlite before publication.

Migration 006 was applied on 14 Nov: the live privacy check's two new cases pass (a non-push endpoint is rejected with a constraint error; visitors cannot edit delivery cursors), and passages now upload one company per transaction.
