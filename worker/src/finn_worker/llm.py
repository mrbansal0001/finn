"""Provider-agnostic structured-output LLM calls (D-025).

Primary: Google Gemini (free tier) for public documents only.
Fallback: OpenAI (paid, hard budget cap) when Gemini is rate-limited or fails.

Rules enforced here, not left to callers:
- every call returns JSON validated against the caller's schema keys
- every call is logged (tokens, model, estimated cost) to the llm_calls table
- OpenAI spend stops at OPENAI_BUDGET_USD
- network/contact data must never be passed in (callers send public filings;
  bios are sent with the person's name replaced -- see people.py)

Model names are discovered from each provider's model list at runtime instead
of being hard-coded, because free-tier model availability changes often.
"""
from __future__ import annotations

import base64
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
from dotenv import load_dotenv

from . import store

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
OPENAI_BASE = "https://api.openai.com/v1"
OPENAI_BUDGET_USD = float(os.getenv("OPENAI_BUDGET_USD", "4.0"))  # of the $5 key, keep $1 slack
# $/MTok used only for the spend cap; set from the provider's price page when known
OPENAI_PRICE_IN = float(os.getenv("OPENAI_PRICE_IN", "0.40"))
OPENAI_PRICE_OUT = float(os.getenv("OPENAI_PRICE_OUT", "1.60"))
GEMINI_MIN_GAP = float(os.getenv("GEMINI_MIN_GAP", "4.5"))  # seconds between calls (free-tier RPM)


class LLMUnavailable(RuntimeError):
    pass


@dataclass
class Part:
    """A piece of input: text, or an image (PNG bytes) for scanned pages."""
    text: str | None = None
    png: bytes | None = None


_http = httpx.Client(timeout=httpx.Timeout(120.0, connect=15.0))
_last_gemini = 0.0
_models: dict[str, list[str]] = {}


# ----------------------------------------------------------------- discovery

def gemini_models() -> list[str]:
    if "gemini" not in _models:
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            _models["gemini"] = []
        else:
            r = _http.get(f"{GEMINI_BASE}/models", headers={"x-goog-api-key": key}, params={"pageSize": 200})
            r.raise_for_status()
            _models["gemini"] = [m["name"].removeprefix("models/") for m in r.json().get("models", [])
                                 if "generateContent" in m.get("supportedGenerationMethods", [])]
    return _models["gemini"]


def pick_gemini(tier: str) -> str | None:
    """tier 'fast' -> newest flash-lite; 'smart' -> newest flash (not pro: free-tier pro caps are tiny)."""
    names = [n for n in gemini_models() if n.startswith("gemini-") and "preview" not in n
             and "exp" not in n and "tts" not in n and "image" not in n and "embedding" not in n]
    want = (lambda n: "flash-lite" in n) if tier == "fast" else (lambda n: "flash" in n and "lite" not in n)
    cands = sorted([n for n in names if want(n)], key=_version_key, reverse=True)
    return cands[0] if cands else None


def _version_key(name: str):
    nums = re.findall(r"\d+(?:\.\d+)?", name)
    return tuple(float(x) for x in nums[:2]) if nums else (0.0,)


def openai_model(tier: str) -> str:
    return os.getenv("OPENAI_MODEL_FAST" if tier == "fast" else "OPENAI_MODEL_SMART", "gpt-4o-mini")


# ----------------------------------------------------------------- calls

def _log(con, purpose, model, tin, tout, cost):
    con.execute("insert into llm_calls (purpose, model, input_tokens, output_tokens, cost_usd) values (?,?,?,?,?)",
                (purpose, model, tin, tout, cost))
    con.commit()


def openai_spent(con) -> float:
    row = con.execute("select coalesce(sum(cost_usd),0) from llm_calls where model like 'openai:%'").fetchone()
    return float(row[0])


def _gemini(model: str, system: str, parts: list[Part], schema: dict) -> tuple[dict, int, int]:
    global _last_gemini
    wait = GEMINI_MIN_GAP - (time.monotonic() - _last_gemini)
    if wait > 0:
        time.sleep(wait)
    _last_gemini = time.monotonic()
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [
            {"text": p.text} if p.text is not None else
            {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(p.png).decode()}}
            for p in parts]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "responseSchema": schema},
    }
    r = _http.post(f"{GEMINI_BASE}/models/{model}:generateContent",
                   headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]}, json=body)
    if r.status_code in (429, 500, 503):
        raise LLMUnavailable(f"gemini {r.status_code}: {r.text[:200]}")
    r.raise_for_status()
    data = r.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise LLMUnavailable(f"gemini returned no content: {str(data)[:300]}")
    usage = data.get("usageMetadata", {})
    return json.loads(text), usage.get("promptTokenCount", 0), usage.get("candidatesTokenCount", 0)


def _openai(model: str, system: str, parts: list[Part], schema: dict) -> tuple[dict, int, int]:
    content = [{"type": "text", "text": p.text} if p.text is not None else
               {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(p.png).decode()}}
               for p in parts]
    body = {
        "model": model, "temperature": 0,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
        "response_format": {"type": "json_schema", "json_schema": {"name": "out", "schema": _openai_schema(schema)}},
    }
    r = _http.post(f"{OPENAI_BASE}/chat/completions",
                   headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"}, json=body)
    r.raise_for_status()
    data = r.json()
    usage = data.get("usage", {})
    return (json.loads(data["choices"][0]["message"]["content"]),
            usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))


def _openai_schema(schema: dict) -> dict:
    """Gemini schemas use upper-case types (OBJECT, STRING); OpenAI wants JSON Schema."""
    s = {k: v for k, v in schema.items() if k not in ("type", "properties", "items", "nullable")}
    t = schema.get("type", "").lower()
    if schema.get("nullable"):
        s["type"] = [t, "null"]
    else:
        s["type"] = t
    if t == "object":
        s["properties"] = {k: _openai_schema(v) for k, v in schema.get("properties", {}).items()}
        s.setdefault("required", list(s["properties"]))
    if t == "array":
        s["items"] = _openai_schema(schema["items"])
    return s


def structured(purpose: str, system: str, parts: list[Part], schema: dict, tier: str = "fast",
               personal_data: bool = False) -> dict:
    """Run one structured extraction. Gemini first, OpenAI on failure (within budget).

    personal_data=True (filings about named people, their bios) skips the Gemini free
    tier, whose terms allow training on inputs and ask users not to send personal
    information, and goes only to the paid API that does not train on inputs (D-025)."""
    con = store.connect()
    errors = []
    gm = pick_gemini(tier) if os.getenv("GEMINI_API_KEY") and not personal_data else None
    if gm:
        try:
            out, tin, tout = _gemini(gm, system, parts, schema)
            _log(con, purpose, f"gemini:{gm}", tin, tout, 0.0)
            return out
        except (LLMUnavailable, httpx.HTTPError, json.JSONDecodeError) as e:
            errors.append(f"gemini: {e}")
    if os.getenv("OPENAI_API_KEY"):
        spent = openai_spent(con)
        if spent >= OPENAI_BUDGET_USD:
            errors.append(f"openai budget reached (${spent:.2f})")
        else:
            om = openai_model(tier)
            out, tin, tout = _openai(om, system, parts, schema)
            cost = tin / 1e6 * OPENAI_PRICE_IN + tout / 1e6 * OPENAI_PRICE_OUT
            _log(con, purpose, f"openai:{om}", tin, tout, cost)
            return out
    raise LLMUnavailable("; ".join(errors) or "no LLM key configured (.env)")
