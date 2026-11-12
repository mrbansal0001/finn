"use client";

import { useState } from "react";
import type { CallQuote, Ledger, PromiseRow, PromiseStatus } from "@/lib/types";

/**
 * A promise replayed call by call (creative review §2). One stop per earnings call; above each stop, the
 * target as stated on that call; tap a stop for that call's own words and page. Stops are calls, not values:
 * nothing is plotted on a numeric axis, so a crore figure and a date are never joined as if comparable.
 * "As stated on this call": a later outcome never leaks into an earlier stop.
 */
const STATUS: Record<PromiseStatus, { g: string; word: string; color: string }> = {
  delivered: { g: "●", word: "Delivered", color: "var(--s-delivered)" },
  partly: { g: "◐", word: "Partly delivered", color: "var(--s-partly)" },
  missed: { g: "○", word: "Missed", color: "var(--s-missed)" },
  revised: { g: "↻", word: "Revised", color: "var(--s-revised)" },
  silent: { g: "—", word: "Not mentioned", color: "var(--s-silent)" },
  closed: { g: "◌", word: "Period ended", color: "var(--s-silent)" },
  early: { g: "◦", word: "Stated", color: "var(--s-early)" },
  conflict: { g: "⚠", word: "Conflicting", color: "var(--s-partly)" },
};

type Stop = { call: string; date: string; status: PromiseStatus | null; target: string; changed: boolean; said: boolean; note: string; quote?: CallQuote };

/** The target as stated on a call, from the cell's own note (worker statuses()). */
function targetOf(note: string | undefined, status: PromiseStatus | null): { target: string; said: boolean } {
  if (!status || !note) return { target: "", said: false };
  if (/^open; not revisited|not mentioned now/i.test(note)) return { target: "not mentioned", said: false };
  if (/^period ended/i.test(note)) return { target: "period ended", said: false };
  if (/^management stated/i.test(note)) return { target: "outcome stated", said: true };
  const t = note.includes("→") ? note.split("→").pop()! : note;
  return { target: t.replace(/^(new|reiterated|quantified):\s*/i, "").replace(/↻/g, "").trim(), said: true };
}

export function stopsFor(row: PromiseRow, calls: Ledger["calls"]): Stop[] {
  return calls.map((c) => {
    const cell = row.calls[c.label];
    const status = cell?.status ?? null;
    const { target, said } = targetOf(cell?.note, status);
    // older ledgers carry only the first and latest quotes: use them on their own calls
    const quote =
      cell?.quote ??
      (row.first_quote?.call === c.label ? { text: row.first_quote.text, page: row.first_quote.page, url: row.first_quote.url, speaker: row.first_quote.speaker } : undefined) ??
      (row.latest_quote?.call === c.label ? { text: row.latest_quote.text, page: row.latest_quote.page, url: row.latest_quote.url } : undefined);
    return { call: c.label, date: c.date, status, target, said, changed: status === "revised", note: cell?.note ?? "", quote };
  });
}

export function PromiseReplay({ row, calls }: { row: PromiseRow; calls: Ledger["calls"] }) {
  const stops = stopsFor(row, calls);
  const lastSaid = [...stops].reverse().find((s) => s.quote) ?? stops[stops.length - 1];
  const [sel, setSel] = useState(lastSaid.call);
  const cur = stops.find((s) => s.call === sel) ?? lastSaid;
  const first = stops.find((s) => s.quote);
  const latest = [...stops].reverse().find((s) => s.quote);

  return (
    <div className="mt-3">
      <p className="text-caption text-ink-3">The target as stated on each call. Tap a call to read what was said.</p>
      <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Earnings calls">
        {stops.map((s, i) => {
          const st = s.status ? STATUS[s.status] : null;
          const active = s.call === cur.call;
          const next = stops[i + 1];
          return (
            <div key={s.call} className="relative flex flex-col items-center text-center">
              {/* what was promised, as said then: changed targets are set in ink and marked */}
              <span
                className={`line-clamp-3 min-h-[3.25rem] px-1 text-caption leading-tight ${s.changed ? "font-medium text-ink" : s.said ? "text-ink-2" : "italic text-ink-3"}`}
              >
                {s.target || (s.status ? "" : "not yet stated")}
              </span>
              {/* the rail to the next call: solid when the promise was spoken of, dotted when not */}
              {next && (
                <span
                  aria-hidden
                  className={`absolute left-1/2 top-[calc(3.25rem+26px)] w-full border-t ${next.said ? "border-ink-3" : "border-dashed border-rule"}`}
                />
              )}
              <button
                role="tab"
                aria-selected={active}
                onClick={() => setSel(s.call)}
                disabled={!s.status}
                className={`relative z-10 mt-1 flex size-11 items-center justify-center rounded-full text-headline leading-none transition-colors ${
                  active ? "bg-ink text-paper" : s.status ? "bg-paper-raised ring-1 ring-rule" : "bg-paper"
                }`}
                style={!active && st ? { color: st.color } : undefined}
                aria-label={`${s.call}: ${st ? st.word : "not stated"}${s.target ? `, ${s.target}` : ""}`}
              >
                {st ? st.g : <span className="size-2 rounded-full border border-rule" />}
              </button>
              <span className={`num mt-1.5 text-caption ${active ? "font-medium text-ink" : "text-ink-3"}`}>{s.call}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg bg-tint px-4 py-3" role="tabpanel" aria-live="polite">
        <p className="text-caption text-ink-3">
          On the <span className="num">{cur.call}</span> call
          {cur.status ? (
            <>
              : <span style={{ color: STATUS[cur.status].color }}>{STATUS[cur.status].word.toLowerCase()}</span>
            </>
          ) : null}
        </p>
        {cur.changed && cur.note.includes("→") && <p className="mt-1 text-small font-medium text-ink">{changeSentence(cur.note)}</p>}
        {cur.quote ? (
          <figure className="mt-1.5">
            <blockquote className="font-serif text-body italic text-ink">&ldquo;{cur.quote.text}&rdquo;</blockquote>
            <figcaption className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-ink-3">
              {cur.quote.speaker && <span>{cur.quote.speaker}</span>}
              {cur.quote.url && (
                <a href={`${cur.quote.url}#page=${cur.quote.page}`} target="_blank" rel="noopener noreferrer" className="tap text-accent">
                  transcript p.{cur.quote.page} ↗
                </a>
              )}
            </figcaption>
          </figure>
        ) : (
          <p className="mt-1 text-small text-ink-2">
            {cur.said ? "Stated on this call; the exact words weren't kept for it." : cur.target === "period ended" ? "The period ended and nothing was said about the outcome." : "Not mentioned on this call."}
          </p>
        )}
      </div>

      {first && latest && first.call !== latest.call && first.quote && latest.quote && (
        <details className="group mt-3">
          <summary className="inline-flex min-h-[44px] items-center gap-1 text-small text-accent">
            Compare the first and latest wording <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>
          <div className="grid gap-3 sm:grid-cols-2">
            <Wording label={`First, ${first.call}`} text={first.quote.text} other={latest.quote.text} />
            <Wording label={`Latest, ${latest.call}`} text={latest.quote.text} other={first.quote.text} />
          </div>
          <p className="mt-2 text-caption text-ink-3">Highlighted: figures, dates and periods that appear in one statement and not the other.</p>
        </details>
      )}
    </div>
  );
}

function changeSentence(note: string): string {
  const [a, b] = note.split("→").map((x) => x.replace(/↻/g, "").replace(/\s+date missed$/i, " (date missed)").trim());
  return `Changed from ${a} to ${b}`;
}

// figures, dates and periods: what a revision changes
const TOKEN =
  /(₹\s?[\d,.]+\s?(?:cr(?:ores?)?|crores?|bn|billion|mn|million|lakh)?|[\d,.]*\d\s?(?:%|percent|bps?|x|×|crores?|cr|bn|billion|mn|million|lakh|MW|GW|units?|tonnes?)?|\b(?:Q[1-4]|H[12])\s?(?:FY)?\s?'?\d{0,4}\b|\bFY\s?'?\d{2,4}\b|\b(?:January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b(?:[\s-]?'?\d{2,4})?|\bMay[\s-]'?\d{2,4})/gi;
const norm = (s: string) => s.toLowerCase().replace(/[\s,'₹]/g, "").replace(/crores?|cr/, "cr");

function Wording({ label, text, other }: { label: string; text: string; other: string }) {
  const theirs = new Set([...other.matchAll(TOKEN)].map((m) => norm(m[0])).filter(Boolean));
  const parts: { t: string; mark: boolean }[] = [];
  let i = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (!m[0].trim() || !/\d|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec/i.test(m[0])) continue;
    if (at > i) parts.push({ t: text.slice(i, at), mark: false });
    parts.push({ t: m[0], mark: !theirs.has(norm(m[0])) });
    i = at + m[0].length;
  }
  parts.push({ t: text.slice(i), mark: false });
  return (
    <figure className="rounded-lg border border-rule px-3.5 py-3">
      <figcaption className="num text-caption text-ink-3">{label}</figcaption>
      <blockquote className="mt-1 font-serif text-small italic text-ink-2">
        &ldquo;
        {parts.map((p, k) =>
          p.mark ? (
            <mark key={k} className="rounded-sm bg-accent/15 px-0.5 font-medium not-italic text-ink">
              {p.t}
            </mark>
          ) : (
            <span key={k}>{p.t}</span>
          ),
        )}
        &rdquo;
      </blockquote>
    </figure>
  );
}
