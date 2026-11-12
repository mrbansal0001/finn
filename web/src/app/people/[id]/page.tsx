import Link from "next/link";
import { Dock } from "@/components/Dock";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findCard, getView } from "@/lib/data";
import type { Contact } from "@/lib/types";
import { NoteDraft } from "@/components/NoteDraft";

export default function PersonPage({ params, searchParams }: PageProps<"/people/[id]">) {
  return (
    <Suspense fallback={<main aria-busy="true" className="pt-12 text-[0.8125rem] text-ink-3">Opening…</main>}>
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

  return (
    <main>
      <nav className="text-[0.875rem]">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-ink-2 hover:text-ink">
          ‹ Edition
        </Link>
      </nav>
      <p className="kicker text-ink-3">Your network · private to you</p>
      <h1 className="mt-1 font-serif text-[1.75rem] leading-tight">{c.name}</h1>
      <p className="text-[0.9375rem] text-ink-2">
        {c.current.role}, {c.current.org} · {c.city}
      </p>
      <p className="mt-1 text-[0.8125rem] text-ink-3">How you know them: {c.how_met}</p>

      <section className="mt-8">
        <h2 className="kicker border-b border-ink pb-2">Tie strength · {label(s.total)}</h2>
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-[0.875rem]">
          <Part k="Last spoke" v={c.last_contact ? `${daysAgo(c.last_contact, today)} days ago` : "never"} w={s.recency} />
          <Part k="Interactions, last 12 months" v={String(c.interactions_12m)} w={s.frequency} />
          <Part k="They reach out too" v={`${Math.round(c.reciprocity * 100)}%`} w={s.reciprocity} />
          <Part k="Your rating" v={`${c.rating}/5`} w={s.rating} />
        </dl>
        <p className="mt-2 text-[0.75rem] text-ink-3">
          0.40 × recency + 0.25 × frequency + 0.20 × reciprocity + 0.15 × rating ={" "}
          <span className="num">{s.total.toFixed(2)}</span>
        </p>
      </section>

      {links.length > 0 && (
        <section className="mt-8">
          <h2 className="kicker border-b border-ink pb-2">Connects you to</h2>
          <ul className="hair">
            {links.map((h, i) => (
              <li key={i} className="py-2 text-[0.9375rem]">
                <Link href={`/c/${h.symbol}`} className="text-accent">
                  {h.symbol}
                </Link>{" "}
                <span className="text-ink-2">
                  {h.role}, {yr(h.start)}–{h.end ? yr(h.end) : "now"}
                  {h.end === null ? " · current employee: public information only" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cards.length > 0 && (
        <section className="mt-8">
          <h2 className="kicker border-b border-ink pb-2">Relevant right now</h2>
          <ul className="hair">
            {cards.slice(0, 5).map((card) => (
              <li key={card.id} className="py-2 text-[0.9375rem]">
                <span className="kicker mr-2 text-ink-3">{card.symbol}</span>
                {card.headline ?? card.nse_subject}
              </li>
            ))}
          </ul>
          <NoteDraft
            name={c.name}
            company={cards[0].company}
            topic={cards[0].headline ?? cards[0].nse_subject}
            kind={cards[0].kind}
            role={(() => {
              const h = c.history.find((x) => x.symbol === cards[0].symbol);
              return h ? `${h.role} there` : undefined;
            })()}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className="kicker border-b border-ink pb-2">Career</h2>
        <ol className="hair">
          {[...c.history].reverse().map((h, i) => (
            <li key={i} className="flex justify-between gap-3 py-2 text-[0.875rem]">
              <span>
                {h.role}, <span className="text-ink-2">{h.org}</span>
              </span>
              <span className="num shrink-0 text-ink-3">
                {yr(h.start)}–{h.end ? yr(h.end) : "now"}
              </span>
            </li>
          ))}
          {c.education.map((e, i) => (
            <li key={`e${i}`} className="flex justify-between gap-3 py-2 text-[0.875rem]">
              <span>
                {e.degree}, <span className="text-ink-2">{e.school}</span>
              </span>
              <span className="num text-ink-3">{e.year}</span>
            </li>
          ))}
        </ol>
      </section>
      <p className="mt-6 text-[0.75rem] text-ink-3">Synthetic profile for this prototype. Real networks come only from your own consented imports.</p>
      <Dock />
    </main>
  );
}

function Part({ k, v, w }: { k: string; v: string; w: number }) {
  return (
    <>
      <dt className="text-ink-2">{k}</dt>
      <dd className="num text-right">
        {v} <span className="text-ink-3">· {w.toFixed(2)}</span>
      </dd>
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
