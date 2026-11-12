"use client";

import { useState } from "react";
import type { Ledger, LedgerCell, NetworkLine as Line, PromiseRow, PromiseStatus } from "@/lib/types";
import { NetworkLine } from "./NetworkLine";

/**
 * Promised vs delivered (plan §8.7; D-024, D-047).
 * Default: the promises that need attention as a list — what was promised, its status as a word, one line on
 * what changed, who said it last. "All" groups every promise by status. "History" is the four-call matrix.
 * Status is never colour alone (glyph + word). No composite credibility score.
 */
const STATUS: Record<PromiseStatus, { g: string; word: string; color: string }> = {
  delivered: { g: "●", word: "Delivered", color: "var(--s-delivered)" },
  partly: { g: "◐", word: "Partly", color: "var(--s-partly)" },
  missed: { g: "○", word: "Missed", color: "var(--s-missed)" },
  revised: { g: "↻", word: "Revised", color: "var(--s-revised)" },
  silent: { g: "—", word: "Went silent", color: "var(--s-silent)" },
  closed: { g: "◌", word: "Ended", color: "var(--s-silent)" },
  early: { g: "◦", word: "Open", color: "var(--s-early)" },
  conflict: { g: "⚠", word: "Conflicting", color: "var(--s-partly)" },
};
const LEGEND: PromiseStatus[] = ["delivered", "partly", "missed", "revised", "silent", "closed", "early"];
const LEGEND_WORD: Partial<Record<PromiseStatus, string>> = { silent: "silent", closed: "ended", early: "open" };
const GROUPS: PromiseStatus[] = ["missed", "revised", "conflict", "partly", "silent", "delivered", "closed", "early"];

const EVIDENCE_LABEL: Record<PromiseRow["evidence_source"], string> = {
  filed: "checked against filed numbers",
  "per management": "only management's later statements to check against",
  "not checkable": "not checkable from filings",
};

type View = "attention" | "all" | "history";
const PAGE = 20;

export function PromisesLedger({ ledger: built, verifiers = {} }: { ledger: Ledger; verifiers?: Record<string, Line> }) {
  const [source, setSource] = useState<"built" | "reference">("built");
  const ledger: Ledger =
    source === "reference" && built.reference ? { ...built, ...built.reference, reference: built.reference } : built;
  const [open, setOpen] = useState<string | null>(null);
  const attention = orderRows(ledger.rows.filter(needsAttention));
  const [view, setView] = useState<View>(attention.length ? "attention" : "all");
  const [showAll, setShowAll] = useState(false);
  const counts = countLatest(ledger.rows);
  const toggle = (id: string) => setOpen(open === id ? null : id);
  const verifier = (r: PromiseRow) => verifiers[`${ledger.symbol}:${r.id}`];

  return (
    <section aria-labelledby="promises-h">
      <h2 id="promises-h" className="section-h">
        <span>Promised vs delivered</span>
        <span className="text-caption font-normal normal-case tracking-normal text-ink-3">last {ledger.calls.length} calls</span>
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
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-2" aria-label="Promises by status">
        {LEGEND.filter((s) => counts[s]).map((s) => (
          <li key={s} className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span style={{ color: STATUS[s].color }} aria-hidden className="text-body leading-none">
              {STATUS[s].g}
            </span>
            <span className="num font-medium text-ink">{counts[s]}</span> {LEGEND_WORD[s] ?? STATUS[s].word.toLowerCase()}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Which view">
        {(
          [
            ["attention", "Needs attention", attention.length],
            ["all", "All", ledger.rows.length],
            ["history", "History", null],
          ] as const
        ).map(([k, label, n]) => (
          <button
            key={k}
            aria-pressed={view === k}
            onClick={() => {
              setView(k);
              setShowAll(false);
            }}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-small transition-colors ${
              view === k ? "bg-ink font-medium text-paper" : "border border-rule text-ink-2 hover:text-ink"
            }`}
          >
            {label}
            {n != null && <span className={`num text-caption ${view === k ? "text-paper/70" : "text-ink-3"}`}>{n}</span>}
          </button>
        ))}
      </div>

      {view === "history" ? (
        <Matrix ledger={ledger} open={open} toggle={toggle} verifier={verifier} />
      ) : view === "attention" ? (
        <>
          <ul className="mt-2">
            {(showAll ? attention : attention.slice(0, PAGE)).map((r) => (
              <Item key={r.id} row={r} ledger={ledger} open={open === r.id} onToggle={() => toggle(r.id)} verifier={verifier(r)} />
            ))}
          </ul>
          {attention.length === 0 && <p className="py-4 text-small text-ink-2">Nothing changed, slipped or settled across these calls.</p>}
          {!showAll && attention.length > PAGE && <MoreButton n={attention.length} onClick={() => setShowAll(true)} />}
        </>
      ) : (
        <div className="mt-2">
          {GROUPS.filter((g) => ledger.rows.some((r) => r.latest === g)).map((g) => {
            const rows = orderRows(ledger.rows.filter((r) => r.latest === g));
            const shown = showAll || rows.length <= 8 ? rows : rows.slice(0, 8);
            return (
              <section key={g} className="mt-5">
                <h3 className="kicker flex items-baseline gap-2 text-ink-3">
                  <span style={{ color: STATUS[g].color }} aria-hidden className="text-small leading-none">
                    {STATUS[g].g}
                  </span>
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

      {built.reference && (
        <details className="group mt-6 border-t border-rule">
          <summary className="flex min-h-[48px] items-center justify-between text-small text-ink-2">
            Methodology: compare with the hand-checked reference
            <span aria-hidden className="text-ink-3 transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>
          <div className="flex gap-1.5" role="group" aria-label="Which ledger">
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
                className={`min-h-[44px] rounded-full px-4 text-small ${source === k ? "bg-ink font-medium text-paper" : "border border-rule text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-2 text-caption text-ink-3">
            The reference was labelled by hand from the same transcripts and is what the pipeline is graded on. The ledger above
            is what FINN builds on its own; switching shows the reference in its place.
          </p>
        </details>
      )}
      <p className="mt-4 text-caption text-ink-3">{ledger.provenance}</p>
    </section>
  );
}

/** One promise as a list row: title + status word, what changed, who said it last. The row opens its detail. */
function Item({ row, ledger, open, onToggle, verifier, hideTag }: { row: PromiseRow; ledger: Ledger; open: boolean; onToggle: () => void; verifier?: Line; hideTag?: boolean }) {
  const st = STATUS[row.latest];
  const change = changeLine(row, ledger);
  return (
    <li className="border-b border-rule">
      <button onClick={onToggle} aria-expanded={open} className="block w-full py-3 text-left">
        <span className="flex items-start justify-between gap-3">
          <span className="text-small font-medium text-ink">{promiseTitle(row.title)}</span>
          {!hideTag && (
            <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap text-caption font-medium" style={{ color: st.color }}>
              <span aria-hidden>{st.g}</span>
              {st.word}
            </span>
          )}
        </span>
        {change && <span className="mt-1 block text-caption text-ink-2">{change}</span>}
        {row.tracking && (
          <span className="mt-0.5 block text-caption text-ink-2">
            {row.tracking.label}: <span className="num font-medium text-ink">{row.tracking.value}%</span>
            {row.tracking.verdict ? `, ${row.tracking.verdict === "on track" ? "within" : row.tracking.verdict} the full-year target` : ""}
          </span>
        )}
        <span className="mt-0.5 block text-caption text-ink-3">{lastLine(row, ledger)}</span>
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
            {promiseTitle(row.title)}
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
                  className="min-h-[48px] min-w-[44px] text-headline leading-none"
                  style={{ color: STATUS[s].color }}
                  title={STATUS[s].word}
                  aria-label={`${promiseTitle(row.title)}, ${c.label}: ${cell.missed_then_reset ? "missed, then " : ""}${STATUS[s].word}`}
                >
                  {cell.missed_then_reset ? <span style={{ color: STATUS.missed.color }}>○</span> : null}
                  {STATUS[s].g}
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
      {row.first_quote && (
        <Quote label={`Promised in ${row.first_quote.call}${row.first_quote.speaker ? ` by ${row.first_quote.speaker}` : ""}`} q={row.first_quote} />
      )}
      <ol className="mt-3 space-y-1.5">
        {ledger.calls.map((c) => {
          const cell = row.calls[c.label];
          if (!cell?.status) return null;
          return (
            <li key={c.label} className="grid grid-cols-[4.25rem_1.25rem_1fr] items-baseline gap-1">
              <span className="num text-caption text-ink-3">{c.label}</span>
              <span style={{ color: STATUS[cell.status].color }} aria-hidden>
                {cell.missed_then_reset ? "○" : ""}
                {STATUS[cell.status].g}
              </span>
              <span className="text-ink-2">
                <span className="sr-only">{STATUS[cell.status].word}: </span>
                {cell.missed_then_reset ? "Date missed; new date: " : ""}
                {noteText(cell.note)}
              </span>
            </li>
          );
        })}
      </ol>
      {row.latest_quote && <Quote label={`Latest statement, ${row.latest_quote.call}`} q={row.latest_quote} />}
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
              results table ↗
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
          transcript p.{q.page} ↗
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

/** "NGC order inflow · FY27: ~₹20,000 cr" (worker format) -> "NGC order inflow (FY27): ~₹20,000 cr". */
export function promiseTitle(t: string): string {
  return t.replace(/^(.*?) · ([^:]+): /, "$1 ($2): ").replace(/ · /g, ", ");
}

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

/** a cell note as a sentence: "new: X" -> "Stated: X", "reiterated: X" -> "Restated: X" */
const noteText = (s?: string) =>
  !s ? "" : /^new:/i.test(s) ? `Stated: ${clean(s)}` : /^reiterated:/i.test(s) ? `Restated: ${clean(s)}` : /^quantified:/i.test(s) ? `Now quantified: ${clean(s)}` : sentence(s);
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
