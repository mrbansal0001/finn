import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { alertsFor, applyPrefs, parsePrefs, PREFS_COOKIE, type Alert, type Prefs } from "@/lib/prefs";
import { getView } from "@/lib/data";
import type { Edition, WindowKey } from "@/lib/types";
import { longDate, when } from "@/lib/format";
import { EditionCard } from "@/components/EditionCard";
import { Dock } from "@/components/Dock";
import { BriefButton } from "@/components/BriefButton";
import { SinceLastVisit } from "@/components/SinceLastVisit";

const WINDOWS: { key: WindowKey; label: string; short: string }[] = [
  { key: "24h", label: "24 hours", short: "24h" },
  { key: "3d", label: "3 days", short: "3d" },
  { key: "7d", label: "7 days", short: "7d" },
  { key: "30d", label: "30 days", short: "30d" },
];
const WIDER: Record<string, { key: string; label: string } | undefined> = {
  "24h": { key: "3d", label: "3 days" },
  "3d": { key: "7d", label: "7 days" },
  "7d": { key: "30d", label: "30 days" },
};

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
      <h1 className="font-serif text-display font-semibold tracking-tight">FINN</h1>
      <p className="mt-1 text-small text-ink-3">Preparing your edition…</p>
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
  const wider = sinceVisit ? undefined : WIDER[w];

  return (
    <main>
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-display font-semibold tracking-tight">FINN</h1>
        <BriefButton edition={ed} alerts={alerts.length} />
      </header>
      <p className="text-small text-ink-2">
        <span className="num">{longDate(until)}</span> · {snap.portfolio.length} holdings · since{" "}
        <span className="num">{when(ed.since)}</span>
      </p>
      <p className="mt-0.5 text-meta text-ink-3">Demo portfolio · real NSE filings and prices · synthetic network</p>

      <nav aria-label="Edition window" className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
        <SinceLastVisit active={!!sinceVisit} seen={until} />
        {WINDOWS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "24h" ? "/" : `/?w=${x.key}`}
            aria-current={x.key === w && !sinceVisit ? "page" : undefined}
            aria-label={x.label}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap rounded-full px-3.5 text-small transition-colors max-[359px]:px-3 ${
              x.key === w && !sinceVisit ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            {/* very narrow phones get the short form so all four fit */}
            <span className="max-[359px]:hidden">{x.label}</span>
            <span className="hidden max-[359px]:inline">{x.short}</span>
          </Link>
        ))}
      </nav>

      {snap.network_status === "unavailable" && (
        <p className="mt-4 rounded-md border border-rule px-3 py-2 text-small text-ink-2">
          Your private demo network didn&apos;t load just now. Reload in a minute; filings and numbers are unaffected.
        </p>
      )}

      <Alerts hits={alerts} prefs={prefs} />

      <section aria-labelledby="leads" className="mt-7">
        <h2 id="leads" className="section-h text-ink">
          {LEAD_COUNT_WORDS[ed.leads.length]}
        </h2>
        {ed.leads.length === 0 ? (
          <p className="py-4 text-body text-ink-2">
            No single item leads this window
            {ed.more.length ? `; ${ed.more.length} worth a look below.` : alerts.length ? "; see the alerts above." : "."}
            {wider && (
              <>
                {" "}
                <Link href={`/?w=${wider.key}`} className="tap whitespace-nowrap text-accent">
                  See {wider.label} ›
                </Link>
              </>
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
          <summary className="flex min-h-[52px] items-center justify-between text-body">
            <span>
              Worth a look <span className="num text-ink-3">· {ed.more.length}</span>
            </span>
            <Chevron />
          </summary>
          <div className="hair pb-2">
            {ed.more.map((c) => (
              <EditionCard key={c.id} card={c} refTime={until} compact />
            ))}
          </div>
        </details>
      )}

      {ed.routine_total > 0 && <Routine ed={ed} refTime={until} />}

      <footer className="mt-12 text-center">
        <p className="font-serif text-body italic text-ink-3">· end of edition ·</p>
        <p className="mt-2 text-meta text-ink-3">
          Filings to <span className="num">{when(snap.freshness?.filings_until ?? until)}</span> IST
          {snap.freshness?.price_session && (
            <>
              {" "}· prices to the <span className="num">{shortDay(snap.freshness.price_session)}</span> close
            </>
          )}
          <br />
          NSE filings and bhavcopy
        </p>
      </footer>

      <Dock />
    </main>
  );
}

function Chevron() {
  return (
    <span aria-hidden className="text-ink-3 transition-transform duration-200 group-open:rotate-90">
      ›
    </span>
  );
}

/** Price/volume rule matches in this window, by the investor's own rules: every matching session, each
 *  opening its own card. In-app only; nothing is sent to a phone or inbox. */
function Alerts({ hits, prefs }: { hits: Alert[]; prefs: Prefs }) {
  if (!hits.length) return null;
  const row = ({ card, rules }: Alert) => {
    const pct = (card.facts as { change_pct?: number }).change_pct ?? 0;
    const price = rules.find((r) => r.endsWith("%"));
    const vol = rules.find((r) => r.includes("volume"));
    return (
      <li key={card.id} className="border-t border-rule first:border-t-0">
        <Link href={`/card/${card.id}`} className="flex min-h-[48px] items-center justify-between gap-3 px-3 hover:bg-paper">
          <span className="min-w-0 truncate">
            <span className="text-small font-medium text-ink">{card.symbol}</span>{" "}
            <span className="num text-meta text-ink-3">{shortDay(card.at)}</span>
          </span>
          <span className="num flex shrink-0 items-baseline gap-3 text-small">
            {price ? (
              <span className={pct >= 0 ? "text-up" : "text-down"}>{price}</span>
            ) : (
              // the day's price change, for context, when only the volume rule fired
              <span className="text-ink-3">
                {pct >= 0 ? "+" : "−"}
                {Math.abs(pct).toFixed(1)}%
              </span>
            )}
            {vol && <span className="text-ink-2">{vol.replace(" volume", " vol")}</span>}
          </span>
        </Link>
      </li>
    );
  };
  return (
    <section aria-labelledby="alerts" className="mt-5 rounded-md border border-rule bg-paper-raised/50">
      <div className="flex items-baseline justify-between gap-3 px-3 pt-2.5">
        <h2 id="alerts" className="kicker text-ink-2">
          Alerts · <span className="num">{hits.length}</span> <span className="font-normal normal-case tracking-normal text-ink-3">at the close</span>
        </h2>
        <Link href="/settings" className="tap shrink-0 text-meta text-accent">
          ±{prefs.price_pct}% · {prefs.volume_x}× ›
        </Link>
      </div>
      <ul className="mt-1">{hits.slice(0, 5).map(row)}</ul>
      {hits.length > 5 && (
        <details className="group border-t border-rule">
          <summary className="flex min-h-[44px] items-center justify-between px-3 text-small text-accent">
            View all {hits.length}
            <Chevron />
          </summary>
          <ul>{hits.slice(5).map(row)}</ul>
        </details>
      )}
    </section>
  );
}

/** The fold, openable: each group lists its filings with time and link. */
function Routine({ ed, refTime }: { ed: Edition; refTime: string }) {
  const items = ed.routine_items ?? [];
  return (
    <details className="group border-t border-rule">
      <summary className="flex min-h-[52px] items-center justify-between text-body text-ink-2">
        <span>
          Routine filings, folded <span className="num text-ink-3">· {ed.routine_total}</span>
        </span>
        <Chevron />
      </summary>
      <ul className="pb-3">
        {ed.routine.map(([label, n]) => {
          const mine = label === "Muted by you" ? null : items.filter((x) => x.label === label);
          return (
            <li key={label}>
              <details className="group/inner">
                <summary className="flex min-h-[44px] items-center justify-between text-small text-ink-2">
                  <span>{label}</span>
                  <span className="num flex items-center gap-2 text-ink-3">
                    {n}
                    <span aria-hidden className="transition-transform duration-200 group-open/inner:rotate-90">›</span>
                  </span>
                </summary>
                <ul className="mb-2 border-l border-rule pl-3">
                  {mine
                    ? mine.map((x, i) => {
                        const xml = (x.link ?? "").toLowerCase().endsWith(".xml");
                        return (
                          <li key={i} className="py-2 text-small">
                            <span className="font-medium text-ink-2">{x.symbol}</span>{" "}
                            <span className="text-ink-2">{x.subject.replace(/-XBRL$/i, "")}</span>{" "}
                            <span className="num text-meta text-ink-3">{when(x.at, refTime)}</span>
                            {/* an XBRL-only filing has no PDF: say what it holds here, label the raw file honestly */}
                            {xml && x.facts && x.facts.length > 0 && (
                              <span className="mt-0.5 block text-meta text-ink-3">
                                {x.facts
                                  .filter(([k]) => !/^Purpose|^Stage/.test(k))
                                  .slice(0, 5)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" · ")}
                              </span>
                            )}
                            {x.link && (
                              <a href={x.link} target="_blank" rel="noopener noreferrer" className="tap ml-2 text-meta text-accent">
                                {xml ? "XBRL data (XML) ↗" : "PDF ↗"}
                              </a>
                            )}
                          </li>
                        );
                      })
                    : (ed.muted ?? []).map((c) => (
                        <li key={c.id} className="py-1.5 text-small">
                          <Link href={`/card/${c.id}`} className="text-ink-2 hover:text-ink">
                            <span className="font-medium">{c.symbol}</span> {c.headline ?? c.nse_subject}
                          </Link>
                        </li>
                      ))}
                  {mine && mine.length === 0 && <li className="py-1.5 text-small text-ink-3">Counted; the individual filings arrive with the next update.</li>}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </details>
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
 *  that visit, not the wall clock, so filings that arrived late with earlier timestamps are not lost. */
function sinceEdition(ed30: Edition, since: string): Edition {
  const ist = (s: string) => Date.parse(/[+Z]/.test(s.slice(10)) ? s : `${s}+05:30`);
  const t = ist(since);
  const fresh = (c: Edition["leads"][number]) => ist(c.at) > t;
  const all = [...ed30.leads, ...ed30.more].filter(fresh);
  const items = (ed30.routine_items ?? []).filter((x) => ist(x.at) > t);
  const counts = new Map<string, number>();
  for (const x of items) counts.set(x.label, (counts.get(x.label) ?? 0) + 1);
  return {
    ...ed30,
    since,
    leads: all.filter((c) => c.tier === "lead"),
    more: all.filter((c) => c.tier !== "lead"),
    routine: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    routine_total: items.length,
    routine_items: items,
  };
}
