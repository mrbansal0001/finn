import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { InvestigateFlow, Step, type FlowPerson } from "@/components/InvestigateFlow";
import { MarginDots } from "@/components/MarginDots";
import { PromiseReplay } from "@/components/PromiseReplay";
import { pathFor } from "@/components/RelationPath";
import { SourceChips } from "@/components/SourceChips";
import { findCard, getLedger, getView } from "@/lib/data";
import { dirClass, fyQuarter, pct } from "@/lib/format";
import { fromCard, fromPromise, type Investigation } from "@/lib/investigate";
import { LENSES, peopleByLens, questionsFor, topicOf } from "@/lib/lenses";
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
  let ledgerCalls = null as Awaited<ReturnType<typeof getLedger>>;
  if (cardId) {
    const card = findCard(snap, cardId);
    if (!card) notFound();
    ledgerCalls = await getLedger(card.symbol);
    inv = fromCard(card, snap, ledgerCalls);
    // the card's own people first (they were chosen for this event), then whoever else knows the company
    const extra = (snap.people[card.symbol] ?? []).filter((l) => !card.network.some((x) => x.contact_id === l.contact_id));
    lines = [...card.network, ...extra];
    if (card.kind === "move") lines = lines.filter((l) => !l.insider); // never ask an insider why a stock moved (D-031)
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
    const row = ledger?.rows.find((r) => r.id === rowId) ?? ledger?.reference?.rows.find((r) => r.id === rowId);
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
    questions: Object.fromEntries(p.lenses.map((k) => [k, questionsFor(k, inv.company, !!p.line.insider, topicOf(inv.kind))])),
  }));

  const observed = inv.promise ? (
    <PromiseReplay row={inv.promise} calls={ledgerCalls!.reference?.rows.includes(inv.promise) ? ledgerCalls!.reference!.calls : ledgerCalls!.calls} />
  ) : (
    <>
      {inv.observed.length > 0 && (
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
      {inv.margin && <MarginDots m={inv.margin} />}
      {inv.sources.length > 0 && (
        <div className="mt-3">
          <SourceChips sources={inv.sources} />
        </div>
      )}
    </>
  );

  const check = (
    <Step n={3} title="Check next">
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
              {p.quote && <blockquote className="mt-1 line-clamp-4 font-serif text-small italic text-ink-2">&ldquo;{p.quote}&rdquo;</blockquote>}
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
    <main>
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
      />
      <p className="mt-8 text-caption text-ink-3">People are synthetic profiles for this prototype. Company facts and quotes are from filings.</p>
      <Dock />
    </main>
  );
}
