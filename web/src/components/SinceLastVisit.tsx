"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

const KEY = "finn_last_seen_data";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode: no chip
  }
}

/** "Since last visit" window chip. Stores the data timestamp the visitor saw (not the wall clock), so a
 *  filing that reaches FINN after the visit but carries an earlier time still shows next time.
 *  Lives only in this browser (a per-device convenience). */
export function SinceLastVisit({ active, seen }: { active: boolean; seen: string }) {
  const since = useSyncExternalStore(() => () => {}, read, () => null);

  useEffect(() => {
    // record what this visit saw, after a minute so a quick reload doesn't reset it
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, seen);
      } catch {}
    }, 60_000);
    return () => clearTimeout(t);
  }, [seen]);

  if (!since || since >= seen) return null;
  return (
    <Link
      href={`/?w=since&t=${encodeURIComponent(since)}`}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full px-3 text-small ${
        active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
      }`}
    >
      Since last visit
    </Link>
  );
}
