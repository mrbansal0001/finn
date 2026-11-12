import Link from "next/link";
import type { NetworkLine as Line } from "@/lib/types";

/**
 * The Network, quietly inside Push: one line, the person and the evidence.
 * Wording follows the evidence level (D-023): "worked together" only when dates
 * overlap; otherwise the shared organisation with "dates not disclosed".
 * `oneLine` truncates to a single line in the feed; the detail page shows it all.
 */
export function NetworkLine({
  line,
  compact,
  asOf,
  from,
  oneLine = false,
  reason,
}: {
  line: Line;
  compact?: boolean;
  asOf?: string;
  from?: string;
  oneLine?: boolean;
  reason?: string;
}) {
  return (
    <div className={compact ? "mt-1.5" : "mt-3"}>
      <p className={`flex gap-2 text-small ${oneLine ? "min-w-0" : ""}`}>
        <span aria-hidden className="text-accent">◦</span>
        <span className={`text-ink-2 ${oneLine ? "truncate" : ""}`}>
          <Link
            href={`/people/${line.contact_id}${from ? `?from=${encodeURIComponent(from)}` : ""}`}
            className="tap font-medium text-accent underline-offset-2 hover:underline"
          >
            {line.name}
          </Link>{" "}
          {line.relation}
          {line.via ? (
            <span className="text-ink-3">
              {" "}· via {line.via}
              {!compact && line.via_context ? ` (${line.via_context.charAt(0).toLowerCase()}${line.via_context.slice(1)})` : ""}
            </span>
          ) : null}
          {line.insider ? <span className="text-ink-3"> · insider{compact ? "" : ": public information only"}</span> : null}
          {!compact && line.last_contact && asOf ? (
            <span className="text-ink-3"> · last spoke {monthsAgo(line.last_contact, asOf)}</span>
          ) : null}
        </span>
      </p>
      {extra(reason, line.relation) && <p className="ml-5 mt-0.5 text-small text-ink-3">Best placed: {extra(reason, line.relation)}.</p>}
    </div>
  );
}

/** The part of the "best placed" reason the line above doesn't already say. */
function extra(reason: string | undefined, relation: string): string {
  if (!reason) return "";
  const r = reason.startsWith(relation) ? reason.slice(relation.length) : reason;
  return r.replace(/^[\s;,.]+/, "").trim();
}

function monthsAgo(iso: string, asOf: string): string {
  // measured against the edition's data time, not the render clock
  const days = Math.round((new Date(asOf).getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)} wk ago`;
  return `${Math.round(days / 30)} mo ago`;
}
