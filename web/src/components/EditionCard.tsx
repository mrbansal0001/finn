import Link from "next/link";
import type { Card, ResultsFacts } from "@/lib/types";
import { dirClass, pct, price, times } from "@/lib/format";
import { CardMeta } from "./CardMeta";
import { NetworkLine } from "./NetworkLine";
import { MoveSpark } from "./MoveSpark";

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
  history,
}: {
  card: Card;
  refTime: string;
  compact?: boolean;
  showNetwork?: boolean;
  history?: Parameters<typeof MoveSpark>[0]["rows"];
}) {
  const results = card.facts?.results;
  const isMove = card.kind === "move";
  return (
    <article className={`relative ${compact ? "py-3.5" : "py-5"}`} aria-labelledby={`h-${card.id}`}>
      <CardMeta kind={card.kind} symbol={card.symbol} at={card.at} refTime={refTime} lead={card.tier === "lead"} overCard />

      <div className={compact && isMove && history ? "flex items-center justify-between gap-3" : undefined}>
        <h2 id={`h-${card.id}`} className={`mt-2 font-serif text-ink ${compact ? "text-subhead" : "text-headline"}`}>
          <Link href={`/card/${card.id}`} className="card-link decoration-rule underline-offset-4 hover:underline">
            {card.headline ?? <PendingHeadline card={card} />}
          </Link>
        </h2>
        {/* a compact move keeps its word-sized chart, as in the alerts box */}
        {compact && isMove && history && (
          <span className="mt-2 shrink-0 max-[359px]:hidden">
            <MoveSpark rows={history} day={card.at.slice(0, 10)} width={60} label={`${card.symbol}: price over the last 20 sessions and each day's volume`} />
          </span>
        )}
      </div>

      {!compact && (
        <>
          {isMove ? (
            <>
              <MoveLine card={card} />
              {/* the lead move, drawn: 20 sessions to the alert day (the alert rows carry the small version) */}
              {history && (
                <div className="mt-3 flex items-end gap-3">
                  <MoveSpark rows={history} day={card.at.slice(0, 10)} width={168} height={44} label={`${card.symbol}: price over the last 20 sessions and each day's volume, ending on this session`} />
                  <span className="pb-0.5 text-caption text-ink-3">Last 20 sessions; bars are volume</span>
                </div>
              )}
            </>
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
      {/* one purposeful action on a lead: carry this event into a question (creative review) */}
      {!compact && (
        <div className="above-card mt-2">
          <Link href={`/investigate?card=${card.id}`} className="tap inline-flex items-center gap-1 text-small font-medium text-accent">
            Investigate <span aria-hidden>›</span>
          </Link>
        </div>
      )}
    </article>
  );
}

/**
 * Results: is growth turning into profit? Each metric's change from a year ago as a bar from one shared
 * zero line (all three are % changes, so one scale is honest), the figure beside it. Revenue +11.7% against
 * PAT −50.0% reads at a glance. Bars past ±60% are capped and notched, never stretched off the scale.
 */
function Figures({ r }: { r: ResultsFacts }) {
  const c = r.comparatives!;
  const items: [string, number | null | undefined][] = c.is_bank
    ? [["NII", c.yoy?.nii], ["Op. profit", c.yoy?.ppop], ["PAT", c.yoy?.pat]]
    : [["Revenue", c.yoy?.revenue], ...(c.is_lender ? [] : [["EBITDA", c.yoy?.ebitda] as [string, number | null | undefined]]), ["PAT", c.yoy?.pat]];
  const shown = items.filter((x): x is [string, number] => x[1] != null);
  if (!shown.length) return null;
  const CAP = 60;
  const top = Math.min(CAP, Math.max(10, ...shown.map(([, v]) => Math.abs(v))));
  // one shared zero: in the middle when signs differ, at the edge when they all agree (no half-empty track)
  const allUp = shown.every(([, v]) => v >= 0), allDown = shown.every(([, v]) => v <= 0);
  const zero = allUp ? 0 : allDown ? 100 : 50;
  const span = allUp || allDown ? 100 : 50;
  return (
    <figure className="mt-3 max-w-[24rem]">
      <ul className="space-y-1">
        {shown.map(([label, v]) => {
          const w = (Math.min(Math.abs(v), top) / top) * span;
          const capped = Math.abs(v) > top;
          return (
            <li key={label} className="grid grid-cols-[4.5rem_1fr_3.75rem] items-center gap-2">
              <span className="truncate text-caption text-ink-3">{label}</span>
              <span className="relative h-3" aria-hidden>
                <span className="absolute inset-y-0 w-px bg-ink-3" style={{ left: `${zero}%` }} />
                <span
                  className={`absolute top-0.5 bottom-0.5 rounded-[2px] ${v >= 0 ? "bg-up/75" : "bg-down/75"}`}
                  style={v >= 0 ? { left: `${zero}%`, width: `${w}%` } : { right: `${100 - zero}%`, width: `${w}%` }}
                />
                {capped && (
                  <span className={`absolute top-0 bottom-0 w-0.5 bg-paper ${v >= 0 ? "right-[3%]" : "left-[3%]"}`} title="Beyond the scale shown" />
                )}
              </span>
              <span className={`num text-right text-small font-medium ${dirClass(v)}`}>{pct(v)}</span>
            </li>
          );
        })}
      </ul>
      <figcaption className="mt-0.5 pl-[5rem] text-label text-ink-3">Change from a year ago, one scale{shown.some(([, v]) => Math.abs(v) > top) ? `; bars capped at ±${top}%` : ""}</figcaption>
    </figure>
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
      {f.explained_by ? "A material filing came before it." : "No material filing since the previous close."}
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
      <span className="mt-1 block font-sans text-caption font-normal italic text-ink-3">FINN reads this filing on its next update.</span>
    </span>
  );
}
