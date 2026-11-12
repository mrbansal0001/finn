import Link from "next/link";
import { KIND_LABEL, when } from "@/lib/format";

/**
 * The line above a headline: what kind of news (a label, not tappable), which company (a chip, tappable),
 * and when (at the right edge). Space and shape separate them, not dots.
 */
export function CardMeta({ kind, symbol, at, refTime, lead, overCard }: {
  kind: string;
  symbol: string;
  at: string;
  refTime?: string;
  lead?: boolean;
  overCard?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`kicker ${lead ? "text-ink" : "text-ink-3"}`}>{KIND_LABEL[kind] ?? "Filing"}</span>
        <Link
          href={`/c/${symbol}`}
          className={`chip tap ${overCard ? "above-card" : ""}`}
          aria-label={`${symbol}: open the company page`}
        >
          {symbol}
        </Link>
      </div>
      <time dateTime={at} className="num shrink-0 text-caption text-ink-3">
        {when(at, refTime)}
      </time>
    </div>
  );
}
