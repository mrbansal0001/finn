import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { alertsFor, applyPrefs, filedAlertsFor, parsePrefs, PREFS_COOKIE, type Alert, type Prefs } from "@/lib/prefs";
import { getLedgerIndex, getView } from "@/lib/data";
import type { Card, Edition, Snapshot, WindowKey } from "@/lib/types";
import { dirClass, fullDate, KIND_LABEL, pct, shortDay, when } from "@/lib/format";
import { EditionCard } from "@/components/EditionCard";
import { MoveSpark } from "@/components/MoveSpark";
import { FollowedQuestions } from "@/components/FollowedQuestions";
import { Dock } from "@/components/Dock";
import { EditionSkeleton } from "@/components/Skeletons";
import { SYNTHETIC } from "@/components/About";
import { JumpLink } from "@/components/JumpLink";
import { FirstVisit } from "@/components/FirstVisit";
import { StaleNote } from "@/components/StaleNote";
import { ReconnectLine } from "@/components/ReconnectLine";
import { reconnects, type Reconnect } from "@/lib/warm";
import { lensLabel } from "@/lib/lenses";
import { DOOR_CLASS, DoorTile } from "@/components/DoorTile";
import { HoldingsSheet } from "@/components/HoldingsSheet";
import { WindowLink, WindowSwitcher } from "@/components/WindowSwitcher";

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

// how the folded alerts are described in each window
const SPAN: Record<string, string> = { "24h": "in the last 24 hours", "3d": "in the last 3 days", "7d": "this week", "30d": "in the last 30 days", since: "since your last visit" };

const LEAD_COUNT_WORDS = ["No lead story", "One thing matters", "Two things matter", "Three things matter", "Four things matter", "Five things matter"];

export default function EditionPage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<EditionSkeleton />}>
      <Edition searchParams={searchParams} />
    </Suspense>
  );
}

async function Edition({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [sp, jar, snap, ledgers] = await Promise.all([searchParams, cookies(), getView(), getLedgerIndex()]);
  const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
  const sinceVisit = sp.w === "since" && typeof sp.t === "string" && !Number.isNaN(Date.parse(sp.t)) ? sp.t : null;
  // the brief: "by default the last 24 hours, but let me pick the period"
  const w = sinceVisit ? "since" : (WINDOWS.find((x) => x.key === sp.w)?.key ?? "24h");
  const moveCards = snap.move_cards ?? [];
  const until = snap.data_until;

  const holdingSet = new Set(snap.portfolio.map((h) => h.symbol));
  // every window is prepared now, so switching between them needs no trip to the server
  const prepared: Record<string, { ed: Edition; alerts: Alert[] }> = {};
  const keys: string[] = [...WINDOWS.map((x) => x.key), ...(sinceVisit ? ["since"] : [])];
  for (const key of keys) {
    const base = key === "since" ? sinceEdition(snap.editions["30d"], sinceVisit!) : snap.editions[key as WindowKey];
    const ed = applyPrefs(structuredClone(base), prefs, moveCards, holdingSet);
    prepared[key] = { ed, alerts: moveCards.length ? alertsFor(moveCards, ed.since, ed.until, prefs) : legacyAlerts(ed, prefs) };
  }
  const week = [...snap.editions["7d"].leads, ...snap.editions["7d"].more];
  // announced events ahead: dates the companies themselves filed (investor meets, calls), never guessed (§11)
  const today = until.slice(0, 10);
  const covered = new Set([...snap.portfolio.map((h) => h.symbol), ...snap.research_set]);
  const seen = new Set<string>();
  const agenda = (snap.editions["30d"].routine_items ?? [])
    .filter((it) => covered.has(it.symbol))
    .flatMap((it) =>
      (it.facts ?? [])
        .filter(([k]) => /^(date|call date|meeting date)$/i.test(k))
        .map(([, v]) => ({ symbol: it.symbol, date: isoDate(v), label: agendaLabel(it.facts ?? [], it.label), link: it.link })),
    )
    .filter((e): e is { symbol: string; date: string; label: string; link: string | null } => !!e.date && e.date >= today)
    .filter((e) => !seen.has(`${e.symbol}${e.date}${e.label}`) && !!seen.add(`${e.symbol}${e.date}${e.label}`))
    .sort((a, b) => a.date.localeCompare(b.date));
  const row = (s: string, weight = 0) => ({
    symbol: s, name: (snap.names[s] ?? s).replace(/ Limited$/, ""), sector: snap.portfolio.find((h) => h.symbol === s)?.sector ?? "", weight,
    // what FINN knows about it: coverage, people, this week's items (never a risk score)
    ledger: !!ledgers[s], built: ledgers[s]?.built ?? null, lastCall: ledgers[s]?.lastCall ?? null,
    people: (snap.people[s] ?? []).length, updates: week.filter((c) => c.symbol === s).length,
    latest: week.filter((c) => c.symbol === s).map((c) => c.at).sort().pop() ?? null,
  });

  return (
    <main>
      <WindowSwitcher
        initial={w}
        tabs={WINDOWS.map((x) => ({ ...x, href: x.key === "24h" ? "/" : `/?w=${x.key}` }))}
        scripts={Object.fromEntries(keys.map((k) => [k, briefScript(prepared[k].ed, prepared[k].alerts.length)]))}
        wordmark={<h1 className="font-serif text-display font-semibold tracking-[-0.02em]">FINN</h1>}
        masthead={
          <>
            {/* the map, on a device's first visit only (three-pillars plan §2) */}
            <FirstVisit />
            <p className="mt-1 text-small font-medium text-ink">{fullDate(until)}</p>
            {/* the three doors: the app's three parts, named and counted (three-pillars plan §2) */}
            <nav aria-label="FINN's three parts" className="mt-3 flex gap-2">
              <HoldingsSheet agenda={agenda} today={today} networkReady={snap.network_status !== "unavailable"} holdings={snap.portfolio.map((h) => row(h.symbol, h.weight))} research={snap.research_set.map((s) => row(s))} />
              <Link href="/research" className={DOOR_CLASS} aria-label={`Research: ${Object.keys(snap.ledger_index ?? ledgers).length} companies read`}>
                <DoorTile icon="research" label="Research" sub={`${Object.keys(snap.ledger_index ?? ledgers).length} read`} />
              </Link>
              <Link href="/people" className={DOOR_CLASS} aria-label={snap.network_status === "unavailable" ? "People" : `People: ${snap.contacts.length} in your network`}>
                <DoorTile
                  icon="people"
                  label="People"
                  sub={snap.network_status !== "unavailable" && snap.contacts.length > 0 ? `${snap.contacts.length} people` : "Your network"}
                />
              </Link>
            </nav>
          </>
        }
        sinceSeen={until}
        panels={Object.fromEntries(
          keys.map((k) => [
            k,
            <Panel key={k} k={k} ed={prepared[k].ed} alerts={prepared[k].alerts} prefs={prefs} until={until} networkDown={snap.network_status === "unavailable"} history={snap.price_history} latest={snap.freshness?.price_session ?? null} holdings={holdingSet} index={snap.ledger_index} lastOk={snap.freshness?.worker_last_ok?.announcements ?? null} contacts={snap.contacts}
              reconnect={snap.network_status === "unavailable" ? undefined : reconnects(snap.contacts, [...prepared[k].ed.leads, ...prepared[k].ed.more], until)[0]}
            />,
          ]),
        )}
      />

      <footer className="mt-10 text-center">
        {/* the end of the edition: a rule either side, not a pair of dots */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-rule" />
          <span className="font-serif text-body text-ink-3">End of edition</span>
          <span className="h-px flex-1 bg-rule" />
        </div>
        <p className="mt-2 text-caption text-ink-3">
          Filings to <span className="num">{when(snap.freshness?.filings_until ?? until, until)}</span> IST
          {snap.freshness?.price_session && (
            <>
              , prices to the <span className="num">{shortDay(snap.freshness.price_session)}</span> close
            </>
          )}
          .
        </p>
        {/* the demo disclaimer lives here, said once (layout plan §3, §9.6) */}
        <p className="mt-1 text-caption text-ink-3">A demo portfolio. {SYNTHETIC}</p>
      </footer>

      <Dock />
    </main>
  );
}

/** One window's edition: its start time, alerts, leads, the rest worth a look, and the routine fold. */
function Panel({
  k, ed, alerts, prefs, until, networkDown, history, latest, holdings, index, lastOk, reconnect, contacts,
}: {
  contacts: Snapshot["contacts"];
  reconnect?: Reconnect;
  lastOk: string | null;
  k: string; ed: Edition; alerts: Alert[]; prefs: Prefs; until: string; networkDown: boolean; history?: Snapshot["price_history"]; latest: string | null;
  holdings?: Set<string>; index?: Snapshot["ledger_index"];
}) {
  const wider = WIDER[k];
  const lead = LEAD_COUNT_WORDS[ed.leads.length];
  // the edition in one sentence: how big today is, each part a jump to its section (layout plan §3)
  const parts: [string, string][] = [
    ...(ed.leads.length ? [[`leads-${k}`, lead.replace(/^One/, "1").replace(/^Two/, "2").replace(/^Three/, "3").replace(/^Four/, "4").replace(/^Five/, "5")] as [string, string]] : []),
    ...(alerts.length ? [[`alerts-${k}`, `${alerts.length} alert${alerts.length === 1 ? "" : "s"}`] as [string, string]] : []),
    ...(ed.more.length ? [[`more-${k}`, `${ed.more.length} worth a look`] as [string, string]] : []),
    ...(ed.routine_total ? [[`routine-${k}`, `${ed.routine_total} routine`] as [string, string]] : []),
  ];
  return (
    <>
      <p className="mt-3 text-small text-ink-2">
        {parts.length ? (
          parts.map(([id, label], i) => (
            <span key={id}>
              {i > 0 ? ", " : ""}
              <JumpLink to={id}>{label}</JumpLink>
            </span>
          ))
        ) : (
          <span>A quiet window</span>
        )}
        .
        <FollowedQuestions variant="inline" />
      </p>
      <StaleNote lastOk={lastOk} />

      {networkDown && (
        <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
          Your private demo network didn&apos;t load just now. Reload in a minute; filings and numbers are unaffected.
        </p>
      )}

      <Alerts
        hits={alerts}
        filed={holdings ? filedAlertsFor([...ed.leads, ...ed.more], prefs, holdings) : []}
        prefs={prefs}
        id={`alerts-${k}`}
        history={history}
        latest={latest}
        span={SPAN[k] ?? "in this window"}
        refTime={until}
      />

      <section aria-labelledby={`leads-${k}`} className="mt-10 scroll-mt-4">
        <h2 id={`leads-${k}`} className="section-h text-ink">
          {lead}
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
                <WindowLink to={wider.key} href={`/?w=${wider.key}`} className="tap whitespace-nowrap text-accent">
                  See {wider.label} ›
                </WindowLink>
              </>
            )}
          </p>
        ) : (
          <div className="hair">
            {ed.leads.map((c) => (
              <EditionCard
                key={c.id}
                card={c}
                refTime={until}
                history={history?.[c.symbol]}
                research={!!holdings && !holdings.has(c.symbol)}
                promise={c.kind === "results" ? index?.[c.symbol]?.tracked ?? undefined : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* keeping the network warm: one natural reason to reconnect, from this window's filings (brief, Network) */}
      {reconnect && (
        <section className="mt-8" aria-labelledby={`warm-${k}`}>
          <h2 id={`warm-${k}`} className="kicker text-ink-3">
            A reason to reconnect
          </h2>
          <ReconnectLine r={reconnect} />
        </section>
      )}

      {/* the reader's own questions, after today's news and before the long tail */}
      <FollowedQuestions />

      {ed.more.length > 0 && (
        <details id={`more-${k}`} className="group mt-8 scroll-mt-4" open={ed.leads.length === 0}>
          <SectionSummary label="Worth a look" count={ed.more.length} />
          <div className="hair">
            {ed.more.map((c) => (
              <EditionCard
                key={c.id}
                card={c}
                refTime={until}
                compact
                history={c.kind === "move" ? history?.[c.symbol] : undefined}
                research={!!holdings && !holdings.has(c.symbol)}
                lens={c.network?.[0] ? lensLabel(contacts.find((x) => x.id === c.network[0].contact_id), c.symbol) : undefined}
              />
            ))}
          </div>
        </details>
      )}

      {ed.routine_total > 0 && <Routine ed={ed} refTime={until} id={`routine-${k}`} />}
    </>
  );
}

/** What "Listen" reads for a window: the leads, the alert count, what's left. Prepared on the server. */
function briefScript(ed: Edition, alerts: number): string {
  const n = ed.leads.length;
  return [
    n ? `${n} ${n === 1 ? "thing matters" : "things matter"}.` : "No single item leads this window.",
    alerts ? `${alerts} price or volume ${alerts === 1 ? "alert" : "alerts"} at the close.` : "",
    ...ed.leads.map((c) => `${c.company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "")}. ${c.headline ?? c.nse_subject}. ${c.why ?? ""}`),
    ed.more.length ? `${ed.more.length} more worth a look, and ${ed.routine_total} routine filings folded.` : "",
    "End of edition.",
  ]
    .filter(Boolean)
    .join(" ");
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

/** Alerts (brief, Push 2), in two groups: price and volume at the latest close, by the investor's own rules,
 *  and filings of the kinds they asked for (results, deals, management changes) for their holdings. At most
 *  three rows show; the rest fold under one line. The thresholds are said in the group's own label, so the box
 *  needs no separate rules row (brief-check plan, part 4). Every row opens its own card. */
function Alerts({
  hits, filed, prefs, id, history, latest, span, refTime,
}: {
  hits: Alert[]; filed: Card[]; prefs: Prefs; id: string; history?: Snapshot["price_history"]; latest: string | null; span: string; refTime: string;
}) {
  if (!hits.length && !filed.length) return null;
  const closeHits = latest ? hits.filter((h) => h.card.at.slice(0, 10) === latest) : hits;
  // filings since the latest close's day are "today"; older ones fold
  const todayFiled = latest ? filed.filter((c) => c.at.slice(0, 10) >= latest) : filed.slice(0, 2);
  const priceShown = closeHits.slice(0, todayFiled.length ? 2 : 3);
  const filedShown = todayFiled.slice(0, 3 - priceShown.length); // the filed rows take the room the price rows leave
  const priceRest = hits.filter((h) => !priceShown.includes(h));
  const filedRest = filed.filter((c) => !filedShown.includes(c));
  const count = closeHits.length + todayFiled.length;
  const priceRow = ({ card, rules }: Alert) => {
    const f = card.facts as { change_pct?: number; volume_multiple?: number };
    const priceFired = rules.some((r) => r.endsWith("%"));
    return (
      <li key={card.id} className="border-t border-rule">
        <Link
          href={`/card/${card.id}`}
          className="grid min-h-[52px] grid-cols-[minmax(0,1fr)_3.75rem_3.5rem_4.25rem_0.5rem] items-center gap-1.5 px-4 py-1.5 hover:bg-paper-raised/60 max-[389px]:grid-cols-[minmax(0,1fr)_3rem_3.25rem_4rem_0.5rem] max-[389px]:gap-1 max-[359px]:grid-cols-[minmax(0,1fr)_4.25rem_4.75rem_0.5rem]"
        >
          {/* the date sits under the ticker, so the ticker keeps its room at larger text sizes */}
          <span className="min-w-0">
            <span className="ticker block truncate text-small text-ink">{card.symbol}</span>
            <span className="num block text-caption text-ink-3">{shortDay(card.at)}</span>
          </span>
          {/* a word-sized picture of the alert: 20 sessions of price, volume bars, the alert day marked */}
          <span className="max-[389px]:[&>svg]:w-12 max-[359px]:hidden">
            <MoveSpark
              width={60}
              rows={history?.[card.symbol]}
              day={card.at.slice(0, 10)}
              label={`${card.symbol}: the last 20 closes as a line, each day's volume as a bar, the alert day in blue`}
            />
          </span>
          <span className={`num text-right text-small ${priceFired ? `font-medium ${dirClass(f.change_pct)}` : "text-ink-2"}`}>
            {pct(f.change_pct)}
          </span>
          {/* one wording with the headlines ("usual volume"), small enough to stay on one line (S11) */}
          <span className="num whitespace-nowrap text-right text-small text-ink-2">
            {(f.volume_multiple ?? 0).toFixed(1)}×<span className="text-caption text-ink-3"> usual</span>
          </span>
          <span aria-hidden className="go text-right">›</span>
        </Link>
      </li>
    );
  };
  const filedRow = (c: Card) => (
    <li key={c.id} className="border-t border-rule">
      <Link href={`/card/${c.id}`} className="grid min-h-[52px] grid-cols-[minmax(0,6.75rem)_minmax(0,1fr)_0.5rem] items-center gap-2 px-4 py-1.5 hover:bg-paper-raised/60">
        <span className="min-w-0">
          <span className="ticker block truncate text-small text-ink">{c.symbol}</span>
          <span className="num block text-caption text-ink-3">{when(c.at, refTime).includes(",") ? shortDay(c.at) : "Today"}</span>
        </span>
        <span className="min-w-0">
          <span className="kicker block text-ink-3">{KIND_LABEL[c.kind] ?? "Filing"}</span>
          <span className="line-clamp-2 text-small text-ink">{c.headline ?? c.nse_subject}</span>
        </span>
        <span aria-hidden className="go text-right">›</span>
      </Link>
    </li>
  );
  return (
    <section aria-labelledby={id} className="mt-6 scroll-mt-4 overflow-hidden rounded-lg border border-rule bg-tint">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
        <h2 id={id} className="flex items-center gap-2">
          <span className="kicker text-ink">Alerts</span>
          <span className="count" aria-label={`${count} at the latest close`}>{count}</span>
        </h2>
        <Link href="/settings" className="tap shrink-0 text-caption text-accent">
          Your rules ›
        </Link>
      </div>
      {/* each group says its own rule, so nobody has to remember it (P3) */}
      {/* the rule, and when nothing met it, that too: one line, no empty row (design review 1.12a) */}
      <p className="px-4 pb-2 text-caption text-ink-3">
        Price <span className="num">±{prefs.price_pct}%</span> or volume <span className="num">{prefs.volume_x}×</span>
        {priceShown.length ? (latest ? `, at the ${shortDay(latest + "T15:30:00")} close` : "") : `: none at the ${latest ? `${shortDay(latest + "T15:30:00")} ` : "latest "}close`}
      </p>
      {priceShown.length > 0 && <ul>{priceShown.map(priceRow)}</ul>}
      {filedShown.length > 0 && (
        <>
          {/* the kinds are in Your rules; the caption says when, not which (1.12b) */}
          <p className="border-t border-rule px-4 pb-1 pt-2 text-caption text-ink-3">Filed today</p>
          <ul className="[&>li:first-child]:border-t-0">{filedShown.map(filedRow)}</ul>
        </>
      )}
      {priceRest.length + filedRest.length > 0 && (
        <details className="group border-t border-rule">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-small text-accent">
            {priceRest.length + filedRest.length} more {span}
            <span aria-hidden className="transition-transform duration-200 group-open:rotate-90">›</span>
          </summary>
          {priceRest.length > 0 && (
            <>
              {/* the key for the word-sized charts, said once, where the longer list is */}
              <p className="px-4 pb-1.5 text-caption text-ink-3 max-[359px]:hidden">
                Line: the last 20 closes. Bars: each day&apos;s volume, the alert day in blue{" "}
                <span aria-hidden className="inline-block h-2.5 w-1 rounded-[1px] bg-accent align-[-1px]" />.
              </p>
              <ul>{priceRest.map(priceRow)}</ul>
            </>
          )}
          {filedRest.length > 0 && (
            <>
              <p className="border-t border-rule px-4 pb-1 pt-2 text-caption text-ink-3">Filed</p>
              <ul className="[&>li:first-child]:border-t-0">{filedRest.map(filedRow)}</ul>
            </>
          )}
        </details>
      )}
    </section>
  );
}

/** The fold, openable (plan §9.1): each group lists its filings, one row each, with time and a source chip. */
function Routine({ ed, refTime, id }: { ed: Edition; refTime: string; id: string }) {
  const items = ed.routine_items ?? [];
  return (
    <details id={id} className="group mt-8 scroll-mt-4">
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
                              <span className="ticker shrink-0 text-ink">{x.symbol}</span>
                              <span className="min-w-0 flex-1 truncate text-ink-2">{x.subject.replace(/-XBRL$/i, "")}</span>
                              <span className="num shrink-0 text-caption text-ink-3">{when(x.at, refTime)}</span>
                            </div>
                            {/* an XBRL-only filing has no PDF: say what it holds here, label the raw file honestly */}
                            {xml && x.facts && x.facts.length > 0 && (
                              <dl className="mt-1 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-0.5 text-caption">
                                {x.facts
                                  .filter(([k]) => !/^Purpose|^Stage/.test(k))
                                  .slice(0, 6)
                                  .map(([k, v]) => (
                                    <div key={k + v} className="contents">
                                      <dt className="text-ink-3">{k}</dt>
                                      <dd className="text-ink-2">{v}</dd>
                                    </div>
                                  ))}
                              </dl>
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
                                  PDF ↗︎
                                </a>
                              ))}
                          </li>
                        );
                      })
                    : (ed.muted ?? []).map((c) => (
                        <li key={c.id} className="py-2 text-small">
                          <Link href={`/card/${c.id}`} className="text-ink-2 hover:text-ink">
                            <span className="ticker text-ink">{c.symbol}</span> {c.headline ?? c.nse_subject}
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

/** "20 Nov 2026" -> "2026-11-20"; null when the filing's date can't be read. */
function isoDate(v: string): string | null {
  const t = Date.parse(`${v} 12:00 GMT+0530`);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** What an announced meeting is, from the filing's own facts: the event's name, or the kind of meeting and
 *  with whom, and where (three-pillars plan S14). The filing's category is the fallback. */
function agendaLabel(facts: [string, string][], fallback: string): string {
  const f = Object.fromEntries(facts);
  const where = f["Place"] ? `, ${f["Place"]}` : "";
  if (f["Event"] && !/^organi[sz]ed by/i.test(f["Event"])) return `${f["Event"]}${where}`;
  const kind = (f["Meeting"] ?? "").replace(/^Others$/i, "").trim();
  const who = f["Investor"] && !/^(multiple|group)/i.test(f["Investor"]) ? ` with ${f["Investor"]}` : "";
  if (kind) return `${kind.charAt(0).toUpperCase()}${kind.slice(1).toLowerCase()}${who}${where}`;
  if (f["Event"]) return `Investor meetings ${f["Event"].charAt(0).toLowerCase()}${f["Event"].slice(1)}${where}`;
  return fallback;
}
