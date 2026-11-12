import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { PersonSkeleton } from "@/components/Skeletons";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findCard, getView } from "@/lib/data";
import type { Contact } from "@/lib/types";
import { NoteDraft } from "@/components/NoteDraft";
import { monthYear } from "@/lib/format";
import { RelationPath, pathFor } from "@/components/RelationPath";
import { CareerBars } from "@/components/CareerBars";
import { CompanyBridge } from "@/components/CompanyBridge";
import { About, AboutPart } from "@/components/About";

export const metadata = { title: "Your network" };

export default function PersonPage({ params, searchParams }: PageProps<"/people/[id]">) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <Person params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Person({ params, searchParams }: { params: PageProps<"/people/[id]">["params"]; searchParams: PageProps<"/people/[id]">["searchParams"] }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const snap = await getView();
  const c = snap.contacts.find((x) => x.id === id);
  if (!c) notFound();
  const today = new Date(snap.data_until);
  const s = strengthParts(c, today);
  const held = new Set(snap.portfolio.map((h) => h.symbol));
  const links = c.history.filter((h) => h.symbol && (held.has(h.symbol) || snap.research_set.includes(h.symbol)));
  const cards = [...snap.editions["30d"].leads, ...snap.editions["30d"].more]
    .filter((card) => card.network?.some((l) => l.contact_id === c.id))
    // items with a real headline first; bare NSE subjects last
    .sort((a, b) => Number(!!b.headline) - Number(!!a.headline) || b.at.localeCompare(a.at));
  // the item that brought the visitor here leads, so the draft is about it, not the latest card
  const origin = typeof sp.from === "string" ? findCard(snap, sp.from) : undefined;
  if (origin) {
    const i = cards.findIndex((x) => x.id === origin.id);
    if (i >= 0) cards.splice(i, 1);
    cards.unshift(origin);
  }

  // how you reach them, for the company in question: the origin item's, else the first linked company's
  const focus = origin?.symbol ?? cards[0]?.symbol ?? links[0]?.symbol ?? undefined;
  const line = focus
    ? (origin?.network.find((l) => l.contact_id === c.id) ?? (snap.people[focus] ?? []).find((l) => l.contact_id === c.id))
    : undefined;

  const role = (() => {
    const h = cards[0] && c.history.find((x) => x.symbol === cards[0].symbol);
    return h ? `${h.role} there` : undefined;
  })();

  return (
    <main>
      <BackLink fallback="/" />
      <div className="flex items-center gap-2">
        <span className="kicker text-ink-3">Your network</span>
        <span className="tag">Private to you</span>
      </div>
      <h1 className="mt-1 font-serif text-display">{c.name}</h1>
      <p className="mt-1 text-body text-ink-2">
        {c.current.role} at {c.current.org}, {c.city}
      </p>
      <p className="mt-2 text-small text-ink-3">
        How you know them: {c.how_met}
        <br />
        <span className="font-medium text-ink-2">{label(s.total)[0].toUpperCase() + label(s.total).slice(1)} tie</span>
        {c.last_contact ? <>, last spoke {monthYear(c.last_contact)}</> : null}
      </p>

      {/* others you know at the same companies (three-pillars N3) */}
      {(() => {
        const also = links
          .map((h) => ({ s: h.symbol!, others: (snap.people[h.symbol!] ?? []).filter((l) => l.contact_id !== c.id) }))
          .filter((x) => x.others.length);
        if (!also.length) return null;
        return (
          <div className="mt-3 space-y-1 text-small text-ink-2">
            {also.map((x) => (
              <p key={x.s}>
                Also linked to{" "}
                <Link href={`/c/${encodeURIComponent(x.s)}`} className="chip tap align-[1px]">
                  {x.s}
                </Link>
                :{" "}
                {x.others.map((l, i) => (
                  <span key={l.contact_id}>
                    {i > 0 ? ", " : ""}
                    <Link href={`/people/${l.contact_id}`} className="tap font-medium text-accent hover:underline">
                      {l.name}
                    </Link>
                  </span>
                ))}
              </p>
            ))}
          </div>
        );
      })()}

      {/* the path only when someone introduces you; for a direct contact the tie line above already says it */}
      {line && focus && line.via && (
        <section className="mt-10">
          <h2 className="section-h">
            <span>How you reach them</span>
            <span className="text-caption font-normal normal-case tracking-normal text-ink-3">through {line.via}</span>
          </h2>
          <RelationPath path={pathFor(line, snap.contacts, focus, today, origin?.id)} className="mt-3" />
        </section>
      )}

      {/* the page's most distinctive thing, first when present (layout plan §7) */}
      <CompanyBridge name={c.name} roles={links} />

      {cards.length > 0 && (
        <section className="mt-12">
          <h2 className="section-h">Why talk to them now</h2>
          <ul className="hair">
            {cards.slice(0, 3).map((card) => (
              <PersonCard key={card.id} id={card.id} symbol={card.symbol} title={card.headline ?? card.nse_subject} />
            ))}
          </ul>
          {cards.length > 3 && (
            <details className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-small text-accent">
                See {Math.min(cards.length, 5) - 3} more <span aria-hidden className="ml-1 transition-transform duration-200 group-open:rotate-90">›</span>
              </summary>
              <ul className="hair">
                {cards.slice(3, 5).map((card) => (
                  <PersonCard key={card.id} id={card.id} symbol={card.symbol} title={card.headline ?? card.nse_subject} />
                ))}
              </ul>
            </details>
          )}
          {origin && (
            <Link href={`/investigate?card=${origin.id}`} className="mt-1 flex min-h-[44px] items-center gap-1 text-small font-medium text-accent">
              Investigate {origin.symbol} with {c.name.split(" ")[0]} in mind <span aria-hidden>›</span>
            </Link>
          )}
          <NoteDraft name={c.name} company={cards[0].company} topic={cards[0].headline ?? cards[0].nse_subject} kind={cards[0].kind} role={role} folded />
        </section>
      )}

      {/* the list only when the bridge isn't shown: the same two companies twice was repetition */}
      {links.length > 0 && links.length < 2 && (
        <section className="mt-12">
          <h2 className="section-h">Connects you to</h2>
          <ul className="hair">
            {links.map((h, i) => (
              <li key={i} className="py-2.5 text-body">
                <Link href={`/c/${h.symbol}`} className="chip tap mr-2 align-[2px]">
                  {h.symbol}
                </Link>
                <span className="text-ink-2">
                  {h.role}, <span className="num">{yr(h.start)}–{h.end ? yr(h.end) : "now"}</span>
                  {h.end === null ? ". Works there now: public information only" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="section-h">Career</h2>
        <CareerBars history={c.history} until={snap.data_until} covered={[...held, ...snap.research_set]} />
        {c.education.length > 0 && (
          <ul className="hair mt-3">
            {c.education.map((e, i) => (
              <li key={`e${i}`} className="flex justify-between gap-3 py-2.5 text-small">
                <span>
                  {e.degree}, <span className="text-ink-2">{e.school}</span>
                </span>
                <span className="num text-ink-3">{e.year}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <About label="About this profile">
        <AboutPart title={`How strong is this tie: ${label(s.total)}`}>
          <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5">
            <Part k="Last spoke" v={c.last_contact ? `${monthYear(c.last_contact)} (${daysAgo(c.last_contact, today)} days)` : "never"} w={s.recency} />
            <Part k="Interactions, last 12 months" v={String(c.interactions_12m)} w={s.frequency} />
            <Part k="They reach out too" v={`${Math.round(c.reciprocity * 100)}%`} w={s.reciprocity} />
            <Part k="Your rating" v={`${c.rating}/5`} w={s.rating} />
          </dl>
          <p className="mt-2">
            0.40 × recency + 0.25 × frequency + 0.20 × reciprocity + 0.15 × rating = <span className="num">{s.total.toFixed(2)}</span>
          </p>
        </AboutPart>
        <p>Real networks come only from your own consented imports.</p>
      </About>
      <Dock />
    </main>
  );
}

function Part({ k, v, w }: { k: string; v: string; w: number }) {
  return (
    <>
      <dt className="text-ink-2">{k}</dt>
      <dd className="num text-right">{v}</dd>
      <dd className="num w-12 text-right text-ink-3">{w.toFixed(2)}</dd>
    </>
  );
}

function strengthParts(c: Contact, today: Date) {
  const days = c.last_contact ? daysAgo(c.last_contact, today) : 3650;
  // mirrors worker network.strength (no "shared background" term: there is no investor profile to share one with)
  const recency = 0.4 * Math.exp(-Math.max(days, 0) / 180);
  const frequency = 0.25 * Math.min(1, Math.log1p(c.interactions_12m) / Math.log1p(24));
  const reciprocity = 0.2 * c.reciprocity;
  const rating = 0.15 * (c.rating / 5);
  return { recency, frequency, reciprocity, rating, total: recency + frequency + reciprocity + rating };
}

const label = (s: number) => (s >= 0.6 ? "strong" : s >= 0.4 ? "medium" : "weak");
const yr = (s: string) => s.slice(0, 4);
function daysAgo(iso: string, today: Date) {
  return Math.round((today.getTime() - new Date(iso).getTime()) / 86_400_000);
}

function PersonCard({ id, symbol, title }: { id: string; symbol: string; title: string }) {
  return (
    <li>
      <Link href={`/card/${id}`} className="flex items-start justify-between gap-3 py-2.5 hover:bg-paper-raised">
        <span>
          <span className="kicker mr-2 text-ink-3">{symbol}</span>
          <span className="text-body text-ink">{title}</span>
        </span>
        <span aria-hidden className="go mt-0.5">›</span>
      </Link>
    </li>
  );
}
