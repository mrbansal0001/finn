# FINN — Architecture Research (04)

*Prepared 2026-11-10. Live web sources cited inline. Anything I could not verify against a live source today is marked **[unverified]**. Numbers I derived myself (token counts per page, volumes) are marked **(est.)**. Pricing for the Claude 5.5 models comes from the brief, not from a web page.*

---

## 0. TL;DR: the decisions

| Area | Recommendation | Why (one line) |
|---|---|---|
| Grounded QA | **Map-reduce structured extraction with page-anchored quotes.** Then reason over the extracted tables. Use long context only for follow-up questions, over a cached corpus. | FinanceBench and DocFinQA show retrieval misses and hallucinated numbers are the main failure modes. Extracting into a schema and checking it in code fixes both. |
| Citations | Two passes. (1) **Structured outputs** with `quote` and `page` fields, checked against the page text with rapidfuzz. (2) The narrative report uses the **Anthropic Citations API** with a custom-content document holding one block per page. | The Citations API is **incompatible with structured outputs** (it returns a 400 error), so you can't do both in one call. |
| Actuals | **NSE Integrated Filing XBRL** is the source of truth for Revenue, EBITDA, PBT and PAT. Code computes QoQ and YoY. An LLM reads PDFs only as a fallback. | Since Apr 2025, results must be filed in XBRL on the same day as the PDF. That removes the "hallucinated number" risk for actuals. |
| Classification | **NSE `desc` subject → rules (most of the volume) → Haiku 5.5 for the residue → nightly Batch re-check.** | About $0.01/day. No public labelled dataset exists, so we build a 300-item golden set ourselves. |
| PDF parsing | **pypdfium2 or PyMuPDF text with page markers** as the default. **pdfplumber** for grid tables. **Docling (MIT)** offline for table-heavy AR pages. **Claude native PDF** only for chosen pages and for scanned pages. | Native PDF costs text tokens plus an image per page, about 3× the tokens of extracted text. |
| Entity resolution | Deterministic normalisation, then blocking, then a rapidfuzz score, then context corroboration (employer and time overlap, school, DIN), then **human confirmation**. | Common Indian names collide, so we need two or more signals and a person in the loop. |
| Network data | **User-initiated imports only**: LinkedIn `Connections.csv`, Google People API, vCard, manual entry. No LinkedIn scraping. The prototype uses a **synthetic** network. | hiQ ended with a $500k judgment and a permanent injunction. Proxycurl shut down in July 2025 after LinkedIn sued it. |
| Privacy | Supabase **RLS on every table**, pgcrypto or app-level encryption for notes, **pseudonymised prompts**, Anthropic API only for anything carrying PII, never the Gemini free tier. DPDP-ready, since most obligations bite on ~13/14 May 2027. | Gemini's free-tier terms say "Do not submit sensitive, confidential, or personal information" and allow human review of inputs. |
| Hosting | **Vercel Hobby** (Next.js PWA plus API routes, 300 s functions), **Supabase Free** (Postgres, pgvector, Auth, RLS, Storage), **GitHub Actions** (cron plus long jobs), **Cloudflare R2** (PDF cache, 10 GB, zero egress). An India **residential relay** is the fallback for NSE. | Everything is $0. Vercel Hobby cron runs only once a day, so GitHub Actions does the scheduling. |
| Agents | Push and Pull are **deterministic DAGs** with LLM steps. A single **tool-using agent** handles only "Ask", which spans the network, filings and Pull outputs. | Simpler, cheaper and testable. Agents only where the query shape is open-ended. |
| Cost | Digest about **$0.03–0.12/day**. Full Pull report about **$0.30–0.50**. Full eval about **$2–4** per run. Long-context stuffing with Opus would be about **$1.70 per question**. | See §10. |

---

## 1. Grounded financial document QA

### 1.1 What the benchmarks show

- **FinanceBench** (Patronus AI, arXiv 2311.11944): 10,231 open-book questions over US filings. On a 150-case sample with 16 model configurations, "GPT-4-Turbo with a retrieval system gave an incorrect answer or refused to answer **81%** of questions". Long context that contains the evidence improves accuracy. The authors still call it impractical because of latency and because it cannot fit larger filings. They name hallucination as the key weakness. https://arxiv.org/abs/2311.11944
  - Secondary summary (unverified against the paper's tables): long context was about 76–79% correct, versus about 50% correct with 39% refusals for a per-document vector store. https://beancount.io/fr/bean-labs/research-logs/2026/05/12/financebench-open-book-financial-qa-benchmark
- **Databricks long-context RAG study** (arXiv 2411.03538, which used FinanceBench among its datasets): most models get better and then worse as context grows. "Only a handful of the most recent state of the art LLMs can maintain consistent accuracy at long context above 64k tokens." https://arxiv.org/html/2411.03538v1 · https://www.databricks.com/en/blog/long-context-rag-performance-llms
- **Feb 2026 FinanceBench-subset paper** (arXiv 2602.17981): the dominant RAG failure is that "the correct document is retrieved but the page or chunk that contains the answer is missed". The generator then extrapolates. https://arxiv.org/abs/2602.17981
- **DocFinQA** (Kensho, ACL 2024, arXiv 2401.06915): FinQA questions over full SEC filings, with about 175× longer context. Even the strongest systems struggle. One secondary source says accuracy was below 30% and dropped by more than 50% on documents over 500 pages [unverified against the paper]. Retrieval itself is unsolved: a finetuned ColBERT reached HR@3 = 0.55. https://arxiv.org/abs/2401.06915 · https://beancount.io/bean-labs/research-logs/2026/06/20/docfinqa-long-context-financial-reasoning-dataset
- **Anthropic Contextual Retrieval**: contextual embeddings plus contextual BM25 cut top-20 retrieval failure from 5.7% to 2.9% (−49%). Adding a reranker brings it to 1.9% (−67%). Note that this measures retrieval failure, not end-to-end accuracy, and the benchmark was not on financial documents. https://www.maginative.com/article/anthropics-contextual-retrieval-technique-enhances-rag-accuracy-by-67
- **FinVerBench** (2026): LLMs asked to detect numeric inconsistency in XBRL-derived statements over-flag heavily. In nine of fourteen runs they gave 95–100% false positives on clean statements. So **do arithmetic checks in code, not with an LLM judge**. https://benchmarklist.com/benchmarks/finverbench/
- **Unit and scale errors**: a vendor claims models misread numeric scale more than 8% of the time [unverified, unnamed study]. https://reducto.ai/blog/10k-document. For India this gets worse, because filings mix ₹ lakh, ₹ crore and ₹ million, and standalone versus consolidated tables sit side by side (domain knowledge, no source).
- **Multi-document degradation**: Hudson Labs, a vendor, admits that "when more than two earnings call transcripts … are involved, results often degrade". https://www.hudson-labs.com/post/hudson-labs-co-analyst-vs-gpt-4o. This argues for a **per-transcript map step** rather than putting four transcripts in one prompt.

**Failure-mode taxonomy we design against:** (1) retrieval miss, meaning the right document but the wrong page; (2) hallucinated or extrapolated numbers; (3) unit or scale confusion (lakh, crore, million, %, bps); (4) standalone versus consolidated confusion, and restated prior periods; (5) period confusion (Indian FY "Q1FY26" means Apr–Jun 2025); (6) table-structure errors from the parser (merged columns, multi-page tables); (7) refusals or over-hedging at long context; (8) the model's outside knowledge leaking in.

### 1.2 Long-context stuffing vs RAG vs structured extraction

| Approach | Accuracy profile | Cost per question (this corpus ≈ 384K tokens, est.) | Fit for FINN |
|---|---|---|---|
| Long-context stuffing (all docs in one prompt) | Good when the evidence is present. Degrades past about 64K for many models. Outside knowledge leaks in. Weak on cross-document arithmetic. | Sonnet: $0.77 for the first question, about $0.08 for cached follow-ups. Opus: about $1.70 for the first. | **Follow-up "Ask" only**, over the cached corpus. |
| Chunk RAG (embeddings, top-k) | Retrieval misses on tables and multi-page sections, which FinanceBench and DocFinQA both show. | Low (≈$0.02–0.05) | **Supporting tool only**: hybrid BM25 plus vectors over page-level chunks, used for page lookup in "Ask". |
| **Map-reduce structured extraction** (per document, per section → schema → reconcile) | Best for "promised vs delivered", where every row has a quote and a page that can be checked in code. Mirrors the Hebbia Matrix pattern (rows = documents, columns = questions). | About $0.30–0.50 per report, done once and cached. Follow-ups are cheap. | **Primary path for Pull.** |

**Recommendation:** run the Pull report as map-reduce extraction, and keep its output as structured tables (`guidance_items`, `actuals`, `ar_facts`). The final narrative runs over those tables plus the cited quotes. Answer "Ask" follow-ups with a hybrid: structured tables, then page-level BM25 and vector lookup, then Sonnet with the Citations API on the retrieved page blocks. Fall back to long context, over a cached corpus, only for open-ended synthesis.

### 1.3 Citation verification techniques

1. **Quote-and-verify (deterministic).** Every extracted item must carry `quote` (verbatim) and `page`. After extraction, normalise whitespace, hyphenation and Unicode digits. Then run `rapidfuzz.fuzz.partial_ratio(quote, page_text[page])` and require ≥ 92. Also check ±1 page for spill-over. If the quote isn't found, drop the item or re-ask once. **Numbers inside the quote must parse to the claimed value**, with the scale taken from the quote ("₹1,234 crore" means 1.234e10). This costs $0 and catches most hallucinations.
2. **Anthropic Citations API.** It supports PDFs (`page_location`, 1-indexed start and exclusive end page), plain text (`char_location`) and **custom content documents** (`content_block_location`). `cited_text` is extracted by the API, so "citations are guaranteed to contain valid pointers to the provided documents", and `cited_text` doesn't count toward output tokens. It works with prompt caching and batch processing. **It is incompatible with structured outputs**: enabling both returns a 400 error. Scanned PDFs can't be cited because image citations aren't supported. https://platform.claude.com/docs/en/build-with-claude/citations
   - **Trick:** send each report or transcript as a *custom content document* with **one content block per PDF page**. `content_block_location.start_block_index` then *is* the page number. You get page-precise citations without paying image tokens for native PDF.
3. **Closed-book guard against outside knowledge.** The system prompt says "answer only from the documents; if not present, say NOT IN SOURCES". Post-check: every sentence in the narrative containing a number or named fact must have at least one citation. Sentences without one get removed or flagged. Regex for digits plus a citation-coverage check, $0.
4. **Arithmetic in code.** QoQ and YoY, margins, and "delivered vs promised" deltas are computed in Python from structured values. The LLM never does the arithmetic it reports.
5. **Optional LLM judge** (Haiku, cheap) for semantic entailment: "does this quote support this claim?". Use it only on claims that pass steps 1–4, as a precision boost in evals. FinVerBench suggests not trusting LLM judges for *numeric* consistency.

### 1.4 What production tools do (public information only)

- **Hebbia Matrix**: a spreadsheet UI where documents are rows, questions are columns, and agents fill every cell in parallel with cited answers. It uses "iterative source decomposition": split a query into sub-queries and run them over *full documents*, not top-k chunks. Retrieval is reportedly separated from output formatting into distinct agents. Hebbia claims early RAG failed 84% of queries (self-reported). Uses OpenAI and Anthropic models. https://sacra.com/c/hebbia/ · https://sacra.com/chat/h/3b4a7b44-120d-47fc-bdb1-4a423bd0a7c3
- **Fintool**: agents with specialised tools including direct EDGAR access, "a network of LLM agents to verify" outputs, LLM-agnostic, golden datasets with continuous eval (Braintrust case study). Claims 98% on FinanceBench (vendor). Reports of a Microsoft acquisition in Apr 2026 come from a single source [unverified]. https://fintool.com/technology · https://www.braintrust.dev/customers/fintool · https://fintool.com/press/fintool-outperforms-analysts-sec-filings
- **Daloopa**: automated extraction, then "hundreds of systematic checks", then a **human reviews every number**. Every data point is hyperlinked to its source document. Claims accuracy above 99% (vendor). https://daloopa.com/blog/analyst-best-practices/how-ai-is-transforming-earnings-report-processing-in-2025 · https://www.daloopa.com/how-our-ai-works
- **AlphaSense**: no technical architecture found in this session [unverified]. Publicly known to combine a licensed transcript and broker-research corpus with semantic search and generative summaries that carry citations.
- **Hudson Labs** (guidance-focused): a specialised guidance extractor that claims to beat GPT-4o, GPT-5 and Claude on guidance completeness. It acknowledges degradation with more than two transcripts. https://www.hudson-labs.com/post/management-guidance-summary-in-earnings-call

**Common pattern:** decompose → run over whole documents in parallel → structured cells with source links → automated checks → (human) review → evals on golden sets. FINN copies all of this except paid human review. A user "flag as wrong" button stands in for it.

---

## 2. "Promised vs delivered"

### 2.1 Literature and prior art

- **Aavang et al., ACL 2026 Industry**, "Challenges and Opportunities in KPI Extraction from Earnings Calls". Introduces the ECB and ECB-A benchmarks and separates retrospective KPIs from forward-looking ones. https://aclanthology.org/2026.acl-industry.100.pdf
- **Li & Lu, EACL 2026**, "Context-Enriched Agentic RAG for Predicting Post-Earnings Price Shocks". One agent explicitly assesses the *credibility of guidance*. Releases transcripts matched with financial statements. https://preview.aclanthology.org/ingest-eacl/2026.eacl-long.141.pdf
- **Consistency study (arXiv 2503.16974)**: binary forward-looking-statement detection is highly reproducible with small models (Fleiss' κ > 0.93 for GPT-3.5 and 4o-mini). So a **cheap model can do the sentence filter**. https://arxiv.org/pdf/2503.16974v2
- **Hudson Labs** (vendor): guidance extraction is hard for generalist chatbots, which miss guidance or wrongly claim none was given. https://hudson-labs.com/blog/management-guidance-summary-in-earnings-call
- Academic work on management credibility usually scores **forecast error** and **bias** (management guidance vs realised value) across quarters [unverified as a specific citation; standard accounting-research construct].

### 2.2 Extraction pipeline (per transcript, map step)

1. **Parse** the transcript to page-tagged text. Segment it by speaker turns (regex on "Name:" lines; Indian transcripts typically label "Moderator:", "Management:", or the name). Mark the speaker's role (CEO, CFO, IR, analyst) from the opening introductions.
2. **Filter (Haiku 5.5)**: classify each management turn's sentences as `forward_looking ∈ {quant_guidance, qual_guidance, none}`. Analyst questions are context only. They are never guidance.
3. **Extract (Sonnet 5.5, structured outputs)** on the candidate passages plus ±1 turn of context, using this schema:

```json
{
  "guidance_id": "uuid",
  "company": "TICKER", "source_doc": "Q2FY26_transcript", "page": 7, "speaker": "CFO - A. Sharma",
  "quote": "verbatim sentence(s)",
  "metric": "revenue_growth | ebitda_margin | capex | volume | order_book | net_debt | store_count | other",
  "metric_raw": "consolidated revenue growth",
  "scope": "consolidated | standalone | segment:<name>",
  "guidance_type": "point | range | floor | ceiling | directional | qualitative",
  "value_low": 15.0, "value_high": 18.0, "unit": "% | INR_cr | INR_mn | units | bps | x",
  "period": {"type": "FY|H|Q|multi_year", "label": "FY26", "start": "2025-04-01", "end": "2026-03-31"},
  "conditionality": "barring macro shocks",
  "is_reiteration_of": "guidance_id|null", "is_revision_of": "guidance_id|null",
  "confidence": 0.0
}
```

4. **Verify**: quote-and-verify (§1.3). Normalise periods to Indian FY and to the company's own fiscal calendar (most are Apr–Mar, a few are Jan–Dec).
5. **Link across quarters**: match the same `(metric, scope, period)` from later calls. Mark reiteration, raise or cut. The *latest pre-period guidance* is what gets scored, and the history is shown.

### 2.3 Matching to actuals (reduce step)

- **Actuals source priority:** (a) **XBRL integrated filing** for P&L lines (revenue, EBITDA where derivable, PBT, PAT), https://www.nseindia.com/companies-listing/xbrl-information; (b) the results press release or investor presentation (Haiku extraction plus quote-verify) for KPIs not in XBRL, such as volumes, order book and store count; (c) the next transcript's "we delivered X" statements, with the lowest trust.
- **Scoring in code:** for range guidance, `hit` if the actual is in [low, high], `beat` if above, `miss` if below. Directional guidance is scored on sign. Qualitative guidance is "not measurable" and shown with quotes only. Credibility score = share of measurable guidance met, plus mean signed error (bias), over the last 4 to 8 quarters.
- **Sonnet's role** is limited to semantic matching where the metric definitions differ (for example "core EBITDA" vs reported EBITDA) and to writing the narrative with citations. It doesn't decide hits or misses.

---

## 3. Announcement classification

- **Volume (est.):** about 5,700 per week market-wide, so roughly 1,100 per trading day. For 20 watched stocks expect about 20–60 per day, with spikes in results season.
- **NSE already categorises.** The public announcements JSON carries `desc` (for example "Change in Directors/ Key Managerial Personnel"), plus `attchmntFile` (the PDF on nsearchives), `an_dt`, `symbol`, `sm_name`, `sm_isin`. https://marketsetup-in.web.app/posts/corp-announcements. NSE also publishes RSS feeds (Announcements, Board Meetings, Financial Results), for example `https://nsearchives.nseindia.com/content/RSS/Financial_Results.xml`. https://www.nseindia.com/static/rss-feed
- **No public labelled dataset** of NSE or BSE announcements was found. The nearest are Indian financial *news* datasets, such as HF `kdave/Indian_Financial_News`. https://huggingface.co/datasets/kdave/Indian_Financial_News/tree/main. Commercial scrapers (Apify) exist. **Build our own golden set:** 300 announcements, stratified across the 17 classes, labelled in an afternoon with Haiku pre-labels plus human correction.

**Cheapest accurate approach (tiered):**

| Tier | What | Coverage (est.) | Cost |
|---|---|---|---|
| 1. Rules | Map the NSE `desc` subject to our 17 classes. Add regex on `attchmntText` or the subject line for sub-typing (e.g. "Outcome of Board Meeting" + "dividend" → dividend; "Credit Rating" → credit_rating; "Pledge" / "SAST" → pledging; "Trading Window" → insider_trading). | ~70–80% (est.) | $0 |
| 2. Haiku 5.5 zero-shot or few-shot | Ambiguous subjects ("General Updates", "Outcome of Board Meeting", "Press Release") plus the first 1–2 pages of PDF text. Output is JSON with `{category, secondary, priority, one_line_summary}`. | ~20–30% | ≈ $0.0003 each |
| 3. Nightly Batch re-check | Re-classify the whole day's items with Haiku via the Batch API (−50%) to catch rule drift. Disagreements go to a review queue and feed new rules. | 100% | ≈ $0.006/day |

Don't bother with a small embedding classifier. With no training data and Haiku costing ≈$0.01/day, it isn't worth the engineering time. Revisit it only if we classify all ~1,100 announcements a day market-wide (Haiku would still be only ≈$0.33/day).

**Priority:** a rules matrix of (category × materiality signals): results = high; management_change involving CEO, CFO or MD = high; credit-rating downgrade = high; pledge increase above x% = high; trading-window closure = low. Haiku supplies a materiality hint for free text.

**Disclosure content worth knowing:** under SEBI LODR Reg 30 and Schedule III, director or KMP change filings follow a standard format with **reason for change, effective date, brief profile (for appointments), and relationships with other directors**. That's exactly what the bio extractor needs. https://legalmantra.net/blog-detail/What-are-the-disclosures-applicable-for-Change-in-Directors-Key-Managerial-Personnel-of-Director-in-a-Listed-Entity · example filing: https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Appointment%20of%20Interim%20Chief%20Financial%20Officer_disclosure.pdf. Earnings-call **transcripts must be posted within 5 working days**, and recordings within 24 to 48 hours depending on the amendment. So "last 4+ quarters of transcripts" should exist on the exchange for any listed company. https://www.ptcindia.com/wp-content/uploads/2021/06/SEBI-LODR-2nd-Amendment-Reg-2021-1.pdf · https://webiis08.mondaq.com/india/corporate-governance/1622506/shaping-a-transparent-future-sebis-regulatory-reforms-and-industry-mandates-dec-2024-apr-2025

---

## 4. PDF parsing

| Tool | Licence | Tables | Speed / footprint | Serverless fit | Notes |
|---|---|---|---|---|---|
| **PyMuPDF / pymupdf4llm** | **AGPL** or commercial (Artifex) | Basic table finder | Very fast, C-backed (est. sub-second per 10 pages) [unverified] | Fits within Vercel's Python 500 MB | AGPL covers network use, so a closed SaaS needs a licence. Fine for an open-source take-home repo. https://pymupdf.readthedocs.io/en/latest/_sources/about.rst |
| **pypdfium2** | Apache/BSD | Text only | Very fast | Small | Permissive alternative to PyMuPDF for text with page markers [unverified licence detail]. |
| **pdfplumber** | MIT | Good on ruled grid tables | Slower (pure Python on pdfminer) | Small | Use on results-statement pages. https://www.file2markdown.ai/blog/pdfplumber-vs-pymupdf |
| **Docling** (IBM) | **MIT** | Strong. A vendor post reports TEDS ≈0.93, the best among licence-free tools, but also saw hallucinated values in one test. | Heavy (layout and table models, torch). About 82 s for 10 pages on CPU in one test. | **Not on Vercel**. Use GitHub Actions or Modal. | https://www.nutrient.io/blog/docling-alternatives.md · https://newsletter.codecut.ai/p/pdf-table-extraction-docling-vs-marker |
| **Marker** | GPL-3 code plus OpenRAIL-M weights | Good with `--use_llm`, but merged columns on borderless rows in one test | GPU preferred | Poor | Licence friction. https://dev.to/ashokan/from-pdfs-to-markdown-evaluating-document-parsers-for-air-gapped-rag-systems-58eh |
| **LlamaParse v2** | SaaS | LLM-based, good | About 30 s for 10 pages | API call | Credits: Fast 1, Cost-effective 3, Agentic 10, Agentic Plus 45 per page. Free credits on signup (10k advertised). About $1.25 per 1k credits [secondary]. A 300-page AR on Agentic = 3,000 credits ≈ $3.75. Data leaves to a third party. https://developers.llamaindex.ai/typescript/cloud/general/pricing/ |
| **Claude native PDF** | API | Excellent on charts and tables (vision) | — | API call | Each page is sent as **extracted text (1,500–3,000 tokens) plus an image**. Max 600 pages per request (100 if context is under 1M), 128 MB. One measurement found about 2,700 tokens per page in total. https://platform.claude.com/docs/en/build-with-claude/pdf-support · https://blog.jztan.com/llm-api-pdf-page-limits/ |

**Recommendation:**
- **Default:** text extraction with explicit `=== PAGE n ===` markers (PyMuPDF for the prototype; pypdfium2 if licensing matters). Store per-page text in Postgres (`doc_pages`). That table is the citation substrate.
- **Tables:** detect financial-statement pages by keyword ("Statement of Profit and Loss", "Segment", "₹ in crore") and run pdfplumber on them. For the AR's key statements, run Docling offline in GitHub Actions and cache the output as markdown tables.
- **Claude native PDF, page-selected:** use it only when a table fails validation (columns don't sum, or units are ambiguous), sending a 1–3 page sub-PDF. That costs about 3× the tokens on a handful of pages, not 300.
- **Scanned PDFs** are common for signed letters from smaller Indian companies. Detect them when the text layer has fewer than 50 characters per page. Then either (a) OCR with `ocrmypdf` / Tesseract in GitHub Actions, which is free, or (b) send the page to Claude native PDF (vision). Note that Citations can't cite scanned pages, so citation falls back to our own page index.
- **Bundle size:** Vercel Python functions allow 500 MB uncompressed (250 MB for Node), with a 5 GB "large functions" beta. https://vercel.com/docs/functions/limitations. PyMuPDF plus pdfplumber fit easily. Docling or torch would not fit comfortably, which is another reason to run it offline.

---

## 5. Entity resolution (filing name → network person)

### 5.1 Pipeline

1. **Extract** from the management-change filing (Haiku, structured): `name, designation, din?, effective_date, prior_roles[{org, title, from, to}], education[{institution, degree, year}], age?` plus the quote and page for each.
2. **Normalise names** (deterministic):
   - Strip honorifics and post-nominals: Mr, Mrs, Ms, Miss, Shri, Shri., Sri, Smt, Kum, Dr, Prof, CA, CS, CMA, Adv, Late, (Retd.), IAS, IPS, plus degree suffixes.
   - Handle initials: "R. Venkataraman" ↔ "Ramaswamy Venkataraman" ↔ "Venkataraman R". South-Indian initials often stand for the father's or village name and can sit before or after the given name.
   - Transliteration variants: Agarwal/Agrawal/Aggarwal, Mohd/Mohammed/Mohammad, Choudhary/Chaudhary/Chowdhury, Laxmi/Lakshmi, Srinivasan/Sreenivasan. Keep a small variant dictionary plus a phonetic key (Double Metaphone).
   - Treat filler tokens as low-weight: Kumar, Kumari, Bhai, Ben, Devi.
   - Casefold, strip diacritics, collapse whitespace and punctuation.
3. **Blocking**: candidate contacts that share the surname phonetic key, *or* the given-name phonetic key plus a compatible initial, *or* the same DIN.
4. **Name score**: `rapidfuzz` `token_sort_ratio` and `token_set_ratio`, plus an initials-compatibility check (an initial must match the first letter of the corresponding full token).
5. **Context corroboration** (this is what separates two people called "Rajesh Kumar"):
   - Employer overlap: the filing bio's prior orgs ∩ the contact's employment history, *with overlapping dates*. Normalise org names: strip "Ltd/Limited/Pvt/Private/India", handle common aliases (HUL = Hindustan Unilever), with optional embedding similarity for long tails.
   - School overlap, with year proximity.
   - **DIN exact match is decisive** if both sides have it.
   - Age or graduation-year plausibility.
6. **Decision**: `score = 0.4·name + 0.3·employer_time_overlap + 0.15·school + 0.15·other`. Auto-link only if score ≥ 0.9 **and** at least 2 independent signals agree. 0.7–0.9 means "Is this your contact X?", one tap to confirm. Below that, no link. Confirmed links are stored as `person_identity(contact_id, filing_person_id, method, confirmed_by_user_at)`.
7. **Embeddings** add little for person names. Use them (local `bge-small` or a hosted embedding model) only for **expertise mapping**: embed contacts' role descriptions and the investor's tags, then cluster.

### 5.2 Relationship strength (how RI tools do it)

- Affinity: strength is computed from sender and recipient, frequency and recency *metadata*, not content. The weights aren't public. https://support.affinity.co/s/article/Tutorial-6-relationship-intelligence-your-network-advantage.md
- Introhive: activity-based, with time-window decay. https://help.introhive.com/en/articles/16147900-how-does-activity-based-interaction-centric-scoring-work
- Patent US 11645321: volume (frequency), timestamp weighting (recency), and reciprocity (unanswered messages lower the score, fast replies raise it). https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11645321
- Attio: recency and frequency. https://attio.com/help/reference/attio-101/productivity/communications-intelligence.md

**FINN formula (prototype):**
`strength = 0.35·exp(−days_since_last_contact/180) + 0.25·min(1, log1p(interactions_12m)/log1p(24)) + 0.15·reciprocity + 0.15·user_rating/5 + 0.10·shared_context`
Here `shared_context` means the same employer with overlapping years or the same school and cohort.
**Reconnect nudges:** (a) strength was historically high but recency has decayed past 6 months; (b) **event-triggered**: the contact, or their 1st-degree connection, appears in a filing for a watched stock (appointment, resignation, board seat). Event-triggered nudges are FINN's differentiator.

### 5.3 Paths

The graph is small (≤ 5k nodes, est.), so a **Postgres recursive CTE** over `edges(src, dst, type, start, end, weight)` is enough. Don't add Neo4j. Edge types: `knows` (investor → contact), `colleague_overlap` (derived from employment intervals), `board_interlock` (from filings or MCA), `alumni_overlap`. Second-degree path ranking = product of edge weights × recency.

---

## 6. Network data sourcing: legality

- **LinkedIn scraping:** the User Agreement prohibits it. **hiQ v. LinkedIn** ended in Nov 2022 with summary judgment for LinkedIn on breach of contract (scraping plus fake "turker" profiles). That was followed by a Dec 2022 **consent judgment: $500,000 against hiQ, a permanent injunction, and destruction of scraped data and code**. The Ninth Circuit's CFAA rulings on public data remain, but the contract theory won. https://www.zwillgen.com/alternative-data/hiq-v-linkedin-wrapped-up-web-scraping-lessons-learned/ · https://newmedialaw.proskauer.com/2022/12/08/hiq-and-linkedin-reach-proposed-settlement-in-landmark-scraping-case/
- **Proxycurl:** LinkedIn sued it in Jan 2025, alleging fake accounts and scraping of millions of profiles. It **shut down on 4 Jul 2025** ("there is no winning in fighting this"). The team moved to NinjaPear, which says it doesn't scrape LinkedIn. https://nubela.co/blog/goodbye-proxycurl/ · https://www.socialmediatoday.com/news/linkedin-wins-legal-case-data-scrapers-proxycurl/756101/
- **LinkedIn data export (user's own data):** Settings → Data privacy → Get a copy of your data. `Connections.csv` has **First Name, Last Name, URL, Email Address (only if the connection shared it), Company, Position, Connected On**. LinkedIn doesn't document the exact header row, so parse it defensively. It contains **no employment history, no dates beyond "Connected On", and no schools**. Delivery takes from about 10 minutes to 48 hours. https://support.affinity.co/s/article/Import-LinkedIn-Connections · https://www.trykondo.com/blog/how-to-download-your-connections-from-linkedin
- **Google Contacts:** People API with `contacts.readonly`. `Person.organizations[]` includes `current`, `startDate` and `endDate`, so employer history *can* come from here if the user maintained it. https://googleapis.dev/nodejs/googleapis/latest/people/interfaces/Schema$Organization.html. Google classifies the contacts scopes as sensitive and they need OAuth app verification for production [unverified]. A **vCard (.vcf) upload** avoids OAuth entirely.
- **MCA (India):** MCA21 offers a free public view of **Director Master Data and signatory details** by CIN, DIN or name, captcha-gated. There's **no official public API** as of May 2026; API access is on the V3 roadmap. The portal ToS reportedly forbid scraping. Licensed vendors (Infyner, Surepass, CompanyData) sell DIN → directorships APIs. https://businessdataguide.com/blog/jurisdictions/india-company-search-guide · https://www.infyner.com/developers · https://www.mca.gov.in/mca/html/mcav2_en/home/home/login/login.html
- **Board-interlock datasets:** no ready-made open dataset. Academic sources include IIMB (166 companies, 1995–2007), Gupta–Seth–Sukhija 2024, an arXiv 2603.22860 preprint (50k directors, 85k companies), and CMIE Prowess (licensed, no redistribution). NSE notes that DIN coverage in its own board data is incomplete. https://arxiv.org/abs/2603.22860 · https://repository.iimb.ac.in/bitstream/123456789/7953/1/WP_IIMB_374.pdf · https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Board_Composition_Report.pdf

**What a real deployment would do:** user-initiated, consented imports only: LinkedIn CSV, Google People API (OAuth), vCard, CRM export, and later opt-in email and calendar *metadata* (counts and timestamps, not content) for recency and frequency. Enrich people who appear in filings from the **filings themselves** (SEBI-mandated brief profiles, AR director profiles under Reg 46) and from a **licensed MCA/DIN vendor** for board interlocks. Never scrape LinkedIn or MCA.

**What the prototype should do:** a **synthetic network** of about 150–300 fictional contacts with realistic Indian names, employers and dates, including deliberate near-duplicates to exercise entity resolution. Seed a few links to *real public directors* drawn from filings, using public data only. Ship a working `Connections.csv` importer tested on a synthetic file in LinkedIn's format. Say this explicitly in the writeup.

---

## 7. Privacy and compliance

### 7.1 DPDP Act 2023 and the DPDP Rules 2025

- **Rules notified 13/14 Nov 2025 with a phased rollout.** Rules 1, 2 and 17–21 apply immediately. Consent-manager registration (Rule 4) comes at about 12 months. **Rules 3 and 5–16, 22 and 23 (notice, security safeguards, breach intimation, erasure, data principal rights, cross-border transfer) apply at about 18 months, i.e. ~13/14 May 2027.** https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf · https://www.storyboard18.com/amp/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm · https://taxguru.in/?p=1064181
- **Exemptions:** the Act doesn't apply to processing for "purely personal or domestic purposes", or to personal data made public by the data principal or under a legal obligation. https://iitbhu.ac.in/contents/institute/cf/cis/doc/dpdp_act_rules_summary.pdf
  - *Implications (my analysis, not legal advice):* (a) Directors' profiles in **exchange filings** are published under a legal obligation (SEBI LODR), so they're arguably outside the Act. (b) An investor's contact book used for *professional investing* is **not** "purely personal". A company running FINN that stores those contacts is processing third-party personal data, so it is a **Data Fiduciary**. If FINN is sold to an investment firm, FINN may instead be the firm's **Data Processor**, with the firm as fiduciary.
- **Lawful basis for contacts:** Section 7 "legitimate uses" is a closed list. 7(a) covers data the principal *voluntarily provided themselves*, which doesn't obviously cover contacts uploaded by someone else. https://dpdpa.com/dpdpa2023/chapter-2/section7.html · https://dpdp.myndsolution.com/wiki/act/section-7-certain-legitimate-uses/. **Design consequence:** minimise and purpose-limit. Store only professional facts (name, employers and dates, schools, city, relationship metadata). Hash emails and phone numbers for de-duplication rather than storing them. Make contact-level deletion trivial. Get counsel's view before a commercial launch.
- **Fiduciary duties (Section 8):** responsible for processors (Anthropic, Supabase, Vercel); reasonable security safeguards; erasure when the purpose is served; breach notification. https://www.dpdpa.com/dpdpa2023/chapter-2/section8.html
- **Rules specifics:** Rule 6 security safeguards (encryption, access control, monitoring, **logs retained ≥ 1 year**). Rule 8 erasure: a purpose is deemed served after a prescribed inactivity period (3 years for the specified classes of large platforms), with **48-hour notice before erasure**. https://www.dsci.in/files/content/documents/2025/faq-on-data-retention-and-data-erasure-v2.pdf · https://ksandk.com/data-protection-and-data-privacy/data-retention-and-deletion-under-indias-dpdp-rules/. Breach: notify the Board and affected principals, with a detailed report within 72 hours [unverified exact wording].

### 7.2 Access control: Supabase RLS pattern

```sql
alter table contacts enable row level security;
create policy "owner_only" on contacts
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create index on contacts(owner_id);
```
- Wrapping `auth.uid()` in `(select …)` means it is evaluated once per query, not per row. Index `owner_id`. Use `TO authenticated`. Policies do nothing unless RLS is enabled. https://supabase.com/docs/guides/database/postgres/row-level-security · https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv.md
- Apply it to **every** private table: `contacts, employment, education, interactions, notes, person_identity (links), nudges, pull_reports (if per-user), chat_history`. Public tables (`announcements, documents, doc_pages, guidance_items, actuals`) are readable by everyone and writable only by the service role.
- The **service-role key lives only in GitHub Actions and Vercel server env**, never in the client. Add CI tests that sign in as user B and assert they get zero rows of user A's data.

### 7.3 Encryption

- Supabase encrypts at rest by default. **pgsodium (Transparent Column Encryption) is pending deprecation.** Vault is not affected and is fine for secrets. https://supabase.com/docs/guides/database/extensions/pgsodium
- **Field-level encryption for `notes` and free text:** encrypt in the application with AES-GCM (libsodium `secretbox` or WebCrypto), using a per-user data key wrapped by a master key held in Vercel env or Vault. Ciphertext goes into a `bytea` column. Crypto-shredding then works: delete the user's key and their notes are gone. Searchable fields (names) stay plaintext under RLS, because entity resolution needs them.

### 7.4 LLM providers and training on API data

| Provider / tier | Trains on your data? | Retention | Send network PII? |
|---|---|---|---|
| **Anthropic API** (commercial) | No, unless you opt in. Commercial Terms: "may not train models on Customer Content". | Inputs and outputs deleted within 30 days (longer if flagged under the Usage Policy or for legal reasons). ZDR is available by agreement. Covered "Mythos-class" models keep 30 days even under ZDR. | **Yes, minimised and pseudonymised** |
| **OpenAI API** | No, since 1 Mar 2023, unless you opt in. | Up to 30 days in abuse logs. ZDR or Modified Abuse Monitoring need approval. The Responses API keeps state for 30 days by default. | Acceptable alternative |
| **Gemini API free tier** | **Yes**: used "to provide, improve, and develop Google products … and machine learning technologies". **Human reviewers may read** inputs and outputs. Terms say: "**Do not submit sensitive, confidential, or personal information to the Unpaid Services.**" | — | **Never** |
| **Gemini API paid tier** (billing enabled) | No. Processed under the DPA, logged for a limited time for abuse detection. | Limited | OK |
| Local or open-source (Ollama etc.) | No | You control it | OK, but quality and ops cost |

Sources: https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organizations-data · https://conductatlas.com/platform/anthropic/anthropic-commercial-terms/output-ownership-and-no-model-training/ · https://www.anthropic.com/uk-government-internal-ai-safety-policy-response/data-input-controls-and-audit · https://developers.openai.com/api/docs/guides/your-data · https://aistudio.google.com/docs/terms

The Gemini free tier is fine for **public** filings data in principle. But management-change bios are personal data, even though they're public, and the free-tier terms prohibit personal information. At Haiku's prices (≈$0.01/day for classification), a second provider isn't worth the complexity or the policy risk. **Use Anthropic for everything, and list Gemini paid tier and OpenAI as fallbacks.** Gemini free-tier quotas also swing wildly between sources (≈20 to ≈1,500 requests per day), so they're unreliable for a pipeline. https://pecollective-com.pages.dev/tools/gemini-free-tier-guide/

### 7.5 FINN privacy design (summary)

1. **Data inventory.** Per contact: name, normalised name, employers with dates, schools with years, city, tags, user rating, last-contact date, interaction counts, and hashed email and phone. Encrypted notes. *Not stored:* message bodies, raw email addresses or phone numbers (beyond the hash), anything scraped.
2. **Consent and notice.** The investor confirms at import that they have a professional relationship with these contacts and that the purpose is investment networking. Show a one-screen notice on what's stored, where and for how long. Imports must be explicit user actions.
3. **Retention.** Contacts are kept while the account is active. Contacts not touched in 24 months get prompted for review [proposed]. On account deletion: hard delete within 30 days plus key shredding. Audit logs are kept for 1 year (Rule 6). LLM-side retention is 30 days at Anthropic (disclosed).
4. **Minimisation in prompts.** Entity resolution is deterministic code, with no LLM. For "Ask" questions that touch the network, the agent's tools return **pseudonymised** records (`P_1932: VP Finance @ Tata Steel 2015–2019`). The model reasons over IDs, and the server re-hydrates names in the UI. Notes are never sent unless the user explicitly asks about them.
5. **Isolation.** RLS plus CI tests. Per-user encryption keys for notes. The service key is server-side only. Supabase Auth uses magic link or OTP.
6. **Data principal rights (for contacts).** Offer a public "remove me" request path that deletes by name plus a hashed email match across all tenants [real deployment].

---

## 8. Hosting on free tiers (verified Nov 2026)

| Service | Current free limits (source) | Gotchas |
|---|---|---|
| **Vercel Hobby** | Functions: **300 s default and max**, 2 GB / 1 vCPU, bundle 250 MB (**500 MB for Python**), 4.5 MB request and response body (streaming exempt). **Cron: 100 per project but only once per day**, ±59 min precision. Runtime logs kept 1 h. Cron Jobs are "legacy", moving to "Schedules". https://vercel.com/docs/functions/limitations · https://vercel.com/docs/cron-jobs/usage-and-pricing · https://vercel.com/docs/limits | Hobby is for non-commercial or personal use [unverified in this session]. Can't run intraday crons. Default region is iad1 (US), so set it to `bom1` (Mumbai) [region availability unverified]. |
| **Supabase Free** | **500 MB DB**, 1 GB file storage, 5 GB egress, 50k MAU, 500k Edge Function invocations, **2 active projects**, **paused after 1 week of inactivity**, no automatic backups. Pro is $25/month. https://supabase.com/pricing.md | The daily ingest keeps it awake. Do your own `pg_dump` to R2 weekly from GitHub Actions. |
| **Neon Free** | 100 CU-hours per project per month, **1 GB per project** (older pages say 0.5 GB), scale-to-zero after 5 min (forced). https://neon.com/faqs/free-plan-limits-and-quotas | No Auth, Storage or RLS helpers. Choose it if you leave Supabase. |
| **Turso Free** | ~100 DBs, 5 GB, 500M rows read and 10M written per month [secondary]. https://agentdeals.dev/vendor/turso | SQLite: no RLS, no pgvector-style tooling (has its own vector support) [unverified]. |
| **Cloudflare** | Workers: 100k requests/day, **10 ms CPU** per invocation. R2: 10 GB, zero egress. D1: 5 GB [secondary]. https://developers.cloudflare.com/workers/platform/limits/ · https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/ | 10 ms CPU rules out PDF parsing. **R2 suits the PDF cache.** |
| **Render Free** | Web service sleeps after 15 min idle, 30–60 s cold start, ~750 h/month [secondary]. https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026 | Fine for a demo backend. US/EU/SG regions. |
| **Fly.io** | **No free tier for new users** (legacy accounts only). https://flaviocopes.com/hosting-free-tiers/ | — |
| **Railway** | Trial credit only, ~$5 [sources conflict]. https://findstack.com/resources/railway-vs-render-vs-fly-io | — |
| **Modal Starter** | **$30/month free credits**, no card per newer sources. https://modal.com/pricing | The best free option for Docling or OCR bursts. |
| **GitHub Actions** | Scheduled runs **can be delayed 15–30+ min or skipped** under load. Schedules are **auto-disabled after 60 days without repo activity** in public repos. https://runhooks.app/blog/github-actions-scheduled-workflows-unreliable/ · https://dev.to/gautamkrishnar/how-to-prevent-github-from-suspending-your-cronjob-based-triggers-knf. Public repos get free standard-runner minutes, and private repos get 2,000 min/month on Free [unverified, from memory]. Jobs can run up to 6 h [unverified]. | Runners are Azure US datacenter IPs, so NSE may block them. Use `workflow_dispatch` / `repository_dispatch` for on-demand Pull jobs. |
| **HF Spaces CPU Basic** | 2 vCPU, 16 GB RAM, sleeps after 48 h idle. https://huggingface.co/docs/hub/en/spaces-overview | Forum reports from mid-2026 describe new quota enforcement on free CPU [unverified]. Not recommended for anything critical. |
| **Oracle Cloud Always Free** | A1 Arm allowance **reportedly cut to 2 OCPU / 12 GB on 15 Jun 2026**. Mumbai has severe capacity shortages. https://infoq.com/news/2026/07/oracle-cloud-free-tier-limits/ | An Indian datacenter IP, but NSE may still block it, and it's hard to provision. |

### 8.1 NSE access and the IP-block fallback

Evidence: community reports say NSE refuses or hangs on requests from cloud IP ranges (GCP, AWS us-east, Streamlit Cloud). It needs homepage cookies first (a "visit homepage, keep cookies" warm-up), and returns 403 on bursts. NSE and BSE have also **restricted overseas access**, citing cyber threats. Some users report that AWS in India works. https://forum.unofficed.com/t/update-nsepython-not-working-in-aws-google-cloud-and-webservers/670 · https://discuss.streamlit.io/t/issue-with-web-scraping-deployment/20843 · https://www.angelone.in/news/stocks-share-market/nse-and-bse-restrict-overseas-access-due-to-cyber-threats. Licensed real-time feeds exist (NSE data subscription, ticker plants, BSE at roughly ₹3 lakh/yr anecdotally). https://tradingqna.com/t/corporate-announcement-data-api/178154

**Fallback design (ordered):**
1. **NSE RSS** (`nsearchives.nseindia.com/content/RSS/*.xml`) plus attachment PDFs on `nsearchives`. These are static-file hosts that are often more permissive than `www.nseindia.com/api/*` [unverified].
2. **NSE JSON API** with a cookie warm-up, a realistic UA, and ≤1 request per 2–3 s.
3. **BSE** (`bse` PyPI wrapper / `api.bseindia.com`) as a second source. Most watched large caps are dual-listed and file the same documents. https://pypi.org/project/bse/
4. **Residential relay in India**: a GitHub **self-hosted runner** (or cron plus a script) on a laptop or Raspberry Pi in India. It runs the same ingest job and pushes to Supabase. GitHub Actions orchestrates it, and the relay supplies the IP.
5. **Fixtures**: commit a recorded corpus (a few weeks of announcements plus PDFs for 20 stocks, plus ARs and transcripts for 3–5 companies) so the **demo never depends on live NSE**. The ingest code path is the same, just with `source=fixture`.
6. Monitoring: if zero announcements arrive in a trading-day window, raise an alert (email via Supabase or GitHub issue).
7. Real deployment: a licensed exchange or vendor feed.

### 8.2 Recommended stack (all $0)

- **Frontend:** Next.js PWA (mobile-first) on **Vercel Hobby**. API routes in TypeScript, or Python functions for parsing.
- **DB, Auth, Storage, vectors:** **Supabase Free**: Postgres, pgvector, Auth (OTP), RLS, and small Storage.
- **Blob cache:** **Cloudflare R2**, 10 GB, for raw PDFs and parsed JSON, keyed by `sha256`.
- **Schedulers and long jobs:** **GitHub Actions**. A cron every 30 min during market hours for ingest (accepting jitter). An EOD job at 16:30 IST (threshold alerts plus digest). Daily, weekly and monthly digests. `workflow_dispatch` runs Pull for non-cached tickers (parse plus map-extract can exceed 300 s).
- **Heavy parsing (optional):** **Modal** ($30 credits) for Docling or OCR, or simply GitHub Actions.
- **LLM:** Anthropic API (Haiku, Sonnet and Opus 5.5), with Batch for nightly work.
- **Notifications:** Web Push from the PWA, plus email (Resend's free tier [unverified]).

**What would change the choice:**
- Intraday alerts with **sub-5-minute latency** → Vercel Pro ($20) cron, or a small always-on VM in India (Lightsail Mumbai ≈ $5 [unverified]), which also fixes the NSE IP problem.
- A commercial launch → Vercel Pro (Hobby is non-commercial [unverified]), Supabase Pro ($25, no pausing, backups), a PyMuPDF commercial licence or switching to pypdfium2.
- Many users and more than 50 companies parsed → the DB outgrows 500 MB. Move page text to R2 and keep only embeddings and metadata in Postgres, or upgrade.
- Data residency or enterprise customers → AWS Mumbai (Bedrock Claude), a DPA, and ZDR.

---

## 9. Agent design: where an agent is actually warranted

| Flow | Pattern | Why |
|---|---|---|
| Push ingest → classify → extract → digest | **Deterministic pipeline** (cron DAG) with LLM functions as steps | Fixed shape, high volume, needs idempotency and retries. An agent adds cost and nondeterminism. |
| Results extraction | Deterministic: XBRL parse, then code arithmetic. LLM fallback on PDF. | Numbers must be exact. |
| Management-change bio → network match | Deterministic extraction (Haiku, structured), then the deterministic ER from §5 | Auditability and privacy. |
| **Pull report** | **Fixed DAG with fan-out**: resolve ticker → discover docs (AR from NSE AR page; transcripts from announcements filtered on the "Analysts/Institutional Investor Meet/Con. Call Updates" category plus a Haiku "is this a transcript?" check) → parse → map (per doc) → verify → reduce → narrative with citations | The steps are known up front. Parallel map calls fit inside 300 s, or run in GitHub Actions. Only doc discovery has fuzziness, and Haiku handles that as a classifier, not an agent. |
| **Ask** ("Who in my network knows the new CFO of X?", "Did X deliver on margin guidance and who can I call about it?") | **One tool-using agent** (Sonnet 5.5) with about 6 tools: `search_filings(ticker, q)`, `get_guidance(ticker)`, `get_financials(ticker, period)`, `find_people(q)`, `network_paths(person_id, max_hops=2)`, `start_pull(ticker)` (async) | The query shape is open-ended and spans network, filings and reports. A planner-executor loop is warranted here, with a cap of about 6 tool calls and pseudonymised network tool outputs. |

Keep it simple. One agent loop, using the plain Anthropic tool-use API (or the Agent SDK). No multi-agent framework.

---

## 10. Cost model

**Prices (from the brief):** Haiku 5.5 $0.10 in / $0.50 out per MTok (≤100K prompt). Sonnet 5.5 $2 / $10, cache read ≈ $0.20. Opus 5.5 $4 / $20. Batch −50%. Batch and caching multipliers stack (https://platform.claude.com/docs/en/about-claude/pricing). Cache *write* premiums (≈1.25× for 5-min, 2× for 1-hour on current Anthropic models) are assumed [unverified for the 5.5 models] and ignored below where small.

**Token assumptions (est.):** a transcript page ≈ 700 text tokens, so a 30-page transcript ≈ 21K. An AR page ≈ 1,000 text tokens, so a 300-page AR ≈ 300K. Native-PDF mode adds about 1,000–1,600 image tokens per page, roughly 2.5–3× more.

### (a) Daily digest, 20 stocks (assume 40 announcements/day, 1 results filing, 0.2 management changes)

| Step | Model | Math | $/day |
|---|---|---|---|
| Classify plus a one-line summary for all 40 (rules handle many, but say Haiku sees all) | Haiku | 40 × (2,500 in × $0.10/M + 150 out × $0.50/M) = 40 × ($0.00025 + $0.000075) | **$0.013** |
| Results extraction | XBRL + code | — | **$0.000** |
| (fallback) results PDF, 15 pp | Haiku | 22.5K × $0.10/M + 1.5K × $0.50/M | ($0.003) |
| (fallback, escalation) | Sonnet | 22.5K × $2/M + 1.5K × $10/M | ($0.060) |
| Management-change bio | Haiku | 0.2 × (5K × $0.10/M + 0.5K × $0.50/M) | **$0.0002** |
| Digest write-up (40 summaries ≈ 6K plus 2K instructions) | Sonnet | 8K × $2/M + 1.5K × $10/M = $0.016 + $0.015 | **$0.031** |
| Nightly Batch re-classify | Haiku Batch | 40 × $0.000325 × 0.5 | **$0.0065** |
| **Typical total** | | | **≈ $0.05/day** (≈ $1.1/month over 22 trading days) |
| Worst case (results season: 5 results/day, all escalated to Sonnet) | | + 5 × $0.06 | ≈ $0.35/day |
| Haiku-only variant (digest on Haiku: 8K × 0.1/M + 1.5K × 0.5/M = $0.0016) | | | ≈ $0.02/day |

### (b) One full Pull report: 4 transcripts + 1 AR

| Step | Model | Math | $ |
|---|---|---|---|
| Transcript FLS filter (4 × 23K in, 2K out) | Haiku | 4 × (23K × 0.10/M + 2K × 0.50/M) = 4 × ($0.0023 + $0.001) | $0.013 |
| Guidance extraction on candidates (4 × 7K in, 2K out) | Sonnet | 4 × (7K × 2/M + 2K × 10/M) = 4 × ($0.014 + $0.020) | $0.136 |
| *(alt: Sonnet on full transcripts, 4 × 23K in, 3K out)* | Sonnet | 4 × ($0.046 + $0.030) | *($0.304)* |
| Transcript "reported actuals" and KPI extraction | Haiku | 4 × (23K × 0.10/M + 1.5K × 0.50/M) | $0.012 |
| AR section map (4 chunks × 75K, each ≤100K for Haiku pricing; 16K out total) | Haiku | 300K × 0.10/M + 16K × 0.50/M = $0.030 + $0.008 | $0.038 |
| Selected AR table pages via native PDF (10 pp × 2.7K) | Sonnet | 27K × 2/M + 2K × 10/M | $0.074 |
| Reduce: promised vs delivered, plus narrative with citations (35K in, 6K out) | Sonnet | 35K × 2/M + 6K × 10/M = $0.07 + $0.06 | $0.130 |
| Quote verification, arithmetic, citation-coverage check | code | — | $0 |
| Optional entailment judge (30K in, 1K out) | Haiku | | $0.0035 |
| **Total (recommended path)** | | | **≈ $0.41** |
| Pre-computed overnight for watchlist names via Batch (map steps −50%) | | ~$0.27 of map × 0.5 + reduce | **≈ $0.27** |
| *Comparison: long-context stuffing, Opus (384K in, 8K out)* | Opus | 384K × 4/M + 8K × 20/M = $1.54 + $0.16 | *$1.70 per question* |
| *Comparison: long-context stuffing, Sonnet, first question / cached follow-up* | Sonnet | 384K × 2/M = $0.77 / 384K × 0.20/M = $0.077 + output | *$0.78 / $0.09* |
| **"Ask" follow-up** on a completed report (100K cached structured notes plus pages, 10K fresh, 1K out) | Sonnet | 100K × 0.20/M + 10K × 2/M + 1K × 10/M = $0.02 + $0.02 + $0.01 | **$0.05** |

How **caching** helps: re-running or iterating a Pull on the same company during development reads the 84K transcript prefix at $0.20/M instead of $2/M (−90% input). Use the 1-hour TTL for batch and iterative dev runs. How **batching** helps: overnight pre-compute for the 20 watched names (20 × $0.27 ≈ $5.40 per full refresh, once a quarter after transcripts land).

### (c) Eval runs

| Eval set | Math | $ realtime | $ batch |
|---|---|---|---|
| Classification: 300 golden announcements on Haiku | 300 × $0.000325 | $0.10 | $0.05 |
| Results extraction: 20 PDFs (Haiku) vs XBRL ground truth | 20 × $0.003 | $0.06 | $0.03 |
| Guidance extraction: 12 transcripts (3 companies × 4) with hand-labelled guidance | 12 × ($0.0033 + $0.034) | $0.45 | $0.22 |
| Full Pull on 5 companies | 5 × $0.41 | $2.05 | ~$1.35 |
| LLM judge (Sonnet) over 5 reports × ~20 claims (40K in, 3K out each) | 5 × ($0.08 + $0.03) | $0.55 | $0.28 |
| Entity resolution on 200 synthetic pairs | code only | $0 | $0 |
| **Full eval suite** | | **≈ $3.2** | **≈ $1.9** |

Twenty dev iterations ≈ $40–65. With caching of document prefixes on repeated runs, about $25–40. **The whole take-home fits comfortably under $50 of API spend.**

---

## 11. Recommended architecture

### 11.1 Components

1. **Ingest worker** (Python, GitHub Actions cron; residential-relay runner as a fallback): RSS/JSON/BSE fetch → dedupe on `(exchange, seq_id)` / sha256 of the attachment → PDF to R2 → `announcements` row.
2. **Classifier** (rules → Haiku) → `category, priority, summary`.
3. **Extractors**: results (XBRL → `actuals`; PDF fallback), management change (Haiku → `filing_people`), others (summary only).
4. **Entity resolver** (code) → `person_identity` candidates → user confirms in the app.
5. **Digest and alert builder** (GitHub Actions cron at EOD, plus daily, weekly and monthly windows) → `digests` → Web Push and email.
6. **Doc store**: `documents(ticker, type, period, url, sha256, r2_key)`, `doc_pages(doc_id, page_no, text, tsv, embedding)`.
7. **Pull orchestrator** (Vercel route → if cached, return; else dispatch a GitHub Actions job) → map extractors → `guidance_items`, `ar_facts`, `actuals` → reduce → `pull_reports` (JSON plus markdown with citations).
8. **Ask agent** (Vercel route, Sonnet tool use, streamed).
9. **Network service**: imports (CSV, vCard, People API), `contacts, employment, education, interactions, edges`, strength scoring, nudges. All under RLS.
10. **PWA UI**: Today (digest), Alerts, Company (Pull report with tap-to-source citations that open the PDF page), Network (paths, expertise map, nudges), Ask.

### 11.2 Data flow (ASCII)

```
                   ┌───────────────────── PUBLIC DATA PLANE ─────────────────────┐
 NSE RSS/JSON ─┐   │                                                              │
 BSE API ──────┼─► │ Ingest worker (GH Actions cron | India relay runner | fixture)│
 NSE XBRL ─────┤   │   dedupe → R2 (PDF, sha256) → Supabase.announcements          │
 NSE AR page ──┘   │        │                                                     │
                   │        ▼                                                     │
                   │  Classifier: rules(desc) ──► Haiku (residue) ──► Batch recheck│
                   │        │                                                     │
                   │  ┌─────┴───────────┬─────────────────────┬─────────────┐     │
                   │  ▼                 ▼                     ▼             ▼     │
                   │ results:        mgmt_change:          others:      transcripts│
                   │ XBRL→actuals    Haiku bio→            Haiku 1-line  /AR → docs│
                   │ (PDF fallback)  filing_people         summary       + pages   │
                   └──────┬─────────────┬──────────────────────┬────────────┬─────┘
                          │             │                      │            │
                          │             ▼                      │            ▼
                          │   ┌──── PRIVATE PLANE (RLS, per investor) ───┐  PULL (on demand / nightly batch)
                          │   │ Entity resolver (code):                  │  parse(PyMuPDF/pdfplumber/Docling)
                          │   │  normalise→block→rapidfuzz→context→      │  → MAP: Haiku FLS filter
                          │   │  confidence → user confirm               │         Sonnet guidance JSON
                          │   │ contacts/employment/edges/notes(enc)     │         Haiku AR sections
                          │   │ strength + nudges (event-triggered)      │  → VERIFY: quote match, units,
                          │   └──────────────┬───────────────────────────┘     arithmetic (code)
                          ▼                  ▼                                → REDUCE: Sonnet + Citations
                   Digest/EOD builder (GH Actions) ──► Web Push / email          (page-block docs)
                          │                                                     → pull_reports
                          ▼                                                          │
               ┌──────────────────────── Next.js PWA on Vercel ─────────────────────┴─┐
               │ Today · Alerts · Company(Pull, tap→PDF page) · Network · Ask          │
               │ Ask agent (Sonnet tools: search_filings, get_guidance, get_financials,│
               │            find_people*, network_paths*, start_pull)  *pseudonymised  │
               └───────────────────────────────────────────────────────────────────────┘
   Storage: Supabase Postgres(+pgvector, Auth, RLS) · Cloudflare R2 (PDFs, parsed JSON, backups)
```

### 11.3 Model routing table

| Task | Model | Mode | Why |
|---|---|---|---|
| Announcement classification (residue after rules) | Haiku 5.5 | realtime; nightly Batch re-check | Simple, high-volume task. ≈$0.0003 each. |
| One-line announcement summary | Haiku 5.5 | realtime | Cheap. Short context. |
| Results line items | none (XBRL) → Haiku → Sonnet escalation | realtime | Exactness. The LLM is only a fallback. |
| Management-change bio extraction | Haiku 5.5, structured outputs | realtime | Templated SEBI format. |
| Transcript forward-looking-statement filter | Haiku 5.5 | realtime / Batch | Binary task with high model agreement (κ > 0.93 in the literature). |
| Guidance extraction (schema) | **Sonnet 5.5**, structured outputs | realtime / Batch overnight | Nuance: conditionality, ranges, scope, revisions. |
| AR section extraction | Haiku 5.5 (≤100K chunks) | Batch where possible | Volume (300K tokens). Haiku pricing applies at ≤100K per prompt. |
| AR table pages that fail validation | Sonnet 5.5, native PDF (selected pages) | realtime | Vision on tables. |
| Promised-vs-delivered narrative | **Sonnet 5.5** + Citations API (custom content, page blocks) | realtime | Reasoning plus guaranteed citation pointers. |
| Daily, weekly and monthly digest prose | Sonnet 5.5 (or Haiku on a budget) | realtime | Quality of the user-facing writing. |
| Ask agent (tool use) | **Sonnet 5.5** | realtime, cached system and tools | Planning and tool calls. Cost-effective. |
| Hard escalations (contradictory guidance, the user asks "explain why") | Opus 5.5 | realtime, rare | Only when Sonnet's confidence is low or the user requests it. |
| Eval judge (entailment) | Haiku 5.5 (Sonnet for spot audits) | Batch | Cheap. Never used for arithmetic. |
| Entity resolution and strength scoring | **No LLM** | — | Privacy, determinism, $0. |

### 11.4 Privacy design (condensed)

Public plane (filings) and private plane (network) are separated at the schema level, and RLS is on every private table. The service key exists only on the server and in CI. Notes use per-user AES-GCM keys (crypto-shredding). Hashed email and phone, minimal fields, no scraping. Imports are explicit and come with a notice. Contacts get a removal path. LLM prompts carry pseudonymous IDs, LLM traffic goes to Anthropic only (no training, 30-day retention), and network data never goes to the Gemini free tier. Audit logs are kept for 1 year. Account deletion is completed within 30 days. DPDP gap list tracked against the ~May 2027 commencement.

---

## 12. Top 5 risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | **NSE blocks cloud IPs or changes undocumented endpoints.** Overseas restrictions, cookie walls, 403s. | Push stops silently. | Multi-source ingest (RSS → JSON → BSE). India residential self-hosted runner. Recorded fixtures for the demo. An ingest-gap alert. Licensed feed for production. |
| 2 | **Wrong numbers**: hallucinated, wrong scale (lakh, crore, million), standalone vs consolidated, restated periods. | Loss of trust, which is fatal for an investor tool. | XBRL as the source of truth. Code computes all deltas. Unit normalisation parsed from table headers. Quote-and-verify with number-in-quote parsing. Show "unverified" rather than guess. Golden-set evals on 20 results. |
| 3 | **Guidance is ambiguous or unmatchable**: vague ("double-digit"), shifting metric definitions, FY vs calendar, mid-year revisions, missing transcripts or scanned PDFs. | A misleading credibility score. | A schema with `guidance_type` and `scope`. Period normalisation. A revision chain (score the latest pre-period guidance). A "not measurable" bucket shown with quotes. An OCR path. Show coverage ("7 of 11 guidance items measurable"). |
| 4 | **Privacy breach or cross-tenant leak** of the investor's network, or PII sent to a training-enabled LLM tier. | Legal exposure under DPDP, reputational damage. | RLS everywhere plus CI isolation tests. Service key server-only. Field encryption. Pseudonymised prompts. Provider allow-list (Anthropic only). Minimisation, retention jobs, audit logs. |
| 5 | **Entity-resolution false positives** on common Indian names. | Embarrassing or wrong nudges ("your friend became CFO"). | Two or more corroborating signals before auto-link. Confidence tiers with one-tap confirmation. DIN when available. Never push a notification on an unconfirmed match. 200-pair synthetic ER test set covering hard cases (initials, transliteration). |
| *6* | *Free-tier fragility*: Supabase pauses after 7 days, GitHub Actions cron jitter or 60-day disablement, Vercel cron once per day, 300 s function cap. | Missed digests, a demo outage. | Daily ingest keeps Supabase awake. Keepalive commits or a manual dispatch. Long jobs go to GitHub Actions. Idempotent jobs. Weekly `pg_dump` to R2. A documented $45/month upgrade path (Vercel Pro plus Supabase Pro). |

---

## 13. Open items / not verified this session

- Exact header row of LinkedIn `Connections.csv` (LinkedIn doesn't document it). Parse defensively.
- Whether `nsearchives.nseindia.com` RSS and PDFs are reachable from GitHub Actions or Vercel IPs. **Test on day 1.**
- Vercel Hobby non-commercial clause, `bom1` region availability on Hobby, GitHub Actions minute quotas, Resend free tier: all from memory.
- DPDP breach-report timeline wording (72 h) and the exact per-rule commencement. Check the Gazette PDF.
- Cache-write multipliers for the 5.5 models.
- Gemini free-tier quotas: undocumented and volatile, so not relied upon.
