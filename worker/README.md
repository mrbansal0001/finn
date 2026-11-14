# FINN worker

Python 3.12, run with `uv`. Reads NSE and BSE files, builds cards, ledgers, passages and trajectories, exports a
snapshot and syncs it to Supabase; sends web push. One cycle: `uv run python -m finn_worker.run once`.

- `ingest.py`, `feeds.py`, `fetch.py`: exchange feeds and files (honest user-agent, disk cache, no retry after a refusal)
- `classify.py`, `cards.py`, `reader.py`: rules-first classification, the model reads filings, cite-or-drop grounding
- `results.py`, `xbrl.py`: results tables checked against the statement's identities and the exchange XBRL
- `pull.py`, `tracking.py`: promises ledger (extract, verify, link, statuses) and freshness refresh
- `passages.py`, `trajectory.py`, `annual.py`: Ask passages, five-year table, business snapshot
- `network.py`: deterministic matching against the (synthetic) network; contact data never goes to a model
- `export.py`, `sync.py`, `push.py`: snapshot, Supabase sync, notifications

Tests: `uv run pytest -q`. Live checks: `evals/rls_check.py`, `evals/link_check.py`. Setup: `../docs/DEPLOY.md`.
