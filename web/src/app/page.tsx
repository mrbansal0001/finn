import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { applyPrefs, parsePrefs, PREFS_COOKIE } from "@/lib/prefs";
import { getView } from "@/lib/data";
import type { WindowKey } from "@/lib/types";
import { longDate, when } from "@/lib/format";
import { EditionCard } from "@/components/EditionCard";
import { Dock } from "@/components/Dock";
import { SinceLastVisit } from "@/components/SinceLastVisit";
import type { Edition } from "@/lib/types";

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "24h", label: "24 hours" },
  { key: "3d", label: "3 days" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
];

const LEAD_COUNT_WORDS = ["Nothing material", "One thing matters", "Two things matter", "Three things matter", "Four things matter", "Five things matter"];

export default function EditionPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <Edition searchParams={searchParams} />
    </Suspense>
  );
}

function Loading() {
  return (
    <main aria-busy="true">
      <h1 className="font-serif text-[1.75rem] font-semibold tracking-tight">FINN</h1>
      <p className="mt-1 text-[0.8125rem] text-ink-3">Preparing your edition…</p>
    </main>
  );
}

async function Edition({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [sp, jar, snap] = await Promise.all([searchParams, cookies(), getView()]);
  const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
  const sinceVisit = sp.w === "since" && typeof sp.t === "string" && !Number.isNaN(Date.parse(sp.t)) ? sp.t : null;
  const w = (sinceVisit ? "30d" : (WINDOWS.find((x) => x.key === sp.w)?.key ?? "7d")) as WindowKey;
  const base = sinceVisit ? sinceEdition(snap.editions["30d"], sinceVisit) : snap.editions[w];
  const ed = applyPrefs(structuredClone(base), prefs);
  const until = snap.data_until;

  return (
    <main>
      <header className="flex items-baseline justify-between">
        <h1 className="font-serif text-[1.75rem] font-semibold tracking-tight">FINN</h1>
        <p className="num text-[0.8125rem] text-ink-2">{longDate(until)}</p>
      </header>

      <p className="mt-1 text-[0.8125rem] text-ink-2">
        Your edition since <span className="num">{when(ed.since)}</span> · {snap.portfolio.length} holdings
      </p>

      <nav aria-label="Edition window" className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
        <SinceLastVisit active={!!sinceVisit} />
        {WINDOWS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "7d" ? "/" : `/?w=${x.key}`}
            aria-current={x.key === w && !sinceVisit ? "page" : undefined}
            className={`inline-flex min-h-[36px] items-center whitespace-nowrap rounded-full px-3 text-[0.8125rem] ${
              x.key === w && !sinceVisit ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      <section aria-labelledby="leads" className="mt-6">
        <h2 id="leads" className="kicker border-b border-ink pb-2 text-ink">
          {LEAD_COUNT_WORDS[ed.leads.length]}
        </h2>
        {ed.leads.length === 0 ? (
          <p className="py-6 font-serif text-[1.25rem] leading-snug">
            Quiet window. {ed.routine_total} routine filing{ed.routine_total === 1 ? "" : "s"}, nothing material.
            {w !== "30d" && (
              <Link href={`/?w=${w === "24h" ? "3d" : w === "3d" ? "7d" : "30d"}`} className="mt-2 block font-sans text-[0.875rem] text-accent">
                Widen the window ›
              </Link>
            )}
          </p>
        ) : (
          <div className="hair">
            {ed.leads.map((c) => (
              <EditionCard key={c.id} card={c} refTime={until} />
            ))}
          </div>
        )}
      </section>

      {ed.more.length > 0 && (
        <details className="group mt-2 border-t border-rule">
          <summary className="flex min-h-[48px] items-center justify-between text-[0.9375rem]">
            <span>
              <span className="num">{ed.more.length}</span> more worth a look
            </span>
            <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="hair pb-2">
            {ed.more.map((c) => (
              <EditionCard key={c.id} card={c} refTime={until} compact />
            ))}
          </div>
        </details>
      )}

      {ed.routine_total > 0 && (
        <details className="group border-t border-rule">
          <summary className="flex min-h-[48px] items-center justify-between text-[0.9375rem] text-ink-2">
            <span>
              <span className="num">{ed.routine_total}</span> routine filings, folded
            </span>
            <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="pb-3 text-[0.875rem] text-ink-2">
            {ed.routine.map(([label, n]) => (
              <li key={label} className="flex justify-between py-1">
                <span>{label}</span>
                <span className="num text-ink-3">{n}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-10 text-center font-serif text-[0.9375rem] italic text-ink-3">· end of edition ·</p>
      <p className="mt-2 text-center text-[0.75rem] text-ink-3">
        Data to <span className="num">{when(until)}</span> IST · NSE filings and bhavcopy
      </p>

      <Dock edition={ed} />
    </main>
  );
}

/** Cards newer than the visitor's last visit (from the 30-day edition). Routine counts are not
 *  time-split in the export, so the fold row is omitted rather than guessed. */
function sinceEdition(ed30: Edition, since: string): Edition {
  const t = Date.parse(since);
  const fresh = (c: Edition["leads"][number]) => Date.parse(c.at.includes("+") ? c.at : `${c.at}+05:30`) > t;
  const all = [...ed30.leads, ...ed30.more].filter(fresh);
  return { ...ed30, since, leads: all.filter((c) => c.tier === "lead"), more: all.filter((c) => c.tier !== "lead"), routine: [], routine_total: 0 };
}
