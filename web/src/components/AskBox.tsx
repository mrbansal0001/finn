"use client";

import { useEffect, useRef, useState } from "react";
import type { AskHit, AskResult, AskSource } from "@/lib/ask";
import { VoiceButton } from "./VoiceButton";

// Ask the documents (brief-check plan, part 5): a question about this company, answered only with its own
// words. Every line the app writes around the quotes is a fixed sentence; the quotes are as filed.

const ROLE: Record<string, string> = { m: "for the company", a: "analyst", r: "", "": "" };

export function AskBox({ symbol, name, examples, initial }: { symbol: string; name: string; examples: string[]; initial?: string }) {
  const [q, setQ] = useState(initial ?? "");
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AskResult | null>(null);
  const ran = useRef(false);

  async function run(question: string) {
    const text = question.trim();
    if (!text) return;
    setBusy(true);
    setAsked(text);
    try {
      const r = await fetch(`/api/ask?c=${encodeURIComponent(symbol)}&q=${encodeURIComponent(text)}`);
      setRes((await r.json()) as AskResult);
    } catch {
      setRes({ status: "unavailable" });
    } finally {
      setBusy(false);
    }
  }

  // arriving with ?ask= (from the dock) asks straight away
  useEffect(() => {
    if (initial && !ran.current) {
      ran.current = true;
      void run(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  return (
    <section id="ask-docs" className="mt-12 scroll-mt-16" aria-labelledby="ask-h">
      <h2 id="ask-h" className="section-h">
        <span>Ask the documents</span>
      </h2>
      <p className="mt-1 text-small text-ink-2">
        Answered only with {name}{name.endsWith("s") ? "’" : "’s"} own words, from its last four calls and its annual report. If they don&apos;t say, FINN says so.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <label htmlFor="ask-q" className="sr-only">
            Your question about {name}
          </label>
          <input
            id="ask-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={200}
            enterKeyHint="search"
            placeholder="e.g. what did they say about margins?"
            className="h-11 w-full rounded-lg border border-rule bg-paper-raised pl-3.5 pr-11 text-body placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <VoiceButton
            onText={(t, final) => {
              setQ(t);
              if (final) void run(t);
            }}
          />
        </div>
        <button type="submit" disabled={busy} className="inline-flex h-11 min-w-[64px] items-center justify-center rounded-lg bg-ink px-4 text-small font-medium text-paper disabled:opacity-70">
          {busy ? <span className="spinner" style={{ borderTopColor: "var(--paper)" }} aria-label="Searching" /> : "Ask"}
        </button>
      </form>
      {!res && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {examples.map((x) => (
            // tap to ask: the entity-chip style (outlined, accent), not the filter pill (design review 5.13)
            <button
              key={x}
              type="button"
              className="chip tap min-h-[36px]"
              onClick={() => {
                setQ(x);
                void run(x);
              }}
            >
              {x}
            </button>
          ))}
        </div>
      )}
      <div aria-live="polite">{res && !busy && <Answer res={res} asked={asked} />}</div>
    </section>
  );
}

function Answer({ res, asked }: { res: AskResult; asked: string }) {
  if (res.status === "unavailable") {
    return <p className="mt-3 text-small text-ink-2">Asking isn&apos;t switched on yet: the documents haven&apos;t been indexed on this server.</p>;
  }
  if (res.status === "empty") {
    return <p className="mt-3 text-small text-ink-2">FINN hasn&apos;t indexed this company&apos;s documents yet. It does once a promises ledger is built.</p>;
  }
  const searched = res.sources.filter((s) => s.n > 0);
  const unread = res.sources.filter((s) => s.n === 0);
  const docs = describe(searched);
  return (
    <div className="mt-4">
      {/* the one framing sentence, written by rule */}
      <p className="text-small text-ink">
        {res.status === "answer" ? (
          <>
            {res.hits.length === 1 ? "One passage" : `${res.hits.length} passages`} in {docs} answer{res.hits.length === 1 ? "s" : ""}{" "}
            <q>{asked}</q>. Quoted as filed.
          </>
        ) : res.status === "partial" ? (
          <>
            <span className="font-medium">The documents don&apos;t say this directly.</span> No passage in {docs} covers enough of{" "}
            <q>{asked}</q>. The nearest mentions:
          </>
        ) : (
          <>
            <span className="font-medium">The documents don&apos;t say.</span> Nothing in {docs} speaks to <q>{asked}</q>.
          </>
        )}
      </p>
      {res.hits.length > 0 && (
        <ol className="mt-3 space-y-4">
          {res.hits.map((h) => (
            <Passage key={h.i} h={h} faint={res.status !== "answer"} />
          ))}
        </ol>
      )}
      {unread.length > 0 && (
        <p className="mt-3 text-caption text-ink-3">
          Not searched: {unread.map((s) => s.label).join(", ")} ({unread.length === 1 ? "a scan" : "scans"} with no text FINN can read).
        </p>
      )}
    </div>
  );
}

function Passage({ h, faint }: { h: AskHit; faint: boolean }) {
  return (
    <li className={`border-l-2 pl-3 ${faint ? "border-rule" : "border-accent"}`}>
      <p className="text-caption text-ink-3">
        {h.who ? (
          <>
            <span className="font-medium text-ink-2">{h.who}</span>
            {ROLE[h.role] && <>, {ROLE[h.role]}</>}
          </>
        ) : (
          <span className="font-medium text-ink-2">Annual report</span>
        )}
      </p>
      <blockquote className="mt-1 font-serif text-body text-ink">
        <Marked text={h.snippet.trim()} />
      </blockquote>
      <Cite source={h.source} page={h.page} />
      {h.reply && (
        <div className="mt-3 border-l-2 border-accent pl-3">
          <p className="text-caption text-ink-3">
            The reply: <span className="font-medium text-ink-2">{h.reply.who}</span>, for the company
          </p>
          <blockquote className="mt-1 font-serif text-body text-ink">{h.reply.snippet}</blockquote>
          <Cite source={h.source} page={h.reply.page} />
        </div>
      )}
    </li>
  );
}

function Cite({ source, page }: { source: AskSource; page: number }) {
  return source.url ? (
    <a href={`${source.url}#page=${page}`} target="_blank" rel="noopener noreferrer" className="tap mt-1 inline-flex text-caption text-accent">
      {source.label}, page <span className="num ml-1">{page}</span>&nbsp;↗︎
    </a>
  ) : (
    <p className="mt-1 text-caption text-ink-3">
      {source.label}, page {page}
    </p>
  );
}

/** <<word>> from the search marks the question's words in the passage. */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(<<[^>]+>>)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("<<") ? (
          <mark key={i} className="rounded-sm bg-tint px-0.5 text-ink">
            {p.slice(2, -2)}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function describe(s: AskSource[]): string {
  const calls = s.filter((x) => x.label.endsWith("call")).length;
  const ar = s.find((x) => x.label.includes("annual report"));
  const parts = [calls ? `${calls === 1 ? "one call transcript" : `${words(calls)} call transcripts`}` : "", ar ? `the ${ar.label}` : ""].filter(Boolean);
  return parts.length ? parts.join(" and ") : "its documents";
}

function words(n: number): string {
  return ["no", "one", "two", "three", "four", "five", "six"][n] ?? String(n);
}
