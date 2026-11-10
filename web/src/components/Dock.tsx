"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Edition } from "@/lib/types";

/**
 * Bottom dock: Ask (open any NSE company), "Brief me · 60s" (reads the edition
 * aloud with the browser's own speech engine -- no cost, no network), and the
 * "What counts" settings. Chat is the escape hatch, not the front door.
 */
export function Dock({ edition }: { edition: Edition }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const utter = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  function brief() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const lines = [
      edition.leads.length ? `${edition.leads.length} things matter.` : "Nothing material in this window.",
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
    const sym = q.trim().toUpperCase().replace(/[^A-Z0-9&-]/g, "");
    if (sym) router.push(`/c/${encodeURIComponent(sym)}`);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto max-w-[480px] px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        <form onSubmit={submit} role="search">
          <label htmlFor="ask" className="sr-only">
            Research any NSE company
          </label>
          <input
            id="ask"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Research any NSE ticker, e.g. DIXON"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 w-full rounded-md border border-rule bg-paper-raised px-3 text-[0.9375rem] placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </form>
        <div className="mt-1.5 flex items-center justify-between text-[0.8125rem]">
          {canSpeak ? (
            <button type="button" onClick={brief} className="min-h-[36px] text-ink-2 hover:text-ink" aria-pressed={speaking}>
              {speaking ? "■ Stop" : "▶ Brief me · 60s"}
            </button>
          ) : (
            <span />
          )}
          <Link href="/settings" className="min-h-[36px] content-center text-ink-2 hover:text-ink">
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
