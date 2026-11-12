"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHANGED, dropQuestion, readQuestions, type Followed } from "./followed";

type Update = { id: string; symbol: string; kind: string; at: string; headline: string };

const WAIT: Record<string, string> = {
  results: "Waiting for the next results",
  call: "Waiting for the next earnings call",
  filing: "Waiting for a new filing",
};
const KINDS: Record<string, (k: string) => boolean> = {
  results: (k) => k === "results",
  call: (k) => k === "earnings_call",
  filing: () => true,
};

// export timestamps carry no offset and are IST
const ist = (s: string) => Date.parse(/[+Z]/.test(s.slice(10)) ? s : `${s}+05:30`);

/**
 * "Questions you follow", at the top of the edition (creative review §5). Each says whether something
 * it was waiting for has arrived since it was saved. Checked when the page opens; nothing runs in the
 * background, and the page says so.
 */
export function FollowedQuestions({ symbol }: { symbol?: string }) {
  const [list, setList] = useState<Followed[] | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);

  useEffect(() => {
    const load = () => setList(readQuestions().filter((q) => !symbol || q.symbol === symbol));
    load();
    window.addEventListener(CHANGED, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CHANGED, load);
      window.removeEventListener("storage", load);
    };
  }, [symbol]);

  const symbols = [...new Set((list ?? []).map((q) => q.symbol))].sort().join(",");
  useEffect(() => {
    if (!symbols) return;
    const ctl = new AbortController();
    fetch(`/api/updates?s=${encodeURIComponent(symbols)}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setUpdates(d.items ?? []))
      .catch(() => {});
    return () => ctl.abort();
  }, [symbols]);

  if (!list?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const hasNew = (q: Followed) =>
    q.revisit === "date"
      ? !!q.date && q.date <= today
      : updates.some((u) => u.symbol === q.symbol && KINDS[q.revisit](u.kind) && ist(u.at) > Date.parse(q.savedAt));

  // the edition keeps it to one line: how many, and how many have something new (visual review §10)
  if (!symbol) {
    const n = list.filter((q) => (q.status ?? "open") === "open" && hasNew(q)).length;
    return (
      <Link href="/questions" className="mt-4 flex min-h-[48px] items-center justify-between gap-3 rounded-lg border border-rule px-4 text-small">
        <span className="text-ink">
          {list.length} question{list.length === 1 ? "" : "s"} you follow
          {n > 0 ? <span className="font-medium text-accent">: new evidence for {n}</span> : <span className="text-ink-3">, nothing new yet</span>}
        </span>
        <span aria-hidden className="text-ink-3">›</span>
      </Link>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-rule px-4 pb-2 pt-3" aria-labelledby="followed-h">
      <h2 id="followed-h" className="kicker flex items-baseline justify-between text-ink-3">
        <span>Questions you follow</span>
        <span className="num font-normal normal-case tracking-normal">{list.length}</span>
      </h2>
      <ul className="hair mt-1">
        {list.slice(0, symbol ? 5 : 3).map((q) => {
          const hit =
            q.revisit !== "date"
              ? updates.find((u) => u.symbol === q.symbol && KINDS[q.revisit](u.kind) && ist(u.at) > Date.parse(q.savedAt))
              : undefined;
          const due = q.revisit === "date" && q.date && q.date <= today;
          return (
            <li key={q.id} className="py-2.5">
              <div className="flex items-start gap-2">
                <span className="chip mt-0.5 shrink-0">{q.symbol}</span>
                <Link href={q.href} className="line-clamp-2 text-small text-ink hover:underline">
                  {q.question}
                </Link>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 pl-0.5 text-caption">
                {hit ? (
                  <Link href={`/card/${hit.id}`} className="tap min-w-0 truncate font-medium text-accent">
                    New since you saved it: {hit.headline} ›
                  </Link>
                ) : due ? (
                  <span className="font-medium text-ink">Due: you asked to revisit it today</span>
                ) : (
                  <span className="text-ink-3">
                    {q.revisit === "date" && q.date
                      ? `Revisit on ${new Date(q.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                      : WAIT[q.revisit]}
                  </span>
                )}
                <button onClick={() => dropQuestion(q.id)} className="tap shrink-0 text-ink-3 hover:text-ink" aria-label={`Stop following: ${q.question}`}>
                  Stop
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Link href={`/questions?c=${encodeURIComponent(symbol)}`} className="flex min-h-[44px] items-center text-caption text-accent">
        Evidence trail for {list.length === 1 ? "this question" : `these ${list.length} questions`} ›
      </Link>
      <p className="pb-1 pt-1 text-caption text-ink-3">On this device only. Checked when you open FINN; no notifications.</p>
    </section>
  );
}
