"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "./Avatar";

export type Person = {
  id: string;
  name: string;
  role: string;
  tie: string;
  strength: number;
  lastSpoke: string | null;
  insiderAt: string[];
  introduces: string[];
  domains: string[];
};
export type Group = {
  symbol: string;
  name: string;
  weight: number | null;
  research: boolean;
  lines: { id: string; relation: string; via: string | null; insider: boolean }[];
};
type View = "holding" | "theme" | "tie";

/** The People page's views and filters (three-pillars plan §4, N2, N6, N7). */
export function PeopleView({ people, groups, gaps }: { people: Person[]; groups: Group[]; gaps: string[] }) {
  const [view, setView] = useState<View>("holding");
  // themes as an index: pick one, see its people (UX review P1-4: every theme expanded made a 12,867px page)
  const [theme, setTheme] = useState<string | null>(null);
  const [insiders, setInsiders] = useState(false);
  const [introducers, setIntroducers] = useState(false);
  const byId = new Map(people.map((p) => [p.id, p]));
  const keep = (p: Person | undefined, insiderHere?: boolean) =>
    !!p && (!insiders || (insiderHere ?? p.insiderAt.length > 0)) && (!introducers || p.introduces.length > 0);
  const nInsiders = people.filter((p) => p.insiderAt.length).length;
  const nIntro = people.filter((p) => p.introduces.length).length;

  const themes = new Map<string, Person[]>();
  for (const p of people) for (const d of p.domains) themes.set(d, [...(themes.get(d) ?? []), p]);
  const themeList = [...themes.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  return (
    <>
      <div className="seg mt-5" role="group" aria-label="Group people">
        {(
          [
            ["holding", "By company"],
            ["theme", "By theme"],
            ["tie", "Strongest tie"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filters">
        <button aria-pressed={insiders} onClick={() => setInsiders(!insiders)} className="pill !min-h-[2.25rem] text-caption">
          Insiders <span className="num text-ink-3">{nInsiders}</span>
        </button>
        <button aria-pressed={introducers} onClick={() => setIntroducers(!introducers)} className="pill !min-h-[2.25rem] text-caption">
          Can introduce <span className="num text-ink-3">{nIntro}</span>
        </button>
      </div>
      {/* the one word that needs explaining, said once (N2) */}
      <p className="mt-3 text-caption text-ink-3">
        <span className="tag mr-1.5">Insider</span>works there now; ask only about what is public.
      </p>

      {/* a filter combination with no one in it says so and offers a way back (UX review P1-3) */}
      {(insiders || introducers) && !people.some((p) => keep(p)) && (
        <div className="mt-6 rounded-lg bg-tint px-4 py-3 text-small text-ink-2">
          <p>
            No one in your network matches {insiders && introducers ? "both filters: insiders who can also introduce someone" : insiders ? "this filter" : "this filter"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => { setInsiders(false); setIntroducers(false); }} className="tap font-medium text-accent">
              Clear filters
            </button>
            {insiders && introducers && (
              <button type="button" onClick={() => setInsiders(false)} className="tap font-medium text-accent">
                Show everyone who can introduce
              </button>
            )}
          </div>
        </div>
      )}

      {view === "holding" && (
        <div className="mt-2">
          {groups.map((g) => {
            const rows = g.lines.filter((l) => keep(byId.get(l.id), l.insider));
            if (!rows.length) return null;
            return (
              <section key={g.symbol} className="mt-6" aria-label={g.name}>
                <h2 className="flex items-center gap-2">
                  <Link href={`/c/${encodeURIComponent(g.symbol)}#people`} className="chip tap">
                    {g.symbol}
                  </Link>
                  {g.weight != null && <span className="tag num">{g.weight}%</span>}
                  {g.research && <span className="tag">Research list</span>}
                </h2>
                <ul className="hair mt-1">
                  {rows.map((l) => (
                    <Row key={l.id} p={byId.get(l.id)!} note={l.relation} via={l.via} insider={l.insider} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {view === "theme" && (
        <div className="mt-4">
          <p className="text-caption text-ink-3">Pick a theme to see who knows it</p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Themes">
            {themeList.map(([t, ps]) => {
              const n = ps.filter((p) => keep(p)).length;
              if (!n) return null;
              return (
                <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(theme === t ? null : t)} className="pill !min-h-[2.25rem] text-caption">
                  {t.charAt(0).toUpperCase() + t.slice(1)} <span className="num text-ink-3">{n}</span>
                </button>
              );
            })}
          </div>
          {theme &&
            (() => {
              const rows = (themes.get(theme) ?? []).filter((p) => keep(p)).sort((a, b) => b.strength - a.strength);
              return (
                <section className="mt-5" aria-label={theme}>
                  <h2 className="minor-h">{theme.charAt(0).toUpperCase() + theme.slice(1)}</h2>
                  <ul className="hair mt-1">
                    {rows.map((p) => (
                      <Row key={p.id} p={p} note={p.role} insider={p.insiderAt.length > 0} />
                    ))}
                  </ul>
                </section>
              );
            })()}
        </div>
      )}

      {view === "tie" && (
        <ul className="hair mt-4">
          {[...people]
            .filter((p) => keep(p))
            .sort((a, b) => b.strength - a.strength)
            .map((p) => (
              <Row key={p.id} p={p} note={p.role} insider={p.insiderAt.length > 0} />
            ))}
        </ul>
      )}

      {/* where the network is thin, visible here as well as in the portfolio sheet (N6) */}
      {gaps.length > 0 && (
        <section className="mt-10" aria-labelledby="gaps-h">
          <h2 id="gaps-h" className="section-h">
            Where you lack context
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {gaps.map((s) => (
              <Link key={s} href={`/c/${encodeURIComponent(s)}`} className="chip tap">
                {s}
              </Link>
            ))}
          </div>
          <button onClick={() => setView("theme")} className="mt-2 inline-flex min-h-[44px] items-center text-small font-medium text-accent">
            Browse people by theme ›
          </button>
        </section>
      )}
    </>
  );
}

function Row({ p, note, via, insider }: { p: Person; note: string; via?: string | null; insider: boolean }) {
  return (
    <li>
      <Link href={`/people/${p.id}`} className="group flex items-start gap-3 py-2.5">
        <span className="mt-0.5">
          <Avatar name={p.name} size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-small font-medium text-ink group-hover:underline">{p.name}</span>
            {insider && <span className="tag">Insider</span>}
          </span>
          <span className="mt-0.5 block text-caption text-ink-2">{note}</span>
          <span className="block text-caption text-ink-3">
            {p.tie.charAt(0).toUpperCase() + p.tie.slice(1)} tie{p.lastSpoke ? `, last spoke ${p.lastSpoke}` : ""}
            {via ? `; through ${via}` : ""}
            {p.introduces.length ? `; can introduce ${p.introduces.join(", ")}` : ""}
          </span>
        </span>
        <span aria-hidden className="go mt-0.5">›</span>
      </Link>
    </li>
  );
}
