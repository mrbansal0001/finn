import Link from "next/link";
import { Dock } from "@/components/Dock";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getView } from "@/lib/data";
import { KIND_LABEL, when } from "@/lib/format";
import { NetworkLine } from "@/components/NetworkLine";
import { ResultsTable } from "@/components/ResultsTable";
import { SourceChips } from "@/components/SourceChips";

// Mirrors worker/src/finn_worker/cards.py so the explanation matches the ranking exactly.
const TIER_WEIGHT: Record<string, number> = { lead: 300, notable: 200, routine: 0 };
const KIND_WEIGHT: Record<string, number> = {
  litigation: 60, management_change: 55, m_and_a: 50, results: 45, move: 40, credit_rating: 35, fund_raise: 30,
  capex: 28, pledging: 27, insider_trading: 26, press_release: 20, earnings_call: 18, dividend: 15, bonus_split: 15, unclassified: 10,
};

export default function CardPage({ params }: PageProps<"/card/[id]">) {
  return (
    <Suspense fallback={<main aria-busy="true" className="pt-12 text-[0.8125rem] text-ink-3">Opening…</main>}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/card/[id]">["params"] }) {
  const { id } = await params;
  const snap = await getView();
  const ed = snap.editions["30d"];
  const card = [...ed.leads, ...ed.more].find((c) => c.id === id);
  if (!card) notFound();
  const weight = snap.portfolio.find((h) => h.symbol === card.symbol)?.weight ?? 0;
  const ageH = (new Date(snap.data_until).getTime() - new Date(card.at).getTime()) / 3_600_000;
  const people = (card.facts.people as { name: string; change: string; role: string; orgs: { org: string; start?: string; end?: string }[]; schools: string[] }[] | undefined) ?? [];

  return (
    <main>
      <nav className="text-[0.875rem]">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-ink-2 hover:text-ink">‹ Edition</Link>
      </nav>
      <p className="kicker text-ink-3">
        {KIND_LABEL[card.kind] ?? "Filing"} · <Link href={`/c/${card.symbol}`} className="text-ink-2">{card.symbol}</Link> ·{" "}
        <span className="num normal-case tracking-normal">{when(card.at)}</span>
      </p>
      <h1 className="mt-1.5 font-serif text-[1.625rem] leading-snug">{card.headline ?? `${card.company}: ${card.nse_subject}`}</h1>
      {card.why && <p className="mt-2 text-[1rem] leading-relaxed text-ink-2">{card.why}</p>}
      {card.facts.results && <ResultsTable r={card.facts.results} />}

      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="kicker border-b border-ink pb-2">From the filing</h2>
          {people.map((p) => (
            <div key={p.name} className="py-2 text-[0.9375rem]">
              <p>
                <span className="font-medium">{p.name}</span> <span className="text-ink-2">· {p.change} · {p.role}</span>
              </p>
              {p.orgs.length > 0 && (
                <p className="text-[0.875rem] text-ink-2">
                  {p.orgs.map((o) => `${o.org}${o.start ? ` ${o.start}–${o.end ?? ""}` : ""}`).join(" · ")}
                </p>
              )}
              {p.schools.length > 0 && <p className="text-[0.8125rem] text-ink-3">{p.schools.join(" · ")}</p>}
            </div>
          ))}
        </section>
      )}

      {card.network.length > 0 && (
        <section className="mt-6">
          <h2 className="kicker border-b border-ink pb-2">Who can explain this</h2>
          {card.network.map((l) => (
            <NetworkLine key={l.contact_id} line={l} asOf={snap.data_until} />
          ))}
        </section>
      )}

      {card.sources.length > 0 && (
        <section className="mt-6">
          <h2 className="kicker border-b border-ink pb-2">Sources</h2>
          <SourceChips sources={card.sources} />
        </section>
      )}

      <section className="mt-8">
        <h2 className="kicker border-b border-ink pb-2">Why this ranked here</h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-[0.875rem]">
          <dt className="text-ink-2">Tier: {card.tier}</dt><dd className="num text-right">+{TIER_WEIGHT[card.tier]}</dd>
          <dt className="text-ink-2">Event type: {KIND_LABEL[card.kind] ?? card.kind}</dt><dd className="num text-right">+{KIND_WEIGHT[card.kind] ?? 10}</dd>
          <dt className="text-ink-2">Holding weight: {weight}% × 4</dt><dd className="num text-right">+{4 * weight}</dd>
          <dt className="text-ink-2">Age: {Math.round(ageH)} h × 0.15</dt><dd className="num text-right">−{Math.round(Math.min(ageH, 720) * 0.15)}</dd>
        </dl>
        <p className="mt-2 text-[0.75rem] text-ink-3">
          NSE category: &ldquo;{card.nse_subject || "price/volume threshold"}&rdquo;. Tiers come from SEBI LODR Reg 30
          materiality (people, deals, legal: lead) and your settings in What counts.
        </p>
      </section>
      <Dock />
    </main>
  );
}
