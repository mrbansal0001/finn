"use client";

import { useState } from "react";
import type { CallQuote, Ledger, PromiseRow, PromiseStatus } from "@/lib/types";
import { Mark, StatusIcon, STATUS_META } from "./StatusIcon";

/**
 * A promise replayed call by call (creative review §2; visual review §7). One stop per earnings call: the
 * target as stated then, the marker and the call date are one button. Below, three lanes for the selected
 * call: Said on (quote, speaker, page), Promised for (an exact month, an interval, or no deadline stated) and
 * Evidence of delivery (only what existed by that call: no later outcome leaks into an earlier stop).
 * Stops are calls, not values: nothing is plotted on a numeric axis, so a crore figure and a date are never
 * joined as if comparable. Date promises with two or more readable deadlines also get a calendar lane.
 */
// the replay's own words ("as stated on this call"); icons and colours from StatusIcon (13 Nov)
const STATUS: Record<PromiseStatus, { word: string; color: string }> = {
  delivered: { word: "Delivered", color: STATUS_META.delivered.color },
  partly: { word: "Partly delivered", color: STATUS_META.partly.color },
  missed: { word: "Missed", color: STATUS_META.missed.color },
  revised: { word: "Revised", color: STATUS_META.revised.color },
  silent: { word: "Not mentioned", color: STATUS_META.silent.color },
  closed: { word: "Period ended", color: STATUS_META.closed.color },
  early: { word: "Stated", color: STATUS_META.early.color },
  conflict: { word: "Conflicting", color: STATUS_META.conflict.color },
};

type Deadline = { label: string; from?: number; to?: number; exact: boolean }; // months since year 0
type Stop = {
  call: string; date: string; at?: number; status: PromiseStatus | null; target: string; changed: boolean; said: boolean;
  note: string; quote?: CallQuote; due: Deadline | null; missedFirst: boolean;
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mlabel = (m: number) => `${MON[m % 12]} ${Math.floor(m / 12)}`;

/** "28 Jan 26", "Jan 2026", "Q3FY26" -> months since year 0 (the call's date). */
function callMonth(label: string, date: string): number | undefined {
  const d = date.match(/([A-Za-z]{3})[a-z]*\s+'?(\d{2,4})$/);
  if (d) {
    const y = Number(d[2].length === 2 ? `20${d[2]}` : d[2]);
    const m = MONTHS.indexOf(d[1].toLowerCase());
    if (m >= 0) return y * 12 + m;
  }
  const q = label.match(/^Q([1-4])\s?FY(\d{2})$/i);
  if (q) {
    // results for Qn are discussed in the month after the quarter ends
    const fy = 2000 + Number(q[2]);
    const end = [fy * 12 - 12 + 5, fy * 12 - 12 + 8, fy * 12 - 12 + 11, fy * 12 + 2][Number(q[1]) - 1];
    return end + 1;
  }
  return undefined;
}

/** The deadline a cell's note states, kept at the precision it was said with. */
function deadlineOf(note: string, callAt?: number): Deadline | null {
  if (!note || /^open; not revisited|not mentioned now|^period ended|^management stated/i.test(note)) return null;
  const t = (note.includes("→") ? note.split("→").pop()! : note).replace(/↻/g, "");
  const ym = t.match(/\b(20\d{2})-(\d{2})\b/);
  if (ym) {
    const m = Number(ym[1]) * 12 + Number(ym[2]) - 1;
    return { label: `by ${mlabel(m)}`, to: m, exact: true };
  }
  const q = t.match(/\bQ([1-4])\s?FY'?(\d{2})\b/i);
  if (q) {
    const fy = 2000 + Number(q[2]);
    const start = (fy - 1) * 12 + 3 + (Number(q[1]) - 1) * 3; // Q1 = Apr–Jun of the year before FY's end
    return { label: `Q${q[1]} FY${q[2]} (${MON[start % 12]}–${MON[(start + 2) % 12]} ${Math.floor((start + 2) / 12)})`, from: start, to: start + 2, exact: false };
  }
  const h = t.match(/\bH([12])\s?FY'?(\d{2})\b/i);
  if (h) {
    const fy = 2000 + Number(h[2]);
    const start = (fy - 1) * 12 + 3 + (Number(h[1]) - 1) * 6;
    return { label: `H${h[1]} FY${h[2]} (${mlabel(start)}–${mlabel(start + 5)})`, from: start, to: start + 5, exact: false };
  }
  const fy = t.match(/\bFY'?(\d{2})\b/i);
  if (fy && !/₹|%|\bcr\b/.test(t)) {
    const y = 2000 + Number(fy[1]);
    return { label: `FY${fy[1]} (Apr ${y - 1}–Mar ${y})`, from: (y - 1) * 12 + 3, to: y * 12 + 2, exact: false };
  }
  // a month with no year ("by June-end", "before March"): the next such month after the call
  const mo = t.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/i);
  if (mo && callAt != null && /\bby\b|before|end|maximum|until/i.test(t)) {
    const m = MONTHS.indexOf(mo[1].slice(0, 3).toLowerCase());
    let at = Math.floor(callAt / 12) * 12 + m;
    if (at < callAt) at += 12;
    return { label: `by ${mlabel(at)} (year inferred from the call date)`, to: at, exact: true };
  }
  if (/undated|very soon|soon|no date|unspecified/i.test(t)) return { label: "No deadline stated", exact: false };
  return null;
}

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
    const at = callMonth(c.label, c.date);
    // older ledgers carry only the first and latest quotes: use them on their own calls
    const quote =
      cell?.quote ??
      (row.first_quote?.call === c.label ? { text: row.first_quote.text, page: row.first_quote.page, url: row.first_quote.url, speaker: row.first_quote.speaker } : undefined) ??
      (row.latest_quote?.call === c.label ? { text: row.latest_quote.text, page: row.latest_quote.page, url: row.latest_quote.url } : undefined);
    return { call: c.label, date: c.date, at, status, target, said, changed: status === "revised", note: cell?.note ?? "", quote, due: deadlineOf(cell?.note ?? "", at), missedFirst: !!cell?.missed_then_reset };
  });
}

export function PromiseReplay({ row, calls }: { row: PromiseRow; calls: Ledger["calls"] }) {
  const stops = stopsFor(row, calls);
  const lastSaid = [...stops].reverse().find((s) => s.quote) ?? stops[stops.length - 1];
  const [sel, setSel] = useState(lastSaid.call);
  const cur = stops.find((s) => s.call === sel) ?? lastSaid;
  const curIdx = stops.indexOf(cur);
  const first = stops.find((s) => s.quote);
  const latest = [...stops].reverse().find((s) => s.quote);
  // the deadline in force on the selected call: its own, else the last one stated before it
  const due = [...stops.slice(0, curIdx + 1)].reverse().find((s) => s.due)?.due ?? null;
  const dueFromEarlier = !cur.due && !!due;
  // outcome evidence only from the selected call or earlier ("as stated then")
  const evidence = stops.slice(0, curIdx + 1).map((s) => ({ s, ev: row.calls[s.call]?.evidence })).filter((x) => x.ev).pop();
  const isLast = curIdx === stops.length - 1;
  const dated = stops.filter((s) => s.due && (s.due.to != null));

  return (
    <div className="mt-3">
      <p className="text-caption text-ink-3">The target as stated on each call. Tap a call to read what was said.</p>
      <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Earnings calls">
        {stops.map((s, i) => {
          const st = s.status ? STATUS[s.status] : null;
          const active = s.call === cur.call;
          const next = stops[i + 1];
          return (
            <div key={s.call} className="relative">
              {/* the rail to the next call: solid when the promise was spoken of, dotted when not */}
              {/* the rail starts once the promise exists: calls before it was first stated are left blank */}
              {next && s.status && (
                <span aria-hidden className={`absolute left-1/2 top-[calc(3.25rem+26px)] w-full border-t ${next.said ? "border-ink-3" : "border-dashed border-rule"}`} />
              )}
              {/* one target for the whole column: the stated target, the marker and the call date (§7) */}
              <button
                role="tab"
                aria-selected={active}
                onClick={() => setSel(s.call)}
                disabled={!s.status}
                aria-label={`${s.call}: ${st ? st.word : "not stated"}${s.target ? `, ${s.target}` : ""}`}
                className="relative z-10 flex w-full flex-col items-center rounded-lg pb-1 text-center disabled:cursor-default"
              >
                <span className={`line-clamp-3 min-h-[3.25rem] px-1 text-caption leading-tight ${s.changed ? "font-medium text-ink" : s.said ? "text-ink-2" : "italic text-ink-3"}`}>
                  {s.target || (s.status ? "" : "not stated yet")}
                </span>
                <span
                  className={`mt-1 flex size-11 items-center justify-center rounded-full text-headline leading-none transition-colors ${
                    active ? "bg-ink text-paper" : s.status ? "bg-paper-raised ring-1 ring-rule" : "bg-paper"
                  }`}
                  style={!active && st ? { color: st.color } : undefined}
                  aria-hidden
                >
                  {s.status ? (
                    // the active stop draws in paper on ink; a call that carried it without mentioning it, faint
                    <StatusIcon status={s.status} size={22} color={active ? "var(--paper)" : undefined} faint={!active && !s.said && s.status === "early"} missedFirst={s.missedFirst} />
                  ) : null}
                </span>
                <span className={`num mt-1.5 text-caption ${active ? "font-medium text-ink underline decoration-accent decoration-2 underline-offset-4" : "text-ink-3"}`}>{s.call}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* three lanes for the selected call */}
      <dl className="mt-4 divide-y divide-rule rounded-lg bg-tint px-4" role="tabpanel" aria-live="polite">
        <div className="py-3">
          <dt className="text-caption text-ink-3">
            Said on the <span className="num">{cur.call}</span> call
            {cur.status ? (
              <>
                : <span style={{ color: STATUS[cur.status].color }}>{STATUS[cur.status].word.toLowerCase()}</span>
              </>
            ) : null}
          </dt>
          <dd>
            {cur.changed && cur.note.includes("→") && <p className="mt-1 text-small font-medium text-ink">{changeSentence(cur.note)}</p>}
            {cur.quote ? (
              <figure className="mt-1.5">
                <blockquote className="font-serif text-body italic text-ink">&ldquo;{cur.quote.text}&rdquo;</blockquote>
                <figcaption className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-ink-3">
                  {cur.quote.speaker && <span>{cur.quote.speaker}</span>}
                  {cur.quote.url && (
                    <a href={`${cur.quote.url}#page=${cur.quote.page}`} target="_blank" rel="noopener noreferrer" className="tap text-accent">
                      transcript p.{cur.quote.page} ↗︎
                    </a>
                  )}
                </figcaption>
              </figure>
            ) : (
              <p className="mt-1 text-small text-ink-2">
                {cur.said ? "Stated on this call; the exact words weren't kept for it." : cur.target === "period ended" ? "The period ended and nothing was said about the outcome." : "No mention found on this call. That is not the same as cancelled."}
              </p>
            )}
          </dd>
        </div>
        <div className="py-3">
          <dt className="text-caption text-ink-3">Promised for</dt>
          <dd className="mt-0.5 text-small text-ink">
            {due ? due.label : "No deadline FINN could read from the statement"}
            {dueFromEarlier && <span className="text-ink-3"> (as last stated, before this call)</span>}
          </dd>
        </div>
        <div className="py-3">
          <dt className="text-caption text-ink-3">Evidence of delivery</dt>
          <dd className="mt-0.5 text-small text-ink-2">
            {evidence?.ev ? (
              <>
                Management stated on the {evidence.s.call} call{evidence.ev.period ? `, for ${evidence.ev.period}` : ""}: <span className="font-serif italic text-ink">&ldquo;{evidence.ev.quote}&rdquo;</span>
                {evidence.ev.url && (
                  <a href={`${evidence.ev.url}#page=${evidence.ev.page}`} target="_blank" rel="noopener noreferrer" className="tap ml-1.5 text-caption text-accent">
                    p.{evidence.ev.page} ↗︎
                  </a>
                )}
              </>
            ) : row.tracking && isLast ? (
              <>
                Progress, not a verdict: {row.tracking.metric} was <span className="num font-medium text-ink">{row.tracking.value}%</span> in {row.tracking.label}, a part of the
                period.
              </>
            ) : (
              "No comparable outcome selected."
            )}
          </dd>
        </div>
      </dl>

      {dated.length >= 2 && <Calendar stops={stops} sel={cur.call} onSel={setSel} />}

      {first && latest && first.call !== latest.call && first.quote && latest.quote && (
        <details className="group mt-3">
          <summary className="inline-flex min-h-[44px] items-center gap-1 text-small text-accent">
            Compare the first and latest wording <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>
          <div className="grid gap-3 sm:grid-cols-2">
            <Wording label={`First, ${first.call}`} text={first.quote.text} other={latest.quote.text} targets={`${first.target} ${latest.target}`} />
            <Wording label={`Latest, ${latest.call}`} text={latest.quote.text} other={first.quote.text} targets={`${first.target} ${latest.target}`} />
          </div>
          <p className="mt-2 text-caption text-ink-3">
            Highlighted: the figures, dates and periods of the stated target that differ between the two. A bigger figure isn&apos;t better or worse
            by itself.
          </p>
        </details>
      )}
    </div>
  );
}

/** When it was said, and for when, on one month axis. Intervals stay intervals; no exact date is invented. */
function Calendar({ stops, sel, onSel }: { stops: Stop[]; sel: string; onSel: (c: string) => void }) {
  const ms = stops.flatMap((s) => [s.at, s.due?.from, s.due?.to]).filter((x): x is number => x != null);
  const lo = Math.min(...ms) - 1, hi = Math.max(...ms) + 1;
  const x = (m: number) => `${(100 * (m - lo)) / (hi - lo)}%`;
  const dated = stops.filter((s) => s.due?.to != null);
  const a = dated[0].due!, b = dated[dated.length - 1].due!;
  const moved = a.exact && b.exact && a.to != null && b.to != null && a.to !== b.to ? b.to - a.to : null;
  return (
    <figure className="mt-4">
      <figcaption className="flex items-baseline justify-between text-caption text-ink-3">
        <span>Said on, and promised for</span>
        {moved != null && (
          <span className="num font-medium text-ink">
            {Math.abs(moved)} month{Math.abs(moved) === 1 ? "" : "s"} {moved > 0 ? "later" : "earlier"}, first to latest
          </span>
        )}
      </figcaption>
      <div className="relative mt-2 h-[4.5rem]">
        <span className="absolute inset-x-0 top-[1.1rem] border-t border-rule" aria-hidden />
        <span className="absolute inset-x-0 top-[3.1rem] border-t border-rule" aria-hidden />
        <span className="absolute left-0 top-0 text-label text-ink-3">Said</span>
        <span className="absolute left-0 top-[2rem] text-label text-ink-3">Due</span>
        {stops.map((s) =>
          s.at != null && s.status ? (
            <button
              key={`s${s.call}`}
              onClick={() => onSel(s.call)}
              aria-label={`Said on ${s.call}`}
              className={`absolute top-[1.1rem] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${s.call === sel ? "bg-accent ring-2 ring-accent/30" : "bg-ink-3"}`}
              style={{ left: x(s.at) }}
            />
          ) : null,
        )}
        {dated.map((s) => {
          const d = s.due!;
          const active = s.call === sel;
          return d.from != null ? (
            <button
              key={`d${s.call}`}
              onClick={() => onSel(s.call)}
              aria-label={`${s.call}: due ${d.label}`}
              className={`absolute top-[3.1rem] h-2.5 -translate-y-1/2 rounded-full ${active ? "bg-accent" : "bg-ink-3/50"}`}
              style={{ left: x(d.from), width: `calc(${x(d.to! + 1)} - ${x(d.from)})` }}
            />
          ) : (
            <button
              key={`d${s.call}`}
              onClick={() => onSel(s.call)}
              aria-label={`${s.call}: due ${d.label}`}
              className={`absolute top-[3.1rem] size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 ${active ? "bg-accent" : "bg-ink-3"}`}
              style={{ left: x(d.to!) }}
            />
          );
        })}
      </div>
      {/* month ticks every quarter, with the year at January and at the start */}
      <div className="num relative h-4 text-label text-ink-3" aria-hidden>
        {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
          .filter((m) => m % 3 === 0)
          .map((m, k) => (
            <span key={m} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: x(m) }}>
              {MON[m % 12]}
              {m % 12 === 0 || k === 0 ? ` ’${String(Math.floor(m / 12)).slice(2)}` : ""}
            </span>
          ))}
      </div>
      <p className="mt-1 text-caption text-ink-3">
        Dots: when it was said. <Mark kind="exact" /> an exact month; <Mark kind="interval" /> a quarter, half or year as stated. Undated
        statements aren&apos;t drawn.
      </p>
    </figure>
  );
}

function changeSentence(note: string): string {
  const [a, b] = note.split("→").map((x) => x.replace(/↻/g, "").replace(/\s+date missed$/i, " (date missed)").trim());
  return `Changed from ${a} to ${b}`;
}

// figures, dates and periods: what a revision changes
const TOKEN =
  /(₹\s?[\d,.]+\s?(?:cr(?:ores?)?|crores?|bn|billion|mn|million|lakh)?|[\d,.]*\d\s?(?:%|percent|bps?|x|×|crores?|cr|bn|billion|mn|million|lakh|MW|GW|units?|tonnes?)?|\b(?:Q[1-4]|H[12])\s?(?:FY)?\s?'?\d{0,4}\b|\bFY\s?'?\d{2,4}\b|\b(?:January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b(?:[\s-]?'?\d{2,4})?|\bMay[\s-]'?\d{2,4})/gi;
const norm = (s: string) => s.toLowerCase().replace(/[\s,'₹]/g, "").replace(/crores?|cr/, "cr").replace(/inr/, "");
// the number or month at the heart of a token, to match it against the stated targets
const core = (s: string) => (s.match(/\d[\d,.]*/)?.[0].replace(/,/g, "").replace(/\.0+$/, "") ?? s.toLowerCase().slice(0, 3));

function Wording({ label, text, other, targets }: { label: string; text: string; other: string; targets: string }) {
  const theirs = new Set([...other.matchAll(TOKEN)].map((m) => norm(m[0])).filter(Boolean));
  const inTargets = new Set([...targets.matchAll(TOKEN)].map((m) => core(m[0])));
  const tokens = [...text.matchAll(TOKEN)].filter((m) => m[0].trim() && /\d|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|may/i.test(m[0]));
  const differs = (t: string) => !theirs.has(norm(t));
  // highlight only what belongs to the stated target; if nothing does, fall back to every differing figure
  const relevant = tokens.some((m) => differs(m[0]) && inTargets.has(core(m[0])));
  const parts: { t: string; mark: boolean }[] = [];
  let i = 0;
  for (const m of tokens) {
    const at = m.index ?? 0;
    if (at > i) parts.push({ t: text.slice(i, at), mark: false });
    parts.push({ t: m[0], mark: differs(m[0]) && (!relevant || inTargets.has(core(m[0]))) });
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
