import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { alertsFor, applyPrefs, parsePrefs, PREFS_COOKIE, type Alert, type Prefs } from "@/lib/prefs";
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

const LEAD_COUNT_WORDS = ["No lead story", "One thing matters", "Two things matter", "Three things matter", "Four things matter", "Five things matter"];

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
  // the brief: "by default the last 24 hours, but let me pick the period"
  const w = (sinceVisit ? "30d" : (WINDOWS.find((x) => x.key === sp.w)?.key ?? "24h")) as WindowKey;
  const base = sinceVisit ? sinceEdition(snap.editions["30d"], sinceVisit) : snap.editions[w];
  const moveCards = snap.move_cards ?? [];
  const ed = applyPrefs(structuredClone(base), prefs, moveCards);
  const until = snap.data_until;
  const alerts = moveCards.length ? alertsFor(moveCards, ed.since, ed.until, prefs) : legacyAlerts(ed, prefs);

  return (
    <main>
      <header className="flex items-baseline justify-between">
        <h1 className="font-serif text-[1.75rem] font-semibold tracking-tight">FINN</h1>
        <p className="num text-[0.8125rem] text-ink-2">{longDate(until)}</p>
      </header>

      <p className="mt-1 text-[0.8125rem] text-ink-2">
        Your edition since <span className="num">{when(ed.since)}</span> · {snap.portfolio.length} holdings
      </p>
      <p className="mt-1 text-[0.75rem] leading-snug text-ink-3">
        A demo investor&apos;s NSE portfolio. Filings, prices and results are real; the people in your network are synthetic.
      </p>

      <nav aria-label="Edition window" className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
        <SinceLastVisit active={!!sinceVisit} seen={until} />
        {WINDOWS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "24h" ? "/" : `/?w=${x.key}`}
            aria-current={x.key === w && !sinceVisit ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-3 text-[0.8125rem] ${
              x.key === w && !sinceVisit ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {snap.network_status === "unavailable" && (
        <p className="mt-4 rounded-md border border-rule px-3 py-2 text-[0.8125rem] text-ink-2">
          Your private demo network didn&apos;t load just now (too many new visitors at once, or cookies blocked). Reload in a
          minute; filings and numbers are unaffected.
        </p>
      )}

      <Alerts hits={alerts} prefs={prefs} />

      <section aria-labelledby="leads" className="mt-6">
        <h2 id="leads" className="kicker border-b border-ink pb-2 text-ink">
          {LEAD_COUNT_WORDS[ed.leads.length]}
        </h2>
        {ed.leads.length === 0 ? (
          <p className="py-6 font-serif text-[1.25rem] leading-snug">
            {ed.more.length > 0
              ? `No single item leads this window. ${ed.more.length} update${ed.more.length === 1 ? "" : "s"} worth reviewing below${alerts.length ? `, and ${alerts.length} rule match${alerts.length === 1 ? "" : "es"} above` : ""}.`
              : alerts.length
                ? `No filing stands out; ${alerts.length} price/volume rule match${alerts.length === 1 ? "" : "es"} above.`
                : `Quiet window. ${ed.routine_total} routine filing${ed.routine_total === 1 ? "" : "s"}, nothing else.`}
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
        <details className="group mt-2 border-t border-rule" open={ed.leads.length === 0}>
          <summary className="flex min-h-[48px] items-center justify-between text-[0.9375rem]">
            <span>
              <span className="num">{ed.more.length}</span> {ed.leads.length ? "more " : ""}worth a look
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
        Filings to <span className="num">{when(snap.freshness?.filings_until ?? until)}</span> IST
        {snap.freshness?.price_session && (
          <>
            {" "}· prices to the <span className="num">{shortDay(snap.freshness.price_session)}</span> close
          </>
        )}
        {" "}· NSE filings and bhavcopy
      </p>

      <Dock edition={ed} alerts={alerts.length} />
    </main>
  );
}

/** Threshold crossings in this window, by the investor's own rules: every matching session, each opening its
 *  own card. In-app only; nothing is sent to a phone or inbox. */
function Alerts({ hits, prefs }: { hits: Alert[]; prefs: Prefs }) {
  if (!hits.length) return null;
  const row = ({ card, rules }: Alert) => (
    <li key={card.id} className="flex min-h-[44px] items-center justify-between gap-2 border-t border-rule first:border-t-0">
      <Link href={`/card/${card.id}`} className="inline-flex min-h-[44px] items-center gap-2 text-ink">
        {card.symbol}
        <span className="num text-[0.75rem] text-ink-3">{shortDay(card.at)}</span>
      </Link>
      <span className="num text-ink-2">{rules.join(" · ")}</span>
    </li>
  );
  return (
    <section aria-labelledby="alerts" className="mt-5 rounded-md border border-rule px-3 py-2">
      <h2 id="alerts" className="flex items-baseline justify-between text-[0.75rem] uppercase tracking-wider text-ink-3">
        <span>
          {hits.length} rule match{hits.length === 1 ? "" : "es"} · at the close
        </span>
        <Link href="/settings" className="normal-case tracking-normal text-accent">
          your rules: ±{prefs.price_pct}% · {prefs.volume_x}× volume ›
        </Link>
      </h2>
      <ul className="mt-1 text-[0.875rem]">{hits.slice(0, 5).map(row)}</ul>
      {hits.length > 5 && (
        <details className="group">
          <summary className="flex min-h-[44px] items-center text-[0.8125rem] text-accent">
            View all {hits.length}
          </summary>
          <ul className="text-[0.875rem]">{hits.slice(5).map(row)}</ul>
        </details>
      )}
    </section>
  );
}

/** Snapshots exported before the move registry: alerts from the edition's own move cards. */
function legacyAlerts(ed: Edition, prefs: Prefs): Alert[] {
  return alertsFor([...ed.leads, ...ed.more].filter((c) => c.kind === "move"), ed.since, ed.until, prefs);
}

function shortDay(s: string): string {
  return new Date(`${s.slice(0, 10)}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** Cards newer than the data the visitor last saw (from the 30-day edition). `since` is the data_until of
 *  that visit, not the wall clock, so filings that arrived late with earlier timestamps are not lost.
 *  Routine counts are not time-split in the export, so the fold row is omitted rather than guessed. */
function sinceEdition(ed30: Edition, since: string): Edition {
  const ist = (s: string) => Date.parse(/[+Z]/.test(s.slice(10)) ? s : `${s}+05:30`);
  const t = ist(since);
  const fresh = (c: Edition["leads"][number]) => ist(c.at) > t;
  const all = [...ed30.leads, ...ed30.more].filter(fresh);
  return { ...ed30, since, leads: all.filter((c) => c.tier === "lead"), more: all.filter((c) => c.tier !== "lead"), routine: [], routine_total: 0 };
}
