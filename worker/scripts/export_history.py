"""Export Claude Code session transcripts as readable Markdown (the brief asks for the AI build history).

    uv run python scripts/export_history.py ~/.claude/projects/<project-dir> [out_dir]

Keeps the conversation (user prompts, assistant replies) and a one-line note per tool call
(tool name + its description), not raw tool outputs. Writes to data/history/ (gitignored) so the
owner reviews it before sharing. Redacts anything that looks like a key or an email address.
"""
import json
import re
import sys
from pathlib import Path

SECRET = re.compile(r"(sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJhbGci[0-9A-Za-z._-]{20,}|sb_secret_[A-Za-z0-9_-]+)")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def clean(s: str) -> str:
    return EMAIL.sub("[email]", SECRET.sub("[redacted]", s))


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


def convert(path: Path) -> str:
    out = [f"# Session {path.stem}\n"]
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
            if txt:
                out.append(f"## You\n\n{clean(txt)}\n")
        elif role == "assistant":
            txt = text_of(content).strip()
            if txt:
                out.append(f"**Claude:**\n\n{clean(txt)}\n")
    return "\n".join(out)


def main():
    src = Path(sys.argv[1]).expanduser()
    dst = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "data" / "history"
    dst.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*.jsonl")):
        (dst / f"{f.stem}.md").write_text(convert(f))
        print("wrote", dst / f"{f.stem}.md")


if __name__ == "__main__":
    main()
