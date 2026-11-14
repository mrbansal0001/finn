import Link from "next/link";
import { KIND_LABEL, when } from "@/lib/format";

/**
 * The line above a headline: what kind of news (a label, not tappable), which company (a chip, tappable),
 * and when (at the right edge). Space and shape separate them, not dots.
 */
const ATTACHMENT: Record<string, string> = { xbrl: "XBRL only", zip: "ZIP file", none: "No document", unchecked: "Quote not checked (scanned)" };

export function CardMeta({ kind, symbol, at, refTime, lead, overCard, research, attachment }: {
  research?: boolean; // a research-list company, not a holding: tagged so it is never mistaken for one
  /** what the filing's attachment is, when it isn't a PDF: a source fact, so a tag here, not the "why" (design review C2) */
  attachment?: string;
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
        {research && <span className="tag shrink-0">Research</span>}
        {attachment && ATTACHMENT[attachment] && <span className="tag shrink-0">{ATTACHMENT[attachment]}</span>}
      </div>
      <time dateTime={at} className="num shrink-0 text-caption text-ink-3">
        {/* a bare time means today: say so (three-pillars S/P8) */}
        {(() => {
          const t = when(at, refTime);
          return t.includes(",") ? t : `Today, ${t}`;
        })()}
      </time>
    </div>
  );
}
