import Link from "next/link";
import { Dock } from "@/components/Dock";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findCard, getView } from "@/lib/data";
import { KIND_LABEL, when } from "@/lib/format";
import { NetworkLine } from "@/components/NetworkLine";
import type { NetworkLine as NetworkLineT } from "@/lib/types";
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
  const card = findCard(snap, id);
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
          <p className="mt-1 text-[0.875rem] text-ink-2">{overlapLine(card.network, people, snap.contacts.length, snap.network_status)}</p>
        </section>
      )}

      {card.network.length > 0 && (
        <section className="mt-6">
          <h2 className="kicker border-b border-ink pb-2">Who can explain this</h2>
          {card.network[0]?.best_reason && card.network[0].best_reason !== card.network[0].relation && (
            <p className="mt-2 text-[0.875rem] text-ink-2">
              <span className="font-medium text-ink">Best placed: {card.network[0].name}.</span> {card.network[0].best_reason}.
            </p>
          )}
          {card.network.map((l) => (
            <NetworkLine key={l.contact_id} line={l} asOf={snap.data_until} from={card.id} />
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
        <h2 className="kicker border-b border-ink pb-2">Why this is here</h2>
        <ul className="mt-2 list-disc pl-5 text-[0.875rem] text-ink-2">
          {reasons(card, weight, ageH).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <details className="mt-2 text-[0.75rem] text-ink-3">
          <summary className="inline-flex min-h-[44px] items-center">How the order is computed</summary>
          <dl className="grid grid-cols-[1fr_auto] gap-y-1">
            <dt>Tier: {card.tier}</dt><dd className="num text-right">+{TIER_WEIGHT[card.tier]}</dd>
            <dt>Event type: {KIND_LABEL[card.kind] ?? card.kind}</dt><dd className="num text-right">+{KIND_WEIGHT[card.kind] ?? 10}</dd>
            <dt>Holding weight: {weight}% × 4</dt><dd className="num text-right">+{4 * weight}</dd>
            <dt>Age: {Math.round(ageH)} h × 0.15</dt><dd className="num text-right">−{Math.round(Math.min(ageH, 720) * 0.15)}</dd>
          </dl>
          <p className="mt-1">
            NSE category: &ldquo;{card.nse_subject || "price/volume threshold"}&rdquo;. Tiers follow SEBI LODR Reg 30
            materiality (people, deals, legal lead) and your settings in What counts.
          </p>
        </details>
      </section>
      <Dock />
    </main>
  );
}

/** Plain reasons first; the arithmetic sits under "How the order is computed". */
function reasons(card: { kind: string; tier: string; facts: Record<string, unknown> }, weight: number, ageH: number): string[] {
  const out: string[] = [];
  const f = card.facts as { matched?: string[]; other_sessions?: number; explained_by?: string | null };
  if (card.kind === "move") {
    if (f.matched?.length) out.push(`Meets your rule: ${f.matched.join(" and ")}`);
    if (f.other_sessions) out.push(`${f.other_sessions} more session${f.other_sessions === 1 ? "" : "s"} matched in this window`);
    if (f.explained_by) out.push("A filing came before it, so it does not lead on its own");
  } else {
    out.push(card.tier === "lead" ? `${KIND_LABEL[card.kind] ?? "Filing"}: a lead-tier event` : `${KIND_LABEL[card.kind] ?? "Filing"}`);
  }
  if (weight) out.push(`${weight}% of the portfolio`);
  out.push(ageH < 24 ? "Filed in the last day" : `${Math.round(ageH / 24)} day${Math.round(ageH / 24) === 1 ? "" : "s"} old`);
  return out;
}

/** Answer the brief's question for people cards, from the visitor's own lines: has anyone in my network
 *  worked at the same place at the same time, studied at the same school, or sits one connection away?
 *  A shared employer with overlapping dates is not proof two people know each other, and a network that
 *  failed to load is not "no one" (audit F11). */
function overlapLine(lines: NetworkLineT[], people: { name: string }[], checked: number, status?: string): string {
  const names = people.slice(0, 2).map((p) => p.name).join(" and ");
  if (status === "unavailable") return `Your network didn't load, so FINN can't say whether anyone overlapped with ${names}. Reload to check.`;
  const person = lines.find((l) => l.confidence === "dates overlap" || /alumnus|same person|while .* was there/.test(l.relation));
  if (person) return `${person.name} ${person.relation}${person.via ? `, reachable through ${person.via}` : ""}.`;
  return `No verified overlap with ${names}: none of your ${checked || ""} contacts' employers, schools and dates match what the filing states${people.length > 2 ? " for the first two named" : ""}. The people below know the company.`;
}
