import { Suspense } from "react";
import { BackLink } from "@/components/BackLink";
import { Dock } from "@/components/Dock";
import { About } from "@/components/About";
import { PageSkeleton } from "@/components/Skeletons";
import { PeopleView, type Group, type Person } from "@/components/PeopleView";
import { getView } from "@/lib/data";
import { monthYear } from "@/lib/format";
import { strengthParts, tieLabel } from "@/lib/lenses";
import { reconnects } from "@/lib/warm";
import { ReconnectLine } from "@/components/ReconnectLine";

export const metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <Suspense fallback={<PageSkeleton label="Opening your network…" />}>
      <People />
    </Suspense>
  );
}

/**
 * The network, whole (three-pillars plan §4): who you know, grouped by the holding they can speak to or by
 * theme, with tie strength, insiders and who can introduce whom; the companies with no one at the foot.
 * Read from the visitor's own private rows; nothing here goes to a model.
 */
async function People() {
  const snap = await getView();
  const down = snap.network_status === "unavailable" || !snap.contacts.length;
  const today = new Date(snap.data_until);
  const covered = [...snap.portfolio.map((h) => h.symbol), ...snap.research_set];
  const weight = new Map(snap.portfolio.map((h) => [h.symbol, h.weight]));
  const lines = covered.flatMap((s) => (snap.people[s] ?? []).map((l) => ({ s, l })));
  const introduces = new Map<string, string[]>();
  for (const { l } of lines) if (l.via) introduces.set(l.via, [...new Set([...(introduces.get(l.via) ?? []), l.name])]);

  const people: Person[] = snap.contacts.map((c) => {
    const st = strengthParts(c, today);
    return {
      id: c.id,
      name: c.name,
      role: `${c.current.role}, ${c.current.org}`,
      tie: tieLabel(st.total),
      strength: st.total,
      lastSpoke: c.last_contact ? monthYear(c.last_contact) : null,
      insiderAt: [...new Set(lines.filter(({ l }) => l.contact_id === c.id && l.insider).map(({ s }) => s))],
      introduces: introduces.get(c.name) ?? [],
      domains: c.domains ?? [],
    };
  });
  const groups: Group[] = covered
    .map((s) => ({
      symbol: s,
      name: (snap.names[s] ?? s).replace(/ Limited$/i, ""),
      weight: weight.get(s) ?? null,
      research: snap.research_set.includes(s),
      lines: (snap.people[s] ?? []).map((l) => ({ id: l.contact_id, relation: l.relation, via: l.via ?? null, insider: !!l.insider })),
    }))
    .filter((g) => g.lines.length);
  const gaps = covered.filter((s) => !(snap.people[s] ?? []).length);
  const tied = new Set(lines.map(({ l }) => l.contact_id)).size;

  return (
    <main>
      <BackLink fallback="/" label="Edition" />
      <div className="flex items-center gap-2">
        <span className="kicker text-ink-3">Your network</span>
        <span className="tag">Private to you</span>
      </div>
      <h1 className="mt-1 font-serif text-display">People</h1>
      {down ? (
        <p className="mt-4 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">Your network didn&apos;t load just now. Reload in a minute.</p>
      ) : (
        <>
          <p className="mt-1 text-body text-ink-2">
            <span className="num">{snap.contacts.length}</span> people. <span className="num">{tied}</span> linked to your companies
            {gaps.length ? (
              <>
                , <span className="num">{gaps.length}</span> {gaps.length === 1 ? "company" : "companies"} with no one
              </>
            ) : null}
            .
          </p>
          {(() => {
            const warm = reconnects(snap.contacts, [...snap.editions["7d"].leads, ...snap.editions["7d"].more], snap.data_until).slice(0, 5);
            const row = (r: (typeof warm)[number]) => (
              <li key={r.contact.id}>
                <ReconnectLine r={r} />
              </li>
            );
            // three, then the rest folded: five pushed the page's own controls 600px down (design review 7.3)
            return warm.length ? (
              <section className="mt-6" aria-labelledby="warm-h">
                <h2 id="warm-h" className="section-h">
                  Reconnect
                </h2>
                <p className="mt-2 text-caption text-ink-3">Quiet for six months or more, and their company filed this week.</p>
                <ul className="hair">{warm.slice(0, 3).map(row)}</ul>
                {warm.length > 3 && (
                  <details className="group border-t border-rule">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-small text-accent">
                      {warm.length - 3} more <span aria-hidden className="fold">›</span>
                    </summary>
                    <ul className="hair">{warm.slice(3).map(row)}</ul>
                  </details>
                )}
              </section>
            ) : null;
          })()}
          <PeopleView people={people} groups={groups} gaps={gaps} />
        </>
      )}
      <About label="About this page">
        <p>Real networks come only from your own consented imports. Matching uses recorded roles and dates; no contact data goes to any model.</p>
      </About>
      <Dock />
    </main>
  );
}
