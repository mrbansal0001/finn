"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Row = { symbol: string; name: string; sector: string; weight: number; ledger?: boolean; people?: number; updates?: number };

/**
 * "18 holdings" opens a sheet listing the portfolio (plan §8.1): the audit asked for the holdings to be
 * discoverable. A native <dialog>: focus is trapped, Escape and the backdrop close it.
 */
export function HoldingsSheet({ holdings, research, networkReady = true }: { holdings: Row[]; research: Row[]; networkReady?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [gaps, setGaps] = useState(false);
  // "where do I lack context?": no promises ledger yet, or no one in your network linked to it
  const lacks = (r: Row) => !r.ledger || (networkReady && !r.people);
  const nGaps = [...holdings, ...research].filter(lacks).length;
  const total = holdings.reduce((a, h) => a + h.weight, 0);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="chip tap gap-1"
        aria-haspopup="dialog"
      >
        <span className="num">{holdings.length}</span> holdings <span aria-hidden className="text-ink-3">›</span>
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-labelledby="holdings-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close(); // a tap on the backdrop
        }}
      >
        <div className="max-h-[85dvh] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" />
          <div className="flex items-baseline justify-between">
            <h2 id="holdings-title" className="font-serif text-title">
              The portfolio
            </h2>
            <button type="button" onClick={() => ref.current?.close()} className="min-h-[44px] px-2 text-small text-ink-2">
              Close
            </button>
          </div>
          <p className="text-caption text-ink-3">
            A demo investor&apos;s {holdings.length} NSE holdings. Weights add up to <span className="num">{total}%</span>.
          </p>
          <div className="mt-3 flex gap-1.5" role="group" aria-label="Which companies">
            {([[false, "All", holdings.length + research.length], [true, "Where I lack context", nGaps]] as const).map(([k, label, n]) => (
              <button
                key={label}
                aria-pressed={gaps === k}
                onClick={() => setGaps(k)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-small ${gaps === k ? "bg-ink font-medium text-paper" : "border border-rule text-ink-2"}`}
              >
                {label} <span className={`num text-caption ${gaps === k ? "text-paper/70" : "text-ink-3"}`}>{n}</span>
              </button>
            ))}
          </div>
          {gaps && (
            <p className="mt-2 text-caption text-ink-3">
              No promises ledger yet, or no one in your network linked to the company. A gap in what you know, not a risk.
            </p>
          )}
          <List rows={gaps ? holdings.filter(lacks) : holdings} close={() => ref.current?.close()} showWeight networkReady={networkReady} />
          {research.length > 0 && (!gaps || research.some(lacks)) && (
            <>
              <h3 className="section-h mt-6">Research list</h3>
              <List rows={gaps ? research.filter(lacks) : research} close={() => ref.current?.close()} networkReady={networkReady} />
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

function List({ rows, close, showWeight, networkReady }: { rows: Row[]; close: () => void; showWeight?: boolean; networkReady: boolean }) {
  return (
    <ul className="hair mt-2">
      {rows.map((h) => (
        <li key={h.symbol}>
          <Link href={`/c/${h.symbol}`} onClick={close} className="flex min-h-[52px] items-center justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-small font-medium text-ink">{h.symbol}</span>
                {h.sector && <span className="tag truncate">{h.sector}</span>}
              </span>
              <span className="mt-0.5 block truncate text-caption text-ink-3">{h.name}</span>
              {h.ledger !== undefined && (
                <span className="mt-1 flex flex-wrap gap-x-3 text-caption">
                  {h.updates ? <span className="text-ink">{h.updates} this week</span> : <span className="text-ink-3">Quiet this week</span>}
                  {!h.ledger && <span className="text-ink-3">No ledger yet</span>}
                  {networkReady && !h.people && <span className="text-ink-3">No one in your network</span>}
                </span>
              )}
            </span>
            {showWeight && <span className="num shrink-0 text-small text-ink-2">{h.weight}%</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
