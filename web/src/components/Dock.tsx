"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ViewTransition, useEffect, useState } from "react";

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote("");
    // only a single ticker-shaped word is ever opened as a ticker; a sentence never is (audit F11)
    const tickerish = /^[A-Za-z0-9&-]{1,20}$/.test(query);
    const exact = current.companies.find(([s]) => s === upper)?.[0];
    if (asked && current.people[0]) router.push(`/people/${current.people[0].id}`);
    else if (exact) router.push(`/c/${encodeURIComponent(exact)}`);
    else if (current.people[0] && !current.companies.length) router.push(`/people/${current.people[0].id}`);
    else if (current.companies[0] && !current.people.length) router.push(`/c/${encodeURIComponent(current.companies[0][0])}`);
    else if (current.companies.length || current.people.length) setNote("Pick one of the matches above.");
    else if (tickerish && !ready) setNote("Still searching…");
    else if (tickerish) router.push(`/c/${encodeURIComponent(upper)}`); // the company page says if it isn't listed
    else setNote("No match. Try a company name or ticker, a person, or a theme like “specialty chemicals”.");
  }

  const people = current.people.length > 0 && (
    <Group title="Your network" count={current.people.length}>
      {current.people.map((p) => (
        <li key={p.id}>
          <Link href={`/people/${p.id}`} className="flex min-h-[48px] flex-col justify-center px-3 py-1.5 hover:bg-paper">
            <span className="text-small text-ink">{p.name}</span>
            <span className="truncate text-meta text-ink-2">{p.why}</span>
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
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
        <div className="mx-auto max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 md:max-w-[560px]">
          {open && (
            <div className="mb-2 max-h-[min(18rem,50dvh)] overflow-y-auto rounded-md border border-rule bg-paper-raised py-1" aria-live="polite">
              {searching && !current.companies.length && !current.people.length ? (
                <p className="px-3 py-2 text-small text-ink-3">Searching…</p>
              ) : current.failed ? (
                <p className="px-3 py-2 text-small text-ink-2">Search is unavailable right now. Try again in a moment.</p>
              ) : !current.companies.length && !current.people.length ? (
                <p className="px-3 py-2 text-small text-ink-2">
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
          {note && <p role="status" className="mb-1 text-small text-ink-2">{note}</p>}
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
                placeholder="Company, person or theme"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="h-11 w-full rounded-md border border-ink-3 bg-paper-raised px-3 text-body placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </form>
            <Link
              href="/settings"
              aria-label="What counts: your alert rules and filters"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-rule text-ink-2 hover:text-ink"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 6h9M15 6h2M3 14h3M9 14h8" />
                <circle cx="13.5" cy="6" r="1.75" />
                <circle cx="7.5" cy="14" r="1.75" />
              </svg>
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
      <p className="px-3 pb-0.5 pt-2 text-meta uppercase tracking-wider text-ink-3">
        {title} · {count}
      </p>
      <ul aria-label={title}>{children}</ul>
    </section>
  );
}
