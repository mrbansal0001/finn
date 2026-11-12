# Response to the independent audit of 12 November

The audit is `docs/FINN-INDEPENDENT-AUDIT-2026-11-12.md`, with a technical appendix. Every finding marked "confirmed" was reproduced in the code before anything changed. Measurements are in E31 (`docs/research/00-hands-on-experiments.md`), and the decisions are D-047 to D-053.

## Findings

| # | Finding | Outcome | What changed, and what was measured |
|---|---|---|---|
| F01 | Visible alerts open a missing card | **Fixed** | Every price/volume session is a card with a durable id, and the card page looks up any window or the move registry. 145 live card links checked: 0 broken. The SBI alert opens. |
| F02 | Exact quotes turned into wrong verdicts | **Fixed** | An outcome settles a promise only when it is comparable: the active target's period, a management speaker read from the transcript's own speaker lines, the number printed in the quote, comparable units (rupees never compared with dollars; crore and million converted), the programme or segment named, and a later call. Unknown fields abstain. Settled rows went from 53 to 2. BEL NGC is now "revised" instead of "missed". All synthetic counterexamples are now tests. |
| F03 | Outcome evidence hidden | **Fixed** | The settled cell carries the quote, page, URL, call, speaker and period. The expanded row shows the outcome beside the promise and says how they were compared. Every source is reachable. The results table links its PDF page, and the bhavcopy file is linked. |
| F04 | Unreadable material filing becomes housekeeping | **Fixed** | It stays at its tier with its link ("couldn't read the document; open it below"). Timeouts, 5xx errors and malformed model output are retried up to 3 times on the same item; explicit refusals are not. |
| F05 | Alert rules applied after data was lost | **Fixed** | Moves are exported down to the settings' minimum (1%, 1.2×). The visitor's rules apply to every session before grouping. Every match is listed ("View all N"). Grouped category toggles cover every category they name. The score follows re-tiering. |
| F06 | Calendar built only from sessions that moved | **Fixed, with one correction** | The full exchange calendar is used, short volume baselines are stated as such, and a late file is no longer recorded as a holiday. The audit's live example (Cochin) was in fact correct: 10 Nov 2026 was an NSE holiday (bhavcopy still 404 two days later), so 11 Nov was the next session. |
| F07 | Validation label claims checks that never ran | **Fixed** | Each table stores the identities that ran, and the badge lists exactly those. Two identities, or two lines equal to the exchange XBRL, are needed to show a table. The export's XBRL re-check needs fields actually compared. Tracking refuses a basis mismatch, and its wording is "latest quarter". |
| F08 | Mixed-event results filings; CIM people filings unused | **Deferred** | Reading every event in a results filing means a second paid call per results filing, and wiring CIM people filings changes ingestion three days before the deadline. Listed as next steps. |
| F09 | One timestamp for several kinds of freshness | **Partly** | The page states filings time and price session separately. Per-provider success state and source-fingerprint refresh are deferred. |
| F10 | Fragile on-demand job lifecycle | **Deferred** | A Postgres job queue with leases is the right design, and it is a multi-day change. Today the request statuses and the worker queue stay as they were. |
| F11 | Network wording and paths overstate evidence | **Fixed** | The bogus "shared background" points are removed. Introductions weigh both links and carry the edge's context. "Unavailable" is distinguished from "no overlap". "Who knows TCS" searches the network, and a sentence is never opened as a ticker. People links carry the originating card, so the draft is about that card. Machine ledgers get their own verifiers. |
| F12 | Publication and operations contracts | **Partly** | The live write probe is now a no-op write (14/14 pass). SQLite has WAL mode and a busy timeout. Schema validation, atomic generation switching and atomic quotas are deferred. Foreign-key enforcement was not switched on over existing data. |

## Interface recommendations

- **Done:**
  - "No lead story" replaces "Nothing material" when there are updates or rule matches.
  - Ranking arithmetic sits behind "How the order is computed", and plain reasons come first.
  - The EBITDA formula is folded away.
  - The ledger defaults to "Needs attention", and the hand-checked reference is under Methodology.
  - Status labels are readable, and the fake tab roles are now toggle buttons.
  - The search placeholder reads "Company, person or theme", and search has loading, empty and failure states, plus Escape.
  - Clipboard failure is reported, and the voice button reads "Listen to brief" and includes rule matches.
- **Not done:**
  - company-page reordering around "what needs checking";
  - a compact results summary on feed cards;
  - a routine-filing browser;
  - the desktop evidence pane.

  These are worthwhile; they come after correctness and a real-phone test.

## Where I disagree

- **Cochin (F06).** The example is not an error, as explained above. The general point stands and is fixed.
- **Rebuilding as a typed evidence store before submission.** I agree with the design, and the contract in appendix §8 is the next step. Building it in three days would put correctness at risk more than it protects it. The narrower fix (abstain unless comparable) gives the same guarantee for what is shown today.
- **Moving the RLS probes to staging.** The probes now cannot change live data even if a policy regresses. A separate staging project is worth having once there is more than one developer.

## What this changed in the story

Quote fidelity (1,575/1,575 verbatim) was never evidence that the analysis was right. The writeup now reports the two separately. The ledger's signal is in revisions, silences and the filed-quarter comparison; "delivered" and "missed" appear only when a comparable outcome exists, which in transcripts is rare.
