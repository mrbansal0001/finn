"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ViewTransition, useEffect, useState } from "react";
import { NAV_START } from "./NavProgress";

type Person = { id: string; name: string; why: string; match?: string };
type Results = { q: string; companies: [string, string][]; people: Person[]; failed?: boolean };

/** "who knows TCS" -> "TCS": the phrasings the network search actually supports, stated as such. */
export function searchTerm(q: string): { term: string; asked: boolean } {
  const m = q.trim().match(/^(?:who|anyone|someone|people|experts?)\b.*?\b(?:knows?|at|in|on|from|about|worked at|works at|studied at)\s+(.+?)\??$/i);
  return m ? { term: m[1].trim(), asked: true } : { term: q.trim(), asked: false };
}

/**
 * Bottom dock: one slim row, search (any NSE company, or your own network) and the rules. It stays put
 * while pages crossfade beneath it.
 */
export function Dock() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results>({ q: "", companies: [], people: [] });
  const [note, setNote] = useState("");
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);

  // out of the way while reading down a long page; back on scrolling up (plan §7, §8.11)
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const { term: query, asked } = searchTerm(q);
  const ready = query.length >= 2 && res.q === query;
  const current: Results = ready ? res : { q: query, companies: [], people: [] };
  const searching = query.length >= 2 && !ready;

  useEffect(() => {
    if (query.length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      const enc = encodeURIComponent(query);
      Promise.all([
        fetch(`/api/search?q=${enc}`, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch(`/api/network?q=${enc}`, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : [])),
      ])
        .then(([companies, people]) => setRes({ q: query, companies, people }))
        .catch((e) => {
          if (e?.name !== "AbortError") setRes({ q: query, companies: [], people: [], failed: true });
        });
    }, 150);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query]);

  // what was most likely meant comes first: a person's name, then a ticker or company name, then themes
  const upper = query.toUpperCase();
  const exactTicker = current.companies.some(([s]) => s === upper);
  const themed = current.people.some((p) => p.match === "theme" || p.match === "employer");
  const companyFirst =
    !asked &&
    !current.people.some((p) => p.match === "name") &&
    (exactTicker || (!themed && current.companies.some(([, n]) => n.toUpperCase().startsWith(upper))));

  // a navigation started in code still shows the loading bar (NavProgress listens for this)
  const go = (href: string) => {
    window.dispatchEvent(new Event(NAV_START));
    router.push(href);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote("");
    // only a single ticker-shaped word is ever opened as a ticker; a sentence never is (audit F11)
    const tickerish = /^[A-Za-z0-9&-]{1,20}$/.test(query);
    const exact = current.companies.find(([s]) => s === upper)?.[0];
    if (asked && current.people[0]) go(`/people/${current.people[0].id}`);
    else if (exact) go(`/c/${encodeURIComponent(exact)}`);
    else if (current.people[0] && !current.companies.length) go(`/people/${current.people[0].id}`);
    else if (current.companies[0] && !current.people.length) go(`/c/${encodeURIComponent(current.companies[0][0])}`);
    else if (current.companies.length || current.people.length) setNote("Pick one of the matches above.");
    else if (tickerish && !ready) setNote("Still searching…");
    else if (tickerish) go(`/c/${encodeURIComponent(upper)}`); // the company page says if it isn't listed
    else setNote("No match. Try a company name or ticker, a person, or a theme like “specialty chemicals”.");
  }

  const people = current.people.length > 0 && (
    <Group title="Your network" count={current.people.length}>
      {current.people.map((p) => (
        <li key={p.id}>
          <Link href={`/people/${p.id}`} className="flex min-h-[48px] flex-col justify-center px-3 py-1.5 hover:bg-paper">
            <span className="text-small text-ink">{p.name}</span>
            <span className="truncate text-caption text-ink-3">{p.why}</span>
          </Link>
        </li>
      ))}
    </Group>
  );
  const companies = current.companies.length > 0 && (
    <Group title="Companies" count={current.companies.length}>
      {current.companies.slice(0, current.people.length ? 5 : 8).map(([s, n]) => (
        <li key={s}>
          <Link href={`/c/${encodeURIComponent(s)}`} className="flex min-h-[44px] items-center gap-3 px-3 hover:bg-paper">
            <span className="w-24 shrink-0 text-small font-medium text-ink">{s}</span>
            <span className="truncate text-small text-ink-2">{n}</span>
          </Link>
        </li>
      ))}
    </Group>
  );
  const open = query.length >= 2 && (ready || searching);

  return (
    <ViewTransition name="finn-dock">
      <div
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/90 backdrop-blur transition-transform duration-200 supports-[backdrop-filter]:bg-paper/80 ${
          hidden && !focused && !q ? "translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 md:max-w-[560px]">
          {open && (
            <div className="mb-2 max-h-[min(18rem,50dvh)] overflow-y-auto rounded-lg border border-rule bg-paper-raised py-1" aria-live="polite">
              {/* a question about the network gets a direct answer first: who, or plainly no one */}
              {asked && ready && !current.failed && (
                <p className="border-b border-rule px-3 pb-2 pt-1.5 text-small text-ink">
                  {(() => {
                    const n = current.people.filter((p) => p.match !== "near").length;
                    return n
                      ? `${n} ${n === 1 ? "person" : "people"} in your network ${n === 1 ? "has" : "have"} a recorded link to “${query}”.`
                      : `No one in your network has a recorded link to “${query}”.${current.people.length ? " Closest themes below." : ""}`;
                  })()}
                </p>
              )}
              {searching && !current.companies.length && !current.people.length ? (
                <p className="px-3 py-2 text-small text-ink-3">Searching…</p>
              ) : current.failed ? (
                <p className="px-3 py-2 text-small text-ink-2">Search is unavailable right now. Try again in a moment.</p>
              ) : !current.companies.length && !current.people.length ? (
                asked ? null : <p className="px-3 py-2 text-small text-ink-2">
                  No matches for &ldquo;{query}&rdquo;. Try a ticker, a person, or a theme like &ldquo;specialty chemicals&rdquo;.
                </p>
              ) : companyFirst ? (
                <>
                  {companies}
                  {people}
                </>
              ) : (
                <>
                  {people}
                  {companies}
                </>
              )}
            </div>
          )}
          {note && <p role="status" className="mb-1.5 text-small text-ink-2">{note}</p>}
          {/* three kinds of search, shown once the box is focused and empty */}
          {focused && !q && (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto" aria-label="Examples">
              <span className="shrink-0 text-caption text-ink-3">Try</span>
              {/* the three kinds of search, including the "who knows" phrasing nobody guesses (three-pillars N4) */}
              {["who knows Titan", "specialty chemicals", "BEL"].map((x) => (
                <button
                  key={x}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setQ(x)}
                  className="chip tap min-h-[36px] shrink-0"
                >
                  {x}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <form onSubmit={submit} role="search" className="min-w-0 flex-1">
              <label htmlFor="ask" className="sr-only">
                Research any NSE company or search your network
              </label>
              <input
                id="ask"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setNote("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQ("");
                    setNote("");
                  }
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Company, person or theme"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="h-11 w-full rounded-lg border border-ink-3 bg-paper-raised px-3.5 text-body placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </form>
            <Link
              href="/settings"
              aria-label="What counts: your alert rules and filters"
              className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rule px-2.5 text-ink-2 hover:text-ink"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 6h9M15 6h2M3 14h3M9 14h8" />
                <circle cx="13.5" cy="6" r="1.75" />
                <circle cx="7.5" cy="14" r="1.75" />
              </svg>
              {/* the icon gets its word where there's room (three-pillars S5) */}
              <span className="hidden text-small min-[400px]:inline">Rules</span>
            </Link>
          </div>
        </div>
      </div>
    </ViewTransition>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <p className="flex items-center gap-2 px-3 pb-1 pt-2.5">
        <span className="kicker text-ink-3">{title}</span>
        <span className="count bg-ink-3">{count}</span>
      </p>
      <ul aria-label={title}>{children}</ul>
    </section>
  );
}
