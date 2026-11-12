"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { CHANGED, readQuestions } from "./followed";
import { DOOR_CLASS, DoorTile } from "./DoorTile";

type Row = {
  symbol: string; name: string; sector: string; weight: number;
  ledger?: boolean; built?: string | null; lastCall?: string | null;
  people?: number; updates?: number; latest?: string | null;
};
type Event = { symbol: string; date: string; label: string; link: string | null };
type View = "list" | "coverage" | "agenda";

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGED, cb);
    window.removeEventListener("storage", cb);
  };
};
/** Followed questions per company, from this browser (server: none yet). */
function useQuestionCounts(): Record<string, number> {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readQuestions().reduce<Record<string, number>>((a, q) => ({ ...a, [q.symbol]: (a[q.symbol] ?? 0) + 1 }), {})),
    () => "{}",
  );
  return JSON.parse(raw);
}

/**
 * "18 holdings" opens the portfolio (plan §8.1; visual review §6). Three views:
 *  List      the holdings and research names, with what FINN knows about each
 *  Coverage  a matrix: updates this week, research (ledger), people, questions you follow; each cell opens
 *            its own evidence. Weight as a bar beside the name. Coverage, never a risk score.
 *  Agenda    events the companies announced (investor meets, calls), plus your own revisit dates
 * A native <dialog>: focus is trapped, Escape and the backdrop close it.
 */
export function HoldingsSheet({
  holdings,
  research,
  networkReady = true,
  agenda = [],
  today,
}: {
  holdings: Row[];
  research: Row[];
  networkReady?: boolean;
  agenda?: Event[];
  today?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [gaps, setGaps] = useState(false);
  const [view, setView] = useState<View>("list");
  const qs = useQuestionCounts();
  // "where do I lack context?": no promises ledger yet, or no one in your network linked to it
  const lacks = (r: Row) => !r.ledger || (networkReady && !r.people);
  const nGaps = [...holdings, ...research].filter(lacks).length;
  const total = holdings.reduce((a, h) => a + h.weight, 0);
  const close = () => ref.current?.close();
  const show = (rows: Row[]) => (gaps ? rows.filter(lacks) : rows);

  return (
    <>
      {/* the Portfolio door (three-pillars plan §2, S7): the sheet keeps its title */}
      <button type="button" onClick={() => ref.current?.showModal()} className={DOOR_CLASS} aria-haspopup="dialog" aria-label={`Portfolio: ${holdings.length} holdings`}>
        <DoorTile icon="portfolio" label="Portfolio" sub={`${holdings.length} holdings`} />
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-labelledby="holdings-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) close(); // a tap on the backdrop
        }}
      >
        <div className="max-h-[85dvh] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-rule" />
          <div className="flex items-baseline justify-between">
            <h2 id="holdings-title" className="font-serif text-title">
              The portfolio
            </h2>
            <button type="button" onClick={close} className="min-h-[44px] px-2 text-small text-ink-2">
              Close
            </button>
          </div>
          {/* the view and the filter on one row, so the first holding shows without scrolling (layout plan §8) */}
          <div className="mt-2 flex items-center gap-2">
          <div className="seg seg-sm flex-1" role="tablist" aria-label="View">
            {(
              [
                ["list", "List"],
                ["coverage", "Coverage"],
                ["agenda", "Agenda"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={view === k}
                onClick={() => setView(k)}
              >
                {label}
              </button>
            ))}
          </div>
          {view !== "agenda" && (
            <button aria-pressed={gaps} onClick={() => setGaps(!gaps)} className="pill shrink-0 !min-h-[2.25rem] !px-3 text-caption" aria-label={`Where I lack context: ${nGaps}`}>
              Lack context <span className="num text-ink-3">{nGaps}</span>
            </button>
          )}
          </div>
          {gaps && view !== "agenda" && (
            <p className="mt-2 text-caption text-ink-3">No promises ledger yet, or no one in your network linked to the company. A gap in what you know, not a risk.</p>
          )}

          {view === "list" && (
            <>
              <List rows={show(holdings)} close={close} showWeight networkReady={networkReady} />
              {!gaps && (
                <p className="mt-2 text-caption text-ink-3">
                  Weights add up to <span className="num">{total}%</span>; research names carry none.
                </p>
              )}
              {research.length > 0 && show(research).length > 0 && (
                <>
                  <h3 className="section-h mt-6">Research list</h3>
                  <List rows={show(research)} close={close} networkReady={networkReady} />
                </>
              )}
            </>
          )}
          {view === "coverage" && <Coverage holdings={show(holdings)} research={show(research)} qs={qs} close={close} networkReady={networkReady} />}
          {view === "agenda" && <Agenda events={agenda} today={today} close={close} />}

          <Link href="/questions" onClick={close} className="mt-5 flex min-h-[48px] items-center justify-between border-t border-rule text-small text-ink">
            Questions you follow
            <span className="num text-ink-3">
              {Object.values(qs).reduce((a, b) => a + b, 0)} <span aria-hidden>›</span>
            </span>
          </Link>
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
            <span className="flex shrink-0 items-center gap-2">
              {showWeight && <span className="num text-small text-ink-2">{h.weight}%</span>}
              <span aria-hidden className="go">›</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Sort = "weight" | "newest" | "gaps";

/** The coverage matrix: four labelled cells per company, each opening its own evidence (visual review §6).
 *  Outline = not covered, filled neutral = available, blue count = something new. Words beside every shape. */
function Coverage({ holdings, research, qs, close, networkReady }: { holdings: Row[]; research: Row[]; qs: Record<string, number>; close: () => void; networkReady: boolean }) {
  const [sort, setSort] = useState<Sort>("weight");
  const max = Math.max(1, ...holdings.map((h) => h.weight));
  const gapsOf = (r: Row) => Number(!r.ledger) + Number(networkReady && !r.people);
  const order = (rows: Row[]) =>
    [...rows].sort((a, b) =>
      sort === "weight" ? b.weight - a.weight : sort === "newest" ? (b.latest ?? "").localeCompare(a.latest ?? "") : gapsOf(b) - gapsOf(a) || b.weight - a.weight,
    );
  return (
    <div className="mt-3">
      <p className="text-caption text-ink-3">Sort by</p>
      <div className="seg seg-sm mt-1" role="group" aria-label="Sort by">
        {(
          [
            ["weight", "Weight"],
            ["newest", "Newest"],
            ["gaps", "Missing"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
            {label}
          </button>
        ))}
      </div>
      <Matrix rows={order(holdings)} qs={qs} close={close} max={max} networkReady={networkReady} weighted />
      {research.length > 0 && (
        <>
          <h3 className="section-h mt-6">Research list (no weight)</h3>
          <Matrix rows={order(research)} qs={qs} close={close} max={max} networkReady={networkReady} />
        </>
      )}
      <p className="mt-3 text-caption text-ink-3">
        <span aria-hidden className="inline-block size-2 rounded-full bg-accent align-[1px]" /> something new this week,{" "}
        <span aria-hidden className="inline-block size-2 rounded-full bg-ink-3 align-[1px]" /> available,{" "}
        <span aria-hidden className="inline-block size-2 rounded-full border border-ink-3 align-[1px]" /> not covered. Each cell opens its list. Coverage only: a
        quiet or covered company isn&apos;t &ldquo;safe&rdquo;.
      </p>
    </div>
  );
}

function Matrix({ rows, qs, close, max, networkReady, weighted }: { rows: Row[]; qs: Record<string, number>; close: () => void; max: number; networkReady: boolean; weighted?: boolean }) {
  return (
    <div className="mt-2" role="table" aria-label="Coverage by company">
      <div role="row" className="grid grid-cols-4 gap-1 border-b border-rule pb-1 text-label text-ink-3">
        <span role="columnheader">Updates, 7 days</span>
        <span role="columnheader">Research, latest call</span>
        <span role="columnheader">People</span>
        <span role="columnheader">Your questions</span>
      </div>
      {rows.map((h) => {
        const q = qs[h.symbol] ?? 0;
        const sym = encodeURIComponent(h.symbol);
        return (
          <div key={h.symbol} role="row" className="border-b border-rule py-2">
            <div className="flex items-center gap-2" role="rowheader">
              <Link href={`/c/${sym}`} onClick={close} className="text-small font-medium text-ink hover:underline">
                {h.symbol}
              </Link>
              {weighted ? (
                <>
                  {/* weight as a bar: concentration at a glance (an 18-slice pie is harder to scan) */}
                  <span className="h-1.5 flex-1 rounded-full bg-tint" aria-hidden>
                    <span className="block h-full rounded-full bg-ink-3" style={{ width: `${(100 * h.weight) / max}%` }} />
                  </span>
                  <span className="num w-9 text-right text-caption text-ink-2">{h.weight}%</span>
                </>
              ) : (
                <span className="truncate text-caption text-ink-3">{h.name}</span>
              )}
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1 text-caption">
              <Cell href={`/c/${sym}#filings`} close={close} on={!!h.updates} fresh={!!h.updates} label={h.updates ? `${h.updates} new` : "None"} sr={`${h.updates ?? 0} updates this week`} />
              <Cell
                href={`/c/${sym}#promises`}
                close={close}
                on={!!h.ledger}
                // short enough to keep the cell's chevron: "Oct ’26" (the full wording is the cell's accessible name)
                label={h.ledger ? shortCall(h.lastCall) : "None"}
                sr={h.ledger ? `Promises ledger, latest call ${h.lastCall ?? "unknown"}, built ${h.built ?? "unknown"}` : "No promises ledger yet"}
              />
              <Cell
                href={`/c/${sym}#people`}
                close={close}
                on={!!h.people}
                label={!networkReady ? "Unavailable" : h.people ? `${h.people}` : "None"}
                sr={!networkReady ? "Network unavailable" : `${h.people ?? 0} people in your network`}
                muted={!networkReady}
              />
              <Cell href={`/questions?c=${sym}`} close={close} on={q > 0} label={q ? `${q}` : "–"} sr={`${q} questions you follow`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Cell({ href, close, on, fresh, label, sr, muted }: { href: string; close: () => void; on: boolean; fresh?: boolean; label: string; sr: string; muted?: boolean }) {
  return (
    <Link href={href} onClick={close} role="cell" aria-label={sr} className="flex min-h-[36px] items-center gap-1 rounded-md px-0.5 hover:bg-tint">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${muted ? "border border-dashed border-ink-3" : on ? (fresh ? "bg-accent" : "bg-ink-3") : "border border-ink-3"}`} />
      <span className={`num truncate ${fresh ? "font-medium text-accent" : on ? "text-ink-2" : "text-ink-3"}`}>{label}</span>
      <span aria-hidden className="go text-label">›</span>
    </Link>
  );
}

/** Announced events ahead (company-filed dates) and your own revisit dates, kept apart (visual review §11). */
function Agenda({ events, today, close }: { events: Event[]; today?: string; close: () => void }) {
  const mine = useSyncExternalStore(
    subscribe,
    () =>
      JSON.stringify(
        readQuestions()
          .filter((q) => q.revisit === "date" && q.date && (!today || q.date >= today))
          .map((q) => ({ symbol: q.symbol, date: q.date!, label: q.question, href: q.href })),
      ),
    () => "[]",
  );
  const reminders = JSON.parse(mine) as { symbol: string; date: string; label: string; href: string }[];
  const all = [
    ...events.map((e) => ({ symbol: e.symbol, date: e.date, label: e.label, href: e.link, kind: "announced" as const })),
    ...reminders.map((r) => ({ ...r, kind: "reminder" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(all.map((e) => e.date))];
  const fmt = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  if (!all.length)
    return (
      <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
        No announced events ahead for these companies in the filings FINN has read. Results dates aren&apos;t guessed.
      </p>
    );
  return (
    <div className="mt-4">
      <ol className="relative ml-1.5 border-l border-rule">
        {days.map((d) => (
          <li key={d} className="relative pb-3 pl-5">
            <span aria-hidden className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-ink-3" />
            <p className="num text-caption font-medium text-ink">{fmt(d)}</p>
            <ul className="mt-1 space-y-1.5">
              {all
                .filter((e) => e.date === d)
                .map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-small">
                    <Link href={`/c/${encodeURIComponent(e.symbol)}`} onClick={close} className="chip tap shrink-0">
                      {e.symbol}
                    </Link>
                    <span className="min-w-0">
                      {e.kind === "reminder" ? (
                        <Link href={e.href!} onClick={close} className="line-clamp-2 text-ink hover:underline">
                          {e.label} <span aria-hidden className="go">›</span>
                        </Link>
                      ) : e.href ? (
                        <a href={e.href} target="_blank" rel="noopener noreferrer" className="text-ink hover:underline">
                          {e.label} <span className="text-accent">↗︎</span>
                        </a>
                      ) : (
                        <span className="text-ink">{e.label}</span>
                      )}
                      <span className="block text-caption text-ink-3">{e.kind === "reminder" ? "Your revisit date" : "Announced by the company"}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-caption text-ink-3">Dates the companies filed, plus the revisit dates you set. Results dates aren&apos;t guessed.</p>
    </div>
  );
}

/** "Oct 2026" -> "Oct ’26"; quarter labels ("Q2FY27") are already short. */
function shortCall(label: string | null | undefined): string {
  if (!label) return "Ledger";
  const m = label.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  return m ? `${m[1]} ’${m[2].slice(2)}` : label;
}
