"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Other parts of the app announce a navigation they start in code (the search dock's router.push). */
export const NAV_START = "finn:navstart";

const keyOf = (path: string, search: string) => `${path}?${new URLSearchParams(search).toString()}`;

/**
 * A thin bar at the top from the moment a link is tapped until the new page is on screen (13 Nov): the
 * server takes a moment to prepare a page, and nothing used to say the tap had registered.
 *
 * It starts on a same-site link to another page (anchors handled in the page carry data-inpage; links
 * to a #section of the same page don't count), or on NAV_START; it ends as soon as the address changes. The bar
 * waits ~120ms before showing, so a page that arrives at once never flashes it. Gives up after 12s.
 */
export function NavProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const here = keyOf(pathname, params.toString());
  const [from, setFrom] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // the page we were on has changed: the navigation is done (state adjusted during render, no effect needed)
  if (from !== null && from !== here) setFrom(null);

  useEffect(() => {
    const start = () => {
      setFrom(keyOf(location.pathname, location.search));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFrom(null), 12_000);
    };
    // Next's Link prevents the default itself (it navigates in code), so "default prevented" can't tell a
    // navigation from an in-page control: in-page anchors say so with data-inpage (windows, "See 3 days")
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download") || a.hasAttribute("data-inpage") || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page or a #section
      start();
    };
    window.addEventListener("click", onClick);
    window.addEventListener(NAV_START, start);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener(NAV_START, start);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (from === null || from !== here) return null;
  return (
    <>
      <div className="nav-progress" aria-hidden />
      <p role="status" className="sr-only">
        Loading
      </p>
    </>
  );
}
