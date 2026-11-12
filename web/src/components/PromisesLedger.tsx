"use client";

import { useState } from "react";
import type { Ledger, NetworkLine as Line, PromiseRow, PromiseStatus } from "@/lib/types";
import { NetworkLine } from "./NetworkLine";

/**
 * Promised vs delivered (research 03 §4.2, §9.4; D-024).
 * Rows = promises, columns = the last 4 calls, cells = status glyph + colour (never
 * colour alone). No composite credibility score: a single number invites false
 * precision. Each row says where its evidence comes from.
 */
const GLYPH: Record<PromiseStatus, { g: string; label: string; color: string }> = {
  delivered: { g: "●", label: "delivered", color: "var(--s-delivered)" },
  partly: { g: "◐", label: "partly", color: "var(--s-partly)" },
  missed: { g: "○", label: "missed", color: "var(--s-missed)" },
  silent: { g: "—", label: "went silent", color: "var(--s-silent)" },
  revised: { g: "↻", label: "revised", color: "var(--s-revised)" },
  early: { g: "·", label: "too early", color: "var(--s-early)" },
  conflict: { g: "⚠", label: "conflicting", color: "var(--s-partly)" },
  closed: { g: "◌", label: "period ended, outcome not stated", color: "var(--s-silent)" },
};

const EVIDENCE_LABEL: Record<PromiseRow["evidence_source"], string> = {
  filed: "checked against filed numbers",
  "per management": "only management's later statements to check against",
  "not checkable": "not checkable from filings",
};

/** Two-line column header: "Q3FY26" -> Q3 / FY26; "Feb 2026" -> Feb / '26. */
function headerParts(label: string): [string, string] {
  const q = label.match(/^(Q[1-4])\s?(FY\d{2})$/i);
  if (q) return [q[1], q[2]];
  const m = label.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (m) return [m[1], `'${m[2].slice(2)}`];
  return [label.slice(0, 3), label.slice(3)];
}

export function PromisesLedger({ ledger: built, verifiers = {} }: { ledger: Ledger; verifiers?: Record<string, Line> }) {
  const [source, setSource] = useState<"built" | "reference">("built");
  const ledger: Ledger =
    source === "reference" && built.reference ? { ...built, ...built.reference, reference: built.reference } : built;
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "slipped">("slipped");
  const [showAll, setShowAll] = useState(false);
  const counts = countLatest(ledger.rows);
  const slipped = ledger.rows.filter((r) => isSlipped(r));
  const ordered = filter === "slipped" && slipped.length ? orderRows(slipped) : orderRows(ledger.rows);
  const rows = showAll ? ordered : ordered.slice(0, PAGE);

  return (
    <section aria-labelledby="promises">
      <h2 id="promises" className="kicker border-b border-ink pb-2">
        Promised vs delivered · last 4 calls
      </h2>
      {source === "reference" && (
        <p className="mt-2 rounded-sm border border-rule px-2 py-1 text-[0.75rem] text-ink-2">
          Showing the hand-checked reference, not FINN&apos;s own ledger.{" "}
          <button onClick={() => setSource("built")} className="min-h-[32px] text-accent">
            Back to FINN&apos;s
          </button>
        </p>
      )}

      <p className="mt-3 text-[0.875rem] text-ink-2">
        {(["delivered", "partly", "revised", "silent", "missed", "closed", "early"] as PromiseStatus[])
          .filter((s) => counts[s])
          .map((s, i) => (
            <span key={s}>
              {i > 0 && <span className="text-ink-3"> · </span>}
              <span style={{ color: GLYPH[s].color }} aria-hidden>
                {GLYPH[s].g}
              </span>{" "}
              {GLYPH[s].label} <span className="num">{counts[s]}</span>
            </span>
          ))}
      </p>

      <div className="mt-3 flex gap-1 text-[0.8125rem]" role="group" aria-label="Which promises">
        {(
          [
            ["slipped", `Needs attention (${slipped.length})`],
            ["all", `All ${ledger.rows.length}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`min-h-[44px] rounded-full px-3 ${filter === k ? "bg-ink text-paper" : "text-ink-2"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <table className="mt-3 w-full table-fixed text-[0.875rem]">
        <colgroup>
          <col />
          {ledger.calls.map((c) => (
            <col key={c.label} className="w-[2.6rem]" />
          ))}
        </colgroup>
        <thead>
          <tr className="text-[0.625rem] uppercase tracking-wider text-ink-3">
            <th className="pb-1 text-left font-medium">Promise</th>
            {ledger.calls.map((c) => (
              <th key={c.label} className="pb-1 text-center font-medium leading-tight">
                {headerParts(c.label)[0]}
                <br />
                {headerParts(c.label)[1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Row key={r.id} row={r} ledger={ledger} verifier={verifiers[`${ledger.symbol}:${r.id}`]} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} />
          ))}
        </tbody>
      </table>
      {ordered.length > rows.length && (
        <button onClick={() => setShowAll(true)} className="mt-2 min-h-[44px] w-full border-t border-rule text-[0.875rem] text-accent">
          Show all {ordered.length} promises
        </button>
      )}

      {built.reference && (
        <details className="mt-4 border-t border-rule pt-1">
          <summary className="inline-flex min-h-[44px] items-center text-[0.8125rem] text-ink-2">
            Methodology: compare with the hand-checked reference
          </summary>
          <div className="flex gap-1 text-[0.8125rem]" role="group" aria-label="Which ledger">
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
                className={`min-h-[44px] rounded-full border border-rule px-3 ${source === k ? "bg-ink text-paper" : "text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.75rem] leading-snug text-ink-3">
            The reference was labelled by hand from the same transcripts and is what the pipeline is graded on. The
            ledger above is what FINN builds on its own; switching shows the reference in its place.
          </p>
        </details>
      )}
      <p className="mt-3 text-[0.75rem] leading-snug text-ink-3">{ledger.provenance}</p>
    </section>
  );
}

function Row({ row, ledger, verifier, open, onToggle }: { row: PromiseRow; ledger: Ledger; verifier?: Line; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-t border-rule align-top">
        <td className="py-2 pr-2">
          <button onClick={onToggle} aria-expanded={open} className="text-left leading-snug text-ink">
            {row.title}
          </button>
          {row.tracking && (
            <span className={`mt-0.5 block text-[0.75rem] ${row.tracking.verdict === "below" ? "text-[color:var(--s-missed)]" : "text-ink-3"}`}>
              {row.tracking.label}: <span className="num">{row.tracking.value}%</span>
              {row.tracking.verdict ? ` · ${row.tracking.verdict}` : ""}
            </span>
          )}
        </td>
        {ledger.calls.map((c) => {
          const cell = row.calls[c.label];
          const s = cell?.status;
          return (
            <td key={c.label} className="py-2 text-center">
              {s ? (
                <button
                  onClick={onToggle}
                  className="min-h-[36px] min-w-[36px] text-[1rem] leading-none"
                  style={{ color: GLYPH[s].color }}
                  title={GLYPH[s].label}
                  aria-label={`${row.title}, ${c.label}: ${cell.missed_then_reset ? "missed, then " : ""}${GLYPH[s].label}`}
                >
                  {cell.missed_then_reset ? (
                    <span>
                      <span style={{ color: GLYPH.missed.color }}>○</span>
                      <span className="sr-only">missed, then</span>
                    </span>
                  ) : null}
                  {GLYPH[s].g}
                  <span className="sr-only">{GLYPH[s].label}</span>
                </button>
              ) : (
                <span className="text-ink-3" aria-label="not applicable">
                  {" "}
                </span>
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
  return (
    <div className="border-l-2 border-rule pl-3 text-[0.875rem] leading-relaxed">
      {row.first_quote && (
        <Quote label={`Promised · ${row.first_quote.call}${row.first_quote.speaker ? `, ${row.first_quote.speaker}` : ""}`} q={row.first_quote} />
      )}
      <ol className="mt-2 space-y-1">
        {ledger.calls.map((c) => {
          const cell = row.calls[c.label];
          if (!cell?.status) return null;
          return (
            <li key={c.label} className="flex gap-2">
              <span className="num w-14 shrink-0 text-[0.75rem] text-ink-3">{c.label}</span>
              <span style={{ color: GLYPH[cell.status].color }} aria-hidden>
                {cell.missed_then_reset ? "○→" : ""}
                {GLYPH[cell.status].g}
              </span>
              <span className="text-ink-2">
                {cell.missed_then_reset ? "Missed; new date: " : ""}
                {cell.note}
              </span>
            </li>
          );
        })}
      </ol>
      {row.latest_quote && <Quote label={`Latest · ${row.latest_quote.call}`} q={row.latest_quote} />}
      {ledger.calls.map((c) => {
        const ev = row.calls[c.label]?.evidence;
        if (!ev) return null;
        // the outcome side of the comparison, with its own source (audit F03)
        return (
          <div key={`ev-${c.label}`}>
            <Quote
              label={`Outcome stated · ${ev.call ?? c.label}${ev.speaker ? `, ${ev.speaker}` : ""}${ev.period ? ` · for ${ev.period}` : ""}`}
              q={{ text: ev.quote, page: ev.page, url: ev.url ?? undefined }}
            />
            <p className="mt-1 text-[0.75rem] text-ink-3">
              Compared only because both sides match: same metric and period, comparable units, a company speaker, and a
              later call than the promise. This is what management said, not a filed figure.
            </p>
          </div>
        );
      })}
      {row.verdict && <p className="mt-2 text-ink-2">{row.verdict}</p>}
      {row.tracking && (
        <p className="mt-2 text-ink-2">
          So far: {row.tracking.metric} was <span className="num">{row.tracking.value}%</span> in {row.tracking.label}
          {row.tracking.verdict ? `, ${row.tracking.verdict === "on track" ? "on track for" : `${row.tracking.verdict}`} the target` : ""}. One quarter is
          not the year, so the status stays open.
          {row.tracking.source && (
            <a href={row.tracking.source} target="_blank" rel="noopener noreferrer" className="ml-1 text-[0.75rem] text-accent">
              results table ↗
            </a>
          )}
        </p>
      )}
      <p className="mt-2 text-[0.75rem] text-ink-3">Evidence: {EVIDENCE_LABEL[row.evidence_source]}.</p>
      {verifier && (
        <div className="mt-1">
          <p className="text-[0.75rem] text-ink-3">Who can verify</p>
          <NetworkLine line={verifier} compact />
        </div>
      )}
    </div>
  );
}

function Quote({ label, q }: { label: string; q: { text: string; page: number; url?: string } }) {
  return (
    <figure className="mt-1">
      <figcaption className="text-[0.75rem] text-ink-3">{label}</figcaption>
      <blockquote className="font-serif text-[0.9375rem] italic text-ink">&ldquo;{q.text}&rdquo;</blockquote>
      {q.url && (
        <a href={`${q.url}#page=${q.page}`} target="_blank" rel="noopener noreferrer" className="text-[0.75rem] text-accent">
          transcript p.{q.page} ↗
        </a>
      )}
    </figure>
  );
}

function countLatest(rows: PromiseRow[]) {
  const c: Partial<Record<PromiseStatus, number>> = {};
  for (const r of rows) c[r.latest] = (c[r.latest] ?? 0) + 1;
  return c;
}

/** Worth the investor's attention: changed, dropped, settled, or with a filed quarter to compare. */
function isSlipped(r: PromiseRow) {
  return (
    !!r.tracking ||
    Object.values(r.calls).some((c) => c.evidence || (c.status && ["missed", "revised", "silent", "partly", "conflict", "delivered"].includes(c.status)))
  );
}

const ORDER: PromiseStatus[] = ["missed", "revised", "conflict", "silent", "partly", "closed", "early", "delivered"];
const PAGE = 20;
// status first; within a status, promises restated on more calls, then ones with a figure to check
function orderRows(rows: PromiseRow[]) {
  const noFigure = (r: PromiseRow) => (/: (no figure|direction only)$/.test(r.title) ? 1 : 0);
  return [...rows].sort(
    (a, b) =>
      ORDER.indexOf(a.latest) - ORDER.indexOf(b.latest) ||
      (b.mentions ?? 1) - (a.mentions ?? 1) ||
      noFigure(a) - noFigure(b),
  );
}
