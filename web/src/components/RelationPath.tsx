import Link from "next/link";
import type { Contact, NetworkLine } from "@/lib/types";
import { monthYear } from "@/lib/format";
import { strengthParts, tieLabel } from "@/lib/lenses";

/**
 * How you reach someone, as a short chain whose every link says its evidence (creative review §3):
 *
 *   ● You
 *   │  strong tie, last spoke Sep 2026
 *   ● Rhea Kapoor
 *   │  Rhea mentored Tanvi at Titan
 *   ● Tanvi Desai  Insider
 *   │  works at Titan Company now (AVP Watches)
 *   ■ TITAN
 *
 * Vertical, so it reads on a phone without a graph library. No edge is drawn that the data doesn't record:
 * a shared employer with overlapping dates is said as exactly that, never as "knows".
 */
export type PathNode = { label: string; href?: string; tag?: string; company?: boolean };
export type Path = { nodes: PathNode[]; edges: string[] };

export function pathFor(line: NetworkLine, contacts: Contact[], symbol: string, today: Date, from?: string): Path {
  const q = from ? `?from=${encodeURIComponent(from)}` : "";
  const person: PathNode = { label: line.name, href: `/people/${line.contact_id}${q}`, tag: line.insider ? "Insider" : undefined };
  const company: PathNode = { label: symbol, href: `/c/${encodeURIComponent(symbol)}`, company: true };
  const tie = (c: Contact | undefined, fallback: string) => {
    if (!c) return `${fallback} tie`;
    const s = strengthParts(c, today);
    return `${tieLabel(s.total)} tie${c.last_contact ? `, last spoke ${monthYear(c.last_contact)}` : ""}`;
  };
  const relation = line.relation;
  if (line.via) {
    const via = contacts.find((c) => c.name === line.via);
    return {
      nodes: [{ label: "You" }, { label: line.via, href: via ? `/people/${via.id}${q}` : undefined }, person, company],
      edges: [tie(via, "a"), line.via_context ?? `${line.via} knows them`, relation],
    };
  }
  const me = contacts.find((c) => c.id === line.contact_id);
  return { nodes: [{ label: "You" }, person, company], edges: [tie(me, line.strength), relation] };
}

export function RelationPath({ path, className = "", inline = false }: { path: Path; className?: string; inline?: boolean }) {
  // inline (layout plan §6): each link's evidence on the node's own line, so a three-node path is three lines
  if (inline)
    return (
      <ol className={`relative ${className}`} aria-label="How you reach them">
        {path.nodes.map((n, i) => (
          <li key={i} className="relative min-h-[28px] pb-1.5 pl-7">
            {i < path.nodes.length - 1 && <span aria-hidden className="absolute bottom-0 left-[7px] top-4 w-px bg-rule" />}
            <span
              aria-hidden
              className={`absolute left-0.5 top-[5px] size-3 ${n.company ? "rounded-[3px] bg-ink" : i === 0 ? "rounded-full border-2 border-ink-3 bg-paper" : "rounded-full bg-accent"}`}
            />
            <span className="text-small">
              {n.href ? (
                <Link href={n.href} className={`tap ${n.company ? "chip align-[1px]" : "font-medium text-accent underline-offset-2 hover:underline"}`}>
                  {n.label}
                </Link>
              ) : (
                <span className={i === 0 ? "text-ink-3" : "font-medium text-ink"}>{n.label}</span>
              )}
              {n.tag && <span className="tag ml-1.5 align-[1px]">{n.tag}</span>}
              {i < path.edges.length && <span className="text-caption text-ink-3">, {path.edges[i]}</span>}
            </span>
          </li>
        ))}
      </ol>
    );
  return (
    <ol className={`relative ${className}`} aria-label="How you reach them">
      {path.nodes.map((n, i) => (
        <li key={i} className="relative pl-7">
          {/* the rail: drawn under each node except the last, with the edge's evidence beside it */}
          {i < path.nodes.length - 1 && <span aria-hidden className="absolute bottom-0 left-[7px] top-4 w-px bg-rule" />}
          <span
            aria-hidden
            className={`absolute left-0.5 top-[5px] size-3 ${n.company ? "rounded-[3px] bg-ink" : i === 0 ? "rounded-full border-2 border-ink-3 bg-paper" : "rounded-full bg-accent"}`}
          />
          <span className="flex min-h-[24px] flex-wrap items-center gap-2">
            {n.href ? (
              <Link href={n.href} className={`tap ${n.company ? "chip" : "font-medium text-accent underline-offset-2 hover:underline"}`}>
                {n.label}
              </Link>
            ) : (
              <span className={i === 0 ? "text-small text-ink-3" : "font-medium text-ink"}>{n.label}</span>
            )}
            {n.tag && (
              <span className="tag" title="Works there now: public information only">
                {n.tag}
              </span>
            )}
          </span>
          {i < path.edges.length && <p className="pb-3 pt-0.5 text-caption text-ink-3">{path.edges[i]}</p>}
        </li>
      ))}
    </ol>
  );
}
