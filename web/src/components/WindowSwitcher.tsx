"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BriefButton } from "./BriefButton";
import { ThemeToggle } from "./ThemeToggle";
import { SinceLastVisit } from "./SinceLastVisit";

export type WindowTab = { key: string; label: string; short: string; href: string };

/**
 * The edition's time windows switch instantly, in the browser: all four were rendered with the page, so a tap
 * shows another panel instead of asking the server again (each switch used to be a 350–500 ms round trip,
 * more on mobile data, with the tab not changing until the new page arrived). The address still updates, so
 * Back, reload and shared links land on the same window. Without JavaScript the tabs are ordinary links.
 */
export function WindowSwitcher({
  initial,
  tabs,
  panels,
  scripts,
  wordmark,
  masthead,
  sinceSeen,
}: {
  initial: string;
  tabs: WindowTab[];
  panels: Record<string, ReactNode>;
  scripts: Record<string, string>;
  wordmark: ReactNode;
  masthead: ReactNode;
  sinceSeen: string;
}) {
  const [active, setActive] = useState(initial);

  const show = (key: string) => {
    const tab = tabs.find((t) => t.key === key);
    if (!tab) return;
    setActive(key);
    // keep the address in step without a navigation (Next's router follows native history calls)
    window.history.replaceState(null, "", tab.href);
  };

  // "See 3 days ›" inside a panel asks for a wider window the same way
  useEffect(() => {
    const on = (e: Event) => show((e as CustomEvent<string>).detail);
    window.addEventListener("finn:window", on);
    return () => window.removeEventListener("finn:window", on);
  });

  return (
    <>
      <header className="flex items-center justify-between">
        {wordmark}
        <div className="-mr-2 flex items-center">
          <BriefButton script={scripts[active] ?? ""} />
          <ThemeToggle />
        </div>
      </header>
      {masthead}

      <nav aria-label="Edition window" className="-mx-1 mt-4 flex gap-1 overflow-x-auto">
        <SinceLastVisit active={active === "since"} seen={sinceSeen} />
        {tabs.map((x) => (
          <a
            key={x.key}
            href={x.href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return; // a new tab still works
              e.preventDefault();
              show(x.key);
            }}
            aria-current={x.key === active ? "page" : undefined}
            aria-label={x.label}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap rounded-full px-4 text-small transition-colors duration-150 max-[359px]:px-3 ${
              x.key === active ? "bg-ink font-medium text-paper" : "text-ink-2 hover:text-ink"
            }`}
          >
            {/* very narrow phones get the short form so all four fit */}
            <span className="max-[359px]:hidden">{x.label}</span>
            <span className="hidden max-[359px]:inline">{x.short}</span>
          </a>
        ))}
      </nav>

      {Object.entries(panels).map(([key, node]) => (
        <div key={key} hidden={key !== active}>
          {node}
        </div>
      ))}
    </>
  );
}

/** A link inside a panel that switches the window in place ("See 3 days ›"). */
export function WindowLink({ to, href, children, className }: { to: string; href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("finn:window", { detail: to }));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {children}
    </a>
  );
}
