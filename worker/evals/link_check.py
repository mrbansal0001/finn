"""Live link check: every page a visitor can reach, every promise's Investigate link, and (with --docs) every
external document FINN links to. Run before a submission or after a deploy.

    uv run python -m evals.link_check                 # site crawl + all promise links (about 3 minutes)
    uv run python -m evals.link_check --docs          # also every transcript/filing PDF (about 8 more minutes)

One visitor session for the whole run (a phone user-agent; the proxy mints one anonymous user, not one per page).
External documents are fetched with the worker's own honest user-agent, one at a time with a pause, and a host
that refuses (401/403/429) is not asked again.
"""
from __future__ import annotations

import asyncio
import html
import re
import sys
import time
from collections import deque
from urllib.parse import quote, urljoin, urlparse

import httpx
from dotenv import dotenv_values

BASE = "https://finn-red.vercel.app"
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
BROKEN = ("This page didn&#x27;t load", ">Nothing here<", "No NSE equity called")


def crawl(c: httpx.Client) -> tuple[list, dict]:
    seen, external, problems = set(), {}, []
    q = deque(["/"])
    while q:
        path = q.popleft()
        if path in seen:
            continue
        seen.add(path)
        for attempt in range(3):
            try:
                r = c.get(urljoin(BASE, path))
                break
            except httpx.HTTPError as e:
                if attempt == 2:
                    problems.append((path, type(e).__name__))
                time.sleep(2)
        else:
            continue
        if r.status_code != 200 or any(b in r.text for b in BROKEN):
            problems.append((path, r.status_code))
        for h in re.findall(r'href="([^"#]+)', r.text):
            u = urlparse(urljoin(BASE + path, html.unescape(h)))
            if u.netloc == urlparse(BASE).netloc:
                if u.path.startswith(("/_next", "/api/")) or re.search(r"\.(png|ico|css|js|webmanifest|json)$", u.path):
                    continue
                p = u.path + (f"?{u.query}" if u.query else "")
                if p not in seen:
                    q.append(p)
            elif u.scheme in ("http", "https"):
                external.setdefault(u._replace(fragment="").geturl(), path)
    print(f"site: {len(seen)} pages, {len(problems)} problems")
    return problems, external


async def promises(env: dict) -> list:
    url, key = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"), env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
    leds = httpx.get(f"{url}/rest/v1/ledgers?select=symbol,payload", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=60).json()
    links = [f"/investigate?c={quote(l['symbol'], safe='')}&p={quote(r['id'], safe='')}&t={quote(r['title'], safe='')}"
             for l in leds for r in l["payload"]["rows"]]
    bad = []
    async with httpx.AsyncClient(headers={"User-Agent": UA}, timeout=60, follow_redirects=True) as c:
        await c.get(BASE + "/")
        sem = asyncio.Semaphore(6)

        async def one(u):
            async with sem:
                for attempt in range(3):
                    try:
                        r = await c.get(BASE + u)
                        if r.status_code != 200 or any(b in r.text for b in BROKEN) or "What changed" not in r.text:
                            bad.append((u, r.status_code))
                        return
                    except httpx.HTTPError as e:
                        if attempt == 2:
                            bad.append((u, type(e).__name__))
                        await asyncio.sleep(2)
        await asyncio.gather(*(one(u) for u in links))
    print(f"promises: {len(links)} Investigate links, {len(bad)} problems")
    return bad


def documents(urls: dict) -> list:
    sys.path.insert(0, "src")
    from finn_worker.fetch import USER_AGENT
    c = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=45, follow_redirects=True)
    bad, refused = [], set()
    for u, src in sorted(urls.items()):
        host = urlparse(u).netloc
        if host in refused:
            continue
        try:
            with c.stream("GET", u) as r:
                head = next(r.iter_bytes(512), b"")
                if r.status_code in (401, 403, 429):
                    refused.add(host)
                ok = r.status_code == 200 and (head.startswith((b"%PDF", b"PK")) or b"<?xml" in head[:50] or b"<xbrl" in head[:400])
                if not ok:
                    bad.append((r.status_code, head[:20], u, src))
        except httpx.HTTPError as e:
            bad.append((type(e).__name__, b"", u, src))
        time.sleep(0.6 if ("nseindia" in host or "bseindia" in host) else 0.2)
    print(f"documents: {len(urls)} checked, {len(bad)} not a readable document" + (f", hosts refused: {refused}" if refused else ""))
    return bad


def main() -> int:
    env = dotenv_values("../.env")
    with httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=60) as c:
        problems, external = crawl(c)
    bad = asyncio.run(promises(env))
    docs = documents(external) if "--docs" in sys.argv else []
    for x in problems + bad + docs:
        print("PROBLEM", x)
    return 1 if problems or bad or docs else 0


if __name__ == "__main__":
    sys.exit(main())
