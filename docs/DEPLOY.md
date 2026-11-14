# Deploying FINN from scratch

About 30 minutes. Steps marked **(owner)** need an account or a key; the rest is commands.

## 1. Keys → `~/finn/.env` (owner)

`.env` is gitignored; never paste keys into chat or commit them.

| Name | Needed for | Where |
|---|---|---|
| `GEMINI_API_KEY` | reading filings, transcripts, results tables (free tier first) | aistudio.google.com → Get API key |
| `OPENAI_API_KEY`, `OPENAI_BUDGET_USD` | optional paid fallback when Gemini fails; the worker stops calling it once its logged estimate reaches the budget (an estimate, not a billing cap) | platform.openai.com |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | the worker's writes (never in the browser, never on Vercel) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the app's reads and anonymous sessions | Supabase → Project Settings → API |
| `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | web push (the worker signs notifications) | generate a P-256 pair; put the public key in `web/src/lib/push.ts` too |

## 2. Supabase (owner, free)

1. supabase.com → New project, region **Mumbai (ap-south-1)**.
2. SQL editor → run every migration **in order**:
   `001_init.sql`, `002_universe_requests.sql`, `003_hardening.sql` (read-only private rows, request caps, 14-day purge via pg_cron),
   `004_shared_demo_lines.sql` (shared demo network lines), `005_passages_push.sql` (Ask passages and full-text search, push subscriptions),
   `006_review_hardening.sql` (push endpoints limited to browser push services, visitors may edit only their rules, one-transaction passage replace).
3. Authentication → Sign In / Providers → enable **Anonymous sign-ins**.
4. Copy the keys into `.env` (step 1).

## 3. Vercel (owner, free)

1. Import the GitHub repo; **root directory `web`**; framework Next.js.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only (optionally `CRON_SECRET` for the daily keep-alive in `vercel.json`).
3. Deploy. `vercel.json` clears the build cache on every build (a cached stylesheet once shipped stale).

## 4. First data

```
cd ~/finn/worker
uv sync
uv run python -m finn_worker.run once            # feeds, results, filings, export, sync, passages, push
uv run python scripts/prebuild.py                # optional: pre-build ledgers for the Nifty 50 (model calls)
uv run python -m finn_worker.passages            # Ask passages for every ledger, then:
uv run python -c "from finn_worker import sync; print(sync.passages())"
```

## 5. Check it (no paid calls)

```
uv run pytest -q                                  # worker unit tests
uv run python -m evals.rls_check                  # 23 live row-level-security cases (creates and deletes two test users)
uv run python -m evals.link_check                 # every page, every promise link (add --docs for every source document)
cd ../web && npx tsc --noEmit -p . && npx eslint src && npm run build
```
`evals/eval_extraction.py` re-runs model extraction against the hand-labelled set: it makes model calls, so run it deliberately.

## 6. Keep the worker running

The worker runs on a Mac (NSE and BSE refuse datacenter requests). Install the launchd job once:
```
cp ~/finn/worker/ops/com.finn.worker.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.finn.worker.plist
```
It runs every 15 minutes while you are logged in and the Mac is awake; it starts again by itself after a restart.
Keep the Mac plugged in, with "Prevent automatic sleeping on power adapter when the display is off" on (System
Settings → Battery → Options). Logs: `data/logs/worker.log`.

## 7. Notifications

Visitors switch them on in What counts. Test a real device after subscribing:
```
uv run python -m finn_worker.push test
```
