"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "finn_last_visit";

/** "Since last visit" window chip. The timestamp lives only in this browser (per-device convenience). */
export function SinceLastVisit({ active }: { active: boolean }) {
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    try {
      const prev = localStorage.getItem(KEY);
      setSince(prev);
      // record this visit for next time, but only after a minute so a quick reload doesn't reset it
      const t = setTimeout(() => localStorage.setItem(KEY, new Date().toISOString()), 60_000);
      return () => clearTimeout(t);
    } catch {
      /* private mode: no chip */
    }
  }, []);

  if (!since) return null;
  return (
    <Link
      href={`/?w=since&t=${encodeURIComponent(since)}`}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-[36px] items-center whitespace-nowrap rounded-full px-3 text-[0.8125rem] ${
        active ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
      }`}
    >
      Since last visit
    </Link>
  );
}
