import Link from "next/link";
import type { NetworkLine as Line } from "@/lib/types";
import { monthYear } from "@/lib/format";
import { Avatar } from "./Avatar";

/**
 * The Network, quietly inside Push: the person and the evidence on one line; on detail pages a second,
 * quieter line says how to reach them and when you last spoke, written as a sentence (no dot separators).
 * Wording follows the evidence level (D-023): "worked together" only when dates overlap.
 * `oneLine` truncates to a single line in the feed; the detail page shows it all.
 */
export function NetworkLine({
  line,
  compact,
  asOf,
  from,
  oneLine = false,
  reason,
  lens,
}: {
  lens?: string; // what this person is good for, from their recorded role (three-pillars N5)
  line: Line;
  compact?: boolean;
  asOf?: string;
  from?: string;
  oneLine?: boolean;
  reason?: string;
}) {
  const meta = compact
    ? []
    : [
        line.via
          ? `Reach them through ${line.via}${line.via_context ? ` (${line.via_context.charAt(0).toLowerCase()}${line.via_context.slice(1)})` : ""}.`
          : null,
        line.last_contact && asOf ? `Last spoke ${monthYear(line.last_contact)}.` : null,
      ].filter((x): x is string => !!x);
  const best = extra(reason, line.relation);
  return (
    <div className={compact ? "mt-1.5" : "mt-3"}>
      <p className={`flex items-start gap-2 text-small ${oneLine ? "min-w-0 items-center" : ""}`}>
        <span className={oneLine ? "" : "mt-px"}>
          <Avatar name={line.name} />
        </span>
        <span className={`text-ink-2 ${oneLine ? "truncate" : ""}`}>
          <Link
            href={`/people/${line.contact_id}${from ? `?from=${encodeURIComponent(from)}` : ""}`}
            className="tap font-medium text-accent underline-offset-2 hover:underline"
          >
            {line.name}
          </Link>{" "}
          {line.insider && (
            <span className="tag mx-0.5 align-[1px]" title="Works there now: public information only">
              Insider
            </span>
          )}{" "}
          {line.relation}
          {compact && line.via ? <span className="text-ink-3">, through {line.via}</span> : null}
          {lens && <span className="tag ml-1.5 align-[1px]">{lens}</span>}
        </span>
      </p>
      {(meta.length > 0 || (line.insider && !compact) || best) && (
        <div className="ml-7 mt-1 space-y-0.5 text-caption text-ink-3">
          {best && <p>Best placed: {best}</p>}
          {(meta.length > 0 || (line.insider && !compact)) && (
            <p>
              {line.insider && !compact ? "Works there now, so public information only. " : ""}
              {meta.join(" ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** The part of the "best placed" reason the line above doesn't already say. */
function extra(reason: string | undefined, relation: string): string {
  if (!reason) return "";
  const r = reason.startsWith(relation) ? reason.slice(relation.length) : reason;
  // the insider note is said once, in its own sentence
  const out = r.replace(/;?\s*still works there[^;]*/i, "").replace(/^[\s;,.]+/, "").trim();
  return out ? out[0].toUpperCase() + out.slice(1).replace(/\.?$/, ".") : "";
}
