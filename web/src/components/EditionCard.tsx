import Link from "next/link";
import type { Card, ResultsFacts } from "@/lib/types";
import { dirClass, pct, price, times } from "@/lib/format";
import { CardMeta } from "./CardMeta";
import { NetworkLine } from "./NetworkLine";

type Person = { name?: string; change?: string; role?: string; effective?: string | null };

/**
 * One Edition card (plan §8.3, §8.4).
 * Lead: meta line, headline (Fraunces 20), why (3 lines), one fact line for its kind, one network line.
 * Compact: meta line, headline (Fraunces 18), one network line.
 * The whole card opens the detail; the ticker and the person are their own links.
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
  const isMove = card.kind === "move";
  return (
    <article className={`relative ${compact ? "py-3.5" : "py-5"}`} aria-labelledby={`h-${card.id}`}>
      <CardMeta kind={card.kind} symbol={card.symbol} at={card.at} refTime={refTime} lead={card.tier === "lead"} overCard />

      <h2 id={`h-${card.id}`} className={`mt-2 font-serif text-ink ${compact ? "text-subhead" : "text-headline"}`}>
        <Link href={`/card/${card.id}`} className="card-link decoration-rule underline-offset-4 hover:underline">
          {card.headline ?? <PendingHeadline card={card} />}
        </Link>
      </h2>

      {!compact && (
        <>
          {isMove ? (
            <MoveLine card={card} />
          ) : (
            card.why && <p className="mt-2 line-clamp-3 text-body text-ink-2">{card.why}</p>
          )}
          {results?.comparatives && <Figures r={results} />}
          {card.kind === "management_change" && <PersonLine card={card} />}
        </>
      )}

      {showNetwork && card.network?.length > 0 && (
        <div className="above-card mt-3">
          <NetworkLine line={card.network[0]} compact asOf={refTime} from={card.id} oneLine />
        </div>
      )}
    </article>
  );
}

/** Results: label over figure in three columns, "YoY" at the right; the sign carries direction. */
function Figures({ r }: { r: ResultsFacts }) {
  const c = r.comparatives!;
  const items: [string, number | null | undefined][] = c.is_bank
    ? [["NII", c.yoy?.nii], ["Op. profit", c.yoy?.ppop], ["PAT", c.yoy?.pat]]
    : [["Revenue", c.yoy?.revenue], ...(c.is_lender ? [] : [["EBITDA", c.yoy?.ebitda] as [string, number | null | undefined]]), ["PAT", c.yoy?.pat]];
  const shown = items.filter(([, v]) => v != null);
  if (!shown.length) return null;
  return (
    <dl className="mt-3 grid max-w-[22rem] gap-x-4" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr)) auto` }}>
      {shown.map(([label, v]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-caption text-ink-3">{label}</dt>
          <dd className={`num text-small font-medium ${dirClass(v)}`}>{pct(v)}</dd>
        </div>
      ))}
      <div className="self-end text-caption text-ink-3">YoY</div>
    </dl>
  );
}

/** A people card: who, what role, what happens and when, in one line. */
function PersonLine({ card }: { card: Card }) {
  const p = ((card.facts.people as Person[] | undefined) ?? [])[0];
  if (!p?.name) return null;
  const role = (p.role ?? "").split(/,| and /).map((x) => x.trim()).filter(Boolean).pop() ?? "";
  const change = changeWord(p.change ?? "");
  return (
    <p className="mt-2 truncate text-small text-ink-2">
      <span className="font-medium text-ink">{p.name}</span>
      {role ? `, ${role}` : ""}
      {change ? `, ${change}` : ""}
      {p.effective ? ` ${shortEffective(p.effective)}` : ""}
    </p>
  );
}

/** A move card: the session in one line, instead of a paragraph. */
function MoveLine({ card }: { card: Card }) {
  const f = card.facts as { close?: number; change_pct?: number; volume_multiple?: number; explained_by?: string | null };
  return (
    <p className="mt-2 text-small text-ink-2">
      Closed at <span className="num font-medium text-ink">{price(f.close)}</span>,{" "}
      <span className={`num font-medium ${dirClass(f.change_pct)}`}>{pct(f.change_pct)}</span>, on{" "}
      <span className="num">{times(f.volume_multiple)}</span> usual volume.{" "}
      {f.explained_by ? "A filing came before it." : "No filing came before it."}
    </p>
  );
}

export function changeWord(change: string): string {
  const c = change.toLowerCase();
  if (/re-?appoint/.test(c)) return "reappointed";
  if (/appoint|induct|nominat|co-?opt/.test(c)) return "appointed";
  if (/resign/.test(c)) return "resigning";
  if (/retir|superannuat/.test(c)) return "retiring";
  if (/cessation|ceas|vacat|complet/.test(c)) return "leaving";
  if (/redesignat|elevat|promot/.test(c)) return "redesignated";
  return c.trim();
}

function shortEffective(s: string): string {
  const d = new Date(s.replace(/(\d+)(st|nd|rd|th)\b/i, "$1"));
  return Number.isNaN(d.getTime()) ? `from ${s}` : `from ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}`;
}

function PendingHeadline({ card }: { card: Card }) {
  // Honest empty state: the filing exists, its content hasn't been read yet.
  return (
    <span>
      {card.company.replace(/ Limited$/, "")} filed: {card.nse_subject.toLowerCase()}
      <span className="mt-1 block font-sans text-caption font-normal italic text-ink-3">FINN reads this filing on its next run.</span>
    </span>
  );
}
