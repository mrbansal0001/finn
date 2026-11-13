"use client";

import { useEffect, useState } from "react";

/**
 * In-page shortcuts for a long company page (plan §9.3): hairline pills that jump to a section, and the
 * one you're reading fills in as you scroll.
 */
export function SectionNav({ sections, onGo }: { sections: [string, string][]; onGo?: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = sections.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : Infinity);
        const top = [...seen.entries()].filter(([, y]) => y !== Infinity).sort((a, b) => a[1] - b[1])[0];
        setActive(top ? top[0] : null);
      },
      { rootMargin: "-20% 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  return (
    // sticky under the top edge once scrolled; the only other fixed element is the search dock, at the bottom.
    // Equal segments in the app's one view-control style, so all five fit a phone (layout plan §5, §9.2)
    <nav
      aria-label="On this page"
      className="sticky top-0 z-10 -mx-4 mt-5 border-b border-rule bg-paper/95 px-4 py-1.5 backdrop-blur min-[400px]:-mx-5 min-[400px]:px-5"
    >
      <div className="seg seg-sm">
        {sections.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            data-inpage
            onClick={
              onGo
                ? (e) => {
                    e.preventDefault();
                    onGo(id);
                  }
                : undefined
            }
            aria-current={active === id ? "location" : undefined}
            className="!px-1"
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
