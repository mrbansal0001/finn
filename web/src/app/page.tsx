import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { alertsFor, applyPrefs, parsePrefs, PREFS_COOKIE, type Alert, type Prefs } from "@/lib/prefs";
import { getView } from "@/lib/data";
import type { Edition, WindowKey } from "@/lib/types";
import { dirClass, longDate, pct, shortDay, since, when } from "@/lib/format";
import { EditionCard } from "@/components/EditionCard";
import { Dock } from "@/components/Dock";
import { BriefButton } from "@/components/BriefButton";
import { HoldingsSheet } from "@/components/HoldingsSheet";
import { ThemeToggle } from "@/components/ThemeToggle";
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
      <h1 className="font-serif text-display font-semibold">FINN</h1>
      <p className="mt-1 text-caption text-ink-3">Preparing your edition…</p>
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
  const row = (s: string, weight = 0) => ({ symbol: s, name: (snap.names[s] ?? s).replace(/ Limited$/, ""), sector: snap.portfolio.find((h) => h.symbol === s)?.sector ?? "", weight });

  return (
    <main>
      {/* masthead (plan §8.1) */}
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-display font-semibold tracking-[-0.02em]">FINN</h1>
        <div className="-mr-2 flex items-center">
          <BriefButton edition={ed} alerts={alerts.length} />
          <ThemeToggle />
        </div>
      </header>
      {/* a div, not a p: the holdings sheet (a dialog) sits inside this line */}
      <div className="text-small text-ink-2">
        <span className="font-medium text-ink">{longDate(until)}</span>
        {" · "}
        <HoldingsSheet holdings={snap.portfolio.map((h) => row(h.symbol, h.weight))} research={snap.research_set.map((s) => row(s))} />
        {" · since "}
        <span className="num">{since(ed.since)}</span>
      </div>
      <p className="mt-0.5 text-caption text-ink-3">Demo portfolio · real filings and prices · synthetic network</p>

      <nav aria-label="Edition window" className="-mx-1 mt-4 flex gap-1 overflow-x-auto">
        <SinceLastVisit active={!!sinceVisit} seen={until} />
        {WINDOWS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "24h" ? "/" : `/?w=${x.key}`}
            aria-current={x.key === w && !sinceVisit ? "page" : undefined}
            aria-label={x.label}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap rounded-full px-4 text-small transition-colors max-[359px]:px-3 ${
              x.key === w && !sinceVisit ? "bg-ink font-medium text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            {/* very narrow phones get the short form so all four fit */}
            <span className="max-[359px]:hidden">{x.label}</span>
            <span className="hidden max-[359px]:inline">{x.short}</span>
          </Link>
        ))}
      </nav>

      {snap.network_status === "unavailable" && (
        <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
          Your private demo network didn&apos;t load just now. Reload in a minute; filings and numbers are unaffected.
        </p>
      )}

      <Alerts hits={alerts} prefs={prefs} />

      <section aria-labelledby="leads" className="mt-10">
        <h2 id="leads" className="section-h text-ink">
          {LEAD_COUNT_WORDS[ed.leads.length]}
        </h2>
        {ed.leads.length === 0 ? (
          <p className="py-4 text-body text-ink-2">
            {ed.more.length
              ? `Quiet window. ${ed.more.length} update${ed.more.length === 1 ? "" : "s"} worth a look below.`
              : alerts.length
                ? "Quiet window. Only the price and volume alerts above."
                : `Quiet window. ${ed.routine_total} routine filing${ed.routine_total === 1 ? "" : "s"}, nothing material.`}
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
        <details className="group mt-10" open={ed.leads.length === 0}>
          <SectionSummary label="Worth a look" count={ed.more.length} />
          <div className="hair">
            {ed.more.map((c) => (
              <EditionCard key={c.id} card={c} refTime={until} compact />
            ))}
          </div>
        </details>
      )}

      {ed.routine_total > 0 && <Routine ed={ed} refTime={until} />}

      <footer className="mt-12 text-center">
        <p className="font-serif text-body font-normal italic text-ink-3">· end of edition ·</p>
        <p className="mt-2 text-caption text-ink-3">
          Filings to <span className="num">{when(snap.freshness?.filings_until ?? until, until)}</span> IST
          {snap.freshness?.price_session && (
            <>
              {" "}· prices to the <span className="num">{shortDay(snap.freshness.price_session)}</span> close
            </>
          )}
        </p>
      </footer>

      <Dock />
    </main>
  );
}

/** A section heading that opens and closes: label, count at the right, a chevron that turns. */
function SectionSummary({ label, count }: { label: string; count: number }) {
  return (
    <summary className="section-h min-h-[44px] items-center text-ink">
      <span>{label}</span>
      <span className="flex items-center gap-2 font-normal normal-case tracking-normal text-ink-3">
        <span className="num text-caption">{count}</span>
        <span aria-hidden className="text-small transition-transform duration-200 group-open:rotate-90">›</span>
      </span>
    </summary>
  );
}

/** Price/volume rule matches in this window (plan §8.2): every matching session, each opening its own card.
 *  Columns line up; the price change is always shown, in colour when it fired. In-app only. */
function Alerts({ hits, prefs }: { hits: Alert[]; prefs: Prefs }) {
  if (!hits.length) return null;
  const row = ({ card, rules }: Alert) => {
    const f = card.facts as { change_pct?: number; volume_multiple?: number };
    const priceFired = rules.some((r) => r.endsWith("%"));
    return (
      <li key={card.id} className="border-t border-rule first:border-t-0">
        <Link
          href={`/card/${card.id}`}
          className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_4.25rem_5rem] items-center gap-2 px-4 py-1.5 hover:bg-paper-raised/60"
        >
          {/* the date sits under the ticker, so the ticker keeps its room at larger text sizes */}
          <span className="min-w-0">
            <span className="block truncate text-small font-medium text-ink">{card.symbol}</span>
            <span className="num block text-caption text-ink-3">{shortDay(card.at)}</span>
          </span>
          <span className={`num text-right text-small ${priceFired ? `font-medium ${dirClass(f.change_pct)}` : "text-ink-2"}`}>
            {pct(f.change_pct)}
          </span>
          <span className="num text-right text-small text-ink-2">{(f.volume_multiple ?? 0).toFixed(1)}× vol</span>
        </Link>
      </li>
    );
  };
  return (
    <section aria-labelledby="alerts" className="mt-6 overflow-hidden rounded-lg border border-rule bg-tint">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
        <h2 id="alerts" className="kicker text-ink">
          Alerts · <span className="num">{hits.length}</span>{" "}
          <span className="text-caption font-normal normal-case tracking-normal text-ink-3">at the close</span>
        </h2>
        <Link href="/settings" className="tap shrink-0 text-caption text-accent">
          <span className="num">±{prefs.price_pct}% · {prefs.volume_x}×</span> ›
        </Link>
      </div>
      <ul>{hits.slice(0, 5).map(row)}</ul>
      {hits.length > 5 && (
        <details className="group border-t border-rule">
          <summary className="flex min-h-[48px] items-center justify-between px-4 text-small text-accent">
            View all {hits.length}
            <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>
          <ul className="border-t border-rule">{hits.slice(5).map(row)}</ul>
        </details>
      )}
    </section>
  );
}

/** The fold, openable (plan §9.1): each group lists its filings, one row each, with time and a source chip. */
function Routine({ ed, refTime }: { ed: Edition; refTime: string }) {
  const items = ed.routine_items ?? [];
  return (
    <details className="group mt-10">
      <SectionSummary label="Routine, folded" count={ed.routine_total} />
      <ul>
        {ed.routine.map(([label, n]) => {
          const mine = label === "Muted by you" ? null : items.filter((x) => x.label === label);
          return (
            <li key={label} className="border-b border-rule">
              <details className="group/inner">
                <summary className="flex min-h-[48px] items-center justify-between text-small text-ink-2">
                  <span>{label}</span>
                  <span className="flex items-center gap-2 text-ink-3">
                    <span className="num text-caption">{n}</span>
                    <span aria-hidden className="transition-transform duration-200 group-open/inner:rotate-90">›</span>
                  </span>
                </summary>
                <ul className="mb-3 ml-1 border-l border-rule pl-3">
                  {mine
                    ? mine.map((x, i) => {
                        const xml = (x.link ?? "").toLowerCase().endsWith(".xml");
                        return (
                          <li key={i} className="py-2">
                            <div className="flex min-h-[28px] items-baseline gap-2 text-small">
                              <span className="shrink-0 font-medium text-ink">{x.symbol}</span>
                              <span className="min-w-0 flex-1 truncate text-ink-2">{x.subject.replace(/-XBRL$/i, "")}</span>
                              <span className="num shrink-0 text-caption text-ink-3">{when(x.at, refTime)}</span>
                            </div>
                            {/* an XBRL-only filing has no PDF: say what it holds here, label the raw file honestly */}
                            {xml && x.facts && x.facts.length > 0 && (
                              <p className="mt-0.5 text-caption text-ink-3">
                                {x.facts
                                  .filter(([k]) => !/^Purpose|^Stage/.test(k))
                                  .slice(0, 6)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" · ")}
                              </p>
                            )}
                            {/* a PDF is the document; an XBRL-only filing's facts are shown above, so its raw data
                                file is a quiet secondary link, not a "filing" that opens code */}
                            {x.link &&
                              (xml ? (
                                <a href={x.link} target="_blank" rel="noopener noreferrer" className="tap mt-1 inline-flex text-caption text-ink-3 underline decoration-rule underline-offset-2">
                                  raw source (XBRL)
                                </a>
                              ) : (
                                <a href={x.link} target="_blank" rel="noopener noreferrer" className="tap mt-1 inline-flex text-caption text-accent">
                                  PDF ↗
                                </a>
                              ))}
                          </li>
                        );
                      })
                    : (ed.muted ?? []).map((c) => (
                        <li key={c.id} className="py-2 text-small">
                          <Link href={`/card/${c.id}`} className="text-ink-2 hover:text-ink">
                            <span className="font-medium text-ink">{c.symbol}</span> {c.headline ?? c.nse_subject}
                          </Link>
                        </li>
                      ))}
                  {mine && mine.length === 0 && <li className="py-2 text-caption text-ink-3">Counted; the individual filings arrive with the next update.</li>}
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
