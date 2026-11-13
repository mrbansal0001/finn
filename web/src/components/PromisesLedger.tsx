"use client";

import { useRef, useState } from "react";
import type { Ledger, LedgerCell, NetworkLine as Line, PromiseRow, PromiseStatus } from "@/lib/types";
import { NetworkLine } from "./NetworkLine";
import { PromiseReplay } from "./PromiseReplay";
import { StatusIcon, STATUS_META } from "./StatusIcon";
import { promiseTitle, splitPromise } from "@/lib/investigate";
import { promiseHref } from "@/lib/investigate";
import Link from "next/link";

/**
 * Promised vs delivered (plan §8.7; D-024, D-047).
 * Default: the promises that need attention as a list — what was promised, its status as a word, one line on
 * what changed, who said it last. "All" groups every promise by status. "History" is the four-call matrix.
 * Status is never colour alone (drawn icon + word; StatusIcon). No composite credibility score.
 */
// words for this list (shorter than the replay's); colours and icons come from StatusIcon (13 Nov)
const STATUS: Record<PromiseStatus, { word: string; color: string }> = {
  delivered: { word: "Delivered", color: STATUS_META.delivered.color },
  partly: { word: "Partly", color: STATUS_META.partly.color },
  missed: { word: "Missed", color: STATUS_META.missed.color },
  revised: { word: "Revised", color: STATUS_META.revised.color },
  silent: { word: "Went silent", color: STATUS_META.silent.color },
  closed: { word: "Ended", color: STATUS_META.closed.color },
  early: { word: "Open", color: STATUS_META.early.color },
  conflict: { word: "Conflicting", color: STATUS_META.conflict.color },
};
/** Open but not mentioned on that call: drawn faint (still open, nothing said). */
const carried = (cell?: LedgerCell) => cell?.status === "early" && /^open; not revisited|not mentioned now/i.test(cell.note ?? "");
const LEGEND: PromiseStatus[] = ["delivered", "partly", "missed", "revised", "silent", "closed", "early"];
const LEGEND_WORD: Partial<Record<PromiseStatus, string>> = { silent: "silent", closed: "ended", early: "open" };
const GROUPS: PromiseStatus[] = ["missed", "revised", "conflict", "partly", "silent", "delivered", "closed", "early"];

const EVIDENCE_LABEL: Record<PromiseRow["evidence_source"], string> = {
  filed: "checked against filed numbers",
  "per management": "only management's later statements to check against",
  "not checkable": "not checkable from filings",
};

type View = "attention" | "all" | "history";
// the attention list opens on the five that matter most (status, then how often restated): a reading task
// of 17 before the investor has picked a focus was too much (creative review)
const FIRST = 5;

export function PromisesLedger({ ledger: built, verifiers = {} }: { ledger: Ledger; verifiers?: Record<string, Line> }) {
  const [source, setSource] = useState<"built" | "reference">("built");
  const ledger: Ledger =
    source === "reference" && built.reference ? { ...built, ...built.reference, reference: built.reference } : built;
  const [open, setOpen] = useState<string | null>(null);
  const attention = orderRows(ledger.rows.filter(needsAttention));
  const [view, setView] = useState<View>(attention.length ? "attention" : "all");
  const [showAll, setShowAll] = useState(false);
  const method = useRef<HTMLDetailsElement>(null);
  const counts = countLatest(ledger.rows);
  const toggle = (id: string) => setOpen(open === id ? null : id);
  const verifier = (r: PromiseRow) => verifiers[`${ledger.symbol}:${r.id}`];

  return (
    <section aria-labelledby="promises-h">
      <h2 id="promises-h" className="section-h">
        <span>Promised vs delivered</span>
        {/* the count lives here, not inside a segment, where it clipped at 390px (design review C-a) */}
        <span className="text-caption font-normal normal-case tracking-normal text-ink-3">
          <span className="num">{ledger.rows.length}</span> promises, last {ledger.calls.length} calls
        </span>
      </h2>
      {source === "reference" && (
        <p className="mt-3 rounded-lg bg-tint px-4 py-2.5 text-small text-ink-2">
          Showing the hand-checked reference, not FINN&apos;s own ledger.{" "}
          <button onClick={() => setSource("built")} className="tap font-medium text-accent">
            Back to FINN&apos;s
          </button>
        </p>
      )}

      {/* the honest summary: counts by status, no score */}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-0.5 text-caption text-ink-2" aria-label="Promises by status">
        {LEGEND.filter((s) => counts[s]).map((s) => (
          <li key={s} className="flex items-baseline gap-1.5 whitespace-nowrap">
            <StatusIcon status={s} size={14} className="self-center" />
            <span className="num font-medium text-ink">{counts[s]}</span> {LEGEND_WORD[s] ?? STATUS[s].word.toLowerCase()}
          </li>
        ))}
      </ul>

      {built.reference && (
        <button
          type="button"
          onClick={() => {
            if (method.current) {
              method.current.open = true;
              method.current.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-caption font-medium text-accent"
        >
          <span className="tag !text-accent">Hand-checked reference available</span> <span aria-hidden>›</span>
        </button>
      )}

      <div className="seg mt-4" role="group" aria-label="Which view">
        {(
          [
            ["attention", "Needs attention"],
            ["all", "All"],
            ["history", "History"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            aria-pressed={view === k}
            onClick={() => {
              setView(k);
              setShowAll(false);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "history" ? (
        <Matrix ledger={ledger} open={open} toggle={toggle} verifier={verifier} />
      ) : view === "attention" ? (
        <>
          <ul className="mt-2">
            {(showAll ? attention : attention.slice(0, FIRST)).map((r) => (
              <Item key={r.id} row={r} ledger={ledger} open={open === r.id} onToggle={() => toggle(r.id)} verifier={verifier(r)} />
            ))}
          </ul>
          {attention.length === 0 && <p className="py-4 text-small text-ink-2">Nothing changed, slipped or settled across these calls.</p>}
          {!showAll && attention.length > FIRST && <MoreButton n={attention.length} onClick={() => setShowAll(true)} />}
        </>
      ) : (
        <div className="mt-2">
          {GROUPS.filter((g) => ledger.rows.some((r) => r.latest === g)).map((g) => {
            const rows = orderRows(ledger.rows.filter((r) => r.latest === g));
            const shown = showAll || rows.length <= 8 ? rows : rows.slice(0, 8);
            return (
              <section key={g} className="mt-5">
                <h3 className="kicker flex items-baseline gap-2 text-ink-3">
                  <StatusIcon status={g} size={14} className="self-center" />
                  {STATUS[g].word} <span className="num font-normal">{rows.length}</span>
                </h3>
                <ul className="mt-1">
                  {shown.map((r) => (
                    <Item key={r.id} row={r} ledger={ledger} open={open === r.id} onToggle={() => toggle(r.id)} verifier={verifier(r)} hideTag />
                  ))}
                </ul>
                {shown.length < rows.length && <MoreButton n={rows.length} onClick={() => setShowAll(true)} />}
              </section>
            );
          })}
        </div>
      )}

      {/* reference, not reading matter: how the ledger was built, and the hand-checked comparison (layout plan §5) */}
      <details ref={method} className="group mt-6 scroll-mt-16 border-t border-rule">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-small text-ink-2">
          Methodology and provenance
          <span aria-hidden className="text-ink-3 transition-transform duration-200 group-open:rotate-90">›</span>
        </summary>
        <p className="mb-3 text-caption text-ink-3">{ledger.provenance.replace("Statuses computed in code.", "Statuses follow fixed rules, not a model's judgement.")}</p>
        {built.reference && (
          <>
            <p className="text-caption font-medium text-ink-2">Compare with the hand-checked reference</p>
            <div className="seg seg-sm mt-2" role="group" aria-label="Which ledger">
              {(
                [
                  ["built", "Built by FINN"],
                  ["reference", "Hand-checked reference"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  aria-pressed={source === k}
                  onClick={() => {
                    setSource(k);
                    setOpen(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mb-3 mt-2 text-caption text-ink-3">
              The reference was labelled by hand from the same transcripts and is what the pipeline is graded on. The ledger above is what FINN
              builds on its own; switching shows the reference in its place.
            </p>
          </>
        )}
      </details>
    </section>
  );
}

/** One promise as a list row: title + status word, what changed, who said it last. The row opens its detail. */
function Item({ row, ledger, open, onToggle, verifier, hideTag }: { row: PromiseRow; ledger: Ledger; open: boolean; onToggle: () => void; verifier?: Line; hideTag?: boolean }) {
  const st = STATUS[row.latest];
  // hand-checked notes carry their own ↻ marks; the icon already says "revised"
  const change = changeLine(row, ledger).replace(/\s*↻\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  return (
    <li className="border-b border-rule">
      {/* two lines: what was promised and its status; what changed, and the chevron that opens it. The
          four-call strip lives in History only: on every row it was mostly faint rings (design review L5) */}
      <button onClick={onToggle} aria-expanded={open} className="block w-full py-3 text-left">
        <span className="flex items-start justify-between gap-3">
          <span className="text-small font-medium text-ink">
            <PromiseTitleText title={row.title} />
          </span>
          {!hideTag && (
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap pt-0.5 text-caption font-medium" style={{ color: st.color }}>
              <StatusIcon status={row.latest} size={14} />
              {st.word}
            </span>
          )}
        </span>
        <span className="mt-1 flex items-end justify-between gap-3">
          <span className="min-w-0">
            {change && <span className="block text-caption text-ink-2">{change}</span>}
            {row.tracking && (
              <span className="mt-0.5 block text-caption text-ink-2">
                {row.tracking.label}: <span className="num font-medium text-ink">{row.tracking.value}%</span>
                {row.tracking.verdict ? `, ${row.tracking.verdict === "on track" ? "within" : row.tracking.verdict} the full-year target` : ""}
              </span>
            )}
          </span>
          {/* opens here: the grey chevron that turns (13 Nov tap language), closing the row */}
          <span aria-hidden className="fold shrink-0">›</span>
        </span>
      </button>
      {open && (
        <div className="pb-4">
          <Detail row={row} ledger={ledger} verifier={verifier} />
        </div>
      )}
    </li>
  );
}

/** The four-call matrix (History): 44px rows, 20px glyphs, readable headers. */
function Matrix({ ledger, open, toggle, verifier }: { ledger: Ledger; open: string | null; toggle: (id: string) => void; verifier: (r: PromiseRow) => Line | undefined }) {
  const rows = orderRows(ledger.rows);
  return (
    <table className="mt-3 w-full table-fixed text-small">
      <colgroup>
        <col />
        {ledger.calls.map((c) => (
          <col key={c.label} className="w-[3rem]" />
        ))}
      </colgroup>
      <thead>
        <tr className="kicker text-ink-3">
          <th className="sticky top-0 bg-paper pb-2 text-left font-semibold">Promise</th>
          {ledger.calls.map((c) => (
            <th key={c.label} className="sticky top-0 bg-paper pb-2 text-center font-semibold leading-tight">
              {headerParts(c.label)[0]}
              <br />
              {headerParts(c.label)[1]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <MatrixRow key={row.id} row={row} ledger={ledger} open={open === row.id} onToggle={() => toggle(row.id)} verifier={verifier(row)} />
        ))}
      </tbody>
    </table>
  );
}

function MatrixRow({ row, ledger, verifier, open, onToggle }: { row: PromiseRow; ledger: Ledger; verifier?: Line; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-t border-rule align-middle">
        <td className="pr-2">
          <button onClick={onToggle} aria-expanded={open} className="flex min-h-[48px] w-full items-center py-1.5 text-left text-ink">
            <span>
              <PromiseTitleText title={row.title} />
              <span aria-hidden className="fold ml-1.5">›</span>
            </span>
          </button>
        </td>
        {ledger.calls.map((c) => {
          const cell = row.calls[c.label];
          const s = cell?.status;
          return (
            <td key={c.label} className="text-center">
              {s ? (
                <button
                  onClick={onToggle}
                  className="inline-flex min-h-[48px] min-w-[44px] items-center justify-center"
                  title={`${STATUS[s].word}${carried(cell) ? ", not mentioned on this call" : ""}${cell.missed_then_reset ? " after the old date passed" : ""}`}
                  aria-label={`${promiseTitle(row.title)}, ${c.label}: ${cell.missed_then_reset ? "date missed, then " : ""}${STATUS[s].word}${carried(cell) ? ", not mentioned" : ""}`}
                >
                  <StatusIcon status={s} size={20} faint={carried(cell)} missedFirst={!!cell.missed_then_reset} />
                </button>
              ) : (
                <span aria-label="not stated yet" />
              )}
            </td>
          );
        })}
      </tr>
      {open && (
        <tr>
          <td colSpan={ledger.calls.length + 1} className="pb-4">
            <Detail row={row} ledger={ledger} verifier={verifier} />
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ row, ledger, verifier }: { row: PromiseRow; ledger: Ledger; verifier?: Line }) {
  const settled = ledger.calls.map((c) => row.calls[c.label]).find((c) => c?.evidence);
  return (
    <div className="mt-1 border-l-2 border-rule pl-4 text-small">
      {/* for a settled promise, the comparison comes first, in one sentence */}
      {settled?.note && <p className="mb-2 text-small font-medium text-ink">{sentence(settled.note)}</p>}
      <p className="text-caption text-ink-3">{lastLine(row, ledger)}</p>
      <ChangePath row={row} ledger={ledger} />
      {/* the promise replayed call by call, with each call's own words (creative review §2) */}
      <PromiseReplay row={row} calls={ledger.calls} />
      {ledger.calls.map((c) => {
        const ev = row.calls[c.label]?.evidence;
        if (!ev) return null;
        // the outcome side of the comparison, with its own source (audit F03)
        return (
          <div key={`ev-${c.label}`}>
            <Quote
              label={`Outcome stated in ${ev.call ?? c.label}${ev.speaker ? ` by ${ev.speaker}` : ""}${ev.period ? `, for ${ev.period}` : ""}`}
              q={{ text: ev.quote, page: ev.page, url: ev.url ?? undefined }}
            />
            <p className="mt-1 text-caption text-ink-3">
              Compared only because both sides match: same metric and period, comparable units, a company speaker, and a later call
              than the promise. This is what management said, not a filed figure.
            </p>
          </div>
        );
      })}
      {row.verdict && <p className="mt-3 text-ink-2">{row.verdict}</p>}
      {row.tracking && (
        <p className="mt-3 text-ink-2">
          So far: {row.tracking.metric} was <span className="num font-medium text-ink">{row.tracking.value}%</span> in {row.tracking.label}
          {row.tracking.verdict ? `, ${row.tracking.verdict === "on track" ? "within" : row.tracking.verdict} the full-year target` : ""}. One quarter
          is not the year, so the status stays open.
          {row.tracking.source && (
            <a href={row.tracking.source} target="_blank" rel="noopener noreferrer" className="tap ml-1.5 text-caption text-accent">
              results table ↗︎
            </a>
          )}
        </p>
      )}
      <p className="mt-3 text-caption text-ink-3">Evidence: {EVIDENCE_LABEL[row.evidence_source]}.</p>
      {verifier && (
        <div className="mt-2">
          <p className="text-caption text-ink-3">Who can verify</p>
          <NetworkLine line={verifier} compact />
        </div>
      )}
      <Link
        href={promiseHref(ledger.symbol, row)}
        className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-small font-medium text-accent"
      >
        Investigate this promise <span aria-hidden>›</span>
      </Link>
    </div>
  );
}

function Quote({ label, q }: { label: string; q: { text: string; page: number; url?: string } }) {
  return (
    <figure className="mt-3">
      <figcaption className="text-caption text-ink-3">{label}</figcaption>
      <blockquote className="mt-0.5 font-serif text-body font-normal italic text-ink">&ldquo;{q.text}&rdquo;</blockquote>
      {q.url && (
        <a href={`${q.url}#page=${q.page}`} target="_blank" rel="noopener noreferrer" className="tap mt-1 inline-flex text-caption text-accent">
          transcript p.{q.page} ↗︎
        </a>
      )}
    </figure>
  );
}

function MoreButton({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-1 min-h-[48px] w-full text-small text-accent">
      Show all {n}
    </button>
  );
}

/** Titles come from the shared helpers (capitalised; vague targets as tags). Kept as a re-export for callers. */
export { promiseTitle } from "@/lib/investigate";

/** What changed, in one line, built from the cells' own notes (never from management's framing). */
function changeLine(row: PromiseRow, ledger: Ledger): string {
  const cells = ledger.calls.map((c) => row.calls[c.label]).filter((c): c is LedgerCell => !!c?.status && !!c.note);
  if (!cells.length) return "";
  if (cells.some((c) => c.status === "revised")) {
    const parts: string[] = [];
    let first = "";
    for (const c of cells) {
      const note = clean(c.note!);
      if (c.status === "revised") {
        if (note.includes("→")) {
          const [a, b] = note.split("→").map((x) => x.trim());
          if (!parts.length) parts.push(a);
          parts.push(b);
        } else {
          if (!parts.length && first) parts.push(first);
          parts.push(note);
        }
      } else if (!parts.length && /^(new|quantified):/i.test(c.note!)) {
        first = note;
      }
    }
    if (parts.length) return parts.join(" → ");
  }
  const last = cells[cells.length - 1];
  const note = last.note!;
  if (/^period ended/i.test(note)) {
    const m = note.match(/(\d{4})-(\d{2})/);
    return m ? `Period ended ${monthName(Number(m[2]))} ${m[1]}; no outcome stated` : sentence(note);
  }
  if (/repeated before, not mentioned now/i.test(note)) return "Repeated before, not mentioned on the latest call";
  if (/^open; not revisited/i.test(note)) return "Not revisited since it was stated";
  if (/^reiterated:/i.test(note)) return `Restated: ${clean(note)}`;
  if (/^new:/i.test(note)) return `Stated: ${clean(note)}`;
  if (/^quantified:/i.test(note)) return `Now quantified: ${clean(note)}`;
  return sentence(note);
}

/** "Last said in Nov 2026 by Manoj Jain, on 3 calls" */
function lastLine(row: PromiseRow, ledger: Ledger): string {
  const call = row.latest_quote?.call ?? row.first_quote?.call;
  const speaker = row.latest_quote ? null : row.first_quote?.speaker;
  const stated =
    row.mentions ??
    ledger.calls.filter((c) => {
      const cell = row.calls[c.label];
      return cell?.status && !/not revisited|not mentioned|period ended|no outcome/i.test(cell.note ?? "");
    }).length;
  const said = call ? `Last said in ${call}${speaker ? ` by ${speaker}` : ""}` : "";
  const on = stated ? `${said ? ", on" : "On"} ${stated} call${stated === 1 ? "" : "s"}` : "";
  return `${said}${on}`;
}

const clean = (s: string) => s.replace(/^(new|reiterated|quantified):\s*/i, "").trim();
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const monthName = (m: number) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] ?? "";

/** Two-line column header: "Q3FY26" -> Q3 / FY26; "Feb 2026" -> Feb / '26. */
function headerParts(label: string): [string, string] {
  const q = label.match(/^(Q[1-4])\s?(FY\d{2})$/i);
  if (q) return [q[1], q[2]];
  const m = label.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m) return [m[1], `'${m[2].slice(2)}`];
  return [label.slice(0, 3), label.slice(3)];
}

function countLatest(rows: PromiseRow[]) {
  const c: Partial<Record<PromiseStatus, number>> = {};
  for (const r of rows) c[r.latest] = (c[r.latest] ?? 0) + 1;
  return c;
}

/** Worth the investor's attention: changed, dropped, settled, or with a filed quarter to compare. */
function needsAttention(r: PromiseRow) {
  return (
    !!r.tracking ||
    Object.values(r.calls).some((c) => c.evidence || (c.status && ["missed", "revised", "silent", "partly", "conflict", "delivered"].includes(c.status)))
  );
}

const ORDER: PromiseStatus[] = ["missed", "revised", "conflict", "silent", "partly", "delivered", "closed", "early"];
// status first; within a status, promises restated on more calls, then ones with a figure to check
function orderRows(rows: PromiseRow[]) {
  const noFigure = (r: PromiseRow) => (/: (no figure|direction only)$/.test(r.title) ? 1 : 0);
  return [...rows].sort(
    (a, b) => ORDER.indexOf(a.latest) - ORDER.indexOf(b.latest) || (b.mentions ?? 1) - (a.mentions ?? 1) || noFigure(a) - noFigure(b),
  );
}


/** A promise's title, with a vague target shown as a tag rather than as part of the promise (L4). */
function PromiseTitleText({ title }: { title: string }) {
  const { text, tag } = splitPromise(title);
  return (
    <>
      {text}
      {tag && <span className="tag ml-1.5 align-[1px] font-normal">{tag}</span>}
    </>
  );
}

/** The target as it moved, each step with its call (three-pillars L8): "₹1,000 cr (Jan 2026) → >₹1,200 cr
 *  (May 2026) → ~₹1,200 cr (Nov 2026)". Only when it changed at least once. */
function ChangePath({ row, ledger }: { row: PromiseRow; ledger: Ledger }) {
  const steps: { target: string; call: string }[] = [];
  for (const c of ledger.calls) {
    const cell = row.calls[c.label];
    const note = cell?.note ?? "";
    if (!cell?.status) continue;
    if (/^(new|quantified):/i.test(note)) steps.push({ target: clean(note), call: c.label });
    else if (cell.status === "revised") {
      const [a, b] = note.includes("→") ? note.split("→").map((x) => x.replace(/↻/g, "").trim()) : ["", note.replace(/↻/g, "").trim()];
      if (!steps.length && a) steps.push({ target: a, call: "earlier" });
      steps.push({ target: b, call: c.label });
    }
  }
  if (steps.length < 2) return null;
  return (
    <p className="mt-1 text-small text-ink">
      {steps.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="text-ink-3"> → </span>}
          {s.target} <span className="num text-caption text-ink-3">({s.call})</span>
        </span>
      ))}
    </p>
  );
}
