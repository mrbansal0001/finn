"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Edition } from "@/lib/types";

type Person = { id: string; name: string; why: string };

/** "who knows TCS" -> "TCS": the phrasings the network search actually supports, stated as such. */
export function searchTerm(q: string): { term: string; asked: boolean } {
  const m = q.trim().match(/^(?:who|anyone|someone|people|experts?)\b.*?\b(?:knows?|at|in|on|from|about|worked at|works at|studied at)\s+(.+?)\??$/i);
  return m ? { term: m[1].trim(), asked: true } : { term: q.trim(), asked: false };
}
const canSpeakNow = () => typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Bottom dock: Ask (open any NSE company), "Brief me · 60s" (reads the edition
 * aloud with the browser's own speech engine -- no cost, no network), and the
 * "What counts" settings. Chat is the escape hatch, not the front door.
 */
export function Dock({ edition, alerts = 0 }: { edition?: Edition; alerts?: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  // results remember the query they answer, so Enter never acts on a stale, shorter query
  const [res, setRes] = useState<{ q: string; companies: [string, string][]; people: Person[]; failed?: boolean }>({ q: "", companies: [], people: [] });
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = useSyncExternalStore(() => () => {}, canSpeakNow, () => false);
  const utter = useRef<SpeechSynthesisUtterance | null>(null);
  const { term: query, asked } = searchTerm(q);
  const ready = query.length >= 2 && res.q === query;
  const current = ready ? res : { q: query, companies: [] as [string, string][], people: [] as Person[], failed: false };
  const [note, setNote] = useState("");

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

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

  function brief() {
    if (!edition) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const lines = [
      edition.leads.length
        ? `${edition.leads.length} ${edition.leads.length === 1 ? "thing matters" : "things matter"}.`
        : "No single item leads this window.",
      alerts ? `${alerts} price or volume rule ${alerts === 1 ? "match" : "matches"} at the close.` : "",
      ...edition.leads.map((c) => `${spoken(c.company)}. ${c.headline ?? c.nse_subject}. ${c.why ?? ""}`),
      edition.more.length ? `${edition.more.length} more worth a look, and ${edition.routine_total} routine filings folded.` : "",
      "End of edition.",
    ];
    const u = new SpeechSynthesisUtterance(lines.filter(Boolean).join(" "));
    u.lang = "en-IN";
    u.rate = 1.05;
    u.onend = () => setSpeaking(false);
    utter.current = u;
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote("");
    // only a single ticker-shaped word is ever opened as a ticker; a sentence never is (audit F11)
    const tickerish = /^[A-Za-z0-9&-]{1,20}$/.test(query);
    const typed = query.toUpperCase();
    const exact = current.companies.find(([s]) => s === typed)?.[0];
    if (asked && current.people[0]) router.push(`/people/${current.people[0].id}`);
    else if (exact) router.push(`/c/${encodeURIComponent(exact)}`);
    else if (current.people[0] && !current.companies.length) router.push(`/people/${current.people[0].id}`);
    else if (current.companies[0] && !current.people.length) router.push(`/c/${encodeURIComponent(current.companies[0][0])}`);
    else if (current.companies.length || current.people.length) setNote("Pick one of the matches above.");
    else if (tickerish && !ready) setNote("Still searching…");
    else if (tickerish) router.push(`/c/${encodeURIComponent(typed)}`);   // the company page says if it isn't listed
    else setNote("No match. Try a company name or ticker, a person, or a theme like “specialty chemicals”.");
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {(current.companies.length > 0 || current.people.length > 0) && (
          <div className="mb-2 max-h-72 overflow-y-auto rounded-md border border-rule bg-paper-raised">
            {current.people.length > 0 && (
              <>
                <p className="px-3 pt-2 text-[0.6875rem] uppercase tracking-wider text-ink-3">Your network</p>
                <ul aria-label="People in your network">
                  {current.people.map((p) => (
                    <li key={p.id}>
                      <Link href={`/people/${p.id}`} className="flex min-h-[44px] flex-col justify-center px-3 py-1 text-[0.875rem] hover:bg-paper">
                        <span className="text-ink">{p.name}</span>
                        <span className="truncate text-[0.8125rem] text-ink-2">{p.why}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {current.companies.length > 0 && (
              <>
                <p className="px-3 pt-2 text-[0.6875rem] uppercase tracking-wider text-ink-3">Companies</p>
                <ul aria-label="Matching companies">
                  {current.companies.map(([s, n]) => (
                    <li key={s}>
                      <Link href={`/c/${encodeURIComponent(s)}`} className="flex min-h-[44px] w-full items-center gap-3 px-3 text-left text-[0.875rem] hover:bg-paper">
                        <span className="num w-24 shrink-0 text-ink">{s}</span>
                        <span className="truncate text-ink-2">{n}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {note && <p role="status" className="mb-1 text-[0.8125rem] text-ink-2">{note}</p>}
        {current.failed && <p role="status" className="mb-1 text-[0.8125rem] text-ink-2">Search is unavailable right now.</p>}
        <form onSubmit={submit} role="search">
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
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 w-full rounded-md border border-ink-3 bg-paper-raised px-3 text-[1rem] placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </form>
        <div className="mt-1.5 flex items-center justify-between text-[0.8125rem]">
          {canSpeak && edition ? (
            <button type="button" onClick={brief} className="min-h-[44px] text-ink-2 hover:text-ink" aria-pressed={speaking}>
              {speaking ? "■ Stop" : "▶ Listen to brief"}
            </button>
          ) : (
            <span />
          )}
          <Link href="/settings" className="min-h-[44px] content-center text-ink-2 hover:text-ink">
            What counts ›
          </Link>
        </div>
      </div>
    </div>
  );
}

function spoken(company: string) {
  return company.replace(/ Limited$/, "").replace(/ Ltd\.?$/, "");
}
