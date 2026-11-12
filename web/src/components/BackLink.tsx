"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "finn_nav_depth";

/** Counts in-app page views in this tab, so "Back" knows whether there is an in-app page to return to. */
export function NavTracker() {
  const path = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, String(Number(sessionStorage.getItem(KEY) ?? "0") + 1));
    } catch {}
  }, [path]);
  return null;
}

/**
 * "‹ Back": returns to the page the visitor came from, with its window and scroll position intact
 * (a 7-day reader stays on 7 days). Opened directly from a link, it goes to `fallback` instead.
 */
export function BackLink({ fallback = "/", label = "Back" }: { fallback?: string; label?: string }) {
  const router = useRouter();
  return (
    <nav className="text-small">
      <Link
        href={fallback}
        onClick={(e) => {
          let depth = 0;
          try {
            depth = Number(sessionStorage.getItem(KEY) ?? "0");
          } catch {}
          if (depth > 1 && window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
        className="-ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-ink-2 hover:text-ink"
      >
        <span aria-hidden>‹</span> {label}
      </Link>
    </nav>
  );
}
