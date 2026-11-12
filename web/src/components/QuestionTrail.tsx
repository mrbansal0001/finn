"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CHANGED, dropQuestion, readQuestions, updateQuestion, type Followed, type Mark } from "./followed";

type Update = { id: string; symbol: string; kind: string; at: string; headline: string };

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGED, cb);
    window.removeEventListener("storage", cb);
  };
};
const ist = (s: string) => Date.parse(/[+Z]/.test(s.slice(10)) ? s : `${s}+05:30`);
const MATCH: Record<string, (k: string) => boolean> = {
  results: (k) => k === "results",
  call: (k) => k === "earnings_call",
  filing: () => true,
  date: () => false,
};
const REVISIT: Record<string, string> = {
  results: "the next results",
  call: "the next earnings call",
  filing: "any new filing",
  date: "a date you chose",
};
const MARKS: [Mark, string][] = [
  ["supports", "Supports"],
  ["challenges", "Challenges"],
  ["unclear", "Unclear"],
];
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/**
 * Each followed question as an evidence trail (visual review §10): when it was asked and from what, the
 * revisit condition, the investor's own resolution test, then every later document for that company.
 * A new document is "new"; it "matches" only the kind the question waits for; neither is treated as an
 * answer. The investor marks each one, and the question, themselves. Browser-only, and it says so.
 */
export function QuestionTrail() {
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(readQuestions()), () => "null");
  const list = JSON.parse(raw) as Followed[] | null;
  const only = useSearchParams().get("c")?.toUpperCase();
  const shown = (list ?? []).filter((q) => !only || q.symbol === only);
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [failed, setFailed] = useState(false);
  const symbols = [...new Set(shown.map((q) => q.symbol))].sort().join(",");

  useEffect(() => {
    if (!symbols) return;
    const ctl = new AbortController();
    fetch(`/api/updates?s=${encodeURIComponent(symbols)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setUpdates(d.items ?? []))
      .catch((e) => e?.name !== "AbortError" && setFailed(true));
    return () => ctl.abort();
  }, [symbols]);

  if (list === null) return <p className="mt-6 text-caption text-ink-3">Loading…</p>;
  if (!shown.length)
    return (
      <div className="mt-6 rounded-lg bg-tint px-4 py-4 text-small text-ink-2">
        {only ? `No questions followed on ${only}.` : "No questions yet."} Open any lead in the edition, tap Investigate, and follow the question it raises.
        {only && (
          <Link href="/questions" className="mt-2 block text-accent">
            All questions ›
          </Link>
        )}
      </div>
    );

  return (
    <>
      {only && (
        <p className="mt-4 text-small text-ink-2">
          Showing {only}.{" "}
          <Link href="/questions" className="text-accent">
            All questions ›
          </Link>
        </p>
      )}
      <ul className="mt-6 space-y-8">
        {shown.map((q) => {
          const later = (updates ?? []).filter((u) => u.symbol === q.symbol && ist(u.at) > Date.parse(q.savedAt));
          const today = new Date().toISOString().slice(0, 10);
          return (
            <li key={q.id} className="border-t border-ink pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Link href={`/c/${encodeURIComponent(q.symbol)}`} className="chip tap">
                    {q.symbol}
                  </Link>
                  {/* how many you follow on this company, when more than one (layout plan §8) */}
                  {shown.filter((x) => x.symbol === q.symbol).length > 1 && (
                    <span className="text-caption text-ink-3">{shown.filter((x) => x.symbol === q.symbol).length} questions</span>
                  )}
                </span>
                <div className="seg seg-sm" role="group" aria-label="Status">
                  {(["open", "answered"] as const).map((s) => (
                    <button
                      key={s}
                      aria-pressed={(q.status ?? "open") === s}
                      onClick={() => updateQuestion(q.id, { status: s })}
                    >
                      {s === "open" ? "Still open" : "Answered"}
                    </button>
                  ))}
                </div>
              </div>
              <Link href={q.href} className="mt-2 block font-serif text-headline text-ink hover:underline">
                {q.question}
              </Link>

              <ol className="relative mt-4 ml-1.5 border-l border-rule">
                <Point title={`Asked ${fmt(q.savedAt)}`} dot="ink">
                  From{" "}
                  <Link href={q.href} className="text-accent hover:underline">
                    {q.title}
                  </Link>
                </Point>
                <Point title="Waiting for" dot="ink">
                  {q.revisit === "date" && q.date ? `${fmt(q.date + "T12:00:00+05:30")}${q.date <= today ? " (due)" : ""}` : REVISIT[q.revisit]}
                </Point>
                <Point title="What would resolve it (your test)" dot="ink">
                  <Resolve q={q} />
                </Point>
                {failed ? (
                  <Point title="Since you asked" dot="hollow">
                    Couldn&apos;t load the latest filings. Reload to try again.
                  </Point>
                ) : updates === null ? (
                  <Point title="Since you asked" dot="hollow">
                    Checking…
                  </Point>
                ) : later.length === 0 ? (
                  <Point title="Since you asked" dot="hollow">
                    Nothing new filed for {q.symbol} yet.
                  </Point>
                ) : (
                  later.map((u) => {
                    const match = MATCH[q.revisit](u.kind);
                    const mark = q.marks?.[u.id];
                    return (
                      <Point key={u.id} title={`${fmt(new Date(ist(u.at)).toISOString())}: ${match ? "what you were waiting for" : "new document"}`} dot={match ? "accent" : "hollow"}>
                        <Link href={`/card/${u.id}`} className="text-ink hover:underline">
                          {u.headline} <span className="text-accent">›</span>
                        </Link>
                        <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Your reading of it">
                          {MARKS.map(([m, label]) => (
                            <button
                              key={m}
                              aria-pressed={mark === m}
                              onClick={() => updateQuestion(q.id, { marks: { ...(q.marks ?? {}), [u.id]: m } })}
                              className={`min-h-[36px] rounded-full px-3 text-caption ${mark === m ? "bg-tint font-medium text-ink ring-1 ring-ink-3" : "border border-rule text-ink-2"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </Point>
                    );
                  })
                )}
              </ol>
              <div className="mt-1 flex items-center gap-4 text-small">
                <Link href={q.href} className="min-h-[44px] content-center font-medium text-accent">
                  Reopen the investigation ›
                </Link>
                <button onClick={() => dropQuestion(q.id)} className="min-h-[44px] text-ink-3 hover:text-ink">
                  Stop following
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-caption text-ink-3">
        Saved in this browser only. FINN checks for new filings when you open it; it doesn&apos;t send notifications, and a new document is never treated as an
        answer: the marks are yours.
      </p>
    </>
  );
}

function Point({ title, dot, children }: { title: string; dot: "ink" | "accent" | "hollow"; children: React.ReactNode }) {
  return (
    <li className="relative pb-4 pl-5">
      <span
        aria-hidden
        className={`absolute -left-[5px] top-1 size-2.5 rounded-full ${dot === "ink" ? "bg-ink-3" : dot === "accent" ? "bg-accent" : "border border-ink-3 bg-paper"}`}
      />
      <p className="text-caption text-ink-3">{title}</p>
      <div className="mt-0.5 text-small text-ink-2">{children}</div>
    </li>
  );
}

function Resolve({ q }: { q: Followed }) {
  const [text, setText] = useState(q.resolve ?? "");
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <span>
        {q.resolve ? <span className="text-ink">{q.resolve}</span> : <span className="italic text-ink-3">Not set</span>}{" "}
        <button onClick={() => setEditing(true)} className="tap text-caption text-accent">
          {q.resolve ? "Edit" : "Add"}
        </button>
      </span>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        updateQuestion(q.id, { resolve: text.trim() || undefined });
        setEditing(false);
      }}
      className="flex gap-2"
    >
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="What evidence would resolve this?"
        className="min-h-[44px] flex-1 rounded-lg border border-ink-3 bg-paper-raised px-3 text-small focus:border-accent focus:outline-none"
      />
      <button type="submit" className="min-h-[44px] rounded-lg bg-ink px-3 text-small font-medium text-paper">
        Save
      </button>
    </form>
  );
}
