# FINN web

Next.js 16 (App Router, cache components) PWA, deployed on Vercel with root directory `web`. Reads the public
snapshot and the visitor's private network rows from Supabase; without Supabase env vars it reads the worker's
local export in `../data` (development).

```
npm install
npm run dev            # http://localhost:3000
npx tsc --noEmit -p . && npx eslint src && npm run build
```

Routes: `/` edition, `/c/[symbol]` company, `/card/[id]` filing, `/investigate`, `/research`, `/people`,
`/people/[id]`, `/questions`, `/settings`. APIs: `/api/search`, `/api/network`, `/api/ask`, `/api/updates`,
`/api/keepalive`. Setup: `../docs/DEPLOY.md`.
