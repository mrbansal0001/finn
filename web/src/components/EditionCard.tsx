import Link from "next/link";
import type { Card } from "@/lib/types";
import { KIND_LABEL, when } from "@/lib/format";
import { ResultsTable } from "./ResultsTable";
import { NetworkLine } from "./NetworkLine";
import { SourceChips } from "./SourceChips";

/**
 * One Edition card. Copy schema: kicker · headline (verb + fact) · why (must hold a number)
 * · results table (if any) · network line · sources. No box, no shadow: the list draws
 * hairlines between cards.
 */
export function EditionCard({ card, refTime, compact = false }: { card: Card; refTime: string; compact?: boolean }) {
  const results = card.facts?.results;
  return (
    <article className={compact ? "py-3" : "py-5"} aria-labelledby={`h-${card.id}`}>
      <p className="kicker flex flex-wrap items-baseline gap-x-2 text-ink-3">
        <span className={card.tier === "lead" ? "text-ink" : ""}>{KIND_LABEL[card.kind] ?? "Filing"}</span>
        <span aria-hidden>·</span>
        <Link href={`/c/${card.symbol}`} className="text-ink-2 underline-offset-2 hover:underline">
          {card.symbol}
        </Link>
        <span aria-hidden>·</span>
        <time dateTime={card.at} className="num normal-case tracking-normal">{when(card.at, refTime)}</time>
      </p>

      <h2
        id={`h-${card.id}`}
        className={`mt-1.5 font-serif leading-snug text-ink ${compact ? "text-[1.0625rem]" : "text-[1.3125rem]"}`}
      >
        {card.headline ?? <PendingHeadline card={card} />}
      </h2>

      {!compact && card.why && <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-2">{card.why}</p>}

      {!compact && results && <ResultsTable r={results} />}

      {!compact && card.needs_read && card.headline && (
        <p className="mt-1.5 text-[0.8125rem] italic text-ink-3">Full details are read from the filing once the model is connected.</p>
      )}

      {card.network?.length > 0 && <NetworkLine line={card.network[0]} compact={compact} asOf={refTime} />}

      {!compact && card.sources.length > 0 && <SourceChips sources={card.sources} />}
    </article>
  );
}

function PendingHeadline({ card }: { card: Card }) {
  // Honest empty state: the filing exists, its content hasn't been read yet.
  return (
    <span>
      {card.company.replace(/ Limited$/, "")} filed: {card.nse_subject.toLowerCase()}
      <span className="mt-1 block font-sans text-[0.8125rem] italic text-ink-3">
        The filing&apos;s content is read by the model; summary pending.
      </span>
    </span>
  );
}
