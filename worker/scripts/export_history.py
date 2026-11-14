"""Export Claude Code session transcripts as readable Markdown (the brief asks for the AI build history).

    uv run python scripts/export_history.py ~/.claude/projects/<project-dir> [out_dir]

Keeps the conversation (user prompts, assistant replies, with the model that wrote each reply) and a one-line
note per tool call (tool name + its description), not raw tool outputs. Model switches and the automatic
context summaries are labelled as such. Redacts anything that looks like a key or an email address.

    uv run python scripts/export_history.py ~/.claude/projects/<project-dir> ../docs/history --combined
writes one Markdown file per session plus FINN-AI-build-history.md (all sessions, oldest first, with an overview).
"""
import json
import re
import sys
from pathlib import Path

SECRET = re.compile(r"(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJhbGci[0-9A-Za-z._-]{20,}|sb_secret_[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+|_vercel_share=[A-Za-z0-9]+)")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


ROLL = re.compile(r"\broll(?: no\.?| number)?\s*\d{5,7}\b", re.I)
IDE = re.compile(r"<ide_[a-z_]+>.*?</ide_[a-z_]+>", re.S)


def clean(s: str) -> str:
    """Keys, email addresses and a student roll number never leave the machine; IDE notices are noise."""
    return ROLL.sub("roll [redacted]", EMAIL.sub("[email]", SECRET.sub("[redacted]", IDE.sub("", s)))).strip()


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    parts = []
    for b in content or []:
        if not isinstance(b, dict):
            continue
        if b.get("type") == "text":
            parts.append(b["text"])
        elif b.get("type") == "tool_use":
            inp = b.get("input", {})
            desc = inp.get("description") or inp.get("prompt", "")[:120] or inp.get("file_path") or ""
            parts.append(f"> _tool: {b.get('name')}_ — {str(desc).strip()[:200]}")
    return "\n\n".join(parts)


MODEL_NAMES = {"claude-opus-5-5": "Opus 5.5", "claude-fable-5-1": "Fable 5.1", "claude-fable-5-2": "Fable 5.2",
               "claude-sonnet-5-5": "Sonnet 5.5", "claude-haiku-5-5": "Haiku 5.5"}


ALIASES = {"opus": "Opus 5.5", "fable": "Fable 5.1", "sonnet": "Sonnet 5.5", "haiku": "Haiku 5.5"}


def model_name(m: str | None) -> str:
    if not m:
        return ""
    if m.lower() in ALIASES:
        return ALIASES[m.lower()]
    for k, v in MODEL_NAMES.items():
        if m.startswith(k):
            return v
    return m


def stats(path: Path) -> dict:
    """First and last timestamp, prompts typed, replies per model, tool calls."""
    first = last = None
    prompts, tools, models = 0, 0, {}
    for line in path.read_text(errors="replace").splitlines():
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = d.get("timestamp")
        if ts:
            first, last = first or ts, ts
        msg = d.get("message") if isinstance(d.get("message"), dict) else {}
        if msg.get("role") == "assistant":
            m = model_name(msg.get("model"))
            if m and m != "<synthetic>":
                models[m] = models.get(m, 0) + 1
            tools += sum(1 for b in msg.get("content") or [] if isinstance(b, dict) and b.get("type") == "tool_use")
        elif msg.get("role") == "user" and not d.get("isMeta"):
            c = msg.get("content")
            if isinstance(c, str) or (isinstance(c, list) and any(isinstance(b, dict) and b.get("type") == "text" for b in c)):
                txt = text_of(c)
                if txt.strip() and "<command-name>" not in txt and "This session is being continued" not in txt and "<task-notification>" not in txt:
                    prompts += 1
    return {"first": first, "last": last, "prompts": prompts, "tools": tools, "models": models}


def convert(path: Path) -> str:
    st = stats(path)
    mix = ", ".join(f"{k}: {v} replies" for k, v in sorted(st["models"].items(), key=lambda x: -x[1]))
    out = [f"# Session {path.stem}\n",
           f"{(st['first'] or '')[:16].replace('T', ' ')} to {(st['last'] or '')[:16].replace('T', ' ')} UTC. "
           f"{st['prompts']} prompts typed, {st['tools']} tool calls. Models: {mix or 'n/a'}.\n"]
    last_model = None
    switched_to = None      # the last switch written, so a repeated /model record isn't written twice
    for line in path.read_text(errors="replace").splitlines():
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        msg = d.get("message")
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        content = msg.get("content")
        if role == "user":
            # skip tool results and system reminders; keep what the person typed
            if isinstance(content, list) and all(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                continue
            txt = re.sub(r"<system-reminder>.*?</system-reminder>", "", text_of(content), flags=re.S).strip()
            if not txt or "<task-notification>" in txt or "<local-command-caveat>" in txt and "<command-name>" not in txt:
                continue
            m = re.search(r"<command-name>/?(\w+)</command-name>.*?<command-args>(.*?)</command-args>", txt, re.S)
            if m:
                if m.group(1) == "model":
                    to = model_name(m.group(2).strip()) or m.group(2).strip()
                    if to != switched_to:
                        out.append(f"_— model switched to {to} —_\n")
                        switched_to = to
                continue
            if txt.startswith("This session is being continued from a previous conversation"):
                out.append("<details><summary>Automatic context summary (the session ran out of context and continued)</summary>\n\n"
                           f"{clean(txt)}\n\n</details>\n")
                continue
            out.append(f"## You\n\n{clean(txt)}\n")
        elif role == "assistant":
            txt = text_of(content).strip()
            m = model_name(msg.get("model"))
            if txt and m != "<synthetic>":
                label = f"**Claude ({m}):**" if m and m != last_model else "**Claude:**"
                last_model = m or last_model
                out.append(f"{label}\n\n{clean(txt)}\n")
    return "\n".join(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = Path(args[0]).expanduser()
    dst = Path(args[1]).expanduser() if len(args) > 1 else Path(__file__).resolve().parents[2] / "data" / "history"
    dst.mkdir(parents=True, exist_ok=True)
    # --skip=<id prefix>,...: sessions that aren't part of this build (a separate coding-practice chat, say)
    skip = [x for a in sys.argv if a.startswith("--skip=") for x in a.split("=", 1)[1].split(",") if x]
    files = sorted((f for f in src.glob("*.jsonl") if not any(f.stem.startswith(k) for k in skip)), key=lambda f: stats(f)["first"] or "")
    parts = []
    for f in files:
        md = convert(f)
        (dst / f"{f.stem}.md").write_text(md)
        parts.append((f, md))
        print("wrote", dst / f"{f.stem}.md", f"{len(md) // 1024} KB")
    if "--combined" in sys.argv:
        total = {}
        for f, _ in parts:
            for k, v in stats(f)["models"].items():
                total[k] = total.get(k, 0) + v
        head = ["# FINN: AI build history\n",
                "Every Claude Code session used to build FINN, oldest first: what I typed, what the model replied (with the "
                "model named where it changes), and one line per tool call. Raw tool outputs are left out; keys and email "
                "addresses are redacted. Automatic context summaries (when a session ran out of context) are folded.\n",
                "How the models were used: Fable 5.1 for research and the interface design plans (the plan documents in "
                "`docs/`), Opus 5.5 for all the backend code, verification and testing. Astra 6 was also used for research "
                "and interface planning outside Claude Code; those conversations are not part of this export.\n",
                "Replies by model across all sessions: " + ", ".join(f"{k} {v}" for k, v in sorted(total.items(), key=lambda x: -x[1])) + ".\n",
                "| Session | Period (UTC) | Prompts | Tool calls | Models |", "|---|---|---|---|---|"]
        for f, _ in parts:
            st = stats(f)
            head.append(f"| `{f.stem[:8]}` | {(st['first'] or '')[:10]} to {(st['last'] or '')[:10]} | {st['prompts']} | {st['tools']} | "
                        + ", ".join(f"{k} {v}" for k, v in st["models"].items()) + " |")
        combined = "\n".join(head) + "\n\n---\n\n" + "\n\n---\n\n".join(md for _, md in parts)
        (dst / "FINN-AI-build-history.md").write_text(combined)
        print("wrote", dst / "FINN-AI-build-history.md", f"{len(combined) // 1024} KB")
        # the same history in parts under ~380 KB, cut at a prompt, so GitHub renders each page; README indexes them
        body = "\n\n---\n\n".join(md for _, md in parts)
        chunks, cur = [], ""
        for block in re.split(r"(?=^## You$)", body, flags=re.M):
            if cur and len(cur) + len(block) > 380_000:
                chunks.append(cur)
                cur = ""
            cur += block
        chunks.append(cur)
        index = head + ["", "Read it in order:", ""]
        for n, ch in enumerate(chunks, 1):
            first = re.search(r"^## You\n\n(.{0,90})", ch, re.M | re.S)
            name = f"part-{n:02d}.md"
            (dst / name).write_text(f"# FINN build history, part {n} of {len(chunks)}\n\n" + ch)
            index.append(f"{n}. [Part {n}]({name}): starts with \u201c{(first.group(1) if first else '').splitlines()[0][:80]}\u2026\u201d")
        index += ["", "The same history as one file: [FINN-AI-build-history.md](FINN-AI-build-history.md)."]
        (dst / "README.md").write_text("\n".join(index) + "\n")
        print(f"wrote {len(chunks)} parts and README.md")


if __name__ == "__main__":
    main()
