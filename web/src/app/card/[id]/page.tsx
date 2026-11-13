import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { CardSkeleton } from "@/components/Skeletons";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { parsePrefs, PREFS_COOKIE } from "@/lib/prefs";
import { findCard, getLedger, getSnapshot, getView } from "@/lib/data";
import { fromCard } from "@/lib/investigate";
import { fyQuarter, KIND_LABEL } from "@/lib/format";
import { changeWord } from "@/components/EditionCard";
import { CardMeta } from "@/components/CardMeta";
import { NetworkLine } from "@/components/NetworkLine";
import type { NetworkLine as NetworkLineT } from "@/lib/types";
import { ResultsTable } from "@/components/ResultsTable";
import { ResultsVisual } from "@/components/ResultsVisual";
import { PriceVolumeChart } from "@/components/PriceVolumeChart";
import { filingMarkers } from "@/lib/markers";
import { SourceChips } from "@/components/SourceChips";
import { About, AboutPart } from "@/components/About";
import { QuestionCard } from "@/components/QuestionCard";

// Mirrors worker/src/finn_worker/cards.py so the explanation matches the ranking exactly.
const TIER_WEIGHT: Record<string, number> = { lead: 300, notable: 200, routine: 0 };
const KIND_WEIGHT: Record<string, number> = {
  litigation: 60, management_change: 55, m_and_a: 50, results: 45, move: 40, credit_rating: 35, fund_raise: 30,
  capex: 28, pledging: 27, insider_trading: 26, press_release: 20, earnings_call: 18, dividend: 15, bonus_split: 15, unclassified: 10,
};

export async function generateMetadata({ params }: PageProps<"/card/[id]">) {
  const { id } = await params;
  const card = findCard(await getSnapshot(), id);
  return { title: card ? `${card.symbol}: ${card.headline ?? card.nse_subject}` : "Not found" };
}

export default function CardPage({ params }: PageProps<"/card/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/card/[id]">["params"] }) {
  const { id } = await params;
  const [snap, jar] = await Promise.all([getView(), cookies()]);
  const found = findCard(snap, id);
  if (!found) notFound();
  const card = found;
  // a move opened from an alert says which of the visitor's own rules it met
  if (card.kind === "move" && !(card.facts as { matched?: string[] }).matched) {
    const prefs = parsePrefs(jar.get(PREFS_COOKIE)?.value);
    const f = card.facts as { change_pct?: number; volume_multiple?: number };
    const pct = f.change_pct ?? 0, vol = f.volume_multiple ?? 0;
    const matched = [
      Math.abs(pct) >= prefs.price_pct ? `a ${Math.abs(pct).toFixed(1)}% move (set at ±${prefs.price_pct}%)` : null,
      vol >= prefs.volume_x ? `${vol.toFixed(1)}× volume (set at ${prefs.volume_x}×)` : null,
    ].filter((x): x is string => x !== null);
    card.facts = { ...card.facts, matched: matched.length ? matched : [`below your rules (±${prefs.price_pct}%, ${prefs.volume_x}×); listed on the company page`] };
  }
  const weight = snap.portfolio.find((h) => h.symbol === card.symbol)?.weight ?? 0;
  const led = await getLedger(card.symbol);
  const inv = fromCard(card, snap, led);
  const moveRows = card.kind === "move" ? snap.price_history?.[card.symbol] : undefined;
  const moveChart = !!moveRows && moveRows.some((r) => r.d === card.at.slice(0, 10));
  const ageH = (new Date(snap.data_until).getTime() - new Date(card.at).getTime()) / 3_600_000;
  const people = (card.facts.people as { name: string; change: string; role: string; effective?: string | null; orgs: { org: string; start?: string; end?: string }[]; schools: string[] }[] | undefined) ?? [];

  return (
    <main>
      <BackLink fallback="/" label="Edition" />
      <CardMeta kind={card.kind} symbol={card.symbol} at={card.at} refTime={snap.data_until} lead={card.tier === "lead"} />
      <h1 className="mt-2.5 font-serif text-title">{card.headline ?? `${card.company}: ${card.nse_subject}`}</h1>
      <p className="mt-0.5 text-small text-ink-3">{card.company.replace(/ Limited$/, "")}</p>
      {/* a move's figures are in the chart's readout: the "why" keeps only what it adds (one number, one place) */}
      {card.why && <p className="mt-3 text-body text-ink-2">{card.kind === "move" && moveChart ? afterFirst(card.why) : card.why}</p>}
      {card.facts.results && <ResultsVisual r={card.facts.results} />}
      {moveChart && (
        <PriceVolumeChart rows={moveRows!} alertDay={card.at.slice(0, 10)} markers={filingMarkers(snap, card.symbol, moveRows!.map((r) => r.d))} symbol={card.symbol} />
      )}

      {/* the page's one action, directly under the picture (layout plan §4) */}
      <QuestionCard question={inv.question} href={`/investigate?card=${card.id}`} />

      {people.length > 0 && (
        <section className="mt-12">
          <h2 className="section-h">From the filing</h2>
          {people.map((p) => (
            <div key={p.name} className="border-b border-rule py-3 last:border-b-0">
              {/* a composed sentence, not raw fields (plan §9.2) */}
              <p className="text-body">
                <span className="font-medium text-ink">{p.name}</span>
                <span className="text-ink-2">
                  {p.role ? `, ${p.role}` : ""}
                  {changeWord(p.change) ? `, ${changeWord(p.change)}` : ""}
                  {p.effective ? ` effective ${effectiveDate(p.effective)}` : ""}.
                </span>
              </p>
              {p.orgs.length > 0 && (
                <p className="mt-1 text-caption text-ink-2">
                  {p.orgs.map((o) => `${o.org}${o.start ? ` ${o.start}–${o.end ?? ""}` : ""}`).join("; ")}
                </p>
              )}
              {p.schools.length > 0 && <p className="mt-0.5 text-caption text-ink-3">{p.schools.join(", ")}</p>}
            </div>
          ))}
          <p className="mt-3 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">{overlapLine(card.network, people, snap.contacts.length, snap.network_status)}</p>
        </section>
      )}

      {card.network.length > 0 && (
        <section className="mt-12">
          <h2 className="section-h">Who can explain this</h2>
          {/* the first person carries the "best placed" reason under their own line (no repeat above it) */}
          {card.network.map((l, i) => (
            <NetworkLine
              key={l.contact_id}
              line={l}
              asOf={snap.data_until}
              from={card.id}
              reason={i === 0 && l.best_reason && l.best_reason !== l.relation ? l.best_reason : undefined}
            />
          ))}
          {card.network.some((l) => l.insider) && (
            <p className="mt-2 text-caption text-ink-3">
              <span className="tag mr-1.5">Insider</span>works there now; ask only about what is public.
            </p>
          )}
        </section>
      )}

      {/* reference, not judgement: the exact table folds on a phone, stays open on a wide screen (layout plan §4) */}
      {card.facts.results && (
        <>
          <details className="group mt-10 border-t border-rule md:hidden">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-small text-ink-2">
              Exact figures, {fyQuarter(card.facts.results.period_end)}
              <span aria-hidden className="text-ink-3 transition-transform duration-200 group-open:rotate-90">›</span>
            </summary>
            <ResultsTable r={card.facts.results} />
          </details>
          <section className="mt-8 hidden md:block">
            <h2 className="minor-h">Exact figures, {fyQuarter(card.facts.results.period_end)}</h2>
            <ResultsTable r={card.facts.results} />
          </section>
        </>
      )}

      <About label="About this item">
        {card.sources.length > 0 && (
          <AboutPart title="Sources">
            <SourceChips sources={card.sources} />
          </AboutPart>
        )}
        <AboutPart title="Why this is here">
          <p>{whySentence(reasons(card, weight, ageH))}</p>
          <details className="mt-1">
            <summary className="inline-flex min-h-[44px] cursor-pointer items-center text-accent">How the order is computed</summary>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1">
              <dt>Tier: {card.tier}</dt><dd className="num text-right">+{TIER_WEIGHT[card.tier]}</dd>
              <dt>Event type: {KIND_LABEL[card.kind] ?? card.kind}</dt><dd className="num text-right">+{KIND_WEIGHT[card.kind] ?? 10}</dd>
              <dt>Holding weight: {weight}% × 4</dt><dd className="num text-right">+{4 * weight}</dd>
              <dt>Age: {Math.round(ageH)} h × 0.15</dt><dd className="num text-right">−{Math.round(Math.min(ageH, 720) * 0.15)}</dd>
            </dl>
            <p className="mt-1">
              NSE category: &ldquo;{card.nse_subject || "price/volume threshold"}&rdquo;. Tiers follow SEBI LODR Reg 30 materiality (people, deals,
              legal lead) and your settings in What counts.
            </p>
          </details>
        </AboutPart>
      </About>
      <Dock askSymbol={led ? card.symbol : undefined} />
    </main>
  );
}

/** "12 Nov 2026" from whatever date form the filing used; unchanged if it can't be read. */
function effectiveDate(s: string): string {
  const d = new Date(s.replace(/(\d+)(st|nd|rd|th)\b/i, "$1"));
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** Plain reasons first; the arithmetic sits under "How the order is computed". */
function reasons(card: { kind: string; tier: string; facts: Record<string, unknown> }, weight: number, ageH: number): string[] {
  const out: string[] = [];
  const f = card.facts as { matched?: string[]; other_sessions?: number; explained_by?: string | null };
  if (card.kind === "move") {
    if (f.matched?.length) out.push(f.matched[0].startsWith("below") ? `Price/volume ${f.matched[0]}` : `Meets your rule: ${f.matched.join(" and ")}`);
    if (f.other_sessions) out.push(`${f.other_sessions} more session${f.other_sessions === 1 ? "" : "s"} matched in this window`);
    if (f.explained_by) out.push("A filing came before it, so it does not lead on its own");
  } else {
    out.push(card.tier === "lead" ? `${KIND_LABEL[card.kind] ?? "Filing"}: a lead-tier event` : `${KIND_LABEL[card.kind] ?? "Filing"}`);
  }
  if (weight) out.push(`${weight}% of the portfolio`);
  const days = Math.round(ageH / 24);
  out.push(card.kind === "move"
    ? (ageH < 24 ? "The latest session" : `${days} day${days === 1 ? "" : "s"} ago`)
    : (ageH < 24 ? "Filed in the last day" : `Filed ${days} day${days === 1 ? "" : "s"} ago`));
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

/** "Results: a lead-tier event", "2% of the portfolio", "Filed 2 days ago" -> one sentence. */
function whySentence(parts: string[]): string {
  return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toLowerCase() + p.slice(1))).join(", ") + ".";
}

/** Everything after the first sentence (a move's first sentence restates the chart's readout). */
function afterFirst(s: string): string {
  const m = s.match(/^.*?[.!?]\s+(?=[A-Z])/);
  return m ? s.slice(m[0].length) : s;
}
