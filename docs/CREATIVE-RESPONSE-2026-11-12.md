# Response to the creative product review (12 Nov 2026)

Inputs: `FINN-CREATIVE-AGENT-PROMPT.md` and `FINN-CREATIVE-PRODUCT-REVIEW.md` in the challenge folder. The prompt was written for a planning-only agent (no repo, no code); the review is that plan. It was implemented against the codebase, keeping the review's own cut lines.

## Built (live on finn-red.vercel.app)

| Review item | What shipped | Where |
|---|---|---|
| Signature: Investigate | `/investigate`: question (editable) → 1 What changed → 2 What remains unclear → 3 Check next (company's own words) → 4 Who could help → 5 Keep following | "Investigate ›" on lead cards; "The question it raises" on card pages; each expanded promise; company page |
| 2. Four-call replay | One stop per call with the target as stated then; tap a stop for that call's quote and page; first vs latest wording with changed figures, dates and periods highlighted. Replaces the per-call list in an expanded promise; History matrix kept | Promises; Investigate |
| 3. Relationship path | You → introducer → person → company, each link labelled with its evidence | Investigate; person page |
| 4. People per question | Execution / Demand / Money / Rules, matched on recorded roles; empty lenses say "no one", never a weaker match; questions and note follow the lens | Investigate |
| 5. Keep following (stretch) | Saved on this device; edition shows whether what it waits for (next results, next call, any filing, a date) has arrived. Checked on open, no notifications, and the page says so | Edition top; company page |
| 6. Where do I lack context | Portfolio sheet filter: no ledger yet, or no one in the network; "a gap in what you know, not a risk" | Holdings sheet |
| 7. Results as a question | Rule-written questions (exceptional items, operating vs pre-tax gap, margin against revenue); EBITDA margin dot plot, zero-based | Card page; Investigate |
| 9. Attention preview | Live count of alerts the rules would have produced in the latest 24 hours and 7 days, delta vs saved, three examples; "past sessions, not a forecast" | What counts |
| Company hierarchy | "Questions worth your attention" (latest results, a revised promise, one that went quiet) | Company page |
| Smaller items | "Who knows X" gets a direct answer; attention list opens on five; research wording instead of builder wording; career as bars | Dock; promises; person |

## Where this disagrees with, or goes past, the review

- **Questions are rule-written, not model-written.** Every question is built from figures already on screen. This keeps "a question, not a finding" true and costs nothing per view.
- **The replay found a real linking error.** It put Dixon's Noida "mass production by Q2" next to the Chennai desktop line "in Q3" as one slipped date. The linker was fixed (D-056); Cochin Shipyard's ISRF start date had also been chained to a revenue target.
- **Per-call quotes needed a data change**, not just a view. The ledger had kept only the first and latest quotes, so ledgers were rebuilt from cache at no model cost, with statuses identical.
- **The review's CAMS "queued" finding** has since resolved: CAMS has a 67-promise ledger.

## Declined (D-059)

- **Listen, then branch:** needs real-phone audio testing that hasn't happened.
- **Desktop two-pane view:** the review itself ranks it below mobile correctness.
- **Cross-company "seen both" view:** the path and career bars cover most of it.
- **Full-portfolio time travel:** the review's own cut line.

## Known limits

- **Lens matching is by recorded function.** A contact with an unusual title can be missed. The lens says "matched on each person's recorded role".
- **Followed questions don't travel between devices.** They stay in one browser.
- **"Any new filing" only sees ranked items.** It watches cards, not folded routine filings.
- **Hand-checked reference ledgers have no per-call quotes.** For BEL and Deepak Nitrite on the reference view, the replay shows notes, with quotes on the first and latest calls only.
