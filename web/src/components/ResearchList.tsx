"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { NAV_START } from "./NavProgress";
import type { PromiseStatus } from "@/lib/types";
import { StatusIcon, STATUS_META } from "./StatusIcon";

export type ResearchRow = {
  symbol: string;
  name: string;
  sector: string | null;
  weight: number | null;
  research: boolean;
  portfolio: boolean;
  nifty: boolean;
  ledger: boolean;
  lastCall: string | null;
  lastKey: number;
  counts: Partial<Record<PromiseStatus, number>>;
  rows: number;
  question: string | null;
  questionHref: string | null;
};

type Filter = "portfolio" | "nifty" | "all";
type Sort = "changed" | "newest" | "name";
// the statuses that mean something at a glance; "open" and "ended" are the background
const SHOWN: PromiseStatus[] = ["revised", "silent", "missed", "partly", "delivered"];
const changed = (r: ResearchRow) => (r.counts.revised ?? 0) + (r.counts.silent ?? 0) + (r.counts.missed ?? 0) + (r.counts.partly ?? 0);

/** The Research list: filter, sort, search, and one row per company (three-pillars plan §4). */
export function ResearchList({ rows, hasNifty }: { rows: ResearchRow[]; hasNifty: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("portfolio");
  const [sort, setSort] = useState<Sort>("changed");
  const [q, setQ] = useState("");
  const [others, setOthers] = useState<[string, string][]>([]);
  const term = q.trim().toLowerCase();

  const shown = useMemo(() => {
    const base = rows.filter((r) => (term ? r.symbol.toLowerCase().startsWith(term) || r.name.toLowerCase().includes(term) : filter === "all" ? r.ledger : filter === "nifty" ? r.nifty : r.portfolio));
    return [...base].sort((a, b) =>
      sort === "name"
        ? a.symbol.localeCompare(b.symbol)
        : sort === "newest"
          ? b.lastKey - a.lastKey || a.symbol.localeCompare(b.symbol)
          : Number(b.ledger) - Number(a.ledger) || changed(b) - changed(a) || (b.weight ?? 0) - (a.weight ?? 0),
    );
  }, [rows, term, filter, sort]);

  const counts = { portfolio: rows.filter((r) => r.portfolio).length, nifty: rows.filter((r) => r.nifty).length, all: rows.filter((r) => r.ledger).length };

  return (
    <>
      {/* any NSE company: the list first, then the exchange's own list for anything FINN hasn't read */}
      <form
        role="search"
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          const hit = shown[0]?.symbol ?? others[0]?.[0];
          if (hit) {
            window.dispatchEvent(new Event(NAV_START));
            router.push(`/c/${encodeURIComponent(hit)}`);
          }
        }}
      >
        <label htmlFor="research-q" className="sr-only">
          Search any NSE company
        </label>
        <input
          id="research-q"
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (v.trim().length >= 2)
              fetch(`/api/search?q=${encodeURIComponent(v.trim())}`)
                .then((r) => (r.ok ? r.json() : []))
                .then((d: [string, string][]) => setOthers(d))
                .catch(() => setOthers([]));
            else setOthers([]);
          }}
          placeholder="Search any NSE company"
          className="min-h-[44px] w-full rounded-lg border border-ink-3 bg-paper-raised px-3.5 text-body placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </form>

      {!term && (
        <div className="mt-3 space-y-2">
          <div className="seg" role="group" aria-label="Which companies">
            {(
              [
                ["portfolio", "Portfolio"],
                ...(hasNifty ? [["nifty", "Nifty 50"] as const] : []),
                ["all", "All read"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label} <span className="num text-caption opacity-70">{counts[k]}</span>
              </button>
            ))}
          </div>
          <div className="seg seg-sm" role="group" aria-label="Sort by">
            {(
              [
                ["changed", "Most changed"],
                ["newest", "Newest call"],
                ["name", "Name"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="hair mt-4">
        {shown.map((r) => (
          <Row key={r.symbol} r={r} />
        ))}
      </ul>
      {term && others.filter(([s]) => !rows.some((r) => r.symbol === s)).length > 0 && (
        <>
          <h2 className="minor-h mt-6">Not read yet</h2>
          <ul className="hair mt-1">
            {others
              .filter(([s]) => !rows.some((r) => r.symbol === s))
              .slice(0, 6)
              .map(([s, n]) => (
                <li key={s}>
                  <Link href={`/c/${encodeURIComponent(s)}`} className="flex min-h-[52px] items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-small font-medium text-ink">{s}</span>
                      <span className="block truncate text-caption text-ink-3">{n}</span>
                    </span>
                    <span className="shrink-0 text-caption text-accent">Open, request a ledger ›</span>
                  </Link>
                </li>
              ))}
          </ul>
        </>
      )}
      {shown.length === 0 && !others.length && <p className="py-6 text-small text-ink-2">No company matches &ldquo;{q}&rdquo;.</p>}
    </>
  );
}

function Row({ r }: { r: ResearchRow }) {
  const sym = encodeURIComponent(r.symbol);
  return (
    <li className="py-3">
      <Link href={`/c/${sym}${r.ledger ? "#promises" : ""}`} className="group flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-small font-medium text-ink group-hover:underline">{r.symbol}</span>
            {r.sector && <span className="tag">{r.sector}</span>}
            {r.weight != null && <span className="tag num">{r.weight}%</span>}
            {r.research && <span className="tag">Research list</span>}
          </span>
          <span className="mt-0.5 block truncate text-caption text-ink-3">{r.name}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="num text-caption text-ink-3">{r.ledger ? (r.lastCall ? `${r.lastCall} call` : "Read") : "No ledger yet"}</span>
          {r.ledger ? (
            <span className="flex items-center gap-2" aria-label={SHOWN.filter((s) => r.counts[s]).map((s) => `${r.counts[s]} ${STATUS_META[s].short}`).join(", ") || "nothing changed"}>
              {SHOWN.filter((s) => r.counts[s]).map((s) => (
                <span key={s} className="flex items-center gap-0.5 text-caption text-ink-2">
                  <StatusIcon status={s} size={13} />
                  <span className="num">{r.counts[s]}</span>
                </span>
              ))}
              {!SHOWN.some((s) => r.counts[s]) && <span className="text-caption text-ink-3">Nothing changed</span>}
            </span>
          ) : (
            <span className="text-caption text-accent">Build one ›</span>
          )}
        </span>
      </Link>
      {r.question && r.questionHref && (
        <Link href={r.questionHref} className="mt-1.5 flex items-start justify-between gap-3 text-small text-ink-2 hover:text-ink">
          <span className="line-clamp-2">{r.question}</span>
          <span aria-hidden className="go mt-0.5">›</span>
        </Link>
      )}
    </li>
  );
}
