import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { InvestigateFlow, Step, type FlowPerson } from "@/components/InvestigateFlow";
import { ResultsVisual } from "@/components/ResultsVisual";
import { PriceVolumeChart } from "@/components/PriceVolumeChart";
import { filingMarkers } from "@/lib/markers";
import { PromiseReplay } from "@/components/PromiseReplay";
import { pathFor } from "@/components/RelationPath";
import { SourceChips } from "@/components/SourceChips";
import { findCard, getLedger, getView } from "@/lib/data";
import type React from "react";
import { dirClass, fyQuarter, pct } from "@/lib/format";
import { fromCard, fromPromise, type Investigation } from "@/lib/investigate";
import { LENSES, peopleByLens, questionsFor } from "@/lib/lenses";
import type { Card, NetworkLine } from "@/lib/types";

export const metadata = { title: "Investigate · FINN" };

export default function InvestigatePage({ searchParams }: PageProps<"/investigate">) {
  return (
    <Suspense fallback={<main aria-busy="true" className="pt-12 text-small text-ink-3">Opening…</main>}>
      <Investigate searchParams={searchParams} />
    </Suspense>
  );
}

async function Investigate({ searchParams }: { searchParams: PageProps<"/investigate">["searchParams"] }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const cardId = one(sp.card), sym = one(sp.c)?.toUpperCase(), rowId = one(sp.p);
  const snap = await getView();

  let inv: Investigation;
  let lines: NetworkLine[];
  let peopleNote: string | undefined;
  let ledgerCalls = null as Awaited<ReturnType<typeof getLedger>>;
  if (cardId) {
    const card = findCard(snap, cardId);
    if (!card) notFound();
    ledgerCalls = await getLedger(card.symbol);
    inv = fromCard(card, snap, ledgerCalls);
    // the card's own people first (they were chosen for this event), then whoever else knows the company
    const extra = (snap.people[card.symbol] ?? []).filter((l) => !card.network.some((x) => x.contact_id === l.contact_id));
    lines = [...card.network, ...extra];
    if (card.kind === "move") {
      // never ask an insider why a stock moved (D-031), but say they exist: the company page lists them,
      // and "no one" here would contradict it (visual review §3.1)
      const insiders = lines.filter((l) => l.insider);
      lines = lines.filter((l) => !l.insider);
      if (insiders.length)
        peopleNote = `${insiders.length} company connection${insiders.length === 1 ? "" : "s"} (${insiders.map((l) => l.name).join(", ")}) ${insiders.length === 1 ? "works" : "work"} there now. For a price move FINN doesn't suggest current employees: asking an insider why a stock moved is where leaks happen.`;
    }
  } else if (sym && one(sp.r) && snap.results[sym]?.comparatives) {
    // the company's latest filed results, when no edition card carries them (research-list names)
    const r = snap.results[sym];
    const card: Card = {
      id: `results-${sym}`, symbol: sym, company: snap.names[sym] ?? sym, kind: "results", tier: "notable", at: r.period_end,
      nse_subject: "Financial results", headline: `Latest results, ${fyQuarter(r.period_end)}`, headline_source: "rule", why: null,
      facts: { results: r }, sources: r.source_url ? [{ label: "Results PDF", url: r.source_url, page: null }] : [],
      network: [], score: 0, needs_read: false,
    };
    ledgerCalls = await getLedger(sym);
    inv = { ...fromCard(card, snap, ledgerCalls), eventHref: `/c/${encodeURIComponent(sym)}#results` };
    lines = snap.people[sym] ?? [];
  } else if (sym && rowId) {
    const ledger = await getLedger(sym);
    // ids are positional; when the title no longer matches (a rebuilt ledger), find the promise by its title
    const t = one(sp.t);
    const all = [...(ledger?.rows ?? []), ...(ledger?.reference?.rows ?? [])];
    const byId = all.find((r) => r.id === rowId);
    const row = t && byId?.title !== t ? (all.find((r) => r.title === t) ?? undefined) : byId;
    if (!ledger || !row) notFound();
    ledgerCalls = ledger;
    inv = fromPromise(row, ledger, snap);
    const verifier = snap.verifiers[`${sym}:${row.id}`];
    lines = [...(verifier ? [verifier] : []), ...(snap.people[sym] ?? []).filter((l) => l.contact_id !== verifier?.contact_id)];
  } else {
    notFound();
  }

  const today = new Date(snap.data_until);
  const from = cardId;
  const people: FlowPerson[] = peopleByLens(lines.slice(0, 8), snap.contacts, inv.symbol).map((p) => ({
    ...p,
    path: pathFor(p.line, snap.contacts, inv.symbol, today, from),
    questions: Object.fromEntries(p.lenses.map((k) => [k, questionsFor(k, inv.company, !!p.line.insider, inv.topic)])),
  }));

  // a move: the session in its last 30, with filings on their days (visual review §5)
  let moveChart: React.ReactNode = null;
  const theCard = cardId ? findCard(snap, cardId) : undefined;
  if (theCard?.kind === "move") {
    const rows = snap.price_history?.[theCard.symbol] ?? [];
    const alertDay = theCard.at.slice(0, 10);
    if (rows.length >= 5 && rows.some((r) => r.d === alertDay)) {
      const markers = filingMarkers(snap, theCard.symbol, rows.map((r) => r.d));
      moveChart = <PriceVolumeChart rows={rows} alertDay={alertDay} markers={markers} symbol={theCard.symbol} />;
    } else {
      // only this session is known: say so, never draw a guessed line
      moveChart = <p className="mt-3 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">Recent price history isn&apos;t available for this session, so FINN shows only the figures above against a 1× (usual) volume.</p>;
    }
  }
  const resultsFacts = theCard?.kind === "results" ? theCard.facts.results : sym && one(sp.r) ? snap.results[sym] : undefined;

  const observed = inv.promise ? (
    <PromiseReplay row={inv.promise} calls={ledgerCalls!.reference?.rows.includes(inv.promise) ? ledgerCalls!.reference!.calls : ledgerCalls!.calls} />
  ) : (
    <>
      {/* the chart's readout carries a move's figures; the grid only when there's no chart */}
      {inv.observed.length > 0 && !(theCard?.kind === "move" && snap.price_history?.[theCard.symbol]?.length) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {inv.observed.map((o) => (
            <div key={o.label} className="min-w-0">
              <dt className="truncate text-caption text-ink-3">{o.label}</dt>
              <dd className="num text-body font-medium text-ink">
                {o.value}
                {o.dir != null && o.label !== "Change" && <span className={`ml-1.5 text-small ${dirClass(o.dir)}`}>{pct(o.dir)}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {inv.observedNote && <p className="mt-2 text-caption text-ink-3">{inv.observedNote}</p>}
      {moveChart}
      {resultsFacts && <ResultsVisual r={resultsFacts} />}
      {inv.sources.length > 0 && (
        <div className="mt-3">
          <SourceChips sources={inv.sources} />
        </div>
      )}
    </>
  );

  const check = (
    <Step n={3} title="Check next" section="s-evidence">
      <p className="mt-2 text-small text-ink-2">{inv.passagesTitle}, in the company&apos;s own words.</p>
      {inv.passages.length ? (
        <ul className="hair mt-2">
          {inv.passages.map((p) => (
            <li key={p.title} className="py-3">
              <p className="text-caption text-ink-3">{p.label}</p>
              {p.open ? (
                <Link href={p.open} className="mt-0.5 block text-small font-medium text-ink hover:underline">
                  {p.title} <span className="text-accent">›</span>
                </Link>
              ) : (
                <p className="mt-0.5 text-small font-medium text-ink">{p.title}</p>
              )}
              {p.quote &&
                (p.quote.length <= 160 ? (
                  <blockquote className="mt-1 font-serif text-small italic text-ink-2">&ldquo;{p.quote}&rdquo;</blockquote>
                ) : (
                  // long quotes fold to an excerpt (visual review §3.4); the full words are one tap away
                  <details className="group mt-1">
                    <summary className="cursor-pointer list-none font-serif text-small italic text-ink-2">
                      &ldquo;{p.quote.slice(0, 150).replace(/\s+\S*$/, "")}…&rdquo;{" "}
                      <span className="font-sans text-caption not-italic text-accent group-open:hidden">Full quote</span>
                    </summary>
                    <blockquote className="mt-1 font-serif text-small italic text-ink-2">&ldquo;{p.quote}&rdquo;</blockquote>
                  </details>
                ))}
              {p.cite && (
                <a href={p.cite.href} target="_blank" rel="noopener noreferrer" className="tap mt-1 inline-flex text-caption text-accent">
                  {p.cite.text} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">{inv.passagesEmpty}</p>
      )}
    </Step>
  );

  return (
    <main className="wide-page">
      <BackLink fallback={inv.eventHref ?? `/c/${encodeURIComponent(inv.symbol)}`} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="kicker text-accent">Investigate</span>
        <Link href={`/c/${encodeURIComponent(inv.symbol)}`} className="chip tap">
          {inv.symbol}
        </Link>
        <span className="tag">{inv.kicker}</span>
      </div>
      <p className="mt-2 text-small text-ink-2">
        {inv.eventHref ? (
          <Link href={inv.eventHref} className="hover:underline">
            {inv.title} <span className="text-ink-3">›</span>
          </Link>
        ) : (
          inv.title
        )}
      </p>
      <div className="min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,1fr)_340px] min-[1100px]:gap-12">
      <div className="min-w-0">
      <InvestigateFlow
        initialQuestion={inv.question}
        symbol={inv.symbol}
        company={inv.company}
        title={inv.title}
        observed={observed}
        unclear={inv.unclear}
        check={check}
        lenses={LENSES.map(({ key, label, ask, roles }) => ({ key, label, ask, roles }))}
        people={people}
        lensOrder={inv.lens}
        revisit={inv.revisit}
        networkDown={snap.network_status === "unavailable"}
        peopleNote={peopleNote}
      />
      </div>
      {/* wide screens: the evidence stays beside the question instead of several screens down (§12) */}
      <aside className="hidden min-[1100px]:block">
        <div className="sticky top-6 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6">{check}</div>
      </aside>
      </div>
      <p className="mt-8 text-caption text-ink-3">People are synthetic profiles for this prototype. Company facts and quotes are from filings.</p>
      <Dock />
    </main>
  );
}
