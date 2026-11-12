import Link from "next/link";
import type { Card, ResultsFacts } from "@/lib/types";
import { KIND_LABEL, arrow, dirClass, pct, when } from "@/lib/format";
import { NetworkLine } from "./NetworkLine";

/**
 * One Edition card, as a summary: kicker · headline · one short "why" · (results) one line of key figures ·
 * one network line. The whole card opens the detail, where the full table, every source and the people
 * sit. No box, no shadow: the list draws hairlines between cards.
 */
export function EditionCard({
  card,
  refTime,
  compact = false,
  showNetwork = true,
}: {
  card: Card;
  refTime: string;
  compact?: boolean;
  showNetwork?: boolean;
}) {
  const results = card.facts?.results;
  return (
    <article className={`relative ${compact ? "py-3.5" : "py-5"}`} aria-labelledby={`h-${card.id}`}>
      <p className="kicker flex flex-wrap items-baseline gap-x-1.5 text-ink-3">
        <span className={card.tier === "lead" ? "text-ink" : ""}>{KIND_LABEL[card.kind] ?? "Filing"}</span>
        <span aria-hidden>·</span>
        <Link href={`/c/${card.symbol}`} className="above-card tap text-ink-2 hover:text-ink">
          {card.symbol}
        </Link>
        <span aria-hidden>·</span>
        <time dateTime={card.at} className="num font-normal normal-case tracking-normal">
          {when(card.at, refTime)}
        </time>
      </p>

      <h2 id={`h-${card.id}`} className={`mt-1 font-serif text-ink ${compact ? "text-subhead" : "text-headline"}`}>
        <Link href={`/card/${card.id}`} className="card-link decoration-rule underline-offset-4 hover:underline">
          {card.headline ?? <PendingHeadline card={card} />}
        </Link>
      </h2>

      {!compact && card.why && <p className="mt-1.5 line-clamp-3 text-small text-ink-2">{card.why}</p>}

      {results?.comparatives && <Figures r={results} />}

      {showNetwork && card.network?.length > 0 && (
        <div className="above-card">
          <NetworkLine line={card.network[0]} compact asOf={refTime} from={card.id} oneLine />
        </div>
      )}
    </article>
  );
}

/** The results headline numbers on one line: YoY, coloured with an arrow (never colour alone). */
function Figures({ r }: { r: ResultsFacts }) {
  const c = r.comparatives!;
  const items: [string, number | null | undefined][] = c.is_bank
    ? [["NII", c.yoy?.nii], ["Op. profit", c.yoy?.ppop], ["PAT", c.yoy?.pat]]
    : [["Revenue", c.yoy?.revenue], ...(c.is_lender ? [] : [["EBITDA", c.yoy?.ebitda] as [string, number | null | undefined]]), ["PAT", c.yoy?.pat]];
  const shown = items.filter(([, v]) => v != null);
  if (!shown.length) return null;
  // label over value, in columns: fits a 320px phone without wrapping a figure onto its own line
  return (
    <dl className="mt-2.5 grid max-w-[22rem] gap-x-4" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr)) auto` }}>
      {shown.map(([label, v]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-meta text-ink-3">{label}</dt>
          <dd className={`num text-small ${dirClass(v)}`}>
            {pct(v)}
            <span aria-hidden className="ml-0.5 text-[0.7em]">{arrow(v)}</span>
          </dd>
        </div>
      ))}
      <div className="self-end pb-0.5 text-meta text-ink-3">YoY</div>
    </dl>
  );
}

function PendingHeadline({ card }: { card: Card }) {
  // Honest empty state: the filing exists, its content hasn't been read yet.
  return (
    <span>
      {card.company.replace(/ Limited$/, "")} filed: {card.nse_subject.toLowerCase()}
      <span className="mt-1 block font-sans text-small italic text-ink-3">FINN reads this filing on its next run.</span>
    </span>
  );
}
