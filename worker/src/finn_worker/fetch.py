"""Polite HTTP fetching with an on-disk cache.

Rules (see docs/research/02-data-sources.md §4):
- honest, descriptive User-Agent; never impersonate a browser
- at least MIN_GAP seconds between requests to the same host
- a 401/403/429 is recorded and raised, never retried or worked around
- every response body is cached under data/raw/, so re-runs cost no requests
"""
from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path
from urllib.parse import urlparse

import httpx

USER_AGENT = "FINN-research-prototype/0.1 (non-commercial evaluation)"
MIN_GAP = 3.0  # seconds between requests to one host
DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "raw"

_last_hit: dict[str, float] = {}
_client: httpx.Client | None = None


class Incomplete(RuntimeError):
    """The server answered 200 with a truncated body; try again next cycle."""


class Refused(RuntimeError):
    """The server refused us. We stop rather than work around it."""


def _http() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(45.0, connect=15.0),
            follow_redirects=True,  # BSE AnnPdfOpen -> AttachHis is a plain 302
        )
    return _client


def cache_path(url: str) -> Path:
    digest = hashlib.sha256(url.encode()).hexdigest()[:20]
    suffix = Path(urlparse(url).path).suffix[:6] or ".bin"
    return DATA_DIR / digest[:2] / f"{digest}{suffix}"


def get(url: str, *, max_age: float | None = None, validate=None) -> bytes:
    """Return the body of `url`, from cache when fresh enough.

    max_age=None means cached forever (filings never change once published);
    pass a number of seconds for feeds that update (RSS, equity list).
    """
    path = cache_path(url)
    if path.exists() and (max_age is None or time.time() - path.stat().st_mtime < max_age):
        return path.read_bytes()

    host = urlparse(url).netloc
    wait = MIN_GAP - (time.monotonic() - _last_hit.get(host, 0.0))
    if wait > 0:
        time.sleep(wait)
    _last_hit[host] = time.monotonic()

    resp = _http().get(url)
    if resp.status_code in (401, 403, 429):
        raise Refused(f"{resp.status_code} from {host} for {url}")
    resp.raise_for_status()
    if validate is not None and not validate(resp.content):
        # an incomplete body (a feed being rewritten mid-download, 12 Nov) is never cached
        raise Incomplete(f"incomplete body from {host} ({len(resp.content)} bytes) for {url}")

    # atomic: a reader never sees a half-written cache file (audit appendix, fetch.py)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(resp.content)
    os.replace(tmp, path)
    return resp.content
