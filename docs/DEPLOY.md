# Going live: checklist

About 15 minutes. Everything except steps 1–3 can be done by the agent once the keys exist.

## 1. Model keys → `~/finn/.env`
```
GEMINI_API_KEY=...        # aistudio.google.com → Get API key (free tier)
OPENAI_API_KEY=...        # paid key; the worker caps spend at OPENAI_BUDGET_USD (default 4.0)
```
Never paste keys into chat or commit them; `.env` is gitignored.

## 2. Supabase (free)
1. supabase.com → New project, name `finn`, region **Mumbai (ap-south-1)**.
2. SQL editor → run `supabase/migrations/001_init.sql`, then `002_universe_requests.sql`.
3. Authentication → Sign In / Providers → enable **Anonymous sign-ins** (reviewers get a private session without signing up).
4. Project Settings → API keys → copy into `~/finn/.env`:
```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...      # worker only, never in the browser
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## 3. Vercel (free)
1. vercel.com → Add New → Project → import `mrbansal0001/finn`.
2. **Root directory: `web`**. Framework: Next.js (auto).
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy. The app needs Supabase in production (there is no local `data/` folder on Vercel).

## 4. First sync (agent)
```
cd ~/finn/worker
uv run python -m finn_worker.run once     # feeds, results, read filings, export, sync to Supabase
uv run python -m evals.eval_extraction    # model extraction vs the hand-labelled gold set
```

## 5. Keep the worker running
Either keep a terminal session running the cycle, or install the provided launchd job yourself:
```
cp ~/finn/worker/ops/com.finn.worker.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.finn.worker.plist
```
Supabase free projects pause after 7 days without activity. The worker's sync every 15 minutes keeps it active.

## 6. Optional
- GitHub → Settings → Billing: clear the billing lock to re-enable Actions (the reachability probe in `.github/workflows/` then tells us whether ingest could run in the cloud).
