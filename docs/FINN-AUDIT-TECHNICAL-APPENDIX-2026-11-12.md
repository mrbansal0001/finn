# Finn audit: technical coverage, edge cases and implementation contracts

Companion to [the main audit and prioritized plan](FINN-INDEPENDENT-AUDIT-2026-11-12.md). Baseline: `27ef311`, reviewed 12 November 2026. These are review notes and proposed changes, not implementation changes.

## 1. How to read the coverage record

“Inspected” means the first-party source was read and its responsibility traced. It does not mean every runtime branch was executed or every generated financial fact independently verified. Findings marked **confirmed** have a browser observation or offline counterexample. **Risk** denotes a code path or architectural weakness requiring a targeted test before claiming a specific production incident. **Improve** is a product/maintainability recommendation.

The first-party production worker and web source, SQL migrations, test files, evaluation drivers and operational scripts were inspected. Generated files, installed dependencies, lockfile contents and historical research artifacts are not presented as line-by-line audited application code. Hand-labelled reference material was used as an evaluation fixture, not assumed infallible.

The main report contains the severity and sequencing. This appendix explains where the work belongs and captures smaller issues that should not distract from P0 work.

## 2. Worker module coverage

| File | Existing responsibility / good decision | Findings and proposed contract |
|---|---|---|
| [`fetch.py`](../worker/src/finn_worker/fetch.py) | Explicit user agent, host spacing, disk cache, refusal handling | **Risk:** URL-only immutable cache assumes filings never change; redirects/content types and body sizes are unbounded; host spacing is per process; cache writes are not atomic. Preserve respectful refusal handling. Add content metadata/hash and bounded downloads; distinguish immutable document versions from mutable URLs. |
| [`feeds.py`](../worker/src/finn_worker/feeds.py) | RSS parsing and exchange feed adaptation | Retain parser fixtures. **Risk:** a small rolling feed is not a completeness guarantee. Record cursor/coverage, malformed-item counts and symbol-resolution failures. Reconcile feed/backfill documents by canonical attachment identity. |
| [`classify.py`](../worker/src/finn_worker/classify.py) | Low-cost deterministic filing categorization and materiality | Strong held-out material classification result. **Improve:** expose reason codes; keep “needs reading” independent of materiality; avoid treating category-only tier as legal/materiality certification. Test document-dependent exceptions and downstream survival, not just classifier labels. |
| [`ingest.py`](../worker/src/finn_worker/ingest.py) | Live RSS, portfolio backfill, financial XBRL ingestion | **Risk:** partial backfill/refusal returns a normal count, allowing daily-success state to advance. Per-file failures are swallowed without durable retry records. RSS/backfill IDs arise from different inputs. Scheduled backfill covers holdings, while the manual command also includes the research set. Return structured per-provider/per-symbol outcomes. Wire structured management-change ingestion. |
| [`xbrl.py`](../worker/src/finn_worker/xbrl.py) | Exact structured financial facts and CIM people changes | Useful reduction of model dependence. **Risk:** results context falls back from `OneD` to first fact context rather than resolving context periods; explicit units/decimals/context dimensions need stronger validation. `parse_cim` is not wired into the production ingest path. Preserve context identity and verify selected quarter/basis. |
| [`docs.py`](../worker/src/finn_worker/docs.py) | Per-page PDF text, text-quality heuristics, P&L page ranking and image fallback | Useful text/vision routing. **Risk:** P&L candidate heuristics may select wrong basis/page; a plausible arithmetic result alone cannot establish page identity. Record candidate scores, chosen statement and source coordinates. A scanned transcript has a different OCR problem from a scanned P&L. |
| [`reader.py`](../worker/src/finn_worker/reader.py) | Document extraction, event creation and financial reader | **Confirmed:** unreadable material event can become routine permanently. **Risk:** results branch skips secondary management/legal events; PDF suffix matching is not actual format dispatch. Introduce retryable extraction states and multiple independently cited events per document. |
| [`results.py`](../worker/src/finn_worker/results.py) | Structured table extraction, row mapping, arithmetic, comparatives, source selection | Substantial defensive code and regression work. **Confirmed:** sparse data can receive an overbroad validation success. **Risk:** conditional identities, heuristic PAT ownership/tax selection, inferred column layouts and permissive exceptional/JV arithmetic can accept ambiguous mappings. Return field-level validation, source cells and required comparability dimensions. |
| [`prices.py`](../worker/src/finn_worker/prices.py) | EOD bhavcopy and historical volume comparison | Correct low-latency-cost choice for this brief. **Confirmed:** export floor exceeds settings minimum. **Risk:** fewer-than-20 observations still described as 20-session baseline; past 404 permanently treated as closed; weekend special sessions excluded; duplicate series need deliberate selection. Preserve actual session coverage and unfiltered candidates. |
| [`cards.py`](../worker/src/finn_worker/cards.py) | Ranked finite edition, related filing/price context, grouping | Good editorial product abstraction. **Confirmed:** per-window biggest move breaks detail IDs and loses volume events; alert-derived calendar corrupts session attribution; unreadable material event folded. **Risk:** company/category/day grouping merges distinct events. Use stable event registry, full session calendar and explicit grouping links. |
| [`annual.py`](../worker/src/finn_worker/annual.py) | Latest annual report discovery, MD&A selection and cited business snapshot | Efficient focused source selection. **Risk:** quote existence does not prove generated paraphrase or segment share is entailed; one section may omit useful business facts; seven-day discovery cache delays updates. Validate claim/quote agreement and display missing sections explicitly. Do not fill weak business summaries with model memory. |
| [`pull.py`](../worker/src/finn_worker/pull.py) | Transcript discovery, chunked extraction, quote verification, grounding, linking, statuses, coverage requests | Strong separation of extraction from deterministic judgment; exact-source quote repair is useful. **Confirmed:** actuals lack speaker/scope/basis and numeric grounding; monetary unit comparison conflates currencies/scales; target revisions can retain old periods; outcome evidence lacks URL; universal 1,000× grounding accepts inappropriate units. **Risk:** fuzzy dedupe/linking and document-month inference misidentify threads/periods; queued jobs lack leases. This is the main correctness investment. |
| [`tracking.py`](../worker/src/finn_worker/tracking.py) | Shows interim filed figures against open full-year targets | Good distinction between ongoing target and final settlement. **Confirmed:** standalone target can accept consolidated result. **Improve:** require explicit basis, distinguish margin/growth observations from full-year trajectory, handle seasonality and ensure machine-ledger output actually receives the tracking. |
| [`network.py`](../worker/src/finn_worker/network.py) | Deterministic employer/education overlap, expertise, relationship strength and second-degree paths | Keeps private profiles out of model prompts and gives explanations. **Confirmed code:** education presence earns shared-background points; second-degree ignores edge strength/context; overlap helper does not receive supplied as-of date from `for_person`. **Improve:** entity IDs, evidence-bound people links, both-edge path quality, sector specificity and unknown states. |
| [`export.py`](../worker/src/finn_worker/export.py) | Combines public read model, results, prices and private annotations | Compact UI payload is suitable. **Risk:** latest filing drives the time window; price failure can replace known-good data with empty state; broad JSON payload lacks schema/version contract. Verifier/tracking derivations can use reference ledgers while published payload substitutes machine ledgers. Build from one explicit generation and provenance. |
| [`sync.py`](../worker/src/finn_worker/sync.py) | Separates public and private data, uploads read models, exchanges requests | Public/private split is an important good decision. **Risk:** multi-step publication can expose inconsistent generations; upserts do not remove obsolete network templates; existing users' synthetic contacts can become stale relative to refreshed lines. Validate export privacy, stage complete generation, switch manifest atomically and reconcile deletions. |
| [`store.py`](../worker/src/finn_worker/store.py) | Small SQLite store with stable keys and basic migration | Appropriate local persistence at this scale. **Risk:** declared foreign keys are not explicitly enabled; WAL/busy-timeout and process locking are absent; migrations run during connection and are not versioned systematically. Add explicit migration state, backup/recovery procedure and single-writer contract. Do not move every table to cloud just for fashion. |
| [`llm.py`](../worker/src/finn_worker/llm.py) | Structured provider routing, cached responses, token/cost logging and fallback | Useful cost control and separation of tasks. **Risk:** schema supplied to provider is not full local runtime validation; cache provenance does not fully identify actual provider/model; model discovery/fallback can change behavior; prior-spend check does not reserve concurrent budget or cap worst-case output. Add schema validation, pinned evaluated model choices, provenance and reserved budgets. |
| [`run.py`](../worker/src/finn_worker/run.py) | Independent scheduled stages and logs | Independent stages preserve partial availability. **Risk:** `last_cycle` records an attempt, not successful data freshness; partial backfill considered done; request import precedes drain without immediate result-status exchange; failures exit normally. Separate heartbeat from stage success and alert on age of successful outputs. |
| [`universe.py`](../worker/src/finn_worker/universe.py) | Exchange equity universe for ticker lookup | Useful generalization beyond hardcoded examples. **Improve:** validate universe freshness, handle aliases/renames and explain unsupported BSE-only names. An NSE listing in the universe does not guarantee four readable transcripts. |
| [`__init__.py`](../worker/src/finn_worker/__init__.py), `py.typed` | Package boundary/type marker | No product-level concern found. A type marker does not replace validating model and database payloads. |

### Additional worker edge cases worth recording

- Deduplication should preserve distinct commitments embedded in the same sentence and avoid treating a repeated commitment within one call as a change over time.
- A fiscal year is not interchangeable with a call's calendar month. Resolve reporting periods from source documents and preserve uncertainty if they cannot be established.
- “Above” and “below” are observations, not universally good or bad: higher capex, working-capital days, costs and credit losses have different interpretations from higher revenue.
- Tolerances must reflect stated precision and target type. A floor, ceiling, approximate point and range need different comparison rules.
- A deadline extension is a revision even if both dates fall inside the same fiscal year.
- An outcome quoted in a later call must not appear in an earlier historical cell. Persist observation/availability time as well as reporting period.
- Source correction, extraction correction and target revision are three different events; do not silently replace one with another.
- Before scaling OCR, measure candidate-page recall and extraction precision separately. More model calls cannot repair a wrong source-page selection contract.

## 3. Web source coverage

| File(s) | Assessment and concrete next step |
|---|---|
| [`lib/data.ts`](../web/src/lib/data.ts) | Good split between cached public snapshot and per-request private network. **Risk:** ledger/universe HTTP failures lack the same explicit status checking as snapshot; private Supabase errors collapse to empty arrays; JSON casts do not validate shape. Return typed unavailable/partial/ready states. Keep shared cache free of owner-specific data. |
| [`lib/types.ts`](../web/src/lib/types.ts) | Useful central contracts, but `LedgerCell` drops outcome evidence and many facts are open records. Add discriminated unions for event types, evidence, validation and research state; align Python export schemas with TS runtime parsing. |
| [`lib/prefs.ts`](../web/src/lib/prefs.ts) | Clear compact settings. **Risk:** grouped UI category labels do not expand to all backend category keys; move tier changes do not recompute underlying score; tie comparator is not a complete stable ordering. Align allowed ranges with extraction; apply preferences before lossy selection; preserve immutability where convenient. |
| [`lib/format.ts`](../web/src/lib/format.ts) | Keep financial display policy centralized. Add explicit handling for missing values, loss-to-profit comparatives, basis and timezone rather than allowing formatting to imply precision. Formatting alone must not invent labels such as quarter or material. |
| [`lib/supabase/config.ts`](../web/src/lib/supabase/config.ts), [`server.ts`](../web/src/lib/supabase/server.ts) | Distinct server configuration/session helper is appropriate. Preserve public versus service credentials and intentional cookie/error semantics; validate environment configuration at startup without printing secrets. |
| [`proxy.ts`](../web/src/proxy.ts) | Anonymous sessions make a frictionless demo possible. Bot/headless behavior differs from normal users, so tests need a normal user agent. Verify signup limits and expired-session behavior. Avoid re-creating users unnecessarily. |
| [`app/page.tsx`](../web/src/app/page.tsx) | Strong finite-edition structure. **Confirmed:** alert count can exceed accessible list; “nothing material” conflicts with alerts/updates. Add complete alert path, accurate headline, shorter results summaries and recoverable routine filings. |
| [`app/c/[symbol]/page.tsx`](../web/src/app/c/%5Bsymbol%5D/page.tsx) | Helpful company workflow and fallback for unsupported symbols. Reorder business/ledger/results around the investor's question. Show actual source coverage, missing AR/results reasons and correct job states. Do not imply any found ticker has complete research. |
| [`app/c/[symbol]/actions.ts`](../web/src/app/c/%5Bsymbol%5D/actions.ts), [`RequestButton.tsx`](../web/src/app/c/%5Bsymbol%5D/RequestButton.tsx) | Request initiation is present. Connect to robust job status, duplicate detection, retry reason and refresh when ready. Successful request submission is different from successful research completion. |
| [`app/card/[id]/page.tsx`](../web/src/app/card/%5Bid%5D/page.tsx) | **Confirmed:** 30d-only lookup loses valid cards. Ranking constants duplicate worker logic and explanation ignores current preferences. `overlapLine` overstates absence of overlap. Replace with canonical lookup, backend reason codes and evidence-aware network wording. |
| [`app/people/[id]/page.tsx`](../web/src/app/people/%5Bid%5D/page.tsx) | Career/context useful, but scoring detail precedes action. Preserve source event in URL/context; make related items navigable; foreground why to ask this person and introduction path. |
| [`app/settings/page.tsx`](../web/src/app/settings/page.tsx), [`SettingsForm.tsx`](../web/src/app/settings/SettingsForm.tsx), [`actions.ts`](../web/src/app/settings/actions.ts) | Settings are accessible as a single simple form; primary rows/buttons have useful size. Explain in-app/EOD behavior, use consistent min/max validation, expand grouped categories correctly, show success and meaningful preview of rule effects. |
| [`app/api/search/route.ts`](../web/src/app/api/search/route.ts) | Lightweight deterministic company search is sufficient. Rank exact symbol/name before substring matches; bound payload and expose failure rather than treating it as no matches. |
| [`app/api/network/route.ts`](../web/src/app/api/network/route.ts) | Name/company/theme search is a good start. Literal word matching does not support arbitrary natural questions. Add explicit intents/synonyms and contextual relevance; never manufacture evidence for a weak match. |
| [`app/api/keepalive/route.ts`](../web/src/app/api/keepalive/route.ts) | A reachable endpoint is not ingestion health. Use a separate authenticated or privacy-safe health summary of last successful stages, queue age and generation. Do not present keepalive as availability monitoring. |
| [`app/layout.tsx`](../web/src/app/layout.tsx), [`globals.css`](../web/src/app/globals.css) | Typography and light/dark tokens form a coherent identity. Desktop width is intentionally narrow; mobile-first fits the brief. Check iOS safe area, dock/keyboard behavior, text contrast, focus styles and reduced motion on device. |
| [`app/error.tsx`](../web/src/app/error.tsx), [`not-found.tsx`](../web/src/app/not-found.tsx) | Useful recovery pages already exist. A visible current card reaching not-found is a data/lookup bug, not something to fix by nicer error copy. Distinguish source-unavailable from absent data. |
| [`app/manifest.ts`](../web/src/app/manifest.ts) | Install metadata is useful. A manifest alone is not offline support or browser push delivery; do not imply those capabilities. |
| [`components/Dock.tsx`](../web/src/components/Dock.tsx) | Good single entry point for research/network. **Confirmed live:** natural sentence becomes invalid ticker. Add intent grouping, loading/empty/error, keyboard selection and safe Enter fallback. Shorten placeholder; voice must handle unsupported/error states and truthful edition content. |
| [`EditionCard.tsx`](../web/src/components/EditionCard.tsx) | Good editorial hierarchy and integrated people link. Reduce repeated tables and technical explanation. Make card/detail semantics predictable and preserve originating context. |
| [`ResultsTable.tsx`](../web/src/components/ResultsTable.tsx) | Compact numeric display and comparatives are useful. **Confirmed:** broad validation copy and no table-level source link. Show only performed checks, basis/period and source; move long formula into expandable methodology. |
| [`PromisesLedger.tsx`](../web/src/components/PromisesLedger.tsx) | Four-call matrix is a valuable analyst view. Default should be attention summary with readable status labels. Add actual-outcome quote/source, active target version and precise status reasons. Move reference benchmark into methodology. |
| [`SourceChips.tsx`](../web/src/components/SourceChips.tsx) | Reusable citation surface. Make all additional sources reachable, keep PDF page visible and link actual source files for price data. Avoid label-only chips that look equally verifiable. |
| [`NetworkLine.tsx`](../web/src/components/NetworkLine.tsx) | Quiet embedded network fits the brief. Require evidence precision: employer overlap is not proof of personal acquaintance. Render missing network status separately from no matching person. |
| [`NoteDraft.tsx`](../web/src/components/NoteDraft.tsx) | Practical bridge from research to action. Preserve originating question/event, allow editing, handle unavailable/failed clipboard truthfully. Never send automatically. |
| [`SinceLastVisit.tsx`](../web/src/components/SinceLastVisit.tsx) | Returning-user affordance is useful. Publication timestamp misses late ingestion/corrections. Track viewed generation/event revision, with an explicit reset policy and first-visit state. |

## 4. Database, deployment and support files

| File(s) | Review conclusion |
|---|---|
| [`001_init.sql`](../supabase/migrations/001_init.sql) | Public market versus private owner data is a sound boundary. Demo seeding is explicit. Initial all-operations private policy is superseded by 003, so do not report it as the current intended policy. Network refresh cross-joins owners/templates and does not reconcile removal. |
| [`002_universe_requests.sql`](../supabase/migrations/002_universe_requests.sql) | Validates request against the equity universe and adds request controls. Universe membership must not be treated as data availability. |
| [`003_hardening.sql`](../supabase/migrations/003_hardening.sql) | Restricts private writes, hides requester identity and schedules anonymous retention. Good changes. Count-before-insert quotas are not atomic under concurrency. Actual deployment/cron operation was not verified here; migration source is evidence of intended policy, not proof of live state. |
| [`worker/ops/com.finn.worker.plist`](../worker/ops/com.finn.worker.plist) | Reasonable local scheduler for the demo. Document machine sleep/restart, environment, log rotation, lock behavior and recovery. Host-specific paths are a portability constraint. |
| [`worker/probes/reachability.py`](../worker/probes/reachability.py), [reachability workflow](../.github/workflows/reachability.yml) | Evidence-driven source reachability testing is good. Manual probe workflow is not application CI or ongoing ingestion monitoring. Add separate offline unit/lint/type/schema/E2E checks. |
| [`web/next.config.ts`](../web/next.config.ts) | Cache Components and shared-public/per-request-private design need coordinated tests. Frame/MIME/referrer headers are useful. Current CSP is frame protection, not a full script policy; do not claim comprehensive XSS prevention from that header. No observed XSS is asserted. |
| [`web/package.json`](../web/package.json), `package-lock.json`, `tsconfig.json`, `eslint.config.mjs` | Next 16 / React 19 stack and strict typing are in place. Lint and types passed. Dependency lock/version inventory was inspected; this was not a dependency vulnerability audit or a review of installed package internals. |
| [`worker/pyproject.toml`](../worker/pyproject.toml), `uv.lock` | Small Python dependency surface is appropriate. Preserve reproducible installs; pin evaluated runtime/model choices separately from code dependencies. Lock metadata is not a substitute for deployment verification. |
| `.gitignore`, [`.env.example`](../.env.example) | Configuration template and ignored local secrets are appropriate. No secret values were copied into the audit. A public-repository/history export needs a secret scan before publication; no claim of an exposed secret is made. |
| [`web/AGENTS.md`](../web/AGENTS.md) | Notes Next version-specific changes and directs implementers to installed docs. No app edits were made here. Future implementation should follow that instruction, especially around caching and request APIs. |

## 5. Scripts and evaluations

| File | Assessment |
|---|---|
| [`scripts/prebuild.py`](../worker/scripts/prebuild.py) | Resumable and cached processing is useful. Existing file means skip forever; use source/version fingerprints. A partial index run should report completed/partial/unavailable counts rather than imply the whole index is ready. |
| [`scripts/covered_results.py`](../worker/scripts/covered_results.py) | Useful backfill for covered research companies. Integrate the necessary results refresh into the durable workflow; a manual script should not be the only way a requested company gets coherent financial context. |
| [`scripts/gold_to_ledger.py`](../worker/scripts/gold_to_ledger.py) | Valuable transparent reference construction. Keep reference provenance and IDs distinct but explicitly mapped where UI verifiers need stable target identity. |
| [`scripts/export_history.py`](../worker/scripts/export_history.py) | Supports the submission's build-history requirement. Verify actual generated artifacts, readability and private-data/secret redaction before sharing. Do not treat script existence as evidence that the requirement is complete. |
| [`evals/eval_classifier.py`](../worker/evals/eval_classifier.py) and label sets | Held-out result reproduced. Preserve difficult routine/material examples and clearly state denominators and unknowable labels. Add pipeline recall after extraction/export. |
| [`evals/eval_linking.py`](../worker/evals/eval_linking.py) | Linking metrics reproduced without model calls. Pairwise score does not measure false settlement, deadline or currency compatibility. Add independent semantic adjudication. |
| [`evals/eval_extraction.py`](../worker/evals/eval_extraction.py) | Useful extraction benchmark; not rerun because it can call paid models. Keep exact model/task/data versions and report quote fidelity, target recall, numeric accuracy and scope/period accuracy separately. |
| [`evals/rls_check.py`](../worker/evals/rls_check.py) | Inspected, deliberately not executed against production. Write-denial probes can mutate live data if protection has regressed. Run in staging/disposable fixtures with cleanup and positive/negative owner controls. |

All seven worker test files were inspected and executed: `test_cards.py`, `test_network.py`, `test_parsers.py`, `test_pull.py`, `test_results.py`, `test_sync.py`, `test_tracking.py`. The checked XML fixtures cover structured people changes and differing results formats. Existing tests contain useful real regressions; new tests should concentrate on the missing cross-module contracts identified here, not duplicate implementation branches for coverage percentage.

Main documentation inspected: `README.md`, worker/web READMEs, `docs/WRITEUP.md`, `DEPLOY.md`, `DECISIONS.md`, `PLAN.md`, the earlier review and relevant research/experiment material. Research headings and relevant sections were used to understand earlier choices; every line of all historical prose and labelled data files was not independently re-adjudicated. Existing E29/E30 findings are background, while this audit's live reproductions and current code determine the new priorities.

## 6. Offline reproduction catalog

The JSON evidence records outputs from current functions using synthetic inputs and local saved data. No new market assertion should be inferred from a synthetic `ABC` example.

| Evidence key | Input / procedure | Current output | Required behavior |
|---|---|---|---|
| `currency_mismatch_settlement` | USD 100 million target, INR 100 crore actual | Delivered | Incompatible currencies: no settlement without a justified conversion and policy |
| `missing_actual_scope_settlement` | Segment target, actual without scope | Delivered | Unknown scope: abstain |
| `wrong_actual_number_settlement` | Structured actual 100; quote says 50 | Delivered | Reject ungrounded actual value |
| `revised_target_old_period` | Thread H1FY27, latest target FY27 | Uses old period and marks missed | Use active target version's full period; no premature settlement |
| `noncurrency_x1000_grounding` | Quote 10%; structured value 10,000% | Retains value | Reject incompatible scaling |
| `unreadable_material_folded` | Material litigation with unreadable event | Zero cards; housekeeping count 1 | Material pending/unreadable card and source survive |
| `largest_price_erases_volume_event` | One day 4%/8×; another 6%/1.6× | Only bigger-price day retained | User volume rule can still recover 8× day |
| `ui_minimum_below_export_floor` | 1.5% price / 1.3× volume | No exported candidate | Respect UI's 1% / 1.2× allowed thresholds |
| `window_cards_missing_from_detail_lookup` | Compare IDs in local editions against 30d | 7/8/9 absent for 24h/3d/7d | Canonical event lookup independent of edition |
| `cochin_move_link` | Inspect saved filing/move association | Prior intraday filing linked to next session | Use full exchange-session calendar and modest contextual wording |
| `sparse_table_passes_without_identity` | Only core current revenue/PBT/PAT | `arithmetic_ok` | Report which checks actually ran; insufficient evidence cannot claim reconciliation |
| `standalone_target_vs_consolidated_tracking` | Standalone margin target, consolidated results | “on track” | Basis mismatch: no comparison |
| `local_machine_tracking` | Compare reference/machine BEL and Deepak outputs | Zero tracking in both at audit time | Records an observed absence, not proof the substitution caused a specific lost row |

The live SBI case independently validates the cross-window navigation issue. The live BEL NGC case independently validates the semantic-comparison concern. The synthetic cases demonstrate why isolated prompt changes cannot establish correctness.

## 7. Source and data inspection notes

Local snapshot observed: generated 12 November 2026 at `02:51:26` as encoded, `data_until` 11 November at `19:00:41`; do not infer timezone conversion from a timestamp without an offset. It contained 18 holdings, four additional research names and 29 synthetic contacts. There were 37 ledgers, 31 available business snapshots and 27 result entries across covered companies. These counts are a point-in-time local observation, not a guarantee that every cloud table matched it at every moment.

The local filing store contained 791 filings: 612 backfill and 179 RSS records. Counts are records, not necessarily unique underlying announcements across channels. The quote sweep checked first/latest displayed evidence occurrences using the application's normalization and cached PDFs. It did not independently OCR every page or judge all source-to-claim entailment.

Latest row statuses across inspected ledgers: 1,019 early, 217 closed, 52 revised, 46 delivered, 37 silent, seven missed and one partly. The volume of “early” rows is a reason to change the default presentation, not an argument to drop future promises. They should remain accessible with due dates and revisit triggers.

A useful audit model separates five checks:

1. **Source authenticity/identity:** correct company, document and period.
2. **Quote fidelity:** the words exist at the cited location.
3. **Extraction fidelity:** the value, unit, role, scope and date mean what the quote says.
4. **Comparison validity:** target and actual are compatible and available at the relevant time.
5. **Presentation fidelity:** the UI's title, status, evidence and explanation correspond to the validated comparison.

Finn has made strong progress on check 2. The live BEL error crosses checks 3–5. Treat these as separate measurable quality dimensions.

## 8. Proposed interfaces for the highest-risk boundaries

These are design contracts, not code committed to the app.

### Evidence-bearing comparison

```text
TargetVersion
  promise_id, version_id, company_id
  metric_id, scope_id, accounting_basis
  period_start, period_end, due_date, condition
  bound_type, low, high, currency, scale, unit
  source_span_id, stated_at

ActualObservation
  company_id, metric_id, scope_id, accounting_basis
  period_start, period_end
  value, currency, scale, unit
  source_span_id, speaker_role, observed_at

Comparison
  target_version_id, actual_observation_id
  status, reason_code, rule_version
  checks_performed[], checks_unavailable[]
```

Compatibility is a gate before value comparison. Unknown fields do not become wildcard matches. A document-derived actual is grounded in the exact span. A status with no qualifying actual stays unresolved. Approximate targets require an explicit tolerance policy, not a hidden universal percentage.

### Source/worker state

```text
ProviderState
  provider, last_attempt_at, last_success_at
  source_watermark, completeness_window
  status: fresh | partial | delayed | refused | unavailable
  reason, retry_after

GenerationManifest
  generation_id, schema_version, built_at
  providers[], price_session, ledger_versions
  validation_summary, previous_generation_id
```

This prevents “worker ran” from becoming “market data is current.” Cached last-known-good information can remain available with a clear stale state.

### Job state

```text
queued → claimed/building → validating → ready
             ↓                  ↓
       retry_scheduled      partial / unavailable
             ↓
           queued
```

Lease expiry recovers crashes. Permanent no-source outcomes differ from provider downtime. A unique job key combines company, source fingerprint and task version; retries are idempotent. Do not make the user guess whether to tap again.

### Network response

```text
status: ready | empty | unavailable
matches:
  contact_id, target_person_or_company_id
  relevance_reason, evidence[]
  path: investor → introducer → target
  edge_contexts[], freshness
```

An employer overlap, an expertise match and a verified introduction are different evidence types. Preserve those distinctions in both ranking and copy.

## 9. Review artifact index

| Artifact | Purpose |
|---|---|
| [Main audit](FINN-INDEPENDENT-AUDIT-2026-11-12.md) | Assignment interpretation, priorities, findings, design, competitors and implementation plan |
| [Browser observations](audit-2026-11-12/browser-observations.json) | Initial page text/layout/error observations |
| [Interaction observations](audit-2026-11-12/interaction-observations.json) | SBI failure, expanded BEL, search behavior, narrow/desktop and expanded-week observations |
| [Code reproductions](audit-2026-11-12/code-reproductions.json) | Deterministic synthetic/local counterexamples |
| [Data-quality checks](audit-2026-11-12/data-quality-checks.json) | Quote sweep, status counts and settlement evidence inventory |
| [Mobile edition](audit-2026-11-12/edition-mobile.png) | First-view hierarchy |
| [Weekly edition](audit-2026-11-12/week-mobile.png) | Wider-window density and alerts |
| [BEL research](audit-2026-11-12/bel-mobile.png) | Company page and ledger |
| [BEL expanded NGC](audit-2026-11-12/bel-ngc-expanded-mobile.png) | Visible semantic-verdict example |
| [Broken SBI alert](audit-2026-11-12/broken-sbi-alert-mobile.png) | Confirmed route failure |
| [Deepak research](audit-2026-11-12/deepakntr-mobile.png) | Second worked example |
| [Settings](audit-2026-11-12/settings-mobile.png) | Rules and category controls |
| [Uncovered company](audit-2026-11-12/uncovered-mobile.png) | Research coverage/request state |
| [Network search](audit-2026-11-12/network-search-mobile.png) | Combined search results |
| [Person](audit-2026-11-12/person-mobile.png) | Relationship detail and draft |
| [Card](audit-2026-11-12/card-mobile.png) | Event detail/source/ranking presentation |
| [Desktop edition](audit-2026-11-12/edition-desktop.png) | Narrow content at desktop width |
| [320px BEL](audit-2026-11-12/bel-320px.png) | Narrow mobile layout |
| [Dark edition](audit-2026-11-12/edition-dark-mobile.png) | Dark palette and hierarchy |

## 10. Re-running the non-destructive baseline checks

From `worker/`, using the existing environment:

```sh
.venv/bin/python -m pytest -q -p no:cacheprovider
.venv/bin/python -m evals.eval_classifier --heldout
.venv/bin/python -m evals.eval_linking
```

From `web/`:

```sh
npm run lint
./node_modules/.bin/tsc --noEmit --incremental false
```

For a future implementation, run focused new semantic/contract tests first, then this baseline and a browser flow sweep. Do not run model-backed evaluations or the production RLS write probe merely to increase a test count. Use staging for state-changing security checks and an explicit budget for model evaluations.
