"use client";

import { useEffect, useState } from "react";

/**
 * In-page shortcuts for a long company page (plan §9.3): hairline pills that jump to a section, and the
 * one you're reading fills in as you scroll.
 */
export function SectionNav({ sections }: { sections: [string, string][] }) {
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
    <nav aria-label="On this page" className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto">
      {sections.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={active === id ? "location" : undefined}
          className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-full border px-4 text-small transition-colors ${
            active === id ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:text-ink"
          }`}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
