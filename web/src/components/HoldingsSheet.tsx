"use client";

import Link from "next/link";
import { useRef } from "react";

type Row = { symbol: string; name: string; sector: string; weight: number };

/**
 * "18 holdings" opens a sheet listing the portfolio (plan §8.1): the audit asked for the holdings to be
 * discoverable. A native <dialog>: focus is trapped, Escape and the backdrop close it.
 */
export function HoldingsSheet({ holdings, research }: { holdings: Row[]; research: Row[] }) {
  const ref = useRef<HTMLDialogElement>(null);
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
          <List rows={holdings} close={() => ref.current?.close()} showWeight />
          {research.length > 0 && (
            <>
              <h3 className="section-h mt-6">Research list</h3>
              <List rows={research} close={() => ref.current?.close()} />
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

function List({ rows, close, showWeight }: { rows: Row[]; close: () => void; showWeight?: boolean }) {
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
            </span>
            {showWeight && <span className="num shrink-0 text-small text-ink-2">{h.weight}%</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
